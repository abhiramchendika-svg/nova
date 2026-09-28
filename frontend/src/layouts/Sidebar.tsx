import { NavLink } from 'react-router';
import { Wordmark, TriMark } from '@/components/patterns/TriMark';
import { DomainDot } from '@/components/ui/DomainDot';
import { Tooltip } from '@/components/ui/Tooltip';
import { MEDIA, useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';
import { NAV_SECTIONS, type NavItem } from './navigation';

/**
 * Desktop navigation.
 *  - ≥1280px (xl): expanded 232px sidebar with section labels
 *  - 1024–1279px (lg): 64px icon rail with tooltips
 *  - <1024px: hidden (BottomNav takes over)
 */
export function Sidebar() {
  const isExpanded = useMediaQuery(MEDIA.xl);
  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface px-3 py-4 lg:flex lg:w-16 xl:w-[232px]">
      <div className="px-1.5 pb-4 pt-1 xl:px-2">
        <span className="hidden xl:inline-flex">
          <Wordmark />
        </span>
        <span className="inline-flex xl:hidden">
          <TriMark size={26} label="NOVA" />
        </span>
      </div>
      <nav aria-label="Main" className="grid gap-0.5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label ?? 'top'} className="grid gap-0.5">
            {section.label && (
              <>
                <p className="label-caps hidden px-2.5 pb-1.5 pt-3 xl:block">{section.label}</p>
                <div className="mx-auto my-2 hidden h-px w-6 bg-line lg:block xl:hidden" aria-hidden />
              </>
            )}
            {section.items.map((item) => (
              <SidebarLink key={item.to} item={item} isExpanded={isExpanded} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function SidebarLink({ item, isExpanded }: { item: NavItem; isExpanded: boolean }) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex h-8 items-center gap-2.5 rounded-sm text-[13.5px] transition-colors duration-[var(--dur-1)]',
          'justify-center xl:justify-start xl:px-2.5',
          isActive
            ? 'bg-surface-3 font-medium text-ink before:absolute before:inset-y-[7px] before:-left-3 before:w-0.5 before:rounded-full before:bg-ink xl:before:left-0'
            : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      {Icon ? (
        <Icon size={16} aria-hidden />
      ) : item.domain ? (
        <DomainDot domain={item.domain} className="size-[7px]" />
      ) : null}
      <span className="sr-only xl:not-sr-only">{item.label}</span>
    </NavLink>
  );
  // Tooltips only matter on the rail, where labels are visually hidden.
  return isExpanded ? (
    link
  ) : (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  );
}
