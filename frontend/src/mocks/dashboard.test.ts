import { describe, expect, it } from 'vitest';
import { deadlineReason, scorer, streak } from './dashboard';

/** Must agree with PriorityScorerTest, StreaksTest and DashboardWordingTest on the Java side. */
const HOUR = 3_600_000;

describe('mock dashboard', () => {
  it('scores like PriorityScorer', () => {
    expect(scorer.overdue('LOW', 3 * HOUR)).toBe(60);
    expect(scorer.overdue('HIGH', 50 * HOUR)).toBe(85);
    expect(scorer.overdue('MEDIUM', 30 * 24 * HOUR)).toBe(93);
    expect(scorer.dueSoon('MEDIUM', 5 * HOUR)).toBe(73);
    expect(scorer.dueSoon('LOW', 20 * HOUR)).toBe(55);
    expect(scorer.dueSoon('HIGH', 40 * HOUR)).toBe(60);
    expect(scorer.belowTarget(74.9, 75)).toBe(60);
    expect(scorer.belowTarget(72.5, 75)).toBe(70);
    expect(scorer.belowTarget(40, 75)).toBe(80);
    expect(scorer.atRisk(0)).toBe(45);
    expect(scorer.atRisk(1)).toBe(35);
    expect(scorer.examNeedsPrep(3, 25)).toBe(true);
    expect(scorer.examNeedsPrep(3, null)).toBe(false);
    expect(scorer.examNeedsPrep(8, 0)).toBe(false);
    expect(scorer.exam(3, 25)).toBe(51);
    expect(scorer.exam(0, 0)).toBe(68);
  });

  it('counts streaks like Streaks', () => {
    const days = (...ago: number[]) =>
      new Set(
        ago.map((d) =>
          new Date(Date.parse('2026-10-01T00:00:00Z') - d * 86_400_000).toISOString().slice(0, 10),
        ),
      );
    expect(streak(days(0, 1, 2, 3), '2026-10-01')).toBe(4);
    expect(streak(days(1, 2, 3), '2026-10-01')).toBe(3);
    expect(streak(days(0, 1, 3, 4), '2026-10-01')).toBeNull();
    expect(streak(days(0, 1), '2026-10-01')).toBeNull();
  });

  it('words deadlines like DashboardService', () => {
    const ist = 'Asia/Kolkata';
    expect(deadlineReason('2026-10-01T18:00:00Z', false, '2026-10-01', ist)).toBe('Due today at 23:30');
    expect(deadlineReason('2026-10-02T03:30:00Z', false, '2026-10-01', ist)).toBe('Due tomorrow at 09:00');
    expect(deadlineReason('2026-10-03T03:30:00Z', false, '2026-10-01', ist)).toBe('Due Sat 3 Oct at 09:00');
    expect(deadlineReason('2026-10-01T03:30:00Z', true, '2026-10-01', ist)).toBe('Was due today at 09:00');
    expect(deadlineReason('2026-09-30T03:30:00Z', true, '2026-10-01', ist)).toBe('Was due yesterday');
    expect(deadlineReason('2026-09-27T03:30:00Z', true, '2026-10-01', ist)).toBe('Overdue by 4 days');
  });
});
