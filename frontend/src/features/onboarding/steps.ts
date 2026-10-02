import { z } from 'zod';

/** The onboarding steps, in order (architecture.md J1); Goals and GitHub were added in Phase 4 (4b, 4e). */
export const STEPS = ['You', 'Semester', 'Courses', 'Timetable', 'Goals', 'GitHub'] as const;
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Where to resume, from what's actually saved: no current semester → start at "You" (shown
 * pre-filled), no courses → "Courses", otherwise "Timetable". Nothing is ever entered twice.
 */
export function resumeStep(hasSemester: boolean, courseCount: number): StepIndex {
  if (!hasSemester) return 0;
  if (courseCount === 0) return 2;
  return 3;
}

const credits = /^\d{1,2}(\.\d)?$/;

/** Quick course rows: a fully empty row is ignored; anything typed needs a name and credits. */
export const courseRowsSchema = z.object({
  rows: z.array(
    z
      .object({
        code: z.string().trim().max(20, 'Keep it under 20 characters.'),
        name: z.string().trim().max(120, 'Keep it under 120 characters.'),
        credits: z.string().trim(),
      })
      .superRefine((row, ctx) => {
        const empty = !row.code && !row.name && !row.credits;
        if (empty) return;
        if (!row.name) ctx.addIssue({ code: 'custom', path: ['name'], message: 'Add the course name.' });
        if (!credits.test(row.credits)) {
          ctx.addIssue({ code: 'custom', path: ['credits'], message: 'Credits like 3 or 4.5.' });
        }
      }),
  ),
});

export type CourseRowsValues = z.infer<typeof courseRowsSchema>;

export const emptyRow = () => ({ code: '', name: '', credits: '' });

export function filledRows(values: CourseRowsValues) {
  return values.rows.filter((r) => r.code.trim() || r.name.trim() || r.credits.trim());
}
