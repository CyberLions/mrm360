import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiService from '@/services/api'
import type { Event, EventCreate, EventUpdate, EventFilters, PaginatedResponse, PublicRsvpEvent } from '@/types/api'

export const useEventStore = defineStore('events', () => {
  // State
  const events = ref<Event[]>([])
  const currentEvent = ref<Event | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const filters = ref<EventFilters>({
    page: 1,
    limit: 20,
    sortBy: 'startTime',
    sortOrder: 'asc'
  })

  // Getters
  const upcomingEvents = computed(() => 
    events.value.filter(event => 
      new Date(event.startTime) > new Date()
    ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  )

  const pastEvents = computed(() => 
    events.value.filter(event => 
      new Date(event.endTime) < new Date()
    ).sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
  )

  const activeEvents = computed(() => 
    events.value.filter(event => new Date(event.startTime) > new Date())
  )

  const upcomingAndOngoingEvents = computed(() => 
    events.value.filter(event => {
      if (!event.startTime || !event.endTime) return false
      const now = new Date()
      const endTime = new Date(event.endTime)
      // Include events that haven't ended yet (upcoming or ongoing)
      return endTime > now
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  )

  const eventsByTeam = computed(() => (teamId: string) => 
    events.value.filter(event => 
      event.linkedTeamId === teamId
    )
  )

  // Actions
  async function fetchEvents(newFilters?: Partial<EventFilters>) {
    try {
      isLoading.value = true
      error.value = null
      
      if (newFilters) {
        filters.value = { ...filters.value, ...newFilters }
      }
      
      const response: PaginatedResponse<Event> = await apiService.getEvents(filters.value)
      
      events.value = response.data ?? []
      pagination.value = response.pagination
      
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch events'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchEvent(id: string) {
    try {
      isLoading.value = true
      error.value = null
      
      const event = await apiService.getEvent(id)
      currentEvent.value = event
      
      return event
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch event'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchEventByCheckInCode(checkInCode: string) {
    try {
      isLoading.value = true
      error.value = null
      
      const event = await apiService.getEventByCheckInCode(checkInCode)
      currentEvent.value = event
      
      return event
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch event'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Resolves the public RSVP code. Returns a trimmed event shape (no roster),
  // so it deliberately does not populate `currentEvent`.
  async function fetchEventByRsvpCode(rsvpCode: string): Promise<PublicRsvpEvent> {
    try {
      isLoading.value = true
      error.value = null

      return await apiService.getEventByRsvpCode(rsvpCode)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch event'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function createEvent(eventData: EventCreate) {
    try {
      isLoading.value = true
      error.value = null
      
      const newEvent = await apiService.createEvent(eventData)
      events.value.unshift(newEvent)
      pagination.value.total += 1
      
      return newEvent
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create event'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateEvent(id: string, eventData: EventUpdate) {
    try {
      isLoading.value = true
      error.value = null
      
      const updatedEvent = await apiService.updateEvent(id, eventData)
      
      // Update in events array
      const index = events.value.findIndex(event => event.id === id)
      if (index !== -1) {
        events.value[index] = updatedEvent
      }
      
      // Update current event if it's the same
      if (currentEvent.value?.id === id) {
        currentEvent.value = updatedEvent
      }
      
      return updatedEvent
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update event'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteEvent(id: string) {
    try {
      isLoading.value = true
      error.value = null
      
      await apiService.deleteEvent(id)
      
      // Remove from events array
      const index = events.value.findIndex(event => event.id === id)
      if (index !== -1) {
        events.value.splice(index, 1)
        pagination.value.total -= 1
      }
      
      // Clear current event if it's the same
      if (currentEvent.value?.id === id) {
        currentEvent.value = null
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete event'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function rsvpToEvent(eventId: string, attending: boolean) {
    try {
      const result = await apiService.rsvpToEvent(eventId, attending)
      
      // Update event in store
      const event = events.value.find(e => e.id === eventId)
      if (event) {
        // This would need to be updated based on the current user
        // For now, we'll just mark it as updated
        event.updatedAt = new Date().toISOString()
      }
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to RSVP to event'
      throw err
    }
  }

  async function checkInUser(eventId: string, userId: string) {
    try {
      const result = await apiService.checkInUser(eventId, userId)
      
      // Refresh the current event to get updated check-ins
      if (currentEvent.value?.id === eventId) {
        await fetchEvent(eventId)
      }
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to check in user'
      throw err
    }
  }

  async function checkInWithQR(eventId: string, qrCode: string) {
    try {
      const result = await apiService.checkInWithQR(eventId, qrCode)
      
      // Refresh the current event to get updated check-ins
      if (currentEvent.value?.id === eventId) {
        await fetchEvent(eventId)
      }
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to check in with QR code'
      throw err
    }
  }

  // Event Teams methods
  async function getEventTeams(eventId: string) {
    try {
      const result = await apiService.getEventTeams(eventId)
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch event teams'
      throw err
    }
  }

  async function createEventTeams(eventId: string, membersPerTeam: number = 4, wiretapWorkshopId?: string, assignmentType: string = 'manual') {
    try {
      const result = await apiService.createEventTeams(eventId, membersPerTeam, wiretapWorkshopId, assignmentType)
      
      // Refresh the current event to get updated teams
      if (currentEvent.value?.id === eventId) {
        await fetchEvent(eventId)
      }
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create event teams'
      throw err
    }
  }

  async function createEventTeam(eventId: string) {
    try {
      const result = await apiService.createEventTeam(eventId)
      
      // Refresh the current event to get updated teams
      if (currentEvent.value?.id === eventId) {
        await fetchEvent(eventId)
      }
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create event team'
      throw err
    }
  }

  async function addTeamMember(eventId: string, teamId: string, email: string) {
    try {
      const result = await apiService.addTeamMember(eventId, teamId, email)
      
      // Refresh the current event to get updated teams
      if (currentEvent.value?.id === eventId) {
        await fetchEvent(eventId)
      }
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add team member'
      throw err
    }
  }

  async function removeTeamMember(eventId: string, teamId: string, email: string) {
    try {
      const result = await apiService.removeTeamMember(eventId, teamId, email)
      
      // Refresh the current event to get updated teams
      if (currentEvent.value?.id === eventId) {
        await fetchEvent(eventId)
      }
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove team member'
      throw err
    }
  }

  async function deleteEventTeam(eventId: string, teamId: string) {
    try {
      const result = await apiService.deleteEventTeam(eventId, teamId)
      
      // Refresh the current event to get updated teams
      if (currentEvent.value?.id === eventId) {
        await fetchEvent(eventId)
      }
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete event team'
      throw err
    }
  }

  async function syncEventTeams(eventId: string, syncType: string, membersPerTeam: number = 4) {
    try {
      const result = await apiService.syncEventTeams(eventId, syncType, membersPerTeam)
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to sync event teams'
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  function resetFilters() {
    filters.value = {
      page: 1,
      limit: 20,
      sortBy: 'startTime',
      sortOrder: 'asc'
    }
  }

  // Enable teams for an event
  async function enableEventTeams(eventId: string) {
    try {
      const result = await apiService.enableEventTeams(eventId)
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to enable teams'
      throw err
    }
  }

  return {
    // State
    events,
    currentEvent,
    isLoading,
    error,
    pagination,
    filters,
    
    // Getters
    upcomingEvents,
    pastEvents,
    activeEvents,
    upcomingAndOngoingEvents,
    eventsByTeam,
    
    // Actions
    fetchEvents,
    fetchEvent,
    fetchEventByCheckInCode,
    fetchEventByRsvpCode,
    createEvent,
    updateEvent,
    deleteEvent,
    rsvpToEvent,
    checkInUser,
    checkInWithQR,
    getEventTeams,
    createEventTeams,
    createEventTeam,
    addTeamMember,
    removeTeamMember,
    deleteEventTeam,
    syncEventTeams,
    enableEventTeams,
    clearError,
    resetFilters
  }
})
