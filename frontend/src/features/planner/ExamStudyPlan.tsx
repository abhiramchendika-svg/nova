import { Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import type { ExamDetail } from '@/features/academics/types';
import { todayIn } from '@/lib/dates';
import { useTasks } from './api';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { RevisionPlanDialog } from './RevisionPlanDialog';
import { TaskDialog } from './TaskDialog';
import { TaskItem } from './TaskItem';
import type { Task } from './types';

/** The backend's largest page; an exam with more study tasks than this is very unlikely. */
const LIMIT = 100;

/**
 * An exam's study tasks (docs/api.md §2.9: tasks linked by examId): open ones by day, then
 * finished ones. Add one by hand, or let "Plan my revision" spread the unfinished topics out.
 */
export function ExamStudyPlan({ exam, timezone }: { exam: ExamDetail; timezone: string }) {
  const today = todayIn(timezone);
  const query = useTasks({ examId: exam.id, sort: 'plannedFor,asc', size: LIMIT });
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Task }>({ open: false });
  const [planning, setPlanning] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const tasks = query.data?.items ?? [];
  const open = tasks.filter((t) => t.status !== 'DONE');
  const done = tasks.filter((t) => t.status === 'DONE');

  return (
    <Panel
      title="Study plan"
      domain="planner"
      action={
        <>
          <Button size="sm" onClick={() => setPlanning(true)}>
            <Sparkles size={14} aria-hidden />
            Plan my revision
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
      ) : tasks.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-ink-2">
          No study tasks yet. “Plan my revision” turns the unfinished topics into tasks spread over the days
          before the exam.
        </p>
      ) : (
        <ul aria-label="Study tasks" className="-mx-5 divide-y divide-line border-y border-line">
          {[...open, ...done].map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              today={today}
              timezone={timezone}
              showExam={false}
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
        initial={{ courseId: exam.courseId, examId: exam.id }}
        examChoice={{ id: exam.id, courseId: exam.courseId, title: exam.title }}
        onSaved={(title) => setAnnouncement(`Saved “${title}”.`)}
      />
      <RevisionPlanDialog
        open={planning}
        onOpenChange={setPlanning}
        exam={exam}
        existingTitles={tasks.map((t) => t.title)}
        timezone={timezone}
        onSaved={(count) =>
          setAnnouncement(count === 1 ? 'Added 1 study task.' : `Added ${count} study tasks.`)
        }
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onDeleted={setAnnouncement} />
    </Panel>
  );
}
