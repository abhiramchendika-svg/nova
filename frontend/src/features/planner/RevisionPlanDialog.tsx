import { useState } from 'react';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import type { ExamDetail } from '@/features/academics/types';
import { addDays, formatDay, localParts, todayIn } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useCreateTasks } from './api';
import { planRevision, studyTitle } from './revisionPlan';

interface Row {
  topic: string;
  include: boolean;
  date: string;
}

/**
 * "Plan my revision": one study task per unfinished topic that doesn't have one yet, spread over the
 * days before the exam. Every date can be changed or a topic left out before saving; the plan is
 * saved all at once or not at all.
 */
export function RevisionPlanDialog({
  open,
  onOpenChange,
  exam,
  existingTitles,
  timezone,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamDetail;
  /** Titles of the exam's tasks so far, so topics already planned are skipped. */
  existingTitles: string[];
  timezone: string;
  onSaved?: (count: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Plan your revision">
      {/* Remounting on open recomputes the plan from the latest checklist */}
      {open && (
        <PlanForm
          exam={exam}
          existingTitles={existingTitles}
          timezone={timezone}
          onDone={(count) => {
            onSaved?.(count);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function PlanForm({
  exam,
  existingTitles,
  timezone,
  onDone,
  onCancel,
}: {
  exam: ExamDetail;
  existingTitles: string[];
  timezone: string;
  onDone: (count: number) => void;
  onCancel: () => void;
}) {
  const create = useCreateTasks();
  const today = todayIn(timezone);
  const examDay = localParts(exam.startsAt, timezone).date;
  const lastDay = addDays(examDay, -1);
  const planned = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  const unfinished = exam.topics.filter((t) => !t.done);
  const pending = unfinished
    .filter((t) => !planned.has(studyTitle(t.title).toLowerCase()))
    .map((t) => t.title);

  const [rows, setRows] = useState<Row[]>(() =>
    planRevision(pending, today, examDay).map((p) => ({ ...p, include: true })),
  );
  const [minutes, setMinutes] = useState('60');
  const [error, setError] = useState<string | null>(null);
  const chosen = rows.filter((r) => r.include);

  let blocker: string | null = null;
  if (exam.topics.length === 0) blocker = 'Add topics to the prep checklist first, then plan them here.';
  else if (unfinished.length === 0) blocker = 'Every topic is ticked off. Nothing left to plan.';
  else if (pending.length === 0) blocker = 'Every unfinished topic already has a study task.';
  else if (rows.length === 0) blocker = 'There’s no day left before the exam to plan.';

  const save = () => {
    const estimate = minutes.trim() === '' ? null : Number(minutes);
    if (estimate !== null && !(Number.isInteger(estimate) && estimate >= 1 && estimate <= 1440)) {
      setError('Use whole minutes from 1 to 1440.');
      return;
    }
    if (chosen.some((r) => !r.date)) {
      setError('Give every included topic a day.');
      return;
    }
    setError(null);
    create.mutate(
      chosen.map((r) => ({
        title: studyTitle(r.topic),
        description: null,
        category: null,
        priority: 'MEDIUM',
        plannedFor: r.date,
        plannedStart: null,
        dueAt: null,
        estimatedMinutes: estimate,
        recurrence: 'NONE',
        courseId: exam.courseId,
        examId: exam.id,
        projectId: null,
      })),
      { onSuccess: () => onDone(chosen.length) },
    );
  };

  if (blocker) {
    return (
      <div className="grid gap-4">
        <p className="text-[14px] leading-relaxed text-ink-2">{blocker}</p>
        <div className="flex justify-end">
          <Button onClick={onCancel}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {(error ?? create.error) && <FormAlert message={error ?? errorMessage(create.error!)} />}
      <p className="text-[14px] leading-relaxed text-ink-2">
        One study task per topic, spread from today to {formatDay(lastDay)}, the day before the exam. Change
        any day or leave a topic out.
      </p>
      <ul aria-label="Topics to plan" className="grid gap-3">
        {rows.map((row, i) => (
          <li key={row.topic} className="flex flex-wrap items-end gap-3">
            <Checkbox
              className="min-w-40 flex-1 pb-2"
              label={row.topic}
              checked={row.include}
              onChange={(e) =>
                setRows((rs) => rs.map((r, j) => (j === i ? { ...r, include: e.target.checked } : r)))
              }
            />
            <Field
              label={`Day for ${row.topic}`}
              type="date"
              className="w-44"
              min={today}
              max={lastDay}
              disabled={!row.include}
              value={row.date}
              onChange={(e) =>
                setRows((rs) => rs.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)))
              }
            />
          </li>
        ))}
      </ul>
      <Field
        label="Minutes per topic (optional)"
        inputMode="numeric"
        className="w-44"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={save} loading={create.isPending} disabled={chosen.length === 0}>
          {chosen.length === 1 ? 'Add 1 study task' : `Add ${chosen.length} study tasks`}
        </Button>
      </div>
    </div>
  );
}
