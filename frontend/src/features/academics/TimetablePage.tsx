import { AlertTriangle, Plus } from 'lucide-react';
import { useId, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { fitRange, formatMinutes, hourTicks, toMinutes } from '@/features/dashboard/timeScale';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/services/http';
import { useCourses, useDeleteEntry, useSemesters, useTimetable } from './api';
import { pickSemester } from './selection';
import { TimetableEntryDialog } from './TimetableEntryDialog';
import { placeDay } from './timetableLayout';
import { CLASS_KIND_LABEL, DAY_NAME, DAY_SHORT, weekOrder } from './timetableText';
import type { TimetableEntry } from './types';

/** Vertical scale of the week grid. */
const HOUR_PX = 72;

/**
 * The weekly timetable. One DOM serves both layouts: on phones each day is a plain list; from md
 * up the same lists become columns of a time grid (positions come from CSS variables that only
 * md: classes read), so screen readers always get days in order with classes in time order.
 */
export function TimetablePage() {
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const semesters = useSemesters();
  const list = semesters.data ?? [];
  const selected = pickSemester(list, params.get('semester'));
  const courses = useCourses(selected?.id);
  const week = useTimetable(selected?.id ?? null, Boolean(selected));
  const [dialog, setDialog] = useState<{ open: boolean; editing?: TimetableEntry; day?: number }>({
    open: false,
  });
  const [deleting, setDeleting] = useState<TimetableEntry | null>(null);
  const remove = useDeleteEntry();

  const order = weekOrder(settings.data?.weekStart ?? 'MON');
  const entries = week.data ?? [];
  // Weekdays always; the weekend only when something is on it
  const days = order.filter((d) => d <= 5 || entries.some((e) => e.dayOfWeek === d));
  const choices = courses.data ?? [];
  const clashes = clashPairs(entries);

  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-6xl gap-5 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Timetable</h1>
          <p className="mt-1 text-ink-2">Your weekly classes. Home uses it to line up each day.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {list.length > 1 && selected && (
            <SelectField
              label="Semester"
              controlSize="sm"
              className="w-48"
              value={selected.id}
              onChange={(e) => setParams({ semester: e.target.value }, { replace: true })}
            >
              {list.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.current ? ' (current)' : ''}
                </option>
              ))}
            </SelectField>
          )}
          {choices.length > 0 && (
            <Button variant="primary" onClick={() => setDialog({ open: true })}>
              <Plus size={15} aria-hidden />
              Add class
            </Button>
          )}
        </div>
      </header>

      {semesters.isPending || (selected && (courses.isPending || week.isPending)) ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading your timetable…</span>
          <Skeleton className="h-80" />
        </div>
      ) : semesters.isError || courses.isError || week.isError ? (
        <ErrorState
          title="We couldn’t load your timetable."
          onRetry={() => {
            void semesters.refetch();
            void courses.refetch();
            void week.refetch();
          }}
          requestId={(semesters.error ?? courses.error ?? week.error)?.problem.requestId}
        />
      ) : !selected || choices.length === 0 ? (
        <EmptyState
          title="Classes belong to a course."
          description="Add your semester and its courses first, then place their classes here."
          action={
            <ButtonLink
              to={selected ? `/app/academics/courses?semester=${selected.id}` : '/app/academics/courses'}
              size="sm"
              variant="primary"
            >
              Go to courses
            </ButtonLink>
          }
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Add your weekly classes."
          description="Each class repeats every week. Once they’re in, Home shows today’s classes and lets you mark attendance in one tap."
          action={
            <Button size="sm" variant="primary" onClick={() => setDialog({ open: true })}>
              Add class
            </Button>
          }
        />
      ) : (
        <>
          {clashes.length > 0 && (
            <div className="tint-warning flex items-start gap-2 rounded-sm px-3 py-2.5 text-[13px] text-warning">
              <AlertTriangle size={16} className="mt-px shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">
                  {clashes.length === 1
                    ? 'Two classes overlap.'
                    : `${clashes.length} pairs of classes overlap.`}
                </p>
                <ul className="mt-0.5">
                  {clashes.slice(0, 3).map(([a, b]) => (
                    <li key={`${a.id}-${b.id}`}>
                      {DAY_NAME[a.dayOfWeek]}: {label(a)} {a.startsAt}–{a.endsAt} and {label(b)} {b.startsAt}–
                      {b.endsAt}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <WeekGrid
            days={days}
            entries={entries}
            onOpen={(entry) => setDialog({ open: true, editing: entry })}
          />
        </>
      )}

      <TimetableEntryDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        courses={choices}
        days={order}
        entry={dialog.editing}
        onDelete={(entry) => {
          setDialog((d) => ({ ...d, open: false }));
          setDeleting(entry);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            remove.reset();
          }
        }}
        title="Delete this class?"
        description={
          deleting ? (
            <>
              <strong className="text-ink">{label(deleting)}</strong> on {DAY_NAME[deleting.dayOfWeek]}s at{' '}
              {deleting.startsAt} will be removed from your timetable. Attendance you’ve marked stays.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete class"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}

const label = (e: TimetableEntry) => (e.courseCode ? `${e.courseCode} ${e.courseName}` : e.courseName);

/** Each overlapping pair once, in week order. */
function clashPairs(entries: TimetableEntry[]): [TimetableEntry, TimetableEntry][] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const pairs: [TimetableEntry, TimetableEntry][] = [];
  for (const a of entries) {
    for (const id of a.overlapsWith) {
      const b = byId.get(id);
      if (b && entries.indexOf(a) < entries.indexOf(b)) pairs.push([a, b]);
    }
  }
  return pairs;
}

function WeekGrid({
  days,
  entries,
  onOpen,
}: {
  days: number[];
  entries: TimetableEntry[];
  onOpen: (entry: TimetableEntry) => void;
}) {
  const baseId = useId();
  const range = fitRange(entries.flatMap((e) => [toMinutes(e.startsAt), toMinutes(e.endsAt)]));
  const span = range.endMin - range.startMin;
  const height = (span / 60) * HOUR_PX;
  const ticks = hourTicks(range, 1);
  const pct = (min: number) => ((min - range.startMin) / span) * 100;
  const byId = new Map(entries.map((e) => [e.id, e]));

  return (
    <div
      className="grid gap-4 md:grid-cols-[44px_repeat(var(--days),minmax(0,1fr))] md:gap-0 md:rounded-md md:border md:border-line md:bg-surface"
      style={{ '--days': days.length, '--grid-h': `${height}px` } as CSSProperties}
    >
      {/* Hour labels (grid only) */}
      <div aria-hidden className="relative hidden md:block">
        <div className="h-9 border-b border-line" />
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
        const dayEntries = entries.filter((e) => e.dayOfWeek === day);
        const places = placeDay(dayEntries);
        const headingId = `${baseId}-day-${day}`;
        return (
          <section key={day} aria-labelledby={headingId} className="min-w-0 md:border-l md:border-line">
            <h2
              id={headingId}
              className="mb-2 text-[14px] font-semibold md:mb-0 md:flex md:h-9 md:items-center md:justify-center md:border-b md:border-line md:text-[13px]"
            >
              <span aria-hidden className="hidden md:inline">
                {DAY_SHORT[day]}
              </span>
              <span className="md:sr-only">{DAY_NAME[day]}</span>
            </h2>
            {dayEntries.length === 0 ? <p className="text-[13px] text-ink-3 md:hidden">No classes.</p> : null}
            <ol
              aria-label={`${DAY_NAME[day]} classes`}
              className={cn(
                'grid gap-2 md:relative md:block md:h-[var(--grid-h)]',
                dayEntries.length === 0 && 'hidden md:block',
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
              {dayEntries.map((e) => {
                const place = places.get(e.id) ?? { lane: 0, lanes: 1 };
                const clashesWith = e.overlapsWith
                  .map((id) => byId.get(id))
                  .filter(Boolean) as TimetableEntry[];
                const vars = {
                  '--top': `${pct(toMinutes(e.startsAt))}%`,
                  '--h': `${pct(toMinutes(e.endsAt)) - pct(toMinutes(e.startsAt))}%`,
                  '--left': `${(place.lane / place.lanes) * 100}%`,
                  '--w': `${100 / place.lanes}%`,
                } as CSSProperties;
                return (
                  <li
                    key={e.id}
                    style={vars}
                    className="md:absolute md:left-[var(--left)] md:top-[var(--top)] md:h-[var(--h)] md:w-[var(--w)] md:p-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(e)}
                      aria-label={`${label(e)}, ${CLASS_KIND_LABEL[e.kind]}, ${DAY_NAME[day]} ${e.startsAt} to ${e.endsAt}${
                        e.location ? `, ${e.location}` : ''
                      }${clashesWith.length ? `, overlaps ${clashesWith.map(label).join(' and ')}` : ''}. Edit`}
                      className={cn(
                        'tint-academics grid w-full content-start gap-0.5 overflow-hidden rounded-sm border border-academics/35 px-3 py-2 text-left',
                        'transition-colors hover:border-academics md:h-full md:px-1.5 md:py-1',
                        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
                        clashesWith.length > 0 && 'border-warning md:border-dashed',
                      )}
                    >
                      <span className="flex items-center gap-1 text-[13px] font-semibold leading-tight text-academics-text md:text-[12px]">
                        {clashesWith.length > 0 && (
                          <AlertTriangle size={12} className="shrink-0 text-warning" aria-hidden />
                        )}
                        <span className="truncate">
                          {e.courseCode ?? e.courseName}
                          {e.courseCode && (
                            <span className="font-normal text-ink md:hidden"> {e.courseName}</span>
                          )}
                        </span>
                      </span>
                      <span className="truncate text-[12px] text-ink-2 md:font-mono md:text-[10.5px]">
                        <span className="font-mono">
                          {e.startsAt}–{e.endsAt}
                        </span>
                        <span className="md:hidden">
                          {' '}
                          · {CLASS_KIND_LABEL[e.kind]}
                          {e.location && <> · {e.location}</>}
                        </span>
                      </span>
                      <span className="hidden truncate text-[10.5px] text-ink-2 md:block">
                        {CLASS_KIND_LABEL[e.kind]}
                        {e.location && <> · {e.location}</>}
                      </span>
                    </button>
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
