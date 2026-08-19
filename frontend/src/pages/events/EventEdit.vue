<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">
            {{ isEditing ? 'Edit Event' : 'Create New Event' }}
          </h1>
          <p class="mt-2 text-sm text-gray-400">
            {{ isEditing ? 'Update event details and settings' : 'Set up a new event for your organization' }}
          </p>
        </div>
        <router-link
          to="/events"
          class="inline-flex items-center px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Events
        </router-link>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Main Content -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Form -->
        <div class="bg-gray-800 rounded-lg shadow border border-gray-700">
          <form @submit.prevent="handleSubmit" class="space-y-6 p-6">
          <!-- Provisioning Progress -->
          <div v-if="provisionTask" class="mb-4 p-4 border border-blue-600 rounded-md bg-blue-900">
            <div class="flex items-center justify-between mb-2">
              <div class="font-medium text-blue-200">Setting up event resources</div>
              <div class="text-sm text-blue-300">{{ provisionTask.progress }}%</div>
            </div>
            <div class="w-full bg-blue-800 rounded h-2 overflow-hidden">
              <div class="bg-blue-400 h-2" :style="{ width: provisionTask.progress + '%' }"></div>
            </div>
            <ul class="mt-3 space-y-1">
              <li v-for="sub in sortedSubtasks" :key="sub.id" class="flex items-center text-sm">
                <span class="w-4 h-4 mr-2" :class="{
                  'text-green-400': sub.status === 'COMPLETED',
                  'text-blue-400': sub.status === 'RUNNING',
                  'text-gray-400': sub.status === 'PENDING',
                  'text-red-400': sub.status === 'FAILED'
                }">
                  <svg v-if="sub.status === 'COMPLETED'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                  <svg v-else-if="sub.status === 'RUNNING'" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                  <svg v-else-if="sub.status === 'FAILED'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                </span>
                <span class="flex-1 text-blue-200">{{ sub.name }}</span>
                <span class="text-xs text-blue-300">{{ sub.progress }}%</span>
              </li>
            </ul>
          </div>
            <!-- Basic Information -->
            <div>
              <h3 class="text-lg font-medium text-gray-100 mb-4">Basic Information</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="title" class="block text-sm font-medium text-gray-300 mb-2">
                  Event Title *
                </label>
                <input
                  id="title"
                  v-model="form.title"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                  :class="{ 'border-red-500': errors.title }"
                  placeholder="Enter event title"
                />
                <p v-if="errors.title" class="mt-1 text-sm text-red-400">{{ errors.title }}</p>
              </div>

              <div>
                <label for="category" class="block text-sm font-medium text-gray-300 mb-2">
                  Category
                </label>
                <select
                  id="category"
                  v-model="form.category"
                  class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                >
                  <option value="MEETING">Meeting</option>
                  <option value="COMPETITION">Competition</option>
                  <option value="WORKSHOP">Workshop</option>
                  <option value="SOCIAL">Social</option>
                  <option value="TRAINING">Training</option>
                </select>
              </div>

            </div>

            <div>
              <label for="description" class="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                id="description"
                v-model="form.description"
                rows="3"
                class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                placeholder="Enter event description"
              ></textarea>
            </div>
          </div>

            <!-- Date and Time -->
            <div>
              <h3 class="text-lg font-medium text-gray-100 mb-4">Date and Time</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="startTime" class="block text-sm font-medium text-gray-300 mb-2">
                  Start Time *
                </label>
                <input
                  id="startTime"
                  v-model="form.startTime"
                  type="datetime-local"
                  required
                  class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                  :class="{ 'border-red-500': errors.startTime }"
                />
                <p v-if="errors.startTime" class="mt-1 text-sm text-red-400">{{ errors.startTime }}</p>
              </div>

              <div>
                <label for="endTime" class="block text-sm font-medium text-gray-300 mb-2">
                  End Time *
                </label>
                <input
                  id="endTime"
                  v-model="form.endTime"
                  type="datetime-local"
                  required
                  class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                  :class="{ 'border-red-500': errors.endTime }"
                />
                <p v-if="errors.endTime" class="mt-1 text-sm text-red-400">{{ errors.endTime }}</p>
              </div>
            </div>
          </div>

            <!-- Event Settings -->
            <div>
              <h3 class="text-lg font-medium text-gray-100 mb-4">Event Settings</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="attendanceType" class="block text-sm font-medium text-gray-300 mb-2">
                  Attendance Type
                </label>
                <select
                  id="attendanceType"
                  v-model="form.attendanceType"
                  class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                >
                  <option value="SOFT">Soft (Link-based attendance)</option>
                  <option value="STRICT">Strict (QR code scanning)</option>
                </select>
              </div>

              <div>
                <label for="linkedTeam" class="block text-sm font-medium text-gray-300 mb-2">
                  Linked Team
                </label>
                <select
                  id="linkedTeam"
                  v-model="form.linkedTeamId"
                  class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                >
                  <option value="">No team (visible to all members)</option>
                  <option v-for="team in availableTeams" :key="team.id" :value="team.id">
                    {{ team.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="wiretapWorkshop" class="block text-sm font-medium text-gray-300 mb-2">
                  Wiretap Workshop
                </label>
                <select
                  id="wiretapWorkshop"
                  v-model="form.wiretapWorkshopId"
                  class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                >
                  <option value="">No workshop</option>
                  <option v-for="workshop in availableWorkshops" :key="workshop.id" :value="workshop.id">
                    {{ workshop.name }}
                  </option>
                </select>
                <p class="mt-1 text-sm text-gray-400">
                  Select a Wiretap workshop for this event
                </p>
              </div>

              <div>
                <label for="series" class="block text-sm font-medium text-gray-300 mb-2">
                  Workshop Series
                </label>
                <select
                  id="series"
                  v-model="form.seriesId"
                  class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                >
                  <option value="">No series</option>
                  <option v-for="s in availableSeries" :key="s.id" :value="s.id">
                    {{ s.name }} ({{ s.requiredCheckIns }} check-ins for badge)
                  </option>
                </select>
                <p class="mt-1 text-sm text-gray-400">
                  Assign to a series to track attendance toward a badge
                </p>
              </div>
            </div>

            <!-- Attendance Cap Settings -->
            <div>
              <h3 class="text-lg font-medium text-gray-100 mb-4">Attendance Cap Settings</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label for="attendanceCap" class="block text-sm font-medium text-gray-300 mb-2">
                    Attendance Cap
                  </label>
                  <input
                    id="attendanceCap"
                    v-model.number="form.attendanceCap"
                    type="number"
                    min="1"
                    class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                    placeholder="Leave empty for no limit"
                  />
                  <p class="mt-1 text-sm text-gray-400">
                    Maximum number of attendees (leave empty for unlimited)
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">
                    Waitlist Settings
                  </label>
                  <div class="space-y-2">
                    <label class="flex items-center">
                      <input
                        v-model="form.waitlistEnabled"
                        type="checkbox"
                        class="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                        :disabled="!form.attendanceCap"
                      />
                      <span class="ml-2 text-sm text-gray-300">Enable waitlist when cap is reached</span>
                    </label>
                    <p class="text-xs text-gray-400">
                      When enabled, users will be added to a waitlist if the event reaches capacity
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

            <!-- Team Settings -->
            <div>
              <h3 class="text-lg font-medium text-gray-100 mb-4">Team Settings</h3>
              <div class="space-y-6">
                <!-- Enable Teams Toggle -->
                <div>
                  <label class="flex items-center">
                    <input
                      v-model="form.teamsEnabled"
                      type="checkbox"
                      class="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                    />
                    <span class="ml-2 text-sm font-medium text-gray-300">Enable Teams for this Event</span>
                  </label>
                  <p class="mt-1 text-sm text-gray-400">
                    When enabled, attendees can be organized into teams for collaborative activities
                  </p>
                </div>

                <!-- Team Configuration (only shown when teams are enabled) -->
                <div v-if="form.teamsEnabled" class="space-y-4 pl-6 border-l-2 border-gray-600">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label for="membersPerTeam" class="block text-sm font-medium text-gray-300 mb-2">
                        Members per Team
                      </label>
                      <input
                        id="membersPerTeam"
                        v-model.number="form.membersPerTeam"
                        type="number"
                        min="1"
                        max="20"
                        class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                        placeholder="4"
                      />
                      <p class="mt-1 text-sm text-gray-400">
                        Maximum number of members per team (1-20)
                      </p>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-2">
                        Team Assignment
                      </label>
                      <div class="space-y-2">
                        <label class="flex items-center">
                          <input
                            v-model="form.autoAssignEnabled"
                            type="checkbox"
                            class="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                          />
                          <span class="ml-2 text-sm text-gray-300">Auto-assign confirmed RSVPs to teams</span>
                        </label>
                        <p class="text-xs text-gray-400">
                          Automatically assign confirmed attendees to teams when they check in
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="flex items-center">
                      <input
                        v-model="form.allowTeamSwitching"
                        type="checkbox"
                        class="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                      />
                      <span class="ml-2 text-sm font-medium text-gray-300">Allow Team Switching</span>
                    </label>
                    <p class="mt-1 text-sm text-gray-400">
                      Allow attendees to switch between teams themselves (requires check-in)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Form Actions -->
            <div class="flex justify-end space-x-3 pt-6 border-t border-gray-700">
              <BaseButton
                @click="goBack"
                variant="outline"
              >
                Cancel
              </BaseButton>
              <BaseButton
                type="submit"
                :loading="isSubmitting"
                :disabled="!isFormValid"
              >
                {{ isEditing ? 'Update Event' : 'Create Event' }}
              </BaseButton>
            </div>
          </form>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Event Information -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Event Information
            </h3>
            <div class="space-y-4">
              <div>
                <h4 class="text-sm font-medium text-gray-300 mb-2">Event Categories</h4>
                <div class="space-y-2 text-sm text-gray-400">
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span>Meeting - Regular club meetings</span>
                  </div>
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span>Competition - Competitive events</span>
                  </div>
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    <span>Workshop - Learning sessions</span>
                  </div>
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                    <span>Social - Social gatherings</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 class="text-sm font-medium text-gray-300 mb-2">Attendance Types</h4>
                <div class="space-y-2 text-sm text-gray-400">
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span>Soft - Members scan a link to mark attendance</span>
                  </div>
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                    <span>Strict - Scan member QR codes for attendance</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Help -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Need Help?
            </h3>
            <div class="space-y-3 text-sm text-gray-400">
              <p>
                Events will be automatically provisioned across all integrated services including Nextcloud calendar and Discord notifications.
              </p>
              <p>
                <strong>Linked Team:</strong> If you link a team, the event will only be visible to members of that team, and all team members will receive automatic notifications about the event.
              </p>
              <p>
                <strong>Soft attendance:</strong> Members can scan a link to mark their attendance remotely.
              </p>
              <p>
                <strong>Strict attendance:</strong> Requires scanning member QR codes at the event location.
              </p>
              <p>
                Wiretap workshops can be linked to provide additional resources for technical events.
              </p>
              <p>
                <strong>Attendance Cap:</strong> Set a maximum number of attendees. When reached, new RSVPs will be added to a waitlist (if enabled) or declined.
              </p>
              <p>
                <strong>Waitlist:</strong> When enabled, users who RSVP after the cap is reached will be placed on a waitlist and automatically promoted when spots become available.
              </p>
              <p>
                <strong>Teams:</strong> Enable teams to organize attendees into groups for collaborative activities. You can set the maximum members per team, enable auto-assignment, and allow team switching.
              </p>
              <p>
                <strong>Auto-assignment:</strong> Automatically assigns confirmed attendees to teams when they check in, ensuring balanced team sizes.
              </p>
              <p>
                <strong>Team Switching:</strong> Allows attendees to switch between teams themselves after checking in, giving them flexibility in team selection.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventStore } from '@/stores/eventStore'
import { useTaskStore } from '@/stores/taskStore'
import { useTeamStore } from '@/stores/teamStore'

import { usePermissions } from '@/composables/usePermissions'
import { useSeriesStore } from '@/stores/seriesStore'
import type { Task } from '@/types/api'
import BaseButton from '@/components/common/BaseButton.vue'
import type { Team } from '@/types/api'
import apiService from '@/services/api'

const route = useRoute()
const router = useRouter()
const eventStore = useEventStore()
const taskStore = useTaskStore()
const teamStore = useTeamStore()
const seriesStore = useSeriesStore()

usePermissions()

const eventId = computed(() => route.params.id as string)
const isEditing = computed(() => !!eventId.value)

const submitting = ref(false)
const teams = ref<Team[]>([])
const workshops = ref<any[]>([])

const form = ref({
  title: '',
  description: '',
  category: 'MEETING' as 'MEETING' | 'COMPETITION' | 'WORKSHOP' | 'SOCIAL' | 'TRAINING',
  startTime: '',
  endTime: '',
  attendanceType: 'SOFT' as 'SOFT' | 'STRICT',
  linkedTeamId: '' as string,
  wiretapWorkshopId: '' as string,
  attendanceCap: null as number | null,
  waitlistEnabled: false,
  teamsEnabled: false,
  membersPerTeam: 4 as number,
  autoAssignEnabled: false,
  allowTeamSwitching: false,
  seriesId: '' as string
})

const errors = ref<Record<string, string>>({})
const provisionTask = ref<Task | null>(null)
let provisionTimer: number | null = null

onMounted(async () => {
  await Promise.all([
    loadTeams(),
    loadWorkshops(),
    seriesStore.fetchAllSeries()
  ])
  
  if (isEditing.value) {
    await loadEvent()
  }
})

const loadTeams = async () => {
  try {
    await teamStore.fetchTeams()
  } catch (error) {
    console.error('Failed to load teams:', error)
  }
}

const loadWorkshops = async () => {
  try {
    const response = await apiService.getWiretapWorkshops()
    workshops.value = response.data || []
  } catch (error) {
    console.error('Failed to load workshops:', error)
    workshops.value = []
  }
}



const loadEvent = async () => {
  try {
    const event = await eventStore.fetchEvent(eventId.value)
    if (event) {
      form.value = {
        title: event.title || '',
        description: event.description || '',
        category: (event.category as any) || 'MEETING',
        startTime: event.startTime ? formatDateTimeLocal(event.startTime) : '',
        endTime: event.endTime ? formatDateTimeLocal(event.endTime) : '',
        attendanceType: event.attendanceType || 'SOFT',
        linkedTeamId: event.linkedTeamId || '',
        wiretapWorkshopId: (event as any).wiretapWorkshopId || '',
        attendanceCap: event.attendanceCap || null,
        waitlistEnabled: event.waitlistEnabled || false,
        teamsEnabled: event.teamsEnabled || false,
        membersPerTeam: event.membersPerTeam || 4,
        autoAssignEnabled: event.autoAssignEnabled || false,
        allowTeamSwitching: event.allowTeamSwitching || false,
        seriesId: (event as any).seriesId || ''
      }
    }
  } catch (error) {
    console.error('Failed to load event:', error)
  }
}



const validateForm = (): boolean => {
  errors.value = {}
  
  if (!form.value.title.trim()) {
    errors.value.title = 'Event title is required'
  }
  
  if (!form.value.startTime) {
    errors.value.startTime = 'Start time is required'
  }
  
  if (form.value.endTime && form.value.startTime) {
    const startTime = new Date(form.value.startTime)
    const endTime = new Date(form.value.endTime)
    
    if (endTime <= startTime) {
      errors.value.endTime = 'End time must be after start time'
    }
  }
  
  return Object.keys(errors.value).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) return
  
  submitting.value = true
  
  try {
    const eventData = {
      ...form.value,
      startTime: new Date(form.value.startTime).toISOString(),
      endTime: form.value.endTime ? new Date(form.value.endTime).toISOString() : new Date(form.value.startTime).toISOString(),
      // Convert empty strings to undefined for optional fields
      description: form.value.description && form.value.description.trim() !== '' ? form.value.description : undefined,
      linkedTeamId: form.value.linkedTeamId && form.value.linkedTeamId.trim() !== '' ? form.value.linkedTeamId : undefined,
      wiretapWorkshopId: form.value.wiretapWorkshopId && form.value.wiretapWorkshopId.trim() !== '' ? form.value.wiretapWorkshopId : undefined,
      seriesId: form.value.seriesId && form.value.seriesId.trim() !== '' ? form.value.seriesId : undefined,
      // Remove null/0 attendanceCap if not set
      attendanceCap: form.value.attendanceCap && form.value.attendanceCap > 0 ? form.value.attendanceCap : undefined,
      // Team settings
      teamsEnabled: form.value.teamsEnabled,
      membersPerTeam: form.value.teamsEnabled ? form.value.membersPerTeam : undefined,
      autoAssignEnabled: form.value.teamsEnabled ? form.value.autoAssignEnabled : undefined,
      allowTeamSwitching: form.value.teamsEnabled ? form.value.allowTeamSwitching : undefined
    }
    
    console.log('Event data being sent:', eventData)
    
    if (isEditing.value) {
      await eventStore.updateEvent(eventId.value, eventData)
      router.push(`/events/${eventId.value}`)
    } else {
      const created = await eventStore.createEvent(eventData)
      startProvisionPolling('EVENT', created.id)
      router.push(`/events/${created.id}`)
    }
  } catch (error) {
    console.error('Failed to save event:', error)
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  router.back()
}

const formatDateTimeLocal = (dateString: string): string => {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const startProvisionPolling = (entityType: 'EVENT' | 'TEAM', entityId: string) => {
  if (provisionTimer) {
    clearInterval(provisionTimer)
    provisionTimer = null
  }
  provisionTask.value = {
    id: '',
    name: 'Provision',
    status: 'RUNNING',
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subtasks: []
  } as any
  provisionTimer = window.setInterval(async () => {
    try {
      const resp = await taskStore.fetchTasks({ entityType, entityId, page: 1, limit: 1 })
      const task = resp.data[0]
      if (task) {
        provisionTask.value = task as any
        if (task.status === 'COMPLETED' || task.status === 'FAILED') {
          if (provisionTimer) clearInterval(provisionTimer)
          provisionTimer = null
        }
      }
    } catch (e) {
      // ignore polling errors
    }
  }, 1000)
}

const sortedSubtasks = computed(() => (provisionTask.value?.subtasks || []).slice().sort((a, b) => a.stepIndex - b.stepIndex))

// Computed properties
const availableTeams = computed(() => teamStore.teams)
const availableWorkshops = computed(() => workshops.value)
const availableSeries = computed(() => seriesStore.seriesList)

const isSubmitting = computed(() => submitting.value)

const isFormValid = computed(() => {
  return form.value.title.trim() !== '' && 
         form.value.startTime !== '' &&
         Object.keys(errors.value).length === 0
})
</script>
