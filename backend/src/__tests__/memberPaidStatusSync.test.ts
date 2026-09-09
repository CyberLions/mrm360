import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('@/services/authentikServiceFactory', () => ({
  AuthentikServiceFactory: {
    createServiceFromEnv: vi.fn(() => ({}))
  }
}));

import { MemberPaidStatusService } from '@/services/memberPaidStatusService';

describe('MemberPaidStatusService.syncAllPaidStatuses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses active payments as truth and repairs database and Authentik discrepancies', async () => {
    const prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'expired', email: 'expired@example.com', authentikPk: '11', paidStatus: true, payments: [] },
          { id: 'active', email: 'active@example.com', authentikPk: '22', paidStatus: false, payments: [{ id: 'payment-1' }] }
        ]),
        update: vi.fn().mockResolvedValue({})
      }
    } as any;
    const authentik = {
      findGroupByName: vi.fn().mockResolvedValue({ id: 'member-paid' }),
      addUsersToGroup: vi.fn().mockResolvedValue(undefined),
      removeUsersFromGroup: vi.fn().mockResolvedValue(undefined)
    };
    const service = new MemberPaidStatusService(prisma);
    (service as any).authentikService = authentik;

    const result = await service.syncAllPaidStatuses();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'expired' }, data: { paidStatus: false }
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'active' }, data: { paidStatus: true }
    });
    expect(authentik.removeUsersFromGroup).toHaveBeenCalledWith('member-paid', ['11']);
    expect(authentik.addUsersToGroup).toHaveBeenCalledWith('member-paid', ['22']);
    expect(result).toEqual({ processed: 2, errors: 0 });
  });
});
