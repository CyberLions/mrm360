<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-100">All Items</h1>
      <p class="mt-2 text-sm text-gray-400">
        Every physical inventory item, its current status, and location.
      </p>
    </div>
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
      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <label class="filter"
          ><span>Search</span
          ><input
            v-model="filters.search"
            placeholder="Search name, barcode or description..." /></label
        ><label class="filter"
          ><span>Status</span
          ><select v-model="filters.status">
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="checked-out">Checked Out</option>
            <option value="lost">Lost</option>
          </select></label
        ><label class="filter"
          ><span>Location</span
          ><PlaceSelect
            v-model="filters.place"
            empty-label="All Locations"
            :bins="bins"
            :shelves="shelves"
            :rooms="rooms"
            ><option value="unassigned">Unassigned</option></PlaceSelect
          ></label
        ><label class="filter"
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
        ><label class="filter"
          ><span>Results per page</span
          ><select v-model.number="pageSize">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select></label
        >
      </div>
    </div>
    <div v-if="error" class="rounded bg-red-900/50 p-3 text-red-200">
      {{ error }}
    </div>
    <div
      v-if="selectedItems.length"
      class="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-blue-700/60 bg-gray-800 p-3 shadow-xl"
    >
      <span class="text-sm font-medium text-gray-100"
        >{{ selectedItems.length }} selected</span
      >
      <button
        v-if="allPageSelected && filtered.length > pageItems.length"
        type="button"
        class="text-sm text-blue-300 hover:underline"
        @click="selectFiltered"
      >
        Select all {{ filtered.length }} matching items
      </button>
      <div class="ml-auto flex flex-wrap gap-2">
        <button class="bulk-btn" @click="movingItems = selectedItems">
          <ArrowsRightLeftIcon class="h-4 w-4" />Move
        </button>
        <button class="bulk-btn" @click="showCategory = true">
          <TagIcon class="h-4 w-4" />Set category
        </button>
        <button class="bulk-btn bg-red-900/60 text-red-200 hover:bg-red-800" @click="deleteSelected">
          <TrashIcon class="h-4 w-4" />Delete
        </button>
        <button class="bulk-btn" @click="selected = new Set()">Clear</button>
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
              <th class="w-10 !pr-0">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-500 bg-gray-800"
                  aria-label="Select all items on this page"
                  :checked="allPageSelected"
                  :indeterminate.prop="somePageSelected && !allPageSelected"
                  @change="togglePage"
                />
              </th>
              <th
                v-for="heading in [
                  'Item',
                  'Status',
                  'Category',
                  'Location',
                  'Last updated',
                  'Actions',
                ]"
                :key="heading"
              >
                {{ heading }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr
              v-for="entry in pageItems"
              :key="entry.id"
              :class="selected.has(entry.id) ? 'bg-gray-700/60' : ''"
              class="hover:bg-gray-700"
            >
              <td class="w-10 !pr-0">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-500 bg-gray-800"
                  :aria-label="`Select ${entry.name} ${entry.barcode}`"
                  :checked="selected.has(entry.id)"
                  @change="toggle(entry.id)"
                />
              </td>
              <td>
                <div class="font-medium text-gray-100">{{ entry.name }}</div>
                <code class="text-xs text-gray-400">{{ entry.barcode }}</code>
                <div
                  v-if="entry.description"
                  class="mt-1 max-w-xs truncate text-xs text-gray-500"
                  :title="entry.description"
                >
                  {{ entry.description }}
                </div>
              </td>
              <td>
                <span
                  :class="
                    entry.checkedOutToId
                      ? 'bg-amber-900 text-amber-200'
                      : 'bg-green-900 text-green-200'
                  "
                  class="rounded-full px-2 py-1 text-xs font-semibold"
                  >{{
                    entry.checkedOutToId ? `With ${holder(entry)}` : "Available"
                  }}</span
                >
                <span
                  v-if="entry.lostAt"
                  class="ml-2 rounded-full bg-red-900 px-2 py-1 text-xs font-semibold text-red-200"
                  >Lost</span
                >
              </td>
              <td>{{ entry.category?.name || "—" }}</td>
              <td>{{ location(entry) }}</td>
              <td>{{ formatDate(entry.updatedAt!) }}</td>
              <td>
                <div class="flex gap-2">
                  <IconButton
                    :to="`/inventory/items/${entry.id}`"
                    :icon="EyeIcon"
                    label="View item details"
                    variant="primary"
                  />
                  <IconButton
                    :icon="PencilSquareIcon"
                    label="Edit item"
                    @click="editingItem = entry"
                  />
                  <IconButton
                    :icon="ArrowsRightLeftIcon"
                    label="Move to a bin"
                    @click="movingItems = [entry]"
                  />
                  <IconButton
                    :icon="
                      entry.checkedOutToId
                        ? ArrowLeftOnRectangleIcon
                        : ArrowRightOnRectangleIcon
                    "
                    :label="entry.checkedOutToId ? 'Check in' : 'Check out'"
                    :variant="entry.checkedOutToId ? 'success' : 'warning'"
                    @click="transactionItem = entry"
                  />
                  <IconButton
                    :icon="TrashIcon"
                    label="Delete item"
                    variant="danger"
                    @click="deleteItems([entry])"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!pageItems.length" class="py-12 text-center">
        <ArchiveBoxIcon class="mx-auto h-12 w-12 text-gray-500" />
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
    <ItemEditModal
      v-if="editingItem"
      :item="editingItem"
      :bins="bins"
      :shelves="shelves"
      :rooms="rooms"
      :categories="categories"
      @close="editingItem = null"
      @saved="refresh"
    />
    <ItemMoveModal
      v-if="movingItems"
      :items="movingItems"
      :bins="bins"
      :shelves="shelves"
      :rooms="rooms"
      @close="movingItems = null"
      @saved="refresh"
    />
    <div
      v-if="showCategory"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      @click.self="showCategory = false"
    >
      <form
        class="w-full max-w-md space-y-4 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl"
        @submit.prevent="applyCategory"
      >
        <h2 class="text-xl font-semibold text-white">
          Set category for {{ selectedItems.length }}
          {{ selectedItems.length === 1 ? "item" : "items" }}
        </h2>
        <select v-model="bulkCategoryId" autofocus class="modal-field">
          <option value="">Uncategorized</option>
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
          </option>
        </select>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
            @click="showCategory = false"
          >
            Cancel
          </button>
          <button
            class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
          >
            Apply
          </button>
        </div>
      </form>
    </div>
    <ItemTransactionModal
      v-if="transactionItem"
      :item="transactionItem"
      :bins="bins"
      :shelves="shelves"
      :rooms="rooms"
      @close="transactionItem = null"
      @saved="refresh"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import apiService from "@/services/api";
import PaginationBar from "@/components/inventory/PaginationBar.vue";
import PlaceSelect from "@/components/inventory/PlaceSelect.vue";
import { itemPlaceLabel } from "@/utils/binLabel";
import { placeValue } from "@/utils/place";
import ItemEditModal from "@/components/inventory/ItemEditModal.vue";
import ItemMoveModal from "@/components/inventory/ItemMoveModal.vue";
import ItemTransactionModal from "@/components/inventory/ItemTransactionModal.vue";
import IconButton from "@/components/common/IconButton.vue";
import {
  ArchiveBoxIcon,
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  ArrowsRightLeftIcon,
  EyeIcon,
  FunnelIcon,
  PencilSquareIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import type {
  InventoryBin,
  InventoryCategory,
  InventoryItem,
  InventoryRoom,
  InventoryShelf,
} from "@/types/api";
const items = ref<InventoryItem[]>([]),
  bins = ref<InventoryBin[]>([]),
  shelves = ref<InventoryShelf[]>([]),
  rooms = ref<InventoryRoom[]>([]),
  categories = ref<InventoryCategory[]>([]),
  loading = ref(true),
  editingItem = ref<InventoryItem | null>(null),
  transactionItem = ref<InventoryItem | null>(null),
  movingItems = ref<InventoryItem[] | null>(null),
  selected = ref(new Set<string>()),
  showCategory = ref(false),
  bulkCategoryId = ref(""),
  error = ref(""),
  page = ref(1),
  pageSize = ref(25),
  filters = reactive({ search: "", status: "", place: "", categoryId: "" });
const holder = (entry: InventoryItem) =>
    entry.checkedOutTo?.displayName ||
    `${entry.checkedOutTo?.firstName || ""} ${entry.checkedOutTo?.lastName || ""}`.trim(),
  location = (entry: InventoryItem) =>
    entry.checkedOutToId ? "Checked out" : itemPlaceLabel(entry);
const filtered = computed(() => {
    const q = filters.search.toLowerCase();
    return items.value.filter(
      (entry) =>
        (!q ||
          [entry.name, entry.barcode, entry.description || "", holder(entry)].some((v) =>
            v.toLowerCase().includes(q),
          )) &&
        (!filters.status ||
          (filters.status === "lost"
            ? !!entry.lostAt
            : filters.status === "available"
              ? !entry.checkedOutToId
              : !!entry.checkedOutToId)) &&
        (!filters.place ||
          (filters.place === "unassigned"
            ? !placeValue(entry)
            : placeValue(entry) === filters.place)) &&
        (!filters.categoryId ||
          (filters.categoryId === "none"
            ? !entry.categoryId
            : entry.categoryId === filters.categoryId)),
    );
  }),
  totalPages = computed(() =>
    Math.ceil(filtered.value.length / pageSize.value),
  ),
  start = computed(() => (page.value - 1) * pageSize.value),
  pageItems = computed(() =>
    filtered.value.slice(start.value, start.value + pageSize.value),
  );
const selectedItems = computed(() =>
    items.value.filter((entry) => selected.value.has(entry.id)),
  ),
  allPageSelected = computed(
    () =>
      !!pageItems.value.length &&
      pageItems.value.every((entry) => selected.value.has(entry.id)),
  ),
  somePageSelected = computed(() =>
    pageItems.value.some((entry) => selected.value.has(entry.id)),
  );
function toggle(id: string) {
  const next = new Set(selected.value);
  if (!next.delete(id)) next.add(id);
  selected.value = next;
}
function togglePage() {
  const next = new Set(selected.value);
  for (const entry of pageItems.value)
    allPageSelected.value ? next.delete(entry.id) : next.add(entry.id);
  selected.value = next;
}
function selectFiltered() {
  selected.value = new Set(filtered.value.map((entry) => entry.id));
}
const formatDate = (value: string) => new Date(value).toLocaleDateString();
function clearFilters() {
  Object.assign(filters, { search: "", status: "", place: "", categoryId: "" });
}
async function load() {
  loading.value = true;
  const data = await apiService.getInventory();
  items.value = data.items;
  bins.value = data.bins;
  shelves.value = data.shelves;
  rooms.value = data.rooms;
  categories.value = data.categories;
  loading.value = false;
}
async function refresh() {
  editingItem.value = transactionItem.value = movingItems.value = null;
  await load();
}
async function deleteItems(targets: InventoryItem[]) {
  const many = targets.length > 1;
  const onLoan = targets.filter((entry) => entry.checkedOutToId).length;
  const message = many
    ? `Delete ${targets.length} items? Their loan history is deleted too. This cannot be undone.`
    : `Delete "${targets[0].name}" (${targets[0].barcode})? Its loan history is deleted too. This cannot be undone.`;
  if (!confirm(onLoan ? `${message}\n\n${onLoan} currently checked out.` : message))
    return;
  error.value = "";
  try {
    await apiService.bulkInventoryItems({
      action: "delete",
      ids: targets.map((entry) => entry.id),
    });
    selected.value = new Set();
    await refresh();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not delete items";
  }
}
const deleteSelected = () => deleteItems(selectedItems.value);
async function applyCategory() {
  error.value = "";
  try {
    await apiService.bulkInventoryItems({
      action: "category",
      ids: selectedItems.value.map((entry) => entry.id),
      categoryId: bulkCategoryId.value || null,
    });
    showCategory.value = false;
    await refresh();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not update items";
  }
}
watch(
  [
    () => filters.search,
    () => filters.status,
    () => filters.place,
    () => filters.categoryId,
    pageSize,
  ],
  () => {
    page.value = 1;
    // Never leave a selection behind that the filtered list no longer shows.
    selected.value = new Set();
  },
);
onMounted(load);
</script>
<style scoped>
.filter {
  @apply space-y-2 text-sm font-medium text-gray-300;
}
.filter input,
.filter select {
  @apply mt-2 w-full rounded-lg border border-gray-600/50 bg-gray-700/50 px-4 py-2.5 text-gray-100;
}
.bulk-btn {
  @apply inline-flex items-center gap-1.5 rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-600;
}
.modal-field {
  @apply w-full rounded-lg border border-gray-600 bg-gray-900 px-4 py-3 text-white;
}
th {
  @apply px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300;
}
td {
  @apply whitespace-nowrap px-6 py-4 text-sm text-gray-300;
}
</style>
