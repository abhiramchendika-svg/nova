import { z } from 'zod';
import type { CourseRequest, SchemeRequest, SemesterRequest } from './types';

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
});

export type CourseValues = z.infer<typeof courseSchema>;

/** Fields the course form doesn't edit are carried over from the existing course. */
export function toCourseRequest(
  v: CourseValues,
  semesterId: string,
  keep: Pick<CourseRequest, 'colorHue' | 'notes' | 'attendanceTarget'> = {
    colorHue: null,
    notes: null,
    attendanceTarget: null,
  },
): CourseRequest {
  return {
    semesterId,
    code: v.code.trim() || null,
    name: v.name.trim(),
    credits: Number(v.credits),
    faculty: v.faculty.trim() || null,
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
