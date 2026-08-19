<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">Teams</h1>
        <p class="mt-2 text-sm text-gray-400">
          Manage and view all teams in MRM360 including their type, status, and members.
        </p>
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
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            placeholder="Search teams..."
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          />
        </div>
        
        <!-- Team Type -->
        <div class="space-y-2">
          <label for="type" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            Team Type
          </label>
          <select
            id="type"
            v-model="filters.type"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Types</option>
            <option value="COMPETITION">Competition</option>
            <option value="DEVELOPMENT">Development</option>
          </select>
        </div>
        
        <!-- Subtype -->
        <div class="space-y-2">
          <label for="subtype" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
            </svg>
            Subtype
          </label>
          <select
            id="subtype"
            v-model="filters.subtype"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Subtypes</option>
            <option value="BLUE">Blue</option>
            <option value="RED">Red</option>
            <option value="CTF">CTF</option>
          </select>
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
      </div>
    </div>

    <!-- Teams Grid -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <div v-else-if="paginatedTeams.length === 0" class="text-center py-12">
      <div class="text-gray-400">
        <svg class="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-100 mb-2">No teams found</h3>
        <p class="text-gray-400">Try adjusting your search or filters</p>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="team in paginatedTeams"
        :key="team.id"
        class="bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow duration-200 border border-gray-700"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-100">{{ team.name }}</h3>
            <div class="flex items-center space-x-2">
              <span class="px-2 py-1 bg-blue-900 text-blue-200 rounded-full text-xs font-medium">
                {{ team.type }}
              </span>
              <span v-if="team.subtype" class="px-2 py-1 bg-green-900 text-green-200 rounded-full text-xs font-medium">
                {{ team.subtype }}
              </span>
            </div>
          </div>
          
          <p v-if="team.description" class="text-gray-400 text-sm mb-3">
            {{ team.description }}
          </p>

          <p class="text-sm text-blue-300 mb-3">{{ formatSemester(team.semester) }}</p>
          
          <div class="flex items-center text-sm text-gray-500 mb-3">
            <UserGroupIcon class="h-4 w-4 mr-2" />
            {{ team.userTeams?.length || 0 }} members
          </div>
          
          <div v-if="team.parentTeam" class="flex items-center text-sm text-gray-400">
            <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
            Subteam of {{ team.parentTeam.name }}
          </div>
          
          <div class="flex justify-end items-center mt-4">
            <div class="flex space-x-2">
              <IconButton :icon="EyeIcon" label="View team details" :to="`/teams/${team.id}`" variant="primary" />
              <IconButton
                v-if="canUpdate"
                :icon="PencilSquareIcon"
                label="Edit team"
                @click="editTeam(team)"
                variant="success"
              />
              <IconButton
                v-if="canDelete"
                :icon="TrashIcon"
                label="Delete team"
                @click="deleteTeam(team)"
                variant="danger"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="bg-gray-800 shadow rounded-lg border border-gray-700 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center text-sm text-gray-400">
          <span>
            Showing {{ startIndex }} to {{ endIndex }} of {{ totalItems }} results
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
          <div class="flex items-center space-x-1">
            <button
              v-for="page in visiblePages"
              :key="page"
              @click="currentPage = page"
              :class="[
                'px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
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


  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTeamStore } from '@/stores/teamStore'
import { usePermissions } from '@/composables/usePermissions'
import BaseButton from '@/components/common/BaseButton.vue'
import type { Team } from '@/types/api'
import { EyeIcon, PencilSquareIcon, TrashIcon, UserGroupIcon } from '@heroicons/vue/24/outline'
import IconButton from '@/components/common/IconButton.vue'
import apiService from '@/services/api'
import { buildSemesterOptions, formatSemester, inferCurrentSemester } from '@/utils/semester'

const router = useRouter()
const teamStore = useTeamStore()
const { can } = usePermissions()

const loading = ref(false)
const currentPage = ref(1)
const itemsPerPage = ref(9)
const usedSemesters = ref<string[]>([])

const filters = reactive({
  search: '',
  type: '',
  subtype: '',
  semester: inferCurrentSemester()
})

const semesterOptions = computed(() => buildSemesterOptions(usedSemesters.value))

const canCreate = computed(() => can('create', 'Team'))
const canUpdate = computed(() => can('update', 'Team'))
const canDelete = computed(() => can('delete', 'Team'))

// Use server-side pagination instead of client-side filtering
const totalPages = computed(() => teamStore.pagination.totalPages)
const totalItems = computed(() => teamStore.pagination.total)
const paginatedTeams = computed(() => teamStore.teams)

const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

const startIndex = computed(() => {
  return (currentPage.value - 1) * itemsPerPage.value + 1
})

const endIndex = computed(() => {
  return Math.min(currentPage.value * itemsPerPage.value, totalItems.value)
})

onMounted(async () => {
  const semesters = await apiService.getSemesters()
  usedSemesters.value = semesters.teams
  await loadTeams()
})

watch(filters, () => {
  currentPage.value = 1
  loadTeams()
}, { deep: true })

watch(currentPage, () => {
  loadTeams()
})

const loadTeams = async () => {
  try {
    loading.value = true
    await teamStore.fetchTeams({
      page: currentPage.value,
      limit: itemsPerPage.value,
      query: filters.search || undefined,
      type: filters.type as any || undefined,
      semester: filters.semester
    })
  } catch (error) {
    console.error('Failed to load teams:', error)
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  currentPage.value = 1
}

const clearFilters = () => {
  filters.search = ''
  filters.type = ''
  filters.subtype = ''
  filters.semester = inferCurrentSemester()
  currentPage.value = 1
}

const createTeam = () => {
  router.push('/teams/new')
}

const viewTeam = (teamId: string) => {
  router.push(`/teams/${teamId}`)
}

const editTeam = (team: Team) => {
  router.push(`/teams/${team.id}/edit`)
}

const deleteTeam = async (team: Team) => {
  if (!confirm('Are you sure you want to delete this team?')) return
  
  try {
    await teamStore.deleteTeam(team.id)
    await loadTeams()
  } catch (error) {
    console.error('Failed to delete team:', error)
  }
}
</script>
