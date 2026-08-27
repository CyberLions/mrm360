<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
      <!-- Progress Bar -->
      <div class="mb-8">
        <div class="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div class="flex items-center">
            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
            <span class="ml-2 text-sm font-medium text-gray-100">Account Created</span>
          </div>
          
          <div class="hidden sm:block w-16 h-0.5 bg-gray-600"></div>
          
          <div class="flex items-center">
            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </div>
            <span class="ml-2 text-sm font-medium text-gray-100">Discord Verified</span>
          </div>
          
          <div class="hidden sm:block w-16 h-0.5 bg-gray-600"></div>
          
          <div class="flex items-center">
            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span class="text-white font-bold text-sm">3</span>
            </div>
            <span class="ml-2 text-sm font-medium text-gray-100">Select Interests</span>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 mb-6 sm:mb-8 border border-gray-700">
        <div class="text-center mb-6 sm:mb-8">
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-100 mb-3 sm:mb-4">
            Step 3: Tell Us About Your Interests
          </h1>
          <p class="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto px-4">
            Help us understand your interests so we can assign you to the right teams and channels. 
            You can always update these preferences later.
          </p>
        </div>

        <form @submit.prevent="submitInterests" class="space-y-6 sm:space-y-8">
          <!-- Class Rank Selection -->
          <div>
            <h2 class="text-lg sm:text-xl font-semibold text-gray-100 mb-3 sm:mb-4">
              What's your relationship with Penn State?
            </h2>
            <p class="text-sm text-gray-400 mb-4">
              This helps us assign you to the appropriate role and understand our membership demographics.
            </p>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <label 
                v-for="rank in classRanks" 
                :key="rank.value"
                class="relative flex cursor-pointer rounded-lg border border-gray-600 bg-gray-700 p-4 shadow-sm focus:outline-none hover:border-blue-500 touch-manipulation"
                :class="{ 'border-blue-500 ring-2 ring-blue-500': selectedClassRank === rank.value }"
              >
                <input
                  type="radio"
                  name="classRank"
                  :value="rank.value"
                  v-model="selectedClassRank"
                  class="sr-only"
                />
                <div class="flex flex-1">
                  <div class="flex flex-col">
                    <span class="block text-sm font-medium text-gray-100">{{ rank.label }}</span>
                    <span class="mt-1 flex items-center text-sm text-gray-400">{{ rank.description }}</span>
                  </div>
                </div>
                <div class="ml-3 flex h-6 w-6 items-center justify-center">
                  <div 
                    class="h-5 w-5 rounded-full border-2 flex items-center justify-center"
                    :class="selectedClassRank === rank.value ? 'border-blue-500 bg-blue-500' : 'border-gray-500'"
                  >
                    <div v-if="selectedClassRank === rank.value" class="h-2.5 w-2.5 rounded-full bg-white"></div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- Club Interests Selection -->
          <div>
            <h2 class="text-lg sm:text-xl font-semibold text-gray-100 mb-3 sm:mb-4">
              What interests you most about cybersecurity?
            </h2>
            <p class="text-sm text-gray-400 mb-4">
              Select all that apply. This helps us assign you to relevant teams and channels.
            </p>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <label 
                v-for="interest in clubInterests" 
                :key="interest.value"
                class="relative flex cursor-pointer rounded-lg border border-gray-600 bg-gray-700 p-4 shadow-sm focus:outline-none hover:border-green-500 touch-manipulation"
                :class="{ 'border-green-500 ring-2 ring-green-500': selectedInterests.includes(interest.value) }"
              >
                <input
                  type="checkbox"
                  :value="interest.value"
                  v-model="selectedInterests"
                  class="sr-only"
                />
                <div class="flex flex-1">
                  <div class="flex flex-col">
                    <div class="flex items-center space-x-2">
                      <span class="text-lg">{{ interest.emoji }}</span>
                      <span class="block text-sm font-medium text-gray-100">{{ interest.label }}</span>
                    </div>
                    <span class="mt-1 flex items-center text-sm text-gray-400">{{ interest.description }}</span>
                  </div>
                </div>
                <div class="ml-3 flex h-6 w-6 items-center justify-center">
                  <div 
                    class="h-5 w-5 rounded border-2 flex items-center justify-center"
                    :class="selectedInterests.includes(interest.value) ? 'border-green-500 bg-green-500' : 'border-gray-500'"
                  >
                    <svg v-if="selectedInterests.includes(interest.value)" class="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- Newsletter Subscription -->
          <div>
            <h2 class="text-lg sm:text-xl font-semibold text-gray-100 mb-3 sm:mb-4">
              Stay Updated
            </h2>
            <div class="flex items-start space-x-3">
              <input
                id="newsletter"
                type="checkbox"
                v-model="subscribeNewsletter"
                class="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-500 rounded mt-1 bg-gray-700"
              />
              <div>
                <label for="newsletter" class="text-sm font-medium text-gray-100">
                  Subscribe to our newsletter
                </label>
                <p class="text-sm text-gray-400 mt-1">
                  Get updates about upcoming events, competitions, workshops, and club news delivered to your email.
                </p>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-4 sm:pt-6">
            <button
              type="submit"
              :disabled="isSubmitting || !canSubmit"
              class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 min-h-[48px] touch-manipulation"
            >
              <svg v-if="isSubmitting" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              <span>{{ isSubmitting ? 'Setting up your account...' : 'Complete Onboarding' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const selectedClassRank = ref('')
const selectedInterests = ref<string[]>(['OFFENSE', 'DEFENSE', 'CTF'])
const subscribeNewsletter = ref(true)
const isSubmitting = ref(false)

const classRanks = [
  { value: 'FIRST_YEAR', label: '1st Year', description: 'First year student' },
  { value: 'SECOND_YEAR', label: '2nd Year', description: 'Second year student' },
  { value: 'THIRD_YEAR', label: '3rd Year', description: 'Third year student' },
  { value: 'FOURTH_YEAR', label: '4th Year', description: 'Fourth year student' },
  { value: 'ALUMNI_OTHER', label: 'Alumni/Other', description: 'Alumni, industry professionals, etc.' }
]

const clubInterests = [
  { 
    value: 'OFFENSE', 
    emoji: '⚔️', 
    label: 'Offense (CPTC)', 
    description: 'For people interested in offensive security and penetration testing. This is also for people interested in our CPTC competition team!' 
  },
  { 
    value: 'DEFENSE', 
    emoji: '🛡️', 
    label: 'Defense (CCDC)', 
    description: 'For people interested in defensive security and security monitoring. This is also for people interested in our CCDC competition team!' 
  },
  { 
    value: 'CTF', 
    emoji: '🏳️', 
    label: 'CTF', 
    description: 'For people interested in competing in CTFs such as NCL and PicoCTF. This is also for people interested in other platforms such as Hack the Box, TryHackMe, and Blue team labs online!' 
  },
  { 
    value: 'GAMING', 
    emoji: '🎮', 
    label: 'Gaming', 
    description: 'For people interested in hanging out with club members and playing video games. Some of the games include Minecraft, Among Us, and Escape From Tarkov!' 
  }
]

const canSubmit = computed(() => {
  return selectedClassRank.value && selectedInterests.value.length > 0
})

async function submitInterests() {
  if (!canSubmit.value) return
  
  isSubmitting.value = true
  
  try {
    const response = await fetch(`${window.ENV.VITE_API_BASE_URL}/onboarding/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.accessToken}`
      },
      body: JSON.stringify({
        classRank: selectedClassRank.value,
        interests: selectedInterests.value,
        subscribeNewsletter: subscribeNewsletter.value
      })
    })
    
    if (response.ok) {
      // Refresh the session so the router guard sees the now-complete
      // onboarding status before we navigate to the (gated) dashboard.
      await authStore.checkAuth()
      router.push('/dashboard?onboarding=complete')
    } else {
      const errorData = await response.json()
      console.error('Failed to submit interests:', errorData)
      alert('Failed to submit interests. Please try again.')
    }
  } catch (error) {
    console.error('Error submitting interests:', error)
    alert('An error occurred. Please try again.')
  } finally {
    isSubmitting.value = false
  }
}
</script>
