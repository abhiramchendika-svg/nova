import { useTask } from './api';
import { TaskDialog } from './TaskDialog';

/** Loads a task by id, then edits it in the usual dialog. */
export function EditTask({
  id,
  timezone,
  onClose,
  onSaved,
}: {
  id: string | null;
  timezone: string;
  onClose: () => void;
  onSaved: (title: string) => void;
}) {
  const task = useTask(id);
  return (
    <>
      {id && task.isError && (
        <p role="alert" className="text-[13px] text-critical">
          We couldn’t open that task.{' '}
          <button type="button" className="underline" onClick={onClose}>
            Dismiss
          </button>
        </p>
      )}
      <TaskDialog
        open={id !== null && task.data !== undefined}
        onOpenChange={(o) => !o && onClose()}
        timezone={timezone}
        task={task.data}
        onSaved={onSaved}
      />
    </>
  );
}
