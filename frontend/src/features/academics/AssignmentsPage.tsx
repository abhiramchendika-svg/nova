import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { useSettings } from '@/features/settings/api';
import { useAssignments, useCourses, useSemesters } from './api';
import { AssignmentDialog } from './AssignmentDialog';
import { AssignmentItem } from './AssignmentItem';
import { PRIORITY_LABEL, STATUS_LABEL, URGENCY_HEADING, URGENCY_ORDER } from './assignmentText';
import { DeleteAssignmentDialog } from './DeleteAssignmentDialog';
import { pickSemester } from './selection';
import type { Assignment, AssignmentFilter, AssignmentPriority, AssignmentStatus, Urgency } from './types';

const OPEN: AssignmentStatus[] = ['NOT_STARTED', 'IN_PROGRESS'];
const FINISHED: AssignmentStatus[] = ['SUBMITTED', 'COMPLETED'];
/** The backend's largest page. More open work than this is unusual; the page says so if it happens. */
const OPEN_LIMIT = 100;
const DONE_PAGE_SIZE = 10;

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Assignments, grouped by how soon they're due (J2 in architecture.md: "What's due next?").
 * Filters live in the URL, so a filtered view can be bookmarked or linked from a course page.
 */
export function AssignmentsPage() {
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const semesters = useSemesters();
  const current = pickSemester(semesters.data ?? [], null);
  const courses = useCourses(current?.id);

  const courseId = params.get('course') ?? undefined;
  const priority = (params.get('priority') as AssignmentPriority | null) ?? undefined;
  const statusParam = params.get('status') as AssignmentStatus | null;
  const status = statusParam && OPEN.includes(statusParam) ? statusParam : undefined;
  const filtered = Boolean(courseId || priority || status);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const open = useAssignments({
    status: status ? [status] : OPEN,
    courseId,
    priority,
    sort: 'dueAt,asc',
    size: OPEN_LIMIT,
  });

  const [dialog, setDialog] = useState<{ open: boolean; editing?: Assignment }>({ open: false });
  const [deleting, setDeleting] = useState<Assignment | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const choices = courses.data ?? [];
  const noCourses = !semesters.isPending && (!current || (!courses.isPending && choices.length === 0));

  const groups = new Map<Urgency, Assignment[]>();
  for (const a of open.data?.items ?? []) {
    const key = a.urgency ?? 'LATER';
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  const item = (a: Assignment) => (
    <AssignmentItem
      key={a.id}
      assignment={a}
      timezone={timezone}
      onEdit={(x) => setDialog({ open: true, editing: x })}
      onDelete={setDeleting}
      onChanged={setAnnouncement}
    />
  );

  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-4xl gap-5 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Assignments</h1>
          <p className="mt-1 text-ink-2">What’s due, soonest first. Times are in your time zone.</p>
        </div>
        {choices.length > 0 && (
          <Button variant="primary" onClick={() => setDialog({ open: true })}>
            <Plus size={15} aria-hidden />
            Add assignment
          </Button>
        )}
      </header>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {semesters.isPending || (current && courses.isPending) ? (
        <Loading />
      ) : semesters.isError || courses.isError ? (
        <ErrorState
          title="We couldn’t load your courses."
          onRetry={() => {
            void semesters.refetch();
            void courses.refetch();
          }}
          requestId={(semesters.error ?? courses.error)?.problem.requestId}
        />
      ) : noCourses ? (
        <EmptyState
          title="Assignments belong to a course."
          description="Add your current semester and its courses first."
          action={
            <ButtonLink to="/app/academics/courses" size="sm" variant="primary">
              Go to courses
            </ButtonLink>
          }
        />
      ) : (
        <>
          <section aria-label="Filters" className="flex flex-wrap items-end gap-3">
            <SelectField
              label="Course"
              controlSize="sm"
              className="w-56"
              value={courseId ?? ''}
              onChange={(e) => setFilter('course', e.target.value)}
            >
              <option value="">All courses</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} · ${c.name}` : c.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Status"
              controlSize="sm"
              className="w-40"
              value={status ?? ''}
              onChange={(e) => setFilter('status', e.target.value)}
            >
              <option value="">All open</option>
              {OPEN.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Priority"
              controlSize="sm"
              className="w-36"
              value={priority ?? ''}
              onChange={(e) => setFilter('priority', e.target.value)}
            >
              <option value="">Any</option>
              {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </SelectField>
            {filtered && (
              <Button size="sm" variant="ghost" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </Button>
            )}
          </section>

          {open.isPending ? (
            <Loading />
          ) : open.isError ? (
            <ErrorState
              title="We couldn’t load your assignments."
              onRetry={() => void open.refetch()}
              retrying={open.isFetching}
              requestId={open.error.problem.requestId}
            />
          ) : open.data.totalItems === 0 ? (
            filtered ? (
              <EmptyState
                title="No open assignments match these filters."
                action={
                  <Button size="sm" onClick={() => setParams({}, { replace: true })}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="Nothing due yet. Enjoy the breathing room."
                description="Add coursework as it’s set, and NOVA keeps it in order by due date."
                action={
                  <Button size="sm" variant="primary" onClick={() => setDialog({ open: true })}>
                    Add assignment
                  </Button>
                }
              />
            )
          ) : (
            <div className="grid gap-4">
              {URGENCY_ORDER.filter((u) => groups.has(u)).map((u) => (
                <Group key={u} urgency={u} count={groups.get(u)!.length}>
                  {groups.get(u)!.map(item)}
                </Group>
              ))}
              {open.data.totalItems > OPEN_LIMIT && (
                <p className="text-[12.5px] text-ink-2">
                  Showing the first {OPEN_LIMIT} of {open.data.totalItems} open assignments. Filter by course
                  to see the rest.
                </p>
              )}
            </div>
          )}

          <FinishedWork filter={{ courseId, priority }} renderItem={item} hidden={Boolean(status)} />
        </>
      )}

      <AssignmentDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        courses={choices}
        timezone={timezone}
        assignment={dialog.editing}
        defaultCourseId={courseId}
      />
      <DeleteAssignmentDialog assignment={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function Loading() {
  return (
    <div role="status" aria-busy="true" className="grid gap-3">
      <span className="sr-only">Loading your assignments…</span>
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}

function Group({ urgency, count, children }: { urgency: Urgency; count: number; children: ReactNode }) {
  const id = `group-${urgency.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="rounded-md border border-line bg-surface">
      <h2
        id={id}
        className={
          'flex items-baseline gap-2 border-b border-line px-4 py-2.5 text-[14px] font-semibold ' +
          (urgency === 'OVERDUE' ? 'text-critical' : 'text-ink')
        }
      >
        {URGENCY_HEADING[urgency]}{' '}
        <span className="font-mono text-[12px] font-normal tabular text-ink-3">{count}</span>
      </h2>
      <ul className="@container divide-y divide-line">{children}</ul>
    </section>
  );
}

/** Submitted and completed work, most recent due date first, loaded only when opened. */
function FinishedWork({
  filter,
  renderItem,
  hidden,
}: {
  filter: Pick<AssignmentFilter, 'courseId' | 'priority'>;
  renderItem: (a: Assignment) => ReactNode;
  hidden: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const done = useAssignments(
    { ...filter, status: FINISHED, sort: 'dueAt,desc', page, size: DONE_PAGE_SIZE },
    expanded && !hidden,
  );
  if (hidden) return null;
  return (
    <section aria-labelledby="done-heading" className="grid gap-3">
      <div className="flex items-center gap-2">
        <h2 id="done-heading" className="text-[14px] font-semibold text-ink">
          Done
        </h2>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={expanded}
          aria-controls="done-list"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide' : 'Show submitted and completed'}
        </Button>
      </div>
      {expanded && (
        <div id="done-list">
          {done.isPending ? (
            <Skeleton className="h-16" />
          ) : done.isError ? (
            <ErrorState
              title="We couldn’t load finished work."
              onRetry={() => void done.refetch()}
              requestId={done.error.problem.requestId}
            />
          ) : done.data.totalItems === 0 ? (
            <p className="text-[13px] text-ink-2">Nothing submitted or completed yet.</p>
          ) : (
            <div className="grid gap-2">
              <ul
                aria-label="Submitted and completed assignments"
                className="@container divide-y divide-line rounded-md border border-line bg-surface"
              >
                {done.data.items.map(renderItem)}
              </ul>
              {done.data.totalPages > 1 && (
                <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Newer
                  </Button>
                  <span>
                    Page {page + 1} of {done.data.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page + 1 >= done.data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Older
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
