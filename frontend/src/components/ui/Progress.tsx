import { cn } from '@/lib/cn';
import { clampPercent } from '@/lib/math';
import type { Domain } from './DomainDot';

const fill: Record<Domain | 'ink', string> = {
  academics: 'bg-academics',
  planner: 'bg-planner',
  developer: 'bg-developer',
  ink: 'bg-ink',
};

export interface ProgressProps {
  /** 0–100; values outside the range are clamped. */
  value: number;
  label: string;
  domain?: Domain | 'ink';
  /** Show the label and percentage above the bar. */
  showLabel?: boolean;
  className?: string;
}

export function Progress({ value, label, domain = 'ink', showLabel = true, className }: ProgressProps) {
  const pct = clampPercent(value);
  return (
    <div className={cn('grid gap-1.5', className)}>
      {showLabel && (
        <div className="flex items-baseline justify-between gap-3 text-[12.5px] text-ink-2">
          <span>{label}</span>
          <span className="font-mono tabular text-ink">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-1.5 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-[600ms] ease-out motion-reduce:transition-none',
            fill[domain],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
