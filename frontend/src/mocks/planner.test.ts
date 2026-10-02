import { describe, expect, it } from 'vitest';
import { nextDay, rankToday, type StoredTask } from './planner';

/** The mock must answer like Recurrence.java and TaskRanking.java (see RecurrenceTest, TaskRankingTest). */

const base: StoredTask = {
  id: 'x',
  title: 'x',
  description: null,
  category: 'PERSONAL',
  priority: 'MEDIUM',
  status: 'TODO',
  plannedFor: '2026-10-01',
  plannedStart: null,
  dueAt: null,
  estimatedMinutes: null,
  completedAt: null,
  recurrence: 'NONE',
  seriesId: null,
  courseId: null,
  examId: null,
  projectId: null,
  learningGoalId: null,
  hackathonId: null,
  internshipId: null,
  createdAt: 0,
};
const task = (title: string, changes: Partial<StoredTask> = {}): StoredTask => ({
  ...base,
  id: title,
  title,
  ...changes,
});

describe('nextDay', () => {
  it('follows the recurrence', () => {
    expect(nextDay('DAILY', '2026-10-02')).toBe('2026-10-03');
    expect(nextDay('WEEKLY', '2026-12-29')).toBe('2027-01-05');
    expect(nextDay('WEEKDAYS', '2026-09-28')).toBe('2026-09-29'); // Monday → Tuesday
    expect(nextDay('WEEKDAYS', '2026-10-02')).toBe('2026-10-05'); // Friday → Monday
    expect(nextDay('WEEKDAYS', '2026-10-03')).toBe('2026-10-05'); // Saturday → Monday
    expect(() => nextDay('NONE', '2026-10-01')).toThrow();
  });
});

describe('rankToday', () => {
  const now = new Date('2026-10-01T10:00:00Z');
  const endOfToday = Date.parse('2026-10-02T00:00:00Z');
  const ranked = (...tasks: StoredTask[]) => [...tasks].sort(rankToday(now, endOfToday)).map((t) => t.title);

  it('puts overdue, then due today, ahead of priority', () => {
    expect(
      ranked(
        task('later', { priority: 'HIGH' }),
        task('due tonight', { priority: 'LOW', dueAt: '2026-10-01T20:00:00Z' }),
        task('due tomorrow', { priority: 'LOW', dueAt: '2026-10-02T09:00:00Z' }),
        task('overdue', { priority: 'LOW', dueAt: '2026-09-30T20:00:00Z' }),
      ),
    ).toEqual(['overdue', 'due tonight', 'later', 'due tomorrow']);
  });

  it('then by start time with untimed last, then oldest first', () => {
    expect(
      ranked(
        task('untimed old', { createdAt: 1 }),
        task('evening', { plannedStart: '18:00' }),
        task('untimed new', { createdAt: 2 }),
        task('morning', { plannedStart: '07:30' }),
      ),
    ).toEqual(['morning', 'evening', 'untimed old', 'untimed new']);
  });
});
