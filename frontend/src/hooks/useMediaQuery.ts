import { useSyncExternalStore } from 'react';

/** Subscribe to a CSS media query. Returns false where matchMedia is unavailable (tests, SSR). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Breakpoints from docs/ui-design.md §5 (Tailwind defaults: lg 1024, xl 1280). */
export const MEDIA = {
  xl: '(min-width: 80rem)',
  lg: '(min-width: 64rem)',
} as const;
