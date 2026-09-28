import { cn } from '@/lib/cn';

export type Domain = 'academics' | 'planner' | 'developer';

const dotColor: Record<Domain, string> = {
  academics: 'bg-academics',
  planner: 'bg-planner',
  developer: 'bg-developer',
};

/** Decorative domain marker. Identity is always also given in text next to it. */
export function DomainDot({ domain, className }: { domain: Domain; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', dotColor[domain], className)}
    />
  );
}
