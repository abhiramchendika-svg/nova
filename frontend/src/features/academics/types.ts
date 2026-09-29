/**
 * Mirrors the academics API contracts (docs/api.md §2.2–2.4).
 * Decimal values (credits, points, GPA) arrive as JSON numbers.
 */

export type GradeKind = 'FINAL' | 'EXPECTED';

export interface GradeDefinition {
  id: string;
  label: string;
  points: number;
  passing: boolean;
  countsInGpa: boolean;
}

export interface GradingScheme {
  id: string;
  name: string;
  maxPoints: number;
  builtIn: boolean;
  grades: GradeDefinition[];
}

export interface GradeInput {
  /** Present when editing an existing grade, so courses graded with it keep their grade. */
  id?: string;
  label: string;
  points: number;
  passing: boolean;
  countsInGpa: boolean;
}

export interface SchemeRequest {
  name: string;
  maxPoints: number;
  grades: GradeInput[];
}

export interface Semester {
  id: string;
  name: string;
  ordinal: number;
  startsOn: string | null;
  endsOn: string | null;
  current: boolean;
  attendanceTarget: number | null;
  gradingScheme: { id: string; name: string; maxPoints: number };
}

export interface SemesterRequest {
  name: string;
  ordinal: number;
  startsOn: string | null;
  endsOn: string | null;
  gradingSchemeId: string;
  current: boolean;
  attendanceTarget: number | null;
}

export interface CourseGrade {
  gradeDefinitionId: string;
  label: string;
  points: number;
  passing: boolean;
  countsInGpa: boolean;
  kind: GradeKind;
}

export interface Course {
  id: string;
  semesterId: string;
  code: string | null;
  name: string;
  credits: number;
  faculty: string | null;
  colorHue: number | null;
  notes: string | null;
  attendanceTarget: number | null;
  grade: CourseGrade | null;
}

export interface CourseRequest {
  semesterId: string;
  code: string | null;
  name: string;
  credits: number;
  faculty: string | null;
  colorHue: number | null;
  notes: string | null;
  attendanceTarget: number | null;
}

export type ExclusionReason = 'GRADE_NOT_IN_GPA' | 'ZERO_CREDITS';

export interface SemesterGrades {
  id: string;
  name: string;
  ordinal: number;
  current: boolean;
  scale: number;
  gpa: number | null;
  projectedGpa: number | null;
  credits: number;
  completedCredits: number;
  hasExpectedGrades: boolean;
}

export interface GradesSummary {
  cgpa: number | null;
  projectedCgpa: number | null;
  scale: number | null;
  cgpaUnavailableReason: 'MIXED_SCALES' | null;
  totalCredits: number;
  completedCredits: number;
  semesters: SemesterGrades[];
  excluded: { courseId: string; courseName: string; semesterId: string; reason: ExclusionReason }[];
}

export interface GradeOverride {
  courseId: string;
  gradeDefinitionId: string;
}
