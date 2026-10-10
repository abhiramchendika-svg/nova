import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { api, ApiError, errorMessage, readCookie } from './http';

describe('readCookie', () => {
  it('finds a cookie among others and decodes it', () => {
    expect(readCookie('XSRF-TOKEN', 'a=1; XSRF-TOKEN=abc%3D%3D; b=2')).toBe('abc==');
  });
  it('returns null when missing', () => {
    expect(readCookie('XSRF-TOKEN', 'a=1')).toBeNull();
  });
});

describe('api()', () => {
  it('treats a gateway timeout as a server that is waking up', async () => {
    server.use(
      http.get(
        '/api/v1/health',
        () =>
          new HttpResponse('<html>Gateway timeout</html>', {
            status: 504,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    );
    const error = await api('/health').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('UNAVAILABLE');
    expect(errorMessage(error)).toBe(
      'NOVA’s server is waking up after a quiet spell. Give it a minute, then try again.',
    );
  });

  it('treats a 200 that is not JSON (a host’s loading page) as not ready, not as data', async () => {
    server.use(
      http.get(
        '/api/v1/health',
        () =>
          new HttpResponse('<html>Starting…</html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    );
    const error = await api('/health').catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('UNAVAILABLE');
  });

  it('keeps an API’s own 502 code (GitHub unreachable) rather than calling it waking up', async () => {
    server.use(
      http.get('/api/v1/github/overview', () =>
        HttpResponse.json({ code: 'UPSTREAM_UNAVAILABLE', title: 'GitHub didn’t answer' }, { status: 502 }),
      ),
    );
    const error = await api('/github/overview').catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('parses JSON on success', async () => {
    server.use(http.get('/api/v1/health', () => HttpResponse.json({ status: 'UP' })));
    await expect(api<{ status: string }>('/health')).resolves.toEqual({ status: 'UP' });
  });

  it('returns undefined for 204', async () => {
    server.use(
      http.get('/api/v1/auth/csrf', () => new HttpResponse(null, { status: 204 })),
      http.post('/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })),
    );
    await expect(api('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('fetches a CSRF token first and sends it on unsafe requests', async () => {
    let seenHeader: string | null = null;
    server.use(
      http.get('/api/v1/auth/csrf', () => {
        document.cookie = 'XSRF-TOKEN=token-123; path=/';
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('/api/v1/things', ({ request }) => {
        seenHeader = request.headers.get('X-XSRF-TOKEN');
        return HttpResponse.json({ ok: true }, { status: 201 });
      }),
    );
    await api('/things', { method: 'POST', body: { a: 1 } });
    expect(seenHeader).toBe('token-123');
  });

  it('refreshes the token and retries once when the server says CSRF_INVALID', async () => {
    document.cookie = 'XSRF-TOKEN=stale; path=/';
    let attempts = 0;
    server.use(
      http.get('/api/v1/auth/csrf', () => {
        document.cookie = 'XSRF-TOKEN=fresh; path=/';
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('/api/v1/things', ({ request }) => {
        attempts += 1;
        if (request.headers.get('X-XSRF-TOKEN') !== 'fresh') {
          return HttpResponse.json({ status: 403, code: 'CSRF_INVALID' }, { status: 403 });
        }
        return HttpResponse.json({ ok: true });
      }),
    );
    await expect(api('/things', { method: 'POST' })).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it('turns Problem Details into ApiError with code and field errors', async () => {
    server.use(
      http.get('/api/v1/bad', () =>
        HttpResponse.json(
          {
            status: 400,
            code: 'VALIDATION_FAILED',
            title: 'Some fields need attention',
            errors: [{ field: 'credits', message: 'must be ≥ 0' }],
          },
          { status: 400 },
        ),
      ),
    );
    const error = await api('/bad').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe('VALIDATION_FAILED');
    expect(apiError.fieldErrors).toEqual([{ field: 'credits', message: 'must be ≥ 0' }]);
  });

  it('falls back to a status-based code for non-JSON errors and reads Retry-After', async () => {
    server.use(
      http.get(
        '/api/v1/busy',
        () => new HttpResponse('<html>busy</html>', { status: 429, headers: { 'Retry-After': '30' } }),
      ),
    );
    const error = (await api('/busy').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('RATE_LIMITED');
    expect(errorMessage(error)).toBe('Too many attempts. Try again in 30 seconds.');
  });

  it('reports network failures as a human message, never a stack trace', async () => {
    server.use(http.get('/api/v1/down', () => HttpResponse.error()));
    const error = (await api('/down').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('NETWORK');
    expect(errorMessage(error)).toMatch(/couldn’t reach NOVA/);
  });

  it('hides internal errors behind a generic message', () => {
    expect(errorMessage(new ApiError(500, { detail: 'NullPointerException at ...' }))).toBe(
      'Something went wrong on our side. Please try again.',
    );
    expect(errorMessage(new Error('boom'))).toBe('Something went wrong on our side. Please try again.');
  });
});
