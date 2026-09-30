/**
 * Time zone names for the Settings picker. Browsers list zones by their ICU canonical names, some
 * of which are old spellings (Asia/Calcutta, Europe/Kiev). Students search for the names they
 * know, so those are shown and saved as their current IANA names; the backend (java.time) and
 * Intl accept both.
 */
const CURRENT_NAME: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Rangoon': 'Asia/Yangon',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Godthab': 'America/Nuuk',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Pacific/Truk': 'Pacific/Chuuk',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Enderbury': 'Pacific/Kanton',
};

/** The current IANA name for a zone ("Asia/Calcutta" → "Asia/Kolkata"). */
export function currentZoneName(zone: string): string {
  return CURRENT_NAME[zone] ?? zone;
}

let cached: string[] | null = null;

/** Every zone this browser knows, by current name, sorted, with UTC included. */
export function allTimeZones(): string[] {
  if (cached) return cached;
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  cached = [...new Set(['UTC', ...zones.map(currentZoneName)])].sort((a, b) => a.localeCompare(b));
  return cached;
}

/** This device's zone, by current name. */
export function deviceTimeZone(): string {
  return currentZoneName(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/** Whether Intl can format in this zone (i.e. it's a real zone name). */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone.trim().length > 0;
  } catch {
    return false;
  }
}
