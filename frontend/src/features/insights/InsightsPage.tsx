import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/dates';
import { useInsights } from './api';
import { DayBars } from './DayBars';
import { InsightCard } from './InsightCard';
import type { InsightWindow, Insights } from './types';

const WINDOWS: { id: InsightWindow; label: string }[] = [
  { id: 'WEEK', label: 'This week' },
  { id: 'MONTH', label: 'This month' },
];

/**
 * Insights (J7 weekly review in architecture.md): rule-based findings with their evidence, two small
 * charts, and the rules still waiting for data. The window lives in the URL (?window=month).
 */
export function InsightsPage() {
  const [params] = useSearchParams();
  const window: InsightWindow = params.get('window') === 'month' ? 'MONTH' : 'WEEK';
  const insights = useInsights(window);

  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-4xl gap-5 px-4 py-6 lg:px-6">
      <header>
        <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Insights</h1>
        <p className="mt-1 text-ink-2">
          Patterns in your own data, each with the numbers and records behind it. No guesses: a rule without
          enough data stays quiet.
        </p>
      </header>

      <nav aria-label="Window" className="flex gap-1 border-b border-line">
        {WINDOWS.map((w) => (
          <Link
            key={w.id}
            to={w.id === 'WEEK' ? '?' : '?window=month'}
            replace
            aria-current={window === w.id ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium',
              window === w.id ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {w.label}
          </Link>
        ))}
      </nav>

      {insights.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Working out your insights…</span>
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : insights.isError ? (
        <ErrorState
          title="We couldn’t work out your insights."
          onRetry={() => void insights.refetch()}
          retrying={insights.isFetching}
          requestId={insights.error.problem.requestId}
        />
      ) : (
        <Results data={insights.data} />
      )}
    </div>
  );
}

function Results({ data }: { data: Insights }) {
  return (
    <>
      <p className="text-[13px] text-ink-3">
        {formatDay(data.from)} to {formatDay(data.to)} (today). Deadline and exam insights look ahead from
        today.
      </p>

      <section aria-labelledby="insights-found" className="grid gap-3">
        <h2 id="insights-found" className="text-[15px] font-semibold">
          {data.insights.length === 0
            ? 'Nothing to point out yet'
            : `${data.insights.length} ${data.insights.length === 1 ? 'insight' : 'insights'}`}
        </h2>
        {data.insights.length === 0 ? (
          <EmptyState
            title="Insights appear once NOVA has a week of your data."
            description="Plan tasks, add deadlines and exams, and mark attendance; the rules below say what each one needs."
          />
        ) : (
          <div className="grid gap-3">
            {data.insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Charts" className="grid gap-3 md:grid-cols-2">
        <DayBars
          title="Tasks done per day"
          description={`${formatDay(data.from)} to today`}
          barClass="fill-planner"
          bars={data.charts.tasksPerDay.map((d) => ({
            date: d.date,
            value: d.done,
            detail: `${d.done} done · ${d.planned} planned`,
          }))}
        />
        <DayBars
          title="Deadlines ahead"
          description="Open assignments and tasks due, next 14 days"
          barClass="fill-planner"
          markerLabel="Exam that day"
          markerClass="fill-academics"
          bars={data.charts.deadlinesPerDay.map((d) => ({
            date: d.date,
            value: d.deadlines,
            marked: d.exams > 0,
            detail:
              `${d.deadlines} ${d.deadlines === 1 ? 'deadline' : 'deadlines'}` +
              (d.exams > 0 ? ` · ${d.exams} ${d.exams === 1 ? 'exam' : 'exams'}` : ''),
          }))}
        />
      </section>

      {data.quiet.length > 0 && (
        <section aria-labelledby="insights-quiet" className="grid gap-2">
          <h2 id="insights-quiet" className="text-[15px] font-semibold">
            Waiting for more data
          </h2>
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {data.quiet.map((q) => (
              <li key={q.rule} className="grid gap-0.5 px-4 py-2.5 text-[13px]">
                <span className="font-medium text-ink">{q.title}</span>
                <span className="text-ink-2">{q.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
