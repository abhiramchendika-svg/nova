import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ErrorState } from '@/components/patterns/ErrorState';
import { PageSkeleton } from '@/components/patterns/Skeleton';
import { useCurrentUser } from './api';

/**
 * Route guard for /app. Three outcomes:
 *  - session check in flight → skeleton (never a blank screen)
 *  - logged out → redirect to /login, remembering where the user was going
 *  - the check itself failed (network/server) → a retryable error, not a misleading redirect
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: user, isPending, isError, refetch, isFetching } = useCurrentUser();

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
