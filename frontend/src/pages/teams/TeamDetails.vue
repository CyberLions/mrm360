<template>
  <div class="space-y-6">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-100">{{ team?.name }}</h1>
            <p v-if="team?.description" class="mt-2 text-sm text-gray-400">{{ team.description }}</p>
          </div>
          <div class="flex space-x-3">
            <router-link
              to="/teams"
              class="inline-flex items-center px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to Teams
            </router-link>
            
            <BaseButton
              v-if="canEdit"
              @click="editTeam"
              variant="primary"
            >
              Edit Team
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>

      <!-- Team Details -->
      <div v-else-if="team" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Team Information Card -->
          <div class="bg-gray-800 rounded-lg shadow border border-gray-700">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">Team Information</h3>
              
              <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt class="text-sm font-medium text-gray-400">Team Type</dt>
                  <dd class="mt-1">
                    <div class="flex items-center space-x-2">
                      <span class="px-2 py-1 bg-blue-900 text-blue-200 rounded-full text-xs font-medium">
                        {{ team.type }}
                      </span>
                      <span v-if="team.subtype" class="px-2 py-1 bg-green-900 text-green-200 rounded-full text-xs font-medium">
                        {{ team.subtype }}
                      </span>
                    </div>
                  </dd>
                </div>
                
                <div>
                  <dt class="text-sm font-medium text-gray-400">Created</dt>
                  <dd class="mt-1 text-sm text-gray-100">{{ formatDate(team.createdAt) }}</dd>
                </div>
                
                <div v-if="team.parentTeam">
                  <dt class="text-sm font-medium text-gray-400">Parent Team</dt>
                  <dd class="mt-1 text-sm text-gray-100">{{ team.parentTeam.name }}</dd>
                </div>
                
                <div v-if="team.group">
                  <dt class="text-sm font-medium text-gray-400">Group</dt>
                  <dd class="mt-1 text-sm text-gray-100">{{ team.group.name }}</dd>
                </div>
              </dl>
            </div>
          </div>

          <!-- Team Events Card -->
          <div class="bg-gray-800 rounded-lg shadow border border-gray-700">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
                Team Events
              </h3>
              
              <div v-if="team.events && team.events.length > 0" class="space-y-3">
                <div
                  v-for="event in team.events.slice(0, 5)"
                  :key="event.id"
                  class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                >
                  <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <CalendarIcon class="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p class="text-sm font-medium text-gray-100">{{ event.title }}</p>
                      <p class="text-xs text-gray-400">{{ formatDate(event.startTime) }}</p>
                    </div>
                  </div>
                  
                  <IconButton
                    :to="`/events/${event.id}`"
                    :icon="EyeIcon"
                    label="View event"
                    variant="primary"
                  />
                </div>
              </div>
              
              <div v-else class="text-center py-4">
                <CalendarIcon class="mx-auto h-12 w-12 text-gray-400" />
                <h3 class="mt-2 text-sm font-medium text-gray-100">No events</h3>
                <p class="mt-1 text-sm text-gray-400">
                  This team hasn't hosted any events yet.
                </p>
              </div>
            </div>
          </div>

          <!-- Subteams Card -->
          <div v-if="team.subteams && team.subteams.length > 0" class="bg-gray-800 rounded-lg shadow border border-gray-700">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
                Subteams
              </h3>
              
              <div class="space-y-3">
                <div
                  v-for="subteam in team.subteams"
                  :key="subteam.id"
                  class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                >
                  <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <span class="text-sm font-medium text-white">
                        {{ subteam.name.charAt(0).toUpperCase() }}
                      </span>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-gray-100">{{ subteam.name }}</p>
                      <p class="text-xs text-gray-400">{{ subteam.type }}</p>
                    </div>
                  </div>
                  
                  <IconButton
                    :to="`/teams/${subteam.id}`"
                    :icon="EyeIcon"
                    label="View team"
                    variant="primary"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Team Members Card -->
          <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
                Team Members
              </h3>
              
              <div v-if="team.userTeams && team.userTeams.length > 0" class="space-y-3">
                <div
                  v-for="userTeam in team.userTeams"
                  :key="userTeam.id"
                  class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                >
                  <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span class="text-sm font-medium text-white">
                        {{ getUserInitials(userTeam.user) }}
                      </span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-100 truncate">
                        {{ userTeam.user.displayName || `${userTeam.user.firstName} ${userTeam.user.lastName}` }}
                      </p>
                      <p class="text-xs text-gray-400 truncate">{{ userTeam.user.email }}</p>
                    </div>
                  </div>
                  
                  <div class="flex items-center space-x-2">
                    <span class="px-2 py-1 bg-blue-900 text-blue-200 rounded-full text-xs font-medium">
                      {{ userTeam.role }}
                    </span>
                    <IconButton
                      :to="`/users/${userTeam.user.id}`"
                      :icon="EyeIcon"
                      label="View member"
                      variant="primary"
                    />
                  </div>
                </div>
              </div>
              
              <div v-else class="text-center py-4">
                <UserGroupIcon class="mx-auto h-12 w-12 text-gray-400" />
                <h3 class="mt-2 text-sm font-medium text-gray-100">No members</h3>
                <p class="mt-1 text-sm text-gray-400">
                  This team doesn't have any members yet.
                </p>
              </div>
            </div>
          </div>

          <!-- Quick Stats Card -->
          <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
                Quick Stats
              </h3>
              <dl class="space-y-3">
                <div>
                  <dt class="text-sm font-medium text-gray-400">Team Members</dt>
                  <dd class="mt-1 text-2xl font-semibold text-gray-100">
                    {{ team.userTeams?.length || 0 }}
                  </dd>
                </div>
                
                <div>
                  <dt class="text-sm font-medium text-gray-400">Events</dt>
                  <dd class="mt-1 text-2xl font-semibold text-gray-100">
                    {{ team.events?.length || 0 }}
                  </dd>
                </div>
                
                <div>
                  <dt class="text-sm font-medium text-gray-400">Subteams</dt>
                  <dd class="mt-1 text-2xl font-semibold text-gray-100">
                    {{ team.subteams?.length || 0 }}
                  </dd>
                </div>
                
                <div>
                  <dt class="text-sm font-medium text-gray-400">Days Active</dt>
                  <dd class="mt-1 text-2xl font-semibold text-gray-100">
                    {{ daysActive }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-100">Team not found</h3>
        <p class="mt-1 text-sm text-gray-400">The team you're looking for doesn't exist or has been removed.</p>
        <div class="mt-6">
          <router-link
            to="/teams"
            class="inline-flex items-center px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700"
          >
            Back to Teams
          </router-link>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTeamStore } from '@/stores/teamStore'
import { usePermissions } from '@/composables/usePermissions'
import BaseButton from '@/components/common/BaseButton.vue'
import IconButton from '@/components/common/IconButton.vue'
import type { Team, User } from '@/types/api'
import { CalendarIcon, EyeIcon, UserGroupIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const teamStore = useTeamStore()
const { can } = usePermissions()

// State
const loading = ref(false)
const team = ref<Team | null>(null)

// Computed properties
const canEdit = computed(() => can('update', 'Team'))
const canDelete = computed(() => can('delete', 'Team'))

const daysActive = computed(() => {
  if (!team.value) return 0
  const now = new Date()
  const created = new Date(team.value.createdAt)
  const diffTime = Math.abs(now.getTime() - created.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Methods
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const getUserInitials = (user: User) => {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
}

const editTeam = () => {
  router.push(`/teams/${route.params.id}/edit`)
}

const confirmDelete = async () => {
  if (!team.value) return
  
  if (confirm(`Are you sure you want to delete "${team.value.name}"? This action cannot be undone.`)) {
    try {
      await teamStore.deleteTeam(team.value.id)
      router.push('/teams')
    } catch (error) {
      console.error('Failed to delete team:', error)
    }
  }
}

const loadTeam = async () => {
  try {
    loading.value = true
    const teamData = await teamStore.fetchTeam(route.params.id as string)
    team.value = teamData
  } catch (error) {
    console.error('Failed to load team:', error)
    team.value = null
  } finally {
    loading.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadTeam()
})
</script>
