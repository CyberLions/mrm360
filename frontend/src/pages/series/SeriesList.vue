<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">Workshop Series</h1>
        <p class="mt-2 text-sm text-gray-400">
          Manage workshop series with automatic badge rewards for attendance milestones.
        </p>
      </div>
      <div v-if="canCreate" class="mt-4 sm:mt-0">
        <router-link to="/series/new">
          <BaseButton>
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            New Series
          </BaseButton>
        </router-link>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="seriesStore.isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="seriesStore.seriesList.length === 0" class="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
      <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-200">No workshop series yet</h3>
      <p class="mt-2 text-sm text-gray-400">Create a series to group workshops and reward attendance with badges.</p>
      <div v-if="canCreate" class="mt-6">
        <router-link to="/series/new">
          <BaseButton>Create First Series</BaseButton>
        </router-link>
      </div>
    </div>

    <!-- Series Cards -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="series in seriesStore.seriesList"
        :key="series.id"
        class="bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
      >
        <div class="p-6">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-gray-100 truncate">{{ series.name }}</h3>
              <p v-if="series.description" class="mt-1 text-sm text-gray-400 line-clamp-2">{{ series.description }}</p>
            </div>
          </div>

          <div class="mt-4 space-y-2">
            <div class="flex items-center text-sm text-gray-400">
              <svg class="w-4 h-4 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
              </svg>
              Badge after {{ series.requiredCheckIns }} check-in{{ series.requiredCheckIns !== 1 ? 's' : '' }}
            </div>
            <div class="flex items-center text-sm text-gray-400">
              <svg class="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              {{ series.events?.length || 0 }} workshop{{ (series.events?.length || 0) !== 1 ? 's' : '' }}
            </div>
          </div>
        </div>

        <div class="px-6 py-3 bg-gray-750 border-t border-gray-700 flex justify-end items-center rounded-b-lg">
          <div class="flex items-center space-x-2">
            <IconButton :icon="EyeIcon" label="View series details" :to="`/series/${series.id}`" variant="primary" />
            <IconButton v-if="canCreate" :icon="PencilSquareIcon" label="Edit series" :to="`/series/${series.id}/edit`" />
            <IconButton v-if="canCreate" :icon="TrashIcon" label="Delete series" variant="danger" @click="handleDelete(series)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSeriesStore } from '@/stores/seriesStore'
import { usePermissions } from '@/composables/usePermissions'
import BaseButton from '@/components/common/BaseButton.vue'
import IconButton from '@/components/common/IconButton.vue'
import { EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline'
import type { WorkshopSeries } from '@/types/api'

const seriesStore = useSeriesStore()
const permissions = usePermissions()
const canCreate = permissions.isExecBoard()

onMounted(async () => {
  await seriesStore.fetchAllSeries()
})

const handleDelete = async (series: WorkshopSeries) => {
  if (!confirm(`Delete "${series.name}"? Workshops will be unlinked but not deleted.`)) return
  try {
    await seriesStore.deleteSeries(series.id)
  } catch (err) {
    console.error('Failed to delete series:', err)
  }
}
</script>
