import { http, HttpResponse, type HttpHandler } from 'msw';
import type { InternshipRequest, InternshipStatus } from '@/features/developer/types';
import type { SettingsRequest } from '@/features/settings/types';
import { todayIn } from '@/lib/dates';
import type { AcademicStore } from './academics';
import { invalid, notFound, withStore, type StoreFor } from './academicsHandlers';
import { normalizeLink } from './developer';
import { API, problem } from './http';
import { analytics, listOrder, toInternship, type StoredInternship } from './internships';

/** Mock internships API (docs/api.md §2.12): the same routes, rules and errors as InternshipController. */

const STATUSES: InternshipStatus[] = [
  'SAVED',
  'APPLIED',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
];
const MAX_APPLICATIONS = 1000;

type Fields = Omit<StoredInternship, 'id' | 'createdAt' | 'updatedAt' | 'status'>;

function check(body: Partial<InternshipRequest>): Response | Fields {
  const company = body.company?.trim() ?? '';
  if (!company) return invalid('company', 'Name the company.');
  if (company.length > 120) return invalid('company', 'Keep it under 120 characters.');
  const role = body.role?.trim() ?? '';
  if (!role) return invalid('role', 'Name the role.');
  if (role.length > 120) return invalid('role', 'Keep it under 120 characters.');
  const limits: [keyof InternshipRequest, number][] = [
    ['location', 120],
    ['source', 60],
    ['nextStep', 120],
    ['resumeVersion', 60],
  ];
  for (const [field, max] of limits) {
    const v = body[field];
    if (typeof v === 'string' && v.length > max) return invalid(field, `Keep it under ${max} characters.`);
  }
  if (body.notes && body.notes.length > 4000) return invalid('notes', 'Keep notes under 4000 characters.');
  if (body.status && !STATUSES.includes(body.status)) return problem(400, 'MALFORMED_REQUEST', 'Bad status');
  const jobUrl = normalizeLink(body.jobUrl);
  if (jobUrl === undefined)
    return invalid('jobUrl', 'Use a full web address starting with http:// or https://.');
  const blank = (v: string | null | undefined) => v?.trim() || null;
  return {
    company,
    role,
    location: blank(body.location),
    jobUrl,
    source: blank(body.source),
    appliedOn: body.appliedOn ?? null,
    deadlineAt: body.deadlineAt ? new Date(body.deadlineAt).toISOString() : null,
    nextStep: blank(body.nextStep),
    nextStepAt: body.nextStepAt ? new Date(body.nextStepAt).toISOString() : null,
    resumeVersion: blank(body.resumeVersion),
    notes: blank(body.notes),
  };
}

export function createInternshipHandlers(
  storeFor: StoreFor,
  settingsFor: () => SettingsRequest,
): HttpHandler[] {
  const today = () => todayIn(settingsFor().timezone);
  const json = (store: AcademicStore, i: StoredInternship, status = 200) =>
    HttpResponse.json(toInternship(store, i, new Date()), { status });
  const find = (store: AcademicStore, id: string | undefined) => store.internships.find((i) => i.id === id);

  /** Internship.moveTo + InternshipService.move: fill the applied date, record a real change. */
  const move = (store: AcademicStore, i: StoredInternship, status: InternshipStatus) => {
    const previous = i.status;
    i.status = status;
    if (status !== 'SAVED' && !i.appliedOn) i.appliedOn = today();
    if (previous !== status) {
      store.internshipEvents.push({
        applicationId: i.id,
        fromStatus: previous,
        toStatus: status,
        changedAt: new Date().toISOString(),
      });
    }
    i.updatedAt = new Date().toISOString();
  };

  return [
    http.get(
      `${API}/internships`,
      withStore(storeFor, (store, request) => {
        const url = new URL(request.url);
        const statuses = url.searchParams.getAll('status');
        const page = Number(url.searchParams.get('page') ?? 0);
        const size = Number(url.searchParams.get('size') ?? 20);
        if (!(page >= 0)) return invalid('page', 'Must be 0 or more.');
        if (!(size >= 1 && size <= 100)) return invalid('size', 'Must be between 1 and 100.');
        const all = store.internships
          .filter((i) => statuses.length === 0 || statuses.includes(i.status))
          .sort(listOrder);
        const now = new Date();
        return HttpResponse.json({
          items: all.slice(page * size, page * size + size).map((i) => toInternship(store, i, now)),
          page,
          size,
          totalItems: all.length,
          totalPages: Math.ceil(all.length / size),
        });
      }),
    ),

    http.get(
      `${API}/internships/analytics`,
      withStore(storeFor, (store, request) => {
        const month = new URL(request.url).searchParams.get('month') || today().slice(0, 7);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return invalid('month', 'Use a month like 2026-09.');
        return HttpResponse.json(analytics(store, month));
      }),
    ),

    http.get(
      `${API}/internships/:id`,
      withStore(storeFor, (store, _request, params) => {
        const i = find(store, params.id);
        return i ? json(store, i) : notFound();
      }),
    ),

    http.post(
      `${API}/internships`,
      withStore(storeFor, async (store, request) => {
        if (store.internships.length >= MAX_APPLICATIONS) {
          const message = `You can have up to ${MAX_APPLICATIONS} applications.`;
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'company', message }] });
        }
        const body = (await request.json()) as Partial<InternshipRequest>;
        const checked = check(body);
        if (checked instanceof Response) return checked;
        const status = body.status ?? 'APPLIED';
        const now = new Date().toISOString();
        const i: StoredInternship = {
          ...checked,
          id: crypto.randomUUID(),
          status,
          appliedOn: checked.appliedOn ?? (status !== 'SAVED' ? today() : null),
          createdAt: now,
          updatedAt: now,
        };
        store.internships.push(i);
        store.internshipEvents.push({
          applicationId: i.id,
          fromStatus: null,
          toStatus: status,
          changedAt: now,
        });
        return json(store, i, 201);
      }),
    ),

    http.put(
      `${API}/internships/:id`,
      withStore(storeFor, async (store, request, params) => {
        const i = find(store, params.id);
        if (!i) return notFound();
        const body = (await request.json()) as Partial<InternshipRequest>;
        const checked = check(body);
        if (checked instanceof Response) return checked;
        // A missing applied date keeps the one already set
        Object.assign(i, { ...checked, appliedOn: checked.appliedOn ?? i.appliedOn });
        if (i.status !== 'SAVED' && !i.appliedOn) i.appliedOn = today();
        if (body.status) move(store, i, body.status);
        i.updatedAt = new Date().toISOString();
        return json(store, i);
      }),
    ),

    http.patch(
      `${API}/internships/:id/status`,
      withStore(storeFor, async (store, request, params) => {
        const i = find(store, params.id);
        if (!i) return notFound();
        const body = (await request.json()) as { status?: InternshipStatus };
        if (!body.status) return invalid('status', 'Choose a status.');
        if (!STATUSES.includes(body.status)) return problem(400, 'MALFORMED_REQUEST', 'Bad status');
        move(store, i, body.status);
        return json(store, i);
      }),
    ),

    http.delete(
      `${API}/internships/:id`,
      withStore(storeFor, (store, _request, params) => {
        const i = find(store, params.id);
        if (!i) return notFound();
        store.internships = store.internships.filter((x) => x.id !== i.id);
        store.internshipEvents = store.internshipEvents.filter((e) => e.applicationId !== i.id);
        for (const t of store.tasks) if (t.internshipId === i.id) t.internshipId = null;
        return new HttpResponse(null, { status: 204 });
      }),
    ),
  ];
}
