import type { Semester } from './types';

/** Which semester a page shows: the one in ?semester=, else the current one, else the latest. */
export function pickSemester(semesters: Semester[], requestedId: string | null): Semester | undefined {
  return (
    semesters.find((s) => s.id === requestedId) ??
    semesters.find((s) => s.current) ??
    [...semesters].sort((a, b) => b.ordinal - a.ordinal)[0]
  );
}
