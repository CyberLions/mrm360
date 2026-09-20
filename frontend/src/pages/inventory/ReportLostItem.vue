<template>
  <div
    class="min-h-screen bg-gray-950 px-4 py-8 text-white sm:py-12 pb-[env(safe-area-inset-bottom)]"
  >
    <div class="mx-auto w-full max-w-md">
      <div class="mb-6 flex items-center gap-3">
        <img src="@/assets/logo.png" alt="CCSO logo" class="h-10 w-auto" />
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Inventory
          </p>
          <h1 class="text-2xl font-bold">Report a lost item</h1>
        </div>
      </div>

      <section
        v-if="result"
        class="space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-6 text-center"
        role="status"
      >
        <CheckCircleIcon class="mx-auto h-14 w-14 text-green-400" />
        <h2 class="text-xl font-semibold">
          {{ result.newlyReported ? "Thanks for letting us know" : "Already reported" }}
        </h2>
        <p class="text-gray-300">
          <template v-if="result.newlyReported">
            <strong>{{ result.itemName }}</strong> has been marked as lost and
            our exec board has been emailed.
          </template>
          <template v-else>
            <strong>{{ result.itemName }}</strong> was already marked as lost,
            so the exec board is already aware.
          </template>
        </p>
        <button
          type="button"
          class="min-h-12 w-full touch-manipulation rounded-lg bg-blue-600 px-4 py-3 font-medium"
          @click="reset"
        >
          Report another item
        </button>
      </section>

      <form
        v-else
        class="space-y-5 rounded-2xl border border-gray-700 bg-gray-900 p-5 sm:p-6"
        @submit.prevent="submit"
      >
        <p class="text-sm text-gray-400">
          Found something with one of our inventory labels, or can't find an item
          you were using? Scan or type the code printed under the barcode and
          we'll let the exec board know.
        </p>

        <div>
          <label for="lost-code" class="label">Label code</label>
          <div class="flex gap-2">
            <input
              id="lost-code"
              ref="codeInput"
              v-model="code"
              type="text"
              inputmode="text"
              autocomplete="off"
              autocapitalize="characters"
              autocorrect="off"
              spellcheck="false"
              placeholder="ITEM-1A2B3C4D5E6F"
              maxlength="100"
              class="field min-w-0 flex-1 font-mono"
            />
            <button
              type="button"
              class="min-h-12 shrink-0 touch-manipulation rounded-lg bg-gray-700 px-4"
              :title="scanning ? 'Close camera' : 'Scan barcode with camera'"
              :aria-label="scanning ? 'Close camera' : 'Scan barcode with camera'"
              :aria-pressed="scanning"
              @click="scanning = !scanning"
            >
              <XMarkIcon v-if="scanning" class="h-6 w-6" />
              <CameraIcon v-else class="h-6 w-6" />
            </button>
          </div>
        </div>

        <CameraCodeScanner
          v-if="scanning"
          format="barcode"
          @scanned="onScanned"
        />

        <div>
          <label for="lost-note" class="label">
            Where was it? <span class="text-gray-500">(optional)</span>
          </label>
          <textarea
            id="lost-note"
            v-model="note"
            rows="3"
            maxlength="500"
            placeholder="e.g. Found on a desk in Westgate 214"
            class="field"
          ></textarea>
        </div>

        <div>
          <label for="lost-contact" class="label">
            Your name or contact <span class="text-gray-500">(optional)</span>
          </label>
          <input
            id="lost-contact"
            v-model="contact"
            type="text"
            autocomplete="off"
            maxlength="200"
            placeholder="So we can follow up"
            class="field"
          />
        </div>

        <p v-if="error" class="rounded-lg bg-red-900/60 p-3 text-sm text-red-100" role="alert">
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="!code.trim() || submitting"
          class="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-medium disabled:opacity-50"
        >
          <ArrowPathIcon v-if="submitting" class="h-5 w-5 animate-spin" />
          {{ submitting ? "Reporting…" : "Report as lost" }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import apiService from "@/services/api";
import CameraCodeScanner from "@/components/inventory/CameraCodeScanner.vue";
import {
  ArrowPathIcon,
  CameraIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";

const route = useRoute();
const code = ref(typeof route.query.code === "string" ? route.query.code : "");
const note = ref("");
const contact = ref("");
const scanning = ref(false);
const submitting = ref(false);
const error = ref("");
const result = ref<{ itemName: string; newlyReported: boolean } | null>(null);
const codeInput = ref<HTMLInputElement>();

onMounted(() => {
  // Hardware scanners type into the focused field, so start there. Skip on touch
  // devices, where autofocus would just pop the keyboard over the page.
  if (!code.value && !window.matchMedia("(pointer: coarse)").matches) {
    codeInput.value?.focus();
  }
});

function onScanned(value: string) {
  code.value = value.trim();
  scanning.value = false;
}

function reset() {
  result.value = null;
  code.value = "";
  note.value = "";
  contact.value = "";
  error.value = "";
}

async function submit() {
  if (submitting.value || !code.value.trim()) return;
  submitting.value = true;
  error.value = "";
  try {
    result.value = await apiService.reportInventoryItemLost({
      code: code.value.trim(),
      note: note.value.trim() || undefined,
      contact: contact.value.trim() || undefined,
    });
  } catch (e: any) {
    error.value =
      e.response?.data?.error ||
      "Something went wrong. Please check your connection and try again.";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.label {
  @apply mb-1 block text-sm font-medium text-gray-300;
}
.field {
  @apply w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-3 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500;
}
</style>
