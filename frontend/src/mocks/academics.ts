import type {
  Course,
  CourseGrade,
  ExclusionReason,
  GradeDefinition,
  GradeKind,
  GradesSummary,
  GradingScheme,
  Semester,
} from '@/features/academics/types';
import type { StoredRecord } from './attendance';
import type { StoredAssignment, StoredEntry, StoredExam, StoredResource, StoredTopic } from './coursework';
import type { StoredMilestone, StoredProject } from './developer';
import type { MockGitHubUser, StoredGitHub } from './github';
import type { StoredHackathon } from './hackathons';
import type { StoredInternship, StoredInternshipEvent } from './internships';
import type {
  StoredGoal,
  StoredResource as StoredLearningResource,
  StoredTopic as StoredLearningTopic,
} from './learning';
import type { StoredTask } from './planner';

/**
 * In-memory academics store for the mock API (tests and `npm run dev:mock`).
 * It follows the real contract in docs/api.md §2.2–2.4 closely enough for the UI to be built and
 * tested against it, including the same preset ids and the same GPA rules as GpaCalculator.java.
 */

export const PRESET_IDS = {
  tenPoint: '00000000-0000-4000-8000-000000000001',
  fourPoint: '00000000-0000-4000-8000-000000000002',
  passFail: '00000000-0000-4000-8000-000000000003',
} as const;

function grade(
  id: string,
  label: string,
  points: number,
  passing = true,
  countsInGpa = true,
): GradeDefinition {
  return { id: `00000000-0000-4000-8000-000000000${id}`, label, points, passing, countsInGpa };
}

export const PRESETS: GradingScheme[] = [
  {
    id: PRESET_IDS.tenPoint,
    name: '10-point scale',
    maxPoints: 10,
    builtIn: true,
    grades: [
      grade('101', 'O', 10),
      grade('102', 'A+', 9),
      grade('103', 'A', 8),
      grade('104', 'B+', 7),
      grade('105', 'B', 6),
      grade('106', 'C', 5),
      grade('107', 'P', 4),
      grade('108', 'F', 0, false),
    ],
  },
  {
    id: PRESET_IDS.fourPoint,
    name: '4.0 scale (US)',
    maxPoints: 4,
    builtIn: true,
    grades: [
      grade('201', 'A', 4),
      grade('202', 'A-', 3.7),
      grade('203', 'B+', 3.3),
      grade('204', 'B', 3),
      grade('205', 'B-', 2.7),
      grade('206', 'C+', 2.3),
      grade('207', 'C', 2),
      grade('208', 'C-', 1.7),
      grade('209', 'D+', 1.3),
      grade('210', 'D', 1),
      grade('211', 'F', 0, false),
    ],
  },
  {
    id: PRESET_IDS.passFail,
    name: 'Pass/Fail',
    maxPoints: 10,
    builtIn: true,
    grades: [grade('301', 'P', 0, true, false), grade('302', 'F', 0, false, false)],
  },
];

export interface StoredCourse extends Omit<Course, 'grade'> {
  gradeDefinitionId: string | null;
  gradeKind: GradeKind | null;
  baselineConducted: number;
  baselineAttended: number;
}

export interface AcademicStore {
  schemes: GradingScheme[]; // the user's own schemes (presets are shared)
  semesters: Semester[];
  courses: StoredCourse[];
  records: StoredRecord[];
  assignments: StoredAssignment[];
  exams: StoredExam[];
  topics: StoredTopic[];
  resources: StoredResource[];
  timetable: StoredEntry[];
  /** Planner tasks (they link to courses and exams, so they live with them). */
  tasks: StoredTask[];
  /** Developer projects and their milestones. */
  projects: StoredProject[];
  milestones: StoredMilestone[];
  /** Learning goals, their topics and links. */
  learningGoals: StoredGoal[];
  learningTopics: StoredLearningTopic[];
  learningResources: StoredLearningResource[];
  /** Hackathons (they link to projects and are linked from tasks). */
  hackathons: StoredHackathon[];
  /** Internship applications and their status history. */
  internships: StoredInternship[];
  internshipEvents: StoredInternshipEvent[];
  /** The GitHub username's saved data, and the GitHub users this mock knows (tests only). */
  github: StoredGitHub | null;
  githubWorld: Record<string, MockGitHubUser>;
}

export function createAcademicStore(): AcademicStore {
  return {
    schemes: [],
    semesters: [],
    courses: [],
    records: [],
    assignments: [],
    exams: [],
    topics: [],
    resources: [],
    timetable: [],
    tasks: [],
    projects: [],
    milestones: [],
    learningGoals: [],
    learningTopics: [],
    learningResources: [],
    hackathons: [],
    internships: [],
    internshipEvents: [],
    github: null,
    githubWorld: {},
  };
}

export function visibleSchemes(store: AcademicStore): GradingScheme[] {
  const own = [...store.schemes].sort((a, b) => a.name.localeCompare(b.name));
  return [...PRESETS, ...own];
}

export function findGrade(store: AcademicStore, gradeId: string | null): GradeDefinition | undefined {
  if (!gradeId) return undefined;
  for (const scheme of visibleSchemes(store)) {
    const found = scheme.grades.find((g) => g.id === gradeId);
    if (found) return found;
  }
  return undefined;
}

export function toCourse(store: AcademicStore, c: StoredCourse): Course {
  const { gradeDefinitionId, gradeKind, baselineConducted: _bc, baselineAttended: _ba, ...rest } = c;
  const definition = findGrade(store, gradeDefinitionId);
  const courseGrade: CourseGrade | null =
    definition && gradeKind
      ? {
          gradeDefinitionId: definition.id,
          label: definition.label,
          points: definition.points,
          passing: definition.passing,
          countsInGpa: definition.countsInGpa,
          kind: gradeKind,
        }
      : null;
  return { ...rest, grade: courseGrade };
}

// ───────────── GPA (a port of GpaCalculator.java) ─────────────
// Exact integer arithmetic: credits in tenths, points in hundredths. Then
// GPA × 100 = Σ(credits₁₀ × points₁₀₀) / Σ credits₁₀, rounded half-up once.

interface CalcGrade {
  points: number;
  passing: boolean;
  countsInGpa: boolean;
  kind: GradeKind;
}

class Sums {
  credits = 0;
  weighted = 0;
  add(credits: number, weighted: number) {
    this.credits += credits;
    this.weighted += weighted;
  }
  average(): number | null {
    if (this.credits <= 0) return null;
    return Math.floor((2 * this.weighted + this.credits) / (2 * this.credits)) / 100;
  }
}

function exclusion(creditsTenths: number, g: CalcGrade): ExclusionReason | null {
  if (!g.countsInGpa) return 'GRADE_NOT_IN_GPA';
  return creditsTenths === 0 ? 'ZERO_CREDITS' : null;
}

export function summarize(store: AcademicStore, overrides: Map<string, string> = new Map()): GradesSummary {
  const official = new Sums();
  const projected = new Sums();
  let totalTenths = 0;
  let completedTenths = 0;
  const countingScales = new Set<number>();
  const excluded: GradesSummary['excluded'] = [];
  const semesters = [...store.semesters].sort((a, b) => a.ordinal - b.ordinal);

  const semesterGrades = semesters.map((semester) => {
    const semOfficial = new Sums();
    const semProjected = new Sums();
    let semTenths = 0;
    let semCompletedTenths = 0;
    let hasExpected = false;
    const courses = store.courses
      .filter((c) => c.semesterId === semester.id)
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const course of courses) {
      const tenths = Math.round(course.credits * 10);
      semTenths += tenths;
      const def = findGrade(store, course.gradeDefinitionId);
      const stored: CalcGrade | null = def && course.gradeKind ? { ...def, kind: course.gradeKind } : null;
      const overrideDef = findGrade(store, overrides.get(course.id) ?? null);
      const whatIf: CalcGrade | null = overrideDef ? { ...overrideDef, kind: 'EXPECTED' } : null;
      const forProjection = whatIf ?? stored;

      let officialReason: ExclusionReason | null = null;
      if (stored && stored.kind === 'FINAL') {
        if (stored.passing) semCompletedTenths += tenths;
        officialReason = exclusion(tenths, stored);
        if (!officialReason) semOfficial.add(tenths, tenths * Math.round(stored.points * 100));
      }
      let projectedReason: ExclusionReason | null = null;
      if (forProjection) {
        if (whatIf || forProjection.kind === 'EXPECTED') hasExpected = true;
        projectedReason = exclusion(tenths, forProjection);
        if (!projectedReason) semProjected.add(tenths, tenths * Math.round(forProjection.points * 100));
      }
      const reason = projectedReason ?? officialReason;
      if (reason) {
        excluded.push({ courseId: course.id, courseName: course.name, semesterId: semester.id, reason });
      }
    }

    if (semProjected.credits > 0) countingScales.add(semester.gradingScheme.maxPoints);
    official.add(semOfficial.credits, semOfficial.weighted);
    projected.add(semProjected.credits, semProjected.weighted);
    totalTenths += semTenths;
    completedTenths += semCompletedTenths;
    return {
      id: semester.id,
      name: semester.name,
      ordinal: semester.ordinal,
      current: semester.current,
      scale: semester.gradingScheme.maxPoints,
      gpa: semOfficial.average(),
      projectedGpa: semProjected.average(),
      credits: semTenths / 10,
      completedCredits: semCompletedTenths / 10,
      hasExpectedGrades: hasExpected,
    };
  });

  const mixed = countingScales.size > 1;
  return {
    cgpa: mixed ? null : official.average(),
    projectedCgpa: mixed ? null : projected.average(),
    scale: countingScales.size === 1 ? [...countingScales][0]! : null,
    cgpaUnavailableReason: mixed ? 'MIXED_SCALES' : null,
    totalCredits: totalTenths / 10,
    completedCredits: completedTenths / 10,
    semesters: semesterGrades,
    excluded,
  };
}

// ───────────── Demo data for `npm run dev:mock` ─────────────

/** Clearly fictional data (docs/database.md §8): invented courses, no real people. */
export function seedDemoAcademics(store: AcademicStore): void {
  const ten = PRESETS[0]!;
  const s1: Semester = {
    id: '00000000-0000-4000-8000-00000000d501',
    name: 'Semester 1',
    ordinal: 1,
    startsOn: '2025-08-01',
    endsOn: '2025-12-15',
    current: false,
    attendanceTarget: null,
    gradingScheme: { id: ten.id, name: ten.name, maxPoints: ten.maxPoints },
  };
  const s2: Semester = {
    ...s1,
    id: '00000000-0000-4000-8000-00000000d502',
    name: 'Semester 2',
    ordinal: 2,
    startsOn: '2026-01-05',
    endsOn: '2026-05-20',
  };
  const s3: Semester = {
    ...s1,
    id: '00000000-0000-4000-8000-00000000d503',
    name: 'Semester 3',
    ordinal: 3,
    startsOn: '2026-07-20',
    endsOn: '2026-12-05',
    current: true,
  };
  store.semesters.push(s1, s2, s3);
  const byLabel = (label: string) => ten.grades.find((g) => g.label === label)!.id;
  let n = 0;
  const add = (
    semester: Semester,
    code: string,
    name: string,
    credits: number,
    label: string | null,
    kind: GradeKind | null,
  ) => {
    n += 1;
    store.courses.push({
      id: `00000000-0000-4000-8000-0000000dc${String(n).padStart(3, '0')}`,
      semesterId: semester.id,
      code,
      name,
      credits,
      faculty: null,
      colorHue: null,
      notes: null,
      attendanceTarget: null,
      gradeDefinitionId: label ? byLabel(label) : null,
      gradeKind: kind,
      baselineConducted: 0,
      baselineAttended: 0,
    });
  };
  add(s1, 'MAT 101', 'Calculus', 4, 'A', 'FINAL');
  add(s1, 'CSE 101', 'Programming in C', 4, 'O', 'FINAL');
  add(s1, 'PHY 101', 'Engineering Physics', 3, 'B+', 'FINAL');
  add(s2, 'MAT 102', 'Linear Algebra', 4, 'A+', 'FINAL');
  add(s2, 'CSE 102', 'Data Structures', 4, 'O', 'FINAL');
  add(s2, 'ECE 101', 'Digital Logic', 3, 'A', 'FINAL');
  add(s3, 'CSE 201', 'Database Systems', 4, 'A+', 'EXPECTED');
  add(s3, 'CSE 203', 'Operating Systems', 4, null, null);
  add(s3, 'CSE 205', 'Compilers', 3, null, null);

  // Attendance starting counts for the current semester (with a 75% default target, see browser.ts):
  // Database Systems 26/30 is safe, Compilers 16/20 is at risk, Operating Systems 22/30 is below
  const baseline = (name: string, conducted: number, attended: number) => {
    const course = store.courses.find((c) => c.name === name)!;
    course.baselineConducted = conducted;
    course.baselineAttended = attended;
  };
  baseline('Database Systems', 30, 26);
  baseline('Compilers', 20, 16);
  baseline('Operating Systems', 30, 22);
}
