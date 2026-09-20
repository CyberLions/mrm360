<template>
  <div
    class="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4"
  >
    <div
      class="w-full max-w-lg space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-bin-title"
    >
      <div class="flex items-start gap-3">
        <CheckCircleIcon class="mt-0.5 h-8 w-8 flex-none text-green-400" />
        <div class="min-w-0">
          <h2 id="checkin-bin-title" class="text-xl font-semibold text-white">
            Checked in
          </h2>
          <p class="truncate text-gray-300">{{ result.itemName }}</p>
        </div>
      </div>

      <dl class="space-y-2 rounded-xl bg-gray-950 p-4 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-gray-400">Last bin</dt>
          <dd class="text-right font-medium text-gray-100" data-test="last-bin">
            {{ binLabel(result.lastBin, "Unknown") }}
          </dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-gray-400">Now in</dt>
          <dd class="text-right font-medium text-green-300" data-test="now-bin">
            {{ binLabel(result.bin) }}
          </dd>
        </div>
      </dl>

      <div>
        <label for="checkin-new-bin" class="label">Move to a different bin</label>
        <select id="checkin-new-bin" v-model="selected" class="field">
          <option value="">No bin</option>
          <option v-for="bin in bins" :key="bin.id" :value="bin.id">
            {{ binLabel(bin) }}
          </option>
        </select>
      </div>

      <label
        class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-700 p-3 text-sm text-gray-300"
      >
        <input
          v-model="bulk"
          type="checkbox"
          class="mt-0.5 h-5 w-5 rounded border-gray-500 bg-gray-800 text-blue-600 focus:ring-blue-500"
        />
        <span>
          <strong class="text-gray-100">Bulk check-in</strong>
          <span class="block text-gray-400"
            >Skip this popup and show a quick notice for each item instead.</span
          >
        </span>
      </label>

      <p v-if="error" class="rounded-lg bg-red-900/60 p-3 text-sm text-red-200" role="alert">
        {{ error }}
      </p>

      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="min-h-12 touch-manipulation rounded-xl bg-gray-700 px-4 py-3 font-medium text-white hover:bg-gray-600"
          @click="$emit('close', bulk)"
        >
          Keep {{ result.bin ? "there" : "as is" }}
        </button>
        <button
          type="button"
          class="min-h-12 touch-manipulation rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="unchanged || saving"
          @click="$emit('move', selected || null, bulk)"
        >
          {{ saving ? "Moving…" : "Move" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { CheckCircleIcon } from "@heroicons/vue/24/outline";
import { binLabel } from "@/utils/binLabel";
import type { InventoryBin, InventoryTransactionResult } from "@/types/api";

const props = defineProps<{
  result: InventoryTransactionResult;
  bins: InventoryBin[];
  /** Whether bulk mode is already on when the popup opens. */
  bulkOn?: boolean;
  saving?: boolean;
  error?: string;
}>();
defineEmits<{
  /** Dismiss and keep the item where it is. */
  close: [bulk: boolean];
  /** Move the item to this bin (null = no bin). */
  move: [binId: string | null, bulk: boolean];
}>();

const selected = ref(props.result.bin?.id ?? "");
const bulk = ref(!!props.bulkOn);
const unchanged = computed(() => selected.value === (props.result.bin?.id ?? ""));
</script>

<style scoped>
.field {
  @apply mt-2 min-h-12 w-full rounded-xl border border-gray-600 bg-gray-950 px-3 py-3 text-base text-white;
}
.label {
  @apply block text-xs font-semibold uppercase tracking-wide text-gray-400;
}
</style>
