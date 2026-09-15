<template>
  <div class="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p class="mt-4 text-sm text-gray-400">Loading event...</p>
      </div>

      <!-- Event RSVP Form -->
      <div v-else-if="event" class="bg-gray-800 shadow rounded-lg border border-gray-700 p-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold text-gray-100 mb-2">{{ event.title }}</h2>
          <p class="text-gray-400 mb-6">
            {{ formatDate(event.startTime) }} at {{ formatTime(event.startTime) }}
          </p>

          <!-- Confirmed -->
          <div v-if="rsvpStatus === 'confirmed'" class="mb-6">
            <div class="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-green-400 mb-2">You're Going!</h3>
            <p class="text-gray-300">Your RSVP is confirmed. We've emailed you the details.</p>
          </div>

          <!-- Waitlisted -->
          <div v-else-if="rsvpStatus === 'waitlist'" class="mb-6">
            <div class="w-16 h-16 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-yellow-400 mb-2">You're on the Waitlist</h3>
            <p class="text-gray-300">This event is at capacity. We'll email you if a spot opens up.</p>
          </div>

          <!-- Declined by the user -->
          <div v-else-if="rsvpStatus === 'declined'" class="mb-6">
            <div class="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-300 mb-2">You've Declined</h3>
            <p class="text-gray-400 mb-4">You're marked as not attending. Changed your mind?</p>
            <BaseButton
              @click="submitRsvp(true)"
              variant="primary"
              :loading="submitting"
              class="w-full"
            >
              RSVP Anyway
            </BaseButton>
          </div>

          <!-- Event is full, no waitlist -->
          <div v-else-if="rsvpStatus === 'full'" class="mb-6">
            <div class="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-red-400 mb-2">Event Is Full</h3>
            <p class="text-gray-300">This event is at capacity and has no waitlist.</p>
          </div>

          <!-- Failure -->
          <div v-else-if="rsvpStatus === 'error'" class="mb-6">
            <div class="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-red-400 mb-2">RSVP Failed</h3>
            <p class="text-gray-300">{{ errorMessage }}</p>
          </div>

          <!-- RSVP Buttons -->
          <div v-else class="mb-6 space-y-3">
            <p v-if="spotsRemaining !== null" class="text-sm text-gray-400 mb-3">
              {{ spotsRemaining }} of {{ event.attendanceCap }} spots remaining
            </p>
            <BaseButton
              @click="submitRsvp(true)"
              variant="primary"
              size="lg"
              :loading="submitting"
              class="w-full"
            >
              {{ event.willWaitlist ? 'Join the Waitlist' : "I'm Attending" }}
            </BaseButton>
            <BaseButton
              @click="submitRsvp(false)"
              variant="secondary"
              :loading="submitting"
              class="w-full"
            >
              Can't Make It
            </BaseButton>
          </div>

          <!-- Finish-onboarding nudge: the RSVP is recorded either way, but a
               member who scanned a flyer before onboarding still needs to
               complete the join flow. -->
          <div
            v-if="isResolved && !authStore.hasCompletedOnboarding"
            class="text-left bg-blue-900/40 border border-blue-700 rounded-lg p-4 mb-6"
          >
            <h4 class="text-sm font-medium text-blue-200 mb-1">One more step</h4>
            <p class="text-sm text-blue-100 mb-3">
              Your RSVP is saved. Finish setting up your account to get Discord access and event reminders.
            </p>
            <BaseButton variant="primary" size="sm" class="w-full" @click="router.push('/join')">
              Finish Setting Up
            </BaseButton>
          </div>

          <!-- Event Details -->
          <div class="text-left bg-gray-700 rounded-lg p-4 mb-6">
            <h4 class="text-sm font-medium text-gray-400 mb-2">Event Details</h4>
            <div class="space-y-2 text-sm text-gray-300">
              <div><span class="font-medium">Category:</span> {{ event.category }}</div>
              <div><span class="font-medium">Ends:</span> {{ formatDate(event.endTime) }} at {{ formatTime(event.endTime) }}</div>
              <div v-if="event.linkedTeam">
                <span class="font-medium">Team:</span> {{ event.linkedTeam.name }}
              </div>
              <div v-if="event.description">
                <span class="font-medium">Description:</span> {{ event.description }}
              </div>
            </div>
          </div>

          <!-- View Event Details Button -->
          <BaseButton
            v-if="authStore.hasCompletedOnboarding"
            @click="viewEventDetails"
            variant="primary"
            class="w-full mb-3"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Event Details
          </BaseButton>

          <!-- Back Button -->
          <BaseButton
            v-if="authStore.hasCompletedOnboarding"
            @click="goBack"
            variant="secondary"
            class="w-full"
          >
            Back to Dashboard
          </BaseButton>
        </div>
      </div>

      <!-- Error State -->
      <div v-else class="text-center">
        <div class="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-100 mb-2">Unable to Load Event</h3>
        <p class="text-gray-400 mb-6">{{ errorMessage || 'The RSVP code is invalid or the event doesn\'t exist.' }}</p>
        <BaseButton
          @click="goBack"
          variant="secondary"
        >
          Back to Dashboard
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventStore } from '@/stores/eventStore'
import { useAuthStore } from '@/stores/authStore'
import BaseButton from '@/components/common/BaseButton.vue'
import type { PublicRsvpEvent } from '@/types/api'
import { useToast } from 'vue-toastification'

const route = useRoute()
const router = useRouter()
const eventStore = useEventStore()
const authStore = useAuthStore()
const toast = useToast()

type RsvpState = 'idle' | 'confirmed' | 'waitlist' | 'declined' | 'full' | 'error'

const event = ref<PublicRsvpEvent | null>(null)
const loading = ref(false)
const submitting = ref(false)
const rsvpStatus = ref<RsvpState>('idle')
const errorMessage = ref('')

const rsvpCode = computed(() => route.params.code as string)

// True once the RSVP has actually landed one way or another, so the onboarding
// nudge only appears after we've saved something.
const isResolved = computed(() =>
  ['confirmed', 'waitlist', 'declined'].includes(rsvpStatus.value)
)

const spotsRemaining = computed(() => {
  if (!event.value?.attendanceCap) return null
  return Math.max(0, event.value.attendanceCap - event.value.confirmedCount)
})

// Maps a stored RSVP onto a panel. PENDING and MAYBE have no panel of their
// own, so they fall through to the RSVP form.
const STATE_FOR_STATUS = {
  CONFIRMED: 'confirmed',
  WAITLIST: 'waitlist',
  DECLINED: 'declined'
} as const

const httpErrorMessage = (error: any, fallback: string) => {
  const status = error?.response?.status
  if (status === 401) return 'You need to be logged in to RSVP to this event.'
  if (status === 403) return 'You do not have permission to RSVP to this event.'
  if (status === 404) return 'Event not found. The RSVP code may be invalid or the event may have been removed.'
  if (status >= 500) return 'Server error occurred. Please try again later.'
  return fallback
}

onMounted(async () => {
  await loadEvent()
})

const loadEvent = async () => {
  try {
    loading.value = true
    const eventData = await eventStore.fetchEventByRsvpCode(rsvpCode.value)
    event.value = eventData

    // Reflect an RSVP the user already has, so a re-scan isn't a blank form.
    const existing = STATE_FOR_STATUS[eventData.myRsvpStatus as keyof typeof STATE_FOR_STATUS] ?? 'idle'
    const alreadyIn = existing === 'confirmed' || existing === 'waitlist'

    // A full event with no waitlist cannot take a new RSVP, so say so before
    // the user taps rather than after a round trip.
    rsvpStatus.value =
      !alreadyIn && eventData.isFull && !eventData.willWaitlist ? 'full' : existing
  } catch (error: any) {
    console.error('Failed to load event:', error)
    event.value = null
    errorMessage.value = httpErrorMessage(
      error,
      'Failed to load event details. Please check your connection and try again.'
    )
  } finally {
    loading.value = false
  }
}

const submitRsvp = async (attending: boolean) => {
  if (!event.value) return

  submitting.value = true

  try {
    const result = await eventStore.rsvpToEvent(event.value.id, attending)

    if (!result.success) {
      rsvpStatus.value = 'error'
      errorMessage.value = result.message || 'RSVP failed'
      toast.error(errorMessage.value)
      return
    }

    if (result.status === 'CONFIRMED') {
      rsvpStatus.value = 'confirmed'
      toast.success('You\'re confirmed for this event!')
    } else if (result.status === 'WAITLIST') {
      rsvpStatus.value = 'waitlist'
      toast.info('This event is full - you\'ve been added to the waitlist.')
    } else if (result.status === 'DECLINED') {
      // The backend returns DECLINED both when the user declines and when a
      // capped event with no waitlist is full. The full case is already caught
      // at load, so reaching it here means the event filled in the meantime.
      if (attending) {
        rsvpStatus.value = 'full'
        toast.error('This event is at capacity and has no waitlist.')
      } else {
        rsvpStatus.value = 'declined'
        toast.success('Thanks for letting us know.')
      }
    } else {
      rsvpStatus.value = 'confirmed'
      toast.success(result.message || 'RSVP recorded.')
    }
  } catch (error: any) {
    console.error('Failed to RSVP:', error)
    rsvpStatus.value = 'error'

    errorMessage.value = httpErrorMessage(error, 'An unexpected error occurred. Please try again.')
    toast.error(errorMessage.value)
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  router.push('/dashboard')
}

const viewEventDetails = () => {
  if (event.value?.id) {
    router.push(`/events/${event.value.id}`)
  }
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'TBD'
  return new Date(dateString).toLocaleDateString()
}

const formatTime = (dateString?: string) => {
  if (!dateString) return 'TBD'
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>
