import { Link } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { useDashboard } from './api';
import type { AttentionKind } from './types';

const CHIP: Record<AttentionKind, { tone: BadgeTone; label: string }> = {
  ASSIGNMENT_OVERDUE: { tone: 'critical', label: 'Overdue' },
  TASK_OVERDUE: { tone: 'critical', label: 'Overdue' },
  ASSIGNMENT_DUE_SOON: { tone: 'warning', label: 'Due soon' },
  TASK_DUE_SOON: { tone: 'warning', label: 'Due soon' },
  ATTENDANCE_AT_RISK: { tone: 'warning', label: 'Attendance' },
  EXAM_PREP: { tone: 'academics', label: 'Exam prep' },
  HACKATHON_DEADLINE: { tone: 'developer', label: 'Hackathon' },
  HACKATHON_EXAM_CLASH: { tone: 'warning', label: 'Exam clash' },
};

/**
 * What needs the user, most urgent first (the server ranks it: PriorityScorer). Each row says why
 * in plain words and links to where it's dealt with.
 */
export function NeedsAttention() {
  const query = useDashboard();
  if (query.isPending) {
    return (
      <div role="status" aria-busy="true" className="grid gap-2">
        <span className="sr-only">Loading what needs you…</span>
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="We couldn’t check what needs you."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        requestId={query.error.problem.requestId}
      />
    );
  }
  const items = query.data.needsAttention;
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        title="Nothing needs you right now."
        description="Overdue work, close deadlines, attendance risks and under-prepared exams are ranked here."
      />
    );
  }
  return (
    <ol aria-label="Most urgent first" className="-mx-5 -mb-5 divide-y divide-line border-t border-line">
      {items.map((item) => {
        const chip = CHIP[item.kind];
        return (
          <li key={`${item.kind}-${item.refId}`}>
            <Link
              to={item.link}
              className="grid gap-1 px-5 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge tone={chip.tone}>{chip.label}</Badge>
                <span className="min-w-0 break-words text-[13.5px] font-medium text-ink">{item.title}</span>
                {item.courseCode && item.courseCode !== item.title && (
                  <span className="text-[12px] text-ink-3">{item.courseCode}</span>
                )}
              </span>
              <span className="text-[12.5px] text-ink-2">{item.reason}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
