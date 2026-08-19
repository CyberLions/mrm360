<template>
  <div class="min-h-screen bg-gray-950 text-white dark">
    <header class="border-b border-gray-800 bg-gray-900 shadow-lg">
      <div class="mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <img src="@/assets/logo.png" alt="CCSO MRM Logo" class="h-9 w-auto flex-shrink-0" />
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-widest text-blue-400">Kiosk view</p>
            <h1 class="truncate text-base font-semibold text-gray-100 sm:text-lg">
              {{ route.meta.title }}
            </h1>
          </div>
        </div>

        <router-link
          :to="exitTo"
          class="ml-4 inline-flex flex-shrink-0 items-center rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Exit kiosk
        </router-link>
      </div>
    </header>

    <main class="p-4 sm:p-6">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const exitTo = computed(() => {
  if (route.name === 'EventCheckIn') {
    return { name: 'EventDetails', params: { id: route.params.id } }
  }

  return { name: 'Inventory' }
})
</script>
