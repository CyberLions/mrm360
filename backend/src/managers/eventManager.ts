import { PrismaClient, Event, EventCategory, AttendanceType, User, Team } from '@prisma/client';
import { logger } from '@/utils/logger';
import { randomBytes } from 'crypto';
import {
  sendRsvpConfirmedEmail,
  sendRsvpDeclinedEmail,
  sendRsvpWaitlistedEmail,
  sendWaitlistPromotedEmail,
} from '@/services/eventEmailService';
import { TaskManager } from '@/managers/taskManager';
import { inferSemester } from '@/utils/semester';

export interface CreateEventData {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category: EventCategory;
  linkedTeamId?: string;
  wiretapWorkshopId?: string;
  seriesId?: string;
  attendanceType: AttendanceType;
  attendanceCap?: number;
  waitlistEnabled?: boolean;
  teamsEnabled?: boolean;
  membersPerTeam?: number;
  autoAssignEnabled?: boolean;
  allowTeamSwitching?: boolean;
  semester?: string;
}

export interface UpdateEventData extends Partial<CreateEventData> {}

export interface RSVPData {
  userId: string;
  eventId: string;
  status: 'CONFIRMED' | 'DECLINED' | 'MAYBE' | 'WAITLIST';
}

export interface AttendanceCheckInData {
  qrCode: string;
  eventId: string;
}

export class EventManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createEvent(data: CreateEventData): Promise<Event> {
    try {
      logger.info('Creating new event', { title: data.title, category: data.category });
      
      // Generate a unique check-in code (8 characters)
      const checkInCode = randomBytes(4).toString('hex').toUpperCase();
      
      const event = await this.prisma.event.create({
        data: {
          title: data.title,
          description: data.description,
          startTime: data.startTime,
          endTime: data.endTime,
          category: data.category,
          linkedTeamId: data.linkedTeamId && data.linkedTeamId.trim() !== '' ? data.linkedTeamId : null,
          wiretapWorkshopId: data.wiretapWorkshopId && data.wiretapWorkshopId.trim() !== '' ? data.wiretapWorkshopId : null,
          seriesId: data.seriesId && data.seriesId.trim() !== '' ? data.seriesId : null,
          semester: data.semester || inferSemester(data.startTime).semester,
          attendanceType: data.attendanceType,
          attendanceCap: data.attendanceCap,
          waitlistEnabled: data.waitlistEnabled || false,
          teamsEnabled: data.teamsEnabled || (data.wiretapWorkshopId && data.wiretapWorkshopId.trim() !== '' ? true : false), // Use provided value or auto-enable if Wiretap workshop is specified
          membersPerTeam: data.membersPerTeam || 4, // Default to 4 members per team
          autoAssignEnabled: data.autoAssignEnabled || false, // Default to false
          allowTeamSwitching: data.allowTeamSwitching || false, // Default to false
          checkInCode,
        },
        include: {
          linkedTeam: true,
          series: true,
          rsvps: {
            include: {
              user: true,
            },
          },
          checkIns: {
            include: {
              user: true,
            },
          },
        },
      });

      logger.info('Event created successfully', { eventId: event.id });
      return event;
    } catch (error) {
      logger.error('Failed to create event', { error, data });
      throw error;
    }
  }

  async getEventById(id: string): Promise<Event | null> {
    try {
      logger.info('Fetching event by ID', { eventId: id });
      
      const event = await this.prisma.event.findUnique({
        where: { id },
        include: {
          linkedTeam: true,
          series: true,
          rsvps: {
            include: {
              user: true,
            },
          },
          checkIns: {
            include: {
              user: true,
            },
          },
        },
      });

      return event;
    } catch (error) {
      logger.error('Failed to fetch event by ID', { error, eventId: id });
      throw error;
    }
  }

  async getAllEvents(filters?: {
    category?: EventCategory;
    linkedTeamId?: string;
    seriesId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    semester?: string;
  }): Promise<Event[]> {
    try {
      logger.info('Fetching all events', { filters });
      
      const where: any = {};
      
      if (filters?.category) {
        where.category = filters.category;
      }
      
      if (filters?.linkedTeamId) {
        where.linkedTeamId = filters.linkedTeamId;
      }

      if (filters?.seriesId) {
        where.seriesId = filters.seriesId;
      }
      if (filters?.semester) where.semester = filters.semester;

      if (filters?.startDate || filters?.endDate) {
        where.startTime = {};
        if (filters.startDate) {
          where.startTime.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.startTime.lte = filters.endDate;
        }
      }

      // Add search filter for title and description
      if (filters?.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // Determine sort order - default to most recent first
      const sortBy = filters?.sortBy || 'startTime';
      const sortOrder = filters?.sortOrder || 'desc';

      // Build orderBy based on sortBy field
      const orderBy: any = {};
      if (sortBy === 'title' || sortBy === 'category' || sortBy === 'startTime') {
        orderBy[sortBy] = sortOrder;
      } else {
        orderBy.startTime = sortOrder;
      }

      const events = await this.prisma.event.findMany({
        where,
        include: {
          linkedTeam: true,
          series: true,
          rsvps: {
            include: {
              user: true,
            },
          },
          checkIns: {
            include: {
              user: true,
            },
          },
        },
        orderBy,
      });

      return events;
    } catch (error) {
      logger.error('Failed to fetch events', { error, filters });
      throw error;
    }
  }

  async getEventsForUser(userId: string, filters?: {
    category?: EventCategory;
    linkedTeamId?: string;
    seriesId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    semester?: string;
  }): Promise<Event[]> {
    try {
      logger.info('Fetching events for user', { userId, filters });
      
      // Get user's team memberships
      const userTeams = await this.prisma.userTeam.findMany({
        where: { userId },
        include: {
          team: true,
        },
      });

      const userTeamIds = userTeams.map(ut => ut.teamId);
      const userTeamNames = userTeams.map(ut => ut.team.name.toLowerCase());

      // Define allowed team names
      const allowedTeamNames = ['blue team', 'red team', 'ctf team'];

      // Check if user is in any of the allowed teams
      const isInAllowedTeam = userTeamNames.some(teamName => 
        allowedTeamNames.includes(teamName)
      );

      // Build the where clause for events
      const where: any = {};
      
      if (filters?.category) {
        where.category = filters.category;
      }
      
      if (filters?.linkedTeamId) {
        where.linkedTeamId = filters.linkedTeamId;
      }

      if (filters?.seriesId) {
        where.seriesId = filters.seriesId;
      }
      if (filters?.semester) where.semester = filters.semester;

      if (filters?.startDate || filters?.endDate) {
        where.startTime = {};
        if (filters.startDate) {
          where.startTime.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.startTime.lte = filters.endDate;
        }
      }

      // Add search filter for title and description
      if (filters?.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // Determine sort order - default to most recent first
      const sortBy = filters?.sortBy || 'startTime';
      const sortOrder = filters?.sortOrder || 'desc';
      
      // Build orderBy based on sortBy field
      const orderBy: any = {};
      if (sortBy === 'title' || sortBy === 'category' || sortBy === 'startTime') {
        orderBy[sortBy] = sortOrder;
      } else {
        orderBy.startTime = sortOrder;
      }

      // Get all events first
      const allEvents = await this.prisma.event.findMany({
        where,
        include: {
          linkedTeam: true,
          series: true,
          rsvps: {
            include: {
              user: true,
            },
          },
          checkIns: {
            include: {
              user: true,
            },
          },
        },
        orderBy,
      });

      // Filter events based on visibility rules
      const visibleEvents = allEvents.filter(event => {
        // Rule 1: User has RSVP'd to this event
        const hasRSVP = event.rsvps.some(rsvp => rsvp.userId === userId);
        if (hasRSVP) {
          return true;
        }

        // Rule 2: Event is not tied to any team
        if (!event.linkedTeamId) {
          return true;
        }

        // Rule 3: Event is tied to user's team
        if (event.linkedTeamId && userTeamIds.includes(event.linkedTeamId)) {
          return true;
        }

        // Rule 4: Event is tied to allowed teams (blue team, red team, ctf team)
        if (event.linkedTeam && isInAllowedTeam) {
          const eventTeamName = event.linkedTeam.name.toLowerCase();
          if (allowedTeamNames.includes(eventTeamName)) {
            return true;
          }
        }

        return false;
      });

      logger.info(`Filtered ${allEvents.length} events to ${visibleEvents.length} visible events for user ${userId}`);
      return visibleEvents;
    } catch (error) {
      logger.error('Failed to fetch events for user', { error, userId, filters });
      throw error;
    }
  }

  async updateEvent(id: string, data: UpdateEventData): Promise<Event> {
    try {
      logger.info('Updating event', { eventId: id, updates: data });
      
      const updateData: any = { ...data };
      if (data.startTime && data.semester === undefined) {
        updateData.semester = inferSemester(data.startTime).semester;
      }
      if (data.linkedTeamId !== undefined) {
        updateData.linkedTeamId = data.linkedTeamId && data.linkedTeamId.trim() !== '' ? data.linkedTeamId : null;
      }
      if (data.wiretapWorkshopId !== undefined) {
        updateData.wiretapWorkshopId = data.wiretapWorkshopId && data.wiretapWorkshopId.trim() !== '' ? data.wiretapWorkshopId : null;
      }
      if ((data as any).seriesId !== undefined) {
        updateData.seriesId = (data as any).seriesId && (data as any).seriesId.trim() !== '' ? (data as any).seriesId : null;
      }

      const event = await this.prisma.event.update({
        where: { id },
        data: updateData,
        include: {
          linkedTeam: true,
          series: true,
          rsvps: {
            include: {
              user: true,
            },
          },
          checkIns: {
            include: {
              user: true,
            },
          },
        },
      });

      logger.info('Event updated successfully', { eventId: id });
      return event;
    } catch (error) {
      logger.error('Failed to update event', { error, eventId: id, data });
      throw error;
    }
  }

  async deleteEvent(id: string): Promise<void> {
    try {
      logger.info('Deleting event', { eventId: id });
      
      // Delete related records first
      await this.prisma.rSVP.deleteMany({
        where: { eventId: id },
      });
      
      await this.prisma.event.delete({
        where: { id },
      });

      logger.info('Event deleted successfully', { eventId: id });
    } catch (error) {
      logger.error('Failed to delete event', { error, eventId: id });
      throw error;
    }
  }

  async rsvpToEvent(data: RSVPData): Promise<{ success: boolean; message: string; status: string }> {
    try {
      logger.info('Processing RSVP', { userId: data.userId, eventId: data.eventId, status: data.status });
      
      // Get event details to check attendance cap
      const event = await this.prisma.event.findUnique({
        where: { id: data.eventId },
        include: {
          rsvps: {
            where: { status: 'CONFIRMED' }
          }
        }
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Check if user is already RSVP'd
      const existingRSVP = await this.prisma.rSVP.findUnique({
        where: {
          userId_eventId: {
            userId: data.userId,
            eventId: data.eventId,
          },
        },
      });

      let finalStatus = data.status;
      let message = '';

      // Handle attendance cap logic
      if (data.status === 'CONFIRMED' && event.attendanceCap) {
        const currentConfirmedCount = event.rsvps.length;
        
        if (currentConfirmedCount >= event.attendanceCap) {
          if (event.waitlistEnabled) {
            // If user is already confirmed and we're at cap, keep them confirmed
            if (existingRSVP && existingRSVP.status === 'CONFIRMED') {
              finalStatus = 'CONFIRMED';
              message = `You're confirmed for "${event.title}". The event is at capacity.`;
            } else {
              // Put new RSVPs on waitlist
              finalStatus = 'WAITLIST';
              message = `"${event.title}" is at capacity. You've been added to the waitlist.`;
            }
          } else {
            // No waitlist enabled, reject the RSVP
            finalStatus = 'DECLINED';
            message = `"${event.title}" is at capacity and no waitlist is available.`;
          }
        } else {
          // Under capacity, confirm normally
          finalStatus = 'CONFIRMED';
          message = `You're confirmed for "${event.title}"!`;
        }
      } else if (data.status === 'CONFIRMED') {
        // No attendance cap, confirm normally
        finalStatus = 'CONFIRMED';
        message = `You're confirmed for "${event.title}"!`;
      } else {
        // Declined or other status
        finalStatus = data.status;
        message = data.status === 'DECLINED' 
          ? `You've declined "${event.title}".`
          : `Your RSVP status has been updated for "${event.title}".`;
      }

      if (existingRSVP) {
        // Update existing RSVP
        await this.prisma.rSVP.update({
          where: {
            userId_eventId: {
              userId: data.userId,
              eventId: data.eventId,
            },
          },
          data: {
            status: finalStatus,
            updatedAt: new Date(),
          },
        });

        // If someone cancelled and there's a waitlist, promote someone
        if (existingRSVP.status === 'CONFIRMED' && finalStatus === 'DECLINED' && event.waitlistEnabled) {
          await this.promoteFromWaitlist(data.eventId);
        }
      } else {
        // Create new RSVP
        await this.prisma.rSVP.create({
          data: {
            userId: data.userId,
            eventId: data.eventId,
            status: finalStatus,
          },
        });
      }

      // Note: Auto-assignment is now only triggered during check-in, not RSVP

      // Send RSVP status email
      try {
        const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
        if (user) {
          if (finalStatus === 'CONFIRMED') {
            await sendRsvpConfirmedEmail(user, event);
          } else if (finalStatus === 'DECLINED') {
            await sendRsvpDeclinedEmail(user, event);
          } else if (finalStatus === 'WAITLIST') {
            await sendRsvpWaitlistedEmail(user, event);
          }
        }
      } catch (emailError) {
        logger.error('Failed to send RSVP email', { emailError, userId: data.userId, eventId: data.eventId });
      }

      logger.info('RSVP processed successfully', { userId: data.userId, eventId: data.eventId, finalStatus });
      return { success: true, message, status: finalStatus };
    } catch (error) {
      logger.error('Failed to process RSVP', { error, data });
      throw error;
    }
  }

  async checkInAttendance(data: AttendanceCheckInData): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      logger.info('Processing attendance check-in', { qrCode: data.qrCode, eventId: data.eventId });
      
      let memberCode = data.qrCode.trim();
      let memberEmail: string | undefined;
      try {
        const payload = JSON.parse(memberCode);
        if (typeof payload?.userId === 'string') memberCode = payload.userId;
        if (typeof payload?.email === 'string') memberEmail = payload.email;
      } catch {
        // Current profile codes are plain strings; legacy codes may be JSON.
      }

      // Accept current QR tokens and legacy profile QR payloads.
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { qrCode: data.qrCode },
            { id: memberCode },
            ...(memberEmail ? [{ email: memberEmail }] : []),
          ],
        },
      });

      if (!user) {
        logger.warn('User not found for QR code', { qrCode: data.qrCode });
        return { success: false, message: 'Invalid QR code' };
      }

      // Check if event exists
      const event = await this.prisma.event.findUnique({
        where: { id: data.eventId },
      });

      if (!event) {
        logger.warn('Event not found', { eventId: data.eventId });
        return { success: false, message: 'Event not found' };
      }

      // Check if user is RSVP'd, auto-RSVP if not (but respect capacity and eligibility)
      let rsvp = await this.prisma.rSVP.findUnique({
        where: {
          userId_eventId: {
            userId: user.id,
            eventId: data.eventId,
          },
        },
      });

      if (!rsvp) {
        // Check if user is eligible for auto-RSVP
        const canAutoRsvp = await this.canUserAutoRsvp(user.id, event);
        
        if (!canAutoRsvp.canRsvp) {
          logger.warn('User not eligible for auto-RSVP during check-in', { 
            userId: user.id, 
            eventId: data.eventId, 
            reason: canAutoRsvp.reason 
          });
          return { 
            success: false, 
            message: canAutoRsvp.reason || 'You are not eligible to RSVP to this event. Please RSVP manually first.' 
          };
        }

        // Auto-RSVP user - check if event has attendance cap
        let autoRsvpStatus: 'CONFIRMED' | 'WAITLIST' = 'CONFIRMED';
        
        if (event.attendanceCap) {
          const confirmedCount = await this.prisma.rSVP.count({
            where: { 
              eventId: data.eventId, 
              status: 'CONFIRMED' 
            }
          });
          
          if (confirmedCount >= event.attendanceCap) {
            // Don't allow check-in if user would be waitlisted or declined
            if (event.waitlistEnabled) {
              logger.warn('Check-in prevented - user would be waitlisted', { userId: user.id, eventId: data.eventId });
              return { 
                success: false, 
                message: 'This event is full and you would be placed on the waitlist. Please RSVP manually first to join the waitlist.' 
              };
            } else {
              logger.warn('Check-in prevented - user would be declined due to capacity', { userId: user.id, eventId: data.eventId });
              return { 
                success: false, 
                message: 'This event is full and has no waitlist. Please RSVP manually first.' 
              };
            }
          }
        }
        
        rsvp = await this.prisma.rSVP.create({
          data: {
            userId: user.id,
            eventId: data.eventId,
            status: autoRsvpStatus,
          },
        });
        logger.info('Auto-RSVP created for QR check-in', { userId: user.id, eventId: data.eventId, status: autoRsvpStatus });
      } else if (rsvp.status !== 'CONFIRMED') {
        // Check if we can confirm the existing RSVP
        if (event.attendanceCap) {
          const confirmedCount = await this.prisma.rSVP.count({
            where: { 
              eventId: data.eventId, 
              status: 'CONFIRMED' 
            }
          });
          
          if (confirmedCount >= event.attendanceCap) {
            // Don't allow check-in if user is waitlisted or declined
            if (rsvp.status === 'WAITLIST') {
              logger.warn('Check-in prevented - user is on waitlist', { userId: user.id, eventId: data.eventId });
              return { 
                success: false, 
                message: 'You are on the waitlist for this event. Please wait for confirmation before checking in.' 
              };
            } else if (rsvp.status === 'DECLINED') {
              logger.warn('Check-in prevented - user RSVP is declined', { userId: user.id, eventId: data.eventId });
              return { 
                success: false, 
                message: 'Your RSVP for this event is declined. Please RSVP again if you want to attend.' 
              };
            } else {
              logger.warn('Check-in prevented - user RSVP status prevents check-in', { userId: user.id, eventId: data.eventId, status: rsvp.status });
              return { 
                success: false, 
                message: `Your RSVP status (${rsvp.status}) prevents check-in. Please update your RSVP first.` 
              };
            }
          }
        }
        
        // Update existing RSVP to CONFIRMED
        rsvp = await this.prisma.rSVP.update({
          where: {
            userId_eventId: {
              userId: user.id,
              eventId: data.eventId,
            },
          },
          data: {
            status: 'CONFIRMED',
          },
        });
        logger.info('RSVP updated to CONFIRMED for QR check-in', { userId: user.id, eventId: data.eventId, previousStatus: rsvp.status });
      }

      // Create check-in record
      await this.prisma.checkIn.create({
        data: {
          userId: user.id,
          eventId: data.eventId,
          qrCode: data.qrCode,
          checkedInAt: new Date(),
        },
      });

      // Trigger auto-assignment if enabled and user is confirmed
      if (rsvp.status === 'CONFIRMED' && event.autoAssignEnabled && event.teamsEnabled && event.membersPerTeam) {
        try {
          await this.triggerAutoAssignment(data.eventId, event.membersPerTeam);
          logger.info('Auto-assignment triggered after check-in', { userId: user.id, eventId: data.eventId });
        } catch (error) {
          logger.warn('Auto-assignment failed after check-in', { error, eventId: data.eventId, userId: user.id });
          // Don't fail the check-in if auto-assignment fails
        }
      }

      // Enqueue background job for check-in email + series badge check
      try {
        const taskManager = new TaskManager();
        await taskManager.enqueueBadgeCheckJob({ userId: user.id, eventId: data.eventId });
      } catch (enqueueErr) {
        logger.error('Failed to enqueue badge check job', { enqueueErr, userId: user.id, eventId: data.eventId });
      }

      logger.info('Attendance check-in successful', { userId: user.id, eventId: data.eventId });
      return { success: true, message: 'Check-in successful', user };
    } catch (error) {
      logger.error('Failed to process attendance check-in', { error, data });
      throw error;
    }
  }

  async getEventAttendance(eventId: string): Promise<any[]> {
    try {
      logger.info('Fetching event attendance', { eventId });
      
      const attendance = await this.prisma.rSVP.findMany({
        where: { eventId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              qrCode: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return attendance;
    } catch (error) {
      logger.error('Failed to fetch event attendance', { error, eventId });
      throw error;
    }
  }

  /**
   * Check if a user is eligible for auto-RSVP during check-in
   * @param userId - The user ID to check
   * @param event - The event object
   * @returns Object with canRsvp boolean and reason string
   */
  async canUserAutoRsvp(userId: string, event: any): Promise<{ canRsvp: boolean; reason?: string }> {
    try {
      // For STRICT attendance type events, users must RSVP manually first
      if (event.attendanceType === 'STRICT') {
        return {
          canRsvp: false,
          reason: 'This event requires manual RSVP. Please RSVP to this event before checking in.'
        };
      }

      // For SOFT attendance type events, check capacity limits
      if (event.attendanceCap) {
        const confirmedCount = await this.prisma.rSVP.count({
          where: { 
            eventId: event.id, 
            status: 'CONFIRMED' 
          }
        });
        
        if (confirmedCount >= event.attendanceCap) {
          if (!event.waitlistEnabled) {
            return {
              canRsvp: false,
              reason: 'This event is full and has no waitlist. Please RSVP manually first.'
            };
          }
          // If waitlist is enabled, we can still auto-RSVP to waitlist
        }
      }

      // User is eligible for auto-RSVP
      return { canRsvp: true };
    } catch (error) {
      logger.error('Failed to check user auto-RSVP eligibility', { error, userId, eventId: event.id });
      return {
        canRsvp: false,
        reason: 'Unable to verify RSVP eligibility. Please RSVP manually first.'
      };
    }
  }

  async promoteFromWaitlist(eventId: string): Promise<{ promoted: number; message: string }> {
    try {
      logger.info('Promoting users from waitlist', { eventId });
      
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
          rsvps: {
            where: { status: 'CONFIRMED' }
          }
        }
      });

      if (!event || !event.attendanceCap || !event.waitlistEnabled) {
        return { promoted: 0, message: 'No waitlist promotion needed' };
      }

      const currentConfirmedCount = event.rsvps.length;
      const availableSlots = event.attendanceCap - currentConfirmedCount;

      if (availableSlots <= 0) {
        return { promoted: 0, message: 'No available slots for waitlist promotion' };
      }

      // Get waitlisted users ordered by RSVP creation time (first come, first served)
      const waitlistedUsers = await this.prisma.rSVP.findMany({
        where: {
          eventId,
          status: 'WAITLIST'
        },
        orderBy: { createdAt: 'asc' },
        take: availableSlots,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          }
        }
      });

      // Promote waitlisted users to confirmed
      const promotionPromises = waitlistedUsers.map(rsvp => 
        this.prisma.rSVP.update({
          where: { id: rsvp.id },
          data: { status: 'CONFIRMED' }
        })
      );

      await Promise.all(promotionPromises);

      // Send promotion emails
      for (const rsvp of waitlistedUsers) {
        try {
          await sendWaitlistPromotedEmail(rsvp.user, event);
        } catch (emailError) {
          logger.error('Failed to send waitlist promotion email', { emailError, userId: rsvp.userId, eventId });
        }
      }

      logger.info('Waitlist promotion completed', {
        eventId,
        promoted: waitlistedUsers.length,
        availableSlots
      });

      return { 
        promoted: waitlistedUsers.length, 
        message: `${waitlistedUsers.length} user(s) promoted from waitlist` 
      };
    } catch (error) {
      logger.error('Failed to promote from waitlist', { error, eventId });
      throw error;
    }
  }

  /**
   * Trigger auto-assignment for confirmed RSVPs who are checked in
   */
  async triggerAutoAssignment(eventId: string, membersPerTeam: number): Promise<void> {
    try {
      logger.info('Triggering auto-assignment', { eventId, membersPerTeam });
      
      // Get event with teams, RSVPs, and check-ins
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
          eventTeams: {
            include: {
              members: {
                include: { user: true }
              }
            }
          },
          rsvps: {
            include: { user: true }
          },
          checkIns: {
            include: { user: true }
          }
        }
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Get confirmed users who are also checked in
      const confirmedUsers = event.rsvps
        .filter((rsvp: any) => rsvp.status === 'CONFIRMED')
        .map((rsvp: any) => rsvp.user);

      // Get checked-in user IDs
      const checkedInUserIds = new Set(event.checkIns?.map((checkIn: any) => checkIn.userId) || []);

      // Only assign users who are both confirmed AND checked in
      const eligibleUsers = confirmedUsers.filter((user: any) => checkedInUserIds.has(user.id));

      logger.info('Auto-assignment eligibility check', {
        eventId,
        confirmedUsersCount: confirmedUsers.length,
        checkedInUsersCount: checkedInUserIds.size,
        eligibleUsersCount: eligibleUsers.length
      });

      if (eligibleUsers.length === 0) {
        logger.info('No confirmed and checked-in users to assign');
        return;
      }

      // Get existing team members
      const existingMembers = new Set();
      event.eventTeams.forEach((team: any) => {
        team.members.forEach((member: any) => {
          existingMembers.add(member.userId);
        });
      });

      // Filter out users already assigned to teams
      const unassignedUsers = eligibleUsers.filter((user: any) => !existingMembers.has(user.id));

      if (unassignedUsers.length === 0) {
        logger.info('All eligible users are already assigned to teams');
        return;
      }

      // Assign users to teams with proper team size limits
      let usersAssigned = 0;
      let currentTeamNumber = event.eventTeams.length > 0 ? Math.max(...event.eventTeams.map((t: any) => t.teamNumber)) + 1 : 1;

      for (const user of unassignedUsers) {
        // Find a team with space, respecting the membersPerTeam limit
        let targetTeam = null;
        
        // Look for existing teams with space
        for (const team of event.eventTeams) {
          if (team.members.length < membersPerTeam) {
            targetTeam = team;
            break;
          }
        }

        // If no team has space, create a new one
        if (!targetTeam) {
          targetTeam = await this.prisma.eventTeam.create({
            data: {
              eventId: eventId,
              teamNumber: currentTeamNumber++,
            },
            include: {
              members: {
                include: { user: true }
              }
            }
          });
        }

        // Double-check team size before assignment
        if (targetTeam.members.length >= membersPerTeam) {
          logger.warn(`Team ${targetTeam.teamNumber} is already at capacity (${targetTeam.members.length}/${membersPerTeam}), skipping user ${user.email}`);
          continue;
        }

        // Add user to team
        await this.prisma.eventTeamMember.create({
          data: {
            eventTeamId: targetTeam.id,
            userId: user.id,
            email: user.email,
          }
        });

        usersAssigned++;
        logger.info(`Assigned user ${user.email} to team ${targetTeam.teamNumber} (${targetTeam.members.length + 1}/${membersPerTeam})`);
      }

      logger.info('Auto-assignment completed', { eventId, usersAssigned });
    } catch (error) {
      logger.error('Failed to trigger auto-assignment', { error, eventId });
      throw error;
    }
  }
}
