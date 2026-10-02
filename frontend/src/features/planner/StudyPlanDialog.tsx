import { useState } from 'react';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { addDays, formatDay, todayIn } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useCreateTasks } from './api';
import { planRevision, studyTitle } from './revisionPlan';
import type { TaskRequest } from './types';

interface Row {
  topic: string;
  include: boolean;
  date: string;
}

export interface StudyPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Plan your revision". */
  title: string;
  /** The checklist to plan from, in order. */
  topics: { title: string; done: boolean }[];
  /** Titles of tasks already linked, so topics that have a "Study: …" task are skipped. */
  existingTitles: string[];
  /** The first day that can't be used: the exam day, or the day after a target date. */
  endDay: string;
  /** Finishes "spread from today to Fri 9 Oct, …", e.g. "the day before the exam". */
  endLabel: string;
  /** Shown when there's no checklist yet. */
  emptyChecklist: string;
  /** Shown when the end has passed. */
  noDaysLeft: string;
  /** The task for one planned topic. */
  toRequest: (topic: string, plannedFor: string, estimatedMinutes: number | null) => TaskRequest;
  timezone: string;
  onSaved?: (count: number) => void;
}

/**
 * One study task per unfinished topic that doesn't have one yet, spread over the days up to the end
 * (an exam, a learning target). Every date can be changed or a topic left out before saving; the
 * plan is saved all at once or not at all (POST /tasks/batch).
 */
export function StudyPlanDialog(props: StudyPlanDialogProps) {
  const { open, onOpenChange, title, onSaved } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      {/* Remounting on open recomputes the plan from the latest checklist */}
      {open && (
        <PlanForm
          {...props}
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
  topics,
  existingTitles,
  endDay,
  endLabel,
  emptyChecklist,
  noDaysLeft,
  toRequest,
  timezone,
  onDone,
  onCancel,
}: StudyPlanDialogProps & { onDone: (count: number) => void; onCancel: () => void }) {
  const create = useCreateTasks();
  const today = todayIn(timezone);
  const lastDay = addDays(endDay, -1);
  const planned = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  const unfinished = topics.filter((t) => !t.done);
  const pending = unfinished
    .filter((t) => !planned.has(studyTitle(t.title).toLowerCase()))
    .map((t) => t.title);

  const [rows, setRows] = useState<Row[]>(() =>
    planRevision(pending, today, endDay).map((p) => ({ ...p, include: true })),
  );
  const [minutes, setMinutes] = useState('60');
  const [error, setError] = useState<string | null>(null);
  const chosen = rows.filter((r) => r.include);

  let blocker: string | null = null;
  if (topics.length === 0) blocker = emptyChecklist;
  else if (unfinished.length === 0) blocker = 'Every topic is ticked off. Nothing left to plan.';
  else if (pending.length === 0) blocker = 'Every unfinished topic already has a study task.';
  else if (rows.length === 0) blocker = noDaysLeft;

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
      chosen.map((r) => toRequest(r.topic, r.date, estimate)),
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
        One study task per topic, spread from today to {formatDay(lastDay)}, {endLabel}. Change any day or
        leave a topic out.
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
