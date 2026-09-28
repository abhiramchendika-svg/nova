import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Human-readable error with a retry. Shows the request id in small mono so a bug
 * report can be matched to server logs; never shows raw status codes or stack traces.
 */
export function ErrorState({
  title,
  description = 'Check your connection and try again.',
  onRetry,
  retrying = false,
  requestId,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  requestId?: string;
}) {
  return (
    <div role="alert" className="grid justify-items-start gap-2 rounded-md border border-line bg-surface p-5">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="text-[13px] text-ink-2">{description}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry} loading={retrying} className="mt-1">
          <RotateCw size={14} aria-hidden />
          Try again
        </Button>
      )}
      {requestId && <p className="font-mono text-[11px] text-ink-3">Reference: {requestId}</p>}
    </div>
  );
}
