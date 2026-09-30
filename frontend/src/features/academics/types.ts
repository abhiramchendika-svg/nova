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

// ───────────── Attendance (docs/api.md §2.5) ─────────────

export type AttendanceMark = 'PRESENT' | 'ABSENT' | 'CANCELLED';
export type AttendanceStatus = 'SAFE' | 'AT_RISK' | 'BELOW' | 'NO_TARGET' | 'NO_CLASSES';
export type TargetSource = 'COURSE' | 'SEMESTER' | 'DEFAULT';

export interface CourseAttendance {
  courseId: string;
  courseCode: string | null;
  courseName: string;
  baselineConducted: number;
  baselineAttended: number;
  present: number;
  absent: number;
  cancelled: number;
  conducted: number;
  attended: number;
  percentage: number | null;
  target: number | null;
  targetSource: TargetSource | null;
  canMiss: number | null;
  needToAttend: number | null;
  status: AttendanceStatus;
}

export interface AttendanceRecord {
  id: string;
  courseId: string;
  heldOn: string;
  slot: number;
  status: AttendanceMark;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

// ───────────── Assignments (docs/api.md §2.6) ─────────────

export type AssignmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED';
export type AssignmentPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Urgency = 'OVERDUE' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'THIS_WEEK' | 'LATER';

export interface Assignment {
  id: string;
  courseId: string;
  courseCode: string | null;
  courseName: string;
  title: string;
  description: string | null;
  /** An instant (ISO, UTC). Shown in the user's timezone. */
  dueAt: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  estimatedMinutes: number | null;
  progressPct: number;
  submittedAt: string | null;
  completedAt: string | null;
  /** Null for submitted and completed work. */
  urgency: Urgency | null;
}

export interface AssignmentRequest {
  courseId: string;
  title: string;
  description: string | null;
  dueAt: string;
  priority: AssignmentPriority;
  estimatedMinutes: number | null;
}

export interface AssignmentFilter {
  status?: AssignmentStatus[];
  courseId?: string;
  priority?: AssignmentPriority;
  sort?: 'dueAt,asc' | 'dueAt,desc' | 'createdAt,desc';
  page?: number;
  size?: number;
}

// ───────────── Exams (docs/api.md §2.7) ─────────────

export type ExamKind = 'QUIZ' | 'MIDTERM' | 'FINAL' | 'LAB' | 'OTHER';

export interface Prep {
  done: number;
  total: number;
  /** Whole number; null while the checklist is empty. */
  percentage: number | null;
}

export interface ExamSummary {
  id: string;
  courseId: string;
  courseCode: string | null;
  courseName: string;
  title: string;
  kind: ExamKind;
  startsAt: string;
  durationMinutes: number | null;
  location: string | null;
  /** Calendar days in the user's timezone: 0 today, negative once past. */
  daysUntil: number;
  prep: Prep;
}

export interface ExamTopic {
  id: string;
  title: string;
  /** 0…n-1, always contiguous. */
  position: number;
  done: boolean;
  doneAt: string | null;
}

/** The exam page: the summary plus its checklist in order. */
export interface ExamDetail extends ExamSummary {
  topics: ExamTopic[];
}

export interface ExamRequest {
  courseId: string;
  title: string;
  kind: ExamKind;
  startsAt: string;
  durationMinutes: number | null;
  location: string | null;
  /** Only read on create. */
  topics?: string[];
}

// ───────────── Course links and overview (docs/api.md §2.4) ─────────────

export interface CourseResource {
  id: string;
  courseId: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface ResourceRequest {
  title: string;
  url: string;
}

export interface CourseOverview {
  course: Course;
  attendance: CourseAttendance;
  openAssignments: Assignment[];
  openAssignmentCount: number;
  overdueCount: number;
  upcomingExams: ExamSummary[];
  resources: CourseResource[];
}
