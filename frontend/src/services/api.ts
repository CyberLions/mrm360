import axios, { AxiosInstance, AxiosResponse } from 'axios'
import type {
  ApiResponse,
  PaginatedResponse,
  User,
  UserCreate,
  UserUpdate,
  Team,
  TeamCreate,
  TeamUpdate,
  Event,
  EventCreate,
  EventUpdate,
  Group,
  Task,
  DashboardStats,
  UserFilters,
  EventFilters,
  TeamFilters,
  TeamProvisioningStatus,
  WorkshopSeries,
  WorkshopSeriesCreate,
  WorkshopSeriesUpdate,
  BadgeClass
  , InventoryItem, InventoryBin, ItemLoan
} from '@/types/api'

class ApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: window.ENV.VITE_API_BASE_URL,
      timeout: 10000,
      withCredentials: true, // Include cookies in requests
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor - add JWT token to requests
    this.api.interceptors.request.use(
      async (config) => {
        // Get token from localStorage directly to avoid timing issues with Pinia
        const token = localStorage.getItem('accessToken')
        console.log('API request interceptor - token from localStorage:', token ? 'exists' : 'missing')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
          console.log('Authorization header set for:', config.url)
        } else {
          console.log('No token found for request to:', config.url)
          // If no token and this is not an auth endpoint, this might indicate an auth issue
          if (!config.url?.includes('/auth/')) {
            console.warn('No token found for non-auth request:', config.url)
            // Store current URL for redirect after login
            const currentUrl = window.location.pathname + window.location.search
            
            // Import auth store dynamically to avoid circular dependencies
            const { useAuthStore } = await import('@/stores/authStore')
            const authStore = useAuthStore()
            
            // If user is not authenticated, trigger login with redirect
            if (!authStore.isAuthenticated) {
              console.log('No authentication found, triggering login...')
              await authStore.handleNoAuthentication(currentUrl)
            }
          }
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor to handle auth errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        console.log('API response error:', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message
        });
        
        // Handle authentication errors (401 only - 403 is permission denied, not auth failure)
        if (error.response?.status === 401) {
          // Only handle auth errors for non-auth endpoints to avoid infinite loops
          if (!error.config?.url?.includes('/auth/')) {
            console.log('Authentication error detected, triggering re-login...')
            
            // Store current URL for redirect after login
            const currentUrl = window.location.pathname + window.location.search
            
            // Import auth store dynamically to avoid circular dependencies
            const { useAuthStore } = await import('@/stores/authStore')
            const authStore = useAuthStore()
            
            // Trigger re-login with current URL for redirect
            await authStore.triggerReLogin(currentUrl)
          }
        }
        
        return Promise.reject(error)
      }
    )
  }

  // Auth endpoints - these now use custom JWT endpoints
  async login(username: string, password: string): Promise<ApiResponse<any>> {
    // This is now handled by the auth store directly
    throw new Error('Use authStore.login() instead')
  }

  async logout(): Promise<void> {
    // This is now handled by the auth store directly
    throw new Error('Use authStore.logout() instead')
  }

  // User endpoints
  async getUsers(filters?: UserFilters): Promise<PaginatedResponse<User>> {
    const response = await this.api.get('/users', { params: filters })
    return response.data
  }

  async getUser(id: string): Promise<User> {
    const response = await this.api.get(`/users/${id}`)
    return response.data.data
  }

  async createUser(userData: UserCreate): Promise<User> {
    const response = await this.api.post('/users', userData)
    return response.data.data
  }

  async updateUser(id: string, userData: UserUpdate): Promise<User> {
    const response = await this.api.put(`/users/${id}`, userData)
    return response.data.data
  }

  async deleteUser(id: string): Promise<void> {
    await this.api.delete(`/users/${id}`)
  }

  // Team endpoints
  async getTeams(filters?: TeamFilters): Promise<PaginatedResponse<Team>> {
    const response = await this.api.get('/teams', { params: filters })
    return response.data
  }

  async getTeam(id: string): Promise<Team> {
    const response = await this.api.get(`/teams/${id}`)
    return response.data
  }

  async createTeam(teamData: TeamCreate): Promise<Team> {
    const response = await this.api.post('/teams', teamData)
    return response.data
  }

  async updateTeam(id: string, teamData: TeamUpdate): Promise<Team> {
    const response = await this.api.put(`/teams/${id}`, teamData)
    return response.data
  }

  async deleteTeam(id: string): Promise<void> {
    try {
      await this.api.delete(`/teams/${id}`)
    } catch (error: any) {
      const serverMessage = error?.response?.data?.error
      const message = serverMessage || error?.message || 'Failed to delete team'
      throw new Error(message)
    }
  }

  // Team Provisioning Status
  async getTeamProvisioningStatus(teamId: string): Promise<TeamProvisioningStatus | null> {
    try {
      const response = await this.api.get(`/teams/${teamId}/provisioning-status`)
      return response.data
    } catch (error) {
      // If endpoint doesn't exist yet, return null
      return null
    }
  }

  // Event endpoints
  async getEvents(filters?: EventFilters): Promise<PaginatedResponse<Event>> {
    const response = await this.api.get('/events', { params: filters })
    return response.data
  }

  async getSemesters(): Promise<{ teams: string[]; events: string[] }> {
    const response = await this.api.get('/semesters')
    return response.data
  }

  async getEvent(id: string): Promise<Event> {
    const response = await this.api.get(`/events/${id}`)
    return response.data.data
  }

  async getEventByCheckInCode(checkInCode: string): Promise<Event> {
    const response = await this.api.get(`/events/checkin/${checkInCode}`)
    return response.data.data
  }

  async createEvent(eventData: EventCreate): Promise<Event> {
    const response = await this.api.post('/events', eventData)
    return response.data.data
  }

  async updateEvent(id: string, eventData: EventUpdate): Promise<Event> {
    const response = await this.api.put(`/events/${id}`, eventData)
    return response.data.data
  }

  async deleteEvent(id: string): Promise<void> {
    await this.api.delete(`/events/${id}`)
  }

  async rsvpToEvent(eventId: string, attending: boolean): Promise<{ success: boolean; message: string; status: string }> {
    const response = await this.api.post(`/events/${eventId}/rsvp`, { attending })
    return response.data
  }

  async checkInUser(eventId: string, userId: string): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      const response = await this.api.post(`/events/${eventId}/checkin`, { userId })
      return response.data
    } catch (error: any) {
      // If the server returns an error response, extract the message
      if (error.response?.data) {
        return {
          success: false,
          message: error.response.data.message || error.response.data.error || 'Check-in failed'
        }
      }
      // For network errors or other issues
      throw error
    }
  }

  async deleteCheckIn(eventId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.api.delete(`/events/${eventId}/checkin`, {
      data: { userId }
    })
    return response.data
  }

  async checkInWithQR(eventId: string, qrCode: string): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      const response = await this.api.post(`/events/${eventId}/checkin`, { qrCode })
      return response.data
    } catch (error: any) {
      // If the server returns an error response, extract the message
      if (error.response?.data) {
        return {
          success: false,
          message: error.response.data.message || error.response.data.error || 'Check-in failed'
        }
      }
      // For network errors or other issues
      throw error
    }
  }

  // Group endpoints
  async getGroups(): Promise<PaginatedResponse<Group>> {
    const response = await this.api.get('/groups')
    return response.data
  }

  async getGroup(id: string): Promise<Group> {
    const response = await this.api.get(`/groups/${id}`)
    return response.data.data
  }

  // Task endpoints
  async getTasks(params?: { page?: number; limit?: number; entityType?: string; entityId?: string }): Promise<PaginatedResponse<Task>> {
    const response = await this.api.get('/tasks', { params })
    return response.data
  }

  async getTask(id: string): Promise<Task> {
    const response = await this.api.get(`/tasks/${id}`)
    return response.data.data
  }

  async enqueueTask(taskName: 'email' | 'qr-code' | 'sync-groups' | 'provision-team' | 'provision-event' | 'payment-status', data: any = {}): Promise<{ success: boolean; jobId: string; backgroundTaskId?: string; message?: string }> {
    const response = await this.api.post('/tasks/enqueue', { type: taskName, data })
    return response.data
  }

  // Dashboard endpoints
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.api.get('/dashboard/stats')
    return response.data.data
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await this.api.get('/health')
    return response.data
  }

  async getInventory(): Promise<{ items: InventoryItem[]; bins: InventoryBin[]; canManage: boolean }> {
    return (await this.api.get('/inventory')).data
  }

  async createInventoryItems(items: Array<{ barcode: string; name: string; binId?: string | null; binName?: string; room?: string }>): Promise<{ items: InventoryItem[] }> {
    return (await this.api.post('/inventory', { items })).data
  }

  async createInventoryBin(data: { name: string; room?: string | null; code?: string | null; description?: string | null }): Promise<InventoryBin> {
    return (await this.api.post('/inventory/bins', data)).data.bin
  }

  async getInventoryBins(): Promise<InventoryBin[]> {
    return (await this.api.get('/inventory/bins')).data.bins
  }

  async updateInventoryBin(id: string, data: { name: string; room?: string | null; code?: string | null; description?: string | null }): Promise<InventoryBin> {
    return (await this.api.put(`/inventory/bins/${id}`, data)).data.bin
  }

  async deleteInventoryBin(id: string): Promise<void> {
    await this.api.delete(`/inventory/bins/${id}`)
  }

  async getInventoryItem(id: string): Promise<InventoryItem & { loans: ItemLoan[] }> {
    return (await this.api.get(`/inventory/items/${id}`)).data.item
  }

  async updateInventoryItem(id: string, data: { binId?: string | null; name?: string }): Promise<InventoryItem> {
    return (await this.api.put(`/inventory/items/${id}`, data)).data.item
  }

  async moveInventoryItem(id: string, binId: string | null): Promise<InventoryItem> {
    return this.updateInventoryItem(id, { binId })
  }

  async inventoryTransaction(data: { action: 'checkout' | 'checkin'; barcode: string; memberCode?: string; binId?: string | null; selfCheckout?: boolean; note?: string }): Promise<{ message: string }> {
    return (await this.api.post('/inventory/transaction', data)).data
  }

  async getInventoryHistory(userId?: string): Promise<{ loans: ItemLoan[] }> {
    return (await this.api.get('/inventory/history', { params: userId ? { userId } : undefined })).data
  }

  async generateInventoryBarcode(): Promise<string> {
    return (await this.api.post('/inventory/generate-barcode')).data.barcode
  }

  // Wiretap endpoints
  async getWiretapWorkshops(): Promise<{ success: boolean; data: any[] }> {
    const response = await this.api.get('/wiretap/workshops')
    return response.data
  }

  // Event Teams endpoints
  async getEventTeams(eventId: string): Promise<{ success: boolean; data: any[] }> {
    const response = await this.api.get(`/events/${eventId}/teams`)
    return response.data
  }

  async createEventTeams(eventId: string, membersPerTeam: number = 4, wiretapWorkshopId?: string, assignmentType: string = 'manual'): Promise<{ success: boolean; data: any[]; message: string }> {
    const response = await this.api.post(`/events/${eventId}/teams`, {
      wiretapWorkshopId,
      membersPerTeam,
      assignmentType
    })
    return response.data
  }

  async createEventTeam(eventId: string): Promise<{ success: boolean; data: any; message: string }> {
    const response = await this.api.post(`/events/${eventId}/teams/create`)
    return response.data
  }

  async enableEventTeams(eventId: string): Promise<{ success: boolean; message: string; data: any }> {
    const response = await this.api.post(`/events/${eventId}/teams/enable`)
    return response.data
  }

  async addTeamMember(eventId: string, teamId: string, email: string): Promise<{ success: boolean; data: any; message: string }> {
    const response = await this.api.post(`/events/${eventId}/teams/${teamId}/members`, {
      email
    })
    return response.data
  }

  async removeTeamMember(eventId: string, teamId: string, email: string): Promise<{ success: boolean; message: string }> {
    const response = await this.api.delete(`/events/${eventId}/teams/${teamId}/members`, {
      data: { email }
    })
    return response.data
  }

  async deleteEventTeam(eventId: string, teamId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.api.delete(`/events/${eventId}/teams/${teamId}`)
    return response.data
  }

  async syncEventTeams(eventId: string, syncType: string, membersPerTeam: number = 4): Promise<{ success: boolean; message: string; taskId?: string; results?: { usersAssigned: number; usersRemoved: number; teamsUpdated: number; wiretapSyncs: number } }> {
    const response = await this.api.post(`/events/${eventId}/teams/sync`, {
      syncType,
      membersPerTeam
    })
    return response.data
  }

  // User search
  async searchUsers(query: string, limit: number = 10): Promise<{ success: boolean; data: any[] }> {
    const response = await this.api.get(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`)
    return response.data
  }

  // Team switching
  async getUserTeamInfo(eventId: string): Promise<{ 
    allowTeamSwitching: boolean
    currentTeam: any | null
    availableTeams: any[]
  }> {
    const response = await this.api.get(`/events/${eventId}/teams/my-team`)
    return response.data
  }

  async switchTeam(eventId: string, targetTeamId: string): Promise<{ success: boolean; message: string; teamNumber: number }> {
    const response = await this.api.post(`/events/${eventId}/teams/switch`, {
      targetTeamId
    })
    return response.data
  }

  // Workshop Series endpoints
  async getSeries(): Promise<{ success: boolean; data: WorkshopSeries[] }> {
    const response = await this.api.get('/series')
    return response.data
  }

  async getSeriesById(id: string): Promise<WorkshopSeries> {
    const response = await this.api.get(`/series/${id}`)
    return response.data.data
  }

  async createSeries(data: WorkshopSeriesCreate): Promise<WorkshopSeries> {
    const response = await this.api.post('/series', data)
    return response.data.data
  }

  async updateSeries(id: string, data: WorkshopSeriesUpdate): Promise<WorkshopSeries> {
    const response = await this.api.put(`/series/${id}`, data)
    return response.data.data
  }

  async deleteSeries(id: string): Promise<void> {
    await this.api.delete(`/series/${id}`)
  }

  async getSeriesProgress(id: string): Promise<{ success: boolean; data: any }> {
    const response = await this.api.get(`/series/${id}/progress`)
    return response.data
  }

  async sendSeriesBadgeInvite(seriesId: string, userId: string): Promise<{ success: boolean; data: any }> {
    const response = await this.api.post(`/series/${seriesId}/invite`, { userId })
    return response.data
  }

  // Badge Classes (from OpenBadge)
  async getBadgeClasses(): Promise<{ success: boolean; data: BadgeClass[] }> {
    const response = await this.api.get('/series/badge-classes')
    return response.data
  }

  // User Badges
  async getUserBadges(userId: string): Promise<{ success: boolean; data: any[] }> {
    const response = await this.api.get(`/users/${userId}/badges`)
    return response.data
  }

  async sendBadgeInviteToUser(userId: string, badgeClassId: string): Promise<{ success: boolean; data: any }> {
    const response = await this.api.post(`/users/${userId}/badges`, { badgeClassId })
    return response.data
  }
}

export const apiService = new ApiService()
export default apiService
