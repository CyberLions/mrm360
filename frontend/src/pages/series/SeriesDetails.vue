<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">{{ series?.name || 'Loading...' }}</h1>
          <p v-if="series?.description" class="mt-2 text-sm text-gray-400">{{ series.description }}</p>
        </div>
        <div class="flex items-center space-x-3">
          <router-link v-if="canEdit" :to="`/series/${seriesId}/edit`">
            <BaseButton variant="outline">Edit Series</BaseButton>
          </router-link>
          <router-link to="/series">
            <BaseButton variant="outline">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back
            </BaseButton>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="seriesStore.isLoading && !series" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>

    <template v-else-if="series">
      <!-- Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div class="text-sm text-gray-400">Required Check-ins</div>
          <div class="mt-1 text-2xl font-bold text-gray-100">{{ series.requiredCheckIns }}</div>
        </div>
        <div class="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div class="text-sm text-gray-400">Workshops</div>
          <div class="mt-1 text-2xl font-bold text-gray-100">{{ progressEvents.length }}</div>
        </div>
        <div class="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div class="text-sm text-gray-400">Total Participants</div>
          <div class="mt-1 text-2xl font-bold text-gray-100">{{ progressMembers.length }}</div>
        </div>
        <div class="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div class="text-sm text-gray-400">Badge Status</div>
          <div class="mt-2 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-xs text-green-400">Issued</span>
              <span class="text-sm font-bold text-green-400">{{ issuedCount }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-yellow-400">Invited</span>
              <span class="text-sm font-bold text-yellow-400">{{ invitedCount }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">Completed</span>
              <span class="text-sm font-bold text-gray-300">{{ completedCount }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Badge Mode Indicator -->
      <div class="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div :class="[
            'w-3 h-3 rounded-full',
            series.autoIssue ? 'bg-green-500' : 'bg-yellow-500'
          ]"></div>
          <span class="text-sm text-gray-300">
            Badge invite mode: <strong class="text-gray-100">{{ series.autoIssue ? 'Automatic' : 'Manual' }}</strong>
          </span>
          <span class="text-xs text-gray-500">
            {{ series.autoIssue
              ? '-- badge invites are sent automatically when members reach the required check-ins'
              : '-- use the invite button next to each member to send badge invites' }}
          </span>
        </div>
        <router-link v-if="canEdit" :to="`/series/${seriesId}/edit`" class="text-xs text-blue-400 hover:text-blue-300">
          Change
        </router-link>
      </div>

      <!-- Workshops in this Series -->
      <div class="bg-gray-800 rounded-lg border border-gray-700">
        <div class="px-6 py-4 border-b border-gray-700">
          <h2 class="text-lg font-medium text-gray-100">Workshops</h2>
        </div>
        <div v-if="progressEvents.length === 0" class="p-6 text-center text-gray-400">
          No workshops assigned to this series yet.
        </div>
        <div v-else class="divide-y divide-gray-700">
          <router-link
            v-for="event in progressEvents"
            :key="event.id"
            :to="`/events/${event.id}`"
            class="flex items-center justify-between px-6 py-4 hover:bg-gray-750 transition-colors"
          >
            <div>
              <div class="text-sm font-medium text-gray-100">{{ event.title }}</div>
              <div class="text-xs text-gray-400">{{ formatDate(event.startTime) }}</div>
            </div>
            <div class="text-sm text-gray-400">
              {{ eventCheckInCounts[event.id] || 0 }} check-ins
            </div>
          </router-link>
        </div>
      </div>

      <!-- Member Progress -->
      <div class="bg-gray-800 rounded-lg border border-gray-700">
        <div class="px-6 py-4 border-b border-gray-700">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 class="text-lg font-medium text-gray-100">Member Progress</h2>
            <div class="flex flex-col sm:flex-row gap-3">
              <!-- Search -->
              <input
                v-model="memberSearch"
                type="text"
                placeholder="Search members..."
                class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <!-- Status filter -->
              <select
                v-model="statusFilter"
                class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Members</option>
                <option value="completed">Completed (all)</option>
                <option value="needs_invite">Needs Invite</option>
                <option value="invited">Invited</option>
                <option value="issued">Issued</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="loadingProgress" class="p-8 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p class="mt-3 text-sm text-gray-400">Loading member progress...</p>
        </div>

        <div v-else-if="filteredMembers.length === 0" class="p-8 text-center text-gray-400">
          <svg class="mx-auto h-12 w-12 text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          <template v-if="progressMembers.length === 0">
            No members have checked in to any workshops in this series yet.
          </template>
          <template v-else>
            No members match your filters.
          </template>
        </div>

        <div v-else class="overflow-x-auto [contain:layout]">
          <table class="min-w-full divide-y divide-gray-700">
            <thead class="bg-gray-750">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Member</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Progress</th>
                <!-- One column per workshop -->
                <th
                  v-for="event in progressEvents"
                  :key="event.id"
                  class="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap"
                  :title="event.title"
                >
                  <div class="max-w-[80px] truncate">{{ shortTitle(event.title) }}</div>
                  <div class="text-[10px] text-gray-500 font-normal normal-case">{{ shortDate(event.startTime) }}</div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                <th v-if="canEdit" class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Invite</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              <tr
                v-for="member in filteredMembers"
                :key="member.userId"
                class="hover:bg-gray-750 transition-colors"
              >
                <!-- Member info -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <router-link :to="`/users/${member.userId}`" class="group">
                    <div class="text-sm font-medium text-gray-100 group-hover:text-blue-400">
                      {{ member.firstName }} {{ member.lastName }}
                    </div>
                    <div class="text-xs text-gray-400">{{ member.email }}</div>
                  </router-link>
                </td>

                <!-- Progress bar -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center space-x-3">
                    <div class="flex-1 w-24">
                      <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          class="h-2 rounded-full transition-all"
                          :class="member.completed ? 'bg-green-500' : 'bg-blue-500'"
                          :style="{ width: Math.min(100, (member.checkInCount / member.requiredCheckIns) * 100) + '%' }"
                        ></div>
                      </div>
                    </div>
                    <span class="text-xs text-gray-400 whitespace-nowrap">
                      {{ member.checkInCount }}/{{ member.requiredCheckIns }}
                    </span>
                  </div>
                </td>

                <!-- Per-workshop check marks -->
                <td
                  v-for="event in progressEvents"
                  :key="event.id"
                  class="px-3 py-4 text-center"
                >
                  <svg
                    v-if="member.checkedInEventIds.includes(event.id)"
                    class="w-5 h-5 text-green-400 mx-auto"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <svg
                    v-else
                    class="w-5 h-5 text-gray-600 mx-auto"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </td>

                <!-- Status badge -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      member.completed
                        ? 'bg-green-900 text-green-200'
                        : 'bg-blue-900 text-blue-200'
                    ]"
                  >
                    {{ member.completed ? 'Completed' : 'In Progress' }}
                  </span>
                </td>

                <!-- Badge invite button -->
                <td v-if="canEdit" class="px-4 py-4 text-center whitespace-nowrap">
                  <IconButton
                    v-if="member.completed && !issuedUsers.has(member.userId)"
                    @click="sendBadgeInvite(member)"
                    :disabled="issuingFor === member.userId"
                    :icon="issuingFor === member.userId ? ArrowPathIcon : EnvelopeIcon"
                    label="Send badge invite"
                    variant="primary"
                  />
                  <span
                    v-else-if="member.badgeStatus === 'issued'"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200"
                  >
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Issued
                  </span>
                  <span
                    v-else-if="member.badgeStatus === 'invited' || issuedUsers.has(member.userId)"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-200"
                  >
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                    </svg>
                    Invited
                  </span>
                  <span v-else class="text-xs text-gray-500">--</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Summary footer -->
        <div v-if="filteredMembers.length > 0" class="px-6 py-3 border-t border-gray-700 text-sm text-gray-400">
          Showing {{ filteredMembers.length }} of {{ progressMembers.length }} members
        </div>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSeriesStore } from '@/stores/seriesStore'
import { usePermissions } from '@/composables/usePermissions'
import BaseButton from '@/components/common/BaseButton.vue'
import IconButton from '@/components/common/IconButton.vue'
import apiService from '@/services/api'
import { ArrowPathIcon, EnvelopeIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const seriesStore = useSeriesStore()
const permissions = usePermissions()
const canEdit = permissions.isExecBoard()
const loadingProgress = ref(false)
const issuingFor = ref<string | null>(null)
const issuedUsers = ref(new Set<string>())

const seriesId = computed(() => route.params.id as string)
const series = computed(() => seriesStore.currentSeries)

// Progress data
const progressMembers = ref<any[]>([])
const progressEvents = ref<{ id: string; title: string; startTime: string }[]>([])

// Filters
const memberSearch = ref('')
const statusFilter = ref<'all' | 'completed' | 'needs_invite' | 'invited' | 'issued' | 'in_progress'>('all')

const completedCount = computed(() =>
  progressMembers.value.filter(m => m.completed).length
)

const issuedCount = computed(() =>
  progressMembers.value.filter(m => m.badgeStatus === 'issued').length
)

const invitedCount = computed(() =>
  progressMembers.value.filter(m => m.badgeStatus === 'invited').length
)

const eventCheckInCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const event of progressEvents.value) {
    counts[event.id] = progressMembers.value.filter(m =>
      m.checkedInEventIds.includes(event.id)
    ).length
  }
  return counts
})

const filteredMembers = computed(() => {
  let result = progressMembers.value

  if (statusFilter.value === 'completed') {
    result = result.filter(m => m.completed)
  } else if (statusFilter.value === 'needs_invite') {
    result = result.filter(m => m.completed && m.badgeStatus === 'none' && !issuedUsers.value.has(m.userId))
  } else if (statusFilter.value === 'invited') {
    result = result.filter(m => m.badgeStatus === 'invited' || (issuedUsers.value.has(m.userId) && m.badgeStatus !== 'issued'))
  } else if (statusFilter.value === 'issued') {
    result = result.filter(m => m.badgeStatus === 'issued')
  } else if (statusFilter.value === 'in_progress') {
    result = result.filter(m => !m.completed)
  }

  if (memberSearch.value.trim()) {
    const q = memberSearch.value.toLowerCase()
    result = result.filter(m =>
      m.firstName.toLowerCase().includes(q) ||
      m.lastName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    )
  }

  return result
})

onMounted(async () => {
  await seriesStore.fetchSeries(seriesId.value)
  await loadProgress()
})

const loadProgress = async () => {
  loadingProgress.value = true
  try {
    const response = await apiService.getSeriesProgress(seriesId.value)
    progressMembers.value = response.data.members ?? []
    progressEvents.value = response.data.events ?? []
    // Pre-populate badge status from backend
    for (const member of progressMembers.value) {
      if (member.badgeStatus === 'invited' || member.badgeStatus === 'issued') {
        issuedUsers.value.add(member.userId)
      }
    }
  } catch (err) {
    console.error('Failed to load series progress:', err)
  } finally {
    loadingProgress.value = false
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const shortDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const shortTitle = (title: string) => {
  return title.length > 12 ? title.slice(0, 12) + '...' : title
}

const sendBadgeInvite = async (member: any) => {
  issuingFor.value = member.userId
  try {
    await apiService.sendSeriesBadgeInvite(seriesId.value, member.userId)
    issuedUsers.value.add(member.userId)
  } catch (err: any) {
    const msg = err?.response?.data?.error || 'Failed to send badge invite'
    if (msg.includes('already')) {
      issuedUsers.value.add(member.userId)
    }
    console.error('Failed to send badge invite:', msg)
  } finally {
    issuingFor.value = null
  }
}

</script>
