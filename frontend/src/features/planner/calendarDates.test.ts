import { describe, expect, it } from 'vitest';
import { isoWeekday, monthRange, rangeLabel, shift, startOfWeek, weekRange } from './calendarDates';

describe('calendar dates', () => {
  it('finds the start of the week for either first day', () => {
    expect(isoWeekday('2026-10-04')).toBe(7); // Sunday
    expect(startOfWeek('2026-10-01', 'MON')).toBe('2026-09-28');
    expect(startOfWeek('2026-10-04', 'MON')).toBe('2026-09-28');
    expect(startOfWeek('2026-10-04', 'SUN')).toBe('2026-10-04');
    expect(startOfWeek('2026-10-03', 'SUN')).toBe('2026-09-27');
  });

  it('builds a week of seven days', () => {
    const week = weekRange('2026-10-01', 'MON');
    expect(week.from).toBe('2026-09-28');
    expect(week.to).toBe('2026-10-04');
    expect(week.days).toHaveLength(7);
  });

  it('covers a month in whole weeks', () => {
    const october = monthRange('2026-10-15', 'MON');
    expect(october.from).toBe('2026-09-28');
    expect(october.to).toBe('2026-11-01');
    expect(october.days).toHaveLength(35);
    // A month needing six rows, still within the API's 62 days
    const august = monthRange('2026-08-01', 'MON');
    expect(august.days).toHaveLength(42);
    expect(monthRange('2026-10-15', 'SUN').from).toBe('2026-09-27');
  });

  it('moves by a week, or to the first of the next or previous month', () => {
    expect(shift('week', '2026-10-01', 1)).toBe('2026-10-08');
    expect(shift('week', '2026-10-01', -1)).toBe('2026-09-24');
    expect(shift('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(shift('month', '2026-01-15', -1)).toBe('2025-12-01');
  });

  it('labels ranges compactly', () => {
    expect(rangeLabel('2026-09-28', '2026-10-04')).toBe('28 Sep – 4 Oct 2026');
    expect(rangeLabel('2026-10-05', '2026-10-11')).toBe('5 – 11 Oct 2026');
    expect(rangeLabel('2026-12-28', '2027-01-03')).toBe('28 Dec 2026 – 3 Jan 2027');
  });
});
