import { describe, expect, it } from 'vitest';
import { formatDay, todayIn } from './dates';

describe('dates', () => {
  it('formats a day as "Tue 30 Sep" in every locale-default environment', () => {
    expect(formatDay('2026-09-29')).toBe('Tue 29 Sep');
    expect(formatDay('2026-01-01')).toBe('Thu 1 Jan');
  });

  it('computes today in a given timezone', () => {
    const lateNightUtc = new Date('2026-09-29T20:00:00Z');
    expect(todayIn('UTC', lateNightUtc)).toBe('2026-09-29');
    expect(todayIn('Asia/Kolkata', lateNightUtc)).toBe('2026-09-30');
  });
});
