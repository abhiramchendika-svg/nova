import { Search } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { TriMark } from '@/components/patterns/TriMark';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { useSaveTheme } from '@/features/settings/accountTheme';
import { ThemeMenu } from '@/features/theme/ThemeMenu';
import { AccountMenu } from './AccountMenu';
import { titleForPath } from './navigation';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * Sticky top bar. On desktop it carries the page title and global controls;
 * on mobile it also carries the brand mark (the sidebar is hidden there).
 */
export function TopBar({ onSearch }: { onSearch: () => void }) {
  const { pathname } = useLocation();
  const title = titleForPath(pathname);
  const saveTheme = useSaveTheme();

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:px-6">
      <Link to="/app" className="rounded-sm lg:hidden" aria-label="NOVA home">
        <TriMark size={22} />
      </Link>
      <p className="text-[14.5px] font-semibold" aria-live="polite">
        {title}
      </p>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onSearch}
          aria-keyshortcuts="Control+K Meta+K"
          className="flex h-9 items-center gap-2 rounded-sm border border-line bg-surface px-2.5 text-[13px] text-ink-2 hover:text-ink sm:w-56"
        >
          <Search size={15} aria-hidden />
          <span className="sr-only sm:not-sr-only">Search</span>
          <kbd
            aria-hidden
            className="ml-auto hidden rounded-xs border border-line px-1 font-mono text-[11px] text-ink-3 sm:inline"
          >
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
        <NotificationBell />
        <ThemeMenu onChange={saveTheme} />
        <AccountMenu />
      </div>
    </header>
  );
}
