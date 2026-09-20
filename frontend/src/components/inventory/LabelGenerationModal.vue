<template>
  <div
    class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
    @click.self="$emit('close')"
  >
    <div
      class="w-full max-w-md space-y-5 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-generation-title"
    >
      <div>
        <h2
          id="label-generation-title"
          class="text-xl font-semibold text-white"
        >
          {{
            phase === "done"
              ? "Labels ready"
              : phase === "failed"
                ? "Couldn't generate labels"
                : "Generating labels…"
          }}
        </h2>
        <p class="mt-1 text-sm text-gray-400">
          {{ itemIds.length }} {{ itemIds.length === 1 ? "label" : "labels" }} ·
          {{ template.name }}
        </p>
      </div>

      <div v-if="phase === 'working'" class="space-y-3" role="status">
        <div
          class="h-2 overflow-hidden rounded-full bg-gray-700"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-full bg-blue-500 transition-all duration-300"
            :class="{ 'animate-pulse': !percent }"
            :style="{ width: `${Math.max(percent, 4)}%` }"
          ></div>
        </div>
        <p class="text-sm text-gray-300">{{ statusText }}</p>
        <p v-if="slow" class="text-sm text-amber-300">
          Still waiting for the label worker to pick this up. This can take a
          moment if it is busy or restarting.
        </p>
      </div>

      <div v-else-if="phase === 'done'" class="space-y-4">
        <div class="flex items-start gap-3 rounded-lg bg-green-900/40 p-3">
          <CheckCircleIcon class="mt-0.5 h-5 w-5 flex-none text-green-400" />
          <p class="text-sm text-green-200">
            Your PDF is ready. When printing, choose a
            <strong class="whitespace-nowrap"
              >{{ template.widthIn }}″ × {{ template.heightIn }}″</strong
            >
            paper size and turn scaling off (100%).
          </p>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <button
            class="flex items-center rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
            @click="download"
          >
            <ArrowDownTrayIcon class="mr-2 h-4 w-4" />Download PDF
          </button>
          <button
            class="flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
            @click="openPdf"
          >
            <PrinterIcon class="mr-2 h-4 w-4" />Open &amp; print
          </button>
        </div>
      </div>

      <div v-else class="space-y-4">
        <div
          class="rounded-lg bg-red-900/50 p-3 text-sm text-red-200"
          role="alert"
        >
          {{ error }}
        </div>
        <div class="flex justify-end gap-2">
          <button
            class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
            @click="run"
          >
            Try again
          </button>
        </div>
      </div>

      <div class="flex justify-end border-t border-gray-700 pt-4">
        <button
          class="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
          @click="$emit('close')"
        >
          {{ phase === "working" ? "Hide" : "Close" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  PrinterIcon,
} from "@heroicons/vue/24/outline";
import apiService from "@/services/api";
import type {
  InventoryLabelJobStatus,
  InventoryLabelTemplate,
} from "@/types/api";

const props = defineProps<{
  itemIds: string[];
  template: InventoryLabelTemplate;
}>();
defineEmits<{ close: [] }>();

const POLL_INTERVAL_MS = 800;
const SLOW_AFTER_MS = 8_000;
const GIVE_UP_AFTER_MS = 3 * 60_000;
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

type Phase = "working" | "done" | "failed";
const phase = ref<Phase>("working"),
  status = ref<InventoryLabelJobStatus | null>(null),
  error = ref(""),
  slow = ref(false),
  pdfUrl = ref("");
let stopped = false;

const percent = computed(() => {
  const progress = status.value?.progress;
  return progress?.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0;
});
const statusText = computed(() => {
  if (status.value?.state === "processing") {
    return `Rendering ${status.value.progress.done} of ${status.value.progress.total}…`;
  }
  return "Queued — waiting for the label worker…";
});
const filename = computed(
  () =>
    `inventory-labels-${props.template.widthIn}x${props.template.heightIn}-${new Date().toISOString().slice(0, 10)}.pdf`,
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const message = (e: any, fallback: string) =>
  e?.response?.data?.error || e?.message || fallback;

function releasePdf() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
  pdfUrl.value = "";
}

async function run() {
  releasePdf();
  status.value = null;
  phase.value = "working";
  error.value = "";
  slow.value = false;
  try {
    const jobId = await apiService.requestInventoryLabels(
      props.itemIds,
      props.template.id,
    );
    await poll(jobId);
  } catch (e: any) {
    if (stopped) return;
    error.value = message(e, "Could not generate labels");
    phase.value = "failed";
  }
}

async function poll(jobId: string) {
  const startedAt = Date.now();
  let errors = 0;
  while (!stopped) {
    try {
      status.value = await apiService.getInventoryLabelJob(jobId);
      errors = 0;
    } catch (e: any) {
      // A missing job will never appear; anything else may be a network blip.
      if (e?.response?.status === 404 || ++errors >= MAX_CONSECUTIVE_POLL_ERRORS)
        throw e;
    }
    const state = status.value?.state;
    if (state === "failed") {
      throw new Error(status.value?.error || "Label generation failed");
    }
    if (state === "completed") {
      const blob = await apiService.downloadInventoryLabels(jobId);
      if (stopped) return;
      pdfUrl.value = URL.createObjectURL(blob);
      phase.value = "done";
      return;
    }
    const elapsed = Date.now() - startedAt;
    slow.value = state === "queued" && elapsed > SLOW_AFTER_MS;
    if (elapsed > GIVE_UP_AFTER_MS) {
      throw new Error(
        "Label generation is taking too long. Check that the worker is running and try again.",
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

function download() {
  const link = document.createElement("a");
  link.href = pdfUrl.value;
  link.download = filename.value;
  link.click();
}
const openPdf = () => window.open(pdfUrl.value, "_blank");

onMounted(run);
onBeforeUnmount(() => {
  stopped = true;
  releasePdf();
});
</script>
