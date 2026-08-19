<template>
  <div v-if="event" class="space-y-6">
    <!-- Capacity Status Banner -->
    <div v-if="event.attendanceCap && confirmedRSVPs >= event.attendanceCap * 0.8 && authStore.isAdmin" 
         class="mb-6 p-4 rounded-lg border"
         :class="confirmedRSVPs >= event.attendanceCap 
           ? 'bg-red-900/20 border-red-700' 
           : 'bg-yellow-900/20 border-yellow-700'">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <svg v-if="confirmedRSVPs >= event.attendanceCap" class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <svg v-else class="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 :class="confirmedRSVPs >= event.attendanceCap ? 'text-red-200' : 'text-yellow-200'" class="text-sm font-medium">
            {{ confirmedRSVPs >= event.attendanceCap ? 'Event is Full' : 'Event Nearly Full' }}
          </h3>
          <div class="mt-1 text-sm" :class="confirmedRSVPs >= event.attendanceCap ? 'text-red-300' : 'text-yellow-300'">
            <p v-if="confirmedRSVPs >= event.attendanceCap">
              All {{ event.attendanceCap }} spots are taken. 
              <span v-if="event.waitlistEnabled && waitlistRSVPs > 0">
                {{ waitlistRSVPs }} {{ waitlistRSVPs === 1 ? 'person is' : 'people are' }} on the waitlist.
              </span>
              <span v-else-if="event.waitlistEnabled">
                Join the waitlist if you're interested in attending.
              </span>
            </p>
            <p v-else>
              Only {{ event.attendanceCap - confirmedRSVPs }} {{ event.attendanceCap - confirmedRSVPs === 1 ? 'spot' : 'spots' }} remaining!
              <span v-if="event.waitlistEnabled"> Waitlist is enabled when full.</span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Page Header -->
    <div class="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-100">{{ event.title }}</h1>
        <p class="mt-2 text-sm text-gray-400">
          {{ formatDate(event.startTime) }} at {{ formatTime(event.startTime) }}
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center space-x-3">
        <BaseButton
          @click="$router.push('/events')"
          variant="secondary"
          class="bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-300"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Events
        </BaseButton>
        
        <!-- RSVP Button -->
        <BaseButton
          v-if="authStore.user && !isEventPast"
          @click="goToRSVPPage"
          :variant="getRSVPButtonVariant()"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getRSVPButtonIcon()" />
          </svg>
          {{ getRSVPButtonText() }}
        </BaseButton>

        <!-- Wiretap Button -->
        <BaseButton
          v-if="userRSVP && event?.wiretapWorkshopId"
          @click="goToWiretap"
          variant="primary"
          class="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Go to Wiretap
        </BaseButton>
        
        <BaseButton
          v-if="canEditEvent && authStore.isAdmin"
          @click="editEvent"
          variant="primary"
        >
          Edit Event
        </BaseButton>
        
        <BaseButton
          v-if="canCheckIn && authStore.isAdmin"
          @click="goToCheckIn"
          variant="secondary"
        >
          Check-in
        </BaseButton>
        
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Event Information -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Basic Info Card -->
        <div class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Event Information
            </h3>
            <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt class="text-sm font-medium text-gray-400">Title</dt>
                <dd class="mt-1 text-sm text-gray-100">{{ event.title }}</dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Date & Time</dt>
                <dd class="mt-1 text-sm text-gray-100">
                  {{ formatDate(event.startTime) }} at {{ formatTime(event.startTime) }}
                  <span v-if="event.endTime" class="block text-xs text-gray-400">
                    Ends: {{ formatDate(event.endTime) }} at {{ formatTime(event.endTime) }}
                  </span>
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Category</dt>
                <dd class="mt-1 text-sm text-gray-100">{{ event.category || 'N/A' }}</dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Attendance Type</dt>
                <dd class="mt-1">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900 text-blue-200">
                    {{ event.attendanceType || 'SOFT' }}
                  </span>
                </dd>
              </div>
              
              <div v-if="event.attendanceCap">
                <dt class="text-sm font-medium text-gray-400">Attendance Limit</dt>
                <dd class="mt-1">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-lg font-semibold text-gray-100">
                      {{ confirmedRSVPs }} / {{ event.attendanceCap }}
                    </span>
                    <span 
                      :class="[
                        'text-sm font-medium px-2 py-1 rounded-full',
                        confirmedRSVPs >= event.attendanceCap 
                          ? 'bg-red-900 text-red-200' 
                          : confirmedRSVPs >= event.attendanceCap * 0.8 
                            ? 'bg-yellow-900 text-yellow-200'
                            : 'bg-green-900 text-green-200'
                      ]"
                    >
                      {{ confirmedRSVPs >= event.attendanceCap ? 'FULL' : 
                         confirmedRSVPs >= event.attendanceCap * 0.8 ? 'NEARLY FULL' : 
                         'AVAILABLE' }}
                    </span>
                  </div>
                  <div class="w-full bg-gray-700 rounded-full h-3">
                    <div 
                      :class="[
                        'h-3 rounded-full transition-all duration-300',
                        confirmedRSVPs >= event.attendanceCap 
                          ? 'bg-red-600' 
                          : confirmedRSVPs >= event.attendanceCap * 0.8 
                            ? 'bg-yellow-600'
                            : 'bg-green-600'
                      ]"
                      :style="{ width: `${Math.min((confirmedRSVPs / event.attendanceCap) * 100, 100)}%` }"
                    ></div>
                  </div>
                  <p class="mt-1 text-xs text-gray-400">
                    {{ event.attendanceCap - confirmedRSVPs }} spots remaining
                  </p>
                </dd>
              </div>
              
              <div v-if="event.waitlistEnabled">
                <dt class="text-sm font-medium text-gray-400">Waitlist Status</dt>
                <dd class="mt-1">
                  <div class="flex items-center justify-between">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-200">
                      {{ waitlistRSVPs }} {{ waitlistRSVPs === 1 ? 'person' : 'people' }} waiting
                    </span>
                    <span class="text-xs text-gray-400">
                      {{ waitlistRSVPs > 0 ? 'First come, first served' : 'No waitlist' }}
                    </span>
                  </div>
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Status</dt>
                <dd class="mt-1">
                  <span 
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      getEventStatusColor(event.startTime, event.endTime)
                    ]"
                  >
                    {{ getEventStatus(event.startTime, event.endTime) }}
                  </span>
                </dd>
              </div>
              
              <div v-if="event.description">
                <dt class="text-sm font-medium text-gray-400">Description</dt>
                <dd class="mt-1 text-sm text-gray-100">{{ event.description }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- RSVPs Card -->
        <div v-if="authStore.isAdmin" class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg leading-6 font-medium text-gray-100">
                RSVPs
              </h3>
              <div class="flex space-x-2">
                <select
                  v-model="rsvpFilter"
                  class="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100"
                >
                  <option value="">All RSVPs</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PENDING">Pending</option>
                  <option value="DECLINED">Declined</option>
                  <option value="WAITLIST">Waitlist</option>
                </select>
              </div>
            </div>
            
            <div v-if="filteredRSVPs.length > 0" class="space-y-3">
              <div
                v-for="rsvp in filteredRSVPs"
                :key="rsvp.id"
                class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
              >
                <div>
                  <h4 class="text-sm font-medium text-gray-100">
                    {{ rsvp.user.displayName || `${rsvp.user.firstName} ${rsvp.user.lastName}` }}
                  </h4>
                  <p class="text-sm text-gray-400">{{ rsvp.user.email }}</p>
                  <p class="text-sm text-gray-400">{{ formatDate(rsvp.createdAt) }}</p>
                </div>
                <div class="flex items-center space-x-2">
                  <span 
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      rsvp.status === 'CONFIRMED' ? 'bg-green-900 text-green-200' :
                      rsvp.status === 'PENDING' ? 'bg-yellow-900 text-yellow-200' :
                      rsvp.status === 'DECLINED' ? 'bg-red-900 text-red-200' :
                      rsvp.status === 'WAITLIST' ? 'bg-blue-900 text-blue-200' :
                      'bg-gray-600 text-gray-300'
                    ]"
                  >
                    {{ rsvp.status === 'CONFIRMED' ? 'Attending' : 
                       rsvp.status === 'PENDING' ? 'Pending' : 
                       rsvp.status === 'DECLINED' ? 'Not Attending' : 
                       rsvp.status === 'WAITLIST' ? 'On Waitlist' : rsvp.status }}
                  </span>
                  <IconButton
                    :to="`/users/${rsvp.user.id}`"
                    :icon="EyeIcon"
                    label="View member"
                    variant="primary"
                  />
                </div>
              </div>
            </div>
            <div v-else class="text-center py-4">
              <UserGroupIcon class="mx-auto h-12 w-12 text-gray-400" />
              <h3 class="mt-2 text-sm font-medium text-gray-100">No RSVPs</h3>
              <p class="mt-1 text-sm text-gray-400">
                {{ rsvpFilter ? `No ${rsvpFilter.toLowerCase()} RSVPs found.` : 'No one has RSVPed to this event yet.' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Attendees Card -->
        <div v-if="authStore.isAdmin" class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Attendees
            </h3>
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
                  <p class="text-sm text-gray-400">{{ formatDate(checkIn.checkedInAt) }}</p>
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

        <!-- User Team Switcher -->
        <div v-if="event?.teamsEnabled && !authStore.isAdmin && authStore.user">
          <TeamSwitcher :event-id="event.id" />
        </div>

        <!-- Teams Card -->
        <div v-if="event?.teamsEnabled && authStore.isAdmin" class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg leading-6 font-medium text-gray-100">
                Event Teams
              </h3>
              <div class="flex space-x-2">
                <BaseButton
                  @click="createTeam"
                  variant="primary"
                  size="sm"
                  :loading="createTeamLoading"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Team
                </BaseButton>
                <BaseButton
                  v-if="event?.teamsEnabled && event?.wiretapWorkshopId"
                  @click="syncTeams('sync_all')"
                  variant="outline"
                  size="sm"
                  :loading="syncLoading"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Teams
                </BaseButton>
                <BaseButton
                  @click="event?.teamsEnabled ? openTeamsModal() : enableTeams()"
                  variant="outline"
                  size="sm"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {{ event?.teamsEnabled ? 'Manage Teams' : 'Enable Teams' }}
                </BaseButton>
              </div>
            </div>
            
            <!-- Teams List -->
            <div v-if="eventTeams.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="team in eventTeams"
                :key="team.id"
                class="bg-gray-700 rounded-lg p-4"
              >
                <div class="flex justify-between items-center mb-3">
                  <h4 class="font-medium text-gray-100">Team {{ team.teamNumber }}</h4>
                  <span v-if="team.wiretapProjectId" class="text-xs text-green-400">
                    ✓ Wiretap
                  </span>
                </div>
                <div class="space-y-2">
                  <div
                    v-for="member in team.members"
                    :key="member.id"
                    class="text-sm text-gray-300"
                  >
                    {{ member.user.displayName || 
                       `${member.user.firstName} ${member.user.lastName}` }}
                  </div>
                  <div v-if="team.members.length === 0" class="text-sm text-gray-400 italic">
                    No members assigned
                  </div>
                </div>
              </div>
            </div>
            
            <!-- No Teams Message -->
            <div v-else class="text-center py-8">
              <div class="text-gray-400 mb-4">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p class="text-lg font-medium text-gray-300 mb-2">No teams created yet</p>
                <p class="text-sm text-gray-400">
                  {{ event?.wiretapWorkshopId ? 'Use "Sync Teams" to pull teams from Wiretap.' : 'Teams can be created manually or synced from Wiretap if a workshop is configured.' }}
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Quick Stats Card -->
        <div v-if="authStore.isAdmin" class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Quick Stats
            </h3>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm font-medium text-gray-400">Total RSVPs</dt>
                <dd class="mt-1 text-2xl font-semibold text-gray-100">
                  {{ event.rsvps?.length || 0 }}
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Confirmed</dt>
                <dd class="mt-1 text-xl font-semibold text-green-400">
                  {{ confirmedRSVPs }}
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Pending</dt>
                <dd class="mt-1 text-xl font-semibold text-yellow-400">
                  {{ pendingRSVPs }}
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Declined</dt>
                <dd class="mt-1 text-xl font-semibold text-red-400">
                  {{ declinedRSVPs }}
                </dd>
              </div>
              
              <div v-if="event?.waitlistEnabled">
                <dt class="text-sm font-medium text-gray-400">Waitlist</dt>
                <dd class="mt-1 text-xl font-semibold text-blue-400">
                  {{ waitlistRSVPs }}
                </dd>
              </div>
              
              <div v-if="event?.attendanceCap">
                <dt class="text-sm font-medium text-gray-400">Capacity</dt>
                <dd class="mt-1">
                  <div class="text-lg font-semibold text-gray-100">
                    {{ confirmedRSVPs }} / {{ event.attendanceCap }}
                  </div>
                  <div class="text-sm text-gray-400 mt-1">
                    {{ event.attendanceCap - confirmedRSVPs }} spots left
                  </div>
                </dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-400">Check-ins</dt>
                <dd class="mt-1 text-lg font-semibold text-gray-100">
                  {{ event.checkIns?.length || 0 }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Linked Team Card -->
        <div v-if="event.linkedTeam && authStore.isAdmin" class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Linked Team
            </h3>
            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
              <div>
                <h4 class="text-sm font-medium text-gray-100">{{ event.linkedTeam.name }}</h4>
                <p class="text-sm text-gray-400">{{ event.linkedTeam.type }}</p>
                <p v-if="event.linkedTeam.description" class="text-sm text-gray-400 mt-1">
                  {{ event.linkedTeam.description }}
                </p>
              </div>
              <IconButton
                :to="`/teams/${event.linkedTeam.id}`"
                :icon="EyeIcon"
                label="View linked team"
                variant="primary"
              />
            </div>
          </div>
        </div>

        <!-- QR Code Card -->
        <div v-if="authStore.isAdmin" class="bg-gray-800 shadow rounded-lg border border-gray-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-100 mb-4">
              Check-in QR Code
            </h3>
            <div class="text-center">
              <div class="bg-white p-4 rounded-lg border-2 border-gray-600 inline-block">
                <QRCodeVue3
                  ref="qrCodeRef"
                  :value="qrCodeValue"
                  :width="500"
                  :height="500"
                  :qr-options="{ errorCorrectionLevel: 'M' }"
                />
              </div>
              <p class="mt-3 text-sm text-gray-400">
                Scan this code to check in at this event
              </p>
              <div class="mt-3 space-y-2">
                <div class="flex items-center space-x-2">
                  <input 
                    :value="qrCodeValue" 
                    readonly
                    class="flex-1 px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <BaseButton
                    variant="outline"
                    size="sm"
                    @click="copyCheckInLink"
                    class="whitespace-nowrap"
                  >
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    Copy
                  </BaseButton>
                </div>
              </div>
              <BaseButton
                variant="outline"
                size="sm"
                class="mt-3"
                @click="downloadQRCode"
              >
                Download QR Code
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </div>


    <!-- Teams Assignment Modal -->
    <BaseModal
      :is-open="showTeamsModal"
      title="Manage Event Teams"
      size="lg"
      @close="showTeamsModal = false"
    >
      <div class="space-y-6">
        <div class="text-center">
          <h3 class="text-lg font-medium text-gray-100 mb-2">{{ event?.title }}</h3>
            <div class="text-sm text-gray-400 mb-4">
              <p>{{ event?.checkIns?.length || 0 }} attendees checked in</p>
              <p v-if="confirmedRSVPs > 0" class="text-blue-400">
                {{ confirmedRSVPs }} confirmed RSVPs (auto-assignment happens when they check in)
              </p>
              <p v-if="checkedInConfirmedCount > 0" class="text-green-400">
                {{ checkedInConfirmedCount }} confirmed and checked-in users eligible for team assignment
              </p>
              <p v-if="confirmedRSVPs > checkedInConfirmedCount" class="text-yellow-400">
                {{ confirmedRSVPs - checkedInConfirmedCount }} confirmed users need to check in first
              </p>
              <p v-if="declinedRSVPs > 0" class="text-red-400">
                {{ declinedRSVPs }} declined RSVPs can be removed from teams
              </p>
              <p v-if="autoAssignEnabled" class="text-blue-400 font-medium">
                ✓ Auto-assignment is enabled - users will be assigned to teams when they check in
              </p>
            </div>
        </div>

        
        <!-- Team Configuration -->
        <div class="space-y-4">
          <div class="bg-gray-700 rounded-lg p-4">
            <h4 class="text-md font-medium text-gray-100 mb-3">Team Configuration</h4>
            <div class="space-y-4">
              <div class="flex items-center space-x-4">
                <label for="membersPerTeam" class="text-sm font-medium text-gray-300">
                  Members per team:
                </label>
                <input
                  id="membersPerTeam"
                  v-model.number="membersPerTeam"
                  type="number"
                  min="1"
                  max="20"
                  class="w-20 px-3 py-1 bg-gray-600 border border-gray-500 rounded text-sm text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  @input="validateMembersPerTeam"
                  @change="saveTeamConfiguration"
                />
                <span class="text-xs text-gray-400">
                  Used for auto-assignment and team creation
                </span>
              </div>
              
              <div class="flex items-center space-x-4">
                <label for="autoAssignEnabled" class="text-sm font-medium text-gray-300">
                  Auto-assign on RSVP:
                </label>
                <input
                  id="autoAssignEnabled"
                  v-model="autoAssignEnabled"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
                  @change="saveTeamConfiguration"
                />
                <span class="text-xs text-gray-400">
                  Automatically assign users to teams when they check in
                </span>
              </div>
              
              <div class="flex items-center space-x-4">
                <label for="allowTeamSwitching" class="text-sm font-medium text-gray-300">
                  Allow team switching:
                </label>
                <input
                  id="allowTeamSwitching"
                  v-model="allowTeamSwitching"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
                  @change="saveTeamConfiguration"
                />
                <span class="text-xs text-gray-400">
                  Let users switch teams themselves
                </span>
              </div>
            </div>
            
            <div class="mt-3 text-xs text-gray-400">
              <span v-if="checkedInConfirmedCount > 0">
                With {{ checkedInConfirmedCount }} confirmed and checked-in users, this will create approximately {{ Math.ceil(checkedInConfirmedCount / membersPerTeam) }} teams
              </span>
              <span v-else-if="confirmedRSVPs > 0">
                {{ confirmedRSVPs }} confirmed RSVPs available, but {{ confirmedRSVPs - checkedInConfirmedCount }} need to check in first
              </span>
              <span v-else>
                No confirmed RSVPs available for team creation
              </span>
              <span v-if="eventTeams.length > 0" class="block mt-1">
                Currently: {{ eventTeams.length }} teams with {{ eventTeams.reduce((total, team) => total + team.members.length, 0) }} total members
              </span>
              <span v-if="autoAssignEnabled" class="block mt-1 text-blue-400">
                ✓ Auto-assignment will happen when users check in
              </span>
            </div>
          </div>
        </div>

        <!-- Existing Teams -->
        <div v-if="eventTeams.length > 0" class="space-y-4">
          <div class="flex justify-between items-center">
            <h4 class="text-md font-medium text-gray-100">Current Teams</h4>
            <div class="flex flex-col space-y-2">
              <div class="flex space-x-2">
                <BaseButton
                  @click="syncTeams('auto_assign')"
                  variant="outline"
                  size="sm"
                  :loading="syncLoading"
                  :disabled="checkedInConfirmedCount === 0"
                  :title="checkedInConfirmedCount === 0 ? 'No confirmed and checked-in users available for assignment' : `Manually assign ${checkedInConfirmedCount} confirmed and checked-in users to teams (${membersPerTeam} members per team). Auto-assignment happens during check-in.`"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Manual Assign ({{ checkedInConfirmedCount }} @ {{ membersPerTeam }}/team)
                </BaseButton>
                <BaseButton
                  @click="syncTeams('remove_declined')"
                  variant="outline"
                  size="sm"
                  :loading="syncLoading"
                  :disabled="declinedRSVPs === 0"
                  title="Remove users with DECLINED RSVP status from teams"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove Declined ({{ declinedRSVPs }})
                </BaseButton>
                <BaseButton
                  @click="syncTeams('sync_all')"
                  variant="primary"
                  size="sm"
                  :loading="syncLoading"
                  title="Perform both auto-assignment and removal of declined users"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync All
                </BaseButton>
              </div>
              <p class="text-xs text-gray-500">
                Sync operations run in the background and will update both MRM and Wiretap teams
              </p>
            </div>
          </div>
          
          <div class="space-y-3">
            <div
              v-for="team in eventTeams"
              :key="team.id"
              class="bg-gray-700 rounded-lg p-4"
            >
              <div class="flex justify-between items-center mb-2">
                <h5 class="font-medium text-gray-100">Team {{ team.teamNumber }}</h5>
                <div class="flex space-x-2">
                  <IconButton
                    @click="openTeamManagement(team)"
                    :icon="PencilSquareIcon"
                    label="Manage team"
                  />
                  <IconButton
                    v-if="can('delete', 'Team')"
                    @click="deleteTeam(team.id)"
                    :icon="TrashIcon"
                    label="Delete team"
                    variant="danger"
                  />
                </div>
              </div>
              <div class="text-sm text-gray-400">
                {{ team.members.length }} members
                <span v-if="team.wiretapProjectId" class="ml-2 text-green-400">
                  ✓ Synced to Wiretap
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- No Teams Message -->
        <div v-if="eventTeams.length === 0" class="text-center py-8">
          <div class="text-gray-400 mb-4">
            <svg class="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p class="text-lg font-medium text-gray-300 mb-2">No teams created yet</p>
            <p class="text-sm text-gray-400">
              {{ event?.wiretapWorkshopId ? 'Use "Sync All Teams from Wiretap" to pull teams from Wiretap.' : 'Teams can be created manually or synced from Wiretap if a workshop is configured.' }}
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end pt-4 border-t border-gray-700">
          <BaseButton
            @click="showTeamsModal = false"
            variant="outline"
          >
            Close
          </BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Team Management Modal -->
    <BaseModal
      :is-open="showManualAssignment"
      title="Manage Team Members"
      size="lg"
      @close="showManualAssignment = false"
    >
      <div class="space-y-6" v-if="selectedTeam">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-lg font-medium text-gray-100">Team {{ selectedTeam.teamNumber }}</h3>
            <p class="text-sm text-gray-400">{{ selectedTeam.members.length }} members</p>
          </div>
          <BaseButton
            @click="showManualAssignment = false"
            variant="outline"
            size="sm"
          >
            Done
          </BaseButton>
        </div>

        <!-- Current Members -->
        <div class="space-y-3">
          <h4 class="font-medium text-gray-100">Current Members</h4>
          <div class="space-y-2">
            <div
              v-for="member in selectedTeam.members"
              :key="member.id"
              class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
            >
              <div>
                <span class="text-gray-100">
                  {{ member.user.displayName || `${member.user.firstName} ${member.user.lastName}` }}
                </span>
                <p class="text-sm text-gray-400">{{ member.email }}</p>
              </div>
              <IconButton
                @click="removeTeamMember(selectedTeam.id, member.email)"
                :icon="UserMinusIcon"
                label="Remove team member"
                variant="danger"
              />
            </div>
          </div>
        </div>

        <!-- Add Member -->
        <div class="space-y-3">
          <h4 class="font-medium text-gray-100">Add Member</h4>
          <div class="space-y-2">
            <div class="relative">
              <input
                v-model="newMemberEmail"
                type="text"
                placeholder="Enter email address or name"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100"
                @input="searchUsers"
                @blur="hideSearchResults"
                @focus="searchUsers"
              />
              
              <!-- Search Results Dropdown -->
              <div 
                v-if="showSearchResults && searchResults.length > 0" 
                class="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              >
                <div
                  v-for="user in searchResults"
                  :key="user.id"
                  @click="selectUser(user)"
                  class="px-3 py-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-b-0"
                >
                  <div class="text-gray-100 font-medium">
                    {{ user.displayName || `${user.firstName} ${user.lastName}` }}
                  </div>
                  <div class="text-sm text-gray-400">{{ user.email }}</div>
                </div>
              </div>
              
              <!-- Loading Indicator -->
              <div 
                v-if="searchLoading" 
                class="absolute right-3 top-2.5"
              >
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
            </div>
            
            <IconButton
              @click="addTeamMember(selectedTeam.id, newMemberEmail)"
              :icon="UserPlusIcon"
              label="Add team member"
              variant="primary"
              :disabled="!newMemberEmail"
            />
          </div>
          <p v-if="selectedTeam.wiretapTeamId" class="text-xs text-blue-400">
            ✓ The user will be added to both MRM and Wiretap teams
          </p>
          <p v-else class="text-xs text-blue-400">
            The user will be added to the MRM team only
          </p>
        </div>
      </div>
    </BaseModal>
  </div>

  <!-- Loading State -->
  <div v-else class="flex justify-center items-center py-12">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-sm text-gray-400">Loading event details...</p>
    </div>
  </div>

  <!-- Error State -->
  <div v-if="!event && !loading" class="text-center py-12">
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
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventStore } from '@/stores/eventStore'
import { useAuthStore } from '@/stores/authStore'
import { usePermissions } from '@/composables/usePermissions'
import BaseButton from '@/components/common/BaseButton.vue'
import IconButton from '@/components/common/IconButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import TeamSwitcher from '@/components/events/TeamSwitcher.vue'
import type { Event } from '@/types/api'
import QRCodeVue3 from 'qrcode-vue3'
import { EyeIcon, PencilSquareIcon, TrashIcon, UserMinusIcon, UserPlusIcon } from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import { apiService } from '@/services/api'
import { UserGroupIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const eventStore = useEventStore()
const authStore = useAuthStore()
const { can } = usePermissions()
const toast = useToast()

const event = ref<Event | null>(null)
const loading = ref(false)
const showTeamsModal = ref(false)
const userRSVP = ref<string | null>(null)
const rsvpFilter = ref('')

// Teams functionality
const membersPerTeam = ref(4)
const autoAssignEnabled = ref(false)
const allowTeamSwitching = ref(false)
const syncLoading = ref(false)
const createTeamLoading = ref(false)
const qrCodeRef = ref<any>(null)
const eventTeams = ref<any[]>([])
const wiretapWorkshops = ref<any[]>([])

// Helper function to reload all relevant data after actions
const reloadEventData = async () => {
  await Promise.all([
    loadEvent(), // Reload event data to get updated RSVP counts and settings
    loadEventTeams(), // Refresh teams data
    checkUserRSVP() // Refresh user's RSVP status
  ])
}

// Helper function to refresh the selectedTeam reference with updated data
const refreshSelectedTeam = () => {
  if (selectedTeam.value) {
    const updatedTeam = eventTeams.value.find(t => t.id === selectedTeam.value.id)
    if (updatedTeam) {
      selectedTeam.value = updatedTeam
    }
  }
}

// Validation function for members per team
const validateMembersPerTeam = () => {
  if (membersPerTeam.value < 1) {
    membersPerTeam.value = 1
  } else if (membersPerTeam.value > 20) {
    membersPerTeam.value = 20
  }
}

// Save team configuration to database
const saveTeamConfiguration = async () => {
  if (!event.value?.id) return
  
  try {
    await eventStore.updateEvent(event.value.id, {
      membersPerTeam: membersPerTeam.value,
      autoAssignEnabled: autoAssignEnabled.value,
      allowTeamSwitching: allowTeamSwitching.value
    })
    
    toast.success('Team configuration saved')
  } catch (error) {
    console.error('Failed to save team configuration:', error)
    toast.error('Failed to save team configuration')
  }
}
const selectedWiretapWorkshop = ref('')
const showManualAssignment = ref(false)
const selectedTeam = ref<any>(null)
const newMemberEmail = ref('')
const searchResults = ref<any[]>([])
const showSearchResults = ref(false)
const searchLoading = ref(false)

const eventId = computed(() => route.params.id as string)

const canEditEvent = computed(() => can('update', 'Event'))
const canCheckIn = computed(() => can('create', 'Event'))

const isEventPast = computed(() => {
  if (!event.value?.endTime) return false
  return new Date(event.value.endTime) < new Date()
})

const getRSVPButtonText = () => {
  if (!userRSVP.value) return 'RSVP'
  switch (userRSVP.value) {
    case 'CONFIRMED':
      return 'Attending'
    case 'DECLINED':
      return 'Not Attending'
    case 'PENDING':
      return 'RSVP Pending'
    case 'WAITLIST':
      return 'On Waitlist'
    default:
      return 'RSVP'
  }
}

const getRSVPButtonVariant = () => {
  if (!userRSVP.value) return 'secondary'
  switch (userRSVP.value) {
    case 'CONFIRMED':
      return 'success'
    case 'DECLINED':
      return 'danger'
    case 'PENDING':
      return 'secondary'
    case 'WAITLIST':
      return 'secondary'
    default:
      return 'secondary'
  }
}

const getRSVPButtonIcon = () => {
  if (!userRSVP.value) {
    // Default RSVP icon - calendar with plus
    return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
  }
  switch (userRSVP.value) {
    case 'CONFIRMED':
      // Checkmark in circle
      return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    case 'DECLINED':
      // X in circle
      return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
    case 'PENDING':
      // Clock
      return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
    case 'WAITLIST':
      // Hourglass
      return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    default:
      // Default RSVP icon
      return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
  }
}


onMounted(async () => {
  await loadEvent()
  checkUserRSVP()
  await loadEventTeams()
  await loadWiretapWorkshops()
})

const loadEvent = async () => {
  try {
    loading.value = true
    const eventData = await eventStore.fetchEvent(eventId.value)
    event.value = eventData
    
    // Load team configuration from database
    if (eventData) {
      membersPerTeam.value = eventData.membersPerTeam || 4
      autoAssignEnabled.value = eventData.autoAssignEnabled || false
      allowTeamSwitching.value = eventData.allowTeamSwitching || false
    }
  } catch (error) {
    console.error('Failed to load event:', error)
    event.value = null
  } finally {
    loading.value = false
  }
}

const checkUserRSVP = () => {
  if (!event.value?.rsvps || !authStore.user) return
  
  const userRSVPData = event.value.rsvps.find(
    rsvp => rsvp.userId === authStore.user?.id
  )
  
  if (userRSVPData) {
    userRSVP.value = userRSVPData.status
  }
}


const editEvent = () => {
  router.push(`/events/${eventId.value}/edit`)
}

const goToCheckIn = () => {
  router.push(`/events/${eventId.value}/checkin`)
}

const goToWiretap = () => {
  window.open('https://tap.psuccso.org', '_blank')
}

const goToRSVPPage = () => {
  if (event.value?.id) {
    router.push(`/events/${event.value.id}/rsvp`)
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


const getEventStatus = (startTime?: string, endTime?: string) => {
  if (!startTime) return 'Inactive'
  const now = new Date()
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : null

  if (end && now > end) {
    return 'Inactive'
  }
  if (now < start) {
    return 'Upcoming'
  }
  return 'Active'
}

const getEventStatusColor = (startTime?: string, endTime?: string) => {
  if (!startTime) return 'bg-gray-700 text-gray-400'
  const now = new Date()
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : null

  if (end && now > end) {
    return 'bg-gray-700 text-gray-400'
  }
  if (now < start) {
    return 'bg-blue-900 text-blue-200'
  }
  return 'bg-green-900 text-green-200'
}

const confirmedRSVPs = computed(() => {
  return event.value?.rsvps?.filter((rsvp: any) => rsvp.status === 'CONFIRMED').length || 0
})

const pendingRSVPs = computed(() => {
  return event.value?.rsvps?.filter((rsvp: any) => rsvp.status === 'PENDING').length || 0
})

const declinedRSVPs = computed(() => {
  return event.value?.rsvps?.filter((rsvp: any) => rsvp.status === 'DECLINED').length || 0
})

const waitlistRSVPs = computed(() => {
  return event.value?.rsvps?.filter((rsvp: any) => rsvp.status === 'WAITLIST').length || 0
})

const checkedInConfirmedCount = computed(() => {
  if (!event.value?.rsvps || !event.value?.checkIns) return 0
  
  const confirmedUserIds = new Set(
    event.value.rsvps
      .filter((rsvp: any) => rsvp.status === 'CONFIRMED')
      .map((rsvp: any) => rsvp.userId)
  )
  
  const checkedInUserIds = new Set(
    event.value.checkIns.map((checkIn: any) => checkIn.userId)
  )
  
  // Count users who are both confirmed and checked in
  let count = 0
  for (const userId of confirmedUserIds) {
    if (checkedInUserIds.has(userId)) {
      count++
    }
  }
  
  return count
})

const filteredRSVPs = computed(() => {
  if (!event.value?.rsvps) return []
  
  if (!rsvpFilter.value) {
    return event.value.rsvps
  }
  
  return event.value.rsvps.filter((rsvp: any) => rsvp.status === rsvpFilter.value)
})

const qrCodeValue = computed(() => {
  if (!event.value) return ''
  return `${window.location.origin}/checkin/${event.value.checkInCode}`
})

// Teams computed properties

// Teams methods
const openTeamsModal = async () => {
  // Initialize Wiretap workshop selection from event's wiretapWorkshopId
  if (event.value?.wiretapWorkshopId) {
    selectedWiretapWorkshop.value = event.value.wiretapWorkshopId
  } else {
    selectedWiretapWorkshop.value = ''
  }
  
  // Load current teams
  await loadEventTeams()
  
  // If event has Wiretap integration and no teams exist, suggest syncing from Wiretap
  if (event.value?.wiretapWorkshopId && eventTeams.value.length === 0) {
    // Teams will be synced from Wiretap when user clicks "Sync All"
    console.log('No teams found. Use "Sync All" to pull teams from Wiretap.')
  }
  
  showTeamsModal.value = true
}

const enableTeams = async () => {
  if (!event.value?.id) return
  
  try {
    await eventStore.enableEventTeams(event.value.id)
    toast.success('Teams enabled successfully')
    
    // Reload all relevant data after enabling teams
    await reloadEventData()
  } catch (error) {
    console.error('Failed to enable teams:', error)
    toast.error('Failed to enable teams. Please try again.')
  }
}

const loadEventTeams = async () => {
  if (!event.value?.id) return
  
  try {
    const result = await eventStore.getEventTeams(event.value.id)
    eventTeams.value = result.data || []
    
    // If teams exist and have Wiretap integration, set the workshop ID from the API response
    if (eventTeams.value.length > 0 && eventTeams.value.some(team => team.wiretapProjectId)) {
      // Find the first team with Wiretap integration and get its workshop ID
      const teamWithWorkshop = eventTeams.value.find(team => team.wiretapWorkshopId)
      if (teamWithWorkshop?.wiretapWorkshopId) {
        selectedWiretapWorkshop.value = teamWithWorkshop.wiretapWorkshopId
      }
    }
  } catch (error) {
    console.error('Failed to load event teams:', error)
  }
}

const loadWiretapWorkshops = async () => {
  try {
    const result = await apiService.getWiretapWorkshops()
    wiretapWorkshops.value = result.data || []
  } catch (error) {
    console.error('Failed to load wiretap workshops:', error)
    toast.error('Failed to load wiretap workshops')
  }
}


const syncTeams = async (syncType: string) => {
  if (!event.value?.id) return
  
  syncLoading.value = true
  try {
    const result = await eventStore.syncEventTeams(
      event.value.id,
      syncType,
      membersPerTeam.value
    )
    
    // Show detailed success message for auto_assign
    if (syncType === 'auto_assign' && result.results) {
      const { usersAssigned } = result.results
      if (usersAssigned > 0) {
        toast.success(`Successfully assigned ${usersAssigned} users to teams!`)
      } else {
        toast.info('No users were assigned - all eligible users are already in teams')
      }
    } else {
      toast.success(result.message)
    }
    
    // Reload all relevant data after sync
    await reloadEventData()
    
    // Refresh the selectedTeam reference to show updated members if modal is open
    if (showManualAssignment.value) {
      refreshSelectedTeam()
    }
    
  } catch (error) {
    console.error('Failed to sync teams:', error)
    toast.error('Failed to sync teams. Please try again.')
  } finally {
    syncLoading.value = false
  }
}

const createTeam = async () => {
  if (!event.value?.id) return
  
  createTeamLoading.value = true
  try {
    const result = await eventStore.createEventTeam(event.value.id)
    
    toast.success(result.message || 'Team created successfully!')
    
    // Reload teams data
    await loadEventTeams()
    
  } catch (error) {
    console.error('Failed to create team:', error)
    toast.error('Failed to create team. Please try again.')
  } finally {
    createTeamLoading.value = false
  }
}

const openTeamManagement = (team: any) => {
  selectedTeam.value = team
  showManualAssignment.value = true
}

const deleteTeam = async (teamId: string) => {
  if (!event.value?.id) return
  
  const team = eventTeams.value.find(t => t.id === teamId)
  const confirmMessage = team?.wiretapProjectId 
    ? 'Are you sure you want to delete this team? This will also remove it from Wiretap.'
    : 'Are you sure you want to delete this team?'
  
  if (!confirm(confirmMessage)) {
    return
  }
  
  try {
    await eventStore.deleteEventTeam(event.value.id, teamId)
    toast.success('Team deleted successfully')
    
    // Reload all relevant data after deleting team
    await reloadEventData()
  } catch (error) {
    console.error('Failed to delete team:', error)
    toast.error('Failed to delete team. Please try again.')
  }
}

let searchTimeout: NodeJS.Timeout | null = null

const searchUsers = async () => {
  const query = newMemberEmail.value.trim()
  
  if (!query || query.length < 2) {
    searchResults.value = []
    showSearchResults.value = false
    return
  }

  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // Debounce search by 300ms
  searchTimeout = setTimeout(async () => {
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

const selectUser = (user: any) => {
  newMemberEmail.value = user.email
  searchResults.value = []
  showSearchResults.value = false
}

const hideSearchResults = () => {
  // Delay hiding to allow for click events
  setTimeout(() => {
    showSearchResults.value = false
  }, 200)
}

const addTeamMember = async (teamId: string, email: string) => {
  if (!event.value?.id || !email) return
  
  try {
    // Add to MRM team
    await eventStore.addTeamMember(event.value.id, teamId, email)
    
    // If team has Wiretap integration, also sync to Wiretap
    const team = eventTeams.value.find(t => t.id === teamId)
    if (team?.wiretapTeamId) {
      try {
        // Sync to Wiretap team
        await eventStore.syncEventTeams(event.value.id, 'sync_all')
        toast.success('Member added successfully and synced to Wiretap')
      } catch (wiretapError) {
        console.warn('Failed to sync to Wiretap, but member was added to MRM:', wiretapError)
        toast.success('Member added to MRM team (Wiretap sync failed)')
      }
    } else {
      toast.success('Member added successfully')
    }
    
    // Reload all relevant data after adding member
    await Promise.all([
      loadEventTeams(),
      loadEvent(), // Reload event data to get updated RSVP counts
      checkUserRSVP() // Refresh user's RSVP status
    ])
    
    // Refresh the selectedTeam reference to show updated members
    refreshSelectedTeam()
    
    newMemberEmail.value = ''
  } catch (error) {
    console.error('Failed to add team member:', error)
    toast.error('Failed to add team member. Please try again.')
  }
}

const removeTeamMember = async (teamId: string, email: string) => {
  if (!event.value?.id) return
  
  try {
    // Remove from MRM team (backend also handles Wiretap/team pending cleanup)
    await eventStore.removeTeamMember(event.value.id, teamId, email)
    toast.success('Member removed successfully')
    
    // Reload all relevant data after removing member
    await Promise.all([
      loadEventTeams(),
      loadEvent(), // Reload event data to get updated RSVP counts
      checkUserRSVP() // Refresh user's RSVP status
    ])
    
    // Refresh the selectedTeam reference to show updated members
    refreshSelectedTeam()
  } catch (error) {
    console.error('Failed to remove team member:', error)
    toast.error('Failed to remove team member. Please try again.')
  }
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
    link.download = `qr-code-${event.value?.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'event'}.png`
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

const copyCheckInLink = async () => {
  if (!qrCodeValue.value) {
    console.error('No check-in link available')
    return
  }

  try {
    await navigator.clipboard.writeText(qrCodeValue.value)
    toast.success('Check-in link copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = qrCodeValue.value
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      toast.success('Check-in link copied to clipboard!')
    } catch (fallbackError) {
      console.error('Fallback copy failed:', fallbackError)
      toast.error('Failed to copy link. Please copy manually.')
    }
    document.body.removeChild(textArea)
  }
}
</script>
