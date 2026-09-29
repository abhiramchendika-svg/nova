import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'size'> {
  /** Visible label. Use `hideLabel` for compact table cells (it stays available to screen readers). */
  label: string;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string;
  id?: string;
  controlSize?: 'sm' | 'md';
  ref?: Ref<HTMLSelectElement>;
}

/**
 * Labelled native select. Native on purpose: it gets the platform picker on phones and full
 * keyboard and screen-reader support for free. Errors are wired like Field's.
 */
export function SelectField({
  label,
  hideLabel = false,
  hint,
  error,
  id,
  controlSize = 'md',
  className,
  children,
  ref,
  ...selectProps
}: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? `select-${autoId}`;
  const describedById = `${selectId}-desc`;
  const hasDescription = Boolean(error || hint);

  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={selectId} className={hideLabel ? 'sr-only' : 'text-[13px] font-medium text-ink'}>
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasDescription ? describedById : undefined}
          className={cn(
            'w-full appearance-none rounded-sm border bg-surface pl-3 pr-8 text-ink',
            'transition-[border-color,box-shadow] duration-[var(--dur-1)] outline-none',
            'focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/25 focus-visible:outline-none',
            'disabled:opacity-50',
            controlSize === 'sm' ? 'h-8 text-[13px]' : 'h-10 text-[14px]',
            error ? 'border-critical' : 'border-line-strong',
          )}
          {...selectProps}
        >
          {children}
        </select>
        <ChevronDown
          size={15}
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3"
        />
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
