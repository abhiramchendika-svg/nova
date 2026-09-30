import { useEffect, useRef } from 'react';
import { useTheme } from '@/features/theme/ThemeContext';
import { useSettings } from './api';
import { toLocalTheme } from './accountTheme';

/**
 * Keeps this browser's theme in step with the account (docs/ui-design.md §2): whenever the saved
 * theme arrives or changes (after login, or a save from another device's session), it's applied
 * here and mirrored to localStorage, so the next page load paints the right theme straight away.
 * Rendered once inside the signed-in app; logged-out pages keep the browser's own choice.
 */
export function ThemeSync() {
  const settings = useSettings();
  const { setPreference } = useTheme();
  const applied = useRef<string | null>(null);
  const saved = settings.data?.theme;

  useEffect(() => {
    if (saved && saved !== applied.current) {
      applied.current = saved;
      setPreference(toLocalTheme(saved));
    }
  }, [saved, setPreference]);

  return null;
}
