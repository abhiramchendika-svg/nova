import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { useDeleteInternship, useInternship, useMoveInternship } from './internshipApi';
import { InternshipDialog } from './InternshipDialog';
import { Dates } from './InternshipsPage';
import { ExternalLinkText } from './ProjectCard';
import {
  CLOSED_STATUSES,
  INTERNSHIP_STATUS_LABEL,
  INTERNSHIP_STATUS_TONE,
  INTERNSHIP_STATUSES,
} from './projectText';
import type { Internship, InternshipStatus } from './types';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** One application: where it stands, what's next, how it got here, and the prep for it. */
export function InternshipPage() {
  const { internshipId = '' } = useParams();
  const internship = useInternship(internshipId);

  if (internship.isPending) {
    return (
      <Shell>
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading the application…</span>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-48" />
        </div>
      </Shell>
    );
  }
  if (internship.isError) {
    return (
      <Shell>
        {internship.error.status === 404 ? (
          <EmptyState
            title="We couldn’t find that application."
            description="It may have been deleted, or the link is wrong."
            action={
              <ButtonLink to="/app/developer/internships" size="sm" variant="primary">
                Back to internships
              </ButtonLink>
            }
          />
        ) : (
          <ErrorState
            title="We couldn’t load this application."
            onRetry={() => void internship.refetch()}
            retrying={internship.isFetching}
            requestId={internship.error.problem.requestId}
          />
        )}
      </Shell>
    );
  }
  return <InternshipView internship={internship.data} />;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="animate-enter mx-auto grid max-w-4xl gap-5 px-4 py-6 lg:px-6">{children}</div>;
}

function InternshipView({ internship: i }: { internship: Internship }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useDeleteInternship();
  const move = useMoveInternship();
  const hasDates =
    (i.status === 'SAVED' && i.deadlineAt) || (i.nextStepAt && !CLOSED_STATUSES.includes(i.status));

  return (
    <Shell>
      <div>
        <Link
          to="/app/developer/internships"
          className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={14} aria-hidden />
          Internships
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <p>
            <Badge tone={INTERNSHIP_STATUS_TONE[i.status]}>{INTERNSHIP_STATUS_LABEL[i.status]}</Badge>
          </p>
          <h1 className="break-words font-display text-[24px] font-semibold tracking-[-0.01em]">
            {i.role} at {i.company}
          </h1>
          <p className="text-[13px] text-ink-2">
            {i.appliedOn ? `Applied ${formatDay(i.appliedOn)}` : 'Not sent yet'}
            {i.location && ` · ${i.location}`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <SelectField
            label="Stage"
            className="w-40"
            value={i.status}
            disabled={move.isPending}
            onChange={(e) => move.mutate({ id: i.id, status: e.target.value as InternshipStatus })}
          >
            {INTERNSHIP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INTERNSHIP_STATUS_LABEL[s]}
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
      {move.isError && <p className="text-[13px] text-critical">{errorMessage(move.error)}</p>}

      {hasDates && (
        <section
          aria-label="Coming up"
          className="grid gap-1 rounded-md border border-line bg-surface px-4 py-3 text-[14px]"
        >
          <Dates internship={i} timezone={timezone} />
        </section>
      )}

      <Details internship={i} />
      <History internship={i} timezone={timezone} />
      <PrepTasks internship={i} timezone={timezone} />

      <InternshipDialog open={editing} onOpenChange={setEditing} timezone={timezone} internship={i} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) remove.reset();
        }}
        title="Delete this application?"
        description={
          <>
            <strong className="text-ink">
              {i.role} at {i.company}
            </strong>{' '}
            and its history will be removed, and it won’t count in your analytics. Its prep tasks stay. This
            can’t be undone.
          </>
        }
        confirmLabel="Delete application"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() =>
          remove.mutate(i.id, { onSuccess: () => navigate('/app/developer/internships', { replace: true }) })
        }
      />
    </Shell>
  );
}

function Details({ internship: i }: { internship: Internship }) {
  const rows: [string, ReactNode][] = [];
  if (i.jobUrl) rows.push(['Posting', <ExternalLinkText key="j" href={i.jobUrl} label="Open" />]);
  if (i.source) rows.push(['Found via', i.source]);
  if (i.resumeVersion) rows.push(['Resume', i.resumeVersion]);
  return (
    <Panel title="Details" domain="developer">
      <div className="grid gap-3">
        {rows.length > 0 && (
          <dl className="grid gap-2.5">
            {rows.map(([term, value]) => (
              <div key={term} className="grid gap-0.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
                <dt className="text-[12.5px] text-ink-3">{term}</dt>
                <dd className="min-w-0 break-words text-[13.5px] text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {i.notes ? (
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink">{i.notes}</p>
        ) : (
          rows.length === 0 && (
            <p className="text-[13px] text-ink-2">
              Add the posting link, where you found it and notes with Edit.
            </p>
          )
        )}
      </div>
    </Panel>
  );
}

function History({ internship: i, timezone }: { internship: Internship; timezone: string }) {
  return (
    <Panel title="History" domain="developer">
      <ol aria-label="Stage history" className="grid gap-2">
        {[...i.history].reverse().map((h, n) => (
          <li key={`${h.changedAt}-${n}`} className="flex flex-wrap items-baseline gap-x-2 text-[13.5px]">
            <span className="font-medium text-ink">
              {h.fromStatus
                ? `${INTERNSHIP_STATUS_LABEL[h.fromStatus]} → ${INTERNSHIP_STATUS_LABEL[h.toStatus]}`
                : `Added as ${INTERNSHIP_STATUS_LABEL[h.toStatus].toLowerCase()}`}
            </span>
            <span className="text-[12.5px] text-ink-3">{formatDateTime(h.changedAt, timezone)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const LIMIT = 100;

function PrepTasks({ internship: i, timezone }: { internship: Internship; timezone: string }) {
  const today = todayIn(timezone);
  const query = useTasks({ internshipId: i.id, sort: 'plannedFor,asc', size: LIMIT });
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
          No prep tasks yet: tailoring your resume, revising DSA, reading about the company.
        </p>
      ) : (
        <ul aria-label="Prep tasks" className="-mx-5 divide-y divide-line border-y border-line">
          {ordered.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              today={today}
              timezone={timezone}
              showInternship={false}
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
        initial={{ internshipId: i.id, category: 'INTERNSHIP' }}
        onSaved={(title) => setAnnouncement(`Saved “${title}”.`)}
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onDeleted={setAnnouncement} />
    </Panel>
  );
}
