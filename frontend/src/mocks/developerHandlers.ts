import { http, HttpResponse, type HttpHandler } from 'msw';
import type { MilestoneRequest, ProjectRequest, ProjectStatus } from '@/features/developer/types';
import type { SettingsRequest } from '@/features/settings/types';
import type { AcademicStore } from './academics';
import { invalid, notFound, withStore, type StoreFor } from './academicsHandlers';
import {
  normalizeLink,
  normalizeStack,
  orderedMilestones,
  renumberMilestones,
  toProject,
  type StoredProject,
} from './developer';
import { API, problem } from './http';

/** Mock projects API (docs/api.md §2.12): the same routes, rules and error shapes as ProjectController. */

const STATUSES: ProjectStatus[] = ['IDEA', 'PLANNING', 'DEVELOPMENT', 'COMPLETED', 'ARCHIVED'];
const MAX_PROJECTS = 100;
const MAX_MILESTONES = 100;

function checkProject(body: Partial<ProjectRequest>): Response | Omit<StoredProject, 'id' | 'createdAt'> {
  const name = body.name?.trim() ?? '';
  if (!name) return invalid('name', 'Name the project.');
  if (name.length > 100) return invalid('name', 'Keep it under 100 characters.');
  if (body.description && body.description.length > 4000) {
    return invalid('description', 'Keep the description under 4000 characters.');
  }
  if (body.status && !STATUSES.includes(body.status)) return problem(400, 'MALFORMED_REQUEST', 'Bad status');
  const stack = normalizeStack(body.techStack);
  if ('error' in stack) return invalid('techStack', stack.error);
  const repoUrl = normalizeLink(body.repoUrl);
  if (repoUrl === undefined)
    return invalid('repoUrl', 'Use a full web address starting with http:// or https://.');
  const demoUrl = normalizeLink(body.demoUrl);
  if (demoUrl === undefined)
    return invalid('demoUrl', 'Use a full web address starting with http:// or https://.');
  if (body.startedOn && body.targetOn && body.targetOn < body.startedOn) {
    return invalid('targetOn', 'The target date can’t be before the start date.');
  }
  return {
    name,
    description: body.description?.trim() || null,
    techStack: stack.stack,
    repoUrl,
    demoUrl,
    status: body.status ?? 'IDEA',
    startedOn: body.startedOn ?? null,
    targetOn: body.targetOn ?? null,
  };
}

function checkMilestone(body: Partial<MilestoneRequest>): Response | { title: string; dueOn: string | null } {
  const title = body.title?.trim() ?? '';
  if (!title) return invalid('title', 'Name the milestone.');
  if (title.length > 160) return invalid('title', 'Keep it under 160 characters.');
  return { title, dueOn: body.dueOn ?? null };
}

export function createDeveloperHandlers(
  storeFor: StoreFor,
  settingsFor: () => SettingsRequest,
): HttpHandler[] {
  const json = (store: AcademicStore, p: StoredProject, status = 200) =>
    HttpResponse.json(toProject(store, p, settingsFor().timezone), { status });

  return [
    http.get(
      `${API}/projects`,
      withStore(storeFor, (store, request) => {
        const statuses = new URL(request.url).searchParams.getAll('status');
        const tz = settingsFor().timezone;
        return HttpResponse.json(
          store.projects
            .filter((p) => statuses.length === 0 || statuses.includes(p.status))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((p) => toProject(store, p, tz)),
        );
      }),
    ),

    http.get(
      `${API}/projects/:id`,
      withStore(storeFor, (store, _request, params) => {
        const p = store.projects.find((x) => x.id === params.id);
        return p ? json(store, p) : notFound();
      }),
    ),

    http.post(
      `${API}/projects`,
      withStore(storeFor, async (store, request) => {
        if (store.projects.length >= MAX_PROJECTS) {
          const message = `You can have up to ${MAX_PROJECTS} projects.`;
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'name', message }] });
        }
        const checked = checkProject((await request.json()) as Partial<ProjectRequest>);
        if (checked instanceof Response) return checked;
        const p: StoredProject = { ...checked, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        store.projects.push(p);
        return json(store, p, 201);
      }),
    ),

    http.put(
      `${API}/projects/:id`,
      withStore(storeFor, async (store, request, params) => {
        const p = store.projects.find((x) => x.id === params.id);
        if (!p) return notFound();
        const checked = checkProject((await request.json()) as Partial<ProjectRequest>);
        if (checked instanceof Response) return checked;
        Object.assign(p, checked);
        return json(store, p);
      }),
    ),

    http.delete(
      `${API}/projects/:id`,
      withStore(storeFor, (store, _request, params) => {
        const index = store.projects.findIndex((x) => x.id === params.id);
        if (index < 0) return notFound();
        store.projects.splice(index, 1);
        store.milestones = store.milestones.filter((m) => m.projectId !== params.id);
        for (const t of store.tasks) if (t.projectId === params.id) t.projectId = null;
        for (const h of store.hackathons) if (h.projectId === params.id) h.projectId = null;
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.post(
      `${API}/projects/:id/milestones`,
      withStore(storeFor, async (store, request, params) => {
        const p = store.projects.find((x) => x.id === params.id);
        if (!p) return notFound();
        const count = orderedMilestones(store, p.id).length;
        if (count >= MAX_MILESTONES) {
          const message = `A project can have up to ${MAX_MILESTONES} milestones.`;
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'title', message }] });
        }
        const checked = checkMilestone((await request.json()) as Partial<MilestoneRequest>);
        if (checked instanceof Response) return checked;
        store.milestones.push({
          ...checked,
          id: crypto.randomUUID(),
          projectId: p.id,
          position: count,
          doneAt: null,
        });
        return json(store, p, 201);
      }),
    ),

    http.put(
      `${API}/projects/:id/milestones/:milestoneId`,
      withStore(storeFor, async (store, request, params) => {
        const p = store.projects.find((x) => x.id === params.id);
        const m = p && store.milestones.find((x) => x.id === params.milestoneId && x.projectId === p.id);
        if (!p || !m) return notFound();
        const checked = checkMilestone((await request.json()) as Partial<MilestoneRequest>);
        if (checked instanceof Response) return checked;
        Object.assign(m, checked);
        return json(store, p);
      }),
    ),

    http.patch(
      `${API}/projects/:id/milestones/:milestoneId`,
      withStore(storeFor, async (store, request, params) => {
        const p = store.projects.find((x) => x.id === params.id);
        const m = p && store.milestones.find((x) => x.id === params.milestoneId && x.projectId === p.id);
        if (!p || !m) return notFound();
        const body = (await request.json()) as { done?: boolean; position?: number };
        if (body.done === undefined && body.position === undefined)
          return invalid('done', 'Send done or position.');
        if (body.done !== undefined) m.doneAt = body.done ? (m.doneAt ?? new Date().toISOString()) : null;
        if (body.position !== undefined) {
          const ordered = orderedMilestones(store, p.id);
          if (body.position < 0 || body.position >= ordered.length) {
            return invalid('position', `Must be between 0 and ${ordered.length - 1}.`);
          }
          const rest = ordered.filter((x) => x.id !== m.id);
          rest.splice(body.position, 0, m);
          renumberMilestones(rest);
        }
        return json(store, p);
      }),
    ),

    http.delete(
      `${API}/projects/:id/milestones/:milestoneId`,
      withStore(storeFor, (store, _request, params) => {
        const p = store.projects.find((x) => x.id === params.id);
        const m = p && store.milestones.find((x) => x.id === params.milestoneId && x.projectId === p.id);
        if (!p || !m) return notFound();
        store.milestones = store.milestones.filter((x) => x.id !== m.id);
        renumberMilestones(orderedMilestones(store, p.id));
        return json(store, p);
      }),
    ),
  ];
}
