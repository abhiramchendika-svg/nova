import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { Dialog } from '@/components/ui/Dialog';
import { DomainDot } from '@/components/ui/DomainDot';
import { cn } from '@/lib/cn';
import { NAV_SECTIONS, TAB_ITEMS } from './navigation';

const tabClass = (active: boolean) =>
  cn(
    'grid min-h-12 justify-items-center gap-0.5 rounded-sm pt-1.5 text-[10.5px] font-medium',
    active ? 'text-ink' : 'text-ink-3',
  );

/**
 * Mobile/tablet navigation (<1024px): four primary destinations + "More" for the rest.
 * Adapts the hierarchy instead of shrinking the desktop sidebar (ui-design.md §5).
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryPrefixes = TAB_ITEMS.map((t) => t.matchPrefix).filter(Boolean) as string[];
  const inMore = pathname !== '/app' && !primaryPrefixes.some((p) => pathname.startsWith(p));

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface px-1 pb-[calc(4px+env(safe-area-inset-bottom,0px))] lg:hidden"
      >
        {TAB_ITEMS.map(({ label, to, icon: Icon, end, matchPrefix }) => {
          const active = matchPrefix ? pathname.startsWith(matchPrefix) : pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={tabClass(active)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden strokeWidth={active ? 2.3 : 2} />
              {label}
            </NavLink>
          );
        })}
        <button
          type="button"
          className={tabClass(inMore)}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal size={20} aria-hidden />
          More
        </button>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title="Everything in NOVA">
        <nav aria-label="All sections" className="grid gap-4">
          {NAV_SECTIONS.filter((s) => s.label).map((section) => (
            <div key={section.label} className="grid gap-1">
              <p className="label-caps">{section.label}</p>
              <ul className="grid grid-cols-2 gap-1">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex h-11 items-center gap-2.5 rounded-sm px-3 text-[14px]',
                          isActive ? 'bg-surface-3 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2',
                        )
                      }
                    >
                      {item.domain ? (
                        <DomainDot domain={item.domain} />
                      ) : item.icon ? (
                        <item.icon size={16} aria-hidden />
                      ) : null}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Dialog>
    </>
  );
}
