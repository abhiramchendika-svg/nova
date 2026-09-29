import { describe, expect, it } from 'vitest';
import type { GradeKind, Semester } from '@/features/academics/types';
import { createAcademicStore, PRESETS, summarize, type AcademicStore } from './academics';

/**
 * The mock's GPA must match GpaCalculator.java, or the UI would be developed against different
 * numbers than production. These are the same hand-worked cases as GpaCalculatorTest.
 */

const TEN = PRESETS[0]!;
const FOUR = PRESETS[1]!;
const gradeId = (scheme: typeof TEN, label: string) => scheme.grades.find((g) => g.label === label)!.id;

function semester(store: AcademicStore, ordinal: number, scheme = TEN): Semester {
  const s: Semester = {
    id: `s${ordinal}`,
    name: `Semester ${ordinal}`,
    ordinal,
    startsOn: null,
    endsOn: null,
    current: false,
    attendanceTarget: null,
    gradingScheme: { id: scheme.id, name: scheme.name, maxPoints: scheme.maxPoints },
  };
  store.semesters.push(s);
  return s;
}

let n = 0;
function course(
  store: AcademicStore,
  s: Semester,
  credits: number,
  label: string | null,
  kind: GradeKind = 'FINAL',
  scheme = TEN,
) {
  n += 1;
  const id = `c${n}`;
  store.courses.push({
    id,
    semesterId: s.id,
    code: null,
    name: `Course ${n}`,
    credits,
    faculty: null,
    colorHue: null,
    notes: null,
    attendanceTarget: null,
    gradeDefinitionId: label ? gradeId(scheme, label) : null,
    gradeKind: label ? kind : null,
  });
  return id;
}

describe('mock GPA (parity with GpaCalculator.java)', () => {
  it('is null, not zero, without grades', () => {
    const store = createAcademicStore();
    course(store, semester(store, 1), 4, null);
    const r = summarize(store);
    expect(r.cgpa).toBeNull();
    expect(r.totalCredits).toBe(4);
  });

  it('weights by credits: 92 / 11 = 8.36', () => {
    const store = createAcademicStore();
    const s = semester(store, 1);
    course(store, s, 4, 'O');
    course(store, s, 3, 'A');
    course(store, s, 4, 'B+');
    expect(summarize(store).cgpa).toBe(8.36);
  });

  it('computes CGPA over courses, not as a mean of semester GPAs: 6.80', () => {
    const store = createAcademicStore();
    course(store, semester(store, 1), 1, 'O');
    course(store, semester(store, 2), 4, 'B');
    expect(summarize(store).cgpa).toBe(6.8);
  });

  it('keeps expected grades out of the official CGPA: 8.00 official, 9.14 projected', () => {
    const store = createAcademicStore();
    course(store, semester(store, 1), 3, 'A');
    course(store, semester(store, 2), 4, 'O', 'EXPECTED');
    const r = summarize(store);
    expect(r.cgpa).toBe(8);
    expect(r.projectedCgpa).toBe(9.14);
    expect(r.completedCredits).toBe(3);
  });

  it('rounds half-up exactly once', () => {
    // 1 × 8.00 + 1 × 8.25 = 8.125 → 8.13 (floating point alone could give 8.12)
    const store = createAcademicStore();
    const custom = {
      ...TEN,
      id: 'x',
      grades: [{ id: 'g1', label: 'X', points: 8.25, passing: true, countsInGpa: true }],
    };
    store.schemes.push({ ...custom, builtIn: false });
    const s = semester(store, 1);
    course(store, s, 1, 'A');
    store.courses.push({ ...store.courses[0]!, id: 'cx', gradeDefinitionId: 'g1' });
    expect(summarize(store).cgpa).toBe(8.13);
  });

  it('applies what-if grades to the projection only', () => {
    const store = createAcademicStore();
    const s = semester(store, 1);
    const dbms = course(store, s, 4, 'B');
    const os = course(store, s, 4, null);
    const r = summarize(
      store,
      new Map([
        [dbms, gradeId(TEN, 'O')],
        [os, gradeId(TEN, 'A')],
      ]),
    );
    expect(r.cgpa).toBe(6);
    expect(r.projectedCgpa).toBe(9);
  });

  it('refuses to average different scales', () => {
    const store = createAcademicStore();
    course(store, semester(store, 1), 4, 'O');
    course(store, semester(store, 2, FOUR), 3, 'A', 'FINAL', FOUR);
    const r = summarize(store);
    expect(r.cgpa).toBeNull();
    expect(r.cgpaUnavailableReason).toBe('MIXED_SCALES');
    expect(r.semesters.map((x) => x.gpa)).toEqual([10, 4]);
  });
});
