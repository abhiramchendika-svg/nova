import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { errorMessage } from '@/services/http';
import { useDeleteAssignment } from './api';
import type { Assignment } from './types';

export function DeleteAssignmentDialog({
  assignment,
  onClose,
}: {
  /** The assignment to delete; null keeps the dialog closed. */
  assignment: Assignment | null;
  onClose: () => void;
}) {
  const remove = useDeleteAssignment();
  return (
    <ConfirmDialog
      open={assignment !== null}
      onOpenChange={(open) => {
        if (!open) {
          remove.reset();
          onClose();
        }
      }}
      title="Delete this assignment?"
      description={
        <>
          <strong className="text-ink">{assignment?.title}</strong> will be removed. This can’t be undone.
        </>
      }
      confirmLabel="Delete assignment"
      pending={remove.isPending}
      error={remove.isError ? errorMessage(remove.error) : null}
      onConfirm={() => assignment && remove.mutate(assignment.id, { onSuccess: onClose })}
    />
  );
}
