import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { errorMessage } from '@/services/http';
import { useNotificationPreferences, useSetNotificationType } from './api';
import { TYPE_TEXT } from './text';

/**
 * Settings → Notifications: one switch per type, all on to start. Each switch saves straight away
 * (it isn't part of the settings form above). Switching a type off stops new ones; existing ones stay.
 */
export function NotificationSettings() {
  const prefs = useNotificationPreferences();
  const update = useSetNotificationType();
  const { hash } = useLocation();
  const ref = useRef<HTMLElement>(null);
  const loaded = prefs.isSuccess;
  // "Choose which ones" on the notifications page links here (#notifications)
  useEffect(() => {
    if (hash === '#notifications' && loaded) ref.current?.scrollIntoView?.({ block: 'start' });
  }, [hash, loaded]);
  return (
    <section
      ref={ref}
      id="notifications"
      aria-labelledby="settings-notifications"
      className="grid scroll-mt-20 gap-4 rounded-md border border-line bg-surface p-5"
    >
      <div>
        <h2 id="settings-notifications" className="text-[15px] font-semibold">
          Notifications
        </h2>
        <p className="mt-1 text-[13px] text-ink-2">
          In-app reminders under the bell. Changes save as you switch them.
        </p>
      </div>
      {prefs.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-2">
          <span className="sr-only">Loading notification settings…</span>
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : prefs.isError ? (
        <ErrorState
          title="We couldn’t load your notification settings."
          onRetry={() => void prefs.refetch()}
          retrying={prefs.isFetching}
          requestId={prefs.error.problem.requestId}
        />
      ) : (
        <ul className="grid gap-3.5">
          {prefs.data.types.map(({ type, enabled }) => (
            <li key={type}>
              <Switch
                label={TYPE_TEXT[type].label}
                description={TYPE_TEXT[type].description}
                checked={enabled}
                onCheckedChange={(next) => update.mutate({ type, enabled: next })}
              />
            </li>
          ))}
        </ul>
      )}
      {update.isError && (
        <p role="alert" className="text-[13px] text-critical">
          {errorMessage(update.error)} Your change wasn’t saved.
        </p>
      )}
    </section>
  );
}
