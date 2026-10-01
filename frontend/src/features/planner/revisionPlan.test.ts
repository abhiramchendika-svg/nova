import { describe, expect, it } from 'vitest';
import { planRevision, studyTitle } from './revisionPlan';

describe('planRevision', () => {
  const topics = ['A', 'B', 'C', 'D'];

  it('spreads topics evenly from today, leaving the eve of the exam free when there is room', () => {
    // 9 days before the exam: today … +8
    expect(planRevision(topics, '2026-10-01', '2026-10-10')).toEqual([
      { topic: 'A', date: '2026-10-01' },
      { topic: 'B', date: '2026-10-03' },
      { topic: 'C', date: '2026-10-05' },
      { topic: 'D', date: '2026-10-07' },
    ]);
  });

  it('doubles up when there are more topics than days', () => {
    expect(planRevision(topics, '2026-10-01', '2026-10-03').map((p) => p.date)).toEqual([
      '2026-10-01',
      '2026-10-01',
      '2026-10-02',
      '2026-10-02',
    ]);
  });

  it('crosses month ends', () => {
    expect(planRevision(['A', 'B'], '2026-10-30', '2026-11-03').map((p) => p.date)).toEqual([
      '2026-10-30',
      '2026-11-01',
    ]);
  });

  it('plans nothing when the exam is today or past, or there are no topics', () => {
    expect(planRevision(topics, '2026-10-01', '2026-10-01')).toEqual([]);
    expect(planRevision(topics, '2026-10-02', '2026-10-01')).toEqual([]);
    expect(planRevision([], '2026-10-01', '2026-10-10')).toEqual([]);
  });

  it('names study tasks after the topic', () => {
    expect(studyTitle('Indexing')).toBe('Study: Indexing');
  });
});
