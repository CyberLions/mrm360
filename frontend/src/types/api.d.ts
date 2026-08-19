// Payment types
export interface Payment {
  id: string
  userId: string
  amount: number
  paymentType: 'SEMESTER' | 'YEARLY'
  semester: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  paymentMethod?: string
  transactionId?: string
  paidAt?: string
  expiresAt: string
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    email: string
    firstName: string
    lastName: string
  }
}

export interface PaymentStats {
  totalPayments: number
  activePayments: number
  expiredPayments: number
  totalRevenue: number
  paymentsByType: {
    SEMESTER: number
    YEARLY: number
  }
}

export interface UserPaymentStatus {
  isPaid: boolean
  payments: Payment[]
  activePayments: Payment[]
  expiredPayments: Payment[]
  nextExpiration?: string
}

export interface InventoryBin { id: string; name: string; room?: string; code?: string; description?: string; _count?: { items: number } }
export interface InventoryItem {
  id: string
  barcode: string
  name: string
  binId?: string
  bin?: InventoryBin
  checkedOutToId?: string
  checkedOutTo?: { id: string; email?: string; firstName: string; lastName: string; displayName?: string }
  loans?: Array<{ checkedOutAt: string; checkedInAt?: string }>
  createdAt?: string
  updatedAt?: string
}
export interface ItemLoan {
  id: string
  itemId: string
  userId: string
  checkedOutAt: string
  checkedInAt?: string
  returnBinId?: string
  note?: string
  item: InventoryItem
  returnBin?: InventoryBin
  user?: { id: string; firstName: string; lastName: string; displayName?: string }
}

// User types
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  displayName: string
  avatar?: string
  isActive: boolean
  isPaid: boolean
  paidUntil?: string
  qrCode?: string
  role?: string
  createdAt: string
  updatedAt: string
  authentikGroups: string[]
  teams: Team[]
  userTeams?: UserTeam[] // Backend returns this structure
  events: Event[]
  discordAccount?: DiscordAccount
  interests?: UserInterest[]
  payments?: Payment[]
}

export interface UserCreate {
  email: string
  firstName: string
  lastName: string
  displayName: string
  role?: 'ADMIN' | 'EXEC_BOARD' | 'MEMBER'
  paidStatus?: boolean
  authentikGroups: string[]
}

export interface UserUpdate {
  firstName?: string
  lastName?: string
  displayName?: string
  isPaid?: boolean // Maps to paidStatus in backend
  authentikGroups?: string[]
}

// Team types
export interface Team {
  id: string
  name: string
  description?: string
  type: 'COMPETITION' | 'DEVELOPMENT'
  subtype?: 'BLUE' | 'RED' | 'CTF'
  semester: string
  parentTeamId?: string
  parentTeam?: Team
  subteams: Team[]
  groupId?: string
  group?: Group
  userTeams: UserTeam[]
  events: Event[]
  createdAt: string
  updatedAt: string
}

export enum TeamType {
  COMPETITION = 'COMPETITION',
  DEVELOPMENT = 'DEVELOPMENT'
}

export enum TeamSubtype {
  BLUE = 'BLUE',
  RED = 'RED',
  CTF = 'CTF'
}

export interface UserTeam {
  id: string
  userId: string
  teamId: string
  role: 'LEADER' | 'MEMBER'
  joinedAt: string
  user: User
}

export interface TeamCreate {
  name: string
  description?: string
  type: 'COMPETITION' | 'DEVELOPMENT'
  subtype?: 'BLUE' | 'RED' | 'CTF'
  semester?: string
  parentTeamId?: string
  groupId?: string
  members: { userId: string; role: 'MEMBER' | 'LEADER' }[]
  provisioningOptions?: TeamProvisioningOptions
}

export interface TeamUpdate {
  name?: string
  description?: string
  type?: 'COMPETITION' | 'DEVELOPMENT'
  subtype?: 'BLUE' | 'RED' | 'CTF'
  semester?: string
  parentTeamId?: string
  groupId?: string
  members?: { userId: string; role: 'MEMBER' | 'LEADER' }[]
  provisioningOptions?: TeamProvisioningOptions
}

// Team Provisioning types
export interface TeamProvisioningOptions {
  // Always enabled services (not configurable)
  authentik: boolean // Always true
  nextcloudGroup: boolean // Always true
  
  // Optional services
  wikijs: boolean
  nextcloudFolder: boolean
  nextcloudCalendar: boolean
  nextcloudDeck: boolean
  github: boolean
  discord: boolean
}

export interface TeamProvisioningStatus {
  success: boolean
  teamId: string
  action: 'create' | 'update' | 'delete'
  options?: TeamProvisioningOptions
  results: {
    authentik?: IntegrationResult
    wikijs?: IntegrationResult
    nextcloud?: IntegrationResult
    github?: IntegrationResult
    discord?: IntegrationResult
  }
  errors: string[]
  warnings: string[]
}

export interface IntegrationResult {
  success: boolean
  message: string
  data?: any
  error?: string
  duration: number
}

// Workshop Series types
export interface WorkshopSeries {
  id: string
  name: string
  description?: string
  badgeClassId: string
  requiredCheckIns: number
  autoIssue: boolean
  events: Event[]
  createdAt: string
  updatedAt: string
}

export interface WorkshopSeriesCreate {
  name: string
  description?: string
  badgeClassId: string
  requiredCheckIns: number
  autoIssue?: boolean
}

export interface WorkshopSeriesUpdate {
  name?: string
  description?: string
  badgeClassId?: string
  requiredCheckIns?: number
  autoIssue?: boolean
}

export interface BadgeClass {
  id: string
  issuerId: string
  name: string
  description: string
  imageUrl: string
  criteriaUrl?: string
  criteriaNarrative?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

// Event types
export interface Event {
  id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  category: 'MEETING' | 'COMPETITION' | 'WORKSHOP' | 'SOCIAL' | 'TRAINING'
  semester: string
  linkedTeamId?: string
  linkedTeam?: Team
  wiretapWorkshopId?: string
  seriesId?: string
  series?: WorkshopSeries
  attendanceType: 'STRICT' | 'SOFT'
  attendanceCap?: number
  waitlistEnabled: boolean
  teamsEnabled: boolean
  membersPerTeam?: number
  autoAssignEnabled?: boolean
  allowTeamSwitching?: boolean
  checkInCode: string
  rsvps: Array<{
    id: string
    userId: string
    status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'MAYBE' | 'WAITLIST'
    user: User
    createdAt: string
    updatedAt: string
  }>
  checkIns: Array<{
    id: string
    userId: string
    qrCode: string
    user: User
    checkedInAt: string
  }>
  createdAt: string
  updatedAt: string
}

export interface EventCreate {
  title: string
  description?: string
  startTime: string
  endTime: string
  category: 'MEETING' | 'COMPETITION' | 'WORKSHOP' | 'SOCIAL' | 'TRAINING'
  semester?: string
  linkedTeamId?: string
  wiretapWorkshopId?: string
  seriesId?: string
  attendanceType: 'STRICT' | 'SOFT'
  attendanceCap?: number
  waitlistEnabled?: boolean
  teamsEnabled?: boolean
}

export interface EventUpdate {
  title?: string
  description?: string
  startTime?: string
  endTime?: string
  category?: 'MEETING' | 'COMPETITION' | 'WORKSHOP' | 'SOCIAL' | 'TRAINING'
  semester?: string
  linkedTeamId?: string
  wiretapWorkshopId?: string
  seriesId?: string
  attendanceType?: 'STRICT' | 'SOFT'
  attendanceCap?: number
  waitlistEnabled?: boolean
  teamsEnabled?: boolean
  membersPerTeam?: number
  autoAssignEnabled?: boolean
  allowTeamSwitching?: boolean
}

// Group types (from Authentik)
export interface Group {
  id: string
  name: string
  description?: string
  members: User[]
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  name: string
  description?: string
  status: TaskStatus
  progress: number
  result?: any
  error?: string
  entityType?: string
  entityId?: string
  parentTaskId?: string
  stepIndex?: number
  startedAt?: string
  finishedAt?: string
  createdAt: string
  updatedAt: string
  subtasks: Task[]
}

export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// Auth types
export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  displayName: string
  avatar?: string
  username?: string
  role?: string
  paidStatus?: boolean
  isActive?: boolean
  authentikId?: string
  authentikPk?: string
  createdAt?: string
  authentikGroups: string[]
  abilities: Ability[]
  discordAccount?: DiscordAccount
  interests?: UserInterest[]
}

export interface Ability {
  action: string
  subject: string
  conditions?: Record<string, any>
}

export interface LoginResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

// API Response types
export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  statistics?: {
    total: number
    pending: number
    running: number
    completed: number
    failed: number
  }
}

// Dashboard types
export interface DashboardStats {
  totalMembers: number
  totalTeams: number
  upcomingEvents: number
  paidMembers: number
  unpaidMembers: number
  activeEvents: number
}

// Search and filter types
export interface SearchFilters {
  query?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface UserFilters extends SearchFilters {
  isActive?: boolean
  isPaid?: boolean
  teamId?: string
  groupId?: string
}

export interface EventFilters extends SearchFilters {
  startDate?: string
  endDate?: string
  linkedTeamId?: string
  seriesId?: string
  category?: 'MEETING' | 'COMPETITION' | 'WORKSHOP' | 'SOCIAL' | 'TRAINING'
  semester?: string
}

export interface TeamFilters extends SearchFilters {
  type?: TeamType
  parentTeamId?: string
  semester?: string
}

// Onboarding types
export interface DiscordAccount {
  id: string
  userId: string
  discordId: string
  username: string
  discriminator?: string
  avatar?: string
  linkedAt: string
}

export interface UserInterest {
  id: string
  userId: string
  interest: InterestType
  createdAt: string
}

export enum InterestType {
  OFFENSE = 'OFFENSE',
  DEFENSE = 'DEFENSE',
  CTF = 'CTF',
  GAMING = 'GAMING'
}

export enum ClassRank {
  FIRST_YEAR = 'FIRST_YEAR',
  SECOND_YEAR = 'SECOND_YEAR',
  THIRD_YEAR = 'THIRD_YEAR',
  FOURTH_YEAR = 'FOURTH_YEAR',
  ALUMNI_OTHER = 'ALUMNI_OTHER'
}

export interface OnboardingData {
  classRank: ClassRank
  interests: InterestType[]
  subscribeNewsletter: boolean
}
