import { describe, expect, it } from 'vitest';
import { creditsWord, formatGpa, formatNumber, formatTerm } from './format';

describe('academics formatting', () => {
  it('always shows GPA with 2 decimals, or a dash when there is none', () => {
    expect(formatGpa(8.4)).toBe('8.40');
    expect(formatGpa(10)).toBe('10.00');
    expect(formatGpa(null)).toBe('—');
  });

  it('drops trailing zeros from credits and scales', () => {
    expect(formatNumber(4)).toBe('4');
    expect(formatNumber(4.5)).toBe('4.5');
    expect(formatNumber(3.7)).toBe('3.7');
  });

  it('uses the singular for one credit', () => {
    expect(creditsWord(1)).toBe('credit');
    expect(creditsWord(1.5)).toBe('credits');
  });

  it('formats a term from its dates in UTC, whatever the local timezone', () => {
    expect(formatTerm('2026-01-05', '2026-05-20')).toBe('Jan 2026 – May 2026');
    expect(formatTerm('2026-07-01', null)).toBe('From Jul 2026');
    expect(formatTerm(null, null)).toBeNull();
  });
});
