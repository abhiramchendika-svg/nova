import type { DeadlineKind, Hackathon, HackathonMode, HackathonStatus } from '@/features/developer/types';
import { addDays, daysBetween, localParts, todayIn } from '@/lib/dates';
import type { AcademicStore } from './academics';

/** Hackathons for the mock API: ports of HackathonRules.java and HackathonService's responses. */

export interface StoredHackathon {
  id: string;
  name: string;
  organizer: string | null;
  mode: HackathonMode | null;
  location: string | null;
  websiteUrl: string | null;
  startsOn: string | null;
  endsOn: string | null;
  registrationDeadline: string | null;
  submissionDeadline: string | null;
  status: HackathonStatus;
  teamName: string | null;
  teamMembers: string | null;
  projectId: string | null;
  result: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
  certificateUrl: string | null;
  notes: string | null;
  createdAt: string;
}

/** An exam this many days before the start or after the end clashes. */
export const CLASH_MARGIN_DAYS = 2;

export const lastDay = (h: Pick<StoredHackathon, 'startsOn' | 'endsOn'>) => h.endsOn ?? h.startsOn;

export function isPast(h: StoredHackathon, today: string): boolean {
  const last = lastDay(h);
  return h.status === 'FINISHED' || h.status === 'SKIPPED' || (last !== null && last < today);
}

/** HackathonRules.relevantDeadline: registration while only interested, else submission until submitted. */
export function relevantDeadline(h: StoredHackathon): { kind: DeadlineKind; at: string } | null {
  if (h.status === 'INTERESTED' && h.registrationDeadline) {
    return { kind: 'REGISTRATION', at: h.registrationDeadline };
  }
  if (['INTERESTED', 'REGISTERED', 'PARTICIPATING'].includes(h.status) && h.submissionDeadline) {
    return { kind: 'SUBMISSION', at: h.submissionDeadline };
  }
  return null;
}

export function clashes(h: StoredHackathon, examDay: string): boolean {
  if (!h.startsOn) return false;
  return (
    examDay >= addDays(h.startsOn, -CLASH_MARGIN_DAYS) && examDay <= addDays(lastDay(h)!, CLASH_MARGIN_DAYS)
  );
}

export function toHackathon(
  store: AcademicStore,
  h: StoredHackathon,
  now: Date,
  timezone: string,
): Hackathon {
  const today = todayIn(timezone, now);
  const past = isPast(h, today);
  const deadline = past ? null : relevantDeadline(h);
  const project = h.projectId ? store.projects.find((p) => p.id === h.projectId) : undefined;
  const examClashes = past
    ? []
    : store.exams
        .map((e) => ({ e, on: localParts(e.startsAt, timezone).date }))
        .filter(({ on }) => clashes(h, on))
        .sort((a, b) => Date.parse(a.e.startsAt) - Date.parse(b.e.startsAt))
        .map(({ e, on }) => {
          const course = store.courses.find((c) => c.id === e.courseId);
          return {
            examId: e.id,
            title: e.title,
            courseCode: course ? (course.code ?? course.name) : null,
            on,
          };
        });
  return {
    ...h,
    projectName: project?.name ?? null,
    past,
    daysUntil: h.startsOn ? daysBetween(today, h.startsOn) : null,
    deadline: deadline && { ...deadline, missed: Date.parse(deadline.at) < now.getTime() },
    examClashes,
    openTasks: store.tasks.filter((t) => t.hackathonId === h.id && t.status !== 'DONE').length,
  };
}

/** HackathonRules.listOrder: upcoming by start (undated last), then past by last day (recent first). */
export function listOrder(a: Hackathon, b: Hackathon): number {
  if (a.past !== b.past) return a.past ? 1 : -1;
  const nullsLast = (x: string | null, y: string | null, dir: 1 | -1) =>
    x === y ? 0 : x === null ? 1 : y === null ? -1 : x < y ? -dir : dir;
  const byDate = a.past
    ? nullsLast(a.endsOn ?? a.startsOn, b.endsOn ?? b.startsOn, -1)
    : nullsLast(a.startsOn, b.startsOn, 1);
  return byDate || b.createdAt.localeCompare(a.createdAt);
}

/** Two clearly fictional demo hackathons, relative to today in UTC: one coming up, one done. */
export function seedDemoHackathons(store: AcademicStore, now: Date = new Date()): void {
  const today = now.toISOString().slice(0, 10);
  const base = {
    organizer: null,
    location: null,
    websiteUrl: null,
    teamName: null,
    teamMembers: null,
    projectId: null,
    result: null,
    repoUrl: null,
    demoUrl: null,
    certificateUrl: null,
    notes: null,
  };
  store.hackathons.push(
    {
      ...base,
      id: '00000000-0000-4000-8000-0000000fa001',
      name: 'Example City Civic Hack',
      organizer: 'Example Tech Club',
      mode: 'OFFLINE',
      location: 'Innovation lab',
      websiteUrl: 'https://example.com/civic-hack',
      startsOn: addDays(today, 12),
      endsOn: addDays(today, 13),
      registrationDeadline: `${addDays(today, 1)}T18:29:00.000Z`,
      submissionDeadline: `${addDays(today, 13)}T10:30:00.000Z`,
      status: 'INTERESTED',
      teamName: 'Null Pointers',
      teamMembers: 'Demo Student, A. Friend',
      projectId: '00000000-0000-4000-8000-0000000fc001',
      createdAt: new Date(now.getTime() - 3 * 86_400_000).toISOString(),
    },
    {
      ...base,
      id: '00000000-0000-4000-8000-0000000fa002',
      name: 'Example Online Buildathon',
      mode: 'ONLINE',
      startsOn: addDays(today, -60),
      endsOn: addDays(today, -58),
      registrationDeadline: null,
      submissionDeadline: null,
      status: 'FINISHED',
      result: 'Finalist (top 12)',
      repoUrl: 'https://github.com/example/buildathon-entry',
      createdAt: new Date(now.getTime() - 80 * 86_400_000).toISOString(),
    },
  );
}
