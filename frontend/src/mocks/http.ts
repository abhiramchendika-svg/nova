import { HttpResponse } from 'msw';

/** Shared helpers for the mock API handlers. */

export const API = '/api/v1';
export const CSRF_TOKEN = 'mock-csrf-token';

export function problem(status: number, code: string, title: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json(
    {
      type: `https://nova.dev/problems/${code.toLowerCase()}`,
      title,
      status,
      code,
      requestId: 'mock',
      ...extra,
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export function csrfOk(request: Request): boolean {
  return request.headers.get('X-XSRF-TOKEN') === CSRF_TOKEN;
}
