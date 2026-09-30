import type {
  AttendanceMark,
  AttendanceStatus,
  CourseAttendance,
  TargetSource,
} from '@/features/academics/types';
import type { AcademicStore, StoredCourse } from './academics';

/**
 * Attendance for the mock API: a port of AttendanceCalculator.java in exact integer arithmetic.
 * The target (at most 2 decimals) is scaled to hundredths, so floors and ceilings are exact:
 *   canMiss      = ⌊(10000·A − T₁₀₀·C) / T₁₀₀⌋, never negative
 *   needToAttend = ⌈(T₁₀₀·C − 10000·A) / (10000 − T₁₀₀)⌉, never negative
 */

export interface StoredRecord {
  id: string;
  courseId: string;
  heldOn: string;
  slot: number;
  status: AttendanceMark;
  createdAt: number;
}

export interface AttendanceResult {
  percentage: number | null;
  canMiss: number | null;
  needToAttend: number | null;
  status: AttendanceStatus;
}

export function calculateAttendance(
  conducted: number,
  attended: number,
  target: number | null,
): AttendanceResult {
  // Percentage rounded half-up to 2 decimals: ⌊(2·10000·A + C) / 2C⌋ / 100
  const percentage =
    conducted === 0 ? null : Math.floor((20000 * attended + conducted) / (2 * conducted)) / 100;
  if (target === null) return { percentage, canMiss: null, needToAttend: null, status: 'NO_TARGET' };

  const t = Math.round(target * 100);
  const room = 10000 * attended - t * conducted;
  const canMiss = room <= 0 ? 0 : Math.floor(room / t);
  const needToAttend = room >= 0 ? 0 : Math.ceil(-room / (10000 - t));

  let status: AttendanceStatus;
  if (conducted === 0) status = 'NO_CLASSES';
  else if (room < 0) status = 'BELOW';
  else if (canMiss <= 1) status = 'AT_RISK';
  else status = 'SAFE';
  return { percentage, canMiss, needToAttend, status };
}

export function courseAttendance(
  store: AcademicStore,
  course: StoredCourse,
  defaultTarget: number | null,
): CourseAttendance {
  const records = store.records.filter((r) => r.courseId === course.id);
  const count = (s: AttendanceMark) => records.filter((r) => r.status === s).length;
  const present = count('PRESENT');
  const absent = count('ABSENT');
  const cancelled = count('CANCELLED');
  const conducted = course.baselineConducted + present + absent;
  const attended = course.baselineAttended + present;

  const semester = store.semesters.find((s) => s.id === course.semesterId);
  let target: number | null = null;
  let targetSource: TargetSource | null = null;
  if (course.attendanceTarget !== null) {
    target = course.attendanceTarget;
    targetSource = 'COURSE';
  } else if (semester?.attendanceTarget != null) {
    target = semester.attendanceTarget;
    targetSource = 'SEMESTER';
  } else if (defaultTarget !== null) {
    target = defaultTarget;
    targetSource = 'DEFAULT';
  }

  return {
    courseId: course.id,
    courseCode: course.code,
    courseName: course.name,
    baselineConducted: course.baselineConducted,
    baselineAttended: course.baselineAttended,
    present,
    absent,
    cancelled,
    conducted,
    attended,
    target,
    targetSource,
    ...calculateAttendance(conducted, attended, target),
  };
}

export { todayIn } from '@/lib/dates';
