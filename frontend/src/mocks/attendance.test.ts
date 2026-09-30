import { describe, expect, it } from 'vitest';
import { calculateAttendance, todayIn } from './attendance';

/** Same hand-worked rows as AttendanceCalculatorTest.java, so the mock can't drift from the backend. */
describe('mock attendance (parity with AttendanceCalculator.java)', () => {
  it.each([
    // conducted, attended, target, canMiss, need, status
    [34, 28, 75, 3, 0, 'SAFE'],
    [30, 20, 75, 0, 10, 'BELOW'],
    [4, 3, 75, 0, 0, 'AT_RISK'],
    [10, 9, 75, 2, 0, 'SAFE'],
    [20, 16, 75, 1, 0, 'AT_RISK'],
    [10, 0, 75, 0, 30, 'BELOW'],
    [100, 74, 75, 0, 4, 'BELOW'],
    [200, 151, 75.5, 0, 0, 'AT_RISK'],
    [200, 150, 75.5, 0, 5, 'BELOW'],
    [100, 98, 99, 0, 100, 'BELOW'],
    [12000, 9001, 75, 1, 0, 'AT_RISK'],
  ] as const)('C=%i A=%i T=%s → miss %i, need %i, %s', (c, a, t, miss, need, status) => {
    const r = calculateAttendance(c, a, t);
    expect(r.canMiss).toBe(miss);
    expect(r.needToAttend).toBe(need);
    expect(r.status).toBe(status);
  });

  it('agrees with a brute-force count over a grid of inputs', () => {
    const meets = (a: number, c: number, t100: number) => 10000 * a >= t100 * c;
    for (let c = 1; c <= 40; c++) {
      for (let a = 0; a <= c; a++) {
        for (const t of [60, 75, 75.5, 66.67, 85]) {
          const t100 = Math.round(t * 100);
          let k = 0;
          while (meets(a, c + k + 1, t100)) k++;
          let n = 0;
          while (!meets(a + n, c + n, t100)) n++;
          const r = calculateAttendance(c, a, t);
          expect(r.canMiss).toBe(meets(a, c, t100) ? k : 0);
          expect(r.needToAttend).toBe(n);
        }
      }
    }
  });

  it('rounds the percentage half-up and handles no classes and no target', () => {
    expect(calculateAttendance(34, 28, 75).percentage).toBe(82.35);
    expect(calculateAttendance(3, 2, null)).toEqual({
      percentage: 66.67,
      canMiss: null,
      needToAttend: null,
      status: 'NO_TARGET',
    });
    expect(calculateAttendance(0, 0, 75)).toMatchObject({ percentage: null, status: 'NO_CLASSES' });
  });

  it('computes today in the user’s timezone', () => {
    const lateNightUtc = new Date('2026-09-29T20:00:00Z'); // 01:30 on the 30th in India
    expect(todayIn('UTC', lateNightUtc)).toBe('2026-09-29');
    expect(todayIn('Asia/Kolkata', lateNightUtc)).toBe('2026-09-30');
  });
});
