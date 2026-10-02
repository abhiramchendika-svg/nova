/**
 * What the palette opened recently, in this browser only (localStorage). Any storage failure
 * (private mode, quota, blocked) just means no recent items.
 */

export interface RecentItem {
  kind: 'page' | 'record' | 'task';
  /** For a record or page: its path. For a task: the task id. */
  target: string;
  title: string;
  subtitle: string | null;
}

const KEY = 'nova.palette.recent';
const MAX = 6;

export function readRecent(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (r): r is RecentItem =>
              typeof r === 'object' &&
              r !== null &&
              ['page', 'record', 'task'].includes((r as RecentItem).kind) &&
              typeof (r as RecentItem).target === 'string' &&
              typeof (r as RecentItem).title === 'string',
          )
          // Only in-app paths are ever followed
          .filter((r) => r.kind === 'task' || r.target.startsWith('/app'))
          .slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

export function remember(item: RecentItem): void {
  try {
    const rest = readRecent().filter((r) => !(r.kind === item.kind && r.target === item.target));
    window.localStorage.setItem(KEY, JSON.stringify([item, ...rest].slice(0, MAX)));
  } catch {
    // ignore: recent items are a convenience
  }
}

export function forgetAll(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
