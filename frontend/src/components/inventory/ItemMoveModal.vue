<template>
  <div
    class="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
    @click.self="$emit('close')"
  >
    <form
      class="w-full max-w-md space-y-4 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl"
      @submit.prevent="save"
    >
      <div>
        <h2 class="text-xl font-semibold text-white">
          Move {{ items.length === 1 ? items[0].name : `${items.length} items` }}
        </h2>
        <p v-if="items.length === 1" class="mt-1 font-mono text-sm text-gray-400">
          {{ items[0].barcode }}
        </p>
      </div>
      <div>
        <label class="mb-2 block text-sm font-medium text-gray-300"
          >Move to</label
        >
        <PlaceSelect
          v-model="place"
          autofocus
          class="field"
          :bins="bins"
          :shelves="shelves"
          :rooms="rooms"
        />
      </div>
      <p v-if="onLoan" class="text-sm text-amber-300">
        {{
          onLoan === 1 && items.length === 1
            ? "This item is checked out."
            : `${onLoan} of these items are checked out.`
        }}
        Moving {{ onLoan === 1 ? "it" : "them" }} checks
        {{ onLoan === 1 ? "it" : "them" }} in to the selected location.
      </p>
      <div v-if="error" class="rounded-lg bg-red-900/50 p-3 text-sm text-red-200">
        {{ error }}
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
          @click="$emit('close')"
        >
          Cancel
        </button>
        <button
          :disabled="saving"
          class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {{ saving ? "Moving…" : "Move" }}
        </button>
      </div>
    </form>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import apiService from "@/services/api";
import PlaceSelect from "@/components/inventory/PlaceSelect.vue";
import { parsePlaceValue, placeValue } from "@/utils/place";
import type {
  InventoryBin,
  InventoryItem,
  InventoryRoom,
  InventoryShelf,
} from "@/types/api";
const props = defineProps<{
    items: InventoryItem[];
    bins: InventoryBin[];
    shelves?: InventoryShelf[];
    rooms?: InventoryRoom[];
  }>(),
  emit = defineEmits<{ close: []; saved: [] }>();
const shared = new Set(props.items.map((item) => placeValue(item)));
// Start on the current place when every item is in the same one.
const place = ref(shared.size === 1 ? [...shared][0] : ""),
  saving = ref(false),
  error = ref("");
const onLoan = computed(
  () => props.items.filter((item) => item.checkedOutToId).length,
);
async function save() {
  saving.value = true;
  error.value = "";
  try {
    await apiService.moveInventoryItems(props.items, parsePlaceValue(place.value));
    emit("saved");
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not move items";
  } finally {
    saving.value = false;
  }
}
</script>
<style scoped>
.field {
  @apply w-full rounded-lg border border-gray-600 bg-gray-900 px-4 py-3 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50;
}
</style>
