import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { SelectField } from '@/components/ui/SelectField';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useAssignmentProgress } from './api';
import { formatMinutes, STATUS_LABEL, urgencyChip } from './assignmentText';
import type { Assignment, AssignmentStatus } from './types';

const STATUSES: AssignmentStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED'];
const STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/**
 * One assignment as a list row: what, for which course, when (in the user's timezone), and its
 * status, which can be changed in place. Edit and delete are handed to the page.
 */
export function AssignmentItem({
  assignment: a,
  timezone,
  showCourse = true,
  showUrgency = false,
  onEdit,
  onDelete,
  onChanged,
  className,
}: {
  assignment: Assignment;
  timezone: string;
  showCourse?: boolean;
  /** Grouped lists already say how soon; flat lists show a chip for overdue and due-within-a-day. */
  showUrgency?: boolean;
  onEdit: (a: Assignment) => void;
  onDelete: (a: Assignment) => void;
  /** Called with a sentence to announce after a status or progress change. */
  onChanged?: (message: string) => void;
  /** Horizontal padding, to line up with the surrounding panel. */
  className?: string;
}) {
  const progress = useAssignmentProgress();
  const chip = showUrgency ? urgencyChip(a.urgency) : null;
  const steps = STEPS.includes(a.progressPct) ? STEPS : [...STEPS, a.progressPct].sort((x, y) => x - y);

  const change = (body: { status?: AssignmentStatus; progressPct?: number }, message: string) =>
    progress.mutate({ id: a.id, ...body }, { onSuccess: () => onChanged?.(message) });

  return (
    // Side by side only when the list is wide enough (a container query: the same row sits in a
    // full-width page list and in a narrower course-page panel). The list must be a @container.
    <li className={cn('grid gap-2 py-3 @2xl:grid-cols-[1fr_auto] @2xl:items-center', className ?? 'px-4')}>
      <div className="grid min-w-0 gap-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink">
          <span className="min-w-0 break-words">{a.title}</span>
          {chip && <Badge tone={chip.tone}>{chip.label}</Badge>}
          {a.priority === 'HIGH' && <Badge>High priority</Badge>}
        </p>
        <p className="text-[12.5px] text-ink-2">
          {showCourse && (
            <>
              {a.courseCode && <span className="font-mono text-ink-3">{a.courseCode} </span>}
              {a.courseName} ·{' '}
            </>
          )}
          Due <span className="tabular">{formatDateTime(a.dueAt, timezone)}</span>
          {a.estimatedMinutes !== null && <> · about {formatMinutes(a.estimatedMinutes)}</>}
        </p>
        {progress.isError && <p className="text-[12.5px] text-critical">{errorMessage(progress.error)}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <SelectField
          label={`Status of ${a.title}`}
          hideLabel
          controlSize="sm"
          className="w-32"
          value={a.status}
          disabled={progress.isPending}
          onChange={(e) => {
            const status = e.target.value as AssignmentStatus;
            change({ status }, `Marked “${a.title}” ${STATUS_LABEL[status].toLowerCase()}.`);
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </SelectField>
        {a.status === 'IN_PROGRESS' && (
          <SelectField
            label={`Progress of ${a.title}`}
            hideLabel
            controlSize="sm"
            className="w-[5.5rem]"
            value={a.progressPct}
            disabled={progress.isPending}
            onChange={(e) => {
              const pct = Number(e.target.value);
              change({ progressPct: pct }, `“${a.title}” is ${pct}% done.`);
            }}
          >
            {steps.map((n) => (
              <option key={n} value={n}>
                {n}%
              </option>
            ))}
          </SelectField>
        )}
        <IconButton label={`Edit ${a.title}`} onClick={() => onEdit(a)}>
          <Pencil size={15} aria-hidden />
        </IconButton>
        <IconButton label={`Delete ${a.title}`} onClick={() => onDelete(a)}>
          <Trash2 size={15} aria-hidden />
        </IconButton>
      </div>
    </li>
  );
}
