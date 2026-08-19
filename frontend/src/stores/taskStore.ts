import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiService from '@/services/api'
import type { Task, PaginatedResponse, TaskStatus } from '@/types/api'

export const useTaskStore = defineStore('tasks', () => {
  // State
  const tasks = ref<Task[]>([])
  const currentTask = ref<Task | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const statistics = ref({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0
  })

  // Getters
  const pendingTasks = computed(() => 
    tasks.value.filter(task => task.status === 'PENDING')
  )

  const runningTasks = computed(() => 
    tasks.value.filter(task => task.status === 'RUNNING')
  )

  const completedTasks = computed(() => 
    tasks.value.filter(task => task.status === 'COMPLETED')
  )

  const failedTasks = computed(() => 
    tasks.value.filter(task => task.status === 'FAILED')
  )

  const recentTasks = computed(() => 
    [...tasks.value]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
  )

  // Actions
  async function fetchTasks(params?: { page?: number; limit?: number; entityType?: string; entityId?: string }) {
    try {
      isLoading.value = true
      error.value = null
      
      const response: PaginatedResponse<Task> = await apiService.getTasks(params)
      
      tasks.value = response.data
      pagination.value = response.pagination
      if (response.statistics) {
        statistics.value = response.statistics
      }
      
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch tasks'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchTask(id: string) {
    try {
      isLoading.value = true
      error.value = null
      
      const task = await apiService.getTask(id)
      currentTask.value = task
      
      return task
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch task'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function enqueueTask(taskName: 'email' | 'qr-code' | 'sync-groups' | 'provision-team' | 'provision-event' | 'payment-status', data?: any) {
    try {
      isLoading.value = true
      error.value = null
      
      const result = await apiService.enqueueTask(taskName, data)
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to enqueue task'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    tasks,
    currentTask,
    isLoading,
    error,
    pagination,
    statistics,
    
    // Getters
    pendingTasks,
    runningTasks,
    completedTasks,
    failedTasks,
    recentTasks,
    
    // Actions
    fetchTasks,
    fetchTask,
    enqueueTask,
    clearError
  }
})
