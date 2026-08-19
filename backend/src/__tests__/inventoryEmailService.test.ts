import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnqueueEmailJob } = vi.hoisted(() => ({
  mockEnqueueEmailJob: vi.fn(),
}));

vi.mock('@/managers/taskManager', () => ({
  TaskManager: vi.fn(() => ({
    enqueueEmailJob: mockEnqueueEmailJob,
  })),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { sendItemCheckedInEmail, sendItemCheckedOutEmail } from '../services/inventoryEmailService';

const user = { firstName: 'Alice', email: 'alice@test.com' };
const item = { name: 'Fluke Multimeter', barcode: 'INV-0042' };
const transactionDate = new Date('2026-08-19T14:30:00Z');

describe('inventoryEmailService', () => {
  beforeEach(() => {
    mockEnqueueEmailJob.mockReset();
    mockEnqueueEmailJob.mockResolvedValue('job-123');
  });

  it('enqueues a checkout notification', async () => {
    await sendItemCheckedOutEmail(user, item, transactionDate);

    expect(mockEnqueueEmailJob).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alice@test.com',
      template: 'itemCheckedOut',
      templateData: expect.objectContaining({
        userName: 'Alice',
        itemName: 'Fluke Multimeter',
        itemBarcode: 'INV-0042',
        transactionLabel: 'Checked out',
      }),
    }));
  });

  it('enqueues a return notification with the bin name', async () => {
    await sendItemCheckedInEmail(user, item, transactionDate, 'Electronics Cabinet');

    expect(mockEnqueueEmailJob).toHaveBeenCalledWith(expect.objectContaining({
      template: 'itemCheckedIn',
      templateData: expect.objectContaining({
        transactionLabel: 'Returned',
        binName: 'Electronics Cabinet',
      }),
    }));
  });

  it('does not fail the inventory operation when queuing fails', async () => {
    mockEnqueueEmailJob.mockRejectedValueOnce(new Error('Redis down'));

    await expect(sendItemCheckedOutEmail(user, item, transactionDate)).resolves.toBeUndefined();
  });
});
