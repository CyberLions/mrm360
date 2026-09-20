<template>
  <div
    class="min-h-screen bg-gray-950 px-4 py-6 text-white sm:py-10 pb-[env(safe-area-inset-bottom)]"
  >
    <div class="mx-auto w-full max-w-2xl space-y-5">
      <div class="flex items-center gap-3">
        <img src="@/assets/logo.png" alt="CCSO logo" class="h-10 w-auto" />
        <div class="min-w-0">
          <p
            class="text-xs font-semibold uppercase tracking-widest text-blue-400"
          >
            {{ kindLabel }}
          </p>
          <h1 class="truncate text-2xl font-bold">{{ title }}</h1>
          <p v-if="subtitle" class="text-sm text-gray-400">{{ subtitle }}</p>
        </div>
      </div>

      <section
        class="space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-5"
      >
        <h2 class="text-lg font-semibold">Checking items in and out</h2>
        <ol class="space-y-3 text-sm text-gray-300">
          <li class="flex gap-3">
            <span class="badge">1</span>
            <span
              ><strong class="text-gray-100">Check out:</strong> open the kiosk,
              choose <em>Self checkout</em>, then scan the barcode on the item
              you're taking.</span
            >
          </li>
          <li class="flex gap-3">
            <span class="badge">2</span>
            <span
              ><strong class="text-gray-100">Check in:</strong> put the item
              back in its bin, then scan it at the kiosk under
              <em>Check In</em>.</span
            >
          </li>
        </ol>
        <router-link
          to="/inventory/kiosk"
          class="flex min-h-12 touch-manipulation items-center justify-center rounded-lg bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500"
        >
          <QrCodeIcon class="mr-2 h-5 w-5" />Open the check-in / check-out
          kiosk
        </router-link>
        <p class="text-xs text-gray-500">
          Property of the Competitive Cyber Security Organization. Not properly
          checking items in and out is theft.
        </p>
      </section>

      <div v-if="loading" class="flex justify-center py-10">
        <div
          class="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-500"
        ></div>
      </div>

      <div
        v-else-if="error"
        class="rounded-2xl border border-red-800/60 bg-red-900/30 p-5 text-red-200"
        role="alert"
      >
        {{ error }}
      </div>

      <template v-else-if="location">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-gray-300">
            <strong class="text-gray-100">{{ location.totals.items }}</strong>
            {{ location.totals.items === 1 ? "item" : "items" }} here ·
            <strong class="text-green-300">{{
              location.totals.available
            }}</strong>
            available
          </p>
          <input
            v-model="search"
            type="search"
            placeholder="Search this location…"
            class="min-h-10 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 sm:w-64"
            aria-label="Search this location"
          />
        </div>

        <section
          v-for="group in groups"
          :key="group.key"
          class="space-y-3"
        >
          <h2
            v-if="group.heading"
            class="text-sm font-semibold uppercase tracking-wider text-gray-400"
          >
            {{ group.heading }}
          </h2>
          <div
            v-for="bin in group.bins"
            :key="bin.id"
            class="overflow-hidden rounded-2xl border border-gray-700 bg-gray-900"
          >
            <div class="border-b border-gray-800 px-4 py-3">
              <h3 class="font-medium text-gray-100">{{ bin.name }}</h3>
              <p v-if="bin.description" class="text-xs text-gray-500">
                {{ bin.description }}
              </p>
            </div>
            <ul v-if="bin.items.length" class="divide-y divide-gray-800">
              <li
                v-for="item in bin.items"
                :key="item.id"
                class="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-gray-100">
                    {{ item.name }}
                  </p>
                  <p class="truncate text-xs text-gray-500">
                    <span v-if="item.category">{{ item.category }} · </span
                    ><code>{{ item.barcode }}</code>
                  </p>
                </div>
                <span
                  class="flex-none rounded-full px-2.5 py-1 text-xs font-semibold"
                  :class="statusStyle[item.status].class"
                  >{{ statusStyle[item.status].label }}</span
                >
              </li>
            </ul>
            <p v-else class="px-4 py-3 text-sm text-gray-500">
              {{ search ? "No matching items." : "Nothing in this bin." }}
            </p>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { QrCodeIcon } from "@heroicons/vue/24/outline";
import apiService from "@/services/api";
import type { InventoryLocationBin, InventoryLocationView } from "@/types/api";

const route = useRoute();
const location = ref<InventoryLocationView | null>(null),
  loading = ref(true),
  error = ref(""),
  search = ref("");

const statusStyle = {
  available: { label: "Available", class: "bg-green-900 text-green-200" },
  "checked-out": { label: "Checked out", class: "bg-amber-900 text-amber-200" },
  "with-you": { label: "With you", class: "bg-blue-900 text-blue-200" },
  lost: { label: "Reported lost", class: "bg-red-900 text-red-200" },
} as const;

// Query values can arrive as arrays if the URL repeats a key; take the first.
const param = (value: unknown): string | null => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.trim() ? first.trim() : null;
};
const room = computed(() => param(route.query.room)),
  shelf = computed(() => param(route.query.shelf)),
  binId = computed(() => param(route.query.bin));

// A bin QR carries only the bin id, so its name/room/shelf come from the response.
const isBin = computed(() => !!binId.value);
const isShelf = computed(() => !isBin.value && !!shelf.value);
const kindLabel = computed(() => (isBin.value ? "Bin" : isShelf.value ? "Shelf" : "Room"));
const title = computed(() => {
  if (isBin.value) return location.value?.bins[0]?.name || "Bin";
  return isShelf.value ? `Shelf ${shelf.value}` : room.value || "Inventory location";
});
const subtitle = computed(() => {
  if (isBin.value) {
    const view = location.value;
    return [view?.room, view?.shelf ? `Shelf ${view.shelf}` : null].filter(Boolean).join(" · ") || null;
  }
  return isShelf.value ? room.value : null;
});

// A room view groups bins under their shelf; a shelf view is one group.
const groups = computed(() => {
  if (!location.value) return [];
  const q = search.value.trim().toLowerCase();
  const bins: InventoryLocationBin[] = location.value.bins
    .map((bin) => ({
      ...bin,
      items: q
        ? bin.items.filter((i) =>
            [i.name, i.barcode, i.category].some((v) =>
              v?.toLowerCase().includes(q),
            ),
          )
        : bin.items,
    }))
    // While searching, hide bins with no hits so results are easy to scan.
    .filter((bin) => !q || bin.items.length);
  const byShelf = new Map<string, InventoryLocationBin[]>();
  for (const bin of bins) {
    const key = bin.shelf ?? "";
    byShelf.set(key, [...(byShelf.get(key) ?? []), bin]);
  }
  return [...byShelf.entries()].map(([key, shelfBins]) => ({
    key,
    heading: isShelf.value || isBin.value ? "" : key ? `Shelf ${key}` : "No shelf",
    bins: shelfBins,
  }));
});

async function load() {
  loading.value = true;
  error.value = "";
  location.value = null;
  try {
    location.value = await apiService.getInventoryLocation({
      room: room.value,
      shelf: shelf.value,
      binId: binId.value,
    });
  } catch (e: any) {
    error.value =
      e.response?.status === 404
        ? "We couldn't find that bin, shelf or room. The label may be out of date."
        : e.response?.data?.error || "Could not load this location";
  } finally {
    loading.value = false;
  }
}

watch([room, shelf, binId], load);
onMounted(load);
</script>

<style scoped>
.badge {
  @apply flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-900/60 text-xs font-semibold text-blue-300;
}
</style>
