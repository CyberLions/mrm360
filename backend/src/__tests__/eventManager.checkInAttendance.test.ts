import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnqueueBadgeCheckJob } = vi.hoisted(() => ({
  mockEnqueueBadgeCheckJob: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/eventEmailService', () => ({
  sendRsvpConfirmedEmail: vi.fn(),
  sendRsvpDeclinedEmail: vi.fn(),
  sendRsvpWaitlistedEmail: vi.fn(),
  sendWaitlistPromotedEmail: vi.fn(),
}));

vi.mock('@/managers/taskManager', () => ({
  TaskManager: class {
    enqueueBadgeCheckJob = mockEnqueueBadgeCheckJob;
  },
}));

import { EventManager } from '@/managers/eventManager';

const user = { id: 'user-1', email: 'member@example.com' };
const event = {
  id: 'event-1',
  attendanceCap: 1,
  waitlistEnabled: false,
  autoAssignEnabled: true,
  teamsEnabled: true,
  membersPerTeam: 4,
};

function createPrismaMock() {
  return {
    user: { findFirst: vi.fn().mockResolvedValue(user) },
    event: { findUnique: vi.fn().mockResolvedValue(event) },
    rSVP: {
      findUnique: vi.fn().mockResolvedValue({ status: 'DECLINED' }),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn(),
      update: vi.fn(),
    },
    checkIn: {
      findUnique: vi.fn().mockResolvedValue({ id: 'check-in-1' }),
      create: vi.fn(),
    },
  };
}

describe('EventManager.checkInAttendance', () => {
  beforeEach(() => {
    mockEnqueueBadgeCheckJob.mockReset();
  });

  it('returns the duplicate result before RSVP or capacity logic for an existing check-in', async () => {
    const prisma = createPrismaMock();
    const manager = new EventManager(prisma as any);

    await expect(manager.checkInAttendance({ qrCode: 'member-qr', eventId: event.id }))
      .resolves.toEqual({ success: false, message: 'User already checked in' });

    expect(prisma.checkIn.findUnique).toHaveBeenCalledWith({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
    });
    expect(prisma.rSVP.findUnique).not.toHaveBeenCalled();
    expect(prisma.rSVP.count).not.toHaveBeenCalled();
    expect(prisma.rSVP.update).not.toHaveBeenCalled();
    expect(prisma.checkIn.create).not.toHaveBeenCalled();
    expect(mockEnqueueBadgeCheckJob).not.toHaveBeenCalled();
  });

  it('treats a concurrent duplicate create as an idempotent check-in without side effects', async () => {
    const prisma = createPrismaMock();
    prisma.checkIn.findUnique.mockResolvedValue(null);
    prisma.rSVP.findUnique.mockResolvedValue({ status: 'CONFIRMED' });
    prisma.checkIn.create.mockRejectedValue({ code: 'P2002' });
    const manager = new EventManager(prisma as any);
    const triggerAutoAssignment = vi.spyOn(manager, 'triggerAutoAssignment');

    await expect(manager.checkInAttendance({ qrCode: 'member-qr', eventId: event.id }))
      .resolves.toEqual({ success: false, message: 'User already checked in' });

    expect(triggerAutoAssignment).not.toHaveBeenCalled();
    expect(mockEnqueueBadgeCheckJob).not.toHaveBeenCalled();
  });

  it('rethrows check-in creation errors other than unique-constraint violations', async () => {
    const prisma = createPrismaMock();
    const databaseError = new Error('database unavailable');
    prisma.checkIn.findUnique.mockResolvedValue(null);
    prisma.rSVP.findUnique.mockResolvedValue({ status: 'CONFIRMED' });
    prisma.checkIn.create.mockRejectedValue(databaseError);
    const manager = new EventManager(prisma as any);

    await expect(manager.checkInAttendance({ qrCode: 'member-qr', eventId: event.id }))
      .rejects.toBe(databaseError);
  });
});
