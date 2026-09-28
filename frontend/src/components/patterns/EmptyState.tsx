import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Typographic empty state: a heading, one sentence, an optional action.
 * Copy should be specific to the area (see ui-design.md §9), never "No data".
 */
export function EmptyState({
  title,
  description,
  action,
  compact = false,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid justify-items-start gap-2 rounded-md border border-dashed border-line-strong',
        compact ? 'p-4' : 'p-6',
        className,
      )}
    >
      <p className={cn('font-semibold text-ink', compact ? 'text-[14px]' : 'text-[15px]')}>{title}</p>
      {description && <p className="max-w-[52ch] text-[13px] leading-relaxed text-ink-2">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
