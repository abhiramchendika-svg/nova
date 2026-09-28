import { describe, expect, it } from 'vitest';
import { formatBriefDate } from './format';
import { fitRange, formatMinutes, hourTicks, percentAt, toMinutes } from './timeScale';

describe('toMinutes / formatMinutes', () => {
  it('round-trips valid times', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('9:05')).toBe(545);
    expect(toMinutes('23:59')).toBe(1439);
    expect(formatMinutes(545)).toBe('09:05');
  });
  it('rejects invalid input', () => {
    expect(() => toMinutes('24:00')).toThrow();
    expect(() => toMinutes('12:60')).toThrow();
    expect(() => toMinutes('noon')).toThrow();
  });
});

describe('percentAt', () => {
  const range = { startMin: 8 * 60, endMin: 18 * 60 };
  it('maps the range linearly', () => {
    expect(percentAt(8 * 60, range)).toBe(0);
    expect(percentAt(13 * 60, range)).toBe(50);
    expect(percentAt(18 * 60, range)).toBe(100);
  });
  it('clamps outside the window', () => {
    expect(percentAt(6 * 60, range)).toBe(0);
    expect(percentAt(20 * 60, range)).toBe(100);
  });
  it('handles an empty range without dividing by zero', () => {
    expect(percentAt(600, { startMin: 600, endMin: 600 })).toBe(0);
  });
});

describe('fitRange', () => {
  it('uses the default working day when there is nothing scheduled', () => {
    expect(fitRange([])).toEqual({ startMin: 480, endMin: 1080 });
  });
  it('pads to whole hours around the first and last item', () => {
    // 09:00 → 17:30 becomes 08:00 → 18:00
    expect(fitRange([toMinutes('09:00'), toMinutes('17:30')])).toEqual({ startMin: 480, endMin: 1080 });
  });
  it('never shows less than the minimum span', () => {
    const r = fitRange([toMinutes('10:00'), toMinutes('11:00')]);
    expect(r.endMin - r.startMin).toBeGreaterThanOrEqual(6 * 60);
    expect(r.startMin).toBeLessThanOrEqual(600);
    expect(r.endMin).toBeGreaterThanOrEqual(660);
  });
  it('stays within the day', () => {
    const r = fitRange([toMinutes('00:10'), toMinutes('23:50')]);
    expect(r).toEqual({ startMin: 0, endMin: 1440 });
  });
});

describe('hourTicks', () => {
  it('lists whole hours inside the range', () => {
    expect(hourTicks({ startMin: 480, endMin: 720 })).toEqual([480, 540, 600, 660, 720]);
    expect(hourTicks({ startMin: 480, endMin: 720 }, 2)).toEqual([480, 600, 720]);
  });
});

describe('formatBriefDate', () => {
  it('formats as WEEKDAY DAY MON in the given zone', () => {
    // 2026-09-30 00:30 IST is still 29 Sep in UTC
    const instant = new Date('2026-09-29T19:00:00Z');
    expect(formatBriefDate(instant, 'en-US', 'Asia/Kolkata')).toBe('WED 30 SEP');
    expect(formatBriefDate(instant, 'en-US', 'UTC')).toBe('TUE 29 SEP');
  });
});
