import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

export function StepHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em]">{title}</h1>
      {children && <p className="max-w-[60ch] text-[14px] leading-relaxed text-ink-2">{children}</p>}
    </div>
  );
}

/** Back on the left, the step's own actions on the right. */
export function Actions({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" onClick={onBack}>
        Back
      </Button>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
