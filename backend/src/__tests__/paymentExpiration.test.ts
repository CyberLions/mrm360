import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentStatus } from '@prisma/client';

const paidStatusMocks = vi.hoisted(() => ({
  updateMemberPaidStatus: vi.fn()
}));

vi.mock('@/services/memberPaidStatusService', () => ({
  MemberPaidStatusService: vi.fn().mockImplementation(() => paidStatusMocks)
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { PaymentService } from '@/services/paymentService';

describe('PaymentService.checkExpiredPayments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('revokes Authentik access even when the cached paid flag is already false', async () => {
    const expiredAt = new Date('2026-01-01T00:00:00Z');
    const prisma = {
      payment: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{
            userId: 'user-1',
            expiresAt: expiredAt,
            status: PaymentStatus.COMPLETED,
            user: { id: 'user-1', email: 'member@example.com', paidStatus: false }
          }])
          .mockResolvedValueOnce([{
            userId: 'user-1',
            expiresAt: expiredAt,
            status: PaymentStatus.COMPLETED
          }])
      }
    } as any;

    const results = await new PaymentService(prisma).checkExpiredPayments();

    expect(paidStatusMocks.updateMemberPaidStatus).toHaveBeenCalledWith('user-1', false);
    expect(results[0]).toMatchObject({ userId: 'user-1', newPaidStatus: false });
  });
});
