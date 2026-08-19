<template>
  <div class="space-y-3">
    <div class="relative aspect-[3/4] max-h-[58vh] min-h-64 overflow-hidden rounded-xl bg-black sm:aspect-video sm:min-h-0">
      <video
        ref="video"
        autoplay
        muted
        playsinline
        class="h-full w-full object-cover"
      ></video>
      <div
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div :class="targetFrameClass" class="rounded-lg border-2 border-blue-400"></div>
      </div>
      <div
        v-if="currentCameraLabel"
        class="pointer-events-none absolute right-2 top-2 max-w-[70%] truncate rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm"
        :title="currentCameraLabel"
      >
        {{ currentCameraLabel }}
      </div>
    </div>
    <div v-if="error" class="rounded-lg bg-red-900/60 p-3 text-sm text-red-100">
      {{ error }}
    </div>
    <div
      v-if="!active"
      :class="cameras.length > 1 ? 'grid grid-cols-2 gap-2' : ''"
    >
      <button
        type="button"
        class="min-h-12 w-full touch-manipulation rounded-lg bg-blue-600 px-4 py-3 font-medium"
        title="Retry camera"
        aria-label="Retry camera"
        @click="start"
      >
        <VideoCameraIcon class="mx-auto h-6 w-6" />
        <span class="sr-only">Retry camera</span>
      </button>
      <button
        v-if="cameras.length > 1"
        type="button"
        class="min-h-12 touch-manipulation rounded-lg bg-gray-700 px-4 py-3 font-medium disabled:opacity-50"
        title="Switch to another camera"
        aria-label="Switch to another camera"
        :disabled="switching"
        @click="switchCamera"
      >
        <ArrowPathIcon v-if="switching" class="mx-auto h-6 w-6 animate-spin" />
        <ArrowsRightLeftIcon v-else class="mx-auto h-6 w-6" />
        <span class="sr-only">Switch to another camera</span>
      </button>
    </div>
    <div v-else class="grid grid-cols-2 gap-2">
      <button
        type="button"
        class="min-h-12 touch-manipulation rounded-lg bg-gray-700 px-4 py-3 font-medium"
        title="Stop camera"
        aria-label="Stop camera"
        @click="stop"
      >
        <StopCircleIcon class="mx-auto h-6 w-6" />
        <span class="sr-only">Stop camera</span>
      </button>
      <button
        type="button"
        class="min-h-12 touch-manipulation rounded-lg bg-gray-700 px-4 py-3 font-medium disabled:opacity-50"
        title="Switch camera"
        aria-label="Switch camera"
        :disabled="switching"
        @click="switchCamera"
      >
        <ArrowPathIcon v-if="switching" class="mx-auto h-6 w-6 animate-spin" />
        <ArrowsRightLeftIcon v-else class="mx-auto h-6 w-6" />
        <span class="sr-only">Switch camera</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  StopCircleIcon,
  VideoCameraIcon,
} from "@heroicons/vue/24/outline";

const emit = defineEmits<{ scanned: [value: string] }>();
const props = withDefaults(
  defineProps<{
    scanCooldownMs?: number;
    format?: "qr" | "barcode" | "any";
  }>(),
  { scanCooldownMs: 0, format: "any" },
);
const targetFrameClass = computed(() =>
  props.format === "qr"
    ? "aspect-square w-3/5 max-w-72"
    : props.format === "barcode"
      ? "h-1/3 w-4/5"
      : "h-2/5 w-4/5 sm:h-2/3",
);
const video = ref<HTMLVideoElement>();
const active = ref(false);
const switching = ref(false);
const error = ref("");
const currentCameraLabel = ref("");
const CAMERA_COOKIE = "inventory_kiosk_camera";
const FACING_COOKIE = "inventory_kiosk_camera_facing";
const readCookie = (name: string) =>
  decodeURIComponent(
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.split("=")[1] || "",
  );
const writeCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax`;
};
const savedFacing = readCookie(FACING_COOKIE);
const preferredCameraId = ref(readCookie(CAMERA_COOKIE));
const facingMode = ref<"environment" | "user">(
  savedFacing === "user" ? "user" : "environment",
);
const cameras = ref<MediaDeviceInfo[]>([]);
const cameraIndex = ref(0);
let reader: BrowserMultiFormatReader | null = null;
let controls: { stop(): void } | null = null;
let accepted = false;

async function start() {
  stop();
  error.value = "";
  accepted = false;

  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = window.isSecureContext
      ? "This browser does not support camera scanning."
      : "Camera access requires HTTPS or localhost.";
    return;
  }

  active.value = true;
  await nextTick();
  try {
    const detectedCameras = (
      await navigator.mediaDevices.enumerateDevices()
    ).filter((device) => device.kind === "videoinput");
    const preferredIndex = detectedCameras.findIndex(
      (device) =>
        !!preferredCameraId.value && device.deviceId === preferredCameraId.value,
    );
    if (preferredIndex >= 0) {
      cameras.value = detectedCameras;
      cameraIndex.value = preferredIndex;
    } else if (cameras.value.length) {
      cameras.value = detectedCameras;
      if (cameraIndex.value >= detectedCameras.length) cameraIndex.value = 0;
    }
    const hints = new Map();
    if (props.format === "qr") {
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      hints.set(DecodeHintType.TRY_HARDER, true);
    } else if (props.format === "barcode") {
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
    }
    reader = new BrowserMultiFormatReader(hints);
    const selectedCamera = cameras.value[cameraIndex.value];
    currentCameraLabel.value =
      selectedCamera?.label ||
      (facingMode.value === "environment" ? "Back camera" : "Front camera");
    controls = await reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          ...(selectedCamera
            ? { deviceId: { exact: selectedCamera.deviceId } }
            : { facingMode: { ideal: facingMode.value } }),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      video.value!,
      (result: any) => {
        if (!result || accepted) return;
        accepted = true;
        const value = result.getText();
        emit("scanned", value);
        if (props.scanCooldownMs > 0) {
          window.setTimeout(() => {
            accepted = false;
          }, props.scanCooldownMs);
        } else {
          stop();
        }
      },
    );
    cameras.value = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === "videoinput",
    );
    const activeTrack = (video.value?.srcObject as MediaStream | null)
      ?.getVideoTracks()[0];
    const activeDeviceId = activeTrack?.getSettings().deviceId;
    const activeIndex = cameras.value.findIndex(
      (device) => device.deviceId === activeDeviceId,
    );
    if (activeIndex >= 0) cameraIndex.value = activeIndex;
    currentCameraLabel.value =
      cameras.value[activeIndex]?.label ||
      activeTrack?.label ||
      (facingMode.value === "environment" ? "Back camera" : "Front camera");
    if (activeDeviceId) {
      preferredCameraId.value = activeDeviceId;
      writeCookie(CAMERA_COOKIE, activeDeviceId);
    }
    const activeFacing = (
      video.value?.srcObject as MediaStream | null
    )?.getVideoTracks()[0]?.getSettings().facingMode;
    if (activeFacing === "environment" || activeFacing === "user") {
      facingMode.value = activeFacing;
      writeCookie(FACING_COOKIE, activeFacing);
    }
  } catch (err: any) {
    try {
      const detectedCameras = (
        await navigator.mediaDevices.enumerateDevices()
      ).filter((device) => device.kind === "videoinput");
      if (detectedCameras.length) cameras.value = detectedCameras;
    } catch {
      // Keep the original camera error when device enumeration is unavailable.
    }
    error.value =
      err?.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access and try again."
        : err?.name === "NotFoundError"
          ? "No camera was found on this device."
          : err?.name === "NotReadableError"
            ? "The camera is already in use by another app."
            : `Could not start the camera${err?.message ? `: ${err.message}` : "."}`;
    stop();
  }
}

async function switchCamera() {
  if (switching.value) return;
  switching.value = true;
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === "videoinput",
    );
    cameras.value = devices;
    if (devices.length > 1) {
      cameraIndex.value = (cameraIndex.value + 1) % devices.length;
      preferredCameraId.value = devices[cameraIndex.value].deviceId;
      writeCookie(CAMERA_COOKIE, preferredCameraId.value);
    } else {
      facingMode.value =
        facingMode.value === "environment" ? "user" : "environment";
      cameras.value = [];
      preferredCameraId.value = "";
      writeCookie(CAMERA_COOKIE, "");
      writeCookie(FACING_COOKIE, facingMode.value);
    }
    await start();
  } finally {
    switching.value = false;
  }
}

function stop() {
  controls?.stop();
  controls = null;
  reader = null;
  const stream = video.value?.srcObject as MediaStream | null;
  stream?.getTracks().forEach((track) => track.stop());
  if (video.value) video.value.srcObject = null;
  active.value = false;
}

onMounted(start);
onBeforeUnmount(stop);
defineExpose({ start, stop });
</script>
