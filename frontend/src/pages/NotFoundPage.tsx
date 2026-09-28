import { Wordmark } from '@/components/patterns/TriMark';
import { ButtonLink } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="grid justify-items-start gap-4">
        <Wordmark />
        <p className="font-mono text-[13px] text-ink-3">404</p>
        <h1 className="font-display text-[28px] font-semibold">We couldn’t find that page.</h1>
        <p className="text-ink-2">The link may be old, or the page may have moved.</p>
        <ButtonLink to="/" variant="primary">
          Go to NOVA home
        </ButtonLink>
      </div>
    </main>
  );
}
