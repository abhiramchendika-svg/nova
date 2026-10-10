import { useEffect } from 'react';
import { API_BASE } from '@/services/http';

let sent = false;

/**
 * Nudges a sleeping free server awake as soon as someone opens a public page, so it's ready by the
 * time they log in or start the demo. One cheap health request per page load; its answer is ignored.
 */
export function useWakeServer(): void {
  useEffect(() => {
    if (sent) return;
    sent = true;
    void fetch(`${API_BASE}/health`, { credentials: 'omit' }).catch(() => undefined);
  }, []);
}
