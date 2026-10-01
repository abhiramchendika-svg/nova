import { z } from 'zod';
import { zonedToInstant } from '@/lib/dates';
import type { TaskRequest } from './types';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const taskTitle = z
  .string()
  .trim()
  .min(1, 'Give the task a title.')
  .max(160, 'Keep it under 160 characters.');

/**
 * The task form (docs/api.md §2.9). Empty strings mean "not set". The deadline is a date plus an
 * optional time (23:59 when left empty), read in the user's timezone.
 */
export const taskSchema = z
  .object({
    title: taskTitle,
    description: z.string().max(4000, 'Keep notes under 4000 characters.'),
    category: z.enum(['', 'ACADEMIC', 'CODING', 'PERSONAL', 'INTERNSHIP', 'OPEN_SOURCE', 'PROJECT']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    plannedFor: z.string().refine((v) => v === '' || DATE.test(v), 'Choose a day.'),
    plannedStart: z.string().refine((v) => v === '' || HHMM.test(v), 'Use a time like 18:30.'),
    dueDate: z.string().refine((v) => v === '' || DATE.test(v), 'Choose a date.'),
    dueTime: z.string().refine((v) => v === '' || HHMM.test(v), 'Use a time like 23:59.'),
    estimatedMinutes: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || (/^\d{1,4}$/.test(v) && Number(v) >= 1 && Number(v) <= 1440),
        'Use whole minutes from 1 to 1440.',
      ),
    recurrence: z.enum(['NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY']),
    courseId: z.string(),
    examId: z.string(),
    projectId: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.plannedStart && !v.plannedFor) {
      ctx.addIssue({ code: 'custom', path: ['plannedStart'], message: 'Pick a day before a start time.' });
    }
    if (v.recurrence !== 'NONE' && !v.plannedFor) {
      ctx.addIssue({
        code: 'custom',
        path: ['plannedFor'],
        message: 'A repeating task needs a day to start from.',
      });
    }
    if (v.dueTime && !v.dueDate) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Choose the date it’s due.' });
    }
  });

export type TaskValues = z.infer<typeof taskSchema>;

export function toTaskRequest(v: TaskValues, timezone: string): TaskRequest {
  return {
    title: v.title.trim(),
    description: v.description.trim() || null,
    category: v.category || null,
    priority: v.priority,
    plannedFor: v.plannedFor || null,
    plannedStart: v.plannedFor && v.plannedStart ? v.plannedStart : null,
    dueAt: v.dueDate ? zonedToInstant(v.dueDate, v.dueTime || '23:59', timezone) : null,
    estimatedMinutes: v.estimatedMinutes.trim() ? Number(v.estimatedMinutes) : null,
    recurrence: v.recurrence,
    courseId: v.courseId || null,
    examId: v.examId || null,
    projectId: v.projectId || null,
  };
}
