import { useEffect } from 'react';
import { pageLoaders } from './pages';

type PageName = keyof typeof pageLoaders;

/**
 * Downloads the code for pages the user is about to need, once the browser is idle, so the next
 * screen appears without waiting for it (e.g. the app shell and Home while someone types their
 * password). A failed prefetch is ignored: the page simply loads on demand as before.
 */
export function usePrefetchPages(...names: PageName[]): void {
  const key = names.join(',');
  useEffect(() => {
    let cancelled = false;
    let cancelScheduled = () => {};
    const run = () => {
      if (cancelled) return;
      for (const name of key.split(',') as PageName[]) void pageLoaders[name]().catch(() => undefined);
    };
    // Only after this page has finished loading, so the prefetch never competes with it
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(run, { timeout: 5000 });
        cancelScheduled = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(run, 1500);
        cancelScheduled = () => window.clearTimeout(id);
      }
    };
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', whenIdle);
      cancelScheduled();
    };
  }, [key]);
}
