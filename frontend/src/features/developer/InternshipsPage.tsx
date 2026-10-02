import { CalendarClock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SelectField } from '@/components/ui/SelectField';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { formatDateTime, formatDay, todayIn } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useInternshipAnalytics, useInternships, useMoveInternship } from './internshipApi';
import { InternshipDialog } from './InternshipDialog';
import {
  BOARD_STAGES,
  CLOSED_STATUSES,
  INTERNSHIP_STATUS_LABEL,
  INTERNSHIP_STATUS_TONE,
  INTERNSHIP_STATUSES,
} from './projectText';
import type { Internship, InternshipAnalytics, InternshipStatus } from './types';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const BOARD_LIMIT = 100;
const PAGE_SIZE = 20;

/**
 * Internship applications as a board (one column per stage still in play) or a full, paged list,
 * with this month's numbers and the all-time funnel on top (docs/api.md §2.12).
 */
export function InternshipsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'list' ? 'list' : 'board';
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const navigate = useNavigate();
  const [adding, setAdding] = useState<InternshipStatus | null>(null);

  const setView = (next: 'board' | 'list') =>
    setParams((p) => {
      const copy = new URLSearchParams(p);
      if (next === 'list') copy.set('view', 'list');
      else copy.delete('view');
      return copy;
    });

  return (
    <div className="animate-enter mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Internships</h1>
          <p className="mt-1 text-ink-2">Every application, where it stands, and how this season is going.</p>
        </div>
        <Button variant="primary" onClick={() => setAdding('APPLIED')}>
          <Plus size={15} aria-hidden />
          New application
        </Button>
      </header>

      <Analytics timezone={timezone} />

      <div
        role="group"
        aria-label="View"
        className="flex gap-1 justify-self-start rounded-md bg-surface-2 p-1"
      >
        {(['board', 'list'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(
              'rounded-sm px-3 py-1 text-[13px] font-medium',
              view === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
            )}
          >
            {v === 'board' ? 'Board' : 'List'}
          </button>
        ))}
      </div>

      {view === 'board' ? (
        <Board timezone={timezone} onAdd={setAdding} onShowClosed={() => setView('list')} />
      ) : (
        <List timezone={timezone} />
      )}

      <InternshipDialog
        open={adding !== null}
        onOpenChange={(o) => !o && setAdding(null)}
        timezone={timezone}
        initial={adding ? { status: adding } : undefined}
        onSaved={(i) => void navigate(`/app/developer/internships/${i.id}`)}
      />
    </div>
  );
}

// ───────────── analytics ─────────────

function Analytics({ timezone }: { timezone: string }) {
  const thisMonth = todayIn(timezone).slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const query = useInternshipAnalytics(month || null);

  return (
    <Panel
      title="Season so far"
      domain="developer"
      action={
        <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
          Month
          <input
            type="month"
            value={month}
            max={thisMonth}
            onChange={(e) => setMonth(e.target.value)}
            className="h-8 rounded-sm border border-line bg-surface px-2 text-[13px] text-ink"
          />
        </label>
      }
    >
      {query.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading the numbers…</span>
          <Skeleton className="h-20" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="We couldn’t load the numbers."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          requestId={query.error.problem.requestId}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="grid gap-3">
            <div role="group" aria-label="This month">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    ['Applied', query.data.applied],
                    ['Assessments', query.data.assessments],
                    ['Interviews', query.data.interviews],
                    ['Offers', query.data.offers],
                  ] as const
                ).map(([label, n]) => (
                  <div key={label} className="grid gap-0.5">
                    <dt className="text-[12px] text-ink-3">{label}</dt>
                    <dd className="font-mono text-[20px] tabular text-ink">{n}</dd>
                  </div>
                ))}
                <div className="grid gap-0.5">
                  <dt className="text-[12px] text-ink-3">Response rate</dt>
                  <dd className="font-mono text-[20px] tabular text-ink">
                    {query.data.responseRate.value === null ? '–' : `${query.data.responseRate.value}%`}
                  </dd>
                </div>
              </dl>
            </div>
            <p className="text-[12.5px] text-ink-3">
              Applications sent in {monthLabel(query.data.month)} and how far they’ve got since. Response rate
              = responded ÷ applied ({query.data.responseRate.responded} of {query.data.responseRate.applied}
              ); a rejection counts as a response, withdrawing doesn’t.
            </p>
          </div>
          <Funnel funnel={query.data.allTime} />
        </div>
      )}
    </Panel>
  );
}

const monthLabel = (ym: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${ym}-01T00:00:00Z`),
  );

function Funnel({ funnel }: { funnel: InternshipAnalytics['allTime'] }) {
  const rows = [
    ['Applied', funnel.applied],
    ['Assessment', funnel.assessment],
    ['Interview', funnel.interview],
    ['Offer', funnel.offer],
  ] as const;
  const top = Math.max(1, funnel.applied);
  return (
    <div className="grid gap-2">
      <h3 className="text-[13px] font-semibold">All time</h3>
      <ul aria-label="All-time funnel" className="grid gap-1.5">
        {rows.map(([label, n]) => (
          <li
            key={label}
            className="grid grid-cols-[6rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-[12.5px]"
          >
            <span className="text-ink-2">{label}</span>
            <span aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-3">
              <span
                className="block h-full rounded-full bg-developer"
                style={{ width: `${(n / top) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono tabular text-ink">{n}</span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-3">
        {funnel.saved} saved · {funnel.rejected} rejected · {funnel.withdrawn} withdrawn
      </p>
    </div>
  );
}

// ───────────── board ─────────────

function Board({
  timezone,
  onAdd,
  onShowClosed,
}: {
  timezone: string;
  onAdd: (status: InternshipStatus) => void;
  onShowClosed: () => void;
}) {
  const query = useInternships(BOARD_STAGES, 0, BOARD_LIMIT);
  const closed = useInternships(CLOSED_STATUSES, 0, 1);
  const move = useMoveInternship();

  if (query.isPending) {
    return (
      <div role="status" aria-busy="true" className="grid gap-3 md:grid-cols-5">
        <span className="sr-only">Loading your applications…</span>
        {BOARD_STAGES.map((s) => (
          <Skeleton key={s} className="h-40" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="We couldn’t load your applications."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        requestId={query.error.problem.requestId}
      />
    );
  }
  const items = query.data.items;
  const closedCount = closed.data?.totalItems ?? 0;
  if (items.length === 0 && closedCount === 0) {
    return (
      <EmptyState
        title="Track every application in one place."
        description="Add the internships you’ve applied to (or want to); move them along as you hear back, and see your response rate each month."
        action={
          <Button size="sm" variant="primary" onClick={() => onAdd('APPLIED')}>
            Add an application
          </Button>
        }
      />
    );
  }
  return (
    <div className="grid gap-3">
      {move.isError && <p className="text-[13px] text-critical">{errorMessage(move.error)}</p>}
      <div className="grid gap-3 md:grid-cols-[repeat(5,minmax(0,1fr))]">
        {BOARD_STAGES.map((stage) => {
          const column = items.filter((i) => i.status === stage);
          const id = `stage-${stage.toLowerCase()}`;
          return (
            <section
              key={stage}
              aria-labelledby={id}
              className="grid content-start gap-2 rounded-md bg-surface-2 p-2"
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <h2 id={id} className="flex items-baseline gap-2 text-[13.5px] font-semibold">
                  {INTERNSHIP_STATUS_LABEL[stage]}{' '}
                  <span className="font-mono text-[12px] font-normal tabular text-ink-3">
                    {column.length}
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={() => onAdd(stage)}
                  className="rounded-sm p-1 text-ink-3 hover:bg-surface hover:text-ink"
                  aria-label={`Add to ${INTERNSHIP_STATUS_LABEL[stage]}`}
                >
                  <Plus size={14} aria-hidden />
                </button>
              </div>
              {column.map((i) => (
                <BoardCard
                  key={i.id}
                  internship={i}
                  timezone={timezone}
                  pending={move.isPending}
                  onMove={(status) => move.mutate({ id: i.id, status })}
                />
              ))}
            </section>
          );
        })}
      </div>
      <p className="text-[12.5px] text-ink-2">
        {query.data.totalItems > BOARD_LIMIT && `Showing the first ${BOARD_LIMIT} applications in play. `}
        {closedCount > 0 && (
          <>
            {closedCount} closed (
            {CLOSED_STATUSES.map((s) => INTERNSHIP_STATUS_LABEL[s].toLowerCase()).join(' or ')}
            ).{' '}
            <button type="button" className="font-medium text-ink underline" onClick={onShowClosed}>
              See them in the list
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function BoardCard({
  internship: i,
  timezone,
  pending,
  onMove,
}: {
  internship: Internship;
  timezone: string;
  pending: boolean;
  onMove: (status: InternshipStatus) => void;
}) {
  const headingId = `internship-${i.id}`;
  return (
    <article
      aria-labelledby={headingId}
      className="grid gap-1.5 rounded-sm border border-line bg-surface p-3"
    >
      <h3 id={headingId} className="text-[13.5px] font-semibold leading-snug">
        <Link to={`/app/developer/internships/${i.id}`} className="break-words hover:underline">
          {i.role} at {i.company}
        </Link>
      </h3>
      <p className="text-[12px] text-ink-3">
        {i.appliedOn ? `Applied ${formatDay(i.appliedOn)}` : 'Not sent yet'}
        {i.location && ` · ${i.location}`}
      </p>
      <Dates internship={i} timezone={timezone} />
      <SelectField
        label={`Stage of ${i.role} at ${i.company}`}
        hideLabel
        controlSize="sm"
        value={i.status}
        disabled={pending}
        onChange={(e) => onMove(e.target.value as InternshipStatus)}
      >
        {INTERNSHIP_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === i.status ? INTERNSHIP_STATUS_LABEL[s] : `Move to ${INTERNSHIP_STATUS_LABEL[s]}`}
          </option>
        ))}
      </SelectField>
    </article>
  );
}

/** The apply-by date while saved (red once missed) and the next step, if any. */
export function Dates({ internship: i, timezone }: { internship: Internship; timezone: string }) {
  return (
    <>
      {i.status === 'SAVED' && i.deadlineAt && (
        <p
          className={cn(
            'flex items-start gap-1.5 text-[12px]',
            i.deadlineMissed ? 'text-critical' : 'text-ink-2',
          )}
        >
          <CalendarClock size={12} aria-hidden className="mt-0.5 shrink-0" />
          {i.deadlineMissed ? 'Apply-by date passed' : 'Apply by'} {formatDateTime(i.deadlineAt, timezone)}
        </p>
      )}
      {i.nextStepAt && !CLOSED_STATUSES.includes(i.status) && (
        <p className="flex items-start gap-1.5 text-[12px] text-ink">
          <CalendarClock size={12} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            {i.nextStep ?? 'Next step'}: {formatDateTime(i.nextStepAt, timezone)}
          </span>
        </p>
      )}
    </>
  );
}

// ───────────── list ─────────────

function List({ timezone }: { timezone: string }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('status');
  const status = INTERNSHIP_STATUSES.find((s) => s === raw) ?? null;
  const [page, setPage] = useState(0);
  const query = useInternships(status ? [status] : null, page, PAGE_SIZE);

  return (
    <div className="grid gap-3">
      <SelectField
        label="Stage"
        className="w-48"
        value={status ?? ''}
        onChange={(e) => {
          setPage(0);
          setParams((p) => {
            const copy = new URLSearchParams(p);
            if (e.target.value) copy.set('status', e.target.value);
            else copy.delete('status');
            return copy;
          });
        }}
      >
        <option value="">All stages</option>
        {INTERNSHIP_STATUSES.map((s) => (
          <option key={s} value={s}>
            {INTERNSHIP_STATUS_LABEL[s]}
          </option>
        ))}
      </SelectField>

      {query.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading your applications…</span>
          <Skeleton className="h-40" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="We couldn’t load your applications."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          requestId={query.error.problem.requestId}
        />
      ) : query.data.items.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">No applications {status ? 'at this stage' : 'yet'}.</p>
      ) : (
        <>
          <ul
            aria-label="Applications"
            className="divide-y divide-line rounded-md border border-line bg-surface"
          >
            {query.data.items.map((i) => (
              <li
                key={i.id}
                className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4"
              >
                <div className="grid min-w-0 gap-0.5">
                  <p className="text-[14px]">
                    <Link to={`/app/developer/internships/${i.id}`} className="font-medium hover:underline">
                      {i.role} at {i.company}
                    </Link>
                  </p>
                  <p className="text-[12.5px] text-ink-3">
                    {i.appliedOn ? `Applied ${formatDay(i.appliedOn)}` : 'Not sent yet'}
                    {i.source && ` · via ${i.source}`}
                  </p>
                  <Dates internship={i} timezone={timezone} />
                </div>
                <div>
                  <Badge tone={INTERNSHIP_STATUS_TONE[i.status]}>{INTERNSHIP_STATUS_LABEL[i.status]}</Badge>
                </div>
              </li>
            ))}
          </ul>
          {query.data.totalPages > 1 && (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {page + 1} of {query.data.totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page + 1 >= query.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
