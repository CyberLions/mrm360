<template>
  <div class="space-y-6">
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">Bins & Locations</h1>
        <p class="mt-2 text-sm text-gray-400">
          Rooms, shelves and bins. Items can live in any of the three.
        </p>
      </div>
      <BaseButton class="mt-4 sm:mt-0" @click="edit()"
        >Add {{ tabInfo.singular }}</BaseButton
      >
    </div>
    <div class="flex gap-1 rounded-lg border border-gray-700 bg-gray-800 p-1" role="tablist">
      <button
        v-for="option in tabs"
        :key="option.id"
        type="button"
        role="tab"
        :aria-selected="tab === option.id"
        class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        :class="
          tab === option.id
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
        "
        @click="tab = option.id"
      >
        {{ option.label }}
        <span class="ml-1 text-xs opacity-75">{{ option.count }}</span>
      </button>
    </div>
    <div
      class="bg-gray-800/50 backdrop-blur-sm shadow-xl rounded-xl p-6 border border-gray-700/50"
    >
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="rounded-lg bg-blue-900/50 p-2">
            <FunnelIcon class="h-5 w-5 text-blue-400" />
          </div>
          <h3 class="text-lg font-semibold text-gray-100">Filters</h3>
        </div>
        <button
          type="button"
          class="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
          @click="clearFilters"
        >
          <XMarkIcon class="mr-2 h-4 w-4" />Clear All
        </button>
      </div>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div class="space-y-2">
          <label class="flex items-center text-sm font-medium text-gray-300"
            ><MagnifyingGlassIcon class="mr-2 h-4 w-4 text-gray-400" />Search</label
          ><input
            v-model="filters.search"
            class="filter-input"
            :placeholder="`Search ${tabInfo.plural}...`"
          />
        </div>
        <div v-if="tab !== 'rooms'" class="space-y-2">
          <label class="flex items-center text-sm font-medium text-gray-300">Room</label>
          <select v-model="filters.room" class="filter-input">
            <option value="">All Rooms</option>
            <option value="none">No Room</option>
            <option v-for="room in roomNames" :key="room" :value="room">
              {{ room }}
            </option>
          </select>
        </div>
        <div v-if="tab === 'bins'" class="space-y-2">
          <label class="flex items-center text-sm font-medium text-gray-300">Locker Code</label>
          <select v-model="filters.hasCode" class="filter-input">
            <option value="">All Bins</option>
            <option value="yes">Has Code</option>
            <option value="no">No Code</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="flex items-center text-sm font-medium text-gray-300">Results per page</label>
          <select v-model.number="pageSize" class="filter-input">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
        </div>
      </div>
    </div>
    <div v-if="error" class="rounded-lg bg-red-900/50 p-4 text-red-200">
      {{ error }}
    </div>
    <div v-if="loading" class="flex justify-center py-8">
      <div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
    </div>
    <div
      v-else
      class="overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow [contain:layout]"
    >
      <div class="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        <table class="w-full divide-y divide-gray-700">
          <thead class="bg-gray-700">
            <tr>
              <th
                v-for="heading in tabInfo.headings"
                :key="heading"
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300"
              >
                {{ heading }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700 bg-gray-800">
            <tr
              v-for="row in pageRows"
              :key="row.id"
              class="transition-colors hover:bg-gray-700"
            >
              <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-100">
                {{ row.name }}
              </td>
              <template v-if="row.kind === 'bin'">
                <td class="cell">{{ row.room || "—" }}</td>
                <td class="cell">{{ row.shelf || "—" }}</td>
                <td class="whitespace-nowrap px-6 py-4 text-sm">
                  <code v-if="row.code" class="text-amber-300">{{ row.code }}</code
                  ><span v-else class="text-gray-400">—</span>
                </td>
                <td class="max-w-md whitespace-normal px-6 py-4 text-sm text-gray-400">
                  {{ row.description || "—" }}
                </td>
                <td class="cell">{{ row.items }}</td>
              </template>
              <template v-else-if="row.kind === 'shelf'">
                <td class="cell">{{ row.room || "—" }}</td>
                <td class="max-w-md whitespace-normal px-6 py-4 text-sm text-gray-400">
                  {{ row.description || "—" }}
                </td>
                <td class="cell">{{ row.bins }}</td>
                <td class="cell">{{ row.items }}</td>
              </template>
              <template v-else>
                <td class="max-w-md whitespace-normal px-6 py-4 text-sm text-gray-400">
                  {{ row.description || "—" }}
                </td>
                <td class="cell">{{ row.shelves }}</td>
                <td class="cell">{{ row.bins }}</td>
                <td class="cell">{{ row.items }}</td>
              </template>
              <td class="whitespace-nowrap px-6 py-4 text-sm">
                <div class="flex gap-2">
                  <IconButton
                    :icon="PencilSquareIcon"
                    :label="`Edit ${tabInfo.singular}`"
                    @click="edit(row.source)"
                  />
                  <IconButton
                    :icon="TrashIcon"
                    :label="`Delete ${tabInfo.singular}`"
                    variant="danger"
                    @click="remove(row.source)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!pageRows.length" class="py-12 text-center">
        <ArchiveBoxIcon class="mx-auto h-12 w-12 text-gray-500" />
        <h3 class="mt-2 font-medium text-gray-100">No {{ tabInfo.plural }} found</h3>
        <p class="text-sm text-gray-400">
          Try adjusting your search or filters, or add one.
        </p>
      </div>
      <PaginationBar
        v-if="totalPages > 1"
        :page="page"
        :total-pages="totalPages"
        :start="start + 1"
        :end="Math.min(start + pageSize, filtered.length)"
        :total="filtered.length"
        @change="page = $event"
      />
    </div>
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <form
        class="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-gray-700 bg-gray-800 p-6"
        @submit.prevent="save"
      >
        <h2 class="text-xl font-semibold text-white">
          {{ draft.id ? "Edit" : "Add" }} {{ tabInfo.singular }}
        </h2>
        <div v-if="modalError" class="rounded-lg bg-red-900/50 p-3 text-sm text-red-200">
          {{ modalError }}
        </div>
        <input
          v-model="draft.name"
          required
          autofocus
          class="filter-input"
          :placeholder="`${capitalize(tabInfo.singular)} name`"
        />
        <template v-if="tab === 'bins'">
          <NameSelect
            v-model="draft.room"
            :options="roomNames"
            empty-label="No room"
            new-label="New room…"
            new-placeholder="New room name"
          />
          <NameSelect
            v-model="draft.shelf"
            :options="shelfOptions"
            empty-label="No shelf"
            new-label="New shelf…"
            new-placeholder="New shelf name"
          />
          <input
            v-model="draft.code"
            class="filter-input"
            placeholder="Locker code"
          />
        </template>
        <NameSelect
          v-else-if="tab === 'shelves'"
          v-model="draft.room"
          :options="roomNames"
          empty-label="No room"
          new-label="New room…"
          new-placeholder="New room name"
        />
        <textarea
          v-model="draft.description"
          class="filter-input"
          rows="3"
          :placeholder="
            tab === 'bins'
              ? 'Description or location notes'
              : 'Description (optional)'
          "
        ></textarea>
        <div class="flex justify-end gap-2">
          <BaseButton type="button" variant="secondary" @click="show = false"
            >Cancel</BaseButton
          ><BaseButton type="submit" :loading="saving">Save</BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import apiService from "@/services/api";
import BaseButton from "@/components/common/BaseButton.vue";
import IconButton from "@/components/common/IconButton.vue";
import NameSelect from "@/components/inventory/NameSelect.vue";
import PaginationBar from "@/components/inventory/PaginationBar.vue";
import {
  ArchiveBoxIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import type { InventoryBin, InventoryRoom, InventoryShelf } from "@/types/api";

type Tab = "bins" | "shelves" | "rooms";
type Source = InventoryBin | InventoryShelf | InventoryRoom;
// One row shape for all three tables, so filtering and paging are shared.
type Row = {
  id: string;
  kind: "bin" | "shelf" | "room";
  name: string;
  room: string | null;
  shelf: string | null;
  code: string | null;
  description: string | null;
  items: number;
  bins: number;
  shelves: number;
  source: Source;
};

const bins = ref<InventoryBin[]>([]),
  shelves = ref<InventoryShelf[]>([]),
  rooms = ref<InventoryRoom[]>([]),
  loading = ref(true),
  saving = ref(false),
  show = ref(false),
  error = ref(""),
  modalError = ref(""),
  tab = ref<Tab>("bins"),
  page = ref(1),
  pageSize = ref(25),
  filters = reactive({ search: "", room: "", hasCode: "" }),
  draft = reactive({ id: "", name: "", room: "", shelf: "", code: "", description: "" });

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const tabs = computed(() => [
  { id: "bins" as Tab, label: "Bins", count: bins.value.length },
  { id: "shelves" as Tab, label: "Shelves", count: shelves.value.length },
  { id: "rooms" as Tab, label: "Rooms", count: rooms.value.length },
]);
const tabInfo = computed(
  () =>
    ({
      bins: {
        singular: "bin",
        plural: "bins",
        headings: ["Name", "Room", "Shelf", "Code", "Description", "Items", "Actions"],
      },
      shelves: {
        singular: "shelf",
        plural: "shelves",
        headings: ["Name", "Room", "Description", "Bins", "Items on shelf", "Actions"],
      },
      rooms: {
        singular: "room",
        plural: "rooms",
        headings: ["Name", "Description", "Shelves", "Bins", "Items in room", "Actions"],
      },
    })[tab.value],
);

// Registry rooms, plus any typed onto a bin that the registry has not caught up with.
const roomNames = computed(() =>
  [
    ...new Set([
      ...rooms.value.map((r) => r.name),
      ...bins.value.map((b) => b.room).filter((v): v is string => !!v),
    ]),
  ].sort((a, b) => a.localeCompare(b)),
);
// Shelves offered for the bin being edited: the ones in its room (or, with no room, the
// room-less ones).
const shelvesIn = (room: string) =>
  [
    ...new Set(
      shelves.value
        .filter((s) => (s.room?.name ?? "") === room)
        .map((s) => s.name),
    ),
  ].sort((a, b) => a.localeCompare(b));
const shelfOptions = computed(() => shelvesIn(draft.room));

const rows = computed<Row[]>(() => {
  const base = { room: null, shelf: null, code: null, description: null, items: 0, bins: 0, shelves: 0 };
  if (tab.value === "bins")
    return bins.value.map((b) => ({ ...base, id: b.id, kind: "bin", name: b.name, room: b.room ?? null, shelf: b.shelf ?? null, code: b.code ?? null, description: b.description ?? null, items: b._count?.items ?? 0, source: b }));
  if (tab.value === "shelves")
    return shelves.value.map((s) => ({ ...base, id: s.id, kind: "shelf", name: s.name, room: s.room?.name ?? null, description: s.description ?? null, bins: s.binCount ?? 0, items: s._count?.items ?? 0, source: s }));
  return rooms.value.map((r) => ({ ...base, id: r.id, kind: "room", name: r.name, description: r.description ?? null, shelves: r._count?.shelves ?? 0, bins: r.binCount ?? 0, items: r._count?.items ?? 0, source: r }));
});
const filtered = computed(() => {
    const q = filters.search.toLowerCase();
    return rows.value.filter(
      (r) =>
        (!q ||
          [r.name, r.room, r.shelf, r.description, r.code].some((v) =>
            v?.toLowerCase().includes(q),
          )) &&
        (tab.value === "rooms" ||
          !filters.room ||
          (filters.room === "none" ? !r.room : r.room === filters.room)) &&
        (tab.value !== "bins" ||
          !filters.hasCode ||
          (filters.hasCode === "yes" ? !!r.code : !r.code)),
    );
  }),
  totalPages = computed(() => Math.ceil(filtered.value.length / pageSize.value)),
  start = computed(() => (page.value - 1) * pageSize.value),
  pageRows = computed(() =>
    filtered.value.slice(start.value, start.value + pageSize.value),
  );

async function load() {
  try {
    [bins.value, shelves.value, rooms.value] = await Promise.all([
      apiService.getInventoryBins(),
      apiService.getInventoryShelves(),
      apiService.getInventoryRooms(),
    ]);
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not load locations";
  } finally {
    loading.value = false;
  }
}
function clearFilters() {
  Object.assign(filters, { search: "", room: "", hasCode: "" });
}
function edit(source?: Source) {
  const bin = tab.value === "bins" ? (source as InventoryBin | undefined) : undefined;
  const shelf = tab.value === "shelves" ? (source as InventoryShelf | undefined) : undefined;
  Object.assign(draft, {
    id: source?.id || "",
    name: source?.name || "",
    room: bin?.room || shelf?.room?.name || "",
    shelf: bin?.shelf || "",
    code: bin?.code || "",
    description: source?.description || "",
  });
  modalError.value = "";
  show.value = true;
}
async function save() {
  saving.value = true;
  modalError.value = "";
  const description = draft.description.trim() || null;
  try {
    if (tab.value === "bins") {
      const data = {
        name: draft.name,
        room: draft.room.trim() || null,
        shelf: draft.shelf.trim() || null,
        code: draft.code || null,
        description,
      };
      draft.id
        ? await apiService.updateInventoryBin(draft.id, data)
        : await apiService.createInventoryBin(data);
    } else if (tab.value === "shelves") {
      // A room typed into the form is created first, so a shelf and its room can be added together.
      const roomName = draft.room.trim();
      let roomId: string | null = null;
      if (roomName) {
        const existing = rooms.value.find((r) => r.name.toLowerCase() === roomName.toLowerCase());
        roomId = (existing ?? (await apiService.createInventoryRoom({ name: roomName }))).id;
      }
      const data = { name: draft.name, roomId, description };
      draft.id
        ? await apiService.updateInventoryShelf(draft.id, data)
        : await apiService.createInventoryShelf(data);
    } else {
      const data = { name: draft.name, description };
      draft.id
        ? await apiService.updateInventoryRoom(draft.id, data)
        : await apiService.createInventoryRoom(data);
    }
    show.value = false;
    await load();
  } catch (e: any) {
    modalError.value = e.response?.data?.error || `Could not save ${tabInfo.value.singular}`;
    await load();
  } finally {
    saving.value = false;
  }
}
async function remove(source: Source) {
  if (!confirm(`Delete ${source.name}?`)) return;
  error.value = "";
  try {
    if (tab.value === "bins") await apiService.deleteInventoryBin(source.id);
    else if (tab.value === "shelves") await apiService.deleteInventoryShelf(source.id);
    else await apiService.deleteInventoryRoom(source.id);
    await load();
  } catch (e: any) {
    error.value = e.response?.data?.error || `Could not delete ${tabInfo.value.singular}`;
  }
}
// Picking a different room drops a shelf that was chosen from the old room's list.
watch(
  () => draft.room,
  (_room, oldRoom) => {
    if (tab.value === "bins" && draft.shelf && shelvesIn(oldRoom ?? "").includes(draft.shelf) && !shelfOptions.value.includes(draft.shelf))
      draft.shelf = "";
  },
);
watch(
  [() => filters.search, () => filters.room, () => filters.hasCode, pageSize, tab],
  () => (page.value = 1),
);
watch(tab, () => (show.value = false));
onMounted(load);
</script>
<style scoped>
.filter-input {
  @apply w-full rounded-lg border border-gray-600/50 bg-gray-700/50 px-4 py-2.5 text-gray-100 placeholder-gray-400 transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/50;
}
.cell {
  @apply whitespace-nowrap px-6 py-4 text-sm text-gray-300;
}
</style>
