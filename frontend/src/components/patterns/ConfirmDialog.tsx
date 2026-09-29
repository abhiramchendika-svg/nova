import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { FormAlert } from '@/components/patterns/FormAlert';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  error?: string | null;
  /**
   * For cascading deletes (ui-design.md §6): the user types this text to enable the button,
   * so a whole semester can't vanish with one mis-click.
   */
  typeToConfirm?: string;
}

/** Confirmation for destructive actions. The destructive button is last (right), per the spec. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  // Remounting on open/close starts every confirmation with an empty "type to confirm" box
  return <ConfirmDialogContent key={props.open ? 'open' : 'closed'} {...props} />;
}

function ConfirmDialogContent({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
  error,
  typeToConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const blocked = typeToConfirm !== undefined && typed.trim() !== typeToConfirm.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={pending} disabled={blocked}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && <FormAlert message={error} />}
        <div className="text-[14px] leading-relaxed text-ink-2">{description}</div>
        {typeToConfirm !== undefined && (
          <Field
            label={`Type “${typeToConfirm}” to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        )}
      </div>
    </Dialog>
  );
}
