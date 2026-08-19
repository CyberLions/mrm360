<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">Background Tasks</h1>
        <p class="mt-2 text-sm text-gray-400">
          Monitor and manage background tasks and job queues in MRM360.
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 flex gap-2">
        <BaseButton
          @click="triggerTask('payment-status')"
          :loading="triggeringTask"
          variant="primary"
        >
          Re-evaluate payments
        </BaseButton>
        <BaseButton
          @click="refreshTasks"
          :loading="loading"
          variant="outline"
        >
          Refresh
        </BaseButton>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
      <div class="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
        <div class="flex items-center">
          <div class="p-2 bg-blue-900 rounded-lg">
            <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-400">Total Tasks</p>
            <p class="text-2xl font-semibold text-gray-100">{{ stats.total }}</p>
          </div>
        </div>
      </div>

      <div class="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-900 rounded-lg">
            <svg class="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-400">Pending</p>
            <p class="text-2xl font-semibold text-gray-100">{{ stats.pending }}</p>
          </div>
        </div>
      </div>

      <div class="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
        <div class="flex items-center">
          <div class="p-2 bg-blue-900 rounded-lg">
            <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-400">Running</p>
            <p class="text-2xl font-semibold text-gray-100">{{ stats.running }}</p>
          </div>
        </div>
      </div>

      <div class="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
        <div class="flex items-center">
          <div class="p-2 bg-green-900 rounded-lg">
            <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-400">Completed</p>
            <p class="text-2xl font-semibold text-gray-100">{{ stats.completed }}</p>
          </div>
        </div>
      </div>

      <div class="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
        <div class="flex items-center">
          <div class="p-2 bg-red-900 rounded-lg">
            <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-400">Failed</p>
            <p class="text-2xl font-semibold text-gray-100">{{ stats.failed }}</p>
          </div>
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
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Search -->
        <div class="space-y-2">
          <label for="search" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            Search
          </label>
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search tasks..."
              class="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
            />
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
          </div>
        </div>

        <!-- Status -->
        <div class="space-y-2">
          <label for="status-filter" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Status
          </label>
          <select
            id="status-filter"
            v-model="statusFilter"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div class="flex items-end">
          <BaseButton
            @click="refreshTasks"
            :loading="loading"
            variant="outline"
          >
            Refresh Tasks
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Tasks Table -->
    <div class="bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-700">
      <div class="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 table-responsive">
        <table class="w-full divide-y divide-gray-700">
          <thead class="bg-gray-700">
            <tr>
              <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[200px]">
                Task
              </th>
              <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[150px]">
                Parent Task
              </th>
              <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[100px]">
                Status
              </th>
              <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[140px]">
                Created
              </th>
              <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[140px]">
                Updated
              </th>
              <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[200px]">
                Result
              </th>
            </tr>
          </thead>
          <tbody class="bg-gray-800 divide-y divide-gray-700">
            <template v-for="task in filteredTasks" :key="task.id">
              <!-- Parent Task Row -->
              <tr class="hover:bg-gray-700" v-if="!task.parentTaskId">
                <td class="px-4 sm:px-6 py-4 task-cell">
                  <div class="flex items-start">
                    <button
                      v-if="task.subtasks && task.subtasks.length > 0"
                      @click="toggleTaskExpansion(task.id)"
                      class="mr-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5"
                    >
                      <svg 
                        :class="[
                          'w-4 h-4 transition-transform',
                          expandedTasks.includes(task.id) ? 'rotate-90' : ''
                        ]"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                      </svg>
                    </button>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-medium text-gray-100 break-words task-name">{{ task.name }}</div>
                      <div class="text-sm text-gray-400 break-words mt-1 task-description">{{ task.description || '-' }}</div>
                      <div v-if="task.subtasks && task.subtasks.length > 0" class="text-xs text-blue-400 mt-1">
                        {{ task.subtasks.length }} subtask{{ task.subtasks.length !== 1 ? 's' : '' }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-4 sm:px-6 py-4 text-sm text-gray-300">
                  <span class="text-gray-400">-</span>
                </td>
                <td class="px-4 sm:px-6 py-4">
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium status-badge',
                      task.status === 'PENDING' ? 'bg-yellow-900 text-yellow-200' : '',
                      task.status === 'RUNNING' ? 'bg-blue-900 text-blue-200' : '',
                      task.status === 'COMPLETED' ? 'bg-green-900 text-green-200' : '',
                      task.status === 'FAILED' ? 'bg-red-900 text-red-200' : ''
                    ]"
                  >
                    {{ task.status }}
                  </span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-sm text-gray-300 date-cell">
                  <div class="break-words">{{ formatDate(task.createdAt) }}</div>
                </td>
                <td class="px-4 sm:px-6 py-4 text-sm text-gray-300 date-cell">
                  <div class="break-words">{{ formatDate(task.updatedAt) }}</div>
                </td>
                <td class="px-4 sm:px-6 py-4 text-sm text-gray-300">
                  <div v-if="task.result" class="break-words">
                    {{ task.result }}
                  </div>
                  <div v-else class="text-gray-400">-</div>
                </td>
              </tr>
              
              <!-- Subtask Rows (when expanded) -->
              <template v-if="task.subtasks && task.subtasks.length > 0 && expandedTasks.includes(task.id)">
                <tr 
                  v-for="subtask in sortedSubtasks(task.subtasks)" 
                  :key="subtask.id"
                  class="hover:bg-gray-700 bg-gray-700"
                >
                  <td class="px-4 sm:px-6 py-4 task-cell">
                    <div class="flex items-start">
                      <div class="w-8 h-8 flex items-center justify-center mr-2 flex-shrink-0">
                        <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="text-sm font-medium text-gray-300 break-words task-name">{{ subtask.name }}</div>
                        <div class="text-xs text-gray-400 mt-1">Step {{ (subtask.stepIndex || 0) + 1 }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 sm:px-6 py-4 text-sm text-gray-300">
                    <div class="flex items-start min-w-0">
                      <svg class="w-4 h-4 text-gray-400 mr-1 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17l9.2-9.2M17 17V7H7"></path>
                      </svg>
                      <span class="text-blue-400 font-medium break-words">{{ task.name }}</span>
                    </div>
                  </td>
                  <td class="px-4 sm:px-6 py-4">
                    <span
                      :class="[
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium status-badge',
                        subtask.status === 'PENDING' ? 'bg-yellow-900 text-yellow-200' : '',
                        subtask.status === 'RUNNING' ? 'bg-blue-900 text-blue-200' : '',
                        subtask.status === 'COMPLETED' ? 'bg-green-900 text-green-200' : '',
                        subtask.status === 'FAILED' ? 'bg-red-900 text-red-200' : ''
                      ]"
                    >
                      {{ subtask.status }}
                    </span>
                  </td>
                  <td class="px-4 sm:px-6 py-4 text-sm text-gray-300 date-cell">
                    <div class="break-words">{{ formatDate(subtask.createdAt) }}</div>
                  </td>
                  <td class="px-4 sm:px-6 py-4 text-sm text-gray-300 date-cell">
                    <div class="break-words">{{ formatDate(subtask.updatedAt) }}</div>
                  </td>
                  <td class="px-4 sm:px-6 py-4 text-sm text-gray-300">
                    <div v-if="subtask.result" class="break-words">
                      {{ subtask.result }}
                    </div>
                    <div v-else class="text-gray-400">-</div>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div v-if="filteredTasks.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-100">No tasks found</h3>
        <p class="mt-1 text-sm text-gray-400">
          {{ searchQuery || statusFilter ? 'Try adjusting your search or filter criteria.' : 'No background tasks have been created yet.' }}
        </p>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="bg-gray-800 shadow rounded-lg border border-gray-700 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center text-sm text-gray-400">
          <span>
            Showing {{ ((currentPage - 1) * pageSize) + 1 }} to 
            {{ Math.min(currentPage * pageSize, totalTasks) }} of 
            {{ totalTasks }} results
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
import { ref, computed, onMounted, watch } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { usePermissions } from '@/composables/usePermissions'
import { useToast } from 'vue-toastification'
import BaseButton from '@/components/common/BaseButton.vue'
import type { Task } from '@/types/api'

const taskStore = useTaskStore()
const { can } = usePermissions()
const toast = useToast()

// Reactive data
const loading = ref(false)
const triggeringTask = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = 20
const expandedTasks = ref<string[]>([])

// Use server-side pagination instead of client-side filtering
const totalTasks = computed(() => taskStore.pagination.total)
const totalPages = computed(() => taskStore.pagination.totalPages)
const filteredTasks = computed(() => taskStore.tasks)

const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

const stats = computed(() => {
  return taskStore.statistics
})

// Methods
const refreshTasks = async () => {
  loading.value = true
  try {
    await taskStore.fetchTasks({
      page: currentPage.value,
      limit: pageSize,
      status: statusFilter.value || undefined,
      search: searchQuery.value || undefined
    })
    toast.success('Tasks refreshed successfully')
  } catch (error) {
    toast.error('Failed to refresh tasks')
    console.error('Error refreshing tasks:', error)
  } finally {
    loading.value = false
  }
}

const triggerTask = async (type: 'payment-status') => {
  triggeringTask.value = true
  try {
    await taskStore.enqueueTask(type)
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} task enqueued successfully`)
    await refreshTasks()
  } catch (error) {
    toast.error(`Failed to enqueue ${type} task`)
    console.error(`Error enqueueing ${type} task:`, error)
  } finally {
    triggeringTask.value = false
  }
}

const toggleTaskExpansion = (taskId: string) => {
  const index = expandedTasks.value.indexOf(taskId)
  if (index > -1) {
    expandedTasks.value.splice(index, 1)
  } else {
    expandedTasks.value.push(taskId)
  }
}

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = ''
  currentPage.value = 1
  refreshTasks()
}

const sortedSubtasks = (subtasks: Task[]) => {
  return subtasks.slice().sort((a, b) => (a.stepIndex || 0) - (b.stepIndex || 0))
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString()
}

// Watchers
watch([searchQuery, statusFilter], () => {
  currentPage.value = 1
  refreshTasks()
})

watch(currentPage, () => {
  refreshTasks()
})

// Lifecycle
onMounted(async () => {
  await refreshTasks()
})
</script>

<style scoped>
.bg-gray-25 {
  background-color: #f9fafb;
}

/* Custom styles for better table layout */
.table-responsive {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* Ensure proper spacing and prevent text overlap */
.task-cell {
  min-height: 3rem;
  vertical-align: top;
}

/* Better text wrapping for long content */
.task-name {
  word-break: break-word;
  hyphens: auto;
}

.task-description {
  word-break: break-word;
  line-height: 1.4;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .table-responsive {
    font-size: 0.875rem;
  }
  
  .task-cell {
    padding: 0.75rem 0.5rem;
  }
}

/* Ensure status badges don't wrap */
.status-badge {
  white-space: nowrap;
  flex-shrink: 0;
}

/* Better date formatting on smaller screens */
@media (max-width: 640px) {
  .date-cell {
    font-size: 0.75rem;
  }
}
</style>
