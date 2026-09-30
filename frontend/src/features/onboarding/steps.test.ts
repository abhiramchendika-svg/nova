import { describe, expect, it } from 'vitest';
import { courseRowsSchema, filledRows, resumeStep } from './steps';

describe('onboarding steps', () => {
  it('resumes from what is saved', () => {
    expect(resumeStep(false, 0)).toBe(0);
    expect(resumeStep(true, 0)).toBe(2);
    expect(resumeStep(true, 4)).toBe(3);
  });

  it('ignores empty course rows and checks the rest', () => {
    const ok = courseRowsSchema.safeParse({
      rows: [
        { code: 'CSE 201', name: 'Database Systems', credits: '4' },
        { code: '', name: '', credits: '' },
      ],
    });
    expect(ok.success).toBe(true);
    expect(filledRows(ok.data!)).toHaveLength(1);

    const bad = courseRowsSchema.safeParse({ rows: [{ code: 'CSE 203', name: '', credits: 'four' }] });
    expect(bad.success).toBe(false);
    expect(bad.error!.issues.map((i) => i.path.join('.'))).toEqual(['rows.0.name', 'rows.0.credits']);
  });
});
