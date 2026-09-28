import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons have no visible text, so this becomes the accessible name. */
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ label, className, children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-grid size-9 place-items-center rounded-sm text-ink-2 transition-colors duration-[var(--dur-1)]',
        'hover:bg-surface-2 hover:text-ink data-[state=open]:bg-surface-2 data-[state=open]:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
