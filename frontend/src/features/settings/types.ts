/** Mirrors /api/v1/settings (docs/api.md §2.1). */
export interface Settings {
  timezone: string;
  weekStart: 'MON' | 'SUN';
  universityName: string | null;
  defaultAttendanceTarget: number | null;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  onboardingCompleted: boolean;
}

export type SettingsRequest = Omit<Settings, 'onboardingCompleted'>;
