import { useCallback } from 'react';
import { useTheme } from '@/features/theme/ThemeContext';
import type { ThemePreference } from '@/features/theme/theme';
import { toSettingsRequest, useSettings, useUpdateSettings } from './api';
import type { Settings } from './types';

/** The API spells themes in capitals ("DARK"); the browser side uses lower case ("dark"). */
export function toLocalTheme(theme: Settings['theme']): ThemePreference {
  return theme.toLowerCase() as ThemePreference;
}

export function toServerTheme(theme: ThemePreference): Settings['theme'] {
  return theme.toUpperCase() as Settings['theme'];
}

/** Changes the theme now and saves it to the account (the top-bar menu uses this when signed in). */
export function useSaveTheme() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const { setPreference } = useTheme();
  return useCallback(
    (theme: ThemePreference) => {
      setPreference(theme);
      if (settings.data && settings.data.theme !== toServerTheme(theme)) {
        update.mutate({ ...toSettingsRequest(settings.data), theme: toServerTheme(theme) });
      }
    },
    [settings.data, setPreference, update],
  );
}
