<template>
  <div
    class="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
    @click.self="$emit('close')"
  >
    <div
      class="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-print-help-title"
    >
      <div class="flex items-start gap-3">
        <div class="rounded-lg bg-blue-900/50 p-2">
          <InformationCircleIcon class="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2
            id="label-print-help-title"
            class="text-xl font-semibold text-white"
          >
            Printing 3″ × 2″ labels on Windows
          </h2>
          <p class="mt-1 text-sm text-gray-400">
            The 3″ × 2″ size isn't a printer preset, so set it up once in the
            system print dialog.
          </p>
        </div>
      </div>

      <a
        :href="DRIVER_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-3 rounded-lg border border-blue-500/40 bg-blue-900/30 p-3 text-sm text-blue-200 hover:bg-blue-900/50"
      >
        <ArrowDownTrayIcon class="h-5 w-5 flex-none text-blue-400" />
        <span>
          <strong class="block text-blue-100"
            >First, download and install the label printer driver</strong
          >
          up.psuccso.org/s/label-printer-driver-win
        </span>
      </a>

      <ol class="space-y-4 text-sm text-gray-300">
        <li class="step">
          <span class="badge">1</span>
          <span>
            Click <strong class="text-gray-100">Open &amp; print</strong> to open
            the PDF, then press
            <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> (or choose
            <strong class="text-gray-100">Print using system dialog…</strong>) to
            open the <strong class="text-gray-100">system dialog</strong>.
          </span>
        </li>
        <li class="step">
          <span class="badge">2</span>
          <span>
            Pick the label printer and open its
            <strong class="text-gray-100">Preferences</strong>.
          </span>
        </li>
        <li class="step">
          <span class="badge">3</span>
          <span>
            Under <strong class="text-gray-100">Paper Name</strong>, choose
            <strong class="text-gray-100">New</strong> (or
            <strong class="text-gray-100">USER</strong>) and create a
            <strong class="text-gray-100">custom 3″ × 2″ label</strong>:
            <span class="mt-1 block text-gray-400"
              >Width 76.2 mm, Height 50.8 mm. Set the paper type to labels with
              gaps and enter your roll's gap height (usually 2–3 mm). Save it as
              “3x2”.</span
            >
          </span>
        </li>
        <li class="step">
          <span class="badge">4</span>
          <span>
            Set the orientation to
            <strong class="text-gray-100">Landscape</strong>, scale to
            <strong class="text-gray-100">100% (actual size)</strong>, and margins
            to <strong class="text-gray-100">None</strong>, then print.
          </span>
        </li>
      </ol>

      <p class="rounded-lg bg-gray-700/50 p-3 text-xs text-gray-400">
        Once “3x2” is saved, next time you only need to open the system dialog,
        select it, and confirm Landscape.
      </p>

      <div class="flex justify-end">
        <button
          class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
          @click="$emit('close')"
        >
          Got it
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowDownTrayIcon,
  InformationCircleIcon,
} from "@heroicons/vue/24/outline";

const DRIVER_URL = "https://up.psuccso.org/s/label-printer-driver-win";

defineEmits<{ close: [] }>();
</script>

<style scoped>
.step {
  @apply flex items-start gap-3;
}
.badge {
  @apply flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-900/60 text-xs font-semibold text-blue-300;
}
kbd {
  @apply rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 font-mono text-xs text-gray-100;
}
</style>
