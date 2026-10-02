import { http, HttpResponse, type HttpHandler } from 'msw';
import type { HackathonMode, HackathonRequest, HackathonStatus } from '@/features/developer/types';
import type { SettingsRequest } from '@/features/settings/types';
import type { AcademicStore } from './academics';
import { invalid, notFound, withStore, type StoreFor } from './academicsHandlers';
import { normalizeLink } from './developer';
import { listOrder, toHackathon, type StoredHackathon } from './hackathons';
import { API, problem } from './http';

/** Mock hackathons API (docs/api.md §2.12): the same routes, rules and errors as HackathonController. */

const STATUSES: HackathonStatus[] = [
  'INTERESTED',
  'REGISTERED',
  'PARTICIPATING',
  'SUBMITTED',
  'FINISHED',
  'SKIPPED',
];
const MODES: HackathonMode[] = ['ONLINE', 'OFFLINE', 'HYBRID'];
const MAX_HACKATHONS = 100;
const LINK_MESSAGE = 'Use a full web address starting with http:// or https://.';

type Fields = Omit<StoredHackathon, 'id' | 'createdAt'>;

function check(store: AcademicStore, body: Partial<HackathonRequest>): Response | Fields {
  const name = body.name?.trim() ?? '';
  if (!name) return invalid('name', 'Name the hackathon.');
  if (name.length > 120) return invalid('name', 'Keep it under 120 characters.');
  const limits: [keyof HackathonRequest, number][] = [
    ['organizer', 120],
    ['location', 120],
    ['teamName', 80],
    ['teamMembers', 500],
    ['result', 160],
  ];
  for (const [field, max] of limits) {
    const v = body[field];
    if (typeof v === 'string' && v.length > max) return invalid(field, `Keep it under ${max} characters.`);
  }
  if (body.notes && body.notes.length > 4000) return invalid('notes', 'Keep notes under 4000 characters.');
  if (body.status && !STATUSES.includes(body.status)) return problem(400, 'MALFORMED_REQUEST', 'Bad status');
  if (body.mode && !MODES.includes(body.mode)) return problem(400, 'MALFORMED_REQUEST', 'Bad mode');
  const startsOn = body.startsOn ?? null;
  const endsOn = body.endsOn ?? null;
  if (endsOn && !startsOn) return invalid('startsOn', 'Add the start date too.');
  if (endsOn && startsOn && endsOn < startsOn)
    return invalid('endsOn', 'The end date can’t be before the start date.');
  const registration = body.registrationDeadline ? new Date(body.registrationDeadline).toISOString() : null;
  const submission = body.submissionDeadline ? new Date(body.submissionDeadline).toISOString() : null;
  if (registration && submission && Date.parse(registration) > Date.parse(submission)) {
    return invalid('registrationDeadline', 'Registration should close before submissions do.');
  }
  const links: Partial<Record<'websiteUrl' | 'repoUrl' | 'demoUrl' | 'certificateUrl', string | null>> = {};
  for (const field of ['websiteUrl', 'repoUrl', 'demoUrl', 'certificateUrl'] as const) {
    const url = normalizeLink(body[field]);
    if (url === undefined) return invalid(field, LINK_MESSAGE);
    links[field] = url;
  }
  const project = body.projectId ? store.projects.find((p) => p.id === body.projectId) : null;
  if (body.projectId && !project) return invalid('projectId', 'Choose one of your projects.');
  const blank = (v: string | null | undefined) => v?.trim() || null;
  return {
    name,
    organizer: blank(body.organizer),
    mode: body.mode ?? null,
    location: blank(body.location),
    websiteUrl: links.websiteUrl ?? null,
    startsOn,
    endsOn,
    registrationDeadline: registration,
    submissionDeadline: submission,
    status: body.status ?? 'INTERESTED',
    teamName: blank(body.teamName),
    teamMembers: blank(body.teamMembers),
    projectId: project?.id ?? null,
    result: blank(body.result),
    repoUrl: links.repoUrl ?? null,
    demoUrl: links.demoUrl ?? null,
    certificateUrl: links.certificateUrl ?? null,
    notes: blank(body.notes),
  };
}

export function createHackathonHandlers(
  storeFor: StoreFor,
  settingsFor: () => SettingsRequest,
): HttpHandler[] {
  const json = (store: AcademicStore, h: StoredHackathon, status = 200) =>
    HttpResponse.json(toHackathon(store, h, new Date(), settingsFor().timezone), { status });
  const find = (store: AcademicStore, id: string | undefined) => store.hackathons.find((h) => h.id === id);

  return [
    http.get(
      `${API}/hackathons`,
      withStore(storeFor, (store, request) => {
        const statuses = new URL(request.url).searchParams.getAll('status');
        const now = new Date();
        const tz = settingsFor().timezone;
        return HttpResponse.json(
          store.hackathons
            .filter((h) => statuses.length === 0 || statuses.includes(h.status))
            .map((h) => toHackathon(store, h, now, tz))
            .sort(listOrder),
        );
      }),
    ),

    http.get(
      `${API}/hackathons/:id`,
      withStore(storeFor, (store, _request, params) => {
        const h = find(store, params.id);
        return h ? json(store, h) : notFound();
      }),
    ),

    http.post(
      `${API}/hackathons`,
      withStore(storeFor, async (store, request) => {
        if (store.hackathons.length >= MAX_HACKATHONS) {
          const message = `You can have up to ${MAX_HACKATHONS} hackathons.`;
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'name', message }] });
        }
        const checked = check(store, (await request.json()) as Partial<HackathonRequest>);
        if (checked instanceof Response) return checked;
        const h: StoredHackathon = {
          ...checked,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        store.hackathons.push(h);
        return json(store, h, 201);
      }),
    ),

    http.put(
      `${API}/hackathons/:id`,
      withStore(storeFor, async (store, request, params) => {
        const h = find(store, params.id);
        if (!h) return notFound();
        const checked = check(store, (await request.json()) as Partial<HackathonRequest>);
        if (checked instanceof Response) return checked;
        Object.assign(h, checked);
        return json(store, h);
      }),
    ),

    http.delete(
      `${API}/hackathons/:id`,
      withStore(storeFor, (store, _request, params) => {
        const h = find(store, params.id);
        if (!h) return notFound();
        store.hackathons = store.hackathons.filter((x) => x.id !== h.id);
        for (const t of store.tasks) if (t.hackathonId === h.id) t.hackathonId = null;
        return new HttpResponse(null, { status: 204 });
      }),
    ),
  ];
}
