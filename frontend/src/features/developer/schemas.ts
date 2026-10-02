import { z } from 'zod';
import { localParts, zonedToInstant } from '@/lib/dates';
import type { Hackathon, HackathonRequest, Internship, InternshipRequest, ProjectRequest } from './types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A full http(s) address with a host, as the server checks (WebLinks.java); empty means none. */
export function isWebLink(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.host) && /^https?:\/\//i.test(v);
  } catch {
    return false;
  }
}

const link = z
  .string()
  .max(2048, 'That address is too long.')
  .refine(isWebLink, 'Use a full web address starting with http:// or https://.');

/** The project form (docs/api.md §2.12). Empty strings mean "not set". */
export const projectSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the project.').max(100, 'Keep it under 100 characters.'),
    status: z.enum(['IDEA', 'PLANNING', 'DEVELOPMENT', 'COMPLETED', 'ARCHIVED']),
    description: z.string().max(4000, 'Keep the description under 4000 characters.'),
    techStack: z.array(z.string()).max(15, 'List up to 15 technologies.'),
    repoUrl: link,
    demoUrl: link,
    startedOn: z.string().refine((v) => v === '' || DATE.test(v), 'Choose a date.'),
    targetOn: z.string().refine((v) => v === '' || DATE.test(v), 'Choose a date.'),
  })
  .refine((v) => !v.startedOn || !v.targetOn || v.targetOn >= v.startedOn, {
    path: ['targetOn'],
    message: 'The target date can’t be before the start date.',
  });

export type ProjectValues = z.infer<typeof projectSchema>;

export function toProjectRequest(v: ProjectValues): ProjectRequest {
  return {
    name: v.name.trim(),
    status: v.status,
    description: v.description.trim() || null,
    techStack: v.techStack,
    repoUrl: v.repoUrl.trim() || null,
    demoUrl: v.demoUrl.trim() || null,
    startedOn: v.startedOn || null,
    targetOn: v.targetOn || null,
  };
}

export const milestoneTitle = z
  .string()
  .trim()
  .min(1, 'Name the milestone.')
  .max(160, 'Keep it under 160 characters.');

/** The learning goal form. Starter topics: one per line, only when adding a goal. */
export const goalSchema = z.object({
  title: z.string().trim().min(1, 'Name what you’re learning.').max(100, 'Keep it under 100 characters.'),
  status: z.enum(['ACTIVE', 'PAUSED', 'DONE']),
  description: z.string().max(4000, 'Keep the description under 4000 characters.'),
  targetOn: z.string().refine((v) => v === '' || DATE.test(v), 'Choose a date.'),
  topics: z
    .string()
    .refine((v) => topicLines(v).length <= 100, 'Up to 100 topics.')
    .refine((v) => topicLines(v).every((t) => t.length <= 160), 'Keep each topic under 160 characters.'),
});

export type GoalValues = z.infer<typeof goalSchema>;

/** One topic per line; blank lines are ignored. */
export function topicLines(text: string): string[] {
  return text
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
}

export const topicTitle = z
  .string()
  .trim()
  .min(1, 'Name the topic.')
  .max(160, 'Keep it under 160 characters.');

export const resourceSchema = z.object({
  title: z.string().trim().min(1, 'Give the link a title.').max(120, 'Keep it under 120 characters.'),
  url: z
    .string()
    .trim()
    .min(1, 'Paste the web address.')
    .max(2048, 'That address is too long.')
    .refine(isWebLink, 'Use a full web address starting with http:// or https://.'),
});

// ───────────── Hackathons ─────────────

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const date = z.string().refine((v) => v === '' || DATE.test(v), 'Choose a date.');
const time = z.string().refine((v) => v === '' || HHMM.test(v), 'Use a time like 23:59.');
const text = (max: number) => z.string().max(max, `Keep it under ${max} characters.`);

/**
 * The hackathon form (docs/api.md §2.12). Empty strings mean "not set". Deadlines are a date plus
 * an optional time (23:59 when left empty), read in the user's timezone, as for task deadlines.
 */
export const hackathonSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the hackathon.').max(120, 'Keep it under 120 characters.'),
    status: z.enum(['INTERESTED', 'REGISTERED', 'PARTICIPATING', 'SUBMITTED', 'FINISHED', 'SKIPPED']),
    organizer: text(120),
    mode: z.enum(['', 'ONLINE', 'OFFLINE', 'HYBRID']),
    location: text(120),
    websiteUrl: link,
    startsOn: date,
    endsOn: date,
    registrationDate: date,
    registrationTime: time,
    submissionDate: date,
    submissionTime: time,
    teamName: text(80),
    teamMembers: text(500),
    projectId: z.string(),
    result: text(160),
    repoUrl: link,
    demoUrl: link,
    certificateUrl: link,
    notes: z.string().max(4000, 'Keep notes under 4000 characters.'),
  })
  .superRefine((v, ctx) => {
    if (v.endsOn && !v.startsOn) {
      ctx.addIssue({ code: 'custom', path: ['startsOn'], message: 'Add the start date too.' });
    } else if (v.endsOn && v.endsOn < v.startsOn) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsOn'],
        message: 'The end date can’t be before the start date.',
      });
    }
    if (v.registrationTime && !v.registrationDate) {
      ctx.addIssue({ code: 'custom', path: ['registrationDate'], message: 'Choose the date too.' });
    }
    if (v.submissionTime && !v.submissionDate) {
      ctx.addIssue({ code: 'custom', path: ['submissionDate'], message: 'Choose the date too.' });
    }
    const reg = v.registrationDate && `${v.registrationDate}T${v.registrationTime || '23:59'}`;
    const sub = v.submissionDate && `${v.submissionDate}T${v.submissionTime || '23:59'}`;
    if (reg && sub && reg > sub) {
      ctx.addIssue({
        code: 'custom',
        path: ['registrationDate'],
        message: 'Registration should close before submissions do.',
      });
    }
  });

export type HackathonValues = z.infer<typeof hackathonSchema>;

export function hackathonValues(h: Hackathon | undefined, timezone: string): HackathonValues {
  const reg = h?.registrationDeadline ? localParts(h.registrationDeadline, timezone) : null;
  const sub = h?.submissionDeadline ? localParts(h.submissionDeadline, timezone) : null;
  return {
    name: h?.name ?? '',
    status: h?.status ?? 'INTERESTED',
    organizer: h?.organizer ?? '',
    mode: h?.mode ?? '',
    location: h?.location ?? '',
    websiteUrl: h?.websiteUrl ?? '',
    startsOn: h?.startsOn ?? '',
    endsOn: h?.endsOn ?? '',
    registrationDate: reg?.date ?? '',
    registrationTime: reg?.time ?? '',
    submissionDate: sub?.date ?? '',
    submissionTime: sub?.time ?? '',
    teamName: h?.teamName ?? '',
    teamMembers: h?.teamMembers ?? '',
    projectId: h?.projectId ?? '',
    result: h?.result ?? '',
    repoUrl: h?.repoUrl ?? '',
    demoUrl: h?.demoUrl ?? '',
    certificateUrl: h?.certificateUrl ?? '',
    notes: h?.notes ?? '',
  };
}

export function toHackathonRequest(v: HackathonValues, timezone: string): HackathonRequest {
  const blank = (s: string) => s.trim() || null;
  return {
    name: v.name.trim(),
    status: v.status,
    organizer: blank(v.organizer),
    mode: v.mode || null,
    location: blank(v.location),
    websiteUrl: blank(v.websiteUrl),
    startsOn: v.startsOn || null,
    endsOn: v.endsOn || null,
    registrationDeadline: v.registrationDate
      ? zonedToInstant(v.registrationDate, v.registrationTime || '23:59', timezone)
      : null,
    submissionDeadline: v.submissionDate
      ? zonedToInstant(v.submissionDate, v.submissionTime || '23:59', timezone)
      : null,
    teamName: blank(v.teamName),
    teamMembers: blank(v.teamMembers),
    projectId: v.projectId || null,
    result: blank(v.result),
    repoUrl: blank(v.repoUrl),
    demoUrl: blank(v.demoUrl),
    certificateUrl: blank(v.certificateUrl),
    notes: blank(v.notes),
  };
}

/** The same hackathon as a request, with some fields changed (status, project link). */
export function hackathonRequestOf(h: Hackathon, changes: Partial<HackathonRequest> = {}): HackathonRequest {
  return {
    name: h.name,
    status: h.status,
    organizer: h.organizer,
    mode: h.mode,
    location: h.location,
    websiteUrl: h.websiteUrl,
    startsOn: h.startsOn,
    endsOn: h.endsOn,
    registrationDeadline: h.registrationDeadline,
    submissionDeadline: h.submissionDeadline,
    teamName: h.teamName,
    teamMembers: h.teamMembers,
    projectId: h.projectId,
    result: h.result,
    repoUrl: h.repoUrl,
    demoUrl: h.demoUrl,
    certificateUrl: h.certificateUrl,
    notes: h.notes,
    ...changes,
  };
}

// ───────────── Internships ─────────────

/**
 * The application form (docs/api.md §2.12). Empty strings mean "not set". The apply-by date and the
 * next step are a date plus a time, read in the user's timezone (23:59 / 09:00 when the time is empty).
 */
export const internshipSchema = z
  .object({
    company: z.string().trim().min(1, 'Name the company.').max(120, 'Keep it under 120 characters.'),
    role: z.string().trim().min(1, 'Name the role.').max(120, 'Keep it under 120 characters.'),
    status: z.enum(['SAVED', 'APPLIED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']),
    location: text(120),
    jobUrl: link,
    source: text(60),
    appliedOn: date,
    deadlineDate: date,
    deadlineTime: time,
    nextStep: text(120),
    nextStepDate: date,
    nextStepTime: time,
    resumeVersion: text(60),
    notes: z.string().max(4000, 'Keep notes under 4000 characters.'),
  })
  .superRefine((v, ctx) => {
    if (v.deadlineTime && !v.deadlineDate) {
      ctx.addIssue({ code: 'custom', path: ['deadlineDate'], message: 'Choose the date too.' });
    }
    if (v.nextStepTime && !v.nextStepDate) {
      ctx.addIssue({ code: 'custom', path: ['nextStepDate'], message: 'Choose the date too.' });
    }
  });

export type InternshipValues = z.infer<typeof internshipSchema>;

export function internshipValues(
  i: Internship | undefined,
  timezone: string,
  initial: Partial<InternshipValues> = {},
): InternshipValues {
  const deadline = i?.deadlineAt ? localParts(i.deadlineAt, timezone) : null;
  const step = i?.nextStepAt ? localParts(i.nextStepAt, timezone) : null;
  return {
    company: i?.company ?? '',
    role: i?.role ?? '',
    status: i?.status ?? 'APPLIED',
    location: i?.location ?? '',
    jobUrl: i?.jobUrl ?? '',
    source: i?.source ?? '',
    appliedOn: i?.appliedOn ?? '',
    deadlineDate: deadline?.date ?? '',
    deadlineTime: deadline?.time ?? '',
    nextStep: i?.nextStep ?? '',
    nextStepDate: step?.date ?? '',
    nextStepTime: step?.time ?? '',
    resumeVersion: i?.resumeVersion ?? '',
    notes: i?.notes ?? '',
    ...(i ? {} : initial),
  };
}

export function toInternshipRequest(v: InternshipValues, timezone: string): InternshipRequest {
  const blank = (s: string) => s.trim() || null;
  return {
    company: v.company.trim(),
    role: v.role.trim(),
    status: v.status,
    location: blank(v.location),
    jobUrl: blank(v.jobUrl),
    source: blank(v.source),
    appliedOn: v.appliedOn || null,
    deadlineAt: v.deadlineDate ? zonedToInstant(v.deadlineDate, v.deadlineTime || '23:59', timezone) : null,
    nextStep: blank(v.nextStep),
    nextStepAt: v.nextStepDate ? zonedToInstant(v.nextStepDate, v.nextStepTime || '09:00', timezone) : null,
    resumeVersion: blank(v.resumeVersion),
    notes: blank(v.notes),
  };
}
