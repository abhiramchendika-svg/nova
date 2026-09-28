import { useLocation } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { titleForPath } from '@/layouts/navigation';

/**
 * Honest placeholder for sections whose feature phase hasn't shipped yet.
 * Keeps navigation complete (so the information architecture can be reviewed)
 * without pretending the feature exists.
 */
export function SectionPlaceholder({ phase }: { phase: string }) {
  const { pathname } = useLocation();
  const title = titleForPath(pathname);
  return (
    <div className="animate-enter mx-auto grid max-w-3xl gap-5 px-4 py-6 lg:px-6">
      <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">{title}</h1>
      <EmptyState
        title={`${title} is on the way.`}
        description={`This section is planned for ${phase} of NOVA’s roadmap. Its navigation is here now so the structure is easy to review.`}
        action={
          <ButtonLink to="/app" size="sm">
            Back to Home
          </ButtonLink>
        }
      />
    </div>
  );
}
