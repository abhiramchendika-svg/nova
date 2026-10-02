import { http, HttpResponse, type HttpHandler } from 'msw';
import type { NotificationType } from '@/features/notifications/types';
import type { SettingsRequest } from '@/features/settings/types';
import { invalid, notFound, withStore } from './academicsHandlers';
import type { StoreFor } from './academicsHandlers';
import { API } from './http';
import { generateNotifications, newestFirst, NOTIFICATION_TYPES, toNotification } from './notifications';
import type { AcademicStore } from './academics';

/** Mock notifications (docs/api.md §2.15): a port of NotificationController / NotificationService. */
export function createNotificationHandlers(
  storeFor: StoreFor,
  settingsFor: () => SettingsRequest,
): HttpHandler[] {
  const preferences = (store: AcademicStore) => ({
    types: NOTIFICATION_TYPES.map((type) => ({ type, enabled: !store.notificationMutes.includes(type) })),
  });

  return [
    http.get(
      `${API}/notifications/unread-count`,
      withStore(storeFor, (store) => {
        generateNotifications(store, settingsFor());
        return HttpResponse.json({ count: store.notifications.filter((n) => !n.read).length });
      }),
    ),

    http.get(
      `${API}/notifications`,
      withStore(storeFor, (store, request) => {
        generateNotifications(store, settingsFor());
        const url = new URL(request.url);
        const unread = url.searchParams.get('unread') === 'true';
        const page = Number(url.searchParams.get('page') ?? 0);
        const size = Number(url.searchParams.get('size') ?? 20);
        if (!(page >= 0)) return invalid('page', 'Must be 0 or more.');
        if (!(size >= 1 && size <= 100)) return invalid('size', 'Must be between 1 and 100.');
        const all = store.notifications.filter((n) => !unread || !n.read).sort(newestFirst);
        return HttpResponse.json({
          items: all.slice(page * size, page * size + size).map(toNotification),
          page,
          size,
          totalItems: all.length,
          totalPages: Math.ceil(all.length / size),
        });
      }),
    ),

    http.patch(
      `${API}/notifications/:id`,
      withStore(storeFor, async (store, request, params) => {
        const n = store.notifications.find((x) => x.id === params.id);
        if (!n) return notFound();
        const body = (await request.json()) as { read?: unknown };
        if (typeof body.read !== 'boolean') return invalid('read', 'Say whether it’s read.');
        if (!body.read) {
          n.read = false;
          n.readAt = null;
        } else if (!n.read) {
          n.read = true;
          n.readAt = new Date().toISOString();
        }
        return HttpResponse.json(toNotification(n));
      }),
    ),

    http.post(
      `${API}/notifications/read-all`,
      withStore(storeFor, (store) => {
        const now = new Date().toISOString();
        let updated = 0;
        for (const n of store.notifications.filter((x) => !x.read)) {
          n.read = true;
          n.readAt = now;
          updated += 1;
        }
        return HttpResponse.json({ updated });
      }),
    ),

    http.get(
      `${API}/settings/notifications`,
      withStore(storeFor, (store) => HttpResponse.json(preferences(store))),
    ),

    http.patch(
      `${API}/settings/notifications`,
      withStore(storeFor, async (store, request) => {
        const body = (await request.json()) as { enabled?: Record<string, unknown> };
        const entries = Object.entries(body.enabled ?? {});
        if (entries.length === 0) return invalid('enabled', 'Choose at least one type.');
        for (const [type, value] of entries) {
          if (!NOTIFICATION_TYPES.includes(type as NotificationType) || typeof value !== 'boolean') {
            return invalid('enabled', 'Use true or false for each type.');
          }
        }
        for (const [type, value] of entries) {
          const t = type as NotificationType;
          store.notificationMutes = store.notificationMutes.filter((x) => x !== t);
          if (value === false) store.notificationMutes.push(t);
        }
        return HttpResponse.json(preferences(store));
      }),
    ),
  ];
}
