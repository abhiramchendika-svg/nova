import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/services/http';
import type {
  Notification,
  NotificationPage,
  NotificationPreferences,
  NotificationType,
  UnreadCount,
} from './types';

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: () => ['notifications', 'unread-count'] as const,
  list: (unreadOnly: boolean, page: number, size: number) =>
    ['notifications', 'list', { unreadOnly, page, size }] as const,
  preferences: () => ['notifications', 'preferences'] as const,
};

/** How often the bell checks for new notifications while the tab is visible. */
export const POLL_MS = 60_000;

/**
 * The bell's unread count. Polls every minute, but only while the tab is visible (TanStack pauses
 * interval refetches in the background), and refreshes when you come back to the tab.
 */
export function useUnreadCount() {
  return useQuery<UnreadCount, ApiError>({
    queryKey: notificationKeys.unread(),
    queryFn: ({ signal }) => api<UnreadCount>('/notifications/unread-count', { signal }),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useNotifications(unreadOnly: boolean, page: number, size: number, enabled = true) {
  return useQuery<NotificationPage, ApiError>({
    queryKey: notificationKeys.list(unreadOnly, page, size),
    queryFn: ({ signal }) =>
      api<NotificationPage>(`/notifications?unread=${unreadOnly}&page=${page}&size=${size}`, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}

export function useMarkRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation<Notification, ApiError, { id: string; read: boolean }>({
    mutationFn: ({ id, read }) =>
      api<Notification>(`/notifications/${id}`, { method: 'PATCH', body: { read } }),
    onSuccess: invalidate,
  });
}

export function useMarkAllRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation<{ updated: number }, ApiError, void>({
    mutationFn: () => api<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useNotificationPreferences() {
  return useQuery<NotificationPreferences, ApiError>({
    queryKey: notificationKeys.preferences(),
    queryFn: ({ signal }) => api<NotificationPreferences>('/settings/notifications', { signal }),
  });
}

/** Changes one type; the switch shows the new value straight away and rolls back if saving fails. */
export function useSetNotificationType() {
  const queryClient = useQueryClient();
  const key = notificationKeys.preferences();
  return useMutation<
    NotificationPreferences,
    ApiError,
    { type: NotificationType; enabled: boolean },
    { previous?: NotificationPreferences }
  >({
    mutationFn: ({ type, enabled }) =>
      api<NotificationPreferences>('/settings/notifications', {
        method: 'PATCH',
        body: { enabled: { [type]: enabled } },
      }),
    onMutate: async ({ type, enabled }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationPreferences>(key);
      if (previous) {
        queryClient.setQueryData<NotificationPreferences>(key, {
          types: previous.types.map((t) => (t.type === type ? { ...t, enabled } : t)),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (saved) => queryClient.setQueryData(key, saved),
  });
}
