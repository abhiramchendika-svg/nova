import type { ExclusionReason } from './types';

/** GPA always shows 2 decimals (ui-design.md §9); "—" when there's nothing to average yet. */
export function formatGpa(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toFixed(2);
}

/** Credits and scales without trailing zeros: 4 → "4", 4.5 → "4.5", 10.00 → "10". */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function creditsWord(value: number): string {
  return value === 1 ? 'credit' : 'credits';
}

export const EXCLUSION_TEXT: Record<ExclusionReason, string> = {
  GRADE_NOT_IN_GPA: 'Its grade doesn’t count towards GPA',
  ZERO_CREDITS: 'It has 0 credits',
};

/** "Jan 2026 – May 2026", or null when no dates are set. */
export function formatTerm(startsOn: string | null, endsOn: string | null): string | null {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  if (startsOn && endsOn) return `${fmt(startsOn)} – ${fmt(endsOn)}`;
  if (startsOn) return `From ${fmt(startsOn)}`;
  if (endsOn) return `Until ${fmt(endsOn)}`;
  return null;
}

/** Attendance percentage: 1 decimal in detail views, whole numbers in summaries (ui-design.md §9). */
export function formatPercent(value: number | null, decimals: 0 | 1 = 1): string {
  return value === null ? '—' : `${value.toFixed(decimals)}%`;
}

/** A target exactly as set: 75 → "75%", 75.5 → "75.5%" (never rounded to a different rule). */
export function formatTarget(value: number): string {
  return `${formatNumber(value)}%`;
}
