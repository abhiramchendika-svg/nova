import { useId } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { formatDateTime } from '@/lib/dates';
import { daysUntilText, KIND_LABEL, prepText } from './examText';
import type { ExamSummary } from './types';

/** One exam as a countdown card: how soon, what, when, and how prepared (ui-design.md §1: answer first). */
export function ExamCard({ exam: e, timezone }: { exam: ExamSummary; timezone: string }) {
  const headingId = useId();
  const soon = e.daysUntil === 0 || e.daysUntil === 1;
  return (
    <article
      aria-labelledby={headingId}
      className="grid gap-2.5 rounded-md border border-line bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-2">
        {soon ? (
          <Badge tone="warning">{daysUntilText(e.daysUntil)}</Badge>
        ) : (
          <p className="text-[13px] font-semibold text-ink">{daysUntilText(e.daysUntil)}</p>
        )}
        <Badge>{KIND_LABEL[e.kind]}</Badge>
      </div>
      <div className="grid gap-0.5">
        <h3 id={headingId} className="text-[15px] font-semibold leading-snug">
          <Link to={`/app/academics/exams/${e.id}`} className="hover:text-academics-text hover:underline">
            {e.title}
          </Link>
        </h3>
        <p className="text-[12.5px] text-ink-2">
          {e.courseCode && <span className="font-mono text-ink-3">{e.courseCode} </span>}
          {e.courseName}
        </p>
        <p className="text-[12.5px] text-ink-2">
          <span className="tabular">{formatDateTime(e.startsAt, timezone)}</span>
          {e.durationMinutes !== null && <> · {e.durationMinutes} min</>}
          {e.location && <> · {e.location}</>}
        </p>
      </div>
      {e.prep.percentage !== null && (
        <Progress value={e.prep.percentage} label={`${e.title} prep`} domain="academics" showLabel={false} />
      )}
      <p className="text-[12.5px] text-ink-2">
        {prepText(e.prep)}
        {e.prep.percentage !== null && (
          <>
            {' '}
            (<span className="font-mono tabular">{e.prep.percentage}%</span>)
          </>
        )}
      </p>
    </article>
  );
}
