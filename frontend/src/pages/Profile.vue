<template>
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-100 mb-4">
        Your Profile
      </h1>
      <p class="text-lg text-gray-300 max-w-2xl mx-auto">
        Manage your account settings, interests, and preferences
      </p>
    </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Left Column: Profile Info & QR Code -->
        <div class="lg:col-span-1 space-y-6">
          <!-- Profile Card -->
          <div class="bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-700">
            <div class="text-center">
              <div class="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-2xl font-bold text-white">
                  {{ getUserInitials(user) }}
                </span>
              </div>
              <h2 class="text-xl font-semibold text-gray-100 mb-2">
                {{ user?.displayName || `${user?.firstName} ${user?.lastName}` }}
              </h2>
              <p class="text-gray-400 mb-4">{{ user?.email }}</p>
              <div class="flex items-center justify-center space-x-2 text-sm text-gray-400">
                <span class="px-3 py-1 bg-gray-700 rounded-full">
                  {{ formatRole(user?.role) }}
                </span>
                <span class="px-3 py-1 bg-gray-700 rounded-full">
                  Member since {{ formatDate(user?.createdAt) }}
                </span>
              </div>
            </div>
          </div>

          <!-- QR Code Card -->
          <div class="bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-700">
            <h3 class="text-lg font-semibold text-gray-100 mb-4">
              Profile QR Code
            </h3>
            <div class="text-center">
              <div class="bg-white p-4 rounded-lg border-2 border-gray-600 inline-block">
                <QRCodeVue3
                  ref="qrCodeRef"
                  v-if="qrCodeValue"
                  :value="qrCodeValue"
                  :width="500"
                  :height="500"
                  :qr-options="{ errorCorrectionLevel: 'M' }"
                />
                <div v-else class="w-[500px] h-[500px] flex items-center justify-center text-gray-400">
                  Loading QR code...
                </div>
              </div>
              <p class="mt-3 text-sm text-gray-400">
                Scan this code to check in at events
              </p>
              <div class="flex space-x-2">
                <button
                  @click="downloadQRCode"
                  class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Settings -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Discord Integration -->
          <div class="bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-700">
            <h3 class="text-lg font-semibold text-gray-100 mb-4">
              Discord Integration
            </h3>
            
            <div v-if="discordAccount" class="space-y-4">
              <div class="flex items-center space-x-4 p-4 bg-gray-700 rounded-lg">
                <div class="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center">
                  <img src="@/assets/logos/discord.svg" alt="Discord" class="w-6 h-6" />
                </div>
                <div class="flex-1">
                  <p class="font-medium text-gray-100">{{ discordAccount.username }}</p>
                  <p class="text-sm text-gray-400">Linked {{ formatDate(discordAccount.linkedAt) }}</p>
                </div>
                <button
                  @click="unlinkDiscord"
                  :disabled="isUnlinkingDiscord"
                  class="bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
                >
                  <svg v-if="isUnlinkingDiscord" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span v-else>Unlink</span>
                </button>
              </div>
            </div>
            
            <div v-else class="text-center p-6 bg-gray-700 rounded-lg">
              <div class="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <img src="@/assets/logos/discord.svg" alt="Discord" class="w-8 h-8" />
              </div>
              <h4 class="text-lg font-medium text-gray-100 mb-2">No Discord Account Linked</h4>
              <p class="text-sm text-gray-400 mb-4">
                Link your Discord account to access our community channels and get role assignments
              </p>
              <div class="flex justify-center">
                <button
                  @click="linkDiscord"
                  :disabled="isLinkingDiscord"
                  class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
                >
                  <svg v-if="isLinkingDiscord" class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ isLinkingDiscord ? 'Connecting...' : 'Link Discord Account' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Interests Selection -->
          <div class="bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-700">
            <h3 class="text-lg font-semibold text-gray-100 mb-4">
              Your Interests
            </h3>
            <p class="text-sm text-gray-400 mb-6">
              Update your interests to help us assign you to the right teams and channels
            </p>
            
            <!-- Class Rank Selection -->
            <div class="mb-6">
              <h4 class="text-md font-medium text-gray-100 mb-3">
                What's your relationship with Penn State?
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <label 
                  v-for="rank in classRanks" 
                  :key="rank.value"
                  class="relative flex cursor-pointer rounded-lg border border-gray-600 bg-gray-700 p-3 shadow-sm focus:outline-none hover:border-blue-500"
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
                      <span class="mt-1 flex items-center text-xs text-gray-400">{{ rank.description }}</span>
                    </div>
                  </div>
                  <div class="ml-3 flex h-4 w-4 items-center justify-center">
                    <div 
                      class="h-3 w-3 rounded-full border-2"
                      :class="selectedClassRank === rank.value ? 'border-blue-500 bg-blue-500' : 'border-gray-500'"
                    >
                      <div v-if="selectedClassRank === rank.value" class="h-1.5 w-1.5 rounded-full bg-white mx-auto mt-0.5"></div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <!-- Club Interests Selection -->
            <div class="mb-6">
              <h4 class="text-md font-medium text-gray-100 mb-3">
                What interests you most about cybersecurity?
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label 
                  v-for="interest in clubInterests" 
                  :key="interest.value"
                  class="relative flex cursor-pointer rounded-lg border border-gray-600 bg-gray-700 p-3 shadow-sm focus:outline-none hover:border-green-500"
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
                        <span class="text-base">{{ interest.emoji }}</span>
                        <span class="block text-sm font-medium text-gray-100">{{ interest.label }}</span>
                      </div>
                      <span class="mt-1 flex items-center text-xs text-gray-400">{{ interest.description }}</span>
                    </div>
                  </div>
                  <div class="ml-3 flex h-4 w-4 items-center justify-center">
                    <div 
                      class="h-3 w-3 rounded border-2 flex items-center justify-center"
                      :class="selectedInterests.includes(interest.value) ? 'border-green-500 bg-green-500' : 'border-gray-500'"
                    >
                      <svg v-if="selectedInterests.includes(interest.value)" class="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div class="flex justify-center">
              <button
                @click="updateInterests"
                :disabled="isUpdatingInterests || !hasInterestsChanged"
                class="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
              >
                <svg v-if="isUpdatingInterests" class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{{ isUpdatingInterests ? 'Updating...' : 'Update Interests' }}</span>
              </button>
            </div>
          </div>

          <!-- Newsletter Subscription -->
          <div class="bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-700">
            <h3 class="text-lg font-semibold text-gray-100 mb-4">
              Newsletter Preferences
            </h3>
            <div class="space-y-4">
              <div class="flex items-start space-x-3">
                <input
                  id="newsletter"
                  type="checkbox"
                  v-model="subscribeNewsletter"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-500 rounded mt-1 bg-gray-700"
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
              
              <div class="flex justify-center">
                <button
                  @click="updateNewsletterPreference"
                  :disabled="isUpdatingNewsletter || !hasNewsletterChanged"
                  class="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm flex items-center justify-center"
                >
                  <svg v-if="isUpdatingNewsletter" class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ isUpdatingNewsletter ? 'Updating...' : 'Update Preference' }}</span>
                </button>
              </div>
            </div>
          </div>

          <PaymentHistoryList v-if="user?.id" :user-id="user.id" />
          <ItemCheckoutHistory v-if="user?.id" :user-id="user.id" />

          <!-- VPN Access -->
          <div class="bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-700">
            <h3 class="text-lg font-semibold text-gray-100 mb-4">
              VPN Access
            </h3>

            <!-- Member VPN -->
            <div class="mb-6">
              <h4 class="text-md font-medium text-gray-200 mb-2">Member VPN</h4>
              <p class="text-sm text-gray-400 mb-4">
                Access to CCSO internal resources and network.
              </p>
              <button
                @click="requestVPNProfile('CCSOMembers')"
                :disabled="isRequestingMemberVPN"
                class="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
              >
                <svg v-if="isRequestingMemberVPN" class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{{ isRequestingMemberVPN ? 'Processing...' : 'Enroll Member VPN' }}</span>
              </button>
            </div>

            <!-- Admin VPN (only for admins) -->
            <div v-if="user?.role === 'ADMIN'" class="pt-6 border-t border-gray-700">
              <h4 class="text-md font-medium text-gray-200 mb-2">Admin VPN</h4>
              <p class="text-sm text-gray-400 mb-4">
                Full access to OpenStack and infrastructure management components. <span class="text-yellow-400 font-semibold">Admin only.</span>
              </p>
              <button
                @click="requestVPNProfile('CCSOAdmins')"
                :disabled="isRequestingAdminVPN"
                class="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
              >
                <svg v-if="isRequestingAdminVPN" class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{{ isRequestingAdminVPN ? 'Processing...' : 'Enroll Admin VPN' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  <!-- VPN Enrollment Modal -->
  <Teleport to="body">
    <div v-if="showVPNModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/70" @click="showVPNModal = false" />
      <div class="relative bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <!-- Header -->
        <div class="flex items-start justify-between mb-6">
          <div>
            <h2 class="text-xl font-bold text-gray-100">VPN Enrollment</h2>
            <p class="text-sm text-gray-400 mt-1">
              {{ vpnEnrollment?.isNew ? 'Your VPN account has been created.' : 'A new enrollment token has been generated.' }}
            </p>
          </div>
          <button @click="showVPNModal = false" class="text-gray-400 hover:text-gray-200 ml-4">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Instructions -->
        <div class="bg-blue-900/40 border border-blue-700 rounded-lg p-4 mb-5">
          <p class="text-sm text-blue-200">
            Click <strong>Open Enrollment Portal</strong> and paste your token when prompted to set up your WireGuard VPN device.
          </p>
        </div>

        <!-- Token -->
        <div class="mb-5">
          <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Enrollment Token</label>
          <div class="flex items-center space-x-2">
            <code class="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-sm font-mono text-green-400 break-all">
              {{ vpnEnrollment?.enrollmentToken }}
            </code>
            <button
              @click="copyToClipboard(vpnEnrollment?.enrollmentToken || '')"
              class="shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg px-3 py-3"
              title="Copy token"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Open portal button -->
        <a
          :href="vpnEnrollment?.enrollmentUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors duration-200"
        >
          Open Enrollment Portal
        </a>

        <p class="text-xs text-gray-500 text-center mt-4">This token is single-use. Enroll promptly.</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import QRCodeVue3 from 'qrcode-vue3'
import type { User } from '@/types/api'
import { useToast } from 'vue-toastification'
import PaymentHistoryList from '@/components/payments/PaymentHistoryList.vue'
import ItemCheckoutHistory from '@/components/inventory/ItemCheckoutHistory.vue'

const authStore = useAuthStore()
const toast = useToast()

// State
const user = ref<User | null>(null)
const qrCodeRef = ref<any>(null)
const discordAccount = ref<any>(null)
const selectedClassRank = ref('')
const selectedInterests = ref<string[]>([])
const subscribeNewsletter = ref(false)
const originalInterests = ref<string[]>([])
const originalNewsletter = ref(false)

// Loading states
const isLinkingDiscord = ref(false)
const isUnlinkingDiscord = ref(false)
const isUpdatingInterests = ref(false)
const isUpdatingNewsletter = ref(false)
const isRequestingMemberVPN = ref(false)
const isRequestingAdminVPN = ref(false)

// VPN enrollment modal
const showVPNModal = ref(false)
const vpnEnrollment = ref<{ enrollmentToken: string; enrollmentUrl: string; isNew: boolean } | null>(null)

// Data
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
    description: 'Offensive security and penetration testing' 
  },
  { 
    value: 'DEFENSE', 
    emoji: '🛡️', 
    label: 'Defense (CCDC)', 
    description: 'Defensive security and security monitoring' 
  },
  { 
    value: 'CTF', 
    emoji: '🏳️', 
    label: 'CTF', 
    description: 'Capture the flag competitions and platforms' 
  },
  { 
    value: 'GAMING', 
    emoji: '🎮', 
    label: 'Gaming', 
    description: 'Gaming and social activities' 
  }
]

// Computed
const qrCodeValue = computed(() => {
  if (!user.value) return ''
  // Use the actual QR code from the database if available
  if (user.value.qrCode) {
    console.log('Using QR code from database:', user.value.qrCode)
    return user.value.qrCode
  }
  // Fallback to JSON format for backward compatibility
  const fallbackValue = JSON.stringify({
    userId: user.value.id,
    email: user.value.email,
    timestamp: new Date().toISOString()
  })
  console.log('Using fallback QR code value:', fallbackValue)
  return fallbackValue
})

const hasInterestsChanged = computed(() => {
  return selectedClassRank.value !== user.value?.role ||
         JSON.stringify(selectedInterests.value.sort()) !== JSON.stringify(originalInterests.value.sort())
})

const hasNewsletterChanged = computed(() => {
  return subscribeNewsletter.value !== originalNewsletter.value
})

// Methods
const getUserInitials = (user: User | null) => {
  if (!user?.firstName || !user?.lastName) return '?'
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
}

const formatRole = (role: string | undefined) => {
  if (!role) return 'Member'
  return role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'Unknown'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short'
  })
}

const downloadQRCode = async () => {
  if (!qrCodeValue.value) {
    console.error('No QR code value available')
    return
  }

  try {
    // Wait for the QR code component to be rendered
    await nextTick()
    
    // Get the image element from the displayed QR code component
    if (!qrCodeRef.value) {
      console.error('QR code component not found')
      return
    }
    
    // The QRCodeVue3 component renders an img element
    const imgElement = qrCodeRef.value.$el?.querySelector('img')
    
    if (!imgElement) {
      console.error('QR code image not found')
      return
    }

    // Get the image source URL from the img src
    const imageSrc = imgElement.src
    
    if (!imageSrc) {
      console.error('No image source found')
      return
    }

    // Create download link directly from the image source
    const link = document.createElement('a')
    link.download = `qr-code-${user.value?.firstName || 'user'}.png`
    link.href = imageSrc
    
    // Trigger download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success('QR code downloaded successfully!')
    
  } catch (error) {
    console.error('Failed to download QR code:', error)
    toast.error('Failed to download QR code. Please try again.')
  }
}

const linkDiscord = () => {
  isLinkingDiscord.value = true
  
  const clientId = window.ENV.VITE_DISCORD_CLIENT_ID
  const redirectUri = window.ENV.VITE_DISCORD_REDIRECT_URI
  
  if (!clientId || !redirectUri) {
    console.error('Discord OAuth2 configuration missing')
    isLinkingDiscord.value = false
    return
  }

  // Generate state parameter for CSRF protection
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  
  // Store state in sessionStorage with profile context
  sessionStorage.setItem('discord_oauth_state', state)
  sessionStorage.setItem('discord_oauth_context', 'profile')
  
  // Build Discord OAuth2 URL
  const authUrl = new URL('https://discord.com/api/oauth2/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'identify')
  authUrl.searchParams.set('state', state)
  
  // Redirect to Discord OAuth2
  window.location.href = authUrl.toString()
}

const unlinkDiscord = async () => {
  if (!discordAccount.value) return
  
  isUnlinkingDiscord.value = true
  
  try {
    const response = await fetch(`${window.ENV.VITE_API_BASE_URL}/user/unlink-discord`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.accessToken}`
      }
    })
    
    if (response.ok) {
      discordAccount.value = null
      await loadUserData()
    } else {
      console.error('Failed to unlink Discord account')
    }
  } catch (error) {
    console.error('Error unlinking Discord account:', error)
  } finally {
    isUnlinkingDiscord.value = false
  }
}

const updateInterests = async () => {
  if (!user.value || !hasInterestsChanged.value) return
  
  isUpdatingInterests.value = true
  
  try {
    const response = await fetch(`${window.ENV.VITE_API_BASE_URL}/user/update-interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.accessToken}`
      },
      body: JSON.stringify({
        classRank: selectedClassRank.value,
        interests: selectedInterests.value
      })
    })
    
    if (response.ok) {
      await loadUserData()
      originalInterests.value = [...selectedInterests.value]
    } else {
      console.error('Failed to update interests')
    }
  } catch (error) {
    console.error('Error updating interests:', error)
  } finally {
    isUpdatingInterests.value = false
  }
}

const updateNewsletterPreference = async () => {
  if (!user.value || !hasNewsletterChanged.value) return
  
  isUpdatingNewsletter.value = true
  
  try {
    const response = await fetch(`${window.ENV.VITE_API_BASE_URL}/user/newsletter-preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.accessToken}`
      },
      body: JSON.stringify({
        subscribe: subscribeNewsletter.value
      })
    })
    
    if (response.ok) {
      originalNewsletter.value = subscribeNewsletter.value
      toast.success('Newsletter preference updated successfully')
    } else {
      console.error('Failed to update newsletter preference')
      toast.error('Failed to update newsletter preference')
    }
  } catch (error) {
    console.error('Error updating newsletter preference:', error)
    toast.error('Error updating newsletter preference')
  } finally {
    isUpdatingNewsletter.value = false
  }
}

const requestVPNProfile = async (organization: string) => {
  if (!user.value) return

  const isAdmin = organization === 'CCSOAdmins'
  const loadingRef = isAdmin ? isRequestingAdminVPN : isRequestingMemberVPN

  loadingRef.value = true

  try {
    const response = await fetch(`${window.ENV.VITE_API_BASE_URL}/user/vpn-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.accessToken}`
      },
      body: JSON.stringify({ organization })
    })

    const data = await response.json()

    if (response.ok && data.success) {
      vpnEnrollment.value = {
        enrollmentToken: data.enrollmentToken,
        enrollmentUrl: 'https://edge.psuccso.org/enrollment-start',
        isNew: data.isNew,
      }
      showVPNModal.value = true
    } else {
      toast.error(data.error || 'Failed to request VPN enrollment')
    }
  } catch (error) {
    console.error('Error requesting VPN enrollment:', error)
    toast.error('An error occurred while requesting VPN enrollment')
  } finally {
    loadingRef.value = false
  }
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy:', error)
    toast.error('Failed to copy to clipboard')
  }
}

const loadUserData = async () => {
  try {
    // Load user data
    const userResponse = await fetch(`${window.ENV.VITE_API_BASE_URL}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${authStore.accessToken}`
      }
    })
    
    if (userResponse.ok) {
      const userData = await userResponse.json()
      
      // Map backend fields to frontend User interface
      user.value = {
        ...userData.user,
        isPaid: userData.user.paidStatus, // Map paidStatus to isPaid
        isActive: true, // Default to true since backend doesn't have this field
        authentikGroups: [], // Default empty array since backend doesn't return this
        teams: [], // Default empty array since backend doesn't return this
        events: [] // Default empty array since backend doesn't return this
      }
      
      // Use classRank from the new table, fallback to role if not set
      selectedClassRank.value = userData.user.classRank || userData.user.role
      selectedInterests.value = userData.user.interests || []
      originalInterests.value = [...selectedInterests.value]
    }
    
    // Load Discord status
    const discordResponse = await fetch(`${window.ENV.VITE_API_BASE_URL}/user/discord-status`, {
      headers: {
        'Authorization': `Bearer ${authStore.accessToken}`
      }
    })
    
    if (discordResponse.ok) {
      const discordData = await discordResponse.json()
      discordAccount.value = discordData.discordAccount
    }
    
    // Load newsletter preference
    const newsletterResponse = await fetch(`${window.ENV.VITE_API_BASE_URL}/user/newsletter-status`, {
      headers: {
        'Authorization': `Bearer ${authStore.accessToken}`
      }
    })
    
    if (newsletterResponse.ok) {
      const newsletterData = await newsletterResponse.json()
      subscribeNewsletter.value = newsletterData.subscribed
      originalNewsletter.value = newsletterData.subscribed
    }
    
  } catch (error) {
    console.error('Error loading user data:', error)
  }
}

// Load user data on mount
onMounted(async () => {
  await loadUserData()
})
</script>
