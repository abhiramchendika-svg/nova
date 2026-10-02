import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { formatDay } from '@/lib/dates';
import { GoalDialog } from './GoalDialog';
import { useGoals } from './learningApi';
import { GOAL_STATUS_LABEL, GOAL_STATUSES } from './projectText';
import type { GoalStatus, LearningGoal } from './types';

/** Learning goals by status, each with its progress ring and what's next. */
export function LearningPage() {
  const goals = useGoals();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const byStatus = new Map<GoalStatus, LearningGoal[]>();
  for (const g of goals.data ?? []) byStatus.set(g.status, [...(byStatus.get(g.status) ?? []), g]);

  return (
    <div className="animate-enter mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Learning</h1>
          <p className="mt-1 text-ink-2">What you’re learning, topic by topic.</p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden />
          New goal
        </Button>
      </header>

      {goals.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-3 md:grid-cols-2">
          <span className="sr-only">Loading your learning goals…</span>
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : goals.isError ? (
        <ErrorState
          title="We couldn’t load your learning goals."
          onRetry={() => void goals.refetch()}
          retrying={goals.isFetching}
          requestId={goals.error.problem.requestId}
        />
      ) : goals.data.length === 0 ? (
        <EmptyState
          title="Know what you’re building toward."
          description="Add something you’re learning and break it into topics; tick them off as you go."
          action={
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              Add a goal
            </Button>
          }
        />
      ) : (
        GOAL_STATUSES.filter((s) => byStatus.has(s)).map((status) => {
          const id = `goals-${status.toLowerCase()}`;
          const list = byStatus.get(status)!;
          return (
            <section key={status} aria-labelledby={id} className="grid gap-3">
              <h2 id={id} className="flex items-baseline gap-2 text-[15px] font-semibold">
                {GOAL_STATUS_LABEL[status]}{' '}
                <span className="font-mono text-[12px] font-normal tabular text-ink-3">{list.length}</span>
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </div>
            </section>
          );
        })
      )}

      <GoalDialog
        open={adding}
        onOpenChange={setAdding}
        onSaved={(g) => void navigate(`/app/developer/learning/${g.id}`)}
      />
    </div>
  );
}

function GoalCard({ goal: g }: { goal: LearningGoal }) {
  const headingId = `goal-${g.id}`;
  return (
    <article
      aria-labelledby={headingId}
      className="flex items-start gap-4 rounded-md border border-line bg-surface p-4"
    >
      <ProgressRing
        value={g.progress.percentage}
        label={`${g.title}: ${g.progress.done} of ${g.progress.total} topics`}
        domain="developer"
      />
      <div className="grid min-w-0 gap-1">
        <h3 id={headingId} className="text-[15px] font-semibold leading-snug">
          <Link to={`/app/developer/learning/${g.id}`} className="hover:underline">
            {g.title}
          </Link>
        </h3>
        <p className="text-[12.5px] text-ink-2">
          {g.progress.total === 0 ? 'No topics yet' : `${g.progress.done} of ${g.progress.total} topics`}
          {g.targetOn && <> · by {formatDay(g.targetOn)}</>}
        </p>
        {g.nextTopic && g.status !== 'DONE' && (
          <p className="text-[12.5px] text-ink-2">
            Next: <span className="text-ink">{g.nextTopic.title}</span>
          </p>
        )}
        {g.openTasks > 0 && (
          <p className="text-[12.5px] text-ink-3">
            {g.openTasks} open study {g.openTasks === 1 ? 'task' : 'tasks'}
          </p>
        )}
      </div>
    </article>
  );
}
