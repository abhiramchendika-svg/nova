import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useTasks } from '@/features/planner/api';
import { DeleteTaskDialog } from '@/features/planner/DeleteTaskDialog';
import { studyTitle } from '@/features/planner/revisionPlan';
import { StudyPlanDialog } from '@/features/planner/StudyPlanDialog';
import { TaskDialog } from '@/features/planner/TaskDialog';
import { TaskItem } from '@/features/planner/TaskItem';
import type { Task } from '@/features/planner/types';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { addDays, formatDay, todayIn } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { GoalDialog } from './GoalDialog';
import {
  useAddResource,
  useAddTopic,
  useDeleteGoal,
  useDeleteResource,
  useDeleteTopic,
  useEditResource,
  useGoal,
  usePatchTopic,
} from './learningApi';
import { ExternalLinkText } from './ProjectCard';
import { GOAL_STATUS_LABEL } from './projectText';
import { resourceSchema, topicTitle } from './schemas';
import type { LearningGoal, LearningResource, LearningTopic } from './types';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
/** Without a target date, "Plan my learning" spreads topics over the next two weeks. */
const DEFAULT_PLAN_DAYS = 14;

/** One learning goal: its topic checklist, links, and the study tasks planned from it. */
export function GoalPage() {
  const { goalId = '' } = useParams();
  const goal = useGoal(goalId);

  if (goal.isPending) {
    return (
      <Shell>
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading the goal…</span>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-48" />
        </div>
      </Shell>
    );
  }
  if (goal.isError) {
    return (
      <Shell>
        {goal.error.status === 404 ? (
          <EmptyState
            title="We couldn’t find that goal."
            description="It may have been deleted, or the link is wrong."
            action={
              <ButtonLink to="/app/developer/learning" size="sm" variant="primary">
                Back to learning
              </ButtonLink>
            }
          />
        ) : (
          <ErrorState
            title="We couldn’t load this goal."
            onRetry={() => void goal.refetch()}
            retrying={goal.isFetching}
            requestId={goal.error.problem.requestId}
          />
        )}
      </Shell>
    );
  }
  return <GoalView goal={goal.data} />;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="animate-enter mx-auto grid max-w-4xl gap-5 px-4 py-6 lg:px-6">{children}</div>;
}

function GoalView({ goal: g }: { goal: LearningGoal }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useDeleteGoal();

  return (
    <Shell>
      <div>
        <Link
          to="/app/developer/learning"
          className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={14} aria-hidden />
          Learning
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <ProgressRing
            value={g.progress.percentage}
            size={64}
            domain="developer"
            label={`${g.progress.done} of ${g.progress.total} topics learned`}
          />
          <div className="grid min-w-0 gap-1">
            <p>
              <Badge tone={g.status === 'ACTIVE' ? 'developer' : g.status === 'DONE' ? 'good' : 'neutral'}>
                {GOAL_STATUS_LABEL[g.status]}
              </Badge>
            </p>
            <h1 className="break-words font-display text-[24px] font-semibold tracking-[-0.01em]">
              {g.title}
            </h1>
            <p className="text-[13px] text-ink-2">
              {g.progress.total === 0 ? 'No topics yet' : `${g.progress.done} of ${g.progress.total} topics`}
              {g.targetOn && <> · by {formatDay(g.targetOn)}</>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditing(true)}>
            <Pencil size={14} aria-hidden />
            Edit goal
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(true)}>
            <Trash2 size={14} aria-hidden />
            Delete
          </Button>
        </div>
      </header>

      {g.description && (
        <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{g.description}</p>
      )}

      <Topics goal={g} />
      <Resources goal={g} />
      <StudyTasks goal={g} />

      <GoalDialog open={editing} onOpenChange={setEditing} goal={g} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) remove.reset();
        }}
        title="Delete this goal?"
        description={
          <>
            <strong className="text-ink">{g.title}</strong>, its topics and links will be removed. Its study
            tasks stay, without the goal. This can’t be undone.
          </>
        }
        confirmLabel="Delete goal"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() =>
          remove.mutate(g.id, { onSuccess: () => navigate('/app/developer/learning', { replace: true }) })
        }
      />
    </Shell>
  );
}

function Topics({ goal: g }: { goal: LearningGoal }) {
  const patch = usePatchTopic();
  const removeTopic = useDeleteTopic();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const busy = patch.isPending || removeTopic.isPending;
  const total = g.topics.length;
  const error = patch.error ?? removeTopic.error;

  const move = (t: LearningTopic, to: number) =>
    patch.mutate(
      { goalId: g.id, topicId: t.id, position: to },
      { onSuccess: () => setAnnouncement(`Moved “${t.title}” to position ${to + 1} of ${total}.`) },
    );

  return (
    <Panel title="Topics" domain="developer">
      <div className="grid gap-4">
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {error && <p className="text-[13px] text-critical">{errorMessage(error)}</p>}
        {total === 0 ? (
          <p className="text-[13px] leading-relaxed text-ink-2">
            Break the goal into topics, then tick each one off as you learn it.
          </p>
        ) : (
          <ol aria-label="Topics" className="-mx-5 divide-y divide-line border-y border-line">
            {g.topics.map((t, i) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 px-5 py-2">
                {renamingId === t.id ? (
                  <RenameTopic
                    topic={t}
                    pending={patch.isPending}
                    onCancel={() => setRenamingId(null)}
                    onSave={(title) =>
                      patch.mutate(
                        { goalId: g.id, topicId: t.id, title },
                        { onSuccess: () => setRenamingId(null) },
                      )
                    }
                  />
                ) : (
                  <>
                    <Checkbox
                      className="min-w-0 flex-1"
                      label={
                        <span className={cn(t.done && 'text-ink-2 line-through decoration-ink-3')}>
                          {t.title}
                        </span>
                      }
                      checked={t.done}
                      disabled={busy}
                      onChange={(e) => patch.mutate({ goalId: g.id, topicId: t.id, done: e.target.checked })}
                    />
                    <div className="flex items-center">
                      <IconButton label={`Rename ${t.title}`} onClick={() => setRenamingId(t.id)}>
                        <Pencil size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Move ${t.title} up`}
                        disabled={busy || i === 0}
                        className="disabled:opacity-40"
                        onClick={() => move(t, i - 1)}
                      >
                        <ArrowUp size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Move ${t.title} down`}
                        disabled={busy || i === total - 1}
                        className="disabled:opacity-40"
                        onClick={() => move(t, i + 1)}
                      >
                        <ArrowDown size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Delete ${t.title}`}
                        disabled={busy}
                        onClick={() =>
                          removeTopic.mutate(
                            { goalId: g.id, topicId: t.id },
                            { onSuccess: () => setAnnouncement(`Removed “${t.title}”.`) },
                          )
                        }
                      >
                        <Trash2 size={15} aria-hidden />
                      </IconButton>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        <AddTopic goalId={g.id} />
      </div>
    </Panel>
  );
}

function RenameTopic({
  topic,
  pending,
  onSave,
  onCancel,
}: {
  topic: LearningTopic;
  pending: boolean;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(topic.title);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = topicTitle.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Name the topic.');
      return;
    }
    if (parsed.data === topic.title) onCancel();
    else onSave(parsed.data);
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-wrap items-start gap-2" noValidate>
      <Field
        ref={inputRef}
        label={`New name for ${topic.title}`}
        className="min-w-48 flex-1"
        value={value}
        error={error ?? undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      <div className="flex gap-2 pt-[26px]">
        <Button type="submit" size="sm" variant="primary" loading={pending}>
          Save
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AddTopic({ goalId }: { goalId: string }) {
  const add = useAddTopic();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = topicTitle.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Name the topic.');
      return;
    }
    add.mutate({ goalId, title: parsed.data }, { onSuccess: () => setValue('') });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-2">
      <Field
        label="Add a topic"
        placeholder="e.g. Spring Security"
        className="min-w-48 flex-1"
        value={value}
        error={error ?? (add.isError ? errorMessage(add.error) : undefined)}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
          add.reset();
        }}
      />
      <Button type="submit" className="mt-[26px]" loading={add.isPending}>
        Add topic
      </Button>
    </form>
  );
}

function Resources({ goal: g }: { goal: LearningGoal }) {
  const remove = useDeleteResource();
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <Panel title="Links" domain="developer">
      <div className="grid gap-4">
        {remove.isError && <p className="text-[13px] text-critical">{errorMessage(remove.error)}</p>}
        {g.resources.length === 0 ? (
          <p className="text-[13px] text-ink-2">Keep the docs, course or videos you’re following here.</p>
        ) : (
          <ul aria-label="Links" className="-mx-5 divide-y divide-line border-y border-line">
            {g.resources.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-5 py-2">
                {editingId === r.id ? (
                  <ResourceForm goalId={g.id} resource={r} onDone={() => setEditingId(null)} />
                ) : (
                  <>
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-[13.5px] text-ink">{r.title}</span>
                      <span className="text-[12.5px]">
                        <ExternalLinkText href={r.url} label="Open" />
                      </span>
                    </div>
                    <IconButton label={`Edit ${r.title}`} onClick={() => setEditingId(r.id)}>
                      <Pencil size={15} aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Delete ${r.title}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ goalId: g.id, resourceId: r.id })}
                    >
                      <Trash2 size={15} aria-hidden />
                    </IconButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <ResourceForm goalId={g.id} />
      </div>
    </Panel>
  );
}

/** Add a link, or (with {@code resource}) edit one in place. */
function ResourceForm({
  goalId,
  resource,
  onDone,
}: {
  goalId: string;
  resource?: LearningResource;
  onDone?: () => void;
}) {
  const add = useAddResource();
  const edit = useEditResource();
  const mutation = resource ? edit : add;
  const [title, setTitle] = useState(resource?.title ?? '');
  const [url, setUrl] = useState(resource?.url ?? '');
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = resourceSchema.safeParse({ title, url });
    if (!parsed.success) {
      const next: { title?: string; url?: string } = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as 'title' | 'url'] ??= issue.message;
      setErrors(next);
      return;
    }
    const options = {
      onSuccess: () => {
        if (!resource) {
          setTitle('');
          setUrl('');
        }
        onDone?.();
      },
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        const next: { title?: string; url?: string } = {};
        for (const fe of error.fieldErrors)
          if (fe.field === 'title' || fe.field === 'url') next[fe.field] = fe.message;
        setErrors(next);
      },
    };
    if (resource) edit.mutate({ goalId, resourceId: resource.id, body: parsed.data }, options);
    else add.mutate({ goalId, body: parsed.data }, options);
  };

  const otherError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  return (
    <form onSubmit={submit} noValidate className="grid w-full gap-2">
      <div className="flex flex-wrap items-start gap-2">
        <Field
          label={resource ? `Title for ${resource.title}` : 'Link title'}
          placeholder={resource ? undefined : 'Official docs'}
          className="min-w-40 flex-1"
          value={title}
          error={errors.title}
          onChange={(e) => {
            setTitle(e.target.value);
            setErrors((x) => ({ ...x, title: undefined }));
          }}
        />
        <Field
          label={resource ? `Address for ${resource.title}` : 'Web address'}
          type="url"
          inputMode="url"
          placeholder={resource ? undefined : 'https://…'}
          className="min-w-52 flex-[2]"
          value={url}
          error={errors.url}
          onChange={(e) => {
            setUrl(e.target.value);
            setErrors((x) => ({ ...x, url: undefined }));
          }}
        />
        <div className="flex gap-2 pt-[26px]">
          <Button
            type="submit"
            size={resource ? 'sm' : 'md'}
            variant={resource ? 'primary' : 'secondary'}
            loading={mutation.isPending}
          >
            {resource ? 'Save' : 'Add link'}
          </Button>
          {resource && (
            <Button size="sm" onClick={onDone}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      {otherError && <p className="text-[12.5px] text-critical">{otherError}</p>}
    </form>
  );
}

const LIMIT = 100;

function StudyTasks({ goal: g }: { goal: LearningGoal }) {
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const today = todayIn(timezone);
  const query = useTasks({ learningGoalId: g.id, sort: 'plannedFor,asc', size: LIMIT });
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Task }>({ open: false });
  const [planning, setPlanning] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const tasks = query.data?.items ?? [];
  const ordered = [...tasks.filter((t) => t.status !== 'DONE'), ...tasks.filter((t) => t.status === 'DONE')];
  const endDay = g.targetOn ? addDays(g.targetOn, 1) : addDays(today, DEFAULT_PLAN_DAYS);

  return (
    <Panel
      title="Study plan"
      domain="planner"
      action={
        <>
          <Button size="sm" onClick={() => setPlanning(true)}>
            <Sparkles size={14} aria-hidden />
            Plan my learning
          </Button>
          <Button size="sm" onClick={() => setDialog({ open: true })}>
            <Plus size={14} aria-hidden />
            Add study task
          </Button>
        </>
      }
    >
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {query.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading study tasks…</span>
          <Skeleton className="h-16" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="We couldn’t load the study plan."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          requestId={query.error.problem.requestId}
        />
      ) : ordered.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-ink-2">
          No study tasks yet. “Plan my learning” turns the unfinished topics into tasks spread over the days
          until {g.targetOn ? 'your target date' : 'two weeks from now'}.
        </p>
      ) : (
        <ul aria-label="Study tasks" className="-mx-5 divide-y divide-line border-y border-line">
          {ordered.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              today={today}
              timezone={timezone}
              showGoal={false}
              onEdit={(x) => setDialog({ open: true, editing: x })}
              onDelete={setDeleting}
              onChanged={setAnnouncement}
            />
          ))}
        </ul>
      )}

      <TaskDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        timezone={timezone}
        task={dialog.editing}
        initial={{ learningGoalId: g.id, category: 'CODING' }}
        onSaved={(title) => setAnnouncement(`Saved “${title}”.`)}
      />
      <StudyPlanDialog
        open={planning}
        onOpenChange={setPlanning}
        title="Plan your learning"
        topics={g.topics}
        existingTitles={tasks.map((t) => t.title)}
        endDay={endDay}
        endLabel={g.targetOn ? 'your target date' : 'two weeks from today'}
        emptyChecklist="Add topics first, then plan them here."
        noDaysLeft="The target date has passed. Move it later to plan the remaining topics."
        toRequest={(topic, plannedFor, estimatedMinutes) => ({
          title: studyTitle(topic),
          description: null,
          category: 'CODING',
          priority: 'MEDIUM',
          plannedFor,
          plannedStart: null,
          dueAt: null,
          estimatedMinutes,
          recurrence: 'NONE',
          courseId: null,
          examId: null,
          projectId: null,
          learningGoalId: g.id,
          hackathonId: null,
          internshipId: null,
        })}
        timezone={timezone}
        onSaved={(count) =>
          setAnnouncement(count === 1 ? 'Added 1 study task.' : `Added ${count} study tasks.`)
        }
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onDeleted={setAnnouncement} />
    </Panel>
  );
}
