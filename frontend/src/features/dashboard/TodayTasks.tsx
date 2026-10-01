import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { useTodayTasks } from '@/features/planner/api';
import { DeleteTaskDialog } from '@/features/planner/DeleteTaskDialog';
import { QuickAdd } from '@/features/planner/QuickAdd';
import { TaskDialog } from '@/features/planner/TaskDialog';
import { TaskItem } from '@/features/planner/TaskItem';
import type { Task } from '@/features/planner/types';

/** Shown on Home; the rest are a click away on the Tasks page. */
const VISIBLE = 6;

/** Today's open tasks in "what now?" order, ticked off in place, with a quick-add for more. */
export function TodayTasks({ today, timezone }: { today: string; timezone: string }) {
  const query = useTodayTasks();
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const open = query.data?.tasks ?? [];
  const done = query.data?.completed.length ?? 0;

  return (
    <section aria-labelledby="home-tasks" className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="home-tasks" className="text-[14px] font-semibold">
          Tasks
        </h3>
        <Link to="/app/planner/tasks" className="text-[12.5px] font-medium text-ink-2 hover:text-ink">
          All tasks
        </Link>
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <QuickAdd
        plannedFor={today}
        label="Add a task for today"
        onAdded={(t) => setAnnouncement(`Added “${t}”.`)}
      />
      {query.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading today’s tasks…</span>
          <Skeleton className="h-14" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="We couldn’t load today’s tasks."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          requestId={query.error.problem.requestId}
        />
      ) : (
        <>
          {open.length === 0 ? (
            <p className="text-[13px] text-ink-2">
              {done > 0
                ? 'All of today’s tasks are done.'
                : 'Nothing planned. Add what you mean to do today.'}
            </p>
          ) : (
            <ul aria-label="Today’s tasks" className="-mx-5 divide-y divide-line border-y border-line">
              {open.slice(0, VISIBLE).map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  today={today}
                  timezone={timezone}
                  showPlannedDay={false}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                  onChanged={setAnnouncement}
                />
              ))}
            </ul>
          )}
          {(open.length > VISIBLE || done > 0) && (
            <p className="text-[12.5px] text-ink-2">
              {open.length > VISIBLE && (
                <Link to="/app/planner/tasks" className="font-medium text-ink hover:underline">
                  {open.length - VISIBLE} more open
                </Link>
              )}
              {open.length > VISIBLE && done > 0 && ' · '}
              {done > 0 && `${done} done today`}
            </p>
          )}
        </>
      )}
      <TaskDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        timezone={timezone}
        task={editing ?? undefined}
        onSaved={(t) => setAnnouncement(`Saved “${t}”.`)}
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onDeleted={setAnnouncement} />
    </section>
  );
}
