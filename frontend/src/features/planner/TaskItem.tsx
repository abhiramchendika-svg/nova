import { Pause, Pencil, Play, Repeat, Trash2 } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { IconButton } from '@/components/ui/IconButton';
import { formatMinutes } from '@/features/academics/assignmentText';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useTaskStatus } from './api';
import { dayLabel, RECURRENCE_LABEL } from './taskText';
import type { Task } from './types';

/**
 * One task as a list row: tick it off (or untick it), start or pause it, and hand edit and delete
 * to the page. The details line says when, for what, and how long, in the user's timezone.
 */
export function TaskItem({
  task: t,
  today,
  timezone,
  showPlannedDay = true,
  showExam = true,
  showProject = true,
  showGoal = true,
  showHackathon = true,
  onEdit,
  onDelete,
  onChanged,
}: {
  task: Task;
  /** Today in the user's timezone (YYYY-MM-DD). */
  today: string;
  timezone: string;
  /** Lists already grouped by day leave the day out. */
  showPlannedDay?: boolean;
  /** The exam page lists only its own tasks, so it leaves the exam out. */
  showExam?: boolean;
  /** Likewise the project page. */
  showProject?: boolean;
  /** Likewise a learning goal's page. */
  showGoal?: boolean;
  /** Likewise a hackathon's page. */
  showHackathon?: boolean;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  /** Called with a sentence to announce after a status change. */
  onChanged?: (message: string) => void;
}) {
  const status = useTaskStatus();
  const done = t.status === 'DONE';

  const change = (next: Task['status']) =>
    status.mutate(
      { id: t.id, status: next },
      {
        onSuccess: ({ nextInstance }) => {
          if (next !== 'DONE') {
            onChanged?.(next === 'IN_PROGRESS' ? `Started “${t.title}”.` : `“${t.title}” is open again.`);
          } else if (nextInstance?.plannedFor) {
            onChanged?.(
              `Done: “${t.title}”. The next one is planned for ${dayLabel(nextInstance.plannedFor, today).toLowerCase()}.`,
            );
          } else {
            onChanged?.(`Done: “${t.title}”.`);
          }
        },
      },
    );

  const parts: { key: string; node: ReactNode }[] = [];
  if (t.plannedFor && (showPlannedDay || t.plannedFor < today)) {
    parts.push({ key: 'day', node: dayLabel(t.plannedFor, today) });
  }
  if (t.plannedStart) parts.push({ key: 'start', node: <span className="tabular">{t.plannedStart}</span> });
  if (t.dueAt) {
    parts.push({
      key: 'due',
      node: (
        <span className={cn('tabular', t.overdue && 'text-critical')}>
          Due {formatDateTime(t.dueAt, timezone)}
        </span>
      ),
    });
  }
  const course = t.courseCode ?? t.courseName;
  if (course) parts.push({ key: 'course', node: course });
  if (showExam && t.examTitle) parts.push({ key: 'exam', node: t.examTitle });
  if (showProject && t.projectName) parts.push({ key: 'project', node: t.projectName });
  if (showGoal && t.learningGoalTitle) parts.push({ key: 'goal', node: t.learningGoalTitle });
  if (showHackathon && t.hackathonName) parts.push({ key: 'hackathon', node: t.hackathonName });
  if (t.estimatedMinutes !== null)
    parts.push({ key: 'estimate', node: `about ${formatMinutes(t.estimatedMinutes)}` });
  if (t.recurrence !== 'NONE') {
    parts.push({
      key: 'repeat',
      node: (
        <span className="inline-flex items-center gap-1">
          <Repeat size={12} aria-hidden />
          {RECURRENCE_LABEL[t.recurrence]}
        </span>
      ),
    });
  }

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-3">
      <Checkbox
        className="min-w-0 flex-1"
        checked={done}
        disabled={status.isPending}
        onChange={(e) => change(e.target.checked ? 'DONE' : 'TODO')}
        label={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                'min-w-0 break-words font-medium',
                done && 'text-ink-2 line-through decoration-ink-3',
              )}
            >
              {t.title}
            </span>
            {t.overdue && <Badge tone="critical">Overdue</Badge>}
            {!done && t.status === 'IN_PROGRESS' && <Badge tone="planner">In progress</Badge>}
            {!done && t.priority === 'HIGH' && <Badge>High priority</Badge>}
          </span>
        }
        hint={
          parts.length > 0 || status.isError ? (
            <span className="flex flex-wrap items-center gap-x-1.5">
              {parts.map((p, i) => (
                <Fragment key={p.key}>
                  {i > 0 && <span aria-hidden>·</span>}
                  {p.node}
                </Fragment>
              ))}
              {status.isError && <span className="text-critical">{errorMessage(status.error)}</span>}
            </span>
          ) : undefined
        }
      />
      <div className="ml-auto flex items-center">
        {!done &&
          (t.status === 'IN_PROGRESS' ? (
            <IconButton label={`Pause ${t.title}`} disabled={status.isPending} onClick={() => change('TODO')}>
              <Pause size={15} aria-hidden />
            </IconButton>
          ) : (
            <IconButton
              label={`Start ${t.title}`}
              disabled={status.isPending}
              onClick={() => change('IN_PROGRESS')}
            >
              <Play size={15} aria-hidden />
            </IconButton>
          ))}
        <IconButton label={`Edit ${t.title}`} onClick={() => onEdit(t)}>
          <Pencil size={15} aria-hidden />
        </IconButton>
        <IconButton label={`Delete ${t.title}`} onClick={() => onDelete(t)}>
          <Trash2 size={15} aria-hidden />
        </IconButton>
      </div>
    </li>
  );
}
