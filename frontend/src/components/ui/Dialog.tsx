import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from './IconButton';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Footer actions; put the primary action last (right). */
  footer?: ReactNode;
}

/**
 * Modal dialog on Radix: focus is trapped, Esc closes, focus returns to the trigger.
 * Below the md breakpoint it becomes a bottom sheet.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[rgb(12_16_25/0.45)] data-[state=open]:animate-enter" />
        <RadixDialog.Content
          className={
            'fixed z-50 grid gap-4 border border-line bg-surface p-5 shadow-dialog outline-none ' +
            'inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-lg pb-[calc(20px+env(safe-area-inset-bottom,0px))] ' +
            // Centered without transforms so the enter animation's transform can't displace it
            'md:inset-0 md:m-auto md:h-fit md:w-[min(520px,calc(100vw-32px))] md:rounded-lg md:pb-5 ' +
            'data-[state=open]:animate-enter'
          }
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-start gap-3">
            <div className="grid flex-1 gap-1">
              <RadixDialog.Title className="font-display text-[18px] font-semibold leading-snug">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="text-[13.5px] text-ink-2">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <IconButton label="Close">
                <X size={17} aria-hidden />
              </IconButton>
            </RadixDialog.Close>
          </div>
          <div>{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
