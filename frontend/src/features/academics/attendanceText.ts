import type { BadgeTone } from '@/components/ui/Badge';
import { formatTarget } from './format';
import type { AttendanceMark, CourseAttendance, TargetSource } from './types';

/** Words for attendance states, shared by the Attendance and Courses pages. */

export const MARK_LABEL: Record<AttendanceMark, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  CANCELLED: 'Cancelled',
};

export const SOURCE_TEXT: Record<TargetSource, string> = {
  COURSE: 'this course',
  SEMESTER: 'semester',
  DEFAULT: 'your default',
};

/** The answer first: a status chip plus one sentence (ui-design.md §1, §2.3: icon + label, never colour alone). */
export function attendanceVerdict(a: CourseAttendance): { tone: BadgeTone; chip: string; sentence: string } {
  const target = a.target === null ? '' : formatTarget(a.target);
  switch (a.status) {
    case 'SAFE':
      return { tone: 'good', chip: 'Safe', sentence: `You can miss ${a.canMiss} more classes.` };
    case 'AT_RISK':
      return {
        tone: 'warning',
        chip: 'At risk',
        sentence: a.canMiss === 1 ? 'You can miss 1 more class.' : 'Don’t miss the next class.',
      };
    case 'BELOW':
      return {
        tone: 'critical',
        chip: 'Below target',
        sentence:
          a.needToAttend === 1
            ? `Attend the next class to get back to ${target}.`
            : `Attend the next ${a.needToAttend} classes in a row to get back to ${target}.`,
      };
    case 'NO_CLASSES':
      return {
        tone: 'neutral',
        chip: 'No classes yet',
        sentence: 'Mark your first class, or add your starting counts.',
      };
    case 'NO_TARGET':
      return {
        tone: 'neutral',
        chip: 'No target',
        sentence: 'Set a target to see how many classes you can miss.',
      };
  }
}
