import { describe, expect, it } from 'vitest';
import { inferSemester, isValidSemester } from '@/utils/semester';
import { PaymentType } from '@prisma/client';
import { PaymentService } from '@/services/paymentService';

describe('semester inference', () => {
  it.each([
    ['2026-01-15T12:00:00Z', 'SPRING_2026', '2026-06-01T00:00:00.000Z'],
    ['2026-05-31T23:59:59Z', 'SPRING_2026', '2026-06-01T00:00:00.000Z'],
    ['2026-08-01T00:00:00Z', 'FALL_2026', '2027-01-01T00:00:00.000Z'],
    ['2026-12-31T23:59:59Z', 'FALL_2026', '2027-01-01T00:00:00.000Z'],
  ])('assigns %s to %s', (date, semester, endsAt) => {
    const result = inferSemester(new Date(date));
    expect(result.semester).toBe(semester);
    expect(result.endsAt.toISOString()).toBe(endsAt);
  });

  it('assigns the summer gap to the upcoming fall term', () => {
    expect(inferSemester(new Date('2026-07-01T00:00:00Z')).semester).toBe('FALL_2026');
  });

  it('validates persisted semester identifiers', () => {
    expect(isValidSemester('SPRING_2026')).toBe(true);
    expect(isValidSemester('Fall 2026')).toBe(false);
  });
});

describe('payment semester expiration', () => {
  it('expires a fall yearly payment at the start of the following August', () => {
    const service = new PaymentService({} as any);
    const expiresAt = (service as any).calculateExpirationDate(PaymentType.YEARLY, 'FALL_2025');
    expect(expiresAt.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
});
