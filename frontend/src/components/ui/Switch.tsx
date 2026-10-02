import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps {
  label: string;
  /** A line under the label, read out with the switch. */
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * On/off switch for a mode (not a form value). A button with role="switch", so it's announced
 * as "on"/"off" and toggles with Space or Enter.
 */
export function Switch({ label, description, checked, onCheckedChange, disabled, className }: SwitchProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div className={cn('inline-flex gap-2.5', description ? 'items-start' : 'items-center', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-[var(--dur-1)]',
          'disabled:opacity-40',
          description && 'mt-px',
          checked ? 'border-academics bg-academics' : 'border-line-strong bg-surface-3',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block size-3.5 rounded-full bg-surface shadow-sm transition-transform duration-[var(--dur-1)]',
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </button>
      <span className="grid gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-[13.5px] font-medium text-ink">
          {label}
        </label>
        {description && (
          <span id={descriptionId} className="text-[12.5px] text-ink-3">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}
