import type { ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'academics' | 'planner' | 'developer' | 'critical' | 'warning' | 'good';

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  academics: 'tint-academics text-academics-text',
  planner: 'tint-planner text-planner-text',
  developer: 'tint-developer text-developer-text',
  critical: 'tint-critical text-critical',
  warning: 'tint-warning text-warning',
  good: 'tint-good text-good',
};

/** Status tones always carry an icon so meaning never depends on colour alone. */
const statusIcon: Partial<Record<BadgeTone, typeof AlertOctagon>> = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  good: CheckCircle2,
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  mono = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  const Icon = statusIcon[tone];
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-xs px-1.5 text-[11.5px] font-semibold',
        mono && 'font-mono font-medium tabular',
        toneClass[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} aria-hidden strokeWidth={2.4} />}
      {children}
    </span>
  );
}
