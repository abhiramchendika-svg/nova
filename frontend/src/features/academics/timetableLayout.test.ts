import { describe, expect, it } from 'vitest';
import { placeDay } from './timetableLayout';
import { ordinalClass, weekOrder } from './timetableText';

const at = (id: string, startsAt: string, endsAt: string) => ({ id, startsAt, endsAt });

describe('placeDay', () => {
  it('gives separate classes the full width', () => {
    const p = placeDay([at('a', '09:00', '09:50'), at('b', '09:50', '10:40')]);
    expect(p.get('a')).toEqual({ lane: 0, lanes: 1 });
    expect(p.get('b')).toEqual({ lane: 0, lanes: 1 });
  });

  it('puts overlapping classes side by side', () => {
    const p = placeDay([
      at('lab', '14:00', '16:00'),
      at('tut', '15:00', '15:50'),
      at('late', '17:00', '18:00'),
    ]);
    expect(p.get('lab')).toEqual({ lane: 0, lanes: 2 });
    expect(p.get('tut')).toEqual({ lane: 1, lanes: 2 });
    expect(p.get('late')).toEqual({ lane: 0, lanes: 1 });
  });

  it('reuses a lane once it frees up within the same group', () => {
    // a spans the group; the shorter b goes first, ends, and c takes its lane
    const p = placeDay([at('a', '09:00', '12:00'), at('b', '09:00', '10:00'), at('c', '10:30', '11:00')]);
    expect(p.get('b')).toEqual({ lane: 0, lanes: 2 });
    expect(p.get('a')).toEqual({ lane: 1, lanes: 2 });
    expect(p.get('c')).toEqual({ lane: 0, lanes: 2 });
  });
});

describe('timetable words', () => {
  it('orders the week by the user’s first day', () => {
    expect(weekOrder('MON')).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekOrder('SUN')).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });

  it('names a course’s nth class of the day', () => {
    expect([1, 2, 3, 4, 11].map(ordinalClass)).toEqual([
      '1st class',
      '2nd class',
      '3rd class',
      '4th class',
      '11th class',
    ]);
  });
});
