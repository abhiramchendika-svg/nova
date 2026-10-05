import { Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { PageSkeleton } from '@/components/patterns/Skeleton';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { CommandPalette } from '@/features/search/CommandPalette';
import { ThemeSync } from '@/features/settings/ThemeSync';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Authenticated app frame: sidebar/rail (desktop) or bottom bar (mobile), top bar, content, ⌘K search. */
export function AppShell() {
  const [searching, setSearching] = useState(false);

  // ⌘K / Ctrl+K anywhere in the app opens search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-dvh bg-bg">
        <ThemeSync />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
        >
          Skip to content
        </a>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onSearch={() => setSearching(true)} />
          <main id="main" tabIndex={-1} className="flex-1 pb-24 outline-none lg:pb-10">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <BottomNav />
        <CommandPalette open={searching} onOpenChange={setSearching} />
      </div>
    </TooltipProvider>
  );
}
