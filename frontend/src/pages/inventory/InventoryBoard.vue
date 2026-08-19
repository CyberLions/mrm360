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
      <div v-if="canManage" class="flex gap-2">
        <button class="btn" @click="showBulk = true">Bulk add</button
        ><router-link
          class="btn bg-blue-600 hover:bg-blue-500"
          to="/inventory/kiosk"
          >Open kiosk</router-link
        >
      </div>
    </div>
    <div v-if="error" class="rounded bg-red-900/50 p-3 text-red-200">
      {{ error }}
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
          <button
            v-if="canManage && column.id !== 'checked-out'"
            class="rounded bg-gray-700 px-2 text-xl text-blue-300 hover:bg-gray-600"
            title="Add item here"
            @click="openAdd(column.id)"
          >
            +
          </button>
        </header>
        <div class="space-y-2">
          <article
            v-for="group in column.groups"
            :key="group.key"
            :draggable="canManage"
            @dragstart="startDrag(group.items[0])"
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
              ><button
                v-if="group.items.length > 1"
                type="button"
                class="rounded-full bg-blue-900 px-2 py-0.5 text-xs font-semibold text-blue-200 hover:bg-blue-800"
                @click.stop="openItemPicker(group)"
              >
                ×{{ group.items.length }}</button
              ><IconButton
                v-else-if="canManage"
                :icon="PencilSquareIcon"
                label="Edit item"
                size="sm"
                @click.stop="editingItem = group.items[0]"
              />
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
            Drop items here
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
          One per line: barcode, name, bin name, room (bin and room optional).
          Missing bins are created automatically.
        </p>
        <textarea
          v-if="showBulk"
          v-model="bulkText"
          rows="9"
          class="field font-mono"
          placeholder="LAPTOP-001, Dell laptop, Locker 4, Room 101"
        ></textarea
        ><template v-else
          ><div class="flex gap-2">
            <input
              v-model="draft.barcode"
              autofocus
              required
              class="field"
              placeholder="Barcode / identifier"
            /><button
              type="button"
              class="btn shrink-0"
              @click="generateBarcode"
            >
              Auto-generate
            </button>
          </div>
          <input
            v-model="draft.name"
            required
            class="field"
            list="item-names"
            placeholder="Item name"
          /><datalist id="item-names">
            <option v-for="name in names" :key="name" :value="name" /></datalist
          ><select v-model="draft.binId" class="field">
            <option value="">No bin</option>
            <option v-for="bin in bins" :key="bin.id" :value="bin.id">
              {{ bin.room ? `${bin.room} · ` : "" }}{{ bin.name }}
            </option>
          </select></template
        >
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" @click="closeModals">Cancel</button
          ><button class="btn bg-blue-600">
            Add {{ showBulk ? "items" : "item" }}
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
        /><input
          v-model="binDraft.room"
          class="field"
          placeholder="Room (optional)"
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
    <div v-if="showCheckout" class="overlay">
      <div class="modal">
        <h2 class="text-xl font-semibold text-white">
          Check out {{ draggedItem?.name }}
        </h2>
        <p class="text-sm text-gray-400">
          Choose the member receiving this barcoded item.
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
            Choose a unique identifier to view or edit.
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
                    : item.bin
                      ? `${item.bin.room ? `${item.bin.room} · ` : ""}${item.bin.name}`
                      : "Unassigned"
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
    <ItemEditModal
      v-if="editingItem"
      :item="editingItem"
      :bins="bins"
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
import { PencilSquareIcon } from "@heroicons/vue/24/outline";
import type { InventoryBin, InventoryItem } from "@/types/api";
const route = useRoute(),
  router = useRouter();
const items = ref<InventoryItem[]>([]),
  bins = ref<InventoryBin[]>([]),
  loading = ref(true),
  error = ref(""),
  canManage = ref(false),
  showItem = ref(false),
  showBulk = ref(false),
  showBin = ref(false),
  bulkText = ref("");
const draggedItem = ref<InventoryItem | null>(null),
  showCheckout = ref(false),
  memberSearch = ref(""),
  memberResults = ref<any[]>([]);
const selectedGroup = ref<{
  key: string;
  name: string;
  items: InventoryItem[];
} | null>(null);
const editingItem = ref<InventoryItem | null>(null);
const draft = reactive({ barcode: "", name: "", binId: "" });
const binDraft = reactive({ name: "", room: "", code: "", description: "" });
const names = computed(() => [...new Set(items.value.map((i) => i.name))]);
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
const columns = computed(() =>
  canManage.value
    ? [
        ...bins.value.map((bin) => ({
          id: bin.id,
          name: bin.name,
          subtitle:
            [bin.room, bin.code && `Code ${bin.code}`]
              .filter(Boolean)
              .join(" · ") || "No room",
          groups: groupItems(
            items.value.filter((i) => i.binId === bin.id && !i.checkedOutToId),
          ),
        })),
        {
          id: "unassigned",
          name: "Unassigned",
          subtitle: "No bin",
          groups: groupItems(
            items.value.filter((i) => !i.binId && !i.checkedOutToId),
          ),
        },
        {
          id: "checked-out",
          name: "Checked out",
          subtitle: "Member inventory",
          groups: groupItems(items.value.filter((i) => i.checkedOutToId)),
        },
      ]
    : [
        {
          id: "mine",
          name: "My inventory",
          subtitle: "Checked out to you",
          groups: groupItems(items.value),
        },
      ],
);
const itemCount = (groups: { items: InventoryItem[] }[]) =>
  groups.reduce((total, group) => total + group.items.length, 0);
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
  selectedGroup.value = null;
  await load();
}
async function load() {
  loading.value = true;
  try {
    const data = await apiService.getInventory();
    items.value = data.items;
    bins.value = data.bins;
    canManage.value = data.canManage;
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not load inventory";
  } finally {
    loading.value = false;
  }
}
function openAdd(binId: string) {
  draft.binId = binId === "unassigned" ? "" : binId;
  showItem.value = true;
}
function closeModals() {
  showItem.value = showBulk.value = showBin.value = false;
  bulkText.value = "";
  Object.assign(draft, { barcode: "", name: "", binId: "" });
  Object.assign(binDraft, { name: "", room: "", code: "", description: "" });
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
            const [barcode, name, binName, room] = line
              .split(",")
              .map((v) => v.trim());
            const bin = bins.value.find(
              (b) =>
                b.name.toLowerCase() === (binName || "").toLowerCase() &&
                (!room || b.room?.toLowerCase() === room.toLowerCase()),
            );
            return {
              barcode,
              name,
              binId: bin?.id || null,
              binName: bin ? undefined : binName || undefined,
              room: bin ? undefined : room || undefined,
            };
          })
      : [{ ...draft, binId: draft.binId || null }];
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
      code: binDraft.code || null,
      description: binDraft.description || null,
    });
    closeModals();
    await load();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not create bin";
  }
}
async function generateBarcode() {
  try {
    draft.barcode = await apiService.generateInventoryBarcode();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not generate barcode";
  }
}
function startDrag(item: InventoryItem) {
  draggedItem.value = item;
}
async function dropOn(columnId: string) {
  const item = draggedItem.value;
  if (!item || !canManage.value) return;
  if (columnId === "checked-out") {
    if (!item.checkedOutToId) {
      showCheckout.value = true;
      memberSearch.value = "";
      memberResults.value = [];
    }
    return;
  }
  try {
    if (item.checkedOutToId)
      await apiService.inventoryTransaction({
        action: "checkin",
        barcode: item.barcode,
        binId: columnId === "unassigned" ? null : columnId,
      });
    else
      await apiService.moveInventoryItem(
        item.id,
        columnId === "unassigned" ? null : columnId,
      );
    await load();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not move item";
  } finally {
    draggedItem.value = null;
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
  if (!draggedItem.value) return;
  try {
    await apiService.inventoryTransaction({
      action: "checkout",
      barcode: draggedItem.value.barcode,
      memberCode: userId,
    });
    showCheckout.value = false;
    draggedItem.value = null;
    await load();
  } catch (e: any) {
    error.value = e.response?.data?.error || "Could not check out item";
  }
}
watch(
  () => route.query.action,
  (action) => {
    showItem.value = action === "add-item";
    showBin.value = action === "add-bin";
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
