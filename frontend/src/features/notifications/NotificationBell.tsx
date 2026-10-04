import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { DomainDot } from '@/components/ui/DomainDot';
import { IconButton } from '@/components/ui/IconButton';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from './api';
import { badgeCount, timeAgo, TYPE_TEXT } from './text';
import type { Notification } from './types';

/** How many the bell shows; the rest are on the notifications page. */
export const BELL_SIZE = 8;

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const itemClass =
  'flex cursor-pointer gap-2.5 rounded-sm px-2 py-2 text-left outline-none data-[highlighted]:bg-surface-2';

/**
 * The bell in the top bar: the unread count (checked every minute while the tab is visible) and,
 * when opened, the latest notifications. Choosing one marks it read and opens what it's about.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const latest = useNotifications(false, 0, BELL_SIZE, open);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const navigate = useNavigate();
  const timezone = useSettings().data?.timezone ?? browserZone();
  const count = unread.data?.count ?? 0;

  const choose = (n: Notification) => {
    if (!n.read) markRead.mutate({ id: n.id, read: true });
    if (n.link) void navigate(n.link);
  };

  return (
    // Non-modal, like the other top-bar menus: the page stays readable to assistive tech while it is open
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger asChild>
        <IconButton label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}>
          <Bell size={17} aria-hidden />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold leading-none text-on-primary"
            >
              {badgeCount(count)}
            </span>
          )}
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          aria-label="Notifications"
          className="z-50 grid w-[22rem] max-w-[calc(100vw-2rem)] gap-0.5 rounded-md border border-line bg-surface p-1 shadow-pop"
        >
          <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-1.5">
            <DropdownMenu.Label className="text-[13.5px] font-semibold text-ink">
              Notifications
            </DropdownMenu.Label>
            {count > 0 && (
              <DropdownMenu.Item
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-[12.5px] text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink"
                onSelect={(e) => {
                  e.preventDefault(); // stay open to show them all read
                  markAll.mutate();
                }}
              >
                <CheckCheck size={14} aria-hidden />
                Mark all read
              </DropdownMenu.Item>
            )}
          </div>
          <DropdownMenu.Separator className="h-px bg-line" />
          {latest.isPending ? (
            <p role="status" className="px-2 py-6 text-center text-[13px] text-ink-3">
              Loading…
            </p>
          ) : latest.isError ? (
            <p role="alert" className="px-2 py-6 text-center text-[13px] text-ink-2">
              We couldn’t load your notifications.
            </p>
          ) : latest.data.items.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-ink-2">
              You’re all caught up. Reminders for deadlines, exams and attendance show up here.
            </p>
          ) : (
            <div className="grid max-h-[min(26rem,60vh)] gap-0.5 overflow-y-auto">
              {latest.data.items.map((n) => (
                <DropdownMenu.Item
                  key={n.id}
                  className={itemClass}
                  onSelect={() => choose(n)}
                  aria-label={[
                    n.read ? n.title : `${n.title} (unread)`,
                    n.body,
                    timeAgo(n.createdAt, timezone),
                  ]
                    .filter(Boolean)
                    .join('. ')}
                >
                  <DomainDot domain={TYPE_TEXT[n.type].domain} className="mt-1.5" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className={cn('text-[13.5px] text-ink', !n.read && 'font-semibold')}>
                      {n.title}
                    </span>
                    {n.body && <span className="text-[12.5px] text-ink-2">{n.body}</span>}
                    <span className="text-[12px] text-ink-3">{timeAgo(n.createdAt, timezone)}</span>
                  </span>
                  {!n.read && <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" />}
                </DropdownMenu.Item>
              ))}
            </div>
          )}
          <DropdownMenu.Separator className="h-px bg-line" />
          <DropdownMenu.Item
            className="flex h-8 cursor-pointer items-center justify-center rounded-sm px-2 text-[13px] font-medium text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink"
            onSelect={() => void navigate('/app/notifications')}
          >
            See all notifications
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
