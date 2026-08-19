<template>
  <div class="mx-auto w-full max-w-3xl pb-[env(safe-area-inset-bottom)]">
    <div class="mb-4 sm:mb-8">
      <h1 class="text-2xl font-bold sm:text-3xl">Inventory kiosk</h1>
      <p class="mt-1 text-sm text-gray-400 sm:text-base">
        Scan with the camera or use a barcode reader/keyboard.
      </p>
    </div>
    <div class="mb-4 grid grid-cols-3 gap-2 sm:mb-6 sm:gap-3">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="changeMode(tab.id)"
        :class="mode === tab.id ? 'bg-blue-600' : 'bg-gray-800'"
        :title="tab.label"
        :aria-label="tab.label"
        class="flex min-h-14 touch-manipulation items-center justify-center rounded-xl p-3 sm:min-h-16 sm:p-5"
      >
        <component :is="tab.icon" class="h-6 w-6 sm:h-7 sm:w-7" />
        <span class="sr-only">{{ tab.label }}</span>
      </button>
    </div>
    <section
      class="space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-4 sm:space-y-5 sm:p-8"
    >
      <div class="grid grid-cols-2 gap-2 rounded-xl bg-gray-950 p-1">
        <button
          @click="inputMode = 'text'"
          :class="
            inputMode === 'text' ? 'bg-gray-700 text-white' : 'text-gray-400'
          "
          class="min-h-12 touch-manipulation rounded-lg p-3 font-medium"
          title="Text or scanner entry"
          aria-label="Text or scanner entry"
        >
          <CursorArrowRaysIcon class="mx-auto h-6 w-6" />
          <span class="sr-only">Text or scanner entry</span></button
        ><button
          @click="inputMode = 'camera'"
          :class="
            inputMode === 'camera' ? 'bg-gray-700 text-white' : 'text-gray-400'
          "
          class="min-h-12 touch-manipulation rounded-lg p-3 font-medium"
          title="Camera entry"
          aria-label="Camera entry"
        >
          <CameraIcon class="mx-auto h-6 w-6" />
          <span class="sr-only">Camera entry</span>
        </button>
      </div>
      <template v-if="inputMode === 'text'">
        <div v-if="mode === 'checkout'" class="relative">
          <label class="label">1. Member profile</label
          ><input
            ref="firstInput"
            v-model="memberQuery"
            autocomplete="off"
            @input="findMembers"
            @keyup.enter="acceptMemberEntry"
            class="field"
            placeholder="Search name or email, or scan profile QR"
          />
          <div
            v-if="memberResults.length"
            class="absolute z-20 mt-1 max-h-[45vh] w-full overflow-y-auto overscroll-contain rounded-xl border border-gray-600 bg-gray-800 p-1 shadow-2xl"
          >
            <button
              v-for="member in memberResults"
              :key="member.id"
              type="button"
              class="block min-h-14 w-full touch-manipulation rounded-lg px-4 py-3 text-left hover:bg-gray-700"
              @click="selectMember(member)"
            >
              <div class="font-medium text-white">
                {{
                  member.displayName || `${member.firstName} ${member.lastName}`
                }}
              </div>
              <div class="text-sm text-gray-400">{{ member.email }}</div>
            </button>
          </div>
          <p
            v-if="memberCode && selectedMember"
            class="mt-2 text-sm text-green-300"
          >
            Selected
            {{
              selectedMember.displayName ||
              `${selectedMember.firstName} ${selectedMember.lastName}`
            }}
            · {{ selectedMember.email }}
          </p>
        </div>
        <div v-if="mode === 'quick-add'" class="space-y-4">
          <div>
            <label class="label">Item name</label
            ><input
              v-model="name"
              class="field"
              list="kiosk-names"
              placeholder="e.g. USB-C adapter"
            />
          </div>
          <div>
            <label class="label">Bin</label
            ><select v-model="binId" class="field">
              <option value="">No bin</option>
              <option v-for="bin in bins" :key="bin.id" :value="bin.id">
                {{ binLabel(bin) }}
              </option>
            </select>
          </div>
        </div>
        <div>
          <label class="label"
            >{{ mode === "checkout" ? "2. " : "" }}Item barcode</label
          >
          <div class="flex min-w-0 gap-2">
            <input
              ref="barcodeInput"
              v-model="barcode"
              :list="mode === 'quick-add' ? undefined : 'kiosk-items'"
              autocomplete="off"
              @keyup.enter="submit"
              class="field min-w-0 flex-1"
              placeholder="Search item name or barcode"
            /><button
              v-if="mode === 'quick-add'"
              type="button"
              @click="generateBarcode"
              title="Auto-generate barcode"
              aria-label="Auto-generate barcode"
              class="mt-2 flex min-h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-xl bg-gray-700 font-medium sm:w-14"
            >
              <SparklesIcon class="h-6 w-6" />
              <span class="sr-only">Auto-generate barcode</span>
            </button>
          </div>
          <datalist v-if="mode !== 'quick-add'" id="kiosk-items">
            <option
              v-for="item in suggestedItems"
              :key="item.id"
              :value="item.barcode"
            >
              {{ item.name }} ·
              {{ item.checkedOutToId ? "Checked out" : "Available" }}
            </option>
          </datalist>
        </div>
      </template>
      <template v-else>
        <details
          v-if="mode === 'checkout'"
          :open="cameraStep === 'member'"
          class="rounded-xl border border-gray-700 bg-gray-950 p-3 sm:p-4"
        >
          <summary class="touch-manipulation cursor-pointer text-base font-semibold sm:text-lg">
            Step 1 · Member QR
            <span v-if="memberCode" class="ml-2 text-green-400">✓ Scanned</span>
          </summary>
          <CameraCodeScanner
            v-if="cameraStep === 'member' && !memberCode"
            format="qr"
            class="mt-4"
            @scanned="memberScanned"
          />
          <p
            v-if="memberCode"
            class="mt-3 break-all font-mono text-sm text-gray-400"
          >
            {{ memberCode }}
          </p>
        </details>
        <details
          :open="cameraStep === 'item'"
          class="rounded-xl border border-gray-700 bg-gray-950 p-3 sm:p-4"
        >
          <summary class="touch-manipulation cursor-pointer text-base font-semibold sm:text-lg">
            {{ mode === "checkout" ? "Step 2 · " : "" }}Item barcode
            <span v-if="barcode" class="ml-2 text-green-400">✓ Scanned</span>
          </summary>
          <CameraCodeScanner
            v-if="cameraStep === 'item' && !barcode"
            format="barcode"
            :key="scannerKey"
            class="mt-4"
            @scanned="itemScanned"
          />
          <p
            v-if="barcode"
            class="mt-3 break-all font-mono text-sm text-gray-400"
          >
            {{ barcode }}
          </p>
        </details>
        <div v-if="mode === 'quick-add'" class="space-y-4">
          <div>
            <label class="label">Item name</label
            ><input
              v-model="name"
              class="field"
              list="kiosk-names"
              placeholder="e.g. USB-C adapter"
            />
          </div>
          <div>
            <label class="label">Bin</label
            ><select v-model="binId" class="field">
              <option value="">No bin</option>
              <option v-for="bin in bins" :key="bin.id" :value="bin.id">
                {{ binLabel(bin) }}
              </option>
            </select>
          </div>
          <button
            type="button"
            @click="generateBarcode"
            title="Use an auto-generated barcode"
            aria-label="Use an auto-generated barcode"
            class="min-h-12 w-full touch-manipulation rounded-xl bg-gray-700 p-3 font-medium"
          >
            <SparklesIcon class="mx-auto h-6 w-6" />
            <span class="sr-only">Use an auto-generated barcode</span>
          </button>
        </div>
      </template>
      <datalist id="kiosk-names">
        <option v-for="n in names" :key="n" :value="n" />
      </datalist>
      <div v-if="mode === 'checkin'">
        <label class="label">Return bin</label
        ><select v-model="binId" class="field">
          <option value="">Keep previous location</option>
          <option v-for="bin in bins" :key="bin.id" :value="bin.id">
            {{ binLabel(bin) }}
          </option>
        </select>
      </div>
      <button
        v-if="inputMode === 'text' || mode !== 'checkout'"
        @click="submit"
        :disabled="submitting"
        :title="submitting ? 'Working' : actionLabel"
        :aria-label="submitting ? 'Working' : actionLabel"
        class="sticky bottom-2 z-10 min-h-14 w-full touch-manipulation rounded-xl bg-blue-600 p-4 text-lg font-semibold shadow-xl hover:bg-blue-500 disabled:opacity-50 sm:static"
      >
        <ArrowPathIcon v-if="submitting" class="mx-auto h-7 w-7 animate-spin" />
        <component v-else :is="actionIcon" class="mx-auto h-7 w-7" />
        <span class="sr-only">{{ submitting ? "Working" : actionLabel }}</span>
      </button>
      <div
        v-if="message"
        :class="
          failed ? 'bg-red-900 text-red-100' : 'bg-green-900 text-green-100'
        "
        class="rounded-xl p-4 text-center text-lg"
      >
        {{ message }}
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import apiService from "@/services/api";
import CameraCodeScanner from "@/components/inventory/CameraCodeScanner.vue";
import {
  ArrowLeftOnRectangleIcon,
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  CameraIcon,
  CursorArrowRaysIcon,
  PlusCircleIcon,
  SparklesIcon,
} from "@heroicons/vue/24/outline";
import type { InventoryBin, InventoryItem } from "@/types/api";
type Mode = "checkout" | "checkin" | "quick-add";
const tabs: { id: Mode; label: string; icon: any }[] = [
  { id: "checkout", label: "Check Out", icon: ArrowRightOnRectangleIcon },
  { id: "checkin", label: "Check In", icon: ArrowLeftOnRectangleIcon },
  { id: "quick-add", label: "Quick Add Item", icon: PlusCircleIcon },
];
const mode = ref<Mode>("checkout"),
  inputMode = ref<"text" | "camera">("text"),
  cameraStep = ref<"member" | "item">("member"),
  scannerKey = ref(0),
  memberCode = ref(""),
  memberQuery = ref(""),
  memberResults = ref<any[]>([]),
  selectedMember = ref<any | null>(null),
  barcode = ref(""),
  name = ref(""),
  binId = ref(""),
  message = ref(""),
  failed = ref(false),
  submitting = ref(false),
  bins = ref<InventoryBin[]>([]),
  inventoryItems = ref<InventoryItem[]>([]),
  names = ref<string[]>([]),
  firstInput = ref<HTMLInputElement>(),
  barcodeInput = ref<HTMLInputElement>();
const actionLabel = computed(() =>
  mode.value === "quick-add"
    ? "Create item"
    : mode.value === "checkout"
      ? "Check out"
      : "Check in",
);
const actionIcon = computed(() =>
  mode.value === "quick-add"
    ? PlusCircleIcon
    : mode.value === "checkout"
      ? ArrowRightOnRectangleIcon
      : ArrowLeftOnRectangleIcon,
);
const suggestedItems = computed(() =>
  mode.value === "checkin"
    ? inventoryItems.value.filter((item) => item.checkedOutToId)
    : inventoryItems.value.filter((item) => !item.checkedOutToId),
);
const binLabel = (bin: InventoryBin) =>
  `${bin.room ? `${bin.room} · ` : ""}${bin.name}`;
function focusBarcode() {
  barcodeInput.value?.focus();
}
function changeMode(value: Mode) {
  mode.value = value;
  reset();
}
function reset() {
  memberCode.value =
    memberQuery.value =
    barcode.value =
    name.value =
    binId.value =
    message.value =
      "";
  memberResults.value = [];
  selectedMember.value = null;
  cameraStep.value = mode.value === "checkout" ? "member" : "item";
  scannerKey.value++;
  nextTick(() => firstInput.value?.focus() || barcodeInput.value?.focus());
}
function memberScanned(value: string) {
  memberCode.value = value;
  memberQuery.value = value;
  cameraStep.value = "item";
  scannerKey.value++;
}
async function findMembers() {
  selectedMember.value = null;
  memberCode.value = "";
  if (memberQuery.value.trim().length < 2) {
    memberResults.value = [];
    return;
  }
  try {
    memberResults.value = (
      await apiService.searchUsers(memberQuery.value.trim(), 8)
    ).data;
  } catch {
    memberResults.value = [];
  }
}
function selectMember(member: any) {
  selectedMember.value = member;
  memberCode.value = member.id;
  memberQuery.value =
    member.displayName || `${member.firstName} ${member.lastName}`;
  memberResults.value = [];
  nextTick(focusBarcode);
}
function acceptMemberEntry() {
  if (memberResults.value.length) {
    selectMember(memberResults.value[0]);
    return;
  }
  memberCode.value = memberQuery.value.trim();
  memberResults.value = [];
  focusBarcode();
}
async function itemScanned(value: string) {
  barcode.value = value;
  if (
    (mode.value === "checkout" && memberCode.value) ||
    mode.value === "checkin"
  )
    await submit();
}
async function generateBarcode() {
  try {
    barcode.value = await apiService.generateInventoryBarcode();
  } catch (e: any) {
    showError(e);
  }
}
function showError(e: any) {
  failed.value = true;
  message.value = e.response?.data?.error || e.message || "Operation failed";
}
async function submit() {
  if (submitting.value) return;
  submitting.value = true;
  message.value = "";
  try {
    if (mode.value === "quick-add") {
      if (!name.value || !barcode.value)
        throw new Error("Name and barcode are required");
      await apiService.createInventoryItems([
        {
          name: name.value,
          barcode: barcode.value,
          binId: binId.value || null,
        },
      ]);
      message.value = `${name.value} created`;
    } else {
      if (!barcode.value) throw new Error("Scan an item barcode");
      message.value = (
        await apiService.inventoryTransaction({
          action: mode.value,
          memberCode: memberCode.value || undefined,
          barcode: barcode.value,
          binId: binId.value || undefined,
        })
      ).message;
    }
    failed.value = false;
    const priorMode = mode.value;
    setTimeout(() => {
      if (mode.value === priorMode) reset();
    }, 1800);
  } catch (e: any) {
    showError(e);
    barcode.value = "";
    cameraStep.value =
      mode.value === "checkout" && memberCode.value
        ? "item"
        : mode.value === "checkout"
          ? "member"
          : "item";
    scannerKey.value++;
  } finally {
    submitting.value = false;
  }
}
watch(inputMode, reset);
onMounted(async () => {
  const d = await apiService.getInventory();
  bins.value = d.bins;
  inventoryItems.value = d.items;
  names.value = [...new Set(d.items.map((i) => i.name))];
  nextTick(() => firstInput.value?.focus());
});
</script>
<style scoped>
.field {
  @apply mt-2 min-h-14 w-full rounded-xl border border-gray-600 bg-gray-950 px-3 py-3 text-base text-white placeholder-gray-600 sm:px-4 sm:py-4 sm:text-xl;
}
.label {
  @apply block text-xs font-semibold uppercase tracking-wide text-gray-400 sm:text-sm;
}
</style>
