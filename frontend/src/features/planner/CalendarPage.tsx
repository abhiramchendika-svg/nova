import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button, ButtonLink } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { placeDay } from '@/features/academics/timetableLayout';
import { fitRange, formatMinutes, hourTicks, toMinutes } from '@/features/dashboard/timeScale';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { todayIn } from '@/lib/dates';
import { useCalendar, useTask } from './api';
import {
  dayOfMonth,
  longDay,
  monthLabel,
  monthRange,
  rangeLabel,
  shift,
  shortWeekday,
  weekRange,
  type CalendarView,
} from './calendarDates';
import { FULL_DAY, itemDescription, itemHref, itemTime, loadScore, loadText } from './calendarText';
import { TaskDialog } from './TaskDialog';
import type { CalendarItem, CalendarItemType, DayLoad } from './types';

const HOUR_PX = 48;
const ALL_DAY_ROW_PX = 26;
const MONTH_VISIBLE = 3;

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
/** Minutes since midnight; "24:00" is the end of the day. */
const minutesOf = (hhmm: string) => (hhmm === '24:00' ? 24 * 60 : toMinutes(hhmm));
const isBlock = (item: CalendarItem) => item.startTime !== null && item.endTime !== null;

const TONE: Record<CalendarItemType, string> = {
  CLASS: 'tint-academics border-academics/35 text-academics-text',
  EXAM: 'tint-academics border-academics text-academics-text font-semibold',
  ASSIGNMENT_DUE: 'bg-surface border-dashed border-academics/60 text-ink',
  TASK: 'tint-planner border-planner/35 text-planner-text',
  TASK_DUE: 'bg-surface border-dashed border-planner/60 text-ink',
};

/**
 * Everything with a date, in one place (docs/api.md §2.10): classes, exams, assignment deadlines and
 * tasks, by week or month. Read-only: items link to where they're edited, and tasks open their
 * dialog. Each day also says how full it is.
 */
export function CalendarPage() {
  const [params] = useSearchParams();
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const weekStart = settings.data?.weekStart ?? 'MON';
  const today = todayIn(timezone);

  const view: CalendarView = params.get('view') === 'month' ? 'month' : 'week';
  const dateParam = params.get('date');
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const range = view === 'week' ? weekRange(date, weekStart) : monthRange(date, weekStart);
  const query = useCalendar(range.from, range.to);

  const [adding, setAdding] = useState<{ open: boolean; day?: string }>({ open: false });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const href = (changes: { view?: CalendarView; date?: string | null }) => {
    const next = new URLSearchParams();
    const v = changes.view ?? view;
    if (v === 'month') next.set('view', 'month');
    const d = changes.date === undefined ? date : changes.date;
    if (d) next.set('date', d);
    const q = next.toString();
    return q ? `?${q}` : '?';
  };
  const unit = view === 'week' ? 'week' : 'month';
  const title = view === 'week' ? rangeLabel(range.from, range.to) : monthLabel(date);
  const inRange = today >= range.from && today <= range.to;

  const items = query.data?.items ?? [];
  const loads = new Map((query.data?.load ?? []).map((l) => [l.date, l]));
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);

  const props = {
    days: range.days,
    byDay,
    loads,
    today,
    onOpenTask: setTaskId,
  };

  return (
    <div className="animate-enter mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Calendar</h1>
          <p className="mt-1 text-ink-2">
            Classes, exams, deadlines and tasks together. Times are in your time zone.
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding({ open: true })}>
          <Plus size={15} aria-hidden />
          New task
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Calendar views" className="flex rounded-sm border border-line p-0.5">
          {(['week', 'month'] as const).map((v) => (
            <Link
              key={v}
              to={href({ view: v })}
              replace
              aria-current={view === v ? 'page' : undefined}
              className={cn(
                'rounded-xs px-3 py-1 text-[13px] font-medium',
                view === v ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:text-ink',
              )}
            >
              {v === 'week' ? 'Week' : 'Month'}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link
            to={href({ date: shift(view, date, -1) })}
            replace
            aria-label={`Previous ${unit}`}
            className="grid size-8 place-items-center rounded-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft size={17} aria-hidden />
          </Link>
          <Link
            to={href({ date: shift(view, date, 1) })}
            replace
            aria-label={`Next ${unit}`}
            className="grid size-8 place-items-center rounded-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight size={17} aria-hidden />
          </Link>
        </div>
        <h2 className="font-display text-[17px] font-semibold" aria-live="polite">
          {title}
        </h2>
        {!inRange && (
          <ButtonLink to={href({ date: null })} replace size="sm" variant="ghost">
            Today
          </ButtonLink>
        )}
        <Legend />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {query.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading your calendar…</span>
          <Skeleton className="h-96" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="We couldn’t load your calendar."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          requestId={query.error.problem.requestId}
        />
      ) : view === 'week' ? (
        <WeekView {...props} onAdd={(day) => setAdding({ open: true, day })} />
      ) : (
        <MonthView
          {...props}
          month={date.slice(0, 7)}
          moreHref={(day) => href({ view: 'week', date: day })}
        />
      )}

      <TaskDialog
        open={adding.open}
        onOpenChange={(o) => setAdding((a) => ({ ...a, open: o }))}
        timezone={timezone}
        initial={adding.day ? { plannedFor: adding.day } : undefined}
        onSaved={(t) => setAnnouncement(`Added “${t}”.`)}
      />
      <EditTask
        id={taskId}
        timezone={timezone}
        onClose={() => setTaskId(null)}
        onSaved={(t) => setAnnouncement(`Saved “${t}”.`)}
      />
    </div>
  );
}

/** Loads a task by id, then edits it in the usual dialog. */
function EditTask({
  id,
  timezone,
  onClose,
  onSaved,
}: {
  id: string | null;
  timezone: string;
  onClose: () => void;
  onSaved: (title: string) => void;
}) {
  const task = useTask(id);
  return (
    <>
      {id && task.isError && (
        <p role="alert" className="text-[13px] text-critical">
          We couldn’t open that task.{' '}
          <button type="button" className="underline" onClick={onClose}>
            Dismiss
          </button>
        </p>
      )}
      <TaskDialog
        open={id !== null && task.data !== undefined}
        onOpenChange={(o) => !o && onClose()}
        timezone={timezone}
        task={task.data}
        onSaved={onSaved}
      />
    </>
  );
}

function Legend() {
  const entries: { label: string; tone: string }[] = [
    { label: 'Class', tone: TONE.CLASS },
    { label: 'Exam', tone: TONE.EXAM },
    { label: 'Deadline', tone: TONE.ASSIGNMENT_DUE },
    { label: 'Task', tone: TONE.TASK },
  ];
  return (
    <ul aria-label="Legend" className="ml-auto flex flex-wrap gap-3 text-[12px] text-ink-2">
      {entries.map((e) => (
        <li key={e.label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('size-3 rounded-xs border', e.tone)} />
          {e.label}
        </li>
      ))}
    </ul>
  );
}

interface ViewProps {
  days: string[];
  byDay: Map<string, CalendarItem[]>;
  loads: Map<string, DayLoad>;
  today: string;
  onOpenTask: (id: string) => void;
}

/** A link to where the item lives, or a button that opens the task. */
function Chip({
  item,
  onOpenTask,
  className,
  children,
}: {
  item: CalendarItem;
  onOpenTask: (id: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const to = itemHref(item);
  const classes = cn(
    'block w-full overflow-hidden rounded-sm border text-left transition-colors hover:brightness-[0.97]',
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
    TONE[item.type],
    item.done && 'opacity-60',
    className,
  );
  const label = itemDescription(item);
  return to ? (
    <Link to={to} aria-label={label} className={classes}>
      {children}
    </Link>
  ) : (
    <button
      type="button"
      aria-label={`${label}. Edit`}
      className={classes}
      onClick={() => onOpenTask(item.refId)}
    >
      {children}
    </button>
  );
}

function ChipText({ item }: { item: CalendarItem }) {
  const time = itemTime(item);
  return (
    <span className="flex min-w-0 items-baseline gap-1.5 text-[12px] leading-tight">
      {time && <span className="shrink-0 font-mono text-[10.5px] text-ink-2">{time}</span>}
      <span className={cn('truncate', item.done && 'line-through')}>
        {item.type === 'EXAM' && 'Exam: '}
        {item.type === 'CLASS' ? (item.courseCode ?? item.title) : item.title}
      </span>
    </span>
  );
}

function LoadBar({ load }: { load: DayLoad | undefined }) {
  if (!load) return null;
  const text = loadText(load);
  if (!text) return null;
  const pct = Math.min(100, (loadScore(load) / FULL_DAY) * 100);
  return (
    <span className="grid gap-0.5" title={text}>
      <span aria-hidden className="h-1 overflow-hidden rounded-full bg-surface-3">
        <span
          className={cn('block h-full rounded-full', pct >= 100 ? 'bg-warning' : 'bg-planner')}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

function WeekView({
  days,
  byDay,
  loads,
  today,
  onOpenTask,
  onAdd,
}: ViewProps & { onAdd: (day: string) => void }) {
  const baseId = useId();
  const blocks = days.flatMap((d) => (byDay.get(d) ?? []).filter(isBlock));
  const range = fitRange(
    blocks.flatMap((b) => [minutesOf(b.startTime!), Math.min(minutesOf(b.endTime!), 24 * 60)]),
  );
  const spanMin = range.endMin - range.startMin;
  const pct = (min: number) =>
    ((Math.min(Math.max(min, range.startMin), range.endMin) - range.startMin) / spanMin) * 100;
  const ticks = hourTicks(range, 1);
  const allDayRows = Math.max(1, ...days.map((d) => (byDay.get(d) ?? []).filter((i) => !isBlock(i)).length));

  return (
    <div
      className="grid gap-5 md:grid-cols-[44px_repeat(7,minmax(0,1fr))] md:gap-0 md:rounded-md md:border md:border-line md:bg-surface"
      style={
        {
          '--grid-h': `${(spanMin / 60) * HOUR_PX}px`,
          '--allday-h': `${allDayRows * ALL_DAY_ROW_PX + 8}px`,
        } as CSSProperties
      }
    >
      {/* Hour labels (grid only) */}
      <div aria-hidden className="hidden md:block">
        <div className="h-[72px] border-b border-line" />
        <div className="flex h-[var(--allday-h)] items-center justify-end border-b border-line pr-1.5 text-[10px] text-ink-3">
          All day
        </div>
        <div className="relative h-[var(--grid-h)]">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-1.5 -translate-y-1/2 font-mono text-[10.5px] text-ink-3"
              style={{ top: `${pct(t)}%` }}
            >
              {formatMinutes(t)}
            </span>
          ))}
        </div>
      </div>

      {days.map((day) => {
        const dayItems = byDay.get(day) ?? [];
        const allDay = dayItems.filter((i) => !isBlock(i));
        const timed = dayItems.filter(isBlock);
        const places = placeDay(
          // "24:00" still sorts after every other time, so it works as an end here
          timed.map((i) => ({ id: i.key, startsAt: i.startTime!, endsAt: i.endTime! })),
        );
        const headingId = `${baseId}-${day}`;
        const isToday = day === today;
        return (
          <section key={day} aria-labelledby={headingId} className="min-w-0 md:border-l md:border-line">
            <div className="mb-2 flex items-start gap-2 md:mb-0 md:h-[72px] md:flex-col md:items-stretch md:gap-1 md:border-b md:border-line md:px-1.5 md:py-1.5">
              <div className="flex flex-1 items-center gap-2 md:flex-none">
                <h3 id={headingId} className="text-[14px] font-semibold md:text-[13px]">
                  <span className="md:sr-only">{longDay(day)}</span>
                  <span aria-hidden className="hidden md:inline">
                    {shortWeekday(day)}{' '}
                    <span
                      className={cn(
                        'inline-grid min-w-6 place-items-center rounded-full px-1 tabular',
                        isToday && 'bg-ink text-surface',
                      )}
                    >
                      {dayOfMonth(day)}
                    </span>
                  </span>
                  {isToday && (
                    <span className="ml-2 text-[12px] font-medium text-planner-text md:sr-only">Today</span>
                  )}
                </h3>
                <IconButton
                  label={`Add a task on ${longDay(day)}`}
                  className="ml-auto size-7"
                  onClick={() => onAdd(day)}
                >
                  <Plus size={14} aria-hidden />
                </IconButton>
              </div>
              <LoadBar load={loads.get(day)} />
            </div>

            {dayItems.length === 0 && <p className="text-[13px] text-ink-3 md:hidden">Nothing scheduled.</p>}

            <ul
              aria-label={`${longDay(day)}: deadlines and untimed tasks`}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)] gap-1.5 md:h-[var(--allday-h)] md:content-start md:gap-1 md:border-b md:border-line md:p-1',
                allDay.length === 0 && 'hidden md:grid',
              )}
            >
              {allDay.map((item) => (
                <li key={item.key}>
                  <Chip
                    item={item}
                    onOpenTask={onOpenTask}
                    className="px-2 py-1.5 md:h-[22px] md:px-1.5 md:py-0.5"
                  >
                    <ChipText item={item} />
                  </Chip>
                </li>
              ))}
            </ul>

            <ol
              aria-label={`${longDay(day)}: timed`}
              className={cn(
                'mt-1.5 grid grid-cols-[minmax(0,1fr)] gap-1.5 md:relative md:mt-0 md:block md:h-[var(--grid-h)]',
                timed.length === 0 && 'hidden md:block',
              )}
            >
              {ticks.map((t) => (
                <span
                  key={t}
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 hidden border-t border-line md:block"
                  style={{ top: `${pct(t)}%` }}
                />
              ))}
              {timed.map((item) => {
                const place = places.get(item.key) ?? { lane: 0, lanes: 1 };
                const top = pct(minutesOf(item.startTime!));
                const vars = {
                  '--top': `${top}%`,
                  '--h': `${Math.max(pct(minutesOf(item.endTime!)) - top, 2.5)}%`,
                  '--left': `${(place.lane / place.lanes) * 100}%`,
                  '--w': `${100 / place.lanes}%`,
                } as CSSProperties;
                return (
                  <li
                    key={item.key}
                    style={vars}
                    className="md:absolute md:left-[var(--left)] md:top-[var(--top)] md:h-[var(--h)] md:w-[var(--w)] md:p-0.5"
                  >
                    <Chip
                      item={item}
                      onOpenTask={onOpenTask}
                      className="grid content-start gap-0.5 px-2 py-1.5 md:h-full md:px-1.5 md:py-1"
                    >
                      <ChipText item={item} />
                      {item.location && (
                        <span
                          className={cn(
                            'truncate text-[10.5px] text-ink-2',
                            // Short blocks in the grid only have room for one line
                            minutesOf(item.endTime!) - minutesOf(item.startTime!) < 60 && 'md:hidden',
                          )}
                        >
                          {item.location}
                        </span>
                      )}
                    </Chip>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function MonthView({
  days,
  byDay,
  loads,
  today,
  onOpenTask,
  month,
  moreHref,
}: ViewProps & { month: string; moreHref: (day: string) => string }) {
  const baseId = useId();
  const anything = days.some((d) => d.startsWith(month) && (byDay.get(d) ?? []).length > 0);
  return (
    <div className="grid gap-4">
      {!anything && <p className="text-[13px] text-ink-2 md:hidden">Nothing scheduled this month.</p>}
      <div className="grid gap-4 md:grid-cols-7 md:gap-0 md:overflow-hidden md:rounded-md md:border-l md:border-t md:border-line md:bg-surface">
        {days.slice(0, 7).map((d) => (
          <div
            key={`head-${d}`}
            aria-hidden
            className="hidden border-b border-r border-line py-1.5 text-center text-[12px] font-medium text-ink-2 md:block"
          >
            {shortWeekday(d)}
          </div>
        ))}
        {days.map((day) => {
          const dayItems = byDay.get(day) ?? [];
          const inMonth = day.startsWith(month);
          const headingId = `${baseId}-${day}`;
          const hidden = dayItems.length - MONTH_VISIBLE;
          return (
            <section
              key={day}
              aria-labelledby={headingId}
              className={cn(
                'min-w-0 md:min-h-[116px] md:border-b md:border-r md:border-line md:p-1.5',
                !inMonth && 'md:bg-surface-2',
                (!inMonth || dayItems.length === 0) && 'hidden md:block',
              )}
            >
              <div className="mb-1.5 flex items-center gap-2 md:mb-1">
                <h3
                  id={headingId}
                  className={cn('text-[14px] font-semibold md:text-[12.5px]', !inMonth && 'md:text-ink-3')}
                >
                  <span className="md:sr-only">{longDay(day)}</span>
                  <span aria-hidden className="hidden md:inline">
                    <span
                      className={cn(
                        'inline-grid min-w-6 place-items-center rounded-full px-1 tabular',
                        day === today && 'bg-ink text-surface',
                      )}
                    >
                      {dayOfMonth(day)}
                    </span>
                  </span>
                  {day === today && (
                    <span className="ml-2 text-[12px] font-medium text-planner-text md:sr-only">Today</span>
                  )}
                </h3>
                <div className="ml-auto w-12 md:w-10">
                  <LoadBar load={loads.get(day)} />
                </div>
              </div>
              {dayItems.length > 0 && (
                <ul
                  aria-label={`${longDay(day)}: schedule`}
                  className="grid grid-cols-[minmax(0,1fr)] gap-1.5 md:gap-1"
                >
                  {dayItems.map((item, i) => (
                    <li key={item.key} className={cn(i >= MONTH_VISIBLE && 'md:hidden')}>
                      <Chip item={item} onOpenTask={onOpenTask} className="px-2 py-1.5 md:px-1.5 md:py-0.5">
                        <ChipText item={item} />
                      </Chip>
                    </li>
                  ))}
                </ul>
              )}
              {hidden > 0 && (
                <Link
                  to={moreHref(day)}
                  className="mt-1 hidden text-[11.5px] font-medium text-ink-2 hover:text-ink hover:underline md:block"
                >
                  +{hidden} more<span className="sr-only"> on {longDay(day)}, in the week view</span>
                </Link>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
