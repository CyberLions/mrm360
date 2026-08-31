<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">Members</h1>
        <p class="mt-2 text-sm text-gray-400">
          A list of all members in MRM360 including their name, email, status, and teams.
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <!-- Add Member button removed - no modals in this app -->
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
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <!-- Search -->
        <div class="space-y-2">
          <label for="search-filter" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            Search
          </label>
          <input
            id="search-filter"
            v-model="filters.query"
            type="text"
            placeholder="Search by name or email..."
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          />
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
            v-model="filters.isActive"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Statuses</option>
            <option :value="true">Active</option>
            <option :value="false">Inactive</option>
          </select>
        </div>
        
        <!-- Payment Status -->
        <div class="space-y-2">
          <label for="paid-filter" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
            </svg>
            Payment Status
          </label>
          <select
            id="paid-filter"
            v-model="filters.isPaid"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Payment Statuses</option>
            <option :value="true">Paid</option>
            <option :value="false">Unpaid</option>
          </select>
        </div>
        
        <!-- Team -->
        <div class="space-y-2">
          <label for="team-filter" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            Team
          </label>
          <select
            id="team-filter"
            v-model="filters.teamId"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Teams</option>
            <option
              v-for="team in teams"
              :key="team.id"
              :value="team.id"
            >
              {{ team.name }}
            </option>
          </select>
        </div>
        
        <!-- Group -->
        <div class="space-y-2">
          <label for="group-filter" class="flex items-center text-sm font-medium text-gray-300">
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            Group
          </label>
          <select
            id="group-filter"
            v-model="filters.groupId"
            class="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          >
            <option value="">All Groups</option>
            <option
              v-for="group in groups"
              :key="group.id"
              :value="group.id"
            >
              {{ group.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Users Table -->
    <div class="bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-700 [contain:layout]">
      <div class="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        <table class="w-full divide-y divide-gray-700">
          <thead class="bg-gray-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-1/4">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-1/5">
                Email
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-20">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-20">
                Payment
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-1/6">
                Teams
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-24">
                Joined
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-gray-800 divide-y divide-gray-700">
            <tr v-for="user in users" :key="user?.id" class="hover:bg-gray-700">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10">
                    <div class="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <span class="text-sm font-medium text-white">
                        {{ getUserInitials(user) }}
                      </span>
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-100">
                      {{ user.displayName }}
                    </div>
                    <div class="text-sm text-gray-400">
                      {{ user.firstName }} {{ user.lastName }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-300">{{ user.email }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="[
                  'inline-flex px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                  user.isActive ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                ]">
                  {{ user.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="[
                  'inline-flex px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                  user.isPaid ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'
                ]">
                  {{ user.isPaid ? 'Paid' : 'Unpaid' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="team in user.teams"
                    :key="team.id"
                    class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900 text-blue-200"
                  >
                    {{ team.name }}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {{ formatDate(user.createdAt) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                  <IconButton :icon="EyeIcon" label="View member details" :to="`/users/${user.id}`" variant="primary" />
                   <IconButton
                     v-if="!user.isPaid"
                     :icon="isTogglingPaidStatus === user.id ? ArrowPathIcon : BanknotesIcon"
                     label="Record payment"
                     variant="success"
                     @click="openPaymentModal(user)"
                     :disabled="isTogglingPaidStatus === user.id"
                   />
                   <IconButton
                     v-else
                     :icon="isTogglingPaidStatus === user.id ? ArrowPathIcon : ArrowUturnLeftIcon"
                     label="Mark unpaid"
                     variant="warning"
                     @click="markUserUnpaid(user)"
                     :disabled="isTogglingPaidStatus === user.id"
                   />
                   <IconButton
                     v-if="can('delete', 'User')"
                     :icon="TrashIcon"
                     label="Delete member"
                     variant="danger"
                     @click="deleteUser(user)"
                   />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="bg-gray-800 shadow rounded-lg border border-gray-700 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center text-sm text-gray-400">
          <span>
            Showing {{ ((pagination.page - 1) * pagination.limit) + 1 }} to 
            {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of 
            {{ pagination.total }} results
          </span>
        </div>
        
        <div class="flex items-center space-x-2">
          <!-- Previous Button -->
          <button
            @click="goToPage(pagination.page - 1)"
            :disabled="pagination.page <= 1"
            :class="[
              'px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
              pagination.page <= 1
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
              @click="goToPage(page)"
              :class="[
                'px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                page === pagination.page
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              ]"
            >
              {{ page }}
            </button>
          </div>
          
          <!-- Next Button -->
          <button
            @click="goToPage(pagination.page + 1)"
            :disabled="pagination.page >= pagination.totalPages"
            :class="[
              'px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
              pagination.page >= pagination.totalPages
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
    <div v-if="users.length === 0 && !userStore.isLoading" class="text-center py-12">
      <UserGroupIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-100">No users found</h3>
      <p class="mt-1 text-sm text-gray-400">
        {{ filters.query || filters.isActive !== undefined || filters.isPaid !== undefined || filters.teamId || filters.groupId ? 'Try adjusting your search or filter criteria.' : 'No users have been added yet.' }}
      </p>
    </div>

    <!-- Payment Modal -->
    <PaymentModal
      :is-open="isPaymentModalOpen"
      :user="selectedUser"
      @close="closePaymentModal"
      @payment-created="handlePaymentCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useTeamStore } from '@/stores/teamStore'
import { useGroupStore } from '@/stores/groupStore'
import { useToast } from 'vue-toastification'
import { usePermissions } from '@/composables/usePermissions'
import type { User, UserFilters } from '@/types/api'
import BaseButton from '@/components/common/BaseButton.vue'
import PaymentModal from '@/components/payments/PaymentModal.vue'
import { ArrowPathIcon, ArrowUturnLeftIcon, BanknotesIcon, EyeIcon, TrashIcon, UserGroupIcon } from '@heroicons/vue/24/outline'
import IconButton from '@/components/common/IconButton.vue'

const userStore = useUserStore()
const teamStore = useTeamStore()
const groupStore = useGroupStore()
const toast = useToast()
const { can } = usePermissions()

// State
const isTogglingPaidStatus = ref<string | null>(null)
const isPaymentModalOpen = ref(false)
const selectedUser = ref<User | null>(null)

// Filters
const filters = ref<UserFilters>({
  page: 1,
  limit: 20,
  sortBy: 'displayName',
  sortOrder: 'asc',
  query: '',
  isActive: undefined,
  isPaid: undefined,
  teamId: '',
  groupId: ''
})


// Computed
const users = computed(() => userStore.users)
const teams = computed(() => teamStore.teams)
const groups = computed(() => groupStore.groups)
const pagination = computed(() => userStore.pagination)

// Calculate visible page numbers for pagination
const visiblePages = computed(() => {
  const current = pagination.value.page
  const total = pagination.value.totalPages
  const delta = 2 // Number of pages to show on each side of current page
  
  let start = Math.max(1, current - delta)
  let end = Math.min(total, current + delta)
  
  // Adjust if we're near the beginning or end
  if (current <= delta) {
    end = Math.min(total, 2 * delta + 1)
  }
  if (current + delta >= total) {
    start = Math.max(1, total - 2 * delta)
  }
  
  const pages = []
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

// Methods
const deleteUser = async (user: User) => {
  try {
    await userStore.deleteUser(user.id)
  } catch (error) {
    console.error('Error deleting user:', error)
  }
}

const openPaymentModal = (user: User) => {
  if (!user?.id) {
    toast.error('Invalid user ID')
    return
  }
  
  selectedUser.value = user
  isPaymentModalOpen.value = true
}

const closePaymentModal = () => {
  isPaymentModalOpen.value = false
  selectedUser.value = null
}

const handlePaymentCreated = async () => {
  // Refresh the user list to show updated payment status
  const backendFilters = {
    page: filters.value.page,
    limit: filters.value.limit,
    search: filters.value.query,
    paidStatus: filters.value.isPaid,
    isActive: filters.value.isActive,
    teamId: filters.value.teamId,
    groupId: filters.value.groupId,
    sortBy: filters.value.sortBy,
    sortOrder: filters.value.sortOrder
  }
  await userStore.fetchUsers(backendFilters)
}

const markUserUnpaid = async (user: User) => {
  if (!user?.id) {
    toast.error('Invalid user ID')
    return
  }
  
  isTogglingPaidStatus.value = user.id
  
  try {
    await userStore.updateUser(user.id, {
      isPaid: false
    })
    
    toast.success(`${user.displayName} marked as unpaid`)
    
  } catch (error) {
    console.error('Error marking user as unpaid:', error)
    toast.error('Failed to update payment status')
  } finally {
    isTogglingPaidStatus.value = null
  }
}



const clearFilters = () => {
  filters.value = {
    page: 1,
    limit: 20,
    sortBy: 'displayName',
    sortOrder: 'asc',
    query: '',
    isActive: undefined,
    isPaid: undefined,
    teamId: '',
    groupId: ''
  }
}

// Pagination methods
const goToPage = async (page: number) => {
  if (page < 1 || page > pagination.value.totalPages) return
  
  filters.value.page = page
  // Map frontend filter names to backend parameter names
  const backendFilters = {
    page: filters.value.page,
    limit: filters.value.limit,
    search: filters.value.query,
    paidStatus: filters.value.isPaid,
    isActive: filters.value.isActive,
    teamId: filters.value.teamId,
    groupId: filters.value.groupId,
    sortBy: filters.value.sortBy,
    sortOrder: filters.value.sortOrder
  };
  await userStore.fetchUsers(backendFilters)
}

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

// Load data on mount
onMounted(async () => {
  await Promise.all([
    userStore.fetchUsers(),
    teamStore.fetchTeams(),
    groupStore.fetchGroups()
  ])
})

// Watch filters for changes (excluding page changes)
watch(() => ({
  query: filters.value.query,
  isActive: filters.value.isActive,
  isPaid: filters.value.isPaid,
  teamId: filters.value.teamId,
  groupId: filters.value.groupId,
  sortBy: filters.value.sortBy,
  sortOrder: filters.value.sortOrder
}), async () => {
  // Reset to first page when filters change
  filters.value.page = 1;
  // Fetch users with new filters - map frontend filter names to backend parameter names
  const backendFilters = {
    page: filters.value.page,
    limit: filters.value.limit,
    search: filters.value.query,
    paidStatus: filters.value.isPaid,
    isActive: filters.value.isActive,
    teamId: filters.value.teamId,
    groupId: filters.value.groupId,
    sortBy: filters.value.sortBy,
    sortOrder: filters.value.sortOrder
  };
  await userStore.fetchUsers(backendFilters);
}, { deep: true })
</script>
