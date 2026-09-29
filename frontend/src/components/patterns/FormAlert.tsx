import { AlertOctagon } from 'lucide-react';

/** Form-level error announced to screen readers as soon as it appears. */
export function FormAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="tint-critical flex items-start gap-2 rounded-sm px-3 py-2.5 text-[13px] text-critical"
    >
      <AlertOctagon size={16} className="mt-px shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
