import { AlertTriangle, CalendarClock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { formatDateTime, formatDay } from '@/lib/dates';
import { useHackathons } from './hackathonApi';
import { HackathonDialog } from './HackathonDialog';
import { ExternalLinkText } from './ProjectCard';
import {
  countdown,
  DEADLINE_LABEL,
  eventDates,
  HACKATHON_STATUS_LABEL,
  HACKATHON_STATUS_TONE,
  MODE_LABEL,
} from './projectText';
import type { Hackathon } from './types';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Upcoming hackathons as cards (soonest first, with what's due), past ones as a short record. */
export function HackathonsPage() {
  const hackathons = useHackathons();
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const all = hackathons.data ?? [];
  const upcoming = all.filter((h) => !h.past);
  const past = all.filter((h) => h.past);

  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-6xl gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Hackathons</h1>
          <p className="mt-1 text-ink-2">What’s coming up, what’s due, and how the last ones went.</p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden />
          New hackathon
        </Button>
      </header>

      {hackathons.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-3 md:grid-cols-2">
          <span className="sr-only">Loading your hackathons…</span>
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : hackathons.isError ? (
        <ErrorState
          title="We couldn’t load your hackathons."
          onRetry={() => void hackathons.refetch()}
          retrying={hackathons.isFetching}
          requestId={hackathons.error.problem.requestId}
        />
      ) : all.length === 0 ? (
        <EmptyState
          title="Keep track of the hackathons you’re eyeing."
          description="Add one with its dates and deadlines; NOVA reminds you before registration closes and warns you if it clashes with an exam."
          action={
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              Add a hackathon
            </Button>
          }
        />
      ) : (
        <>
          <section aria-labelledby="hackathons-upcoming" className="grid gap-3">
            <h2 id="hackathons-upcoming" className="flex items-baseline gap-2 text-[15px] font-semibold">
              Upcoming{' '}
              <span className="font-mono text-[12px] font-normal tabular text-ink-3">{upcoming.length}</span>
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-[13.5px] text-ink-2">
                Nothing coming up. Add the next one you’re interested in.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((h) => (
                  <HackathonCard key={h.id} hackathon={h} timezone={timezone} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section aria-labelledby="hackathons-past" className="grid gap-3">
              <h2 id="hackathons-past" className="flex items-baseline gap-2 text-[15px] font-semibold">
                Past{' '}
                <span className="font-mono text-[12px] font-normal tabular text-ink-3">{past.length}</span>
              </h2>
              <ul
                aria-label="Past hackathons"
                className="divide-y divide-line rounded-md border border-line bg-surface"
              >
                {past.map((h) => (
                  <PastRow key={h.id} hackathon={h} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <HackathonDialog
        open={adding}
        onOpenChange={setAdding}
        timezone={timezone}
        onSaved={(h) => void navigate(`/app/developer/hackathons/${h.id}`)}
      />
    </div>
  );
}

function HackathonCard({ hackathon: h, timezone }: { hackathon: Hackathon; timezone: string }) {
  const headingId = `hackathon-${h.id}`;
  const dates = eventDates(h.startsOn, h.endsOn);
  const when = countdown(h.daysUntil);
  const where = [h.mode && MODE_LABEL[h.mode], h.location].filter(Boolean).join(' · ');
  return (
    <article
      aria-labelledby={headingId}
      className="grid content-start gap-2 rounded-md border border-line bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 id={headingId} className="min-w-0 text-[15px] font-semibold leading-snug">
          <Link to={`/app/developer/hackathons/${h.id}`} className="break-words hover:underline">
            {h.name}
          </Link>
        </h3>
        <Badge tone={HACKATHON_STATUS_TONE[h.status]}>{HACKATHON_STATUS_LABEL[h.status]}</Badge>
      </div>
      <p className="text-[12.5px] text-ink-2">
        {dates ?? 'Dates not set'}
        {when && (
          <>
            {' · '}
            <span className="font-medium text-ink">{when}</span>
          </>
        )}
      </p>
      {where && <p className="text-[12.5px] text-ink-2">{where}</p>}
      {h.deadline && <DeadlineLine deadline={h.deadline} timezone={timezone} />}
      {h.examClashes.length > 0 && (
        <p className="flex items-start gap-1.5 text-[12.5px] text-warning">
          <AlertTriangle size={13} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            Close to {h.examClashes.length === 1 ? 'an exam' : `${h.examClashes.length} exams`}:{' '}
            {h.examClashes
              .map((x) => `${x.courseCode ? `${x.courseCode} ` : ''}${x.title} (${formatDay(x.on)})`)
              .join(', ')}
          </span>
        </p>
      )}
      {(h.teamName || h.openTasks > 0) && (
        <p className="text-[12.5px] text-ink-3">
          {h.teamName && `Team ${h.teamName}`}
          {h.teamName && h.openTasks > 0 && ' · '}
          {h.openTasks > 0 && `${h.openTasks} open prep ${h.openTasks === 1 ? 'task' : 'tasks'}`}
        </p>
      )}
    </article>
  );
}

export function DeadlineLine({
  deadline,
  timezone,
}: {
  deadline: NonNullable<Hackathon['deadline']>;
  timezone: string;
}) {
  const label = DEADLINE_LABEL[deadline.kind];
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 text-[12.5px]',
        deadline.missed ? 'text-critical' : 'text-ink-2',
      )}
    >
      <CalendarClock size={13} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        {deadline.missed ? label.missed : label.open} {formatDateTime(deadline.at, timezone)}
        {deadline.missed && ' · update its status'}
      </span>
    </p>
  );
}

function PastRow({ hackathon: h }: { hackathon: Hackathon }) {
  const dates = eventDates(h.startsOn, h.endsOn);
  return (
    <li className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
      <div className="grid min-w-0 gap-0.5">
        <p className="text-[14px]">
          <Link to={`/app/developer/hackathons/${h.id}`} className="font-medium hover:underline">
            {h.name}
          </Link>
          {dates && <span className="text-[12.5px] text-ink-3"> · {dates}</span>}
        </p>
        {h.result && <p className="text-[13px] text-ink">{h.result}</p>}
        {(h.repoUrl || h.demoUrl || h.certificateUrl) && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
            {h.repoUrl && <ExternalLinkText href={h.repoUrl} label="Code" />}
            {h.demoUrl && <ExternalLinkText href={h.demoUrl} label="Demo" />}
            {h.certificateUrl && <ExternalLinkText href={h.certificateUrl} label="Certificate" />}
          </p>
        )}
      </div>
      <div>
        <Badge tone={HACKATHON_STATUS_TONE[h.status]}>{HACKATHON_STATUS_LABEL[h.status]}</Badge>
      </div>
    </li>
  );
}
