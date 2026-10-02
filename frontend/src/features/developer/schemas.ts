import { z } from 'zod';
import type { ProjectRequest } from './types';

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
