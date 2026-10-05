import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { Progress } from '@/components/ui/Progress';
import { useTasks } from '@/features/planner/api';
import { DeleteTaskDialog } from '@/features/planner/DeleteTaskDialog';
import { TaskDialog } from '@/features/planner/TaskDialog';
import { TaskItem } from '@/features/planner/TaskItem';
import type { Task } from '@/features/planner/types';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { formatDay, todayIn } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import {
  useAddMilestone,
  useDeleteMilestone,
  useDeleteProject,
  useEditMilestone,
  usePatchMilestone,
  useProject,
} from './api';
import { ExternalLinkText } from './ProjectCard';
import { ProjectDialog } from './ProjectDialog';
import { RepoStats } from './RepoStats';
import { STATUS_LABEL, STATUS_TONE } from './projectText';
import { milestoneTitle } from './schemas';
import type { Milestone, Project } from './types';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** One project: its details, a milestone checklist that drives progress, and its tasks. */
export function ProjectPage() {
  const { projectId = '' } = useParams();
  const project = useProject(projectId);

  if (project.isPending) {
    return (
      <Shell>
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading the project…</span>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-48" />
        </div>
      </Shell>
    );
  }
  if (project.isError) {
    return (
      <Shell>
        {project.error.status === 404 ? (
          <EmptyState
            title="We couldn’t find that project."
            titleAs="h1"
            description="It may have been deleted, or the link is wrong."
            action={
              <ButtonLink to="/app/developer/projects" size="sm" variant="primary">
                Back to projects
              </ButtonLink>
            }
          />
        ) : (
          <ErrorState
            title="We couldn’t load this project."
            titleAs="h1"
            onRetry={() => void project.refetch()}
            retrying={project.isFetching}
            requestId={project.error.problem.requestId}
          />
        )}
      </Shell>
    );
  }
  return <ProjectView project={project.data} />;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-4xl gap-5 px-4 py-6 lg:px-6">{children}</div>
  );
}

function ProjectView({ project: p }: { project: Project }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useDeleteProject();

  const dates = [
    p.startedOn && `Started ${formatDay(p.startedOn)}`,
    p.targetOn && `Target ${formatDay(p.targetOn)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Shell>
      <div>
        <Link
          to="/app/developer/projects"
          className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={14} aria-hidden />
          Projects
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <p>
            <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
          </p>
          <h1 className="break-words font-display text-[24px] font-semibold tracking-[-0.01em]">{p.name}</h1>
          {dates && <p className="text-[13px] text-ink-2">{dates}</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditing(true)}>
            <Pencil size={14} aria-hidden />
            Edit project
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(true)}>
            <Trash2 size={14} aria-hidden />
            Delete
          </Button>
        </div>
      </header>

      {(p.description || p.techStack.length > 0 || p.repoUrl || p.demoUrl) && (
        <Panel title="About" domain="developer">
          <div className="grid gap-3">
            {p.description && (
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{p.description}</p>
            )}
            {p.techStack.length > 0 && (
              <ul aria-label="Tech stack" className="flex flex-wrap gap-1.5">
                {p.techStack.map((t) => (
                  <li
                    key={t}
                    className="tint-developer rounded-xs px-2 py-0.5 text-[12.5px] text-developer-text"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            )}
            {(p.repoUrl || p.demoUrl) && (
              <p className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                {p.repoUrl && <ExternalLinkText href={p.repoUrl} label="Code" />}
                {p.demoUrl && <ExternalLinkText href={p.demoUrl} label="Demo" />}
              </p>
            )}
            <RepoStats repoUrl={p.repoUrl} />
          </div>
        </Panel>
      )}

      <Milestones project={p} />
      <ProjectTasks project={p} />

      <ProjectDialog open={editing} onOpenChange={setEditing} project={p} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) remove.reset();
        }}
        title="Delete this project?"
        description={
          <>
            <strong className="text-ink">{p.name}</strong> and its milestones will be removed. Its tasks stay,
            without the project. This can’t be undone.
          </>
        }
        confirmLabel="Delete project"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() =>
          remove.mutate(p.id, { onSuccess: () => navigate('/app/developer/projects', { replace: true }) })
        }
      />
    </Shell>
  );
}

function Milestones({ project: p }: { project: Project }) {
  const patch = usePatchMilestone();
  const removeMilestone = useDeleteMilestone();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const busy = patch.isPending || removeMilestone.isPending;
  const total = p.milestones.length;
  const error = patch.error ?? removeMilestone.error;

  const move = (m: Milestone, to: number) =>
    patch.mutate(
      { projectId: p.id, milestoneId: m.id, position: to },
      { onSuccess: () => setAnnouncement(`Moved “${m.title}” to position ${to + 1} of ${total}.`) },
    );

  return (
    <Panel title="Milestones" domain="developer">
      <div className="grid gap-4">
        {p.progress.percentage !== null && (
          <Progress
            value={p.progress.percentage}
            label={`${p.progress.done} of ${p.progress.total} milestones done`}
            domain="developer"
          />
        )}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {error && <p className="text-[13px] text-critical">{errorMessage(error)}</p>}
        {total === 0 ? (
          <p className="text-[13px] leading-relaxed text-ink-2">
            Break the project into milestones. Ticking them off is how its progress is measured.
          </p>
        ) : (
          <ol aria-label="Milestones" className="-mx-5 divide-y divide-line border-y border-line">
            {p.milestones.map((m, i) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-5 py-2">
                {editingId === m.id ? (
                  <MilestoneForm projectId={p.id} milestone={m} onDone={() => setEditingId(null)} />
                ) : (
                  <>
                    <Checkbox
                      className="min-w-0 flex-1"
                      label={
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className={cn(m.done && 'text-ink-2 line-through decoration-ink-3')}>
                            {m.title}
                          </span>
                          {m.dueOn && (
                            <span className={cn('text-[12px]', m.overdue ? 'text-critical' : 'text-ink-3')}>
                              {m.overdue ? 'was due' : 'due'} {formatDay(m.dueOn)}
                            </span>
                          )}
                        </span>
                      }
                      checked={m.done}
                      disabled={busy}
                      onChange={(e) =>
                        patch.mutate(
                          { projectId: p.id, milestoneId: m.id, done: e.target.checked },
                          {
                            onSuccess: () =>
                              setAnnouncement(
                                e.target.checked ? `Done: “${m.title}”.` : `“${m.title}” is open again.`,
                              ),
                          },
                        )
                      }
                    />
                    <div className="flex items-center">
                      <IconButton label={`Edit ${m.title}`} onClick={() => setEditingId(m.id)}>
                        <Pencil size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Move ${m.title} up`}
                        disabled={busy || i === 0}
                        className="disabled:opacity-40"
                        onClick={() => move(m, i - 1)}
                      >
                        <ArrowUp size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Move ${m.title} down`}
                        disabled={busy || i === total - 1}
                        className="disabled:opacity-40"
                        onClick={() => move(m, i + 1)}
                      >
                        <ArrowDown size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Delete ${m.title}`}
                        disabled={busy}
                        onClick={() =>
                          removeMilestone.mutate(
                            { projectId: p.id, milestoneId: m.id },
                            { onSuccess: () => setAnnouncement(`Removed “${m.title}”.`) },
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
        <MilestoneForm projectId={p.id} onDone={() => setAnnouncement('Milestone added.')} />
      </div>
    </Panel>
  );
}

/** Add a milestone, or (with {@code milestone}) edit its title and due date in place. */
function MilestoneForm({
  projectId,
  milestone,
  onDone,
}: {
  projectId: string;
  milestone?: Milestone;
  onDone: () => void;
}) {
  const add = useAddMilestone();
  const edit = useEditMilestone();
  const mutation = milestone ? edit : add;
  const [title, setTitle] = useState(milestone?.title ?? '');
  const [dueOn, setDueOn] = useState(milestone?.dueOn ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (milestone) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [milestone]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = milestoneTitle.safeParse(title);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Name the milestone.');
      return;
    }
    const body = { title: parsed.data, dueOn: dueOn || null };
    const options = {
      onSuccess: () => {
        if (!milestone) {
          setTitle('');
          setDueOn('');
        }
        onDone();
      },
    };
    if (milestone) edit.mutate({ projectId, milestoneId: milestone.id, body }, options);
    else add.mutate({ projectId, body }, options);
  };

  return (
    <form onSubmit={submit} noValidate className="flex w-full flex-wrap items-start gap-2">
      <Field
        ref={inputRef}
        label={milestone ? `New name for ${milestone.title}` : 'Add a milestone'}
        placeholder={milestone ? undefined : 'e.g. First deploy'}
        className="min-w-48 flex-1"
        value={title}
        error={error ?? (mutation.isError ? errorMessage(mutation.error) : undefined)}
        onChange={(e) => {
          setTitle(e.target.value);
          setError(null);
          mutation.reset();
        }}
        onKeyDown={(e) => {
          if (milestone && e.key === 'Escape') {
            e.stopPropagation();
            onDone();
          }
        }}
      />
      <Field
        label={milestone ? `Due date for ${milestone.title}` : 'Due (optional)'}
        type="date"
        className="w-40"
        value={dueOn}
        onChange={(e) => setDueOn(e.target.value)}
      />
      <div className="flex gap-2 pt-[26px]">
        <Button
          type="submit"
          size={milestone ? 'sm' : 'md'}
          variant={milestone ? 'primary' : 'secondary'}
          loading={mutation.isPending}
        >
          {milestone ? 'Save' : 'Add milestone'}
        </Button>
        {milestone && (
          <Button size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

const LIMIT = 100;

function ProjectTasks({ project: p }: { project: Project }) {
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const today = todayIn(timezone);
  const open = useTasks({
    projectId: p.id,
    status: ['TODO', 'IN_PROGRESS'],
    sort: 'plannedFor,asc',
    size: LIMIT,
  });
  const done = useTasks({ projectId: p.id, status: ['DONE'], size: 1 });
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Task }>({ open: false });
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const doneCount = done.data?.totalItems ?? 0;

  return (
    <Panel
      title="Tasks"
      domain="planner"
      action={
        <Button size="sm" onClick={() => setDialog({ open: true })}>
          <Plus size={14} aria-hidden />
          Add task
        </Button>
      }
    >
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {open.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading tasks…</span>
          <Skeleton className="h-16" />
        </div>
      ) : open.isError ? (
        <ErrorState
          title="We couldn’t load this project’s tasks."
          onRetry={() => void open.refetch()}
          retrying={open.isFetching}
          requestId={open.error.problem.requestId}
        />
      ) : open.data.items.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-ink-2">
          {doneCount > 0
            ? `All ${doneCount} of this project’s tasks are done.`
            : 'No tasks yet. Add the next concrete step, and plan it into your week.'}
        </p>
      ) : (
        <div className="grid gap-3">
          <ul aria-label="Open tasks" className="-mx-5 divide-y divide-line border-y border-line">
            {open.data.items.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                today={today}
                timezone={timezone}
                showProject={false}
                onEdit={(x) => setDialog({ open: true, editing: x })}
                onDelete={setDeleting}
                onChanged={setAnnouncement}
              />
            ))}
          </ul>
          {doneCount > 0 && <p className="text-[12.5px] text-ink-2">{doneCount} done</p>}
        </div>
      )}
      <TaskDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        timezone={timezone}
        task={dialog.editing}
        initial={{ projectId: p.id }}
        projectChoice={{ id: p.id, name: p.name }}
        onSaved={(title) => setAnnouncement(`Saved “${title}”.`)}
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onDeleted={setAnnouncement} />
    </Panel>
  );
}
