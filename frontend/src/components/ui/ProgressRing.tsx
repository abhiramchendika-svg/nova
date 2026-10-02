import { cn } from '@/lib/cn';
import { clampPercent } from '@/lib/math';
import type { Domain } from './DomainDot';

const stroke: Record<Domain | 'ink', string> = {
  academics: 'stroke-academics',
  planner: 'stroke-planner',
  developer: 'stroke-developer',
  ink: 'stroke-ink',
};

export interface ProgressRingProps {
  /** 0–100; values outside the range are clamped. Null draws an empty ring with a dash. */
  value: number | null;
  label: string;
  size?: 44 | 64;
  domain?: Domain | 'ink';
  className?: string;
}

/**
 * A circular progress meter (ui-design.md §6: learning goals and exam prep): 5px stroke, the
 * percentage in mono at the centre, and the same progressbar ARIA as the bar.
 */
export function ProgressRing({ value, label, size = 44, domain = 'ink', className }: ProgressRingProps) {
  const pct = value === null ? 0 : clampPercent(value);
  const r = (size - 5) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(pct)}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={5} className="stroke-surface-3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          className={cn(
            'transition-[stroke-dashoffset] duration-[600ms] ease-out motion-reduce:transition-none',
            stroke[domain],
            pct === 0 && 'opacity-0',
          )}
        />
      </svg>
      <span
        aria-hidden
        className={cn('absolute font-mono tabular text-ink', size === 64 ? 'text-[14px]' : 'text-[11px]')}
      >
        {value === null ? '–' : `${Math.round(pct)}%`}
      </span>
    </div>
  );
}
