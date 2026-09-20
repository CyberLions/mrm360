<template>
  <select :value="modelValue" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
    <option value="">{{ emptyLabel }}</option>
    <slot />
    <optgroup v-if="rooms.length" label="Rooms">
      <option v-for="room in rooms" :key="room.id" :value="`room:${room.id}`">
        {{ room.name }}
      </option>
    </optgroup>
    <optgroup v-if="shelves.length" label="Shelves">
      <option v-for="shelf in shelves" :key="shelf.id" :value="`shelf:${shelf.id}`">
        {{ placeLabel({ kind: "shelf", name: shelf.name, room: shelf.room?.name }) }}
      </option>
    </optgroup>
    <optgroup v-if="bins.length" label="Bins">
      <option v-for="bin in bins" :key="bin.id" :value="`bin:${bin.id}`">
        {{ binLabel(bin) }}
      </option>
    </optgroup>
  </select>
</template>
<script setup lang="ts">
import { binLabel, placeLabel } from "@/utils/binLabel";
import type { InventoryBin, InventoryRoom, InventoryShelf } from "@/types/api";
// One dropdown for "where does this go": rooms, shelves and bins, grouped. The value is a
// packed place string; see placeValue / parsePlaceValue in @/utils/place.
withDefaults(
  defineProps<{
    modelValue: string;
    bins?: InventoryBin[];
    shelves?: InventoryShelf[];
    rooms?: InventoryRoom[];
    emptyLabel?: string;
  }>(),
  { bins: () => [], shelves: () => [], rooms: () => [], emptyLabel: "Unassigned" },
);
defineEmits<{ "update:modelValue": [value: string] }>();
</script>
