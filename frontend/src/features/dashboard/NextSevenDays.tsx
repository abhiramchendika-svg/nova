import { Link } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { useCalendar } from '@/features/planner/api';
import { FULL_DAY, ITEM_LABEL, itemHref, loadScore, loadText } from '@/features/planner/calendarText';
import { dayLabel } from '@/features/planner/taskText';
import type { CalendarItem } from '@/features/planner/types';
import { cn } from '@/lib/cn';
import { addDays, formatDay } from '@/lib/dates';

/** Deadlines, exams and milestones; classes and planned tasks only count towards how full a day is. */
const SHOWN = new Set(['ASSIGNMENT_DUE', 'EXAM', 'TASK_DUE', 'MILESTONE']);

/** The coming week's deadlines and exams by day, with the busiest day marked (from the calendar feed). */
export function NextSevenDays({ today }: { today: string }) {
  const query = useCalendar(today, addDays(today, 6));
  if (query.isPending) {
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading the next 7 days…</span>
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="We couldn’t load the coming week."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        requestId={query.error.problem.requestId}
      />
    );
  }
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of query.data.items.filter((i) => SHOWN.has(i.type))) {
    byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
  }
  if (byDay.size === 0) {
    return (
      <EmptyState
        compact
        title="Nothing due this week. Enjoy the breathing room."
        description="Assignments, exams and deadlines for the coming week show here, with your busiest day marked."
      />
    );
  }
  const busiest = query.data.load.reduce((best, l) => (loadScore(l) > loadScore(best) ? l : best));
  const busiestText = loadText(busiest);
  return (
    <div className="grid gap-3">
      {/* The busiest day may hold only classes and planned work, so it isn't always listed below */}
      {!byDay.has(busiest.date) && busiestText && (
        <p className="text-[12.5px] text-ink-2">
          Busiest day: <span className="font-medium text-ink">{dayLabel(busiest.date, today)}</span> (
          {busiestText})
        </p>
      )}
      <ol aria-label="Next 7 days" className="-mx-5 -mb-5 divide-y divide-line border-t border-line">
        {query.data.load
          .filter((l) => byDay.has(l.date))
          .map((l) => {
            const label = dayLabel(l.date, today);
            const text = loadText(l);
            const pct = Math.min(100, (loadScore(l) / FULL_DAY) * 100);
            const isBusiest = l.date === busiest.date && loadScore(l) > 0;
            return (
              <li key={l.date} className="grid gap-2 px-5 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
                <div className="grid content-start gap-1.5">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                    {label === formatDay(l.date) ? label : `${label}, ${formatDay(l.date)}`}
                    {isBusiest && <Badge tone="warning">Busiest</Badge>}
                  </p>
                  <span aria-hidden className="h-1 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className={cn('block h-full rounded-full', pct >= 100 ? 'bg-warning' : 'bg-planner')}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  {text && <p className="text-[12px] text-ink-3">{text}</p>}
                </div>
                <ul className="grid gap-1.5">
                  {byDay.get(l.date)!.map((item) => (
                    <li key={item.key} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                      <span className="font-mono text-[11.5px] text-ink-3">{item.startTime}</span>
                      <Link
                        to={itemHref(item) ?? '/app/planner/tasks'}
                        className="min-w-0 break-words font-medium text-ink hover:underline"
                      >
                        <span className="sr-only">{ITEM_LABEL[item.type]}: </span>
                        {item.title}
                      </Link>
                      {(item.courseCode ?? item.courseName) && (
                        <span className="text-[12px] text-ink-3">{item.courseCode ?? item.courseName}</span>
                      )}
                      {item.type === 'EXAM' && <Badge tone="academics">Exam</Badge>}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
      </ol>
    </div>
  );
}
