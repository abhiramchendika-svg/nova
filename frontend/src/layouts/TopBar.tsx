import { Link, useLocation } from 'react-router';
import { TriMark } from '@/components/patterns/TriMark';
import { ThemeMenu } from '@/features/theme/ThemeMenu';
import { AccountMenu } from './AccountMenu';
import { titleForPath } from './navigation';

/**
 * Sticky top bar. On desktop it carries the page title and global controls;
 * on mobile it also carries the brand mark (the sidebar is hidden there).
 */
export function TopBar() {
  const { pathname } = useLocation();
  const title = titleForPath(pathname);

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:px-6">
      <Link to="/app" className="rounded-sm lg:hidden" aria-label="NOVA home">
        <TriMark size={22} />
      </Link>
      <p className="text-[14.5px] font-semibold" aria-live="polite">
        {title}
      </p>
      <div className="ml-auto flex items-center gap-1">
        <ThemeMenu />
        <AccountMenu />
      </div>
    </header>
  );
}
