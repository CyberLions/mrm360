<template>
  <div v-if="user" class="space-y-6">
    <!-- Page Header -->
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">{{ user.displayName }}</h1>
        <p class="mt-2 text-sm text-gray-400">
          Member profile and details
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3">
        <!-- Modal buttons removed - no modals in this app -->
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Profile Information -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Basic Info Card -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Basic Information
            </h3>
            <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt class="text-sm font-medium text-gray-400">Full Name</dt>
                <dd class="mt-1 text-sm text-gray-100">
                  {{ user.firstName }} {{ user.lastName }}
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Email</dt>
                <dd class="mt-1 text-sm text-gray-100">
                  <a :href="`mailto:${user.email}`" class="text-blue-400 hover:text-blue-300">
                    {{ user.email }}
                  </a>
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Display Name</dt>
                <dd class="mt-1 text-sm text-gray-100">{{ user.displayName }}</dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Member Since</dt>
                <dd class="mt-1 text-sm text-gray-100">
                  {{ formatDate(user.createdAt) }}
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Status</dt>
                <dd class="mt-1">
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      user.isActive
                        ? 'bg-green-900 text-green-200'
                        : 'bg-red-900 text-red-200'
                    ]"
                  >
                    {{ user.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Payment Status</dt>
                <dd class="mt-1">
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      user.isPaid
                        ? 'bg-green-900 text-green-200'
                        : 'bg-yellow-900 text-yellow-200'
                    ]"
                  >
                    {{ user.isPaid ? 'Paid' : 'Unpaid' }}
                  </span>
                </dd>
              </div>
              
              <div v-if="user.paidUntil">
                <dt class="text-sm font-medium text-gray-400">Paid Until</dt>
                <dd class="mt-1 text-sm text-gray-100">
                  {{ formatDate(user.paidUntil) }}
                </dd>
              </div>
              
              <div v-if="user.avatar">
                <dt class="text-sm font-medium text-gray-400">Avatar</dt>
                <dd class="mt-1">
                  <img
                    :src="user.avatar"
                    :alt="user.displayName"
                    class="h-16 w-16 rounded-full"
                  />
                </dd>
              </div>

              <!-- Discord Information -->
              <div v-if="user.discordAccount">
                <dt class="text-sm font-medium text-gray-400">Discord Username</dt>
                <dd class="mt-1 text-sm text-gray-100">
                  {{ user.discordAccount.username }}
                  <span v-if="user.discordAccount.discriminator" class="text-gray-400">
                    #{{ user.discordAccount.discriminator }}
                  </span>
                </dd>
              </div>
              <div v-if="user.discordAccount">
                <dt class="text-sm font-medium text-gray-400">Discord ID</dt>
                <dd class="mt-1 text-sm text-gray-100">
                  <code class="bg-gray-700 px-2 py-0.5 rounded">{{ user.discordAccount.discordId }}</code>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <PaymentHistoryList :user-id="user.id" />

        <!-- Teams Card -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Teams
            </h3>
            <div v-if="user.teams && user.teams.length > 0" class="space-y-3">
              <div
                v-for="team in user.teams"
                :key="team.id"
                class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
              >
                <div>
                  <h4 class="text-sm font-medium text-gray-100">{{ team.name }}</h4>
                  <p class="text-sm text-gray-400">{{ team.type }}</p>
                  <p v-if="team.description" class="text-sm text-gray-400 mt-1">
                    {{ team.description }}
                  </p>
                </div>
                <router-link
                  :to="`/teams/${team.id}`"
                  class="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  View Team
                </router-link>
              </div>
            </div>
            <div v-else class="text-center py-4">
              <UserGroupIcon class="mx-auto h-12 w-12 text-gray-400" />
              <h3 class="mt-2 text-sm font-medium text-gray-100">No teams assigned</h3>
              <p class="mt-1 text-sm text-gray-400">
                This member is not currently assigned to any teams.
              </p>
            </div>
          </div>
        </div>

        <!-- Events Card -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Events
            </h3>
            <div v-if="user.events && user.events.length > 0" class="space-y-3">
              <div
                v-for="event in user.events"
                :key="event.id"
                class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
              >
                <div>
                  <h4 class="text-sm font-medium text-gray-100">{{ event.title }}</h4>
                  <p class="text-sm text-gray-400">
                    {{ formatDate(event.startTime) }} - {{ formatDate(event.endTime) }}
                  </p>
                </div>
                <router-link
                  :to="`/events/${event.id}`"
                  class="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  View Event
                </router-link>
              </div>
            </div>
            <div v-else class="text-center py-4">
              <CalendarIcon class="mx-auto h-12 w-12 text-gray-400" />
              <h3 class="mt-2 text-sm font-medium text-gray-100">No events</h3>
              <p class="mt-1 text-sm text-gray-400">
                This member hasn't attended any events yet.
              </p>
            </div>
          </div>
        </div>

        <!-- Badges Card -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg leading-6 font-medium text-gray-100">
                Badges
              </h3>
              <button
                v-if="can('update', 'User')"
                @click="showBadgeInvite = !showBadgeInvite"
                class="text-sm text-blue-400 hover:text-blue-300"
              >
                {{ showBadgeInvite ? 'Cancel' : 'Send Badge Invite' }}
              </button>
            </div>

            <!-- Badge Invite Form -->
            <div v-if="showBadgeInvite" class="mb-4 p-4 bg-gray-750 rounded-lg border border-gray-600">
              <div v-if="loadingBadgeClasses" class="flex items-center text-sm text-gray-400">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                Loading badge classes...
              </div>
              <template v-else>
                <label class="block text-sm font-medium text-gray-300 mb-2">Select Badge Class</label>
                <select
                  v-model="selectedBadgeClassId"
                  class="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100 mb-3"
                >
                  <option value="">Choose a badge...</option>
                  <option v-for="bc in badgeClasses" :key="bc.id" :value="bc.id">
                    {{ bc.name }}
                  </option>
                </select>
                <div v-if="selectedBadgeClass" class="flex items-start space-x-3 mb-3 p-2 bg-gray-700 rounded">
                  <img
                    v-if="selectedBadgeClass.imageUrl"
                    :src="selectedBadgeClass.imageUrl"
                    :alt="selectedBadgeClass.name"
                    class="w-10 h-10 rounded object-cover"
                  />
                  <div class="text-xs text-gray-400">{{ selectedBadgeClass.description }}</div>
                </div>
                <button
                  @click="sendBadgeInvite"
                  :disabled="!selectedBadgeClassId || sendingInvite"
                  class="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center"
                >
                  <svg v-if="sendingInvite" class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ sendingInvite ? 'Sending Invite...' : 'Send Badge Invite' }}
                </button>
              </template>
            </div>

            <!-- Existing Badges -->
            <div v-if="loadingUserBadges" class="text-center py-4">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
              <p class="mt-2 text-sm text-gray-400">Loading badges...</p>
            </div>
            <div v-else-if="userBadges.length > 0" class="space-y-3">
              <div
                v-for="badge in userBadges"
                :key="badge.id"
                class="flex items-center p-3 bg-gray-700 rounded-lg"
              >
                <img
                  v-if="badge.badgeClass?.imageUrl"
                  :src="badge.badgeClass.imageUrl"
                  :alt="badge.badgeClass?.name"
                  class="w-10 h-10 rounded-lg object-cover mr-3"
                />
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-gray-100">{{ badge.badgeClass?.name || 'Unknown Badge' }}</h4>
                  <p class="text-xs text-gray-400">Invited {{ formatDate(badge.createdAt) }}</p>
                </div>
                <span
                  :class="[
                    'px-2 py-0.5 text-xs rounded-full',
                    badge.status === 'claimed'
                      ? 'bg-green-900 text-green-200'
                      : badge.status === 'pending'
                        ? 'bg-yellow-900 text-yellow-200'
                        : 'bg-gray-700 text-gray-300'
                  ]"
                >
                  {{ badge.status === 'claimed' ? 'Issued' : badge.status === 'pending' ? 'Invited' : badge.status }}
                </span>
              </div>
            </div>
            <div v-else class="text-center py-4">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-100">No badges</h3>
              <p class="mt-1 text-sm text-gray-400">
                This member hasn't earned any badges yet.
              </p>
            </div>
          </div>
        </div>

        <!-- Authentik Groups Card -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Groups
            </h3>
            <div v-if="groupStore.isLoading" class="text-center py-4">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
              <p class="mt-2 text-sm text-gray-400">Loading groups...</p>
            </div>
            <div v-else-if="userGroups.length > 0" class="flex flex-wrap gap-2">
              <span
                v-for="group in userGroups"
                :key="group.id"
                :class="[
                  'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                  group.found 
                    ? 'bg-purple-900 text-purple-200' 
                    : 'bg-gray-700 text-gray-300'
                ]"
                :title="group.description || group.name"
              >
                {{ group.name }}
              </span>
            </div>
            <div v-else class="text-center py-4">
              <UserGroupIcon class="mx-auto h-12 w-12 text-gray-400" />
              <h3 class="mt-2 text-sm font-medium text-gray-100">No groups</h3>
              <p class="mt-1 text-sm text-gray-400">
                This member is not assigned to any Authentik groups.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- QR Code Card -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Attendance QR Code
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

        <!-- Quick Stats Card -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Quick Stats
            </h3>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm font-medium text-gray-400">Teams</dt>
                <dd class="mt-1 text-2xl font-semibold text-gray-100">
                  {{ user.teams?.length || 0 }}
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Events Attended</dt>
                <dd class="mt-1 text-2xl font-semibold text-gray-100">
                  {{ user.events?.length || 0 }}
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Days as Member</dt>
                <dd class="mt-1 text-2xl font-semibold text-gray-100">
                  {{ daysAsMember }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- VPN Config Card -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              VPN Access
            </h3>
            <p class="text-sm text-gray-400 mb-4">
              Start a VPN enrollment for this member and share the token with them.
            </p>
            <button
              @click="startVPNEnrollment"
              :disabled="isSendingVPN"
              class="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <svg v-if="isSendingVPN" class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ isSendingVPN ? 'Generating...' : 'Start VPN Enrollment' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- Loading State -->
  <div v-else class="flex justify-center items-center py-12">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-sm text-gray-400">Loading member profile...</p>
    </div>
  </div>

  <!-- VPN Enrollment Modal -->
  <Teleport to="body">
    <div v-if="showVPNModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/70" @click="showVPNModal = false" />
      <div class="relative bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div class="flex items-start justify-between mb-6">
          <div>
            <h2 class="text-xl font-bold text-gray-100">VPN Enrollment Token</h2>
            <p class="text-sm text-gray-400 mt-1">
              {{ vpnEnrollment?.isNew ? 'Account created.' : 'New token generated.' }}
              Share this with <strong class="text-gray-200">{{ user?.firstName }}</strong>.
            </p>
          </div>
          <button @click="showVPNModal = false" class="text-gray-400 hover:text-gray-200 ml-4">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="bg-blue-900/40 border border-blue-700 rounded-lg p-4 mb-5">
          <p class="text-sm text-blue-200">
            The member should visit the enrollment portal and paste this token to configure their WireGuard device.
          </p>
        </div>

        <div class="mb-5">
          <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Enrollment Token</label>
          <div class="flex items-center space-x-2">
            <code class="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-sm font-mono text-green-400 break-all">
              {{ vpnEnrollment?.enrollmentToken }}
            </code>
            <button
              @click="copyToken(vpnEnrollment?.enrollmentToken || '')"
              class="shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg px-3 py-3"
              title="Copy token"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        <a
          :href="vpnEnrollment?.enrollmentUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors duration-200"
        >
          Open Enrollment Portal
        </a>

        <p class="text-xs text-gray-500 text-center mt-4">This token is single-use. Share it promptly.</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useGroupStore } from '@/stores/groupStore'
import { useAuthStore } from '@/stores/authStore'
import { usePermissions } from '@/composables/usePermissions'
import { UserGroupIcon, CalendarIcon } from '@heroicons/vue/24/outline'
import QRCodeVue3 from 'qrcode-vue3'
import type { User, BadgeClass } from '@/types/api'
import { useToast } from 'vue-toastification'
import apiService from '@/services/api'
import PaymentHistoryList from '@/components/payments/PaymentHistoryList.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const groupStore = useGroupStore()
const authStore = useAuthStore()
const { can } = usePermissions()
const toast = useToast()

// State
const isSubmitting = ref(false)
const isDeleting = ref(false)
const isSendingVPN = ref(false)
const qrCodeRef = ref<any>(null)

// VPN enrollment modal
const showVPNModal = ref(false)
const vpnEnrollment = ref<{ enrollmentToken: string; enrollmentUrl: string; isNew: boolean } | null>(null)

// Badge state
const showBadgeInvite = ref(false)
const loadingBadgeClasses = ref(false)
const loadingUserBadges = ref(false)
const sendingInvite = ref(false)
const badgeClasses = ref<BadgeClass[]>([])
const userBadges = ref<any[]>([])
const selectedBadgeClassId = ref('')

const selectedBadgeClass = computed(() =>
  badgeClasses.value.find(bc => bc.id === selectedBadgeClassId.value) || null
)

// Form
const form = ref({
  firstName: '',
  lastName: '',
  displayName: '',
  isPaid: false
})

// Computed
const userId = computed(() => route.params.id as string)
const user = computed(() => {
  // Try to get user from the users array first
  let foundUser = userStore.getUserById(userId.value)
  
  // If not found in users array, try currentUser
  if (!foundUser && userStore.currentUser) {
    foundUser = userStore.currentUser
  }
  
  return foundUser
})

const groups = computed(() => groupStore.groups)

const userGroups = computed(() => {
  if (!user.value) return []
  if (groupStore.isLoading) return []
  
  return user.value.authentikGroups.map(groupId => {
    const group = groupStore.groups.find(g => g.id === groupId)
    return {
      id: groupId,
      name: group?.name || `Unknown Group (${groupId.slice(0, 8)}...)`,
      description: group?.description,
      found: !!group
    }
  })
})

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

const daysAsMember = computed(() => {
  if (!user.value) return 0
  const now = new Date()
  const joined = new Date(user.value.createdAt)
  const diffTime = Math.abs(now.getTime() - joined.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Methods
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const getUserInitials = (user: User) => {
  if (!user?.firstName || !user?.lastName) return '?'
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
}

const downloadQRCode = async () => {
  if (!qrCodeValue.value) {
    console.error('No QR code value available')
    return
  }

  try {
    await nextTick()
    
    if (!qrCodeRef.value) {
      console.error('QR code component not found')
      return
    }
    
    const imgElement = qrCodeRef.value.$el?.querySelector('img')
    
    if (!imgElement) {
      console.error('QR code image not found')
      return
    }

    const imageSrc = imgElement.src
    
    if (!imageSrc) {
      console.error('No image source found')
      return
    }

    const link = document.createElement('a')
    link.download = `qr-code-${user.value?.firstName || 'user'}.png`
    link.href = imageSrc
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    console.log('QR code downloaded successfully!')
    
  } catch (error) {
    console.error('Failed to download QR code:', error)
    alert('Failed to download QR code. Please try again.')
  }
}

const copyToken = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Token copied to clipboard!')
  } catch {
    toast.error('Failed to copy token')
  }
}

const startVPNEnrollment = async () => {
  if (!user.value) return

  isSendingVPN.value = true

  try {
    const response = await fetch(`${window.ENV.VITE_API_BASE_URL}/admin/vpn-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.accessToken}`
      },
      body: JSON.stringify({ userId: user.value.id })
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
      toast.error(data.error || 'Failed to start VPN enrollment')
    }
  } catch (error) {
    console.error('Error starting VPN enrollment:', error)
    toast.error('An error occurred while starting VPN enrollment')
  } finally {
    isSendingVPN.value = false
  }
}

// Badge methods
const loadBadgeClasses = async () => {
  loadingBadgeClasses.value = true
  try {
    const response = await apiService.getBadgeClasses()
    badgeClasses.value = response.data ?? []
  } catch (err) {
    console.error('Failed to load badge classes:', err)
  } finally {
    loadingBadgeClasses.value = false
  }
}

const loadUserBadges = async () => {
  if (!userId.value) return
  loadingUserBadges.value = true
  try {
    const response = await apiService.getUserBadges(userId.value)
    userBadges.value = response.data ?? []
  } catch (err) {
    console.error('Failed to load user badges:', err)
  } finally {
    loadingUserBadges.value = false
  }
}

const sendBadgeInvite = async () => {
  if (!selectedBadgeClassId.value || !userId.value) return
  sendingInvite.value = true
  try {
    await apiService.sendBadgeInviteToUser(userId.value, selectedBadgeClassId.value)
    toast.success('Badge invite sent successfully')
    selectedBadgeClassId.value = ''
    showBadgeInvite.value = false
    await loadUserBadges()
  } catch (err) {
    console.error('Failed to send badge invite:', err)
    toast.error('Failed to send badge invite')
  } finally {
    sendingInvite.value = false
  }
}

const confirmDelete = async () => {
  if (!user.value) return
  
  isDeleting.value = true
  
  try {
    await userStore.deleteUser(user.value.id)
    router.push('/users')
  } catch (error) {
    console.error('Error deleting user:', error)
  } finally {
    isDeleting.value = false
  }
}

// Load user data on mount
onMounted(async () => {
  try {
    await userStore.fetchUsers()
    await groupStore.fetchGroups()
    
    if (!user.value) {
      try {
        await userStore.fetchUser(userId.value)
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }
    
    if (user.value) {
      form.value = {
        firstName: user.value.firstName,
        lastName: user.value.lastName,
        displayName: user.value.displayName,
        isPaid: user.value.isPaid
      }
    }

    await Promise.all([loadBadgeClasses(), loadUserBadges()])
  } catch (error) {
    console.error('Error loading data:', error)
  }
})
</script>
