import { describe, expect, it } from 'vitest';
import { readStoredPreference, resolveTheme, THEME_STORAGE_KEY, writeStoredPreference } from './theme';

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('%s with systemDark=%s → %s', (pref, systemDark, expected) => {
    expect(resolveTheme(pref, systemDark)).toBe(expected);
  });
});

describe('readStoredPreference', () => {
  it('returns the stored value when valid', () => {
    expect(readStoredPreference({ getItem: () => 'dark' })).toBe('dark');
  });
  it('falls back to system for unknown or missing values', () => {
    expect(readStoredPreference({ getItem: () => 'purple' })).toBe('system');
    expect(readStoredPreference({ getItem: () => null })).toBe('system');
    expect(readStoredPreference(undefined)).toBe('system');
  });
  it('falls back to system when storage throws (private mode)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(readStoredPreference(throwing)).toBe('system');
  });
});

describe('writeStoredPreference', () => {
  it('writes under the shared key', () => {
    const written: Record<string, string> = {};
    writeStoredPreference({ setItem: (k, v) => void (written[k] = v) }, 'light');
    expect(written[THEME_STORAGE_KEY]).toBe('light');
  });
  it('does not throw when storage is blocked', () => {
    const throwing = {
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(() => writeStoredPreference(throwing, 'dark')).not.toThrow();
  });
});
