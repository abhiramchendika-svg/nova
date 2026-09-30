import { describe, expect, it } from 'vitest';
import { allTimeZones, currentZoneName, isValidTimeZone } from './timezones';

describe('time zones', () => {
  it('uses current names, so "Kolkata" can be found', () => {
    expect(currentZoneName('Asia/Calcutta')).toBe('Asia/Kolkata');
    expect(currentZoneName('Europe/Kiev')).toBe('Europe/Kyiv');
    expect(currentZoneName('Europe/London')).toBe('Europe/London');
    const zones = allTimeZones();
    expect(zones).toContain('Asia/Kolkata');
    expect(zones).not.toContain('Asia/Calcutta');
    expect(zones).toContain('UTC');
    expect(zones).toEqual([...zones].sort((a, b) => a.localeCompare(b)));
  });

  it('checks that a zone is real', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
