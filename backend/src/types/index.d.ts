import { Role, TeamType, TeamSubtype, TeamRole, EventCategory, AttendanceType, RSVPStatus } from '@prisma/client';

// User types
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  paidStatus: boolean;
  qrCode?: string;
  role: Role;
  authentikId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userGroups?: Array<{
    id: string;
    userId: string;
    groupId: string;
    group: GroupProfile;
  }>;
  userTeams?: Array<{
    id: string;
    userId: string;
    teamId: string;
    role: TeamRole;
    team: TeamProfile;
  }>;
  events?: Array<{
    id: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    category: EventCategory;
    linkedTeamId?: string;
    attendanceType: AttendanceType;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  paidStatus?: boolean;
  role?: Role;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  paidStatus?: boolean;
  role?: Role;
}

// Group types
export interface GroupProfile {
  id: string;
  name: string;
  description?: string | null;
  externalId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  externalId?: string;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  externalId?: string;
}

// Team types
export interface TeamProfile {
  id: string;
  name: string;
  description?: string;
  type: TeamType;
  subtype?: TeamSubtype;
  parentTeamId?: string;
  groupId?: string;
  semester?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  type: TeamType;
  subtype?: TeamSubtype;
  parentTeamId?: string;
  groupId?: string;
  semester?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  type?: TeamType;
  subtype?: TeamSubtype;
  parentTeamId?: string;
  groupId?: string;
  semester?: string;
}

// Event types
export interface EventProfile {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category: EventCategory;
  linkedTeamId?: string;
  attendanceType: AttendanceType;
  attendanceCap?: number;
  waitlistEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category: EventCategory;
  linkedTeamId?: string;
  attendanceType?: AttendanceType;
  attendanceCap?: number;
  waitlistEnabled?: boolean;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  category?: EventCategory;
  linkedTeamId?: string;
  attendanceType?: AttendanceType;
  attendanceCap?: number;
  waitlistEnabled?: boolean;
}

// RSVP types
export interface RSVPProfile {
  id: string;
  userId: string;
  eventId: string;
  status: RSVPStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRSVPRequest {
  eventId: string;
  status: RSVPStatus;
}

export interface UpdateRSVPRequest {
  status: RSVPStatus;
}

// Check-in types
export interface CheckInProfile {
  id: string;
  userId: string;
  eventId: string;
  qrCode: string;
  checkedInAt: Date;
}

export interface CheckInRequest {
  eventId: string;
  qrCode: string;
}

// Authentication types
export interface AuthenticatedUser {
  id: string;
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  role: Role;
  groups: string[];
}

export interface AuthSession {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Query types
export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  paidStatus?: boolean;
  isActive?: boolean;
  groupId?: string;
  teamId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TeamQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: TeamType;
  groupId?: string;
  semester?: string;
}

export interface EventQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: EventCategory;
  startDate?: string;
  endDate?: string;
  teamId?: string;
}

// Task types
export interface TaskJob {
  id: string;
  type: string;
  data: any;
  priority?: number;
  delay?: number;
}

export interface EmailTask {
  to: string | string[];
  subject: string;
  body: string;
  template?: string;
  templateData?: Record<string, any>;
}

export interface ListMonkTask {
  action: 'subscribe' | 'unsubscribe' | 'update' | 'create' | 'delete' | 'sync';
  data: {
    email?: string;
    listId?: string | number;
    subscriberId?: string;
    subscriber?: Partial<ListMonkSubscriber>;
    lists?: number[];
    status?: 'enabled' | 'disabled' | 'blocklisted';
  };
  options?: {
    retryOnFailure?: boolean;
    notifyOnFailure?: boolean;
    priority?: 'low' | 'normal' | 'high';
  };
}

export interface QRCodeTask {
  userId: string;
  size?: number;
}

export interface SyncGroupsTask {
  force?: boolean;
}

// Team Provisioning types
export interface TeamProvisioningTask {
  teamId: string;
  action: 'create' | 'update' | 'delete';
  data: CreateTeamRequest | UpdateTeamRequest;
  userId: string; // User performing the action
  options?: TeamProvisioningOptions; // Optional provisioning configuration
  backgroundTaskId?: string; // Optional: DB task to update during processing
}

export interface TeamProvisioningOptions {
  // Always enabled services
  authentik: boolean; // Always true
  nextcloudGroup: boolean; // Always true
  
  // Optional services
  wikijs: boolean;
  nextcloudFolder: boolean;
  nextcloudCalendar: boolean;
  nextcloudDeck: boolean;
  github: boolean;
  discord: boolean;
}

export interface TeamProvisioningResult {
  success: boolean;
  teamId: string;
  action: string;
  options?: TeamProvisioningOptions;
  results: {
    authentik?: IntegrationResult;
    wikijs?: IntegrationResult;
    nextcloud?: IntegrationResult;
    github?: IntegrationResult;
    discord?: IntegrationResult;
  };
  errors: string[];
  warnings: string[];
}

export interface IntegrationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration: number;
}

// External Integration types
export interface AuthentikGroup {
  id: string;
  name: string;
  description?: string;
  parentGroupId?: string;
  users: string[];
}

export interface AuthentikUser {
  id: string;
  username: string;
  email: string;
  groups: string[];
  attributes?: Record<string, any>;
}

// Wiretap Integration types
export interface WiretapProject {
  id: string;
  name: string;
  description?: string;
  parentProjectId?: string;
  users: string[];
  resources: string[];
  teams?: Array<{
    id: string;
    name: string;
    description?: string;
    workshop_id: string;
    team_number: number;
    enabled: number;
    created_at: string;
    updated_at: string;
  }>;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface WiretapUser {
  id: string;
  username: string;
  email: string;
  projects: string[];
  roles: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WiretapResource {
  id: string;
  name: string;
  type: string;
  projectId: string;
  status: 'creating' | 'active' | 'deleting' | 'error';
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WikiPage {
  path: string;
  title: string;
  content: string;
  permissions: WikiPermission[];
}

export interface WikiPermission {
  groupId: string;
  permissions: string[];
}

export interface NextcloudGroup {
  id: string;
  name: string;
  members: string[];
}

export interface NextcloudFolder {
  path: string;
  permissions: string[];
  groupId: string;
  folderId?: string;
}

export interface NextcloudCalendar {
  name: string;
  groupId: string;
}

export interface NextcloudDeckBoard {
  name: string;
  groupId: string;
  boardId?: string;
}

export interface GitHubTeam {
  id: string;
  name: string;
  slug: string;
  description?: string;
  members: string[];
}

export interface GitHubRepository {
  name: string;
  description?: string;
  private: boolean;
  teamId: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  categoryId: string;
  permissions: DiscordPermission[];
}

export interface DiscordRole {
  id: string;
  name: string;
  permissions: string[];
  members: string[];
}

export interface DiscordPermission {
  roleId: string;
  permissions: string[];
}

// Team Management types
export interface TeamMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: TeamRole;
  discordId?: string;
  githubUsername?: string;
  nextcloudUsername?: string;
}

export interface TeamProvisioningConfig {
  authentik: {
    baseUrl: string;
    token: string;
    parentGroupTemplate: string;
  };
  wikijs: {
    baseUrl: string;
    token: string;
    basePath: string;
  };
  nextcloud: {
    baseUrl: string;
    username: string;
    password: string;
    basePath: string;
  };
  github: {
    baseUrl: string;
    token: string;
    organization: string;
    parentTeamId: string;
  };
  discord: {
    botToken: string;
    guildId: string;
    categoryId: string;
  };
  wiretap: {
    baseUrl: string;
    token: string;
    projectTemplate: string;
  };
}

// Permission types
export interface Ability {
  action: string;
  subject: string;
  conditions?: any;
}

export interface PermissionCheck {
  action: string;
  subject: string;
  subjectId?: string;
}

// ListMonk types
export interface ListMonkConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeout?: number;
}

export interface ListMonkSubscriber {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  status: 'enabled' | 'disabled' | 'blocklisted';
  lists: number[];
  attributes?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ListMonkList {
  id: number;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'optin' | 'optout';
  optin: 'single' | 'double';
  tags?: string[];
  subscriberCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ListMonkCampaign {
  id: number;
  name: string;
  subject: string;
  body: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'finished';
  lists: number[];
  templateId?: number;
  createdAt?: Date;
  updatedAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface CreateSubscriberRequest {
  email: string;
  name?: string;
  status?: 'enabled' | 'disabled' | 'blocklisted';
  lists: number[];
  attributes?: Record<string, any>;
}

export interface UpdateSubscriberRequest {
  email?: string;
  name?: string;
  status?: 'enabled' | 'disabled' | 'blocklisted';
  lists?: number[];
  attributes?: Record<string, any>;
}

export interface CreateListRequest {
  name: string;
  description?: string;
  type?: 'public' | 'private' | 'optin' | 'optout';
  optin?: 'single' | 'double';
  tags?: string[];
}

export interface UpdateListRequest {
  name?: string;
  description?: string;
  type?: 'public' | 'private' | 'optin' | 'optout';
  optin?: 'single' | 'double';
  tags?: string[];
}

export interface CreateCampaignRequest {
  name: string;
  subject: string;
  body: string;
  lists: number[];
  templateId?: number;
  status?: 'draft' | 'scheduled';
}

export interface UpdateCampaignRequest {
  name?: string;
  subject?: string;
  body?: string;
  lists?: number[];
  templateId?: number;
  status?: 'draft' | 'scheduled' | 'running' | 'paused' | 'finished';
}
