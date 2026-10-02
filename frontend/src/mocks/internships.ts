import type { Internship, InternshipAnalytics, InternshipStatus } from '@/features/developer/types';
import { addDays } from '@/lib/dates';
import type { AcademicStore } from './academics';

/** Internship applications for the mock API: ports of InternshipRules.java and InternshipService. */

export interface StoredInternship {
  id: string;
  company: string;
  role: string;
  location: string | null;
  jobUrl: string | null;
  source: string | null;
  status: InternshipStatus;
  appliedOn: string | null;
  deadlineAt: string | null;
  nextStep: string | null;
  nextStepAt: string | null;
  resumeVersion: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredInternshipEvent {
  applicationId: string;
  fromStatus: InternshipStatus | null;
  toStatus: InternshipStatus;
  changedAt: string;
}

export const isClosed = (s: InternshipStatus) => s === 'REJECTED' || s === 'WITHDRAWN';
export const deadlineMatters = (s: InternshipStatus) => s === 'SAVED';
export const stepMatters = (s: InternshipStatus) => !isClosed(s);

export function toInternship(store: AcademicStore, i: StoredInternship, now: Date): Internship {
  return {
    ...i,
    deadlineMissed:
      deadlineMatters(i.status) && i.deadlineAt !== null && Date.parse(i.deadlineAt) < now.getTime(),
    openTasks: store.tasks.filter((t) => t.internshipId === i.id && t.status !== 'DONE').length,
    history: store.internshipEvents
      .filter((e) => e.applicationId === i.id)
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
      .map(({ fromStatus, toStatus, changedAt }) => ({ fromStatus, toStatus, changedAt })),
  };
}

/** InternshipService's order: most recently applied first, saved (undated) after, then newest. */
export function listOrder(a: StoredInternship, b: StoredInternship): number {
  if (a.appliedOn !== b.appliedOn) {
    if (a.appliedOn === null) return 1;
    if (b.appliedOn === null) return -1;
    return a.appliedOn < b.appliedOn ? 1 : -1;
  }
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

const RESPONSES: InternshipStatus[] = ['ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED'];

/** InternshipRules.month and funnel: stages ever reached (history plus current status). */
export function analytics(store: AcademicStore, month: string): InternshipAnalytics {
  const entries = store.internships.map((i) => {
    const reached = new Set<InternshipStatus>([i.status]);
    for (const e of store.internshipEvents) if (e.applicationId === i.id) reached.add(e.toStatus);
    const sent = i.appliedOn !== null && [...reached].some((s) => s !== 'SAVED');
    return { i, reached, sent, responded: [...reached].some((s) => RESPONSES.includes(s)) };
  });
  const count = (list: typeof entries, stage: InternshipStatus) =>
    list.filter((e) => e.reached.has(stage)).length;
  const cohort = entries.filter((e) => e.sent && e.i.appliedOn!.slice(0, 7) === month);
  const responded = cohort.filter((e) => e.responded).length;
  return {
    month,
    applied: cohort.length,
    assessments: count(cohort, 'ASSESSMENT'),
    interviews: count(cohort, 'INTERVIEW'),
    offers: count(cohort, 'OFFER'),
    rejected: count(cohort, 'REJECTED'),
    responseRate: {
      // BigDecimal HALF_UP to one decimal
      value: cohort.length === 0 ? null : Math.round((responded * 1000) / cohort.length) / 10,
      formula: 'responded / applied',
      responded,
      applied: cohort.length,
    },
    allTime: {
      saved: entries.filter((e) => e.i.status === 'SAVED').length,
      applied: entries.filter((e) => e.sent).length,
      assessment: count(entries, 'ASSESSMENT'),
      interview: count(entries, 'INTERVIEW'),
      offer: count(entries, 'OFFER'),
      rejected: entries.filter((e) => e.i.status === 'REJECTED').length,
      withdrawn: entries.filter((e) => e.i.status === 'WITHDRAWN').length,
    },
  };
}

/** Three clearly fictional demo applications, relative to today in UTC. */
export function seedDemoInternships(store: AcademicStore, now: Date = new Date()): void {
  const today = now.toISOString().slice(0, 10);
  const at = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const base = {
    location: null,
    jobUrl: null,
    source: null,
    deadlineAt: null,
    nextStep: null,
    nextStepAt: null,
    resumeVersion: null,
    notes: null,
  };
  store.internships.push(
    {
      ...base,
      id: '00000000-0000-4000-8000-0000000fb101',
      company: 'Example Systems',
      role: 'Backend intern',
      location: 'Bengaluru · hybrid',
      jobUrl: 'https://example.com/careers/backend-intern',
      source: 'Campus',
      status: 'INTERVIEW',
      appliedOn: addDays(today, -12),
      nextStep: 'Technical interview',
      nextStepAt: `${addDays(today, 2)}T09:30:00.000Z`,
      resumeVersion: 'v3-backend',
      createdAt: at(12),
      updatedAt: at(2),
    },
    {
      ...base,
      id: '00000000-0000-4000-8000-0000000fb102',
      company: 'Sample Labs',
      role: 'ML intern',
      source: 'LinkedIn',
      status: 'APPLIED',
      appliedOn: addDays(today, -4),
      createdAt: at(4),
      updatedAt: at(4),
    },
    {
      ...base,
      id: '00000000-0000-4000-8000-0000000fb103',
      company: 'Placeholder Corp',
      role: 'Frontend intern',
      status: 'SAVED',
      appliedOn: null,
      deadlineAt: `${addDays(today, 5)}T18:29:00.000Z`,
      createdAt: at(1),
      updatedAt: at(1),
    },
  );
  store.internshipEvents.push(
    {
      applicationId: '00000000-0000-4000-8000-0000000fb101',
      fromStatus: null,
      toStatus: 'APPLIED',
      changedAt: at(12),
    },
    {
      applicationId: '00000000-0000-4000-8000-0000000fb101',
      fromStatus: 'APPLIED',
      toStatus: 'ASSESSMENT',
      changedAt: at(8),
    },
    {
      applicationId: '00000000-0000-4000-8000-0000000fb101',
      fromStatus: 'ASSESSMENT',
      toStatus: 'INTERVIEW',
      changedAt: at(2),
    },
    {
      applicationId: '00000000-0000-4000-8000-0000000fb102',
      fromStatus: null,
      toStatus: 'APPLIED',
      changedAt: at(4),
    },
    {
      applicationId: '00000000-0000-4000-8000-0000000fb103',
      fromStatus: null,
      toStatus: 'SAVED',
      changedAt: at(1),
    },
  );
}
