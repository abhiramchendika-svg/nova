import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Shown below the input; replaced by the error when present. */
  hint?: ReactNode;
  error?: string;
  /** Optional control rendered inside the input on the right (e.g. show-password toggle). */
  trailing?: ReactNode;
  id?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Labelled text input. The label is always visible (never placeholder-as-label),
 * and errors are linked with aria-describedby + aria-invalid for screen readers.
 */
export function Field({ label, hint, error, trailing, id, className, ref, ...inputProps }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? `field-${autoId}`;
  const describedById = `${inputId}-desc`;
  const hasDescription = Boolean(error || hint);

  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasDescription ? describedById : undefined}
          className={cn(
            'h-10 w-full rounded-sm border bg-surface px-3 text-[14px] text-ink placeholder:text-ink-3',
            'transition-[border-color,box-shadow] duration-[var(--dur-1)] outline-none',
            'focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/25 focus-visible:outline-none',
            error ? 'border-critical' : 'border-line-strong',
            trailing ? 'pr-11' : undefined,
          )}
          {...inputProps}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {error ? (
        <p id={describedById} className="flex items-center gap-1.5 text-[12.5px] text-critical">
          <AlertCircle size={14} aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={describedById} className="text-[12.5px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
