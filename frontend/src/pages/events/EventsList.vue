<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">Events</h1>
        <p class="mt-2 text-sm text-gray-400">
          Manage and view all events in MRM360 including meetings, workshops, and social gatherings.
        </p>
      </div>
    </div>

    <!-- View Toggle -->
    <div class="bg-gray-800 shadow rounded-lg p-4 border border-gray-700">
      <div class="flex items-center justify-between">
        <div class="flex space-x-1 bg-gray-700 rounded-lg p-1">
          <button
            @click="viewMode = 'table'"
            :class="{
              'px-3 py-2 text-sm font-medium rounded-md transition-colors': true,
              'bg-gray-600 text-gray-100 shadow-sm': viewMode === 'table',
              'text-gray-400 hover:text-gray-200': viewMode === 'calendar'
            }"
          >
            Table View
          </button>
          <button
            @click="viewMode = 'calendar'"
            :class="{
              'px-3 py-2 text-sm font-medium rounded-md transition-colors': true,
              'bg-gray-600 text-gray-100 shadow-sm': viewMode === 'calendar',
              'text-gray-400 hover:text-gray-200': viewMode === 'table'
            }"
          >
            Calendar View
          </button>
        </div>
        
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-gray-800/50 backdrop-blur-sm shadow-xl rounded-xl p-6 border border-gray-700/50">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center space-x-3">
          <div class="p-2 bg-blue-900/50 rounded-lg">
            <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-100">Filters</h3>
        </div>
        <BaseButton
          @click="clearFilters"
          variant="ghost"
          size="sm"
          class="text-gray-400 hover:text-gray-200"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          Clear All
        </BaseButton>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        <!-- Search -->
        <div class="space-y-2">
          <label for="search" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            Search
          </label>
          <input
            id="search"
            v-model="filters.search"
            type="text"
            placeholder="Search events..."
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          />
        </div>

        <div class="space-y-2">
          <label for="semester" class="flex items-center text-sm font-medium text-gray-300">Semester</label>
          <select
            id="semester"
            v-model="filters.semester"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          >
            <option v-for="semester in semesterOptions" :key="semester" :value="semester">
              {{ formatSemester(semester) }}
            </option>
          </select>
        </div>
        
        <!-- Category -->
        <div class="space-y-2">
          <label for="category" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
            </svg>
            Category
          </label>
          <select
            id="category"
            v-model="filters.category"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Categories</option>
            <option value="meeting">Meeting</option>
            <option value="social">Social</option>
            <option value="workshop">Workshop</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <!-- Team -->
        <div class="space-y-2">
          <label for="team" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            Team
          </label>
          <select
            id="team"
            v-model="filters.linkedTeamId"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Teams</option>
            <option
              v-for="team in availableTeams"
              :key="team.id"
              :value="team.id"
            >
              {{ team.name }}
            </option>
          </select>
        </div>
        
        <!-- Series -->
        <div class="space-y-2">
          <label for="series" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            Series
          </label>
          <select
            id="series"
            v-model="filters.seriesId"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Series</option>
            <option
              v-for="s in availableSeries"
              :key="s.id"
              :value="s.id"
            >
              {{ s.name }}
            </option>
          </select>
        </div>

        <!-- Status -->
        <div class="space-y-2">
          <label for="status" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Status
          </label>
          <select
            id="status"
            v-model="filters.status"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="past">Past</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Events Table -->
    <div v-if="viewMode === 'table'" class="bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-700">
      <div class="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        <table class="min-w-full divide-y divide-gray-700">
          <thead class="bg-gray-700">
            <tr>
              <th 
                @click="toggleSort('title')"
                class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[200px] cursor-pointer hover:bg-gray-600 select-none"
              >
                <span class="flex items-center gap-1">
                  Event
                  <span class="text-gray-400">{{ getSortIcon('title') }}</span>
                </span>
              </th>
              <th 
                @click="toggleSort('startTime')"
                class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[120px] cursor-pointer hover:bg-gray-600 select-none"
              >
                <span class="flex items-center gap-1">
                  Date & Time
                  <span class="text-gray-400">{{ getSortIcon('startTime') }}</span>
                </span>
              </th>
              <th 
                @click="toggleSort('category')"
                class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[80px] cursor-pointer hover:bg-gray-600 select-none"
              >
                <span class="flex items-center gap-1">
                  Category
                  <span class="text-gray-400">{{ getSortIcon('category') }}</span>
                </span>
              </th>
              <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[100px]">
                Team
              </th>
              <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[90px]">
                Attendance
              </th>
              <th class="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[100px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-gray-800 divide-y divide-gray-700">
            <tr v-for="event in paginatedEvents" :key="event.id" class="hover:bg-gray-700">
              <td class="px-3 sm:px-6 py-4">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                    <div class="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <CalendarIcon class="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                    </div>
                  </div>
                  <div class="ml-2 sm:ml-4 min-w-0 flex-1">
                    <div class="text-sm font-medium text-gray-100 truncate">
                      {{ event.title }}
                    </div>
                    <div class="text-xs text-blue-300">{{ formatSemester(event.semester) }}</div>
                    <div class="text-xs sm:text-sm text-gray-400 truncate max-w-[150px] sm:max-w-xs" :title="event.description">
                      {{ event.description }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-3 sm:px-6 py-4 whitespace-nowrap">
                <div class="text-xs sm:text-sm text-gray-300">{{ formatDate(event.startTime) }}</div>
                <div class="text-xs sm:text-sm text-gray-400">{{ formatTime(event.startTime) }}</div>
              </td>
              <td class="px-3 sm:px-6 py-4 whitespace-nowrap">
                <span :class="[
                  'inline-flex px-2 py-1 text-xs leading-5 font-semibold rounded-full',
                  getCategoryColor(event.category)
                ]">
                  {{ event.category }}
                </span>
              </td>
              <td class="px-3 sm:px-6 py-4 whitespace-nowrap">
                <div class="text-xs sm:text-sm text-gray-300 truncate max-w-[80px] sm:max-w-none">
                  {{ event.linkedTeam?.name || 'No team' }}
                </div>
              </td>
              <td class="px-3 sm:px-6 py-4 whitespace-nowrap">
                <div class="text-xs sm:text-sm text-gray-300">
                  {{ getConfirmedRSVPsCount(event) }} attendees
                </div>
              </td>
              <td class="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                <div class="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                  <router-link
                    :to="`/events/${event.id}`"
                    class="text-blue-400 hover:text-blue-300"
                  >
                    View
                  </router-link>
                  <button
                    v-if="canEdit"
                    @click="editEvent(event)"
                    class="text-green-400 hover:text-green-300"
                  >
                    Edit
                  </button>
                  <button
                    v-if="canDelete"
                    @click="deleteEvent(event)"
                    class="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Events Calendar -->
    <div v-else class="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
      <div class="grid grid-cols-7 gap-4">
        <!-- Calendar header -->
        <div
          v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
          :key="day"
          class="text-center text-sm font-medium text-gray-300 py-2"
        >
          {{ day }}
        </div>
        
        <!-- Calendar days -->
        <div
          v-for="day in calendarDays"
          :key="day.date"
          :class="[
            'min-h-24 p-2 border border-gray-700',
            day.isCurrentMonth ? 'bg-gray-800' : 'bg-gray-900',
            day.isToday ? 'bg-blue-900' : ''
          ]"
        >
          <div class="text-sm text-gray-300 mb-1">{{ day.dayNumber }}</div>
          <div class="space-y-1">
            <div
              v-for="event in day.events"
              :key="event.id"
              class="text-xs p-1 rounded bg-blue-600 text-white truncate cursor-pointer hover:bg-blue-700"
              @click="viewEvent(event)"
            >
              {{ event.title }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination - Only show in table view -->
    <div v-if="viewMode === 'table' && totalPages > 1" class="bg-gray-800 shadow rounded-lg border border-gray-700 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center text-sm text-gray-400">
          <span>
            Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to 
            {{ Math.min(currentPage * itemsPerPage, totalItems) }} of 
            {{ totalItems }} results
          </span>
        </div>
        
        <div class="flex items-center space-x-2">
          <!-- Previous Button -->
          <button
            @click="currentPage--"
            :disabled="currentPage <= 1"
            :class="[
              'px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
              currentPage <= 1
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            ]"
          >
            Previous
          </button>
          
          <!-- Page Numbers -->
          <div class="flex items-center space-x-1 overflow-x-auto">
            <button
              v-for="page in visiblePages"
              :key="page"
              @click="currentPage = page"
              :class="[
                'px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap',
                page === currentPage
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              ]"
            >
              {{ page }}
            </button>
          </div>
          
          <!-- Next Button -->
          <button
            @click="currentPage++"
            :disabled="currentPage >= totalPages"
            :class="[
              'px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
              currentPage >= totalPages
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            ]"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="paginatedEvents.length === 0" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-100">No events found</h3>
      <p class="mt-1 text-sm text-gray-400">
        {{ filters.search || filters.category || filters.linkedTeamId || filters.status ? 'Try adjusting your search or filter criteria.' : 'No events have been created yet.' }}
      </p>
    </div>

    <!-- Modals removed - no modals in this app -->
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useEventStore } from '@/stores/eventStore'
import { useTeamStore } from '@/stores/teamStore'
import { useSeriesStore } from '@/stores/seriesStore'
import { usePermissions } from '@/composables/usePermissions'
import BaseButton from '@/components/common/BaseButton.vue'
import { CalendarIcon } from '@heroicons/vue/24/outline'
import type { Event } from '@/types/api'
import apiService from '@/services/api'
import { buildSemesterOptions, formatSemester, inferCurrentSemester } from '@/utils/semester'

const router = useRouter()
const eventStore = useEventStore()
const teamStore = useTeamStore()
const seriesStore = useSeriesStore()
const { can } = usePermissions()

const loading = ref(false)
const viewMode = ref<'table' | 'calendar'>('table')
const currentPage = ref(1)
const itemsPerPage = 10
const usedSemesters = ref<string[]>([])

// Sorting state
const sortBy = ref<string>('startTime')
const sortOrder = ref<'asc' | 'desc'>('desc') // Default to most recent first

const filters = reactive({
  search: '',
  category: '',
  linkedTeamId: '',
  seriesId: '',
  dateRange: '',
  status: '' as 'upcoming' | 'ongoing' | 'past',
  semester: inferCurrentSemester()
})

const semesterOptions = computed(() => buildSemesterOptions(usedSemesters.value))



const canEdit = computed(() => can('update', 'Event'))
const canDelete = computed(() => can('delete', 'Event'))

const availableTeams = computed(() => teamStore.teams)
const availableSeries = computed(() => seriesStore.seriesList)

// Use server-side pagination instead of client-side filtering
const totalPages = computed(() => eventStore.pagination.totalPages)
const totalItems = computed(() => eventStore.pagination.total)
const paginatedEvents = computed(() => eventStore.events)

const visiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})


const calendarDays = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())
  
  const days = []
  for (let i = 0; i < 42; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)
    
    const dayEvents = eventStore.events.filter(event => {
      const eventDate = new Date(event.startTime)
      return eventDate.toDateString() === currentDate.toDateString()
    })
    
    days.push({
      date: currentDate.toISOString(),
      dayNumber: currentDate.getDate(),
      isCurrentMonth: currentDate.getMonth() === month,
      isToday: currentDate.toDateString() === now.toDateString(),
      events: dayEvents
    })
  }
  
  return days
})

onMounted(async () => {
  const semesters = await apiService.getSemesters()
  usedSemesters.value = semesters.events
  await loadData()
})

watch(filters, () => {
  currentPage.value = 1
  loadData()
}, { deep: true })

watch(currentPage, () => {
  loadData()
})

const loadData = async () => {
  try {
    loading.value = true
    await Promise.all([
      eventStore.fetchEvents({
        page: currentPage.value,
        limit: itemsPerPage,
        query: filters.search || undefined,
        category: filters.category ? filters.category.toUpperCase() as any : undefined,
        linkedTeamId: filters.linkedTeamId || undefined,
        seriesId: filters.seriesId || undefined,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        semester: filters.semester
      }),
      teamStore.fetchTeams(),
      seriesStore.fetchAllSeries()
    ])
  } catch (error) {
    console.error('Failed to load data:', error)
  } finally {
    loading.value = false
  }
}


const clearFilters = () => {
  filters.search = ''
  filters.category = ''
  filters.linkedTeamId = ''
  filters.seriesId = ''
  filters.status = '' as 'upcoming' | 'ongoing' | 'past'
  filters.semester = inferCurrentSemester()
  sortBy.value = 'startTime'
  sortOrder.value = 'desc'
  currentPage.value = 1
}

// Toggle sort order when clicking column headers
const toggleSort = (column: string) => {
  if (sortBy.value === column) {
    // Toggle order if same column
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    // New column, default to desc (most recent first for dates)
    sortBy.value = column
    sortOrder.value = 'desc'
  }
  currentPage.value = 1
  loadData()
}

// Get sort icon for column headers
const getSortIcon = (column: string) => {
  if (sortBy.value !== column) return '↕'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

const viewEvent = (event: Event) => {
  router.push(`/events/${event.id}`)
}

const editEvent = (event: Event) => {
  // This function is not used in the new template, but kept for potential future use or if the modal is re-introduced.
  // For now, it will just navigate to the event detail page.
  router.push(`/events/${event.id}`)
}

const deleteEvent = async (event: Event) => {
  if (!confirm('Are you sure you want to delete this event?')) return
  
  try {
    await eventStore.deleteEvent(event.id)
    await loadData()
  } catch (error) {
    console.error('Failed to delete event:', error)
  }
}



const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString()
}

const getCategoryColor = (category: string) => {
  const colors = {
    meeting: 'bg-blue-100 text-blue-800',
    social: 'bg-green-100 text-green-800',
    workshop: 'bg-purple-100 text-purple-800',
    other: 'bg-gray-100 text-gray-800'
  }
  return colors[category as keyof typeof colors] || colors.other
}

const getConfirmedRSVPsCount = (event: Event) => {
  return event.rsvps?.filter(rsvp => rsvp.status === 'CONFIRMED').length || 0
}
</script>
