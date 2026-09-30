import { describe, expect, it } from 'vitest';
import { daysBetween, formatDateTime, formatDay, localParts, todayIn, zonedToInstant } from './dates';

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

  it('turns a wall-clock time in the user’s timezone into an instant', () => {
    expect(zonedToInstant('2026-10-03', '23:59', 'Asia/Kolkata')).toBe('2026-10-03T18:29:00.000Z');
    expect(zonedToInstant('2026-10-03', '23:59', 'UTC')).toBe('2026-10-03T23:59:00.000Z');
    // New York is UTC−4 in summer and UTC−5 in winter
    expect(zonedToInstant('2026-07-01', '09:00', 'America/New_York')).toBe('2026-07-01T13:00:00.000Z');
    expect(zonedToInstant('2026-12-01', '09:00', 'America/New_York')).toBe('2026-12-01T14:00:00.000Z');
  });

  it('reads an instant back as the user’s date and time', () => {
    expect(localParts('2026-10-03T18:29:00Z', 'Asia/Kolkata')).toEqual({ date: '2026-10-03', time: '23:59' });
    expect(localParts('2026-10-03T18:45:00Z', 'Asia/Kolkata')).toEqual({ date: '2026-10-04', time: '00:15' });
    expect(formatDateTime('2026-10-03T18:29:00Z', 'Asia/Kolkata')).toBe('Sat 3 Oct, 23:59');
    expect(formatDateTime('2026-10-03T18:29:00Z', 'UTC')).toBe('Sat 3 Oct, 18:29');
  });

  it('counts calendar days between dates', () => {
    expect(daysBetween('2026-09-30', '2026-10-01')).toBe(1);
    expect(daysBetween('2026-10-01', '2026-09-24')).toBe(-7);
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30);
  });
});
