import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useCurrentUser, useLogout } from '@/features/auth/api';
import { timeLeft } from './api';

/**
 * Shown on every app page of a demo account: what it is, when it goes, and the way to a real one.
 * Leaving logs out first, because the demo session would otherwise stay signed in.
 */
export function DemoBanner() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!user?.demoExpiresAt) return null;

  return (
    <aside
      aria-label="Demo account"
      className="tint-developer flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2 text-[13px] md:px-6"
    >
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">You’re in a demo.</strong> Everything here is made up, and this
        account is deleted {timeLeft(user.demoExpiresAt)}.
      </p>
      <Button
        size="sm"
        variant="ghost"
        loading={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/register') })}
      >
        Create your own account
      </Button>
    </aside>
  );
}
