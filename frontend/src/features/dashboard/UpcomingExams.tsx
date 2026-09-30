import { Link } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Progress } from '@/components/ui/Progress';
import { useExams } from '@/features/academics/api';
import { daysUntilText, prepText } from '@/features/academics/examText';

const SHOWN = 3;

/** The next few exams as countdowns with prep progress (Home's Exams panel). */
export function UpcomingExams() {
  const exams = useExams({ upcoming: true });
  if (exams.isPending) return <Skeleton className="h-24" />;
  const list = (exams.data ?? []).slice(0, SHOWN);
  if (exams.isError || list.length === 0) {
    return (
      <EmptyState
        compact
        title="No exams scheduled."
        description="Add an exam to see a countdown and track your preparation topic by topic."
      />
    );
  }
  return (
    <ul aria-label="Upcoming exams" className="grid gap-4">
      {list.map((e) => (
        <li key={e.id} className="grid gap-1.5">
          <p className="flex items-baseline justify-between gap-2">
            <Link
              to={`/app/academics/exams/${e.id}`}
              className="truncate text-[13.5px] font-medium text-ink hover:text-academics-text hover:underline"
            >
              {e.title}
            </Link>
            <span className="shrink-0 text-[12.5px] font-semibold text-ink">
              {daysUntilText(e.daysUntil)}
            </span>
          </p>
          <p className="truncate text-[12px] text-ink-2">
            {e.courseCode && <span className="font-mono text-ink-3">{e.courseCode} </span>}
            {e.courseName}
          </p>
          {e.prep.percentage !== null && (
            <Progress
              value={e.prep.percentage}
              label={`${e.title} prep`}
              domain="academics"
              showLabel={false}
            />
          )}
          <p className="text-[12px] text-ink-2">
            {prepText(e.prep)}
            {e.prep.percentage !== null && <> ({e.prep.percentage}%)</>}
          </p>
        </li>
      ))}
    </ul>
  );
}
