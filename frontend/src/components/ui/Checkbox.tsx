import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: ReactNode;
  /** Visually hidden label, for dense rows where a column header already explains it. */
  hideLabel?: boolean;
  hint?: ReactNode;
  id?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Native checkbox with a label; accent colour follows the theme's focus hue. */
export function Checkbox({
  label,
  hideLabel = false,
  hint,
  id,
  className,
  ref,
  ...inputProps
}: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? `check-${autoId}`;
  const hintId = `${inputId}-hint`;
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        aria-describedby={hint ? hintId : undefined}
        className="mt-0.5 size-4 shrink-0 accent-[var(--academics)]"
        {...inputProps}
      />
      <div className={cn('grid gap-0.5', hideLabel && 'sr-only')}>
        <label htmlFor={inputId} className="text-[13.5px] text-ink">
          {label}
        </label>
        {hint && (
          <p id={hintId} className="text-[12.5px] text-ink-3">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
