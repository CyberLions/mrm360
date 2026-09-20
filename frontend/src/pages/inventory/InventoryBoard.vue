<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-white">Inventory</h1>
        <p class="text-gray-400">
          {{
            canManage
              ? "All club items by location"
              : "Items currently checked out to you"
          }}
        </p>
      </div>
      <div class="flex gap-2">
        <button v-if="canManage" class="btn" @click="showBulk = true">Bulk add</button
        ><router-link
          class="btn bg-blue-600 hover:bg-blue-500"
          to="/inventory/kiosk"
          >{{ canManage ? "Open kiosk" : "Self checkout" }}</router-link
        >
      </div>
    </div>
    <div v-if="error" class="rounded bg-red-900/50 p-3 text-red-200">
      {{ error }}
    </div>
    <div
      v-if="!loading"
      class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-700 bg-gray-800/60 p-3"
    >
      <FunnelIcon class="h-5 w-5 shrink-0 text-blue-400" />
      <input
        v-model="filters.search"
        type="search"
        class="field min-w-[12rem] flex-1"
        placeholder="Search name, barcode or description…"
        aria-label="Search items"
      /><PlaceSelect
        v-if="canManage"
        v-model="filters.place"
        class="field !w-auto"
        empty-label="All locations"
        aria-label="Show only this location and what is inside it"
        :bins="bins"
        :shelves="shelves"
        :rooms="rooms"
        ><option value="unassigned">Unassigned</option>
        <option value="checked-out">Checked out</option></PlaceSelect
      ><select
        v-model="filters.status"
        class="field !w-auto"
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        <option value="available">Available</option>
        <option value="checked-out">Checked out</option>
        <option value="lost">Lost</option></select
      ><select
        v-model="filters.categoryId"
        class="field !w-auto"
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        <option value="none">Uncategorized</option>
        <option
          v-for="category in categories"
          :key="category.id"
          :value="category.id"
        >
          {{ category.name }}
        </option></select
      ><span v-if="itemFiltersActive" class="text-sm text-gray-400"
        >Showing {{ visibleItems.length }} of {{ items.length }} items</span
      ><template v-if="filtersActive"
        ><button
          type="button"
          class="flex items-center rounded px-3 py-2 text-sm text-gray-400 hover:bg-gray-700"
          @click="clearFilters"
        >
          <XMarkIcon class="mr-1 h-4 w-4" />Clear
        </button></template
      >
    </div>
    <div v-if="loading" class="text-gray-400">Loading inventory…</div>
    <div v-else class="columns-1 gap-4 md:columns-2 xl:columns-3 2xl:columns-4">
      <section
        v-for="column in columns"
        :key="column.id"
        @dragover.prevent
        @drop="dropOn(column.id)"
        class="mb-4 inline-block w-full break-inside-avoid rounded-xl bg-gray-800 p-3 align-top border border-gray-700"
      >
        <header class="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 class="font-semibold text-white">{{ column.name }}</h2>
            <p class="text-xs text-gray-400">
              {{ column.subtitle }} · {{ itemCount(column.groups) }} items
            </p>
          </div>
          <div
            v-if="canManage && column.id !== 'checked-out'"
            class="flex shrink-0 items-center gap-1"
          >
            <IconButton
              v-if="itemCount(column.groups)"
              :icon="ArrowsRightLeftIcon"
              :label="
                itemFiltersActive
                  ? `Move the ${itemCount(column.groups)} shown items to another location`
                  : `Move all ${itemCount(column.groups)} items to another location`
              "
              @click="movingItems = columnItems(column.groups)"
            />
            <IconButton
              v-if="
                !itemFiltersActive &&
                column.id !== 'unassigned' &&
                itemCount(column.groups)
              "
              :icon="ArchiveBoxXMarkIcon"
              :label="`Empty ${column.name} (move all to Unassigned)`"
              variant="warning"
              @click="emptyColumn(column)"
            />
            <button
              class="h-9 w-9 rounded-md bg-gray-700 text-xl text-blue-300 hover:bg-gray-600"
              title="Add item here"
              @click="openAdd(column.id)"
            >
              +
            </button>
          </div>
        </header>
        <div class="space-y-2">
          <article
            v-for="group in column.groups"
            :key="group.key"
            :draggable="canManage"
            @dragstart="startDrag(group.items)"
            class="cursor-grab rounded-lg bg-gray-900 p-3 border border-gray-700 active:cursor-grabbing"
          >
            <div class="flex items-start justify-between gap-2">
              <router-link
                v-if="group.items.length === 1"
                :to="`/inventory/items/${group.items[0].id}`"
                class="font-medium text-gray-100 hover:text-blue-300"
                >{{ group.name }}</router-link
              ><button
                v-else
                type="button"
                class="text-left font-medium text-gray-100 hover:text-blue-300"
                @click.stop="openItemPicker(group)"
              >
                {{ group.name }}</button
              ><div class="flex shrink-0 items-center gap-1">
                <button
                  v-if="group.items.length > 1"
                  type="button"
                  class="rounded-full bg-blue-900 px-2 py-0.5 text-xs font-semibold text-blue-200 hover:bg-blue-800"
                  @click.stop="openItemPicker(group)"
                >
                  ×{{ group.items.length }}
                </button>
                <IconButton
                  v-if="canManage"
                  :icon="ArrowsRightLeftIcon"
                  :label="
                    group.items.length > 1
                      ? `Move all ${group.items.length} items to another location`
                      : 'Move to another location'
                  "
                  @click.stop="movingItems = group.items"
                />
                <IconButton
                  v-if="canManage && group.items.length === 1"
                  :icon="PencilSquareIcon"
                  label="Edit item"
                  @click.stop="editingItem = group.items[0]"
                />
              </div>
            </div>
            <button
              v-if="group.items.length > 1"
              type="button"
              class="mt-1 font-mono text-xs text-gray-400 hover:text-blue-300"
              @click.stop="openItemPicker(group)"
            >
              {{ group.items.length }} unique identifiers · Select item
            </button>
            <div v-else class="mt-1 font-mono text-xs text-gray-400">
              {{ group.items[0].barcode }}
            </div>
            <div
              v-if="group.items[0].category"
              class="mt-1 inline-block rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300"
            >
              {{ group.items[0].category.name }}
            </div>
            <div
              v-if="group.items[0].checkedOutTo"
              class="mt-3 space-y-1 border-t border-gray-700 pt-2 text-xs"
            >
              <div class="font-medium text-amber-300">
                {{ holderName(group.items[0]) }}
              </div>
              <div class="text-gray-400">
                {{ group.items[0].checkedOutTo.email }}
              </div>
              <div class="text-gray-500">
                Checked out {{ checkoutDate(group.items[0]) }}
              </div>
            </div>
            <div
              class="mt-3 border-t border-gray-800 pt-2 text-xs text-gray-500"
            >
              Last activity {{ groupLastActivity(group.items) }}
            </div>
          </article>
          <p
            v-if="!column.groups.length"
            class="py-3 text-center text-sm text-gray-500"
          >
            {{ itemFiltersActive ? "No matching items" : "Drop items here" }}
          </p>
        </div>
      </section>
    </div>

    <div v-if="showItem || showBulk" class="overlay">
      <form class="modal" @submit.prevent="saveItems">
        <h2 class="text-xl font-semibold text-white">
          {{ showBulk ? "Bulk add items" : "Add item" }}
        </h2>
        <p v-if="showBulk" class="text-sm text-gray-400">
          One per line: barcode, name, bin name, room, category, description
          (all but barcode and name are optional; the description can contain
          commas). Missing bins and categories are created automatically.
        </p>
        <textarea
          v-if="showBulk"
          v-model="bulkText"
          rows="9"
          class="field font-mono"
          placeholder="LAPTOP-001, Dell laptop, Locker 4, Room 101, GBM Equipment, 14-inch, charger included"
        ></textarea
        ><template v-else
          ><div v-if="quantity === 1" class="flex gap-2">
            <input
              v-model="draft.barcode"
              autofocus
              required
              class="field"
              placeholder="Barcode / identifier"
              @input="onBarcodeInput($event)"
            /><button
              type="button"
              class="btn shrink-0"
              @click="regenerateBarcode"
            >
              Auto-generate
            </button>
          </div>
          <p v-else class="rounded-md bg-gray-900 p-3 text-sm text-gray-400">
            Each of the {{ quantity }} items gets its own auto-generated
            barcode.
          </p>
          <input
            v-model="draft.name"
            required
            class="field"
            list="item-names"
            placeholder="Item name"
          /><label class="flex items-center gap-3 text-sm text-gray-300"
            >Quantity<input
              v-model.number="draft.quantity"
              type="number"
              min="1"
              :max="MAX_QUANTITY"
              step="1"
              class="field !w-24"
              aria-label="Quantity" /></label
          ><datalist id="item-names">
            <option v-for="name in names" :key="name" :value="name" /></datalist
          ><textarea
            v-model="draft.description"
            rows="2"
            maxlength="2000"
            class="field"
            placeholder="Description (optional): size, condition, what it's for…"
          ></textarea
          ><PlaceSelect
            v-model="draft.place"
            class="field"
            empty-label="No location"
            :bins="bins"
            :shelves="shelves"
            :rooms="rooms"
          /><select v-model="draft.categoryId" class="field">
            <option value="">No category</option>
            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
            <option :value="NEW_CATEGORY">＋ New category…</option>
          </select
          ><input
            v-if="draft.categoryId === NEW_CATEGORY"
            v-model="draft.newCategory"
            required
            maxlength="100"
            class="field"
            placeholder="New category name, e.g. GBM Equipment"
          /></template
        >
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" @click="closeModals">Cancel</button
          ><button class="btn bg-blue-600">
            Add
            {{ showBulk ? "items" : quantity > 1 ? `${quantity} items` : "item" }}
          </button>
        </div>
      </form>
    </div>
    <div v-if="showBin" class="overlay">
      <form class="modal" @submit.prevent="saveBin">
        <h2 class="text-xl font-semibold text-white">Create bin or locker</h2>
        <input
          v-model="binDraft.name"
          autofocus
          required
          class="field"
          placeholder="Bin name"
        /><NameSelect
          v-model="binDraft.room"
          :options="roomNames"
          empty-label="No room"
          new-label="New room…"
          new-placeholder="New room name"
        /><NameSelect
          v-model="binDraft.shelf"
          :options="binShelfNames"
          empty-label="No shelf"
          new-label="New shelf…"
          new-placeholder="New shelf name"
        /><input
          v-model="binDraft.code"
          class="field"
          placeholder="Locker code (optional)"
        /><textarea
          v-model="binDraft.description"
          class="field"
          placeholder="Location description (optional)"
        ></textarea>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" @click="closeModals">Cancel</button
          ><button class="btn bg-blue-600">Create bin</button>
        </div>
      </form>
    </div>
    <div v-if="showCategory" class="overlay">
      <form class="modal" @submit.prevent="saveCategory">
        <h2 class="text-xl font-semibold text-white">Create category</h2>
        <input
          v-model="categoryDraft.name"
          autofocus
          required
          class="field"
          placeholder="Category name, e.g. GBM Equipment"
        /><textarea
          v-model="categoryDraft.description"
          class="field"
          placeholder="Description (optional)"
        ></textarea>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" @click="closeModals">Cancel</button
          ><button class="btn bg-blue-600">Create category</button>
        </div>
      </form>
    </div>
    <div v-if="showCheckout" class="overlay">
      <div class="modal">
        <h2 class="text-xl font-semibold text-white">
          Check out {{ draggedItems[0]?.name
          }}{{ draggedItems.length > 1 ? ` (×${draggedItems.length})` : "" }}
        </h2>
        <p class="text-sm text-gray-400">
          Choose the member receiving
          {{ draggedItems.length > 1 ? "these barcoded items" : "this barcoded item" }}.
        </p>
        <input
          v-model="memberSearch"
          @input="searchMembers"
          autofocus
          class="field"
          placeholder="Search member name or email"
        />
        <div class="max-h-64 space-y-2 overflow-y-auto">
          <button
            v-for="member in memberResults"
            :key="member.id"
            @click="checkoutTo(member.id)"
            class="w-full rounded-lg bg-gray-900 p-3 text-left text-white hover:bg-gray-700"
          >
            <div class="font-medium">
              {{
                member.displayName || `${member.firstName} ${member.lastName}`
              }}
            </div>
            <div class="text-xs text-gray-400">{{ member.email }}</div>
          </button>
          <p
            v-if="memberSearch && !memberResults.length"
            class="p-4 text-center text-gray-400"
          >
            No members found
          </p>
        </div>
        <button class="btn self-end" @click="showCheckout = false">
          Cancel
        </button>
      </div>
    </div>
    <div
      v-if="selectedGroup"
      class="overlay"
      @click.self="selectedGroup = null"
    >
      <div class="modal">
        <div>
          <h2 class="text-xl font-semibold text-white">
            Select {{ selectedGroup.name }}
          </h2>
          <p class="mt-1 text-sm text-gray-400">
            Choose a unique identifier to view, edit or move.
          </p>
        </div>
        <div class="max-h-[60vh] space-y-2 overflow-y-auto">
          <div
            v-for="item in selectedGroup.items"
            :key="item.id"
            class="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 p-2"
          >
            <router-link
              :to="`/inventory/items/${item.id}`"
              class="min-w-0 flex-1 rounded p-2 hover:bg-gray-700"
              ><div class="font-mono text-sm font-medium text-blue-300">
                {{ item.barcode }}
              </div>
              <div class="mt-1 text-xs text-gray-400">
                {{
                  item.checkedOutToId
                    ? `Checked out to ${holderName(item)}`
                    : itemPlaceLabel(item)
                }}
              </div>
              <div class="mt-1 text-xs text-gray-500">
                Last activity {{ lastActivity(item) }}
              </div></router-link
            ><span
              :class="
                item.checkedOutToId
                  ? 'bg-amber-900 text-amber-200'
                  : 'bg-green-900 text-green-200'
              "
              class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
              >{{ item.checkedOutToId ? "Checked out" : "Available" }}</span
            ><IconButton
              :icon="ArrowsRightLeftIcon"
              label="Move to another location"
              @click="movingItems = [item]"
            /><IconButton
              :icon="PencilSquareIcon"
              label="Edit item"
              @click="editingItem = item"
            />
          </div>
        </div>
        <button
          type="button"
          class="btn self-end"
          @click="selectedGroup = null"
        >
          Cancel
        </button>
      </div>
    </div>
    <ItemMoveModal
      v-if="movingItems"
      :items="movingItems"
      :bins="bins"
      :shelves="shelves"
      :rooms="rooms"
      @close="movingItems = null"
      @saved="itemEdited"
    />
    <ItemEditModal
      v-if="editingItem"
      :item="editingItem"
      :bins="bins"
      :shelves="shelves"
      :rooms="rooms"
      :categories="categories"
      @close="editingItem = null"
      @saved="itemEdited"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import apiService from "@/services/api";
import IconButton from "@/components/common/IconButton.vue";
import ItemEditModal from "@/components/inventory/ItemEditModal.vue";
import ItemMoveModal from "@/components/inventory/ItemMoveModal.vue";
import NameSelect from "@/components/inventory/NameSelect.vue";
import PlaceSelect from "@/components/inventory/PlaceSelect.vue";
import { itemPlaceLabel } from "@/utils/binLabel";
import { NO_PLACE, parsePlaceValue, placeValue } from "@/utils/place";
import {
  ArchiveBoxXMarkIcon,
  ArrowsRightLeftIcon,
  FunnelIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import type {
  InventoryBin,
  InventoryCategory,
  InventoryItem,
  InventoryRoom,
  InventoryShelf,
} from "@/types/api";
const route = useRoute(),
  router = useRouter();
const items = ref<InventoryItem[]>([]),
  bins = ref<InventoryBin[]>([]),
  shelves = ref<InventoryShelf[]>([]),
  rooms = ref<InventoryRoom[]>([]),
  categories = ref<InventoryCategory[]>([]),
  loading = ref(true),
  error = ref(""),
  canManage = ref(false),
  showItem = ref(false),
  showBulk = ref(false),
  showBin = ref(false),
  showCategory = ref(false),
  bulkText = ref("");
const draggedItems = ref<InventoryItem[]>([]),
  showCheckout = ref(false),
  memberSearch = ref(""),
  memberResults = ref<any[]>([]);
const selectedGroup = ref<{
  key: string;
  name: string;
  items: InventoryItem[];
} | null>(null);
const editingItem = ref<InventoryItem | null>(null),
  movingItems = ref<InventoryItem[] | null>(null);
const draft = reactive({
  barcode: "",
  name: "",
  description: "",
  place: "",
  categoryId: "",
  newCategory: "",
  quantity: 1 as number | string,
});
const MAX_QUANTITY = 100;
// Whatever is in the box, always a whole number from 1 to MAX_QUANTITY.
const quantity = computed(() =>
  Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(draft.quantity)) || 1)),
);
const NEW_CATEGORY = "__new__";
// The barcode follows the name and category until the user types their own.
const barcodeEdited = ref(false);
let barcodeTimer: ReturnType<typeof setTimeout> | undefined;
let barcodeRequest = 0;
const binDraft = reactive({
  name: "",
  room: "",
  shelf: "",
  code: "",
  description: "",
});
const categoryDraft = reactive({ name: "", description: "" });
const names = computed(() => [...new Set(items.value.map((i) => i.name))]);
// Search, status and category narrow the cards; every column stays as a drop target. Location
// is different: it narrows the board to just that room, shelf or bin (column id = place value).
const filters = reactive({ search: "", status: "", place: "", categoryId: "" });
const itemFiltersActive = computed(
  () => !!(filters.search.trim() || filters.status || filters.categoryId),
);
const filtersActive = computed(
  () => itemFiltersActive.value || !!filters.place,
);
const visibleItems = computed(() => {
  const q = filters.search.trim().toLowerCase();
  return items.value.filter(
    (item) =>
      (!q ||
        [item.name, item.barcode, item.description || "", holderName(item)].some(
          (v) => v.toLowerCase().includes(q),
        )) &&
      (!filters.status ||
        (filters.status === "lost"
          ? !!item.lostAt
          : filters.status === "available"
            ? !item.checkedOutToId
            : !!item.checkedOutToId)) &&
      (!filters.categoryId ||
        (filters.categoryId === "none"
          ? !item.categoryId
          : item.categoryId === filters.categoryId)),
  );
});
function clearFilters() {
  Object.assign(filters, { search: "", status: "", place: "", categoryId: "" });
}
// Rooms and shelves that already exist, offered when creating a bin; shelves follow the room.
const roomNames = computed(() =>
  [...new Set([...rooms.value.map((r) => r.name), ...bins.value.map((b) => b.room).filter((v): v is string => !!v)])].sort(),
);
const binShelfNames = computed(() =>
  [...new Set(shelves.value.filter((sh) => (sh.room?.name ?? "") === binDraft.room).map((sh) => sh.name))].sort(),
);
const groupItems = (list: InventoryItem[]) =>
  Object.values(
    list.reduce(
      (groups, item) => {
        const key = `${item.name.toLowerCase()}-${item.checkedOutToId || ""}`;
        (groups[key] ||= { key, name: item.name, items: [] }).items.push(item);
        return groups;
      },
      {} as Record<
        string,
        { key: string; name: string; items: InventoryItem[] }
      >,
    ),
  );
// Every room, shelf and bin is a column, keyed by its packed place value so a drop or an
// "add here" knows exactly where it means.
const stocked = (value: string) =>
  groupItems(
    visibleItems.value.filter(
      (i) => placeValue(i) === value && !i.checkedOutToId,
    ),
  );
const allColumns = computed(() =>
  canManage.value
    ? [
        ...rooms.value.map((room) => ({
          id: `room:${room.id}`,
          name: room.name,
          subtitle: "Room",
          groups: stocked(`room:${room.id}`),
        })),
        ...shelves.value.map((shelf) => ({
          id: `shelf:${shelf.id}`,
          name: `Shelf ${shelf.name}`,
          subtitle: ["Shelf", shelf.room?.name].filter(Boolean).join(" · "),
          groups: stocked(`shelf:${shelf.id}`),
        })),
        ...bins.value.map((bin) => ({
          id: `bin:${bin.id}`,
          name: bin.name,
          subtitle:
            [
              "Bin",
              bin.room,
              bin.shelf && `Shelf ${bin.shelf}`,
              bin.code && `Code ${bin.code}`,
            ]
              .filter(Boolean)
              .join(" · "),
          groups: stocked(`bin:${bin.id}`),
        })),
        {
          id: "unassigned",
          name: "Unassigned",
          subtitle: "No location",
          groups: stocked(""),
        },
        {
          id: "checked-out",
          name: "Checked out",
          subtitle: "Member inventory",
          groups: groupItems(visibleItems.value.filter((i) => i.checkedOutToId)),
        },
      ]
    : [
        {
          id: "mine",
          name: "My inventory",
          subtitle: "Checked out to you",
          groups: groupItems(visibleItems.value),
        },
      ],
);
// The column ids a location filter keeps: the container itself plus what is inside it. A room
// holds its shelves and every bin in it; a shelf holds the bins on it (matched by name within
// the shelf's room, as bins reference them).
const placeScope = computed(() => {
  const [kind, id] = filters.place.split(":");
  const ids = new Set([filters.place]);
  if (kind === "room") {
    const room = rooms.value.find((r) => r.id === id);
    for (const shelf of shelves.value)
      if (shelf.roomId === id) ids.add(`shelf:${shelf.id}`);
    for (const bin of bins.value)
      if (room && bin.room === room.name) ids.add(`bin:${bin.id}`);
  } else if (kind === "shelf") {
    const shelf = shelves.value.find((sh) => sh.id === id);
    for (const bin of bins.value)
      if (
        shelf &&
        bin.shelf === shelf.name &&
        (bin.room ?? "") === (shelf.room?.name ?? "")
      )
        ids.add(`bin:${bin.id}`);
  }
  return ids;
});
const columns = computed(() =>
  filters.place
    ? allColumns.value.filter((column) => placeScope.value.has(column.id))
    : allColumns.value,
);
const itemCount = (groups: { items: InventoryItem[] }[]) =>
  groups.reduce((total, group) => total + group.items.length, 0);
const columnItems = (groups: { items: InventoryItem[] }[]) =>
  groups.flatMap((group) => group.items);
async function emptyColumn(column: {
  name: string;
  groups: { items: InventoryItem[] }[];
}) {
  const toMove = columnItems(column.groups);
  const count = toMove.length;
  if (
    !confirm(
      `Move all ${count} ${count === 1 ? "item" : "items"} out of ${column.name} to Unassigned?`,
    )
  )
    return;
  error.value = "";
  try {
    await apiService.moveInventoryItems(toMove, NO_PLACE);
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not empty location";
  }
  await load();
}
const holderName = (item: InventoryItem) =>
  item.checkedOutTo?.displayName ||
  `${item.checkedOutTo?.firstName || ""} ${item.checkedOutTo?.lastName || ""}`.trim();
const checkoutDate = (item: InventoryItem) =>
  item.loans?.[0]?.checkedOutAt
    ? new Date(item.loans[0].checkedOutAt).toLocaleString()
    : "date unavailable";
const activityTime = (item: InventoryItem) =>
  new Date(
    item.loans?.[0]?.checkedInAt ||
      item.loans?.[0]?.checkedOutAt ||
      item.updatedAt ||
      item.createdAt ||
      0,
  ).getTime();
const lastActivity = (item: InventoryItem) =>
  activityTime(item)
    ? new Date(activityTime(item)).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "unavailable";
const groupLastActivity = (group: InventoryItem[]) =>
  lastActivity([...group].sort((a, b) => activityTime(b) - activityTime(a))[0]);
const openItemPicker = (group: {
  key: string;
  name: string;
  items: InventoryItem[];
}) => {
  selectedGroup.value = group;
};
async function itemEdited() {
  editingItem.value = null;
  movingItems.value = null;
  selectedGroup.value = null;
  await load();
}
async function load() {
  loading.value = true;
  try {
    const data = await apiService.getInventory();
    items.value = data.items;
    bins.value = data.bins;
    shelves.value = data.shelves;
    rooms.value = data.rooms;
    categories.value = data.categories;
    canManage.value = data.canManage;
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not load inventory";
  } finally {
    loading.value = false;
  }
}
function openAdd(columnId: string) {
  draft.place = columnId === "unassigned" ? "" : columnId;
  showItem.value = true;
}
function closeModals() {
  showItem.value = showBulk.value = showBin.value = showCategory.value = false;
  bulkText.value = "";
  Object.assign(draft, {
    barcode: "",
    name: "",
    description: "",
    place: "",
    categoryId: "",
    newCategory: "",
    quantity: 1,
  });
  barcodeEdited.value = false;
  clearTimeout(barcodeTimer);
  barcodeRequest++;
  Object.assign(binDraft, {
    name: "",
    room: "",
    shelf: "",
    code: "",
    description: "",
  });
  Object.assign(categoryDraft, { name: "", description: "" });
  if (route.query.action) router.replace("/inventory");
}
async function saveItems() {
  error.value = "";
  try {
    const payload = showBulk.value
      ? bulkText.value
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [barcode, name, binName, room, categoryName, ...rest] = line
              .split(",")
              .map((v) => v.trim());
            // Everything after the category is the description, commas included.
            const description = rest.join(", ").trim();
            const bin = bins.value.find(
              (b) =>
                b.name.toLowerCase() === (binName || "").toLowerCase() &&
                (!room || b.room?.toLowerCase() === room.toLowerCase()),
            );
            const category = categories.value.find(
              (c) => c.name.toLowerCase() === (categoryName || "").toLowerCase(),
            );
            return {
              barcode,
              name,
              description: description || null,
              binId: bin?.id || null,
              binName: bin ? undefined : binName || undefined,
              room: bin ? undefined : room || undefined,
              categoryId: category?.id || null,
              categoryName: category ? undefined : categoryName || undefined,
            };
          })
      : (
          quantity.value === 1
            ? [draft.barcode]
            : await apiService.generateInventoryBarcodes(
                { name: draft.name, ...categoryFields() },
                quantity.value,
              )
        ).map((barcode) => ({
          barcode,
          name: draft.name,
          description: draft.description.trim() || null,
          ...parsePlaceValue(draft.place),
          ...categoryFields(),
        }));
    await apiService.createInventoryItems(payload);
    closeModals();
    await load();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not add items";
  }
}
async function saveBin() {
  try {
    await apiService.createInventoryBin({
      name: binDraft.name,
      room: binDraft.room || null,
      shelf: binDraft.shelf || null,
      code: binDraft.code || null,
      description: binDraft.description || null,
    });
    closeModals();
    await load();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not create bin";
  }
}
async function saveCategory() {
  try {
    await apiService.createInventoryCategory({
      name: categoryDraft.name,
      description: categoryDraft.description || null,
    });
    closeModals();
    await load();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not create category";
  }
}
// Either an existing category's id, or the typed name of a new one (the API creates it).
function categoryFields(): { categoryId: string | null; categoryName?: string } {
  if (draft.categoryId !== NEW_CATEGORY) return { categoryId: draft.categoryId || null };
  const name = draft.newCategory.trim();
  const existing = categories.value.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return existing ? { categoryId: existing.id } : { categoryId: null, categoryName: name || undefined };
}
async function generateBarcode(auto = false) {
  const request = ++barcodeRequest;
  try {
    const barcode = await apiService.generateInventoryBarcode({
      name: draft.name,
      ...categoryFields(),
    });
    // Ignore a slow response that a newer keystroke, an edit or closing the form has outrun.
    if (request === barcodeRequest && (!auto || !barcodeEdited.value)) draft.barcode = barcode;
  } catch (e: any) {
    if (!auto) error.value = e.response?.data?.error || "Could not generate barcode";
  }
}
function onBarcodeInput(event: Event) {
  // Clearing the field hands the barcode back to auto-generation.
  barcodeEdited.value = (event.target as HTMLInputElement).value.trim() !== "";
  if (barcodeEdited.value) clearTimeout(barcodeTimer);
  else scheduleBarcode();
}
function scheduleBarcode() {
  clearTimeout(barcodeTimer);
  if (!showItem.value || barcodeEdited.value || !draft.name.trim()) return;
  barcodeTimer = setTimeout(() => generateBarcode(true), 300);
}
function regenerateBarcode() {
  barcodeEdited.value = false;
  generateBarcode();
}
watch(() => [draft.name, draft.categoryId, draft.newCategory], scheduleBarcode);
function startDrag(group: InventoryItem[]) {
  draggedItems.value = group;
}
async function dropOn(columnId: string) {
  const dragged = draggedItems.value;
  if (!dragged.length || !canManage.value) return;
  if (columnId === "checked-out") {
    // Only items still on the shelf can be checked out.
    draggedItems.value = dragged.filter((item) => !item.checkedOutToId);
    if (draggedItems.value.length) {
      showCheckout.value = true;
      memberSearch.value = "";
      memberResults.value = [];
    }
    return;
  }
  const target = columnId === "unassigned" ? "" : columnId;
  const toMove = dragged.filter(
    (item) => item.checkedOutToId || placeValue(item) !== target,
  );
  try {
    if (toMove.length) {
      await apiService.moveInventoryItems(toMove, parsePlaceValue(target));
      await load();
    }
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not move item";
    await load();
  } finally {
    draggedItems.value = [];
  }
}
async function searchMembers() {
  if (memberSearch.value.trim().length < 2) {
    memberResults.value = [];
    return;
  }
  try {
    memberResults.value = (
      await apiService.searchUsers(memberSearch.value.trim(), 10)
    ).data;
  } catch {
    memberResults.value = [];
  }
}
async function checkoutTo(userId: string) {
  if (!draggedItems.value.length) return;
  try {
    // Drop each item once it is out, so a retry after a failure only covers the rest.
    while (draggedItems.value.length) {
      await apiService.inventoryTransaction({
        action: "checkout",
        barcode: draggedItems.value[0].barcode,
        memberCode: userId,
      });
      draggedItems.value = draggedItems.value.slice(1);
    }
    showCheckout.value = false;
    draggedItems.value = [];
    await load();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not check out item";
    await load();
  }
}
watch(
  () => route.query.action,
  (action) => {
    showItem.value = action === "add-item";
    showBin.value = action === "add-bin";
    showCategory.value = action === "add-category";
    showBulk.value = action === "bulk";
  },
  { immediate: true },
);
onMounted(load);
</script>
<style scoped>
.btn {
  @apply inline-flex items-center rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600;
}
.field {
  @apply w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-white placeholder-gray-500;
}
.overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4;
}
.modal {
  @apply w-full max-w-lg space-y-4 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl;
}
</style>
