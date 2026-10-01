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
