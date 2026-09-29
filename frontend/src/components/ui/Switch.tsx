import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * On/off switch for a mode (not a form value). A button with role="switch", so it's announced
 * as "on"/"off" and toggles with Space or Enter.
 */
export function Switch({ label, checked, onCheckedChange, disabled, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-[var(--dur-1)]',
          'disabled:opacity-40',
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
      <label htmlFor={id} className="cursor-pointer text-[13.5px] font-medium text-ink">
        {label}
      </label>
    </div>
  );
}
