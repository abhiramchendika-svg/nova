import { useState } from 'react';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { errorMessage } from '@/services/http';
import { useDeleteTask } from './api';
import type { Task } from './types';

/**
 * Confirms a delete. A repeating task asks whether to stop the series too: "this and future"
 * removes the open repeats planned from this one on; finished ones stay as history.
 */
export function DeleteTaskDialog({
  task,
  onClose,
  onDeleted,
}: {
  /** The task to delete; null keeps the dialog closed. */
  task: Task | null;
  onClose: () => void;
  onDeleted?: (message: string) => void;
}) {
  // Remounting per task starts every confirmation on "only this one"
  return <DeleteTaskContent key={task?.id ?? 'closed'} task={task} onClose={onClose} onDeleted={onDeleted} />;
}

function DeleteTaskContent({
  task,
  onClose,
  onDeleted,
}: {
  task: Task | null;
  onClose: () => void;
  onDeleted?: (message: string) => void;
}) {
  const remove = useDeleteTask();
  const [series, setSeries] = useState(false);
  const repeating = Boolean(task && task.recurrence !== 'NONE' && task.seriesId && task.plannedFor);

  const confirm = () => {
    if (!task) return;
    const withSeries = repeating && series;
    remove.mutate(
      { id: task.id, series: withSeries },
      {
        onSuccess: () => {
          onDeleted?.(
            withSeries ? `Deleted “${task.title}” and its future repeats.` : `Deleted “${task.title}”.`,
          );
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open={task !== null}
      onOpenChange={(open) => {
        if (!open) {
          remove.reset();
          onClose();
        }
      }}
      title={repeating ? 'Delete a repeating task?' : 'Delete this task?'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={confirm} loading={remove.isPending}>
            Delete task
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {remove.isError && <FormAlert message={errorMessage(remove.error)} />}
        <p className="text-[14px] leading-relaxed text-ink-2">
          <strong className="text-ink">{task?.title}</strong> will be removed. This can’t be undone.
        </p>
        {repeating && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[13px] font-medium text-ink">Which ones?</legend>
            <label className="flex items-start gap-2.5 text-[13.5px] text-ink">
              <input
                type="radio"
                name="delete-scope"
                className="mt-0.5 size-4 accent-[var(--planner)]"
                checked={!series}
                onChange={() => setSeries(false)}
              />
              Only this one
            </label>
            <label className="flex items-start gap-2.5 text-[13.5px] text-ink">
              <input
                type="radio"
                name="delete-scope"
                className="mt-0.5 size-4 accent-[var(--planner)]"
                checked={series}
                onChange={() => setSeries(true)}
              />
              <span>
                This and future repeats
                <span className="block text-[12.5px] text-ink-3">Finished ones stay in your history.</span>
              </span>
            </label>
          </fieldset>
        )}
      </div>
    </Dialog>
  );
}
