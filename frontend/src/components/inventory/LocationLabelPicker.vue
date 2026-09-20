<template>
  <div class="space-y-6">
    <div
      class="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 shadow-xl"
    >
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-blue-900/50 p-2">
            <FunnelIcon class="h-5 w-5 text-blue-400" />
          </div>
          <h3 class="text-lg font-semibold text-gray-100">Filters</h3>
        </div>
        <button
          class="flex items-center rounded px-3 py-2 text-sm text-gray-400 hover:bg-gray-700"
          @click="clearFilters"
        >
          <XMarkIcon class="mr-2 h-4 w-4" />Clear All
        </button>
      </div>
      <div class="grid gap-6 md:grid-cols-3">
        <label class="filter"
          ><span>Search</span
          ><input v-model="filters.search" placeholder="Room, shelf or bin name..."
        /></label>
        <label class="filter"
          ><span>Type</span
          ><select v-model="filters.kind">
            <option value="">Rooms, shelves and bins</option>
            <option value="room">Rooms only</option>
            <option value="shelf">Shelves only</option>
            <option value="bin">Bins only</option>
          </select></label
        >
        <label class="filter"
          ><span>Room</span
          ><select v-model="filters.room">
            <option value="">All Rooms</option>
            <option v-for="room in rooms" :key="room" :value="room">
              {{ room }}
            </option>
          </select></label
        >
      </div>
    </div>

    <div
      class="flex flex-col gap-3 rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-xl md:flex-row md:items-center md:justify-between"
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span class="font-medium text-gray-100" data-test="selected-count"
          >{{ selectedRows.length }} selected</span
        >
        <span class="text-gray-400">{{ filtered.length }} matching filters</span>
        <button
          class="text-blue-400 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!filtered.length || allSelected"
          @click="selectAll"
        >
          Select all {{ filtered.length }} matching
        </button>
        <button
          class="text-blue-400 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!selectedRows.length"
          @click="selected.clear()"
        >
          Clear selection
        </button>
      </div>
      <button
        class="flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!selectedRows.length || disabled"
        @click="emitGenerate(selectedRows)"
      >
        <PrinterIcon class="mr-2 h-4 w-4" />Generate
        {{ selectedRows.length || "" }}
        {{ selectedRows.length === 1 ? "label" : "labels" }}
      </button>
    </div>

    <div
      class="overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow [contain:layout]"
    >
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-700">
          <thead class="bg-gray-700">
            <tr>
              <th class="w-12">
                <input
                  ref="headerCheckbox"
                  type="checkbox"
                  class="checkbox"
                  :checked="allSelected"
                  :disabled="!filtered.length"
                  aria-label="Select all rooms, shelves and bins matching the current filters"
                  @change="toggleAll"
                />
              </th>
              <th v-for="heading in ['Location', 'Type', 'Bins', 'Items']" :key="heading">
                {{ heading }}
              </th>
              <th>Print</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr
              v-for="row in filtered"
              :key="row.key"
              class="cursor-pointer hover:bg-gray-700"
              :class="{ 'bg-blue-900/20': selected.has(row.key) }"
              @click="toggle(row.key)"
            >
              <td @click.stop>
                <input
                  type="checkbox"
                  class="checkbox"
                  :checked="selected.has(row.key)"
                  :aria-label="`Select ${row.name}`"
                  @change="toggle(row.key)"
                />
              </td>
              <td>
                <div class="font-medium text-gray-100">{{ row.name }}</div>
                <div v-if="row.detail" class="text-xs text-gray-400">
                  {{ row.detail }}
                </div>
              </td>
              <td>
                <span
                  class="rounded-full px-2 py-1 text-xs font-semibold"
                  :class="kindStyle[row.kind].class"
                  >{{ kindStyle[row.kind].label }}</span
                >
              </td>
              <td>{{ row.kind === "bin" ? "—" : row.bins }}</td>
              <td>{{ row.items }}</td>
              <td @click.stop>
                <IconButton
                  :icon="PrinterIcon"
                  :label="`Print label for ${row.name}`"
                  variant="primary"
                  :disabled="disabled"
                  @click="emitGenerate([row])"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!filtered.length" class="py-12 text-center">
        <MapPinIcon class="mx-auto h-12 w-12 text-gray-500" />
        <h3 class="mt-2 text-gray-100">No bins, shelves or rooms found</h3>
        <p class="mt-1 text-sm text-gray-400">
          Shelves and rooms come from the room and shelf set on each bin.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from "vue";
import IconButton from "@/components/common/IconButton.vue";
import {
  FunnelIcon,
  MapPinIcon,
  PrinterIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import type {
  InventoryBin,
  InventoryItem,
  InventoryLocationSpec,
} from "@/types/api";

const props = defineProps<{
  bins: InventoryBin[];
  items: InventoryItem[];
  disabled?: boolean;
}>();
const emit = defineEmits<{ generate: [locations: InventoryLocationSpec[]] }>();

interface Row extends InventoryLocationSpec {
  key: string;
  kind: "room" | "shelf" | "bin";
  name: string;
  /** Second line under the name: where a shelf or bin lives. */
  detail: string;
  bins: number;
  items: number;
}

const kindStyle = {
  room: { label: "Room", class: "bg-purple-900 text-purple-200" },
  shelf: { label: "Shelf", class: "bg-blue-900 text-blue-200" },
  bin: { label: "Bin", class: "bg-green-900 text-green-200" },
} as const;
const KIND_RANK = { room: 0, shelf: 1, bin: 2 } as const;

const selected = ref(new Set<string>()),
  headerCheckbox = ref<HTMLInputElement | null>(null),
  filters = reactive({ search: "", kind: "", room: "" });

const rowKey = (room: string | null, shelf: string | null) =>
  JSON.stringify([room, shelf]);

// One row per room, per (room, shelf) pair and per bin.
const allRows = computed<Row[]>(() => {
  const rows = new Map<string, Row>();
  const bump = (
    key: string,
    make: () => Row,
    field: "bins" | "items",
    by = 1,
  ) => {
    if (!rows.has(key)) rows.set(key, make());
    rows.get(key)![field] += by;
  };
  const roomRow = (room: string): Row => ({
    key: rowKey(room, null),
    kind: "room",
    room,
    shelf: null,
    name: room,
    detail: "",
    bins: 0,
    items: 0,
  });
  const shelfRow = (room: string | null, shelf: string): Row => ({
    key: rowKey(room, shelf),
    kind: "shelf",
    room,
    shelf,
    name: `Shelf ${shelf}`,
    detail: room ?? "",
    bins: 0,
    items: 0,
  });
  for (const bin of props.bins) {
    const room = bin.room || null;
    const shelf = bin.shelf || null;
    if (room) bump(rowKey(room, null), () => roomRow(room), "bins");
    if (shelf) bump(rowKey(room, shelf), () => shelfRow(room, shelf), "bins");
    rows.set(`bin:${bin.id}`, {
      key: `bin:${bin.id}`,
      kind: "bin",
      room,
      shelf,
      binId: bin.id,
      name: bin.name,
      detail: [room, shelf ? `Shelf ${shelf}` : ""].filter(Boolean).join(" · "),
      bins: 0,
      items: 0,
    });
  }
  for (const item of props.items) {
    const room = item.bin?.room || null;
    const shelf = item.bin?.shelf || null;
    if (room) bump(rowKey(room, null), () => roomRow(room), "items");
    if (shelf) bump(rowKey(room, shelf), () => shelfRow(room, shelf), "items");
    if (item.binId) {
      const bin = rows.get(`bin:${item.binId}`);
      if (bin) bin.items += 1;
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      (a.room ?? "\uffff").localeCompare(b.room ?? "\uffff") ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      (a.shelf ?? "").localeCompare(b.shelf ?? "", undefined, { numeric: true }) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
});

const rooms = computed(() =>
  [...new Set(allRows.value.map((r) => r.room).filter(Boolean))] as string[],
);

const filtered = computed(() => {
  const q = filters.search.trim().toLowerCase();
  return allRows.value.filter(
    (row) =>
      (!q || [row.name, row.detail, row.room, row.shelf].some((v) =>
          v?.toLowerCase().includes(q),
        )) &&
      (!filters.kind || row.kind === filters.kind) &&
      (!filters.room || row.room === filters.room),
  );
});

const selectedRows = computed(() =>
  allRows.value.filter((row) => selected.value.has(row.key)),
);
const allSelected = computed(
  () =>
    filtered.value.length > 0 &&
    filtered.value.every((r) => selected.value.has(r.key)),
);
const someSelected = computed(() =>
  filtered.value.some((r) => selected.value.has(r.key)),
);

function toggle(key: string) {
  if (!selected.value.delete(key)) selected.value.add(key);
}
function selectAll() {
  filtered.value.forEach((r) => selected.value.add(r.key));
}
function toggleAll() {
  if (allSelected.value)
    filtered.value.forEach((r) => selected.value.delete(r.key));
  else selectAll();
}
function clearFilters() {
  Object.assign(filters, { search: "", kind: "", room: "" });
}
const emitGenerate = (rows: Row[]) =>
  emit(
    "generate",
    rows.map(({ room, shelf, binId }) => ({
      room,
      shelf,
      ...(binId ? { binId } : {}),
    })),
  );

watchEffect(() => {
  if (headerCheckbox.value)
    headerCheckbox.value.indeterminate =
      someSelected.value && !allSelected.value;
});
</script>

<style scoped>
.filter {
  @apply space-y-2 text-sm font-medium text-gray-300;
}
.filter input,
.filter select {
  @apply mt-2 w-full rounded-lg border border-gray-600/50 bg-gray-700/50 px-4 py-2.5 text-gray-100;
}
.checkbox {
  @apply h-4 w-4 rounded border-gray-500 bg-gray-700 text-blue-600 focus:ring-blue-500;
}
th {
  @apply px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300;
}
td {
  @apply whitespace-nowrap px-6 py-4 text-sm text-gray-300;
}
</style>
