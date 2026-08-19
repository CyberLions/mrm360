<template>
  <div v-if="item" class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <router-link to="/inventory/items" class="text-sm text-blue-400"
          >← All items</router-link
        >
        <div class="mt-2 flex items-center gap-3">
          <h1 class="text-3xl font-bold text-white">{{ item.name }}</h1>
          <span
            :class="
              item.checkedOutToId
                ? 'bg-amber-900 text-amber-200'
                : 'bg-green-900 text-green-200'
            "
            class="rounded-full px-3 py-1 text-sm"
            >{{ item.checkedOutToId ? "Checked out" : "Available" }}</span
          >
        </div>
        <code class="text-gray-400">{{ item.barcode }}</code>
      </div>
      <div class="flex gap-2">
        <IconButton
          :icon="PencilSquareIcon"
          label="Edit item"
          @click="editing = true"
        />
        <IconButton
          :icon="item.checkedOutToId ? ArrowLeftOnRectangleIcon : ArrowRightOnRectangleIcon"
          :label="item.checkedOutToId ? 'Check in' : 'Check out'"
          :variant="item.checkedOutToId ? 'success' : 'primary'"
          @click="transacting = true"
        />
      </div>
    </div>
    <div class="grid gap-6 md:grid-cols-2">
      <section class="card">
        <h2 class="heading">Current status</h2>
        <dl class="space-y-4">
          <div>
            <dt>Holder</dt>
            <dd>{{ item.checkedOutTo ? name(item.checkedOutTo) : "None" }}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>
              {{
                item.checkedOutToId
                  ? "With member"
                  : item.bin
                    ? locationName(item.bin)
                    : "Unassigned"
              }}
            </dd>
          </div>
        </dl>
      </section>
      <section class="card">
        <h2 class="heading">Location details</h2>
        <dl v-if="item.bin" class="space-y-4">
          <div>
            <dt>Bin / locker</dt>
            <dd>{{ item.bin.name }}</dd>
          </div>
          <div>
            <dt>Room</dt>
            <dd>{{ item.bin.room || "Not specified" }}</dd>
          </div>
          <div>
            <dt>Code</dt>
            <dd>{{ item.bin.code || "None" }}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{{ item.bin.description || "No description" }}</dd>
          </div>
        </dl>
        <p v-else class="text-gray-400">
          This item has no current bin location.
        </p>
      </section>
    </div>
    <section class="card">
      <div class="mb-5">
        <h2 class="text-lg font-semibold text-white">Checkout history</h2>
        <p class="mt-1 text-sm text-gray-400">
          {{ item.loans.length }}
          {{ item.loans.length === 1 ? "checkout" : "checkouts" }} recorded
        </p>
      </div>
      <div
        v-if="!item.loans.length"
        class="rounded-lg border border-dashed border-gray-600 py-10 text-center text-gray-400"
      >
        This item has never been checked out.
      </div>
      <div v-else class="space-y-3">
        <article
          v-for="loan in item.loans"
          :key="loan.id"
          class="rounded-xl border border-gray-700 bg-gray-900/60 p-4"
        >
          <div
            class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
          >
            <div class="flex items-center gap-3">
              <div class="avatar">{{ initials(loan.user) }}</div>
              <div>
                <router-link
                  :to="`/users/${loan.userId}`"
                  class="font-medium text-blue-300"
                  >{{ loan.user ? name(loan.user) : loan.userId }}</router-link
                >
                <p class="text-sm text-gray-500">
                  Borrowed for {{ duration(loan) }}
                </p>
              </div>
            </div>
            <span
              :class="
                loan.checkedInAt
                  ? 'bg-green-900 text-green-200'
                  : 'bg-amber-900 text-amber-200'
              "
              class="rounded-full px-3 py-1 text-xs font-semibold"
              >{{
                loan.checkedInAt ? "Returned" : "Currently checked out"
              }}</span
            >
          </div>
          <div
            class="mt-4 grid gap-3 border-t border-gray-700 pt-4 sm:grid-cols-2"
          >
            <div>
              <dt>Checked out</dt>
              <dd>{{ date(loan.checkedOutAt) }}</dd>
            </div>
            <div>
              <dt>Checked in</dt>
              <dd :class="!loan.checkedInAt && 'text-amber-300'">
                {{
                  loan.checkedInAt ? date(loan.checkedInAt) : "Not returned yet"
                }}
              </dd>
            </div>
          </div>
          <p v-if="loan.note" class="mt-3 rounded-lg bg-gray-800 p-3 text-sm text-gray-300">
            <span class="font-medium text-gray-400">Note:</span> {{ loan.note }}
          </p>
        </article>
      </div>
    </section>
    <ItemEditModal
      v-if="editing"
      :item="item"
      :bins="bins"
      @close="editing = false"
      @saved="refresh"
    /><ItemTransactionModal
      v-if="transacting"
      :item="item"
      :bins="bins"
      @close="transacting = false"
      @saved="refresh"
    />
  </div>
  <div v-else class="text-gray-400">Loading item…</div>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import apiService from "@/services/api";
import ItemEditModal from "@/components/inventory/ItemEditModal.vue";
import ItemTransactionModal from "@/components/inventory/ItemTransactionModal.vue";
import IconButton from "@/components/common/IconButton.vue";
import {
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  PencilSquareIcon,
} from "@heroicons/vue/24/outline";
import type { InventoryBin, InventoryItem, ItemLoan } from "@/types/api";
const route = useRoute(),
  item = ref<(InventoryItem & { loans: ItemLoan[] }) | null>(null),
  bins = ref<InventoryBin[]>([]),
  editing = ref(false),
  transacting = ref(false);
const name = (u: {
    firstName: string;
    lastName: string;
    displayName?: string;
  }) => u.displayName || `${u.firstName} ${u.lastName}`,
  initials = (u?: { firstName: string; lastName: string }) =>
    u ? `${u.firstName[0] || ""}${u.lastName[0] || ""}`.toUpperCase() : "?",
  locationName = (bin: InventoryBin) =>
    `${bin.room ? `${bin.room} · ` : ""}${bin.name}`,
  date = (v: string) =>
    new Date(v).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  duration = (loan: ItemLoan) => {
    const hours = Math.max(
        1,
        Math.round(
          (new Date(loan.checkedInAt || Date.now()).getTime() -
            new Date(loan.checkedOutAt).getTime()) /
            3600000,
        ),
      ),
      days = Math.round(hours / 24);
    return hours < 24
      ? `${hours} ${hours === 1 ? "hour" : "hours"}`
      : `${days} ${days === 1 ? "day" : "days"}`;
  };
async function load() {
  item.value = await apiService.getInventoryItem(route.params.id as string);
  bins.value = await apiService.getInventoryBins();
}
async function refresh() {
  editing.value = transacting.value = false;
  await load();
}
onMounted(load);
</script>
<style scoped>
.card {
  @apply rounded-xl border border-gray-700 bg-gray-800 p-6;
}
.heading {
  @apply mb-5 text-lg font-semibold text-white;
}
dt {
  @apply text-xs font-semibold uppercase text-gray-500;
}
dd {
  @apply mt-1 text-sm text-gray-100;
}
.avatar {
  @apply flex h-10 w-10 items-center justify-center rounded-full bg-blue-900 font-semibold text-blue-200;
}
</style>
