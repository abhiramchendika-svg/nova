import { describe, expect, it } from 'vitest';
import { formatMinutes } from '@/features/academics/assignmentText';
import { applyProgress, normalizeLink, prepOf, urgencyOf, type StoredAssignment } from './coursework';

// The same cases as UrgencyTest.java: 2026-09-30 23:30 in India
const LATE_EVENING_IST = new Date('2026-09-30T18:00:00Z');

describe('urgency (port of Urgency.java)', () => {
  it.each([
    ['2026-09-30T17:59:00Z', 'OVERDUE'],
    ['2026-09-30T18:00:00Z', 'DUE_TODAY'],
    ['2026-09-30T18:29:00Z', 'DUE_TODAY'],
    // 00:15 IST: 45 minutes away, but tomorrow on the student's calendar
    ['2026-09-30T18:45:00Z', 'DUE_TOMORROW'],
    ['2026-10-01T18:29:00Z', 'DUE_TOMORROW'],
    ['2026-10-01T18:30:00Z', 'THIS_WEEK'],
    ['2026-10-07T18:29:00Z', 'THIS_WEEK'], // 7 days
    ['2026-10-07T18:30:00Z', 'LATER'], // 8 days
  ])('due %s → %s', (due, expected) => {
    expect(urgencyOf(due, LATE_EVENING_IST, 'Asia/Kolkata')).toBe(expected);
  });

  it('depends on the timezone', () => {
    // 00:15 IST tomorrow is still 18:45 today in UTC
    expect(urgencyOf('2026-09-30T18:45:00Z', LATE_EVENING_IST, 'UTC')).toBe('DUE_TODAY');
  });
});

describe('progress (port of Assignment.updateProgress)', () => {
  const fresh = (): StoredAssignment => ({
    id: 'a',
    courseId: 'c',
    title: 'x',
    description: null,
    dueAt: '2026-10-01T00:00:00Z',
    priority: 'MEDIUM',
    status: 'NOT_STARTED',
    estimatedMinutes: null,
    progressPct: 0,
    submittedAt: null,
    completedAt: null,
    createdAt: 0,
  });

  it('starts work when progress is set alone', () => {
    const a = fresh();
    applyProgress(a, undefined, 40, 't1');
    expect(a).toMatchObject({ status: 'IN_PROGRESS', progressPct: 40 });
  });

  it('completing forces 100% and keeps the first completion time', () => {
    const a = fresh();
    applyProgress(a, 'COMPLETED', 30, 't1');
    applyProgress(a, 'COMPLETED', undefined, 't2');
    expect(a).toMatchObject({ status: 'COMPLETED', progressPct: 100, completedAt: 't1' });
  });

  it('reopening clears the timestamps, and not started means 0%', () => {
    const a = fresh();
    applyProgress(a, 'SUBMITTED', 80, 't1');
    expect(a.submittedAt).toBe('t1');
    applyProgress(a, 'NOT_STARTED', undefined, 't2');
    expect(a).toMatchObject({ progressPct: 0, submittedAt: null, completedAt: null });
  });
});

describe('prep and links', () => {
  it('rounds prep half-up and has no percentage for an empty checklist', () => {
    expect(prepOf(1, 8).percentage).toBe(13);
    expect(prepOf(2, 3).percentage).toBe(67);
    expect(prepOf(0, 0).percentage).toBeNull();
  });

  it('accepts only http(s) links with a host (port of WebLinks.java)', () => {
    expect(normalizeLink('  https://example.edu/a ')).toBe('https://example.edu/a');
    expect(normalizeLink('HTTP://Example.edu')).toBe('HTTP://Example.edu');
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///etc/passwd',
      'ftp://x.y',
      'https:/x.y',
      'example.edu',
      'https://exa mple.edu',
      '',
    ]) {
      expect(normalizeLink(bad)).toBeNull();
    }
  });

  it('formats estimates in hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(90)).toBe('1 h 30 min');
  });
});
