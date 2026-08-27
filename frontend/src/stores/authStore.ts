import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<AuthUser | null>(null)
  const accessToken = ref<string | null>(null)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)

  // Getters
  const isExecBoard = computed(() => {
    if (!user.value) return false
    return user.value.authentikGroups?.some(group => 
      group.toLowerCase().includes('exec') || 
      group.toLowerCase().includes('board') ||
      group.toLowerCase().includes('admin')
    ) || user.value.role === 'EXEC_BOARD'
  })

  const isAdmin = computed(() => {
    if (!user.value) return false
    return user.value.authentikGroups?.some(group => 
      group.toLowerCase().includes('admin')
    ) || user.value.role === 'ADMIN'
  })

  const userAbilities = computed(() => {
    return user.value?.abilities || []
  })

  const displayName = computed(() => {
    return user.value?.displayName || user.value?.firstName || 'User'
  })

  // Whether the authenticated user has finished the /join onboarding flow.
  // Undefined (unknown) is treated as complete so a stale cache or a failed
  // session refresh never traps an existing user on the onboarding page.
  const hasCompletedOnboarding = computed(() => user.value?.onboardingCompleted !== false)

  // Actions
  function setAuthenticated(authenticated: boolean) {
    isAuthenticated.value = authenticated
  }

  function setUser(userData: AuthUser) {
    user.value = userData
    // Store user data in localStorage for persistence
    localStorage.setItem('userData', JSON.stringify(userData))
  }

  function setToken(token: string) {
    accessToken.value = token
    // Store token in localStorage for persistence
    localStorage.setItem('accessToken', token)
    console.log('Token set in store and localStorage:', token ? 'exists' : 'missing')
  }

  async function loginWithCredentials(username: string, password: string) {
    try {
      isLoading.value = true
      
      const response = await fetch(`${window.ENV.VITE_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Store the JWT token
        setToken(data.token)
        
        // Store user data
        setUser(data.user)
        
        // Set authenticated state
        setAuthenticated(true)
        
        return true
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Login failed')
      }
    } catch (error) {
      console.error('Login failed:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function loginWithOIDC(code: string, state: string) {
    try {
      isLoading.value = true
      
      const response = await fetch(`${window.ENV.VITE_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state })
      })

      if (response.ok) {
        const data = await response.json()
        
        console.log('OIDC login response:', data)
        
        // Store the JWT token
        setToken(data.token)
        console.log('Token stored, accessToken value:', accessToken.value)
        console.log('localStorage token:', localStorage.getItem('accessToken'))
        
        // Store user data
        setUser(data.user)
        
        // Set authenticated state
        setAuthenticated(true)
        
        // Ensure token is properly set in localStorage
        localStorage.setItem('accessToken', data.token)
        localStorage.setItem('userData', JSON.stringify(data.user))
        
        console.log('Auth state after login:', {
          isAuthenticated: isAuthenticated.value,
          hasToken: !!accessToken.value,
          hasUser: !!user.value
        })
        
        return true
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'OIDC login failed')
      }
    } catch (error) {
      console.error('OIDC login failed:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      // Call backend logout endpoint first
      await fetch(`${window.ENV.VITE_API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.value}`
        }
      })
    } catch (error) {
      console.error('Backend logout error:', error)
    } finally {
      // Clear state regardless of backend response
      user.value = null
      accessToken.value = null
      isAuthenticated.value = false
      
      // Remove token from localStorage
      localStorage.removeItem('accessToken')
      localStorage.removeItem('userData')
      
      // Use OIDC provider logout
      const { initiateOAuthLogout } = await import('@/utils/oauth')
      initiateOAuthLogout()
    }
  }

  async function checkAuth() {
    try {
      // Check if we have a token
      if (!accessToken.value) {
        // Try to restore from localStorage
        const storedToken = localStorage.getItem('accessToken')
        if (storedToken) {
          accessToken.value = storedToken
          // Set authenticated state immediately to prevent flashing
          setAuthenticated(true)
          
          // Try to restore user data from localStorage
          const storedUserData = localStorage.getItem('userData')
          if (storedUserData) {
            try {
              const userData = JSON.parse(storedUserData)
              setUser(userData)
            } catch (error) {
              console.error('Failed to parse stored user data:', error)
            }
          }
        } else {
          // No token found, clear any stale auth state
          console.log('No authentication token found, clearing auth state')
          user.value = null
          accessToken.value = null
          isAuthenticated.value = false
          localStorage.removeItem('accessToken')
          localStorage.removeItem('userData')
          return false
        }
      }

      // Validate token with backend
      const response = await fetch(`${window.ENV.VITE_API_BASE_URL}/auth/session`, {
        headers: {
          'Authorization': `Bearer ${accessToken.value}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Update user data
        setUser(data.user)
        setAuthenticated(true)
        return true
      } else {
        // Token is invalid, clear everything
        console.log('Session validation failed, clearing authentication state')
        await logout()
        return false
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      // If it's a network error, we might still have a valid token
      // Only clear auth state if it's definitely an auth error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log('Network error during auth check, keeping current auth state')
        return isAuthenticated.value
      }
      await logout()
      return false
    }
  }

  function can(action: string, subject: string, conditions?: Record<string, any>): boolean {
    if (!user.value) return false
    
    // Ensure abilities is an array before calling some
    const userAbilities = user.value.abilities || []
    
    return userAbilities.some(ability => {
      if (ability.action !== action || ability.subject !== subject) {
        return false
      }
      
      if (conditions && ability.conditions) {
        return Object.keys(conditions).every(key => 
          ability.conditions?.[key] === conditions[key]
        )
      }
      
      return true
    })
  }

  // Initialize auth state
  async function init() {
    await checkAuth()
  }

  // Refresh all stores after authentication
  async function refreshStores() {
    if (!isAuthenticated.value || !accessToken.value) {
      console.warn('Cannot refresh stores - not authenticated')
      return
    }

    try {
      // Verify token synchronization
      const localStorageToken = localStorage.getItem('accessToken')
      if (localStorageToken !== accessToken.value) {
        console.warn('Token mismatch detected, synchronizing...')
        localStorage.setItem('accessToken', accessToken.value || '')
      }
      
      // Small delay to ensure token is properly set in localStorage
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Import stores dynamically to avoid circular dependencies
      const { useUserStore } = await import('@/stores/userStore')
      const { useEventStore } = await import('@/stores/eventStore')
      const { useTeamStore } = await import('@/stores/teamStore')

      const userStore = useUserStore()
      const eventStore = useEventStore()
      const teamStore = useTeamStore()

      // Refresh all stores in parallel
      await Promise.all([
        userStore.fetchUsers(),
        eventStore.fetchEvents(),
        teamStore.fetchTeams()
      ])

      console.log('All stores refreshed successfully')
    } catch (error) {
      console.error('Failed to refresh stores:', error)
    }
  }

  // Helper function to trigger re-login when session expires
  async function triggerReLogin(redirectUrl?: string) {
    console.log('Session expired, triggering re-login...')
    await logout()
    
    // Import OAuth utility dynamically to avoid circular dependencies
    const { initiateOAuthLogin } = await import('@/utils/oauth')
    initiateOAuthLogin(redirectUrl)
  }

  // Helper function to handle successful login and redirect
  async function handleSuccessfulLogin() {
    // Import router and OAuth utilities dynamically to avoid circular dependencies
    const { getStoredRedirectUrl, clearStoredRedirectUrl } = await import('@/utils/oauth')
    
    // Get the stored redirect URL
    const redirectUrl = getStoredRedirectUrl()
    
    if (redirectUrl) {
      console.log('Redirecting to stored URL after successful login:', redirectUrl)
      clearStoredRedirectUrl()
      
      // Import router dynamically to avoid circular dependencies
      const router = (await import('@/router')).default
      await router.push(redirectUrl)
    } else {
      // Default redirect to dashboard
      const router = (await import('@/router')).default
      await router.push('/dashboard')
    }
  }

  // Helper function to handle cases where no authentication is found
  async function handleNoAuthentication(redirectUrl?: string) {
    console.log('No authentication found, redirecting to login...')
    
    // Clear any stale auth state
    await logout()
    
    // Import OAuth utility dynamically to avoid circular dependencies
    const { initiateOAuthLogin } = await import('@/utils/oauth')
    initiateOAuthLogin(redirectUrl)
  }

  // Helper function to handle expired tokens
  async function handleExpiredToken(redirectUrl?: string) {
    console.log('Token expired, redirecting to login...')
    
    // Clear expired auth state
    await logout()
    
    // Import OAuth utility dynamically to avoid circular dependencies
    const { initiateOAuthLogin } = await import('@/utils/oauth')
    initiateOAuthLogin(redirectUrl)
  }

  return {
    // State
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    
    // Getters
    isExecBoard,
    isAdmin,
    userAbilities,
    displayName,
    hasCompletedOnboarding,
    
    // Actions
    loginWithCredentials,
    loginWithOIDC,
    logout,
    checkAuth,
    can,
    init,
    refreshStores,
    triggerReLogin,
    handleSuccessfulLogin,
    handleNoAuthentication,
    handleExpiredToken,
    setAuthenticated,
    setUser,
    setToken
  }
})
