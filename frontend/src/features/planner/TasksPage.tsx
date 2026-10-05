import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { useCourses, useSemesters } from '@/features/academics/api';
import { pickSemester } from '@/features/academics/selection';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { addDays, formatDay, todayIn } from '@/lib/dates';
import { useCompletedTasks, useTodayTasks, useUpcomingTasks } from './api';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { EditTask } from './EditTask';
import { QuickAdd } from './QuickAdd';
import { TaskDialog } from './TaskDialog';
import { TaskItem } from './TaskItem';
import { CATEGORIES, CATEGORY_LABEL, dayLabel } from './taskText';
import type { Task, TaskCategory } from './types';

type View = 'today' | 'upcoming' | 'done';
const VIEWS: { id: View; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'done', label: 'Done' },
];
const RANGES = [7, 14, 30];
const DONE_PAGE_SIZE = 20;

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Tasks in three views (J1 in architecture.md: "What should I do now?"). The view and filters live
 * in the URL, so a view can be bookmarked or linked to. Filters narrow Today and Upcoming.
 */
export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const today = todayIn(timezone);
  const semesters = useSemesters();
  const current = pickSemester(semesters.data ?? [], null);
  const courses = useCourses(current?.id);

  const viewParam = params.get('view');
  const view: View = viewParam === 'upcoming' || viewParam === 'done' ? viewParam : 'today';
  const category = (params.get('category') as TaskCategory | null) ?? undefined;
  const courseId = params.get('course') ?? undefined;
  // ?task=<id> opens that task (links from notifications and search)
  const linkedTask = params.get('task');
  const filtered = Boolean(category || courseId);
  const matches = (t: Task) =>
    (!category || t.category === category) && (!courseId || t.courseId === courseId);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const viewHref = (id: View) => {
    const next = new URLSearchParams(params);
    if (id === 'today') next.delete('view');
    else next.set('view', id);
    const query = next.toString();
    return query ? `?${query}` : '?';
  };

  const [dialog, setDialog] = useState<{ open: boolean; editing?: Task }>({ open: false });
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const item = (t: Task, showPlannedDay = true) => (
    <TaskItem
      key={t.id}
      task={t}
      today={today}
      timezone={timezone}
      showPlannedDay={showPlannedDay}
      onEdit={(x) => setDialog({ open: true, editing: x })}
      onDelete={setDeleting}
      onChanged={setAnnouncement}
    />
  );

  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-4xl gap-5 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Tasks</h1>
          <p className="mt-1 text-ink-2">What to do now, what’s coming, and what you’ve finished.</p>
        </div>
        <Button variant="primary" onClick={() => setDialog({ open: true })}>
          <Plus size={15} aria-hidden />
          New task
        </Button>
      </header>

      <nav aria-label="Task views" className="flex gap-1 border-b border-line">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            to={viewHref(v.id)}
            replace
            aria-current={view === v.id ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium',
              view === v.id ? 'border-planner text-ink' : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {view !== 'done' && (
        <section aria-label="Filters" className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Category"
            controlSize="sm"
            className="w-40"
            value={category ?? ''}
            onChange={(e) => update({ category: e.target.value })}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </SelectField>
          {(courses.data ?? []).length > 0 && (
            <SelectField
              label="Course"
              controlSize="sm"
              className="w-56"
              value={courseId ?? ''}
              onChange={(e) => update({ course: e.target.value })}
            >
              <option value="">All courses</option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} · ${c.name}` : c.name}
                </option>
              ))}
            </SelectField>
          )}
          {filtered && (
            <Button size="sm" variant="ghost" onClick={() => update({ category: null, course: null })}>
              Clear filters
            </Button>
          )}
        </section>
      )}

      {view === 'today' && (
        <TodayView
          today={today}
          matches={matches}
          filtered={filtered}
          renderItem={item}
          onAdded={(title) => setAnnouncement(`Added “${title}” for today.`)}
          onNew={() => setDialog({ open: true })}
        />
      )}
      {view === 'upcoming' && (
        <UpcomingView
          today={today}
          matches={matches}
          filtered={filtered}
          renderItem={item}
          onAdded={(title) => setAnnouncement(`Added “${title}” for tomorrow.`)}
        />
      )}
      {view === 'done' && <DoneView renderItem={item} />}

      <TaskDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        timezone={timezone}
        task={dialog.editing}
        initial={view === 'today' ? { plannedFor: today } : undefined}
        onSaved={(title) => setAnnouncement(`Saved “${title}”.`)}
      />
      <EditTask
        id={linkedTask}
        timezone={timezone}
        onClose={() => update({ task: null })}
        onSaved={(title) => setAnnouncement(`Saved “${title}”.`)}
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onDeleted={setAnnouncement} />
    </div>
  );
}

interface ViewProps {
  today: string;
  matches: (t: Task) => boolean;
  filtered: boolean;
  renderItem: (t: Task, showPlannedDay?: boolean) => ReactNode;
  onAdded: (title: string) => void;
}

function TodayView({
  today,
  matches,
  filtered,
  renderItem,
  onAdded,
  onNew,
}: ViewProps & { onNew: () => void }) {
  const query = useTodayTasks();
  return (
    <div className="grid gap-4">
      <QuickAdd plannedFor={today} label="Add a task for today" onAdded={onAdded} />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          title="We couldn’t load today’s tasks."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          requestId={query.error.problem.requestId}
        />
      ) : (
        (() => {
          const open = query.data.tasks.filter(matches);
          const done = query.data.completed.filter(matches);
          return (
            <>
              {open.length === 0 ? (
                filtered ? (
                  <EmptyState title="No open tasks for today match these filters." />
                ) : (
                  <EmptyState
                    title={done.length > 0 ? 'All done for today.' : 'Nothing planned for today.'}
                    description="Add what you mean to do today, or plan ahead in Upcoming."
                    action={
                      <Button size="sm" variant="primary" onClick={onNew}>
                        New task
                      </Button>
                    }
                  />
                )
              ) : (
                <TaskGroup id="today-open" title="To do" count={open.length}>
                  {open.map((t) => renderItem(t, false))}
                </TaskGroup>
              )}
              {done.length > 0 && (
                <TaskGroup id="today-done" title="Done today" count={done.length}>
                  {done.map((t) => renderItem(t, false))}
                </TaskGroup>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}

function UpcomingView({ today, matches, filtered, renderItem, onAdded }: ViewProps) {
  const [days, setDays] = useState(14);
  const query = useUpcomingTasks(days);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-60 flex-1">
          <QuickAdd plannedFor={addDays(today, 1)} label="Add a task for tomorrow" onAdded={onAdded} />
        </div>
        <SelectField
          label="Show"
          className="w-36"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {RANGES.map((n) => (
            <option key={n} value={n}>
              Next {n} days
            </option>
          ))}
        </SelectField>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          title="We couldn’t load upcoming tasks."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          requestId={query.error.problem.requestId}
        />
      ) : (
        (() => {
          const groups = query.data.days
            .map((d) => ({ date: d.date, tasks: d.tasks.filter(matches) }))
            .filter((d) => d.tasks.length > 0);
          const someday = query.data.unscheduled.filter(matches);
          if (groups.length === 0 && someday.length === 0) {
            return filtered ? (
              <EmptyState title="No upcoming tasks match these filters." />
            ) : (
              <EmptyState
                title="Nothing planned yet."
                description="Tasks with a future day or deadline show up here, grouped by day."
              />
            );
          }
          return (
            <>
              {groups.map((d) => {
                const label = dayLabel(d.date, today);
                return (
                  <TaskGroup
                    key={d.date}
                    id={`day-${d.date}`}
                    title={label === formatDay(d.date) ? label : `${label} · ${formatDay(d.date)}`}
                    count={d.tasks.length}
                  >
                    {d.tasks.map((t) => renderItem(t, false))}
                  </TaskGroup>
                );
              })}
              {someday.length > 0 && (
                <TaskGroup id="someday" title="Someday" count={someday.length} note="No day or deadline yet">
                  {someday.map((t) => renderItem(t))}
                </TaskGroup>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}

function DoneView({ renderItem }: { renderItem: (t: Task) => ReactNode }) {
  const [page, setPage] = useState(0);
  const query = useCompletedTasks(page, DONE_PAGE_SIZE);
  if (query.isPending) return <Loading />;
  if (query.isError) {
    return (
      <ErrorState
        title="We couldn’t load finished tasks."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        requestId={query.error.problem.requestId}
      />
    );
  }
  if (query.data.totalItems === 0) {
    return <EmptyState title="Nothing finished yet." description="Tick a task off and it lands here." />;
  }
  return (
    <div className="grid gap-2">
      <TaskGroup id="done" title="Finished, most recent first" count={query.data.totalItems}>
        {query.data.items.map((t) => renderItem(t))}
      </TaskGroup>
      {query.data.totalPages > 1 && (
        <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Newer
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
            Older
          </Button>
        </div>
      )}
    </div>
  );
}

function TaskGroup({
  id,
  title,
  count,
  note,
  children,
}: {
  id: string;
  title: string;
  count: number;
  note?: string;
  children: ReactNode;
}) {
  const headingId = `group-${id}`;
  return (
    <section aria-labelledby={headingId} className="rounded-md border border-line bg-surface">
      <h2
        id={headingId}
        className="flex flex-wrap items-baseline gap-2 border-b border-line px-4 py-2.5 text-[14px] font-semibold text-ink"
      >
        {title} <span className="font-mono text-[12px] font-normal tabular text-ink-3">{count}</span>
        {note && <span className="text-[12.5px] font-normal text-ink-3">{note}</span>}
      </h2>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

function Loading() {
  return (
    <div role="status" aria-busy="true" className="grid gap-3">
      <span className="sr-only">Loading your tasks…</span>
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}
