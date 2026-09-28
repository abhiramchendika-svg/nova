import { cn } from '@/lib/cn';

/**
 * NOVA's logo mark: three points, one per domain (Academics, Planner, Developer).
 * Decorative by default; pass a label when it stands alone as the brand name.
 */
export function TriMark({
  size = 24,
  label,
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d="M6 17 12 5l6.5 11" fill="none" stroke="var(--line-strong)" strokeWidth="1.4" />
      <circle cx="12" cy="5" r="3" fill="var(--academics)" />
      <circle cx="6" cy="17" r="3" fill="var(--planner)" />
      <circle cx="18.5" cy="16" r="3" fill="var(--developer)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-[0.02em]',
        className,
      )}
    >
      <TriMark />
      NOVA
    </span>
  );
}
