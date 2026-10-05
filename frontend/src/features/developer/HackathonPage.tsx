import { AlertTriangle, ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SelectField } from '@/components/ui/SelectField';
import { useTasks } from '@/features/planner/api';
import { DeleteTaskDialog } from '@/features/planner/DeleteTaskDialog';
import { TaskDialog } from '@/features/planner/TaskDialog';
import { TaskItem } from '@/features/planner/TaskItem';
import type { Task } from '@/features/planner/types';
import { useSettings } from '@/features/settings/api';
import { formatDateTime, formatDay, todayIn } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useDeleteHackathon, useHackathon, useUpdateHackathon } from './hackathonApi';
import { HackathonDialog } from './HackathonDialog';
import { DeadlineLine } from './HackathonsPage';
import { ProjectDialog } from './ProjectDialog';
import { ExternalLinkText } from './ProjectCard';
import {
  countdown,
  eventDates,
  HACKATHON_STATUS_LABEL,
  HACKATHON_STATUS_TONE,
  HACKATHON_STATUSES,
  MODE_LABEL,
} from './projectText';
import { hackathonRequestOf } from './schemas';
import type { Hackathon, HackathonStatus } from './types';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** One hackathon: when and what's due, exam clashes, team, project, prep tasks and how it went. */
export function HackathonPage() {
  const { hackathonId = '' } = useParams();
  const hackathon = useHackathon(hackathonId);

  if (hackathon.isPending) {
    return (
      <Shell>
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading the hackathon…</span>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-48" />
        </div>
      </Shell>
    );
  }
  if (hackathon.isError) {
    return (
      <Shell>
        {hackathon.error.status === 404 ? (
          <EmptyState
            title="We couldn’t find that hackathon."
            description="It may have been deleted, or the link is wrong."
            action={
              <ButtonLink to="/app/developer/hackathons" size="sm" variant="primary">
                Back to hackathons
              </ButtonLink>
            }
          />
        ) : (
          <ErrorState
            title="We couldn’t load this hackathon."
            onRetry={() => void hackathon.refetch()}
            retrying={hackathon.isFetching}
            requestId={hackathon.error.problem.requestId}
          />
        )}
      </Shell>
    );
  }
  return <HackathonView hackathon={hackathon.data} />;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-4xl gap-5 px-4 py-6 lg:px-6">{children}</div>
  );
}

function HackathonView({ hackathon: h }: { hackathon: Hackathon }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useDeleteHackathon();
  const update = useUpdateHackathon();
  const dates = eventDates(h.startsOn, h.endsOn);
  const when = h.past ? null : countdown(h.daysUntil);

  return (
    <Shell>
      <div>
        <Link
          to="/app/developer/hackathons"
          className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={14} aria-hidden />
          Hackathons
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <p>
            <Badge tone={HACKATHON_STATUS_TONE[h.status]}>{HACKATHON_STATUS_LABEL[h.status]}</Badge>
          </p>
          <h1 className="break-words font-display text-[24px] font-semibold tracking-[-0.01em]">{h.name}</h1>
          <p className="text-[13px] text-ink-2">
            {dates ?? 'Dates not set'}
            {when && (
              <>
                {' · '}
                <span className="font-medium text-ink">{when}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <SelectField
            label="Status"
            className="w-40"
            value={h.status}
            disabled={update.isPending}
            onChange={(e) =>
              update.mutate({
                id: h.id,
                body: hackathonRequestOf(h, { status: e.target.value as HackathonStatus }),
              })
            }
          >
            {HACKATHON_STATUSES.map((s) => (
              <option key={s} value={s}>
                {HACKATHON_STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
          <Button onClick={() => setEditing(true)}>
            <Pencil size={14} aria-hidden />
            Edit
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(true)}>
            <Trash2 size={14} aria-hidden />
            Delete
          </Button>
        </div>
      </header>
      {update.isError && <p className="text-[13px] text-critical">{errorMessage(update.error)}</p>}

      {h.deadline && (
        <section
          aria-label="Next deadline"
          className="rounded-md border border-line bg-surface px-4 py-3 text-[14px]"
        >
          <DeadlineLine deadline={h.deadline} timezone={timezone} />
        </section>
      )}

      {h.examClashes.length > 0 && (
        <section
          aria-labelledby="clash-heading"
          className="tint-warning grid gap-2 rounded-md border border-warning/40 px-4 py-3"
        >
          <h2 id="clash-heading" className="flex items-center gap-1.5 text-[14px] font-semibold text-warning">
            <AlertTriangle size={15} aria-hidden />
            Close to {h.examClashes.length === 1 ? 'an exam' : `${h.examClashes.length} exams`}
          </h2>
          <ul className="grid gap-1 text-[13.5px]">
            {h.examClashes.map((x) => (
              <li key={x.examId}>
                <Link
                  to={`/app/academics/exams/${x.examId}`}
                  className="font-medium text-ink hover:underline"
                >
                  {x.courseCode ? `${x.courseCode} · ` : ''}
                  {x.title}
                </Link>{' '}
                <span className="text-ink-2">on {formatDay(x.on)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-ink-2">Plan your revision before the hackathon, not after.</p>
        </section>
      )}

      <Details hackathon={h} timezone={timezone} />
      <ProjectLink hackathon={h} />
      <PrepTasks hackathon={h} timezone={timezone} />
      <Outcome hackathon={h} />

      <HackathonDialog open={editing} onOpenChange={setEditing} timezone={timezone} hackathon={h} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) remove.reset();
        }}
        title="Delete this hackathon?"
        description={
          <>
            <strong className="text-ink">{h.name}</strong> will be removed. Its prep tasks and any linked
            project stay. This can’t be undone.
          </>
        }
        confirmLabel="Delete hackathon"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() =>
          remove.mutate(h.id, { onSuccess: () => navigate('/app/developer/hackathons', { replace: true }) })
        }
      />
    </Shell>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[12.5px] text-ink-3">{term}</dt>
      <dd className="min-w-0 break-words text-[13.5px] text-ink">{children}</dd>
    </div>
  );
}

function Details({ hackathon: h, timezone }: { hackathon: Hackathon; timezone: string }) {
  const where = [h.mode && MODE_LABEL[h.mode], h.location].filter(Boolean).join(' · ');
  const rows: [string, ReactNode][] = [];
  if (where) rows.push(['Format', where]);
  if (h.organizer) rows.push(['Organiser', h.organizer]);
  if (h.websiteUrl) rows.push(['Website', <ExternalLinkText key="w" href={h.websiteUrl} label="Open" />]);
  if (h.registrationDeadline)
    rows.push(['Registration closes', formatDateTime(h.registrationDeadline, timezone)]);
  if (h.submissionDeadline) rows.push(['Submissions close', formatDateTime(h.submissionDeadline, timezone)]);
  if (h.teamName) rows.push(['Team', h.teamName]);
  if (h.teamMembers) rows.push(['Teammates', h.teamMembers]);
  return (
    <Panel title="Details" domain="developer">
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-2">Add dates, deadlines, venue and team with Edit.</p>
      ) : (
        <dl className="grid gap-2.5">
          {rows.map(([term, value]) => (
            <Row key={term} term={term}>
              {value}
            </Row>
          ))}
        </dl>
      )}
    </Panel>
  );
}

function ProjectLink({ hackathon: h }: { hackathon: Hackathon }) {
  const [creating, setCreating] = useState(false);
  const update = useUpdateHackathon();
  return (
    <Panel title="Project" domain="developer">
      {h.projectId ? (
        <p className="text-[13.5px]">
          Building{' '}
          <Link
            to={`/app/developer/projects/${h.projectId}`}
            className="font-medium text-ink hover:underline"
          >
            {h.projectName ?? 'the linked project'}
          </Link>{' '}
          here. Its milestones and tasks live on the project.
        </p>
      ) : (
        <div className="grid gap-3">
          <p className="text-[13px] leading-relaxed text-ink-2">
            Not linked to a project. Create one from this hackathon, or pick an existing one with Edit.
          </p>
          <div>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} aria-hidden />
              Create a project from it
            </Button>
          </div>
          {update.isError && <p className="text-[13px] text-critical">{errorMessage(update.error)}</p>}
        </div>
      )}
      <ProjectDialog
        open={creating}
        onOpenChange={setCreating}
        initial={{
          name: h.name.slice(0, 100),
          repoUrl: h.repoUrl ?? '',
          demoUrl: h.demoUrl ?? '',
          status: 'PLANNING',
        }}
        onSaved={(project) =>
          update.mutate({ id: h.id, body: hackathonRequestOf(h, { projectId: project.id }) })
        }
      />
    </Panel>
  );
}

const LIMIT = 100;

function PrepTasks({ hackathon: h, timezone }: { hackathon: Hackathon; timezone: string }) {
  const today = todayIn(timezone);
  const query = useTasks({ hackathonId: h.id, sort: 'plannedFor,asc', size: LIMIT });
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Task }>({ open: false });
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const tasks = query.data?.items ?? [];
  const ordered = [...tasks.filter((t) => t.status !== 'DONE'), ...tasks.filter((t) => t.status === 'DONE')];

  return (
    <Panel
      title="Prep tasks"
      domain="planner"
      action={
        <Button size="sm" onClick={() => setDialog({ open: true })}>
          <Plus size={14} aria-hidden />
          Add prep task
        </Button>
      }
    >
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {query.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading prep tasks…</span>
          <Skeleton className="h-16" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="We couldn’t load the prep tasks."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          requestId={query.error.problem.requestId}
        />
      ) : ordered.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-ink-2">
          No prep tasks yet: registering, forming a team, setting up the repo, practising the pitch.
        </p>
      ) : (
        <ul aria-label="Prep tasks" className="-mx-5 divide-y divide-line border-y border-line">
          {ordered.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              today={today}
              timezone={timezone}
              showHackathon={false}
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
        initial={{ hackathonId: h.id, projectId: h.projectId ?? '', category: 'PROJECT' }}
        projectChoice={h.projectId ? { id: h.projectId, name: h.projectName ?? 'Linked project' } : undefined}
        onSaved={(title) => setAnnouncement(`Saved “${title}”.`)}
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onDeleted={setAnnouncement} />
    </Panel>
  );
}

function Outcome({ hackathon: h }: { hackathon: Hackathon }) {
  const links = [
    h.repoUrl && <ExternalLinkText key="r" href={h.repoUrl} label="Code" />,
    h.demoUrl && <ExternalLinkText key="d" href={h.demoUrl} label="Demo" />,
    h.certificateUrl && <ExternalLinkText key="c" href={h.certificateUrl} label="Certificate" />,
  ].filter(Boolean);
  const empty = !h.result && links.length === 0 && !h.notes;
  return (
    <Panel title="Outcome and notes" domain="developer">
      {empty ? (
        <p className="text-[13px] text-ink-2">
          Afterwards, write how it went and add the code, demo and certificate links with Edit.
        </p>
      ) : (
        <div className="grid gap-3">
          {h.result && (
            <p className="text-[14px]">
              <span className="text-ink-3">Result: </span>
              <span className="font-medium text-ink">{h.result}</span>
            </p>
          )}
          {links.length > 0 && <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">{links}</p>}
          {h.notes && <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink">{h.notes}</p>}
        </div>
      )}
    </Panel>
  );
}
