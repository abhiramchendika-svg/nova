import { http, HttpResponse, type HttpHandler } from 'msw';
import type { SettingsRequest } from '@/features/settings/types';
import { invalid, withStore } from './academicsHandlers';
import type { StoreFor } from './academicsHandlers';
import { API } from './http';
import { buildInsights } from './insights';

/** Mock insights (docs/api.md §2.14): a port of InsightController. */
export function createInsightHandlers(storeFor: StoreFor, settingsFor: () => SettingsRequest): HttpHandler[] {
  return [
    http.get(
      `${API}/insights`,
      withStore(storeFor, (store, request) => {
        const raw = (new URL(request.url).searchParams.get('window') ?? 'WEEK').trim().toUpperCase();
        if (raw !== 'WEEK' && raw !== 'MONTH') return invalid('window', 'Use WEEK or MONTH.');
        return HttpResponse.json(buildInsights(store, settingsFor(), raw));
      }),
    ),
  ];
}
