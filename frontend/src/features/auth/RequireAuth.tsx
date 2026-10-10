import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ErrorState } from '@/components/patterns/ErrorState';
import { PageSkeleton } from '@/components/patterns/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { useCurrentUser } from './api';

/** The free server sleeps when nobody uses it; say so while the session check keeps retrying. */
function WakingUp() {
  return (
    <div className="mx-auto grid max-w-md gap-3 p-6 pt-16 text-center" role="status" aria-live="polite">
      <span className="mx-auto text-ink-3">
        <Spinner size={22} />
      </span>
      <h1 className="font-display text-[20px] font-semibold">Waking up NOVA’s server…</h1>
      <p className="text-[14px] text-ink-2">
        The free server sleeps when nobody is using it. This usually takes about a minute, and the page will
        continue by itself.
      </p>
    </div>
  );
}

/**
 * Route guard for /app. Three outcomes:
 *  - session check in flight → skeleton (never a blank screen), or "waking up" while the server starts
 *  - logged out → redirect to /login, remembering where the user was going
 *  - the check itself failed (network/server) → a retryable error, not a misleading redirect
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: user, isPending, isError, refetch, isFetching, failureReason } = useCurrentUser();

  if (isPending && failureReason?.code === 'UNAVAILABLE') return <WakingUp />;
  if (isPending) return <PageSkeleton label="Checking your session" />;

  if (isError) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorState
          title="We couldn’t check your session."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </div>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}
