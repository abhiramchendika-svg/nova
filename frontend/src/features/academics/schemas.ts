import { z } from 'zod';
import { zonedToInstant } from '@/lib/dates';
import type {
  AssignmentRequest,
  CourseRequest,
  ExamRequest,
  SchemeRequest,
  SemesterRequest,
  TimetableEntryRequest,
} from './types';

/**
 * Form schemas, kept in step with the backend's Bean Validation (docs/api.md §2.2–2.4).
 * Numeric inputs stay strings in the form (that's what inputs hold) and are converted on submit.
 */

const decimal = (maxDecimals: number) => new RegExp(`^\\d{1,2}(\\.\\d{1,${maxDecimals}})?$`);
const optionalPercent = z
  .string()
  .trim()
  .refine((v) => v === '' || (/^\d{1,2}(\.\d{1,2})?$/.test(v) && Number(v) > 0), {
    message: 'Use a number between 0 and 100, like 75.',
  });

export const semesterSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the semester a name.').max(40, 'Keep it under 40 characters.'),
    ordinal: z
      .string()
      .trim()
      .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 20, 'Use a number from 1 to 20.'),
    startsOn: z.string(),
    endsOn: z.string(),
    gradingSchemeId: z.string().min(1, 'Choose a grading scheme.'),
    current: z.boolean(),
    attendanceTarget: optionalPercent,
  })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, {
    path: ['endsOn'],
    message: 'The end date can’t be before the start date.',
  });

export type SemesterValues = z.infer<typeof semesterSchema>;

export function toSemesterRequest(v: SemesterValues): SemesterRequest {
  return {
    name: v.name.trim(),
    ordinal: Number(v.ordinal),
    startsOn: v.startsOn || null,
    endsOn: v.endsOn || null,
    gradingSchemeId: v.gradingSchemeId,
    current: v.current,
    attendanceTarget: v.attendanceTarget.trim() ? Number(v.attendanceTarget) : null,
  };
}

export const courseSchema = z.object({
  code: z.string().trim().max(20, 'Keep it under 20 characters.'),
  name: z.string().trim().min(1, 'Give the course a name.').max(120, 'Keep it under 120 characters.'),
  credits: z
    .string()
    .trim()
    .min(1, 'Enter the credits.')
    .regex(decimal(1), 'Use a number like 3 or 4.5 (at most 1 decimal).'),
  faculty: z.string().trim().max(120, 'Keep it under 120 characters.'),
  attendanceTarget: optionalPercent,
});

export type CourseValues = z.infer<typeof courseSchema>;

/** Fields the course form doesn't edit are carried over from the existing course. */
export function toCourseRequest(
  v: CourseValues,
  semesterId: string,
  keep: Pick<CourseRequest, 'colorHue' | 'notes'> = { colorHue: null, notes: null },
): CourseRequest {
  return {
    semesterId,
    code: v.code.trim() || null,
    name: v.name.trim(),
    credits: Number(v.credits),
    faculty: v.faculty.trim() || null,
    attendanceTarget: v.attendanceTarget.trim() ? Number(v.attendanceTarget) : null,
    ...keep,
  };
}

export const schemeSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the scheme a name.').max(60, 'Keep it under 60 characters.'),
    maxPoints: z
      .string()
      .trim()
      .regex(decimal(2), 'Use a number like 10 or 4.')
      .refine((v) => Number(v) > 0, 'Must be more than 0.'),
    grades: z
      .array(
        z.object({
          id: z.string().optional(),
          label: z.string().trim().min(1, 'Add a label.').max(8, 'At most 8 characters.'),
          points: z.string().trim().regex(decimal(2), 'Use a number like 9 or 3.7.'),
          passing: z.boolean(),
          countsInGpa: z.boolean(),
        }),
      )
      .min(1, 'Add at least one grade.')
      .max(20, 'Use at most 20 grades.'),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.grades.forEach((g, i) => {
      const key = g.label.trim().toUpperCase();
      if (key && seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['grades', i, 'label'],
          message: 'Each grade needs a different label.',
        });
      }
      seen.add(key);
      if (Number(g.points) > Number(v.maxPoints)) {
        ctx.addIssue({ code: 'custom', path: ['grades', i, 'points'], message: 'Above the maximum.' });
      }
    });
    if (v.grades.length > 0 && !v.grades.some((g) => g.passing)) {
      ctx.addIssue({ code: 'custom', path: ['grades'], message: 'Mark at least one grade as passing.' });
    }
  });

export type SchemeValues = z.infer<typeof schemeSchema>;

export function toSchemeRequest(v: SchemeValues): SchemeRequest {
  return {
    name: v.name.trim(),
    maxPoints: Number(v.maxPoints),
    grades: v.grades.map((g) => ({
      ...(g.id ? { id: g.id } : {}),
      label: g.label.trim(),
      points: Number(g.points),
      passing: g.passing,
      countsInGpa: g.countsInGpa,
    })),
  };
}

/** Server field paths use brackets ("grades[1].label"); react-hook-form uses dots ("grades.1.label"). */
export function formFieldName(serverField: string): string {
  return serverField.replace(/\[(\d+)\]/g, '.$1');
}

// ───────────── Assignments and links (docs/api.md §2.4, §2.6) ─────────────

export const assignmentSchema = z.object({
  courseId: z.string().min(1, 'Choose a course.'),
  title: z.string().trim().min(1, 'Give the assignment a title.').max(160, 'Keep it under 160 characters.'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the due date.'),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time, like 23:59.'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  estimatedMinutes: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d{1,5}$/.test(v) && Number(v) >= 1 && Number(v) <= 10_000),
      'Use whole minutes from 1 to 10000.',
    ),
  description: z.string().max(4000, 'Keep the description under 4000 characters.'),
});

export type AssignmentValues = z.infer<typeof assignmentSchema>;

/** The due date and time are the student's wall clock, sent as one instant. */
export function toAssignmentRequest(v: AssignmentValues, timezone: string): AssignmentRequest {
  return {
    courseId: v.courseId,
    title: v.title.trim(),
    description: v.description.trim() || null,
    dueAt: zonedToInstant(v.dueDate, v.dueTime, timezone),
    priority: v.priority,
    estimatedMinutes: v.estimatedMinutes.trim() ? Number(v.estimatedMinutes) : null,
  };
}

export const resourceSchema = z.object({
  title: z.string().trim().min(1, 'Give the link a title.').max(120, 'Keep it under 120 characters.'),
  url: z
    .string()
    .trim()
    .min(1, 'Paste the link.')
    .max(2048, 'That link is too long.')
    .regex(/^https?:\/\/\S+$/i, 'Use a web link starting with http:// or https://.'),
});

export type ResourceValues = z.infer<typeof resourceSchema>;

// ───────────── Exams (docs/api.md §2.7) ─────────────

/** Non-empty lines of the "topics, one per line" box. */
export function topicLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export const examSchema = z.object({
  courseId: z.string().min(1, 'Choose a course.'),
  title: z.string().trim().min(1, 'Give the exam a title.').max(120, 'Keep it under 120 characters.'),
  kind: z.enum(['QUIZ', 'MIDTERM', 'FINAL', 'LAB', 'OTHER']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date.'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a start time, like 09:30.'),
  durationMinutes: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d{1,4}$/.test(v) && Number(v) >= 1 && Number(v) <= 1440),
      'Use whole minutes from 1 to 1440.',
    ),
  location: z.string().trim().max(60, 'Keep it under 60 characters.'),
  topics: z
    .string()
    .refine((v) => topicLines(v).length <= 100, 'Up to 100 topics.')
    .refine((v) => topicLines(v).every((t) => t.length <= 160), 'Keep each topic under 160 characters.'),
});

export type ExamValues = z.infer<typeof examSchema>;

/** The start is the student's wall clock, sent as one instant. Topics are only sent when creating. */
export function toExamRequest(v: ExamValues, timezone: string, withTopics: boolean): ExamRequest {
  return {
    courseId: v.courseId,
    title: v.title.trim(),
    kind: v.kind,
    startsAt: zonedToInstant(v.date, v.time, timezone),
    durationMinutes: v.durationMinutes.trim() ? Number(v.durationMinutes) : null,
    location: v.location.trim() || null,
    ...(withTopics ? { topics: topicLines(v.topics) } : {}),
  };
}

export const topicSchema = z
  .string()
  .trim()
  .min(1, 'Name the topic.')
  .max(160, 'Keep it under 160 characters.');

// ───────────── Timetable (docs/api.md §2.8) ─────────────

const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

export const entrySchema = z
  .object({
    courseId: z.string().min(1, 'Choose a course.'),
    dayOfWeek: z.string().regex(/^[1-7]$/, 'Choose a day.'),
    startsAt: z.string().regex(hhmm, 'Use a time like 09:00.'),
    endsAt: z.string().regex(hhmm, 'Use a time like 09:50.'),
    kind: z.enum(['LECTURE', 'LAB', 'TUTORIAL', 'OTHER']),
    location: z.string().trim().max(60, 'Keep it under 60 characters.'),
    instructor: z.string().trim().max(120, 'Keep it under 120 characters.'),
  })
  .refine((v) => !hhmm.test(v.startsAt) || !hhmm.test(v.endsAt) || v.endsAt > v.startsAt, {
    path: ['endsAt'],
    message: 'A class must end after it starts.',
  });

export type EntryValues = z.infer<typeof entrySchema>;

export function toEntryRequest(v: EntryValues): TimetableEntryRequest {
  return {
    courseId: v.courseId,
    dayOfWeek: Number(v.dayOfWeek),
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    kind: v.kind,
    location: v.location.trim() || null,
    instructor: v.instructor.trim() || null,
  };
}
