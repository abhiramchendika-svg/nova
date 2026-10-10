/**
 * The only place the frontend talks to the network.
 *
 * - Same-origin requests to /api/v1 (Vite proxies to Spring Boot in dev; the host rewrites in prod).
 * - Session cookie is sent automatically (credentials: 'same-origin').
 * - CSRF: Spring issues an XSRF-TOKEN cookie; we echo it in the X-XSRF-TOKEN header on
 *   state-changing requests (cookie-to-header pattern). If the token is missing we fetch it,
 *   and if the server rejects it we refresh once and retry.
 * - Errors are normalised into ApiError built from RFC 9457 Problem Details.
 */

export const API_BASE = '/api/v1';
const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';

export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  requestId?: string;
  errors?: FieldError[];
  retryAfterSeconds?: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem: ProblemDetail;

  constructor(status: number, problem: ProblemDetail) {
    super(problem.detail ?? problem.title ?? `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem.code ?? codeForStatus(status);
    this.problem = problem;
  }

  get fieldErrors(): FieldError[] {
    return this.problem.errors ?? [];
  }
}

function codeForStatus(status: number): string {
  if (status === 0) return 'NETWORK';
  if (status === 400) return 'VALIDATION_FAILED';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  // A gateway answering for the backend: usually the free server waking up after a quiet spell
  if (status === 502 || status === 503 || status === 504) return 'UNAVAILABLE';
  return 'INTERNAL';
}

export function readCookie(name: string, cookieString: string = document.cookie): string | null {
  for (const part of cookieString.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function fetchCsrfToken(): Promise<void> {
  await fetch(`${API_BASE}/auth/csrf`, { credentials: 'same-origin' });
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (UNSAFE_METHODS.has(method)) {
    if (!readCookie(CSRF_COOKIE)) await fetchCsrfToken();
    const token = readCookie(CSRF_COOKIE);
    if (token) headers[CSRF_HEADER] = token;
  }

  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetail = {};
  try {
    const text = await response.text();
    if (text) problem = JSON.parse(text) as ProblemDetail;
  } catch {
    // Non-JSON error body (e.g. proxy HTML page); fall back to status-based code.
  }
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter && problem.retryAfterSeconds === undefined && /^\d+$/.test(retryAfter)) {
    problem.retryAfterSeconds = Number(retryAfter);
  }
  return new ApiError(response.status, problem);
}

/** Typed JSON request. Resolves to undefined for 204 No Content. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await send(path, options);
    if (response.status === 403 && UNSAFE_METHODS.has(options.method ?? 'GET')) {
      const error = await toApiError(response.clone());
      if (error.code === 'CSRF_INVALID') {
        await fetchCsrfToken();
        response = await send(path, options);
      }
    }
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(0, { title: 'Network error' });
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  // A "2xx" that isn't JSON came from something in front of the API (e.g. a host's waking-up page)
  if (!(response.headers.get('Content-Type') ?? '').includes('json')) {
    throw new ApiError(503, { title: 'The server isn’t ready yet' });
  }
  return JSON.parse(text) as T;
}

/** Human-readable message for any error, following ui-design.md voice rules. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong on our side. Please try again.';
  switch (error.code) {
    case 'NETWORK':
      return 'We couldn’t reach NOVA. Check your connection and try again.';
    case 'RATE_LIMITED': {
      const s = error.problem.retryAfterSeconds;
      return s
        ? `Too many attempts. Try again in ${s} seconds.`
        : 'Too many attempts. Try again in a minute.';
    }
    case 'UNAUTHENTICATED':
      return 'Your session has ended. Log in again to continue.';
    case 'NOT_FOUND':
      return 'We couldn’t find that.';
    case 'UNAVAILABLE':
      return 'NOVA’s server is waking up after a quiet spell. Give it a minute, then try again.';
    case 'INTERNAL':
      return 'Something went wrong on our side. Please try again.';
    default:
      return error.problem.detail ?? error.problem.title ?? 'That didn’t work. Please try again.';
  }
}
