import type { GitHubOverview, GitHubRepo, NovaMetric } from '@/features/developer/types';
import { addDays } from '@/lib/dates';

/**
 * GitHub for the mock API: a port of GitHubService's responses and GitHubMetrics.java. The mock
 * never invents GitHub data: a username works only if a test put it in the store's
 * {@code githubWorld}; the browser demo has none, so it stays "not connected".
 */

export interface MockGitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  htmlUrl: string;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
  repos: GitHubRepo[];
  /** Null: as if the server had no token for the calendar. */
  calendar: { total: number; days: { date: string; count: number }[] } | null;
}

export interface StoredGitHub {
  user: MockGitHubUser;
  fetchedAt: string;
  refreshRequestedAt: string | null;
}

export const NO_TOKEN = 'The contribution calendar needs a GitHub token on the server (GITHUB_SERVER_TOKEN).';
export const LANGUAGE_FORMULA =
  'repositories with this primary language ÷ your own (non-fork) repositories with a primary language';

const metric = (value: number | null, formula: string): NovaMetric => ({ value, formula });
const round1 = (n: number) => Math.round(n * 10) / 10;

/** GitHubMetrics.contributions. */
export function contributionMetrics(days: { date: string; count: number }[], today: string) {
  const byDay = new Map<string, number>();
  for (const d of days) byDay.set(d.date, (byDay.get(d.date) ?? 0) + d.count);
  const sum = (from: string, to: string) =>
    [...byDay].filter(([d]) => d >= from && d <= to).reduce((n, [, c]) => n + c, 0);
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = addDays(monthStart, -1);
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`;
  const thisMonth = sum(monthStart, today);
  const lastMonth = sum(lastMonthStart, lastMonthEnd);
  const active = (d: string) => (byDay.get(d) ?? 0) > 0;
  let day = active(today) ? today : addDays(today, -1);
  let current = 0;
  while (active(day)) {
    current += 1;
    day = addDays(day, -1);
  }
  let longest = 0;
  for (const d of byDay.keys()) {
    if (!active(d) || active(addDays(d, -1))) continue;
    let n = 0;
    for (let x = d; active(x); x = addDays(x, 1)) n += 1;
    longest = Math.max(longest, n);
  }
  let weeks = 0;
  for (let w = 0; w < 12; w++) {
    const end = addDays(today, -7 * w);
    if (sum(addDays(end, -6), end) > 0) weeks += 1;
  }
  return {
    thisMonth: metric(thisMonth, 'contributions from the 1st of this month to today'),
    lastMonth: metric(lastMonth, 'contributions in all of last month'),
    change: metric(
      lastMonth === 0 ? null : round1(((thisMonth - lastMonth) * 100) / lastMonth),
      '(this month so far − last month) ÷ last month × 100; none when last month is 0',
    ),
    currentStreak: metric(
      current,
      'days in a row with at least one contribution, ending today (or yesterday if none yet today)',
    ),
    longestStreak: metric(longest, 'most days in a row with at least one contribution in the calendar'),
    activeWeeks: metric(weeks, 'of the last 12 seven-day weeks ending today, those with a contribution'),
  };
}

/** GitHubMetrics.languages. */
export function languageShares(repos: GitHubRepo[]) {
  const langs = repos.filter((r) => !r.fork && r.language).map((r) => r.language!);
  const counts = new Map<string, number>();
  for (const l of langs) counts.set(l, (counts.get(l) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([language, n]) => ({ language, repos: n, share: round1((n * 100) / langs.length) }));
}

export function toOverview(
  g: StoredGitHub | null,
  today: string,
  stale = false,
  retryAt: string | null = null,
): GitHubOverview {
  if (!g) {
    return {
      connected: false,
      source: 'GITHUB_API',
      username: null,
      fetchedAt: null,
      stale: false,
      retryAt: null,
      profile: null,
      repos: null,
      languages: null,
      contributions: null,
      novaMetrics: null,
    };
  }
  const u = g.user;
  const repos = [...u.repos].sort(
    (a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '') || a.name.localeCompare(b.name),
  );
  return {
    connected: true,
    source: 'GITHUB_API',
    username: u.login,
    fetchedAt: g.fetchedAt,
    stale,
    retryAt,
    profile: {
      login: u.login,
      name: u.name,
      avatarUrl: u.avatarUrl,
      htmlUrl: u.htmlUrl,
      publicRepos: u.publicRepos,
      followers: u.followers,
      following: u.following,
      createdAt: u.createdAt,
    },
    repos,
    languages: { formula: LANGUAGE_FORMULA, shares: languageShares(repos) },
    contributions: u.calendar
      ? {
          available: true,
          reason: null,
          total: u.calendar.total,
          fetchedAt: g.fetchedAt,
          days: u.calendar.days,
        }
      : { available: false, reason: NO_TOKEN, total: null, fetchedAt: null, days: [] },
    novaMetrics: u.calendar ? contributionMetrics(u.calendar.days, today) : null,
  };
}

/** DashboardService.githubSummary, from saved data only. */
export function githubSummary(g: StoredGitHub | null, today: string) {
  if (!g) return null;
  const latest = [...g.user.repos]
    .filter((r) => r.pushedAt)
    .sort((a, b) => b.pushedAt!.localeCompare(a.pushedAt!) || a.name.localeCompare(b.name))[0];
  const monthStart = `${today.slice(0, 7)}-01`;
  return {
    username: g.user.login,
    contributionsThisMonth: g.user.calendar
      ? g.user.calendar.days
          .filter((d) => d.date >= monthStart && d.date <= today)
          .reduce((n, d) => n + d.count, 0)
      : null,
    lastPushRepo: latest?.name ?? null,
    lastPushAt: latest?.pushedAt ?? null,
    fetchedAt: g.fetchedAt,
  };
}
