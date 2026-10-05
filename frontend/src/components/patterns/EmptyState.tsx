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
  titleAs: Title = 'p',
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
  /** 'h1' when the state is the whole page (e.g. "We couldn’t find that course."), so the page keeps a heading. */
  titleAs?: 'p' | 'h1' | 'h2';
}) {
  return (
    <div
      data-empty-state
      className={cn(
        'grid justify-items-start gap-2 rounded-md border border-dashed border-line-strong',
        compact ? 'p-4' : 'p-6',
        className,
      )}
    >
      <Title className={cn('font-semibold text-ink', compact ? 'text-[14px]' : 'text-[15px]')}>{title}</Title>
      {description && <p className="max-w-[52ch] text-[13px] leading-relaxed text-ink-2">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
