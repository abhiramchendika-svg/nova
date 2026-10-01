import { describe, expect, it } from 'vitest';
import { classDates } from './calendar';

/** Must agree with CalendarRules.classDates (see CalendarRulesTest). */
describe('classDates', () => {
  it('finds each weekday in the range, inside the term', () => {
    expect(classDates(1, '2026-10-07', '2026-10-20', null, null)).toEqual(['2026-10-12', '2026-10-19']);
    expect(classDates(3, '2026-10-07', '2026-10-07', null, null)).toEqual(['2026-10-07']);
    expect(classDates(1, '2026-10-07', '2026-11-03', '2026-10-13', '2026-10-26')).toEqual([
      '2026-10-19',
      '2026-10-26',
    ]);
    expect(classDates(1, '2026-10-07', '2026-10-10', null, null)).toEqual([]);
  });
});
