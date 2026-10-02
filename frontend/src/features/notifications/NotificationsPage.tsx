import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button } from '@/components/ui/Button';
import { DomainDot } from '@/components/ui/DomainDot';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from './api';
import { timeAgo, TYPE_TEXT } from './text';
import type { Notification } from './types';

const PAGE_SIZE = 20;
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Every notification, newest first, with an Unread filter in the URL (?show=unread). */
export function NotificationsPage() {
  const [params] = useSearchParams();
  const unreadOnly = params.get('show') === 'unread';
  // A new filter starts at the first page (the key resets the paging state)
  return <NotificationList key={String(unreadOnly)} unreadOnly={unreadOnly} />;
}

function NotificationList({ unreadOnly }: { unreadOnly: boolean }) {
  const [page, setPage] = useState(0);
  const list = useNotifications(unreadOnly, page, PAGE_SIZE);
  const unread = useUnreadCount();
  const markAll = useMarkAllRead();
  const timezone = useSettings().data?.timezone ?? browserZone();
  const [announcement, setAnnouncement] = useState('');
  const unreadCount = unread.data?.count ?? 0;

  return (
    <div className="animate-enter mx-auto grid max-w-3xl gap-5 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Notifications</h1>
          <p className="mt-1 text-ink-2">
            Reminders from your deadlines, exams, attendance and applications.{' '}
            <Link to="/app/settings#notifications" className="underline underline-offset-2">
              Choose which ones
            </Link>
          </p>
        </div>
        <Button
          disabled={unreadCount === 0}
          loading={markAll.isPending}
          onClick={() =>
            markAll.mutate(undefined, {
              onSuccess: ({ updated }) =>
                setAnnouncement(
                  `Marked ${updated} ${updated === 1 ? 'notification' : 'notifications'} read.`,
                ),
            })
          }
        >
          <CheckCheck size={15} aria-hidden />
          Mark all read
        </Button>
      </header>

      <nav aria-label="Show" className="flex gap-1 border-b border-line">
        {[
          { label: 'All', to: '?', current: !unreadOnly },
          {
            label: unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread',
            to: '?show=unread',
            current: unreadOnly,
          },
        ].map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            replace
            aria-current={tab.current ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium',
              tab.current ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {list.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading your notifications…</span>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : list.isError ? (
        <ErrorState
          title="We couldn’t load your notifications."
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
          requestId={list.error.problem.requestId}
        />
      ) : list.data.totalItems === 0 ? (
        unreadOnly ? (
          <EmptyState title="You’re all caught up." description="Nothing unread." />
        ) : (
          <EmptyState
            title="No notifications yet."
            description="NOVA checks every hour for deadlines in the next 24 hours, exams in the next 3 days, attendance that slips, and interviews tomorrow."
          />
        )
      ) : (
        <>
          <ul
            aria-label="Notifications"
            className="divide-y divide-line rounded-md border border-line bg-surface"
          >
            {list.data.items.map((n) => (
              <Row key={n.id} n={n} timezone={timezone} onChanged={setAnnouncement} />
            ))}
          </ul>
          {list.data.totalPages > 1 && (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <span>
                Page {page + 1} of {list.data.totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page + 1 >= list.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Older
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  n,
  timezone,
  onChanged,
}: {
  n: Notification;
  timezone: string;
  onChanged: (text: string) => void;
}) {
  const markRead = useMarkRead();
  const toggle = () =>
    markRead.mutate(
      { id: n.id, read: !n.read },
      { onSuccess: () => onChanged(`Marked “${n.title}” ${n.read ? 'unread' : 'read'}.`) },
    );
  const title = (
    <>
      {n.title}
      {!n.read && <span className="sr-only"> (unread)</span>}
    </>
  );
  return (
    <li className={cn('flex items-start gap-3 px-4 py-3', !n.read && 'bg-surface-2/60')}>
      <DomainDot domain={TYPE_TEXT[n.type].domain} className="mt-2" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className={cn('text-[14px] text-ink', !n.read && 'font-semibold')}>
          {n.link ? (
            <Link
              to={n.link}
              className="hover:underline"
              onClick={() => !n.read && markRead.mutate({ id: n.id, read: true })}
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </p>
        {n.body && <p className="text-[13px] text-ink-2">{n.body}</p>}
        <p className="text-[12px] text-ink-3">
          {TYPE_TEXT[n.type].label} · {timeAgo(n.createdAt, timezone)}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={toggle}
        aria-label={`Mark “${n.title}” ${n.read ? 'unread' : 'read'}`}
      >
        {n.read ? 'Mark unread' : 'Mark read'}
      </Button>
    </li>
  );
}
