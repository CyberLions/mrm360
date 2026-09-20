<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-100">Print Labels</h1>
      <p class="mt-2 text-sm text-gray-400">
        Filter to a room, shelf or bin, tick the items you need, then generate a
        printable PDF of barcode labels.
      </p>
    </div>

    <div
      v-if="error"
      class="rounded-lg bg-red-900/50 p-3 text-sm text-red-200"
      role="alert"
    >
      {{ error }}
    </div>

    <!-- Template -->
    <div
      class="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 shadow-xl"
    >
      <div class="mb-4 flex items-center gap-3">
        <div class="rounded-lg bg-blue-900/50 p-2">
          <PrinterIcon class="h-5 w-5 text-blue-400" />
        </div>
        <h3 class="text-lg font-semibold text-gray-100">Label template</h3>
      </div>
      <div class="grid gap-3 md:grid-cols-2" role="radiogroup">
        <label
          v-for="option in templates"
          :key="option.id"
          class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors"
          :class="
            templateId === option.id
              ? 'border-blue-500 bg-blue-900/30'
              : 'border-gray-600/50 bg-gray-700/30 hover:bg-gray-700/60'
          "
        >
          <input
            v-model="templateId"
            type="radio"
            name="label-template"
            :value="option.id"
            class="mt-1 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span class="block font-medium text-gray-100">{{
              option.name
            }}</span>
            <span class="mt-1 block text-sm text-gray-400">{{
              option.description
            }}</span>
            <button
              v-if="hasPrintHelp(option)"
              type="button"
              class="mt-2 inline-flex items-center text-sm text-blue-400 hover:text-blue-300"
              @click.prevent.stop="showPrintHelp = true"
            >
              <InformationCircleIcon class="mr-1 h-4 w-4" />How to print this
              size on Windows
            </button>
          </span>
        </label>
      </div>
    </div>

    <!-- Filters -->
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
      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <label class="filter col-span-full lg:col-span-1"
          ><span>Search</span
          ><input
            v-model="filters.search"
            placeholder="Name, barcode, category, location..."
        /></label>
        <label class="filter"
          ><span>Category</span
          ><select v-model="filters.categoryId">
            <option value="">All Categories</option>
            <option value="none">Uncategorized</option>
            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
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
        <label class="filter"
          ><span>Shelf</span
          ><select v-model="filters.shelf" :disabled="!shelves.length">
            <option value="">All Shelves</option>
            <option v-for="shelf in shelves" :key="shelf" :value="shelf">
              Shelf {{ shelf }}
            </option>
          </select></label
        >
        <label class="filter"
          ><span>Bin</span
          ><select v-model="filters.binId">
            <option value="">All Bins</option>
            <option value="unassigned">Unassigned (no bin)</option>
            <option v-for="bin in binOptions" :key="bin.id" :value="bin.id">
              {{ bin.name }}
            </option>
          </select></label
        >
        <label class="filter"
          ><span>Results per page</span
          ><select v-model.number="pageSize">
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select></label
        >
      </div>
    </div>

    <!-- Selection bar -->
    <div
      class="flex flex-col gap-3 rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-xl md:flex-row md:items-center md:justify-between"
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span class="font-medium text-gray-100"
          >{{ selectedIds.length }} selected</span
        >
        <span class="text-gray-400">{{ filtered.length }} matching filters</span>
        <button
          class="text-blue-400 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!filtered.length || allFilteredSelected"
          @click="selectAllFiltered"
        >
          Select all {{ filtered.length }} matching
        </button>
        <button
          class="text-blue-400 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!selectedIds.length"
          @click="selected.clear()"
        >
          Clear selection
        </button>
        <label class="flex items-center gap-2 text-gray-300">
          <input
            v-model="filters.selectedOnly"
            type="checkbox"
            class="checkbox"
          />Show selected only
        </label>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="overLimit" class="text-sm text-amber-300"
          >Max {{ maxLabels }} labels per run</span
        >
        <button
          class="flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!selectedIds.length || overLimit || !activeTemplate"
          @click="generate(selectedIds)"
        >
          <PrinterIcon class="mr-2 h-4 w-4" />Generate
          {{ selectedIds.length || "" }} {{ selectedIds.length === 1 ? "label" : "labels" }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <div
        class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"
      ></div>
    </div>
    <div
      v-else
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
                  :checked="allFilteredSelected"
                  :disabled="!filtered.length"
                  aria-label="Select all items matching the current filters"
                  title="Select every item matching the current filters, across all pages"
                  @change="toggleAllFiltered"
                />
              </th>
              <th v-for="heading in ['Item', 'Category', 'Location']" :key="heading">
                {{ heading }}
              </th>
              <th>Print</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr
              v-for="entry in pageItems"
              :key="entry.id"
              class="cursor-pointer hover:bg-gray-700"
              :class="{ 'bg-blue-900/20': selected.has(entry.id) }"
              @click="toggle(entry.id)"
            >
              <td @click.stop>
                <input
                  type="checkbox"
                  class="checkbox"
                  :checked="selected.has(entry.id)"
                  :aria-label="`Select ${entry.name}`"
                  @change="toggle(entry.id)"
                />
              </td>
              <td>
                <div class="font-medium text-gray-100">{{ entry.name }}</div>
                <code class="text-xs text-gray-400">{{ entry.barcode }}</code>
              </td>
              <td>{{ entry.category?.name || "—" }}</td>
              <td>{{ location(entry) }}</td>
              <td @click.stop>
                <IconButton
                  :icon="PrinterIcon"
                  :label="`Print label for ${entry.name}`"
                  variant="primary"
                  :disabled="!activeTemplate"
                  @click="generate([entry.id])"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!pageItems.length" class="py-12 text-center">
        <TagIcon class="mx-auto h-12 w-12 text-gray-500" />
        <h3 class="mt-2 text-gray-100">No items found</h3>
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

    <LabelPrintHelpModal v-if="showPrintHelp" @close="showPrintHelp = false" />
    <LabelGenerationModal
      v-if="job && activeTemplate"
      :key="job.key"
      :item-ids="job.itemIds"
      :template="activeTemplate"
      @close="job = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, watchEffect } from "vue";
import apiService from "@/services/api";
import PaginationBar from "@/components/inventory/PaginationBar.vue";
import LabelGenerationModal from "@/components/inventory/LabelGenerationModal.vue";
import LabelPrintHelpModal from "@/components/inventory/LabelPrintHelpModal.vue";
import { hasPrintHelp } from "@/utils/labelPrintHelp";
import IconButton from "@/components/common/IconButton.vue";
import {
  FunnelIcon,
  InformationCircleIcon,
  PrinterIcon,
  TagIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import type {
  InventoryBin,
  InventoryCategory,
  InventoryItem,
  InventoryLabelTemplate,
} from "@/types/api";

const TEMPLATE_STORAGE_KEY = "inventoryLabelTemplate";

const items = ref<InventoryItem[]>([]),
  bins = ref<InventoryBin[]>([]),
  categories = ref<InventoryCategory[]>([]),
  templates = ref<InventoryLabelTemplate[]>([]),
  maxLabels = ref(1000),
  templateId = ref(readStoredTemplate()),
  loading = ref(true),
  showPrintHelp = ref(false),
  error = ref(""),
  page = ref(1),
  pageSize = ref(50),
  selected = ref(new Set<string>()),
  job = ref<{ key: number; itemIds: string[] } | null>(null),
  headerCheckbox = ref<HTMLInputElement | null>(null),
  filters = reactive({
    search: "",
    categoryId: "",
    room: "",
    shelf: "",
    binId: "",
    selectedOnly: false,
  });
let jobCounter = 0;

function readStoredTemplate() {
  try {
    return localStorage.getItem(TEMPLATE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

const activeTemplate = computed(
  () =>
    templates.value.find((t) => t.id === templateId.value) ||
    templates.value[0] ||
    null,
);

// Location filters cascade: room narrows shelves, room + shelf narrow bins.
const rooms = computed(() =>
  [...new Set(bins.value.map((b) => b.room).filter(Boolean))].sort() as string[],
);
const binsInRoom = computed(() =>
  bins.value.filter((b) => !filters.room || b.room === filters.room),
);
const shelves = computed(() =>
  [...new Set(binsInRoom.value.map((b) => b.shelf).filter(Boolean))].sort() as string[],
);
const binOptions = computed(() =>
  binsInRoom.value.filter((b) => !filters.shelf || b.shelf === filters.shelf),
);

const location = (entry: InventoryItem) => {
  const bin = entry.bin;
  if (!bin) return "Unassigned";
  const parts = [bin.room, bin.shelf ? `Shelf ${bin.shelf}` : "", bin.name];
  return parts.filter(Boolean).join(" · ");
};

const filtered = computed(() => {
  const q = filters.search.trim().toLowerCase();
  return items.value.filter((entry) => {
    const bin = entry.bin;
    if (
      q &&
      ![
        entry.name,
        entry.barcode,
        entry.category?.name,
        bin?.name,
        bin?.room,
        bin?.shelf,
      ].some((v) => v?.toLowerCase().includes(q))
    )
      return false;
    if (
      filters.categoryId &&
      (filters.categoryId === "none"
        ? entry.categoryId
        : entry.categoryId !== filters.categoryId)
    )
      return false;
    if (filters.room && bin?.room !== filters.room) return false;
    if (filters.shelf && bin?.shelf !== filters.shelf) return false;
    if (
      filters.binId &&
      (filters.binId === "unassigned"
        ? entry.binId
        : entry.binId !== filters.binId)
    )
      return false;
    return !filters.selectedOnly || selected.value.has(entry.id);
  });
});
const totalPages = computed(() => Math.ceil(filtered.value.length / pageSize.value)),
  start = computed(() => (page.value - 1) * pageSize.value),
  pageItems = computed(() =>
    filtered.value.slice(start.value, start.value + pageSize.value),
  );

// Selection is kept across filters and pages so a run can combine several
// searches. Labels print in list order, not click order.
const selectedIds = computed(() =>
  items.value.filter((i) => selected.value.has(i.id)).map((i) => i.id),
);
const overLimit = computed(() => selectedIds.value.length > maxLabels.value);
const allFilteredSelected = computed(
  () =>
    filtered.value.length > 0 &&
    filtered.value.every((i) => selected.value.has(i.id)),
);
const someFilteredSelected = computed(() =>
  filtered.value.some((i) => selected.value.has(i.id)),
);

function toggle(id: string) {
  if (!selected.value.delete(id)) selected.value.add(id);
}
function selectAllFiltered() {
  filtered.value.forEach((i) => selected.value.add(i.id));
}
function toggleAllFiltered() {
  if (allFilteredSelected.value)
    filtered.value.forEach((i) => selected.value.delete(i.id));
  else selectAllFiltered();
}
function clearFilters() {
  Object.assign(filters, {
    search: "",
    categoryId: "",
    room: "",
    shelf: "",
    binId: "",
    selectedOnly: false,
  });
}
function generate(itemIds: string[]) {
  job.value = { key: ++jobCounter, itemIds };
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [inventory, labelConfig] = await Promise.all([
      apiService.getInventory(),
      apiService.getInventoryLabelTemplates(),
    ]);
    items.value = inventory.items;
    bins.value = inventory.bins;
    categories.value = inventory.categories;
    templates.value = labelConfig.templates;
    maxLabels.value = labelConfig.maxLabels;
    // Drop selections for items deleted since the last load.
    const known = new Set(inventory.items.map((i) => i.id));
    selected.value.forEach((id) => known.has(id) || selected.value.delete(id));
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not load inventory";
  } finally {
    loading.value = false;
  }
}

watch(
  () => filters.room,
  () => {
    filters.shelf = "";
    filters.binId = "";
  },
);
watch(
  () => filters.shelf,
  () => (filters.binId = ""),
);
watch(
  [
    () => filters.search,
    () => filters.categoryId,
    () => filters.room,
    () => filters.shelf,
    () => filters.binId,
    () => filters.selectedOnly,
    pageSize,
  ],
  () => (page.value = 1),
);
watch(templateId, (id) => {
  try {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, id);
  } catch {
    // Remembering the choice is a convenience only.
  }
});
watchEffect(() => {
  if (headerCheckbox.value)
    headerCheckbox.value.indeterminate =
      someFilteredSelected.value && !allFilteredSelected.value;
});
onMounted(async () => {
  await load();
  if (!templates.value.some((t) => t.id === templateId.value))
    templateId.value = templates.value[0]?.id || "";
});
</script>

<style scoped>
.filter {
  @apply space-y-2 text-sm font-medium text-gray-300;
}
.filter input,
.filter select {
  @apply mt-2 w-full rounded-lg border border-gray-600/50 bg-gray-700/50 px-4 py-2.5 text-gray-100 disabled:opacity-50;
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
