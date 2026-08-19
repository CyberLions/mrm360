<template>
  <!-- Loading State -->
  <div v-if="loading" class="flex justify-center items-center py-12">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-sm text-gray-400">Loading event check-in...</p>
    </div>
  </div>

  <!-- Event Content -->
  <div v-else-if="event" class="space-y-6">
    <!-- Page Header -->
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">Event Check-in</h1>
        <p class="mt-2 text-sm text-gray-400">
          {{ event.title }} - {{ formatDate(event.startTime) }} at {{ formatTime(event.startTime) }}
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <BaseButton
          @click="refreshAttendees"
          variant="secondary"
          :loading="refreshing"
        >
          Refresh
        </BaseButton>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Column -->
      <div class="lg:col-span-2 space-y-6">
        <!-- QR Code Scanner -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">QR Code Scanner</h3>
            <CameraCodeScanner format="qr" :scan-cooldown-ms="2000" @scanned="handleQRCodeDetected" />
            <div v-if="false" class="space-y-4">
              <div class="flex space-x-3">
                <BaseButton
                  @click="startCamera"
                  variant="primary"
                  :loading="cameraLoading"
                  :disabled="cameraActive"
                >
                  Start Camera
                </BaseButton>
                <BaseButton
                  v-if="cameraActive"
                  @click="stopCamera"
                  variant="secondary"
                >
                  Stop Camera
                </BaseButton>
                <BaseButton
                  v-if="cameraActive"
                  @click="flipCamera"
                  variant="outline"
                  :loading="cameraLoading"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Flip Camera
                </BaseButton>
              </div>
              
              <div class="relative w-full h-64 bg-gray-700 rounded-lg overflow-hidden">
                <video
                  ref="videoElement"
                  class="w-full h-full object-cover"
                  :class="{ 'hidden': !cameraActive }"
                  autoplay
                  playsinline
                ></video>
                
                <!-- Camera overlay elements -->
                <div v-if="cameraActive" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div class="border-2 border-blue-500 w-48 h-48 rounded-lg"></div>
                </div>
                <div v-if="cameraActive && qrScanning" class="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded text-sm font-medium">
                  Scanning...
                </div>
                <div v-if="cameraActive && !qrScanning" class="absolute top-2 left-2 bg-yellow-600 text-white px-2 py-1 rounded text-sm font-medium">
                  Processing...
                </div>
                <div v-if="cameraActive" class="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-sm font-medium">
                  {{ availableCameras.length > 1 ? availableCameras[currentCameraIndex]?.label : (cameraFacingMode === 'environment' ? 'Back Camera' : 'Front Camera') }}
                </div>
                
                <!-- Placeholder when camera is not active -->
                <div v-if="!cameraActive" class="absolute inset-0 flex items-center justify-center">
                  <div class="text-center">
                    <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V6a1 1 0 00-1-1H5a1 1 0 00-1 1v1a1 1 0 001 1zm12 0h2a1 1 0 001-1V6a1 1 0 00-1-1h-2a1 1 0 00-1 1v1a1 1 0 001 1zM5 20h2a1 1 0 001-1v-1a1 1 0 00-1-1H5a1 1 0 00-1 1v1a1 1 0 001 1z" />
                    </svg>
                    <p class="text-gray-400 mb-2">Click "Start Camera" to begin scanning</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Check-ins -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">Recent Check-ins</h3>
            <div v-if="recentCheckIns.length > 0" class="space-y-3">
              <div
                v-for="checkIn in recentCheckIns"
                :key="checkIn.id"
                class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
              >
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-gray-100">{{ checkIn.user?.displayName || `${checkIn.user?.firstName} ${checkIn.user?.lastName}` }}</p>
                    <p class="text-sm text-gray-400">{{ formatTime(checkIn.checkedInAt) }}</p>
                  </div>
                </div>
                <span class="text-sm text-green-400 font-medium">Checked In</span>
              </div>
            </div>
            <div v-else class="text-center py-4">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-100">No recent check-ins</h3>
              <p class="mt-1 text-sm text-gray-400">
                No one has checked in recently.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Sidebar -->
      <div class="space-y-6">
        <!-- Manual Check-in -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">Manual Check-in</h3>
            <div class="space-y-4">
              <div>
                <label for="searchUser" class="block text-sm font-medium text-gray-400 mb-2">
                  Search User
                </label>
                <div class="relative" @click.stop>
                  <input
                    id="searchUser"
                    v-model="searchQuery"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search by name or email"
                    @input="searchUsers"
                    @blur="hideSearchResults"
                    @focus="searchUsers"
                  />
                  
                  <!-- Loading indicator -->
                  <div v-if="searchLoading" class="absolute right-3 top-2.5">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  </div>
                  
                  <!-- Search results dropdown -->
                  <div 
                    v-if="showSearchResults && searchResults.length > 0" 
                    class="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto"
                    @click.stop
                  >
                    <!-- Results found -->
                    <div v-if="searchResults.length > 0">
                      <div
                        v-for="user in searchResults"
                        :key="user.id"
                        class="px-4 py-2 hover:bg-gray-700 cursor-pointer border-b border-gray-600 last:border-b-0"
                        @click="selectUser(user)"
                      >
                        <p class="font-medium text-gray-100">{{ user.displayName || `${user.firstName} ${user.lastName}` }}</p>
                        <p class="text-sm text-gray-400">{{ user.email }}</p>
                      </div>
                    </div>
                    
                    <!-- No results found -->
                    <div v-else class="px-4 py-3 text-center">
                      <p class="text-sm text-gray-400">No users found matching "{{ searchQuery }}"</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-if="selectedUser" class="p-4 bg-blue-900 rounded-lg">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-medium text-gray-100">{{ selectedUser.displayName || `${selectedUser.firstName} ${selectedUser.lastName}` }}</p>
                    <p class="text-sm text-gray-400">{{ selectedUser.email }}</p>
                  </div>
                  <BaseButton
                    @click="checkInUser(selectedUser.id)"
                    variant="primary"
                    :loading="checkInLoading"
                  >
                    Check In
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Quick Stats
            </h3>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm font-medium text-gray-400">Total Check-ins</dt>
                <dd class="mt-1 text-2xl font-semibold text-gray-100">
                  {{ attendanceStats.checkedIn }}
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Confirmed RSVPs</dt>
                <dd class="mt-1 text-2xl font-semibold text-gray-100">
                  {{ confirmedRSVPs }}
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Pending Check-ins</dt>
                <dd class="mt-1 text-2xl font-semibold text-gray-100">
                  {{ attendanceStats.pending }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Attendee List -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">Attendees</h3>
            <div v-if="event.checkIns && event.checkIns.length > 0" class="space-y-3">
              <div
                v-for="checkIn in event.checkIns"
                :key="checkIn.id"
                class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
              >
                <div>
                  <h4 class="text-sm font-medium text-gray-100">
                    {{ checkIn.user.displayName || `${checkIn.user.firstName} ${checkIn.user.lastName}` }}
                  </h4>
                  <p class="text-sm text-gray-400">{{ checkIn.user.email }}</p>
                  <p class="text-sm text-gray-400">{{ formatTime(checkIn.checkedInAt) }}</p>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200">
                    Checked In
                  </span>
                  <IconButton
                    :to="`/users/${checkIn.user.id}`"
                    :icon="EyeIcon"
                    label="View member"
                    variant="primary"
                  />
                  <IconButton
                    @click="deleteCheckIn(checkIn.user.id)"
                    :disabled="deletingCheckIn === checkIn.user.id"
                    :icon="deletingCheckIn === checkIn.user.id ? ArrowPathIcon : TrashIcon"
                    label="Remove check-in"
                    variant="danger"
                  />
                </div>
              </div>
            </div>
            <div v-else class="text-center py-4">
              <UserGroupIcon class="mx-auto h-12 w-12 text-gray-400" />
              <h3 class="mt-2 text-sm font-medium text-gray-100">No attendees</h3>
              <p class="mt-1 text-sm text-gray-400">
                No one has checked in to this event yet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Error State -->
  <div v-else class="text-center py-12">
    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
    <h3 class="mt-2 text-sm font-medium text-gray-100">Event not found</h3>
    <p class="mt-1 text-sm text-gray-400">The event you're looking for doesn't exist or has been removed.</p>
    <div class="mt-6">
      <router-link
        to="/events"
        class="inline-flex items-center px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700"
      >
        Back to Events
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useEventStore } from '@/stores/eventStore'
import { usePermissions } from '@/composables/usePermissions'
import BaseButton from '@/components/common/BaseButton.vue'
import IconButton from '@/components/common/IconButton.vue'
import CameraCodeScanner from '@/components/inventory/CameraCodeScanner.vue'
import type { Event, User } from '@/types/api'
// @ts-ignore
import { BrowserQRCodeReader } from '@zxing/browser'
import { useToast } from 'vue-toastification'
import { apiService } from '@/services/api'
import { ArrowPathIcon, EyeIcon, TrashIcon, UserGroupIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const eventStore = useEventStore()
const { can } = usePermissions()
const toast = useToast()

const eventId = computed(() => route.params.id as string)

const event = ref<Event | null>(null)
const loading = ref(false)
const cameraActive = ref(false)
const cameraLoading = ref(false)
const checkInLoading = ref(false)
const refreshing = ref(false)
const cameraFacingMode = ref<'environment' | 'user'>('environment')
const availableCameras = ref<MediaDeviceInfo[]>([])
const currentCameraIndex = ref(0)
const searchQuery = ref('')
const searchResults = ref<User[]>([])
const selectedUser = ref<User | null>(null)
const searchLoading = ref(false)
const deletingCheckIn = ref<string | null>(null)
const searchTimeout = ref<NodeJS.Timeout | null>(null)
const showSearchResults = ref(false)
const recentCheckIns = ref<any[]>([])

const videoElement = ref<HTMLVideoElement>()
const qrReader = ref<BrowserQRCodeReader | null>(null)
const qrScanning = ref(false)

const attendanceStats = computed(() => {
  if (!event.value?.checkIns) return { checkedIn: 0, pending: 0 }
  
  const checkedIn = event.value.checkIns.length
  const confirmedRSVPs = event.value.rsvps?.filter(r => r.status === 'CONFIRMED').length || 0
  const pending = Math.max(0, confirmedRSVPs - checkedIn)
  
  return { checkedIn, pending }
})

const confirmedRSVPs = computed(() => {
  return event.value?.rsvps?.filter((rsvp: any) => rsvp.status === 'CONFIRMED').length || 0
})

onMounted(async () => {
  await loadEvent()
  await loadRecentCheckIns()
})

onUnmounted(() => {
  stopCamera()
  
  // Clear search timeout
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
  }
})

const loadEvent = async () => {
  try {
    loading.value = true
    const eventData = await eventStore.fetchEvent(eventId.value)
    event.value = eventData
  } catch (error: any) {
    console.error('Failed to load event:', error)
    
    // Show specific error message
    let errorMessage = 'Failed to load event details'
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error
    } else if (error.message) {
      errorMessage = error.message
    }
    
    toast.error(errorMessage)
    event.value = null
  } finally {
    loading.value = false
  }
}

const loadRecentCheckIns = async () => {
  // This would typically come from the API
  // For now, we'll use mock data
  recentCheckIns.value = []
}

const startCamera = async () => {
  if (!can('create', 'Event')) {
    toast.error('You do not have permission to check in attendees')
    return
  }
  
  cameraLoading.value = true
  
  try {
    // Check if we're in a secure context (HTTPS or localhost)
    const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    
    if (!isSecureContext) {
      toast.warning('Camera access requires HTTPS or localhost. For development, try accessing via localhost:3000 instead of 127.0.0.1:3000')
      cameraLoading.value = false
      return
    }
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Camera access is not supported in this browser')
      cameraLoading.value = false
      return
    }
    
    // Set camera active first so the video element is rendered
    cameraActive.value = true
    
    // Wait for the DOM to update
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (!videoElement.value) {
      throw new Error('Video element not found')
    }
    
    // First, get the camera stream using getUserMedia
    console.log('Requesting camera access...', { facingMode: cameraFacingMode.value })
    
    // Log available devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      availableCameras.value = videoDevices
      console.log('Available video devices:', videoDevices.map(device => ({
        deviceId: device.deviceId,
        label: device.label,
        groupId: device.groupId
      })))
      
      // If we have multiple cameras, try to find the one matching our facing mode
      if (videoDevices.length > 1) {
        console.log('Multiple cameras detected, attempting to select appropriate one')
        // For now, we'll still use facingMode constraint, but log what we're doing
      }
    } catch (deviceError) {
      console.warn('Could not enumerate devices:', deviceError)
    }
    
    // Try to get camera stream
    let stream: MediaStream
    const videoConstraints: any = {
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
    
    // If we have multiple cameras, use deviceId to switch between them
    if (availableCameras.value.length > 1) {
      const selectedCamera = availableCameras.value[currentCameraIndex.value]
      videoConstraints.deviceId = { exact: selectedCamera.deviceId }
      console.log('Using specific camera:', selectedCamera.label, 'with deviceId:', selectedCamera.deviceId)
    } else {
      // If only one camera, use facingMode constraint
      videoConstraints.facingMode = cameraFacingMode.value
      console.log('Using facingMode constraint:', cameraFacingMode.value)
    }
    
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
      console.log('Successfully got stream with constraints:', videoConstraints)
    } catch (constraintError) {
      console.warn('Failed to get stream with constraints, trying without:', constraintError)
      // Fallback to basic constraints
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
      console.log('Successfully got stream with basic constraints')
    }
    
    // Log current stream info
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      const settings = videoTrack.getSettings()
      const capabilities = videoTrack.getCapabilities()
      console.log('Current video track settings:', {
        deviceId: settings.deviceId,
        facingMode: settings.facingMode,
        width: settings.width,
        height: settings.height,
        label: videoTrack.label
      })
      console.log('Video track capabilities:', {
        facingMode: capabilities.facingMode,
        width: capabilities.width,
        height: capabilities.height
      })
    }
    
    console.log('Camera stream obtained:', stream)
    
    // Set the video element source
    videoElement.value.srcObject = stream
    
    // Wait for video to load
    await new Promise((resolve) => {
      videoElement.value!.onloadedmetadata = () => {
        console.log('Video metadata loaded')
        resolve(true)
      }
    })
    
    // Initialize QR code reader
    try {
      qrReader.value = new BrowserQRCodeReader()
      console.log('QR reader initialized successfully')
    } catch (qrInitError) {
      console.error('Failed to initialize QR reader:', qrInitError)
      throw new Error('Failed to initialize QR code reader')
    }
    
    // Start decoding from video element
    console.log('Starting QR code detection...')
    
    try {
      await qrReader.value.decodeFromVideoElement(
        videoElement.value,
        (result: any, error: any) => {
          if (result) {
            console.log('QR code detected:', result.getText())
            handleQRCodeDetected(result.getText())
          }
          if (error && error.message && !error.message.includes('No MultiFormat Readers')) {
            console.log('QR scan error:', error.message)
          }
        }
      )
      
      qrScanning.value = true
      toast.success('Camera started successfully!')
      console.log('QR code detection started successfully')
      
    } catch (qrError) {
      console.error('QR detection failed:', qrError)
      // Clean up QR reader on error
      qrReader.value = null
      throw qrError
    }
    
  } catch (error: any) {
    console.error('Failed to start camera:', error)
    
    // Provide more specific error messages
    if (error.name === 'NotAllowedError') {
      toast.error('Camera access denied. Please allow camera permissions and try again.')
    } else if (error.name === 'NotFoundError') {
      toast.error('No camera found. Please connect a camera and try again.')
    } else if (error.name === 'NotSupportedError') {
      toast.error('Camera access is not supported in this browser.')
    } else if (error.message.includes('secure context')) {
      toast.warning('Camera access requires HTTPS or localhost. For development, try accessing via localhost:3000 instead of 127.0.0.1:3000')
    } else {
      toast.error(`Failed to start camera: ${error.message || 'Unknown error'}`)
    }
  } finally {
    cameraLoading.value = false
  }
}

const stopCamera = () => {
  console.log('Stopping camera...')
  
  // Stop QR reader if it exists and has a reset method
  if (qrReader.value) {
    try {
      if (typeof qrReader.value.reset === 'function') {
        qrReader.value.reset()
      } else {
        console.log('QR reader does not have reset method, skipping reset')
      }
    } catch (error) {
      console.warn('Error resetting QR reader:', error)
    } finally {
      qrReader.value = null
    }
  }
  
  // Stop video stream
  if (videoElement.value?.srcObject) {
    const stream = videoElement.value.srcObject as MediaStream
    stream.getTracks().forEach(track => {
      console.log('Stopping track:', track.kind)
      track.stop()
    })
    videoElement.value.srcObject = null
  }
  
  cameraActive.value = false
  qrScanning.value = false
  console.log('Camera stopped')
}

const flipCamera = async () => {
  if (!cameraActive.value) return
  
  cameraLoading.value = true
  
  try {
    // Store current state
    const wasScanning = qrScanning.value
    const previousFacingMode = cameraFacingMode.value
    
    // Cycle through available cameras
    if (availableCameras.value.length > 1) {
      currentCameraIndex.value = (currentCameraIndex.value + 1) % availableCameras.value.length
      const newCamera = availableCameras.value[currentCameraIndex.value]
      console.log('Switching to camera:', newCamera.label, 'index:', currentCameraIndex.value)
    } else {
      // If only one camera, toggle facing mode
      cameraFacingMode.value = cameraFacingMode.value === 'environment' ? 'user' : 'environment'
      console.log('Toggling facing mode from', previousFacingMode, 'to', cameraFacingMode.value)
    }
    
    // Log current stream before stopping
    if (videoElement.value?.srcObject) {
      const currentStream = videoElement.value.srcObject as MediaStream
      const currentTrack = currentStream.getVideoTracks()[0]
      if (currentTrack) {
        const currentSettings = currentTrack.getSettings()
        console.log('Current stream before flip:', {
          deviceId: currentSettings.deviceId,
          facingMode: currentSettings.facingMode,
          label: currentTrack.label
        })
      }
    }
    
    // Stop current camera
    stopCamera()
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Start camera with new facing mode
    await startCamera()
    
    // Restore scanning state if it was active
    if (wasScanning) {
      qrScanning.value = true
    }
    
    if (availableCameras.value.length > 1) {
      const currentCamera = availableCameras.value[currentCameraIndex.value]
      toast.success(`Switched to ${currentCamera.label}`)
    } else {
      toast.success(`Switched to ${cameraFacingMode.value === 'environment' ? 'back' : 'front'} camera`)
    }
  } catch (error: any) {
    console.error('Failed to flip camera:', error)
    
    // Revert facing mode on error
    cameraFacingMode.value = cameraFacingMode.value === 'environment' ? 'user' : 'environment'
    
    // Try to restart camera with previous mode
    try {
      console.log('Attempting to restart camera with previous mode')
      await startCamera()
    } catch (restartError) {
      console.error('Failed to restart camera:', restartError)
      toast.error('Failed to switch camera. Please restart manually.')
    }
  } finally {
    cameraLoading.value = false
  }
}

const handleQRCodeDetected = async (qrCode: string) => {
  if (!qrCode || !eventId.value) return
  
  try {
    console.log('QR Code detected:', qrCode)
    
    // Stop scanning temporarily to prevent multiple scans
    qrScanning.value = false
    
    const result = await eventStore.checkInWithQR(eventId.value, qrCode)
    
    if (result.success) {
      // Add to recent check-ins
      recentCheckIns.value.unshift({
        id: Date.now(),
        userId: result.user?.id,
        user: result.user,
        checkedInAt: new Date().toISOString()
      })
      
      const userName = result.user?.displayName || `${result.user?.firstName} ${result.user?.lastName}` || 'User'
      toast.success(`${userName} has been checked in successfully!`)
    } else {
      // Provide more descriptive error messages
      let descriptiveMessage = result.message || 'Check-in failed'
      
      if (result.message && result.message.includes('would be placed on the waitlist')) {
        descriptiveMessage = 'This event is full and the user would be placed on the waitlist. Please RSVP manually first.'
      } else if (result.message && result.message.includes('on the waitlist')) {
        descriptiveMessage = 'The user is on the waitlist for this event. Please wait for confirmation before checking in.'
      } else if (result.message && result.message.includes('RSVP is declined')) {
        descriptiveMessage = 'The user\'s RSVP for this event is declined. Please RSVP again if they want to attend.'
      } else if (result.message && result.message.includes('RSVP status')) {
        descriptiveMessage = 'The user\'s RSVP status prevents check-in. Please update their RSVP first.'
      }
      
      toast.error(`Check-in failed: ${descriptiveMessage}`)
    }
    
    // Resume scanning after a short delay
    setTimeout(() => {
      qrScanning.value = true
    }, 2000)
    
  } catch (error: any) {
    console.error('Failed to process QR code:', error)
    
    // Check if it's an API error with a specific message
    if (error.response?.data?.message) {
      toast.error(`Check-in failed: ${error.response.data.message}`)
    } else if (error.response?.status === 400) {
      toast.error('Invalid QR code or user not found. Please check the QR code and try again.')
    } else if (error.response?.status === 404) {
      toast.error('User not found for this QR code.')
    } else {
      toast.error('Failed to process QR code. Please try again.')
    }
    
    // Resume scanning
    setTimeout(() => {
      qrScanning.value = true
    }, 1000)
  }
}

const searchUsers = async () => {
  const query = searchQuery.value.trim()
  
  if (!query || query.length < 2) {
    searchResults.value = []
    showSearchResults.value = false
    return
  }

  // Clear previous timeout
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
  }

  // Debounce search by 300ms
  searchTimeout.value = setTimeout(async () => {
    try {
      searchLoading.value = true
      const result = await apiService.searchUsers(query, 10)
      searchResults.value = result.data || []
      showSearchResults.value = true
    } catch (error) {
      console.error('Failed to search users:', error)
      searchResults.value = []
      showSearchResults.value = false
    } finally {
      searchLoading.value = false
    }
  }, 300)
}

const selectUser = (user: User) => {
  selectedUser.value = user
  searchQuery.value = user.email
  searchResults.value = []
  showSearchResults.value = false
}

const hideSearchResults = () => {
  // Delay hiding to allow for click events
  setTimeout(() => {
    showSearchResults.value = false
  }, 200)
}


const checkInUser = async (userId: string) => {
  if (!can('create', 'Event')) {
    toast.error('You do not have permission to check in attendees')
    return
  }
  
  checkInLoading.value = true
  
  try {
    const result = await eventStore.checkInUser(eventId.value, userId)
    
    if (result.success) {
      // Add to recent check-ins
      recentCheckIns.value.unshift({
        id: Date.now(),
        userId,
        user: result.user,
        checkedInAt: new Date().toISOString()
      })
      
      // Clear selection
      selectedUser.value = null
      searchQuery.value = ''
      searchResults.value = []
      showSearchResults.value = false
      
      const userName = result.user?.displayName || `${result.user?.firstName} ${result.user?.lastName}` || 'User'
      toast.success(`${userName} has been checked in successfully!`)
    } else {
      // Provide more descriptive error messages
      let descriptiveMessage = result.message || 'Check-in failed'
      
      if (result.message && result.message.includes('would be placed on the waitlist')) {
        descriptiveMessage = 'This event is full and the user would be placed on the waitlist. Please RSVP manually first.'
      } else if (result.message && result.message.includes('on the waitlist')) {
        descriptiveMessage = 'The user is on the waitlist for this event. Please wait for confirmation before checking in.'
      } else if (result.message && result.message.includes('RSVP is declined')) {
        descriptiveMessage = 'The user\'s RSVP for this event is declined. Please RSVP again if they want to attend.'
      } else if (result.message && result.message.includes('RSVP status')) {
        descriptiveMessage = 'The user\'s RSVP status prevents check-in. Please update their RSVP first.'
      }
      
      toast.error(`Check-in failed: ${descriptiveMessage}`)
    }
  } catch (error: any) {
    console.error('Failed to check in user:', error)
    
    // Extract specific error message from API response
    let errorMessage = 'Failed to check in user. Please try again.'
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error
    } else if (error.message) {
      errorMessage = error.message
    }
    
    toast.error(errorMessage)
  } finally {
    checkInLoading.value = false
  }
}

const refreshAttendees = async () => {
  refreshing.value = true
  try {
    await loadEvent()
    await loadRecentCheckIns()
  } finally {
    refreshing.value = false
  }
}

const deleteCheckIn = async (userId: string) => {
  if (!confirm('Remove this check-in? This cannot be undone.')) return
  deletingCheckIn.value = userId
  try {
    await apiService.deleteCheckIn(eventId.value, userId)
    // Remove from local state
    if (event.value?.checkIns) {
      event.value.checkIns = event.value.checkIns.filter(ci => ci.userId !== userId)
    }
    recentCheckIns.value = recentCheckIns.value.filter(ci => ci.userId !== userId)
  } catch (err) {
    console.error('Failed to delete check-in:', err)
  } finally {
    deletingCheckIn.value = null
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
