import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { DomainDot, type Domain } from './DomainDot';

export interface PanelProps {
  title: string;
  /** Optional domain hue shown as a dot before the title. */
  domain?: Domain;
  /** Trailing header content, e.g. a "View all" link or a count chip. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Heading level for document outline; panels on a page are usually h2. */
  headingLevel?: 'h2' | 'h3';
}

/**
 * A content panel: surface, hairline border, no shadow (see ui-design.md §6).
 * Rendered as a labelled <section> so it appears as a region to assistive tech.
 */
export function Panel({ title, domain, action, children, className, headingLevel = 'h2' }: PanelProps) {
  const Heading = headingLevel;
  const headingId = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn('min-w-0 rounded-md border border-line bg-surface p-5', className)}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {domain && <DomainDot domain={domain} />}
        <Heading id={headingId} className="text-[15px] font-semibold leading-tight">
          {title}
        </Heading>
        {action && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}
