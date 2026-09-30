import { z } from 'zod';
import { isValidTimeZone } from './timezones';
import type { SettingsRequest } from './types';

/** Kept in step with SettingsDtos.SettingsRequest (docs/api.md §2.1). Numbers stay strings in the form. */
export const settingsSchema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1, 'Choose your time zone.')
    .refine(isValidTimeZone, 'Choose a time zone from the list, like Asia/Kolkata.'),
  weekStart: z.enum(['MON', 'SUN']),
  universityName: z.string().trim().max(120, 'Keep it under 120 characters.'),
  defaultAttendanceTarget: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{1,2}(\.\d{1,2})?$/.test(v) && Number(v) > 0), {
      message: 'Use a number between 0 and 100, like 75.',
    }),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
});

export type SettingsValues = z.infer<typeof settingsSchema>;

export function toSettingsValues(s: SettingsRequest): SettingsValues {
  return {
    timezone: s.timezone,
    weekStart: s.weekStart,
    universityName: s.universityName ?? '',
    defaultAttendanceTarget: s.defaultAttendanceTarget === null ? '' : String(s.defaultAttendanceTarget),
    theme: s.theme,
  };
}

export function fromSettingsValues(v: SettingsValues): SettingsRequest {
  return {
    timezone: v.timezone.trim(),
    weekStart: v.weekStart,
    universityName: v.universityName.trim() || null,
    defaultAttendanceTarget: v.defaultAttendanceTarget.trim() ? Number(v.defaultAttendanceTarget) : null,
    theme: v.theme,
  };
}
