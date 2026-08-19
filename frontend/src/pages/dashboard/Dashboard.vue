<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-100">Dashboard</h1>
      <p class="mt-1 text-sm text-gray-400">
        Welcome back, {{ authStore.user?.displayName }}! Here's what's happening with CCSO.
      </p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="stat in dashboardStats"
        :key="stat.name"
        class="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700"
      >
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <component
                :is="stat.icon"
                :class="[
                  'h-6 w-6',
                  stat.iconColor
                ]"
              />
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-400 truncate">
                  {{ stat.name }}
                </dt>
                <dd class="text-lg font-medium text-gray-100">
                  {{ stat.value }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
        <div class="bg-gray-700 px-5 py-3">
          <div class="text-sm">
            <IconButton
              :to="stat.href"
              :icon="ArrowRightIcon"
              :label="`View all ${stat.name}`"
              variant="primary"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Role-based Content -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
      <!-- Status Overview Widget (Non-Admin Users Only) -->
      <div v-if="!isAdminOrExecBoard" class="bg-gray-800 shadow rounded-lg border border-gray-700 flex flex-col">
        <div class="px-4 py-5 sm:p-6 flex-1">
          <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
            Your Status
          </h3>
          <div class="space-y-4">
            <!-- Account Status -->
            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <UserIcon class="w-4 h-4 text-white" />
                  </div>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-gray-100">Account Status</p>
                  <p class="text-sm text-gray-400">
                    {{ authStore.user?.isActive ? 'Active' : 'Inactive' }}
                  </p>
                </div>
              </div>
              <div class="flex-shrink-0">
                <span 
                  :class="[
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    authStore.user?.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  ]"
                >
                  {{ authStore.user?.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
            </div>

            <!-- Payment Status -->
            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <CurrencyDollarIcon class="w-4 h-4 text-white" />
                  </div>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-gray-100">Payment Status</p>
                  <p class="text-sm text-gray-400">
                    {{ authStore.user?.paidStatus ? 'Paid' : 'Unpaid' }}
                  </p>
                </div>
              </div>
              <div class="flex-shrink-0">
                <span 
                  :class="[
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    authStore.user?.paidStatus 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  ]"
                >
                  {{ authStore.user?.paidStatus ? 'Paid' : 'Unpaid' }}
                </span>
              </div>
            </div>

            <!-- Member Since -->
            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                    <CalendarIcon class="w-4 h-4 text-white" />
                  </div>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-gray-100">Member Since</p>
                  <p class="text-sm text-gray-400">
                    {{ authStore.user?.createdAt ? formatDate(authStore.user.createdAt) : 'Unknown' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-700 px-4 py-3 border-t border-gray-600 mt-auto">
          <IconButton
            to="/profile"
            :icon="QrCodeIcon"
            label="View Profile QR"
            variant="primary"
          />
        </div>
      </div>

      <!-- Upcoming Events Widget (All Users) -->
      <div class="bg-gray-800 shadow rounded-lg border border-gray-700 flex flex-col">
        <div class="px-4 py-5 sm:p-6 flex-1">
          <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
            Upcoming & Ongoing Events
          </h3>
          <div v-if="upcomingEvents.length > 0" class="space-y-3">
            <div
              v-for="event in upcomingEvents.slice(0, 5)"
              :key="event.id"
              class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium text-gray-100 truncate">
                    {{ event.title }}
                  </p>
                  <span 
                    v-if="isEventOngoing(event)"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200"
                  >
                    Ongoing
                  </span>
                </div>
                <p class="text-sm text-gray-400">
                  {{ formatDate(event.startTime) }}
                </p>
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
            <h3 class="mt-2 text-sm font-medium text-gray-100">No upcoming or ongoing events</h3>
            <p class="mt-1 text-sm text-gray-400">
              Get started by creating a new event.
            </p>
          </div>
        </div>
        <div class="bg-gray-700 px-4 py-3 border-t border-gray-600 mt-auto">
          <IconButton
            to="/events"
            :icon="ArrowRightIcon"
            label="View all events"
            variant="primary"
          />
        </div>
      </div>

      <!-- Admin/Exec Board Widgets -->
      <template v-if="isAdminOrExecBoard">
        <!-- Teams Widget (Admin/Exec Board) -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700 flex flex-col">
          <div class="px-4 py-5 sm:p-6 flex-1">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Teams Overview
            </h3>
            <div v-if="teamStore.teams.length > 0" class="space-y-3">
              <div
                v-for="team in teamStore.teams.slice(0, 5)"
                :key="team.id"
                class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600"
              >
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-100 truncate">
                    {{ team.name }}
                  </p>
                  <p class="text-sm text-gray-400">
                    {{ team.type }} • {{ team.userTeams?.length || 0 }} members
                  </p>
                </div>
                <IconButton
                  :to="`/teams/${team.id}`"
                  :icon="EyeIcon"
                  label="View team"
                  variant="primary"
                />
              </div>
            </div>
            <div v-else class="text-center py-4">
              <UserGroupIcon class="mx-auto h-12 w-12 text-gray-400" />
              <h3 class="mt-2 text-sm font-medium text-gray-100">No teams created</h3>
              <p class="mt-1 text-sm text-gray-400">
                Get started by creating a new team.
              </p>
            </div>
          </div>
          <div class="bg-gray-700 px-4 py-3 border-t border-gray-600 mt-auto">
            <IconButton
              to="/teams"
              :icon="ArrowRightIcon"
              label="View all teams"
              variant="primary"
            />
          </div>
        </div>

        <!-- Users Widget (Admin/Exec Board) -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700 flex flex-col">
          <div class="px-4 py-5 sm:p-6 flex-1">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Recent Members
            </h3>
            <div v-if="recentUsers.length > 0" class="space-y-3">
              <div
                v-for="user in recentUsers.slice(0, 5)"
                :key="user.id"
                class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600"
              >
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-8 w-8">
                    <div class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <span class="text-white text-sm font-medium">
                        {{ getUserInitials(user) }}
                      </span>
                    </div>
                  </div>
                  <div class="ml-3">
                    <p class="text-sm font-medium text-gray-100">
                      {{ user.displayName }}
                    </p>
                    <p class="text-sm text-gray-400">
                      {{ user.email }}
                    </p>
                  </div>
                </div>
                <IconButton
                  :to="`/users/${user.id}`"
                  :icon="EyeIcon"
                  label="View member"
                  variant="primary"
                />
              </div>
            </div>
            <div v-else class="text-center py-4">
              <UsersIcon class="mx-auto h-12 w-12 text-gray-400" />
              <h3 class="mt-2 text-sm font-medium text-gray-100">No recent members</h3>
              <p class="mt-1 text-sm text-gray-400">
                Get started by adding a new member.
              </p>
            </div>
          </div>
          <div class="bg-gray-700 px-4 py-3 border-t border-gray-600 mt-auto">
            <IconButton
              to="/users"
              :icon="ArrowRightIcon"
              label="View all members"
              variant="primary"
            />
          </div>
        </div>
      </template>

      <!-- Regular Member Widgets -->
      <template v-else>
        <!-- My Teams Widget (Regular Members) -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700 flex flex-col">
          <div class="px-4 py-5 sm:p-6 flex-1">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              My Teams
            </h3>
            <div v-if="userTeams.length > 0" class="space-y-3">
              <div
                v-for="team in userTeams.slice(0, 5)"
                :key="team.id"
                class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600"
              >
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-100 truncate">
                    {{ team.name }}
                  </p>
                  <p class="text-sm text-gray-400">
                    {{ team.type }}
                  </p>
                </div>
                <IconButton
                  :to="`/teams/${team.id}`"
                  :icon="EyeIcon"
                  label="View team"
                  variant="primary"
                />
              </div>
            </div>
            <div v-else class="text-center py-4">
              <UserGroupIcon class="mx-auto h-12 w-12 text-gray-400" />
              <h3 class="mt-2 text-sm font-medium text-gray-100">No teams assigned</h3>
              <p class="mt-1 text-sm text-gray-400">
                Contact an administrator to get assigned to a team.
              </p>
            </div>
          </div>
          <div class="bg-gray-700 px-4 py-3 border-t border-gray-600 mt-auto">
            <IconButton
              to="/teams"
              :icon="ArrowRightIcon"
              label="View all teams"
              variant="primary"
            />
          </div>
        </div>


        <!-- Events Attended Widget (Regular Members) -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700 flex flex-col">
          <div class="px-4 py-5 sm:p-6 flex-1">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Events Attended
            </h3>
            <div v-if="attendedEvents.length > 0" class="space-y-3">
              <div
                v-for="event in attendedEvents.slice(0, 5)"
                :key="event.id"
                class="flex items-center justify-between p-3 bg-gray-700 rounded-md border border-gray-600"
              >
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-100 truncate">
                    {{ event.title }}
                  </p>
                  <p class="text-sm text-gray-400">
                    {{ formatDate(event.startTime) }}
                  </p>
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
              <h3 class="mt-2 text-sm font-medium text-gray-100">No events attended</h3>
              <p class="mt-1 text-sm text-gray-400">
                Check out upcoming events to get involved.
              </p>
            </div>
          </div>
          <div class="bg-gray-700 px-4 py-3 border-t border-gray-600 mt-auto">
            <IconButton
              to="/events"
              :icon="ArrowRightIcon"
              label="View all events"
              variant="primary"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import { useEventStore } from '@/stores/eventStore'
import { useTeamStore } from '@/stores/teamStore'
import apiService from '@/services/api'
import IconButton from '@/components/common/IconButton.vue'

import { initiateOAuthLogin } from '@/utils/oauth'
import {
  UsersIcon,
  UserGroupIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserIcon,
  ArrowRightIcon,
  EyeIcon,
  QrCodeIcon
} from '@heroicons/vue/24/outline'
import type { User, DashboardStats } from '@/types/api'

const authStore = useAuthStore()
const userStore = useUserStore()
const eventStore = useEventStore()
const teamStore = useTeamStore()

// Dashboard stats from API
const dashboardStatsData = ref<DashboardStats | null>(null)

// Check if user is admin or exec board
const isAdminOrExecBoard = computed(() => {
  return authStore.isAdmin || authStore.isExecBoard
})

// Dashboard stats - role-based
const dashboardStats = computed(() => {
  const stats = []
  
  if (isAdminOrExecBoard.value) {
    // Admin/Exec Board stats - use API data for total counts
    stats.push({
      name: 'Total Members',
      value: dashboardStatsData.value?.totalMembers ?? userStore.users.length,
      icon: UsersIcon,
      iconColor: 'text-blue-600',
      href: '/users'
    })
    
    stats.push({
      name: 'Total Teams',
      value: dashboardStatsData.value?.totalTeams ?? teamStore.teams.length,
      icon: UserGroupIcon,
      iconColor: 'text-green-600',
      href: '/teams'
    })
    
    stats.push({
      name: 'Paid Members',
      value: dashboardStatsData.value?.paidMembers ?? userStore.users.filter(u => u.isPaid).length,
      icon: CurrencyDollarIcon,
      iconColor: 'text-yellow-600',
      href: '/users'
    })
    
    stats.push({
      name: 'Upcoming & Ongoing Events',
      value: dashboardStatsData.value?.upcomingEvents ?? upcomingEvents.value.length,
      icon: CalendarIcon,
      iconColor: 'text-purple-600',
      href: '/events'
    })
  } else {
    // Regular member stats - use API data for upcoming events, local data for personal stats
    stats.push({
      name: 'Upcoming & Ongoing Events',
      value: dashboardStatsData.value?.upcomingEvents ?? upcomingEvents.value.length,
      icon: CalendarIcon,
      iconColor: 'text-purple-600',
      href: '/events'
    })
    
    stats.push({
      name: 'Events Attended',
      value: attendedEvents.value.length,
      icon: CalendarIcon,
      iconColor: 'text-green-600',
      href: '/events'
    })
    
    stats.push({
      name: 'My Teams',
      value: userTeams.value.length,
      icon: UserGroupIcon,
      iconColor: 'text-blue-600',
      href: '/teams'
    })
  }
  
  return stats
})

// Upcoming and ongoing events
const upcomingEvents = computed(() => eventStore.upcomingAndOngoingEvents)

// Recent users
const recentUsers = computed(() => {
  return userStore.users
    .filter(user => user.createdAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
})

// User teams
const userTeams = computed(() => {
  const user = authStore.user
  if (!user) return []
  return teamStore.teams.filter(team => 
    team.userTeams?.some(userTeam => userTeam.userId === user.id) || false
  )
})

// Events attended by the user
const attendedEvents = computed(() => {
  const user = authStore.user
  if (!user) return []
  return eventStore.events
    .filter(event => event.startTime && new Date(event.startTime) < new Date())
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 10) // Limit to 10 most recent
})

// Utility functions
const getUserInitials = (user: User) => {
  if (!user?.firstName || !user?.lastName) return '?'
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const isEventOngoing = (event: any) => {
  if (!event.startTime || !event.endTime) return false
  const now = new Date()
  const startTime = new Date(event.startTime)
  const endTime = new Date(event.endTime)
  return startTime <= now && endTime > now
}


// Fetch dashboard stats from API
const fetchDashboardStats = async () => {
  try {
    const stats = await apiService.getDashboardStats()
    dashboardStatsData.value = stats
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    // Fallback to local data if API fails
    dashboardStatsData.value = null
  }
}

// Load data on mount
onMounted(async () => {
  console.log('Dashboard mounted - checking auth state')
  console.log('Auth state:', {
    isAuthenticated: authStore.isAuthenticated,
    hasToken: !!authStore.accessToken,
    hasUser: !!authStore.user
  })
  
  // Wait for auth store to initialize if needed
  if (!authStore.isAuthenticated || !authStore.accessToken) {
    console.log('Auth not ready, calling checkAuth...')
    await authStore.checkAuth()
  }
  
  // Check if user is authenticated
  if (!authStore.isAuthenticated || !authStore.accessToken) {
    console.log('Still not authenticated, redirecting to OAuth')
    // If not authenticated, redirect to OAuth
    initiateOAuthLogin()
    return
  }
  
  console.log('Auth confirmed, loading dashboard data...')
  
  // Load dashboard data
  try {
    // Fetch dashboard stats first (this gives us total counts)
    await fetchDashboardStats()
    
    // Check if stores need to be refreshed (e.g., after OAuth login)
    const storesNeedRefresh = userStore.users.length === 0 && 
                             eventStore.events.length === 0 && 
                             teamStore.teams.length === 0
    
    if (storesNeedRefresh) {
      console.log('Stores appear empty, refreshing all stores...')
      await authStore.refreshStores()
    } else {
      // Load dashboard data normally
      await Promise.all([
        userStore.fetchUsers(),
        eventStore.fetchEvents(),
        teamStore.fetchTeams()
      ])
    }
    console.log('Dashboard data loaded successfully')
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
})
</script>
