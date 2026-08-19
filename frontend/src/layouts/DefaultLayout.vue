<template>
  <div class="min-h-screen bg-gray-900 dark">
    <!-- Top Navigation Bar -->
    <nav class="bg-gray-800 shadow-lg border-b border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <!-- Logo and Brand -->
          <div class="flex items-center">
            <div class="flex-shrink-0 flex items-center">
              <img src="@/assets/logo.png" alt="CCSO MRM Logo" class="h-8 w-auto mr-2" />
              <h1 class="text-lg sm:text-xl font-bold text-blue-400">CCSO MRM</h1>
            </div>
          </div>

          <!-- Desktop Navigation Links -->
          <div class="hidden md:flex items-center space-x-8">
            <router-link
              v-for="item in navigationItems"
              :key="item.name"
              :to="item.to"
              :class="[
                isNavigationItemActive(item.to)
                  ? 'text-blue-400 border-blue-500 bg-gray-700'
                  : 'text-gray-300 border-transparent hover:text-gray-100 hover:border-gray-600 hover:bg-gray-700',
                'inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium transition-all duration-200 rounded-t-md'
              ]"
            >
              {{ item.name }}
            </router-link>
          </div>

          <!-- Mobile Menu Button and User Menu -->
          <div class="flex items-center space-x-2">
            <!-- Mobile Menu Button -->
            <button
              @click.stop="toggleMobileMenu"
              data-mobile-menu-button
              class="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 touch-manipulation"
              :class="{ 'bg-gray-700': isMobileMenuOpen }"
            >
              <span class="sr-only">Open main menu</span>
              <svg
                v-if="!isMobileMenuOpen"
                class="block h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg
                v-else
                class="block h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <!-- User Menu -->
            <div class="relative" data-user-menu>
              <div>
                <button
                  @click="isUserMenuOpen = !isUserMenuOpen"
                  class="max-w-xs bg-gray-700 flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span class="sr-only">Open user menu</span>
                  <div class="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <span class="text-white text-sm font-medium">
                      {{ userInitials }}
                    </span>
                  </div>
                  <span class="hidden sm:block ml-2 mr-4 text-gray-200">{{ authStore.user?.displayName }}</span>
                </button>
              </div>
              
              <!-- User Dropdown Menu -->
              <div
                v-if="isUserMenuOpen"
                class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
              >
                <router-link
                  to="/profile"
                  class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                  @click="isUserMenuOpen = false"
                >
                  Your Profile
                </router-link>
                <button
                  @click="handleLogout"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile Navigation Menu -->
        <div 
          v-if="isMobileMenuOpen" 
          class="md:hidden fixed top-16 left-0 right-0 z-[60] bg-gray-800 shadow-xl border-t border-gray-600"
          data-mobile-menu
        >
          <div class="px-4 pt-4 pb-6 space-y-2 bg-gray-800">
            <router-link
              v-for="item in navigationItems"
              :key="item.name"
              :to="item.to"
              :class="[
                isNavigationItemActive(item.to)
                  ? 'text-white bg-blue-600 border-blue-500'
                  : 'text-gray-200 hover:text-white hover:bg-gray-700 border-transparent hover:border-gray-600',
                'block px-4 py-3 text-base font-medium rounded-lg transition-all duration-200 touch-manipulation border-2'
              ]"
              @click="closeMobileMenu"
            >
              {{ item.name }}
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- Mobile Menu Overlay -->
    <div
      v-if="isMobileMenuOpen && isMobile"
      class="fixed inset-0 z-[50] bg-gray-900 bg-opacity-75 md:hidden"
      @click="closeMobileMenu"
      @touchstart="closeMobileMenu"
    ></div>

    <div class="flex">
      <!-- Mobile Sidebar Overlay -->
      <div
        v-if="isSidebarOpen && isMobile"
        class="fixed inset-0 z-40 bg-gray-900 bg-opacity-50"
        @click="isSidebarOpen = false"
      ></div>

      <!-- Page-Specific Sidebar -->
      <div 
        :class="[
          'bg-gray-800 shadow-lg border-r border-gray-700 min-h-screen flex-shrink-0 transition-all duration-300 ease-in-out',
          isMobile 
            ? (isSidebarOpen ? 'fixed inset-y-0 left-0 z-50 w-64' : 'hidden')
            : 'w-64'
        ]"
      >
        <div class="p-4">
          <!-- Mobile Sidebar Header -->
          <div v-if="isMobile" class="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
            <h2 class="text-lg font-semibold text-gray-100">
              {{ currentSectionTitle }}
            </h2>
            <button
              @click="isSidebarOpen = false"
              class="text-gray-400 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
            >
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Sidebar Header with Current Section (Desktop only) -->
          <div v-if="!isMobile" class="mb-6 pb-4 border-b border-gray-700">
            <h2 class="text-lg font-semibold text-gray-100 transition-all duration-300">
              {{ currentSectionTitle }}
            </h2>
            <p class="text-sm text-gray-400 mt-1 transition-all duration-300">
              {{ currentSectionDescription }}
            </p>
          </div>
          
          <!-- Page-Specific Sidebar Content -->
          <nav class="space-y-2">
            <!-- Dashboard Sidebar -->
            <div v-if="currentPath === '/dashboard'" class="space-y-2">
              <!-- Quick Create Actions - Only show to admins -->
              <div v-if="authStore.user && (authStore.isAdmin || authStore.isExecBoard)" class="bg-gray-700 rounded-lg p-3">
                <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Quick Create Actions
                </h3>
                <div class="space-y-2">
                  <button
                    v-if="can('create', 'User')"
                    @click="createUser"
                    class="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-300 hover:bg-green-900 hover:text-green-300 rounded-md transition-all duration-200 group border border-transparent hover:border-green-700"
                  >
                    <UsersIcon class="mr-3 h-5 w-5 text-gray-400 group-hover:text-green-400 transition-colors duration-200" />
                    Add Member
                  </button>
                  
                  <button
                    v-if="can('create', 'Team')"
                    @click="createTeam"
                    class="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-300 hover:bg-blue-900 hover:text-blue-300 rounded-md transition-all duration-200 group border border-transparent hover:border-blue-700"
                  >
                    <UserGroupIcon class="mr-3 h-5 w-5 text-gray-400 group-hover:text-blue-400 transition-colors duration-200" />
                    Create Team
                  </button>
                  
                  <button
                    v-if="can('create', 'Event')"
                    @click="createEvent"
                    class="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-300 hover:bg-purple-900 hover:text-purple-300 rounded-md transition-all duration-200 group border border-transparent hover:border-purple-700"
                  >
                    <CalendarIcon class="mr-3 h-5 w-5 text-gray-400 group-hover:text-purple-400 transition-colors duration-200" />
                    Create Event
                  </button>
                </div>
              </div>
            </div>

            <!-- Users Sidebar -->
            <div v-else-if="currentPath.startsWith('/users')" class="space-y-2">
              <router-link
                to="/users"
                :class="[
                  currentPath === '/users'
                    ? 'bg-gray-700 border-blue-500 text-blue-300 shadow-sm'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100 border-transparent',
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md border-l-4 transition-all duration-200'
                ]"
              >
                <UsersIcon class="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300 transition-colors duration-200" />
                All Members
              </router-link>
              
              <router-link
                v-if="can('create', 'User')"
                to="/users/new"
                :class="[
                  currentPath === '/users/new'
                    ? 'bg-gray-700 border-blue-500 text-blue-300 shadow-sm'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100 border-transparent',
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md border-l-4 transition-all duration-200'
                ]"
              >
                <PlusIcon class="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300 transition-colors duration-200" />
                Add Member
              </router-link>
            </div>

            <!-- Teams Sidebar -->
            <div v-else-if="currentPath.startsWith('/teams')" class="space-y-2">
              <router-link
                to="/teams"
                :class="[
                  currentPath === '/teams'
                    ? 'bg-gray-700 border-blue-500 text-blue-300 shadow-sm'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100 border-transparent',
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md border-l-4 transition-all duration-200'
                ]"
              >
                <UserGroupIcon class="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300 transition-colors duration-200" />
                All Teams
              </router-link>
              
              <router-link
                v-if="can('create', 'Team')"
                to="/teams/new"
                :class="[
                  currentPath === '/teams/new'
                    ? 'bg-gray-700 border-blue-500 text-blue-300 shadow-sm'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100 border-transparent',
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md border-l-4 transition-all duration-200'
                ]"
              >
                <PlusIcon class="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300 transition-colors duration-200" />
                Create Team
              </router-link>
            </div>

            <!-- Events Sidebar -->
            <div v-else-if="currentPath.startsWith('/events')" class="space-y-2">
              <router-link
                to="/events"
                :class="[
                  currentPath === '/events'
                    ? 'bg-gray-700 border-blue-500 text-blue-300 shadow-sm'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100 border-transparent',
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md border-l-4 transition-all duration-200'
                ]"
              >
                <CalendarIcon class="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300 transition-colors duration-200" />
                All Events
              </router-link>
              
              <router-link
                v-if="can('create', 'Event')"
                to="/events/new"
                :class="[
                  currentPath === '/events/new'
                    ? 'bg-gray-700 border-blue-500 text-blue-300 shadow-sm'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100 border-transparent',
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md border-l-4 transition-all duration-200'
                ]"
              >
                <PlusIcon class="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300 transition-colors duration-200" />
                Create Event
              </router-link>
            </div>

            <!-- Tasks Sidebar -->
            <div v-else-if="currentPath.startsWith('/tasks')" class="space-y-2">
              <router-link
                to="/tasks"
                :class="[
                  currentPath === '/tasks'
                    ? 'bg-gray-700 border-blue-500 text-blue-300 shadow-sm'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100 border-transparent',
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md border-l-4 transition-all duration-200'
                ]"
              >
                <CogIcon class="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300 transition-colors duration-200" />
                All Tasks
              </router-link>
            </div>

            <!-- Profile Sidebar -->
            <div v-else-if="currentPath === '/profile'" class="space-y-2">
              <div class="bg-gray-700 rounded-lg p-3">
                <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Profile Settings
                </h3>
                <div class="space-y-2">
                  <div class="text-sm text-gray-300">
                    Manage your account settings, interests, and preferences
                  </div>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </div>

      <!-- Main Content -->
      <div class="min-w-0 flex-1 p-4 sm:p-6">
        <!-- Mobile Sidebar Toggle Button -->
        <button
          v-if="isMobile"
          @click="isSidebarOpen = true"
          class="mb-4 inline-flex items-center px-3 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Menu
        </button>

        <!-- Breadcrumb Navigation -->
        <nav v-if="breadcrumbs.length > 0" class="mb-6">
          <ol class="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-400 overflow-x-auto">
            <li v-for="(crumb, index) in breadcrumbs" :key="crumb.path" class="flex items-center flex-shrink-0">
              <router-link
                v-if="index < breadcrumbs.length - 1"
                :to="crumb.path"
                class="text-gray-400 hover:text-gray-200 transition-colors"
              >
                {{ crumb.name }}
              </router-link>
              <span v-else class="text-gray-100 font-medium">
                {{ crumb.name }}
              </span>
              <ChevronRightIcon
                v-if="index < breadcrumbs.length - 1"
                class="h-3 w-3 sm:h-4 sm:w-4 mx-1 sm:mx-2 text-gray-500 flex-shrink-0"
              />
            </li>
          </ol>
        </nav>
        
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'
import { usePermissions } from '@/composables/usePermissions'
import { initiateOAuthLogin } from '@/utils/oauth'
import {
  UsersIcon,
  UserGroupIcon,
  CalendarIcon,
  CogIcon,
  ChevronRightIcon,
  PlusIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const teamStore = useTeamStore()
const { can, canManageUsers, canManageTeams, canManageEvents, canManageTasks } = usePermissions()

const isUserMenuOpen = ref(false)
const isMobileMenuOpen = ref(false)
const isSidebarOpen = ref(false)
const isMobile = ref(false)

// Initialize mobile state immediately
const initializeMobileState = () => {
  isMobile.value = window.innerWidth < 768
  // Always start with sidebar closed on mobile
  if (isMobile.value) {
    isSidebarOpen.value = false
  }
}

// Initialize immediately
initializeMobileState()

// Current path for sidebar logic
const currentPath = computed(() => route.path)

// Navigation items for top bar - filtered by permissions
const navigationItems = computed(() => {
  const items = [
    { name: 'Dashboard', to: '/dashboard' }
  ]
  
  // Only show admin/exec board sections to users with appropriate permissions
  if (canManageUsers()) {
    items.push({ name: 'Users', to: '/users' })
  }
  
  if (canManageTeams()) {
    items.push({ name: 'Teams', to: '/teams' })
  }
  
  if (canManageEvents()) {
    items.push({ name: 'Events', to: '/events' })
    items.push({ name: 'Series', to: '/series' })
  }

  if (canManageTasks()) {
    items.push({ name: 'Tasks', to: '/tasks' })
  }
  
  return items
})

// Helper function to determine if a navigation item is active
const isNavigationItemActive = (itemPath: string) => {
  const currentPath = route.path
  
  // Special case for dashboard - only active when exactly on dashboard
  if (itemPath === '/dashboard') {
    return currentPath === '/dashboard'
  }
  
  // For other items, check if current path starts with the item path
  // This handles nested routes like /users/123, /teams/456/edit, etc.
  return currentPath.startsWith(itemPath)
}

// Current section title and description
const currentSectionTitle = computed(() => {
  const currentPath = route.path
  
  if (currentPath === '/dashboard') {
    return 'Dashboard'
  } else if (currentPath === '/profile') {
    return 'Your Profile'
  } else if (currentPath.startsWith('/users')) {
    if (currentPath === '/users/new') {
      return 'Create User'
    } else if (currentPath.includes('/edit')) {
      return 'Edit User'
    } else if (currentPath.match(/\/users\/[^\/]+$/)) {
      return 'User Details'
    }
    return 'Users'
  } else if (currentPath.startsWith('/teams')) {
    if (currentPath === '/teams/new') {
      return 'Create Team'
    } else if (currentPath.includes('/edit')) {
      return 'Edit Team'
    } else if (currentPath.match(/\/teams\/[^\/]+$/)) {
      return 'Team Details'
    }
    return 'Teams'
  } else if (currentPath.startsWith('/events')) {
    if (currentPath === '/events/new') {
      return 'Create Event'
    } else if (currentPath.includes('/edit')) {
      return 'Edit Event'
    } else if (currentPath.includes('/checkin')) {
      return 'Event Check-In'
    } else if (currentPath.match(/\/events\/[^\/]+$/)) {
      return 'Event Details'
    }
    return 'Events'
  } else if (currentPath.startsWith('/tasks')) {
    return 'Tasks'
  }
  
  return 'Navigation'
})

const currentSectionDescription = computed(() => {
  const currentPath = route.path
  
  if (currentPath === '/dashboard') {
    return 'Overview and key metrics'
  } else if (currentPath === '/profile') {
    return 'Manage your account settings and preferences'
  } else if (currentPath.startsWith('/users')) {
    if (currentPath === '/users/new') {
      return 'Add a new user to the system'
    } else if (currentPath.includes('/edit')) {
      return 'Modify user information'
    } else if (currentPath.match(/\/users\/[^\/]+$/)) {
      return 'View user details and activity'
    }
    return 'Manage system users'
  } else if (currentPath.startsWith('/teams')) {
    if (currentPath === '/teams/new') {
      return 'Create a new team'
    } else if (currentPath.includes('/edit')) {
      return 'Modify team information'
    } else if (currentPath.match(/\/teams\/[^\/]+$/)) {
      return 'View team details and members'
    }
    return 'Manage teams and memberships'
  } else if (currentPath.startsWith('/events')) {
    if (currentPath === '/events/new') {
      return 'Schedule a new event'
    } else if (currentPath.includes('/edit')) {
      return 'Modify event information'
    } else if (currentPath.includes('/checkin')) {
      return 'Check in event attendees'
    } else if (currentPath.match(/\/events\/[^\/]+$/)) {
      return 'View event details and attendees'
    }
    return 'Manage events and schedules'
  } else if (currentPath.startsWith('/tasks')) {
    return 'Manage tasks and assignments'
  }
  
  return 'Navigate through the system'
})

// Breadcrumb navigation
const breadcrumbs = computed(() => {
  const currentPath = route.path
  const crumbs = [{ name: 'Home', path: '/dashboard' }]
  
  if (currentPath === '/dashboard') {
    return crumbs
  }
  
  if (currentPath === '/profile') {
    crumbs.push({ name: 'Your Profile', path: currentPath })
  } else if (currentPath.startsWith('/users')) {
    crumbs.push({ name: 'Users', path: '/users' })
    if (currentPath === '/users/new') {
      crumbs.push({ name: 'Create User', path: currentPath })
    } else if (currentPath.includes('/edit')) {
      crumbs.push({ name: 'Edit User', path: currentPath })
    } else if (currentPath.match(/\/users\/[^\/]+$/)) {
      crumbs.push({ name: 'User Details', path: currentPath })
    }
  } else if (currentPath.startsWith('/teams')) {
    crumbs.push({ name: 'Teams', path: '/teams' })
    if (currentPath === '/teams/new') {
      crumbs.push({ name: 'Create Team', path: currentPath })
    } else if (currentPath.includes('/edit')) {
      crumbs.push({ name: 'Edit Team', path: currentPath })
    } else if (currentPath.match(/\/teams\/[^\/]+$/)) {
      crumbs.push({ name: 'Team Details', path: currentPath })
    }
  } else if (currentPath.startsWith('/events')) {
    crumbs.push({ name: 'Events', path: '/events' })
    if (currentPath === '/events/new') {
      crumbs.push({ name: 'Create Event', path: currentPath })
    } else if (currentPath.includes('/edit')) {
      crumbs.push({ name: 'Edit Event', path: currentPath })
    } else if (currentPath.includes('/checkin')) {
      crumbs.push({ name: 'Event Check-In', path: currentPath })
    } else if (currentPath.match(/\/events\/[^\/]+$/)) {
      crumbs.push({ name: 'Event Details', path: currentPath })
    }
  } else if (currentPath.startsWith('/series')) {
    crumbs.push({ name: 'Workshop Series', path: '/series' })
    if (currentPath === '/series/new') {
      crumbs.push({ name: 'Create Series', path: currentPath })
    } else if (currentPath.includes('/edit')) {
      crumbs.push({ name: 'Edit Series', path: currentPath })
    } else if (currentPath.match(/\/series\/[^\/]+$/)) {
      crumbs.push({ name: 'Series Details', path: currentPath })
    }
  } else if (currentPath.startsWith('/tasks')) {
    crumbs.push({ name: 'Tasks', path: '/tasks' })
  }
  
  return crumbs
})

// User initials for avatar
const userInitials = computed(() => {
  const user = authStore.user
  if (!user) return '?'
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
})

// Handle logout
const handleLogout = async () => {
  isUserMenuOpen.value = false
  // The authStore.logout() now handles OIDC provider logout automatically
  await authStore.logout()
}

// Mobile menu toggle with better touch handling
const toggleMobileMenu = () => {
  // Clear the just opened flag first
  menuJustOpened.value = false
  
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  
  // Close user menu when opening mobile menu
  if (isMobileMenuOpen.value) {
    isUserMenuOpen.value = false
    // Set flag to prevent immediate closing
    menuJustOpened.value = true
    // Clear flag after a short delay
    setTimeout(() => {
      menuJustOpened.value = false
    }, 150)
  }
}

// Close mobile menu
const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

// Track if menu was just opened to prevent immediate closing
const menuJustOpened = ref(false)

// Mobile detection
const checkMobile = () => {
  const wasMobile = isMobile.value
  isMobile.value = window.innerWidth < 768 // md breakpoint
  
  // Reset menu states when switching between mobile/desktop
  if (wasMobile !== isMobile.value) {
    isMobileMenuOpen.value = false
    isSidebarOpen.value = false
    isUserMenuOpen.value = false
  }
  
  // Always close sidebar on mobile devices
  if (isMobile.value) {
    isSidebarOpen.value = false
  }
}

// Close menus when clicking outside
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  
  // Don't close if menu was just opened
  if (menuJustOpened.value) {
    return
  }
  
  // Don't close if clicking on the mobile menu button
  if (target.closest('[data-mobile-menu-button]')) {
    return
  }
  
  // Close user menu if clicking outside user menu area
  if (!target.closest('[data-user-menu]')) {
    isUserMenuOpen.value = false
  }
  
  // Close mobile menu if clicking outside navigation area
  if (!target.closest('[data-mobile-menu]') && 
      !target.closest('[data-mobile-menu-button]') &&
      !target.closest('nav')) {
    isMobileMenuOpen.value = false
  }
}

// Handle touch events for mobile
const handleTouchOutside = (event: TouchEvent) => {
  const target = event.target as HTMLElement
  
  // Don't close if menu was just opened
  if (menuJustOpened.value) {
    return
  }
  
  // Don't close if touching the mobile menu button
  if (target.closest('[data-mobile-menu-button]')) {
    return
  }
  
  // Close user menu if touching outside user menu area
  if (!target.closest('[data-user-menu]')) {
    isUserMenuOpen.value = false
  }
  
  // Close mobile menu if touching outside navigation area
  if (!target.closest('[data-mobile-menu]') && 
      !target.closest('[data-mobile-menu-button]') &&
      !target.closest('nav')) {
    isMobileMenuOpen.value = false
  }
}

// Watch for route changes to close mobile menu
watch(() => route.path, () => {
  isMobileMenuOpen.value = false
  // Also close sidebar on mobile when navigating
  if (isMobile.value) {
    isSidebarOpen.value = false
  }
})

onMounted(async () => {
  // Wait for DOM to be ready, then run mobile check
  await nextTick()
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('touchstart', handleTouchOutside, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('touchstart', handleTouchOutside)
})

// Navigation functions for create buttons
const createUser = () => {
  router.push('/users/new')
}

const createTeam = () => {
  // Navigate to teams page and trigger the modal
  router.push('/teams')
  // Use nextTick to ensure navigation completes before opening modal
  nextTick(() => {
    teamStore.openCreateModal()
  })
}

const createEvent = () => {
  router.push('/events/new')
}
</script>
