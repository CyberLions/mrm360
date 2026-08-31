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
            placeholder="Search name or barcode..." /></label
        ><label class="filter"
          ><span>Status</span
          ><select v-model="filters.status">
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="checked-out">Checked Out</option>
          </select></label
        ><label class="filter"
          ><span>Bin / Location</span
          ><select v-model="filters.binId">
            <option value="">All Locations</option>
            <option value="unassigned">Unassigned</option>
            <option v-for="bin in bins" :key="bin.id" :value="bin.id">
              {{ locationName(bin) }}
            </option>
          </select></label
        ><label class="filter"
          ><span>Results per page</span
          ><select v-model.number="pageSize">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select></label
        >
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
              <th
                v-for="heading in [
                  'Item',
                  'Status',
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
              class="hover:bg-gray-700"
            >
              <td>
                <div class="font-medium text-gray-100">{{ entry.name }}</div>
                <code class="text-xs text-gray-400">{{ entry.barcode }}</code>
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
              </td>
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
                    :icon="
                      entry.checkedOutToId
                        ? ArrowLeftOnRectangleIcon
                        : ArrowRightOnRectangleIcon
                    "
                    :label="entry.checkedOutToId ? 'Check in' : 'Check out'"
                    :variant="entry.checkedOutToId ? 'success' : 'warning'"
                    @click="transactionItem = entry"
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
      @close="editingItem = null"
      @saved="refresh"
    />
    <ItemTransactionModal
      v-if="transactionItem"
      :item="transactionItem"
      :bins="bins"
      @close="transactionItem = null"
      @saved="refresh"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import apiService from "@/services/api";
import PaginationBar from "@/components/inventory/PaginationBar.vue";
import ItemEditModal from "@/components/inventory/ItemEditModal.vue";
import ItemTransactionModal from "@/components/inventory/ItemTransactionModal.vue";
import IconButton from "@/components/common/IconButton.vue";
import {
  ArchiveBoxIcon,
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  EyeIcon,
  FunnelIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import type { InventoryBin, InventoryItem } from "@/types/api";
const items = ref<InventoryItem[]>([]),
  bins = ref<InventoryBin[]>([]),
  loading = ref(true),
  editingItem = ref<InventoryItem | null>(null),
  transactionItem = ref<InventoryItem | null>(null),
  page = ref(1),
  pageSize = ref(25),
  filters = reactive({ search: "", status: "", binId: "" });
const holder = (entry: InventoryItem) =>
    entry.checkedOutTo?.displayName ||
    `${entry.checkedOutTo?.firstName || ""} ${entry.checkedOutTo?.lastName || ""}`.trim(),
  locationName = (bin: InventoryBin) =>
    `${bin.room ? `${bin.room} · ` : ""}${bin.name}`,
  location = (entry: InventoryItem) =>
    entry.checkedOutToId
      ? "Checked out"
      : entry.bin
        ? locationName(entry.bin)
        : "Unassigned";
const filtered = computed(() => {
    const q = filters.search.toLowerCase();
    return items.value.filter(
      (entry) =>
        (!q ||
          [entry.name, entry.barcode, holder(entry)].some((v) =>
            v.toLowerCase().includes(q),
          )) &&
        (!filters.status ||
          (filters.status === "available"
            ? !entry.checkedOutToId
            : !!entry.checkedOutToId)) &&
        (!filters.binId ||
          (filters.binId === "unassigned"
            ? !entry.binId
            : entry.binId === filters.binId)),
    );
  }),
  totalPages = computed(() =>
    Math.ceil(filtered.value.length / pageSize.value),
  ),
  start = computed(() => (page.value - 1) * pageSize.value),
  pageItems = computed(() =>
    filtered.value.slice(start.value, start.value + pageSize.value),
  );
const formatDate = (value: string) => new Date(value).toLocaleDateString();
function clearFilters() {
  Object.assign(filters, { search: "", status: "", binId: "" });
}
async function load() {
  loading.value = true;
  const data = await apiService.getInventory();
  items.value = data.items;
  bins.value = data.bins;
  loading.value = false;
}
async function refresh() {
  editingItem.value = transactionItem.value = null;
  await load();
}
watch(
  [() => filters.search, () => filters.status, () => filters.binId, pageSize],
  () => (page.value = 1),
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
th {
  @apply px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300;
}
td {
  @apply whitespace-nowrap px-6 py-4 text-sm text-gray-300;
}
</style>
