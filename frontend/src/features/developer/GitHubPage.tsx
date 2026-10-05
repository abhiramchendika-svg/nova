import { AlertTriangle, ExternalLink, RefreshCw, Star } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { formatDateTime, formatDay } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useConnectGitHub, useDisconnectGitHub, useGitHub, useRefreshGitHub } from './githubApi';
import type { GitHubOverview, GitHubRepo, NovaMetric } from './types';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/**
 * GitHub in public mode (docs/api.md §2.13): what GitHub says, labelled "From GitHub", and NOVA's
 * own numbers, labelled "NOVA metric" with their formulas. Missing data is said, never shown as 0.
 */
export function GitHubPage() {
  const query = useGitHub();
  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-6xl gap-6 px-4 py-6 lg:px-6">
      <header>
        <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">GitHub</h1>
        <p className="mt-1 text-ink-2">
          Your public GitHub activity, next to everything else you’re building.
        </p>
      </header>
      {query.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading your GitHub activity…</span>
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="We couldn’t load your GitHub activity."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          requestId={query.error.problem.requestId}
        />
      ) : query.data.connected ? (
        <Connected overview={query.data} />
      ) : (
        <Panel title="Connect your GitHub" domain="developer">
          <div className="grid gap-3">
            <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-ink-2">
              NOVA reads your public profile, repositories and contribution calendar by username. It never
              asks for your password or access to private code.
            </p>
            <GitHubConnectForm submitLabel="Connect" />
          </div>
        </Panel>
      )}
    </div>
  );
}

/** The username form, also used by onboarding. Checks the format here; the server asks GitHub. */
export function GitHubConnectForm({
  submitLabel,
  onConnected,
  extraAction,
}: {
  submitLabel: string;
  onConnected?: () => void;
  extraAction?: ReactNode;
}) {
  const connect = useConnectGitHub();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = username.trim().replace(/^@/, '');
    if (!value) {
      setError('Enter your GitHub username.');
      return;
    }
    if (!USERNAME.test(value)) {
      setError('Use your GitHub username: letters, numbers and single hyphens, up to 39 characters.');
      return;
    }
    connect.mutate(value, {
      onSuccess: () => onConnected?.(),
      onError: (err) =>
        setError(err.fieldErrors.find((f) => f.field === 'username')?.message ?? errorMessage(err)),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-2">
      <Field
        label="GitHub username"
        placeholder="octocat"
        autoComplete="off"
        spellCheck={false}
        className="min-w-56 flex-1 sm:max-w-80"
        value={username}
        error={error ?? undefined}
        onChange={(e) => {
          setUsername(e.target.value);
          setError(null);
        }}
      />
      <div className="flex gap-2 pt-[26px]">
        <Button type="submit" variant="primary" loading={connect.isPending}>
          {submitLabel}
        </Button>
        {extraAction}
      </div>
    </form>
  );
}

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function Connected({ overview: o }: { overview: GitHubOverview }) {
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const refresh = useRefreshGitHub();
  const disconnect = useDisconnectGitHub();
  const [changing, setChanging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const p = o.profile!;

  return (
    <>
      <section
        aria-label="Profile"
        className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-line bg-surface p-5"
      >
        <div className="flex min-w-0 items-center gap-4">
          {p.avatarUrl && (
            <img
              src={p.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              width={56}
              height={56}
              className="size-14 rounded-full border border-line"
            />
          )}
          <div className="grid min-w-0 gap-0.5">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[18px] font-semibold">{p.name ?? p.login}</span>
              <Badge tone="neutral">From GitHub</Badge>
            </p>
            {p.htmlUrl && (
              <a
                href={p.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink hover:underline"
              >
                github.com/{p.login}
                <ExternalLink size={12} aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
              {(
                [
                  ['Public repositories', p.publicRepos],
                  ['Followers', p.followers],
                  ['Following', p.following],
                ] as const
              ).map(([label, n]) =>
                n === null ? null : (
                  <div key={label} className="flex gap-1">
                    <dt>{label}</dt>
                    <dd className="font-mono tabular text-ink">{n}</dd>
                  </div>
                ),
              )}
            </dl>
          </div>
        </div>
        <div className="grid justify-items-end gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => refresh.mutate()} loading={refresh.isPending}>
              <RefreshCw size={14} aria-hidden />
              Refresh
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setChanging((c) => !c)}>
              Change username
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              Disconnect
            </Button>
          </div>
          {o.fetchedAt && <p className="text-[12px] text-ink-3">Updated {ago(o.fetchedAt)}</p>}
        </div>
        {changing && (
          <div className="w-full">
            <GitHubConnectForm submitLabel="Use this username" onConnected={() => setChanging(false)} />
          </div>
        )}
      </section>

      {refresh.isError && (
        <p role="alert" className="text-[13px] text-critical">
          {refresh.error.status === 429
            ? 'You refreshed a moment ago. GitHub data can be refreshed once every five minutes.'
            : errorMessage(refresh.error)}
        </p>
      )}
      {o.stale && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-warning/40 tint-warning px-4 py-3 text-[13px]"
        >
          <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0 text-warning" />
          <span>
            GitHub didn’t answer, so this is the copy from {o.fetchedAt ? ago(o.fetchedAt) : 'earlier'}.
            {o.retryAt && <> NOVA will try again after {formatDateTime(o.retryAt, timezone)}.</>}
          </span>
        </p>
      )}

      <Metrics overview={o} />
      <Calendar overview={o} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Repos repos={o.repos ?? []} />
        <Languages overview={o} />
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) disconnect.reset();
        }}
        title="Disconnect GitHub?"
        description="NOVA forgets your username and everything it saved from GitHub. Your GitHub account isn’t touched."
        confirmLabel="Disconnect"
        pending={disconnect.isPending}
        error={disconnect.isError ? errorMessage(disconnect.error) : null}
        onConfirm={() => disconnect.mutate(undefined, { onSuccess: () => setConfirming(false) })}
      />
    </>
  );
}

function MetricLabel({ children }: { children: ReactNode }) {
  return <span className="text-[12px] text-ink-3">{children}</span>;
}

function Metrics({ overview: o }: { overview: GitHubOverview }) {
  const m = o.novaMetrics;
  if (!m) return null;
  const change = m.change.value;
  const items: [string, NovaMetric, string][] = [
    ['This month', m.thisMonth, `${m.thisMonth.value}`],
    ['Last month', m.lastMonth, `${m.lastMonth.value}`],
    ['Change', m.change, change === null ? '–' : `${change > 0 ? '+' : ''}${change}%`],
    [
      'Current streak',
      m.currentStreak,
      `${m.currentStreak.value} ${m.currentStreak.value === 1 ? 'day' : 'days'}`,
    ],
    [
      'Longest streak',
      m.longestStreak,
      `${m.longestStreak.value} ${m.longestStreak.value === 1 ? 'day' : 'days'}`,
    ],
    ['Active weeks', m.activeWeeks, `${m.activeWeeks.value} of 12`],
  ];
  return (
    <Panel title="Contributions" domain="developer" action={<Badge tone="developer">NOVA metric</Badge>}>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(([label, , shown]) => (
          <div key={label} className="grid gap-0.5">
            <dt>
              <MetricLabel>{label}</MetricLabel>
            </dt>
            <dd className="font-mono text-[20px] tabular text-ink">{shown}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-3 text-[12px] text-ink-3">
        <summary className="cursor-pointer">
          How NOVA works these out (from GitHub’s public contribution calendar)
        </summary>
        <dl className="mt-2 grid gap-1">
          {items.map(([label, metric]) => (
            <div key={label} className="flex flex-wrap gap-x-1">
              <dt className="font-medium text-ink-2">{label}:</dt>
              <dd>{metric.formula}</dd>
            </div>
          ))}
        </dl>
      </details>
    </Panel>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function level(count: number, max: number): number {
  if (count === 0) return 0;
  return Math.min(4, Math.ceil((count / Math.max(1, max)) * 4));
}

function Calendar({ overview: o }: { overview: GitHubOverview }) {
  const c = o.contributions;
  if (!c) return null;
  if (!c.available) {
    return (
      <Panel title="Contribution calendar" domain="developer">
        <p className="text-[13px] leading-relaxed text-ink-2">{c.reason}</p>
      </Panel>
    );
  }
  const days = c.days;
  const max = Math.max(0, ...days.map((d) => d.count));
  // Weeks start on Sunday, as on GitHub
  const first = days[0] ? new Date(`${days[0].date}T00:00:00Z`).getUTCDay() : 0;
  const cells: ({ date: string; count: number } | null)[] = [...Array<null>(first).fill(null), ...days];
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const months = new Map<string, number>();
  for (const d of days) months.set(d.date.slice(0, 7), (months.get(d.date.slice(0, 7)) ?? 0) + d.count);

  return (
    <Panel
      title="Contribution calendar"
      domain="developer"
      action={<Badge tone="neutral">From GitHub</Badge>}
    >
      <div className="grid gap-4">
        <p className="text-[13px] text-ink-2">
          <span className="font-mono tabular text-ink">{c.total}</span> public contributions in the last year
        </p>
        <div aria-hidden className="overflow-x-auto">
          <div className="flex gap-[3px]">
            {weeks.map((week, w) => (
              <div key={w} className="grid grid-rows-7 gap-[3px]">
                {week.map((d, i) =>
                  d ? (
                    <span
                      key={d.date}
                      title={`${formatDay(d.date)}: ${d.count}`}
                      className={cn(
                        'size-[11px] rounded-[2px]',
                        level(d.count, max) === 0 ? 'bg-surface-3' : 'bg-developer',
                      )}
                      style={
                        level(d.count, max) > 0 ? { opacity: 0.25 + level(d.count, max) * 0.1875 } : undefined
                      }
                    />
                  ) : (
                    <span key={`pad-${i}`} className="size-[11px]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-[13px] font-semibold">By month</h3>
          <ul
            aria-label="Contributions by month"
            className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2"
          >
            {[...months.entries()].map(([ym, n]) => (
              <li key={ym}>
                {MONTHS[Number(ym.slice(5, 7)) - 1]} {ym.slice(2, 4)}:{' '}
                <span className="font-mono tabular text-ink">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function Repos({ repos }: { repos: GitHubRepo[] }) {
  const [by, setBy] = useState<'stars' | 'recent'>('recent');
  const own = repos.filter((r) => !r.fork);
  const sorted = [...own].sort((a, b) =>
    by === 'stars'
      ? b.stars - a.stars || a.name.localeCompare(b.name)
      : (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''),
  );
  const top = sorted.slice(0, 8);
  return (
    <Panel
      title="Repositories"
      domain="developer"
      action={
        <div role="group" aria-label="Sort repositories" className="flex gap-1 rounded-md bg-surface-2 p-0.5">
          {(['recent', 'stars'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={by === v}
              onClick={() => setBy(v)}
              className={cn(
                'rounded-sm px-2 py-0.5 text-[12px] font-medium',
                by === v ? 'bg-surface text-ink' : 'text-ink-2 hover:text-ink',
              )}
            >
              {v === 'recent' ? 'Recent' : 'Stars'}
            </button>
          ))}
        </div>
      }
    >
      {top.length === 0 ? (
        <p className="text-[13px] text-ink-2">No public repositories of your own yet.</p>
      ) : (
        <ul aria-label="Repositories" className="-mx-5 divide-y divide-line border-y border-line">
          {top.map((r) => (
            <li key={r.fullName} className="grid gap-1 px-5 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <a
                  href={r.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink hover:underline"
                >
                  {r.name}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {r.archived && <Badge tone="neutral">Archived</Badge>}
              </p>
              {r.description && <p className="text-[13px] text-ink-2">{r.description}</p>}
              <p className="flex flex-wrap gap-x-3 text-[12px] text-ink-3">
                {r.language && <span>{r.language}</span>}
                <span className="inline-flex items-center gap-0.5">
                  <Star size={11} aria-hidden />
                  <span className="sr-only">Stars: </span>
                  {r.stars}
                </span>
                {r.forks > 0 && <span>{r.forks} forks</span>}
                {r.pushedAt && <span>Pushed {ago(r.pushedAt)}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
      {own.length > top.length && (
        <p className="mt-3 text-[12px] text-ink-3">
          Showing {top.length} of {own.length} repositories (forks not shown).
        </p>
      )}
    </Panel>
  );
}

function Languages({ overview: o }: { overview: GitHubOverview }) {
  const l = o.languages;
  if (!l) return null;
  return (
    <Panel title="Languages" domain="developer" action={<Badge tone="developer">NOVA metric</Badge>}>
      {l.shares.length === 0 ? (
        <p className="text-[13px] text-ink-2">None of your own repositories has a primary language yet.</p>
      ) : (
        <ul aria-label="Languages" className="grid gap-2">
          {l.shares.map((s) => (
            <li
              key={s.language}
              className="grid grid-cols-[6rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-[12.5px]"
            >
              <span className="truncate text-ink">{s.language}</span>
              <span aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full rounded-full bg-developer" style={{ width: `${s.share}%` }} />
              </span>
              <span className="text-right font-mono tabular text-ink">{s.share}%</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-ink-3">Share of repositories, not lines of code: {l.formula}.</p>
    </Panel>
  );
}
