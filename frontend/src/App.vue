<template>
  <div id="app" class="min-h-screen bg-gray-900 dark">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const route = useRoute()
const authStore = useAuthStore()

// Watch for route changes and initialize auth
watch(() => route.path, async (newPath) => {
  console.log('App - route changed, initializing auth for:', newPath)
  // Only initialize if not already authenticated
  if (!authStore.isAuthenticated) {
    await authStore.init()
  }
  
  // If we're authenticated but stores are empty, refresh them
  if (authStore.isAuthenticated && authStore.accessToken) {
    // Check if we need to refresh stores (e.g., after OAuth login)
    const { useUserStore } = await import('@/stores/userStore')
    const { useEventStore } = await import('@/stores/eventStore')
    const { useTeamStore } = await import('@/stores/teamStore')
    
    const userStore = useUserStore()
    const eventStore = useEventStore()
    const teamStore = useTeamStore()
    
    const storesNeedRefresh = userStore.users.length === 0 && 
                             eventStore.events.length === 0 && 
                             teamStore.teams.length === 0
    
    if (storesNeedRefresh) {
      console.log('App - stores appear empty, refreshing after auth...')
      await authStore.refreshStores()
    }
  }
}, { immediate: true })
</script>

<style>
html, body {
  overflow-x: hidden;
}

#app {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1f2937;
}

::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>
