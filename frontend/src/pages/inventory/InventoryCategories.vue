<template>
  <div class="space-y-6">
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">Categories</h1>
        <p class="mt-2 text-sm text-gray-400">
          Group inventory items by type, e.g. GBM Equipment, Travel Equipment, Apparel.
        </p>
      </div>
      <BaseButton class="mt-4 sm:mt-0" @click="edit()">Create Category</BaseButton>
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
            ><MagnifyingGlassIcon
              class="mr-2 h-4 w-4 text-gray-400"
            />Search</label
          ><input
            v-model="filters.search"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
            placeholder="Search categories..."
          />
        </div>
        <div class="space-y-2">
          <label class="flex items-center text-sm font-medium text-gray-300"
            >Results per page</label
          ><select
            v-model.number="pageSize"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
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
      <div
        class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"
      ></div>
    </div>
    <div
      v-else
      class="overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow [contain:layout]"
    >
      <div
        class="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
      >
        <table class="w-full divide-y divide-gray-700">
          <thead class="bg-gray-700">
            <tr>
              <th
                v-for="heading in ['Name', 'Description', 'Items', 'Actions']"
                :key="heading"
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300"
              >
                {{ heading }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700 bg-gray-800">
            <tr
              v-for="category in pageCategories"
              :key="category.id"
              class="transition-colors hover:bg-gray-700"
            >
              <td
                class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-100"
              >
                {{ category.name }}
              </td>
              <td
                class="max-w-md whitespace-normal px-6 py-4 text-sm text-gray-400"
              >
                {{ category.description || "—" }}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-300">
                {{ category._count?.items || 0 }}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-sm">
                <div class="flex gap-2">
                  <IconButton
                    :icon="PencilSquareIcon"
                    label="Edit category"
                    @click="edit(category)"
                  />
                  <IconButton
                    :icon="TrashIcon"
                    label="Delete category"
                    variant="danger"
                    @click="remove(category)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!pageCategories.length" class="py-12 text-center">
        <TagIcon class="mx-auto h-12 w-12 text-gray-500" />
        <h3 class="mt-2 font-medium text-gray-100">No categories found</h3>
        <p class="text-sm text-gray-400">
          Try adjusting your search, or create your first category.
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
        class="w-full max-w-lg space-y-4 rounded-xl border border-gray-700 bg-gray-800 p-6"
        @submit.prevent="save"
      >
        <h2 class="text-xl font-semibold text-white">
          {{ draft.id ? "Edit" : "Create" }} category
        </h2>
        <input
          v-model="draft.name"
          required
          autofocus
          class="filter-input"
          placeholder="Name, e.g. GBM Equipment"
        /><textarea
          v-model="draft.description"
          class="filter-input"
          rows="4"
          placeholder="Description (optional)"
        ></textarea>
        <div v-if="error" class="text-sm text-red-300">{{ error }}</div>
        <div class="flex justify-end gap-2">
          <BaseButton type="button" variant="secondary" @click="show = false"
            >Cancel</BaseButton
          ><BaseButton type="submit">Save</BaseButton>
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
import PaginationBar from "@/components/inventory/PaginationBar.vue";
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import type { InventoryCategory } from "@/types/api";
const categories = ref<InventoryCategory[]>([]),
  loading = ref(true),
  show = ref(false),
  error = ref(""),
  page = ref(1),
  pageSize = ref(25),
  filters = reactive({ search: "" }),
  draft = reactive({ id: "", name: "", description: "" });
const filtered = computed(() => {
    const q = filters.search.toLowerCase();
    return categories.value.filter(
      (c) =>
        !q ||
        [c.name, c.description].some((v) => v?.toLowerCase().includes(q)),
    );
  }),
  totalPages = computed(() =>
    Math.ceil(filtered.value.length / pageSize.value),
  ),
  start = computed(() => (page.value - 1) * pageSize.value),
  pageCategories = computed(() =>
    filtered.value.slice(start.value, start.value + pageSize.value),
  );
async function load() {
  loading.value = true;
  categories.value = await apiService.getInventoryCategories();
  loading.value = false;
}
function clearFilters() {
  Object.assign(filters, { search: "" });
}
function edit(category?: InventoryCategory) {
  Object.assign(draft, {
    id: category?.id || "",
    name: category?.name || "",
    description: category?.description || "",
  });
  error.value = "";
  show.value = true;
}
async function save() {
  const data = { name: draft.name, description: draft.description || null };
  try {
    draft.id
      ? await apiService.updateInventoryCategory(draft.id, data)
      : await apiService.createInventoryCategory(data);
    show.value = false;
    await load();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not save category";
  }
}
async function remove(category: InventoryCategory) {
  if (!confirm(`Delete ${category.name}?`)) return;
  try {
    await apiService.deleteInventoryCategory(category.id);
    await load();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not delete category";
  }
}
watch([() => filters.search, pageSize], () => (page.value = 1));
onMounted(load);
</script>
<style scoped>
.filter-input {
  @apply w-full rounded-lg border border-gray-600/50 bg-gray-700/50 px-4 py-2.5 text-gray-100 placeholder-gray-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/50;
}
</style>
