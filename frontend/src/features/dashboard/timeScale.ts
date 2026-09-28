/**
 * One linear time scale for everything drawn on the Today strip, so blocks,
 * ticks, the now line and axis labels can never disagree.
 * Times are minutes since local midnight.
 */
export interface TimeRange {
  startMin: number;
  endMin: number;
}

export function toMinutes(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`Invalid time "${hhmm}", expected HH:mm`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error(`Invalid time "${hhmm}"`);
  return h * 60 + m;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Position (0–100) of a time on the range, clamped to the visible window. */
export function percentAt(min: number, range: TimeRange): number {
  const span = range.endMin - range.startMin;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((min - range.startMin) / span) * 100));
}

/**
 * Fit the visible window to the day's items: round outward to whole hours,
 * add half an hour of breathing room, and never show less than `minHours`.
 * With no items, fall back to the default working day.
 */
export function fitRange(
  times: number[],
  { defaultRange = { startMin: 8 * 60, endMin: 18 * 60 }, minHours = 6 } = {},
): TimeRange {
  if (times.length === 0) return defaultRange;
  let start = Math.floor((Math.min(...times) - 30) / 60) * 60;
  let end = Math.ceil((Math.max(...times) + 30) / 60) * 60;
  start = Math.max(0, start);
  end = Math.min(24 * 60, end);
  const minSpan = minHours * 60;
  if (end - start < minSpan) {
    const missing = minSpan - (end - start);
    start = Math.max(0, start - Math.floor(missing / 2 / 60) * 60);
    end = Math.min(24 * 60, start + minSpan);
  }
  return { startMin: start, endMin: end };
}

/** Whole-hour tick marks inside the range, every `stepHours`. */
export function hourTicks(range: TimeRange, stepHours = 1): number[] {
  const ticks: number[] = [];
  const first = Math.ceil(range.startMin / 60) * 60;
  for (let t = first; t <= range.endMin; t += stepHours * 60) ticks.push(t);
  return ticks;
}
