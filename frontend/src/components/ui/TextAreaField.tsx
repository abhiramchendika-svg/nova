import { useId, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  id?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

/** Multi-line companion to Field: same visible label, hint and error wiring. */
export function TextAreaField({
  label,
  hint,
  error,
  id,
  className,
  ref,
  rows = 3,
  ...props
}: TextAreaFieldProps) {
  const autoId = useId();
  const inputId = id ?? `textarea-${autoId}`;
  const describedById = `${inputId}-desc`;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? describedById : undefined}
        className={cn(
          'w-full resize-y rounded-sm border bg-surface px-3 py-2 text-[14px] leading-relaxed text-ink placeholder:text-ink-3',
          'transition-[border-color,box-shadow] duration-[var(--dur-1)] outline-none',
          'focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/25 focus-visible:outline-none',
          error ? 'border-critical' : 'border-line-strong',
        )}
        {...props}
      />
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
