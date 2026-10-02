import { http, HttpResponse, type HttpHandler } from 'msw';
import type { GoalRequest, GoalStatus, ResourceRequest } from '@/features/developer/types';
import type { AcademicStore } from './academics';
import { invalid, notFound, withStore, type StoreFor } from './academicsHandlers';
import { normalizeLink } from './developer';
import { API, problem } from './http';
import { orderedGoalTopics, toGoal, type StoredGoal } from './learning';

/** Mock learning goals API (docs/api.md §2.12): the same routes, rules and errors as LearningController. */

const STATUSES: GoalStatus[] = ['ACTIVE', 'PAUSED', 'DONE'];
const MAX_GOALS = 50;
const MAX_TOPICS = 100;
const MAX_RESOURCES = 20;

function checkGoal(body: Partial<GoalRequest>): Response | Omit<StoredGoal, 'id' | 'createdAt'> {
  const title = body.title?.trim() ?? '';
  if (!title) return invalid('title', 'Name what you’re learning.');
  if (title.length > 100) return invalid('title', 'Keep it under 100 characters.');
  if (body.description && body.description.length > 4000) {
    return invalid('description', 'Keep the description under 4000 characters.');
  }
  if (body.status && !STATUSES.includes(body.status)) return problem(400, 'MALFORMED_REQUEST', 'Bad status');
  return {
    title,
    description: body.description?.trim() || null,
    status: body.status ?? 'ACTIVE',
    targetOn: body.targetOn ?? null,
  };
}

function topicTitle(raw: string | undefined, field = 'title'): Response | string {
  const title = raw?.trim() ?? '';
  if (!title) return invalid(field, 'Name the topic.');
  if (title.length > 160) return invalid(field, 'Keep it under 160 characters.');
  return title;
}

function checkResource(body: Partial<ResourceRequest>): Response | { title: string; url: string } {
  const title = body.title?.trim() ?? '';
  if (!title) return invalid('title', 'Give the link a title.');
  if (title.length > 120) return invalid('title', 'Keep it under 120 characters.');
  const url = normalizeLink(body.url);
  if (!url) return invalid('url', 'Use a full web address starting with http:// or https://.');
  return { title, url };
}

const renumber = (list: { position: number }[]) => list.forEach((t, i) => (t.position = i));

export function createLearningHandlers(storeFor: StoreFor): HttpHandler[] {
  const json = (store: AcademicStore, g: StoredGoal, status = 200) =>
    HttpResponse.json(toGoal(store, g), { status });
  const goalOf = (store: AcademicStore, id: string | undefined) =>
    store.learningGoals.find((g) => g.id === id);

  return [
    http.get(
      `${API}/learning-goals`,
      withStore(storeFor, (store, request) => {
        const statuses = new URL(request.url).searchParams.getAll('status');
        return HttpResponse.json(
          store.learningGoals
            .filter((g) => statuses.length === 0 || statuses.includes(g.status))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((g) => toGoal(store, g)),
        );
      }),
    ),

    http.get(
      `${API}/learning-goals/:id`,
      withStore(storeFor, (store, _request, params) => {
        const g = goalOf(store, params.id);
        return g ? json(store, g) : notFound();
      }),
    ),

    http.post(
      `${API}/learning-goals`,
      withStore(storeFor, async (store, request) => {
        if (store.learningGoals.length >= MAX_GOALS) {
          const message = `You can have up to ${MAX_GOALS} learning goals.`;
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'title', message }] });
        }
        const body = (await request.json()) as Partial<GoalRequest>;
        const checked = checkGoal(body);
        if (checked instanceof Response) return checked;
        const titles: string[] = [];
        for (const [i, raw] of (body.topics ?? []).entries()) {
          const t = topicTitle(raw, `topics[${i}]`);
          if (t instanceof Response) return t;
          titles.push(t);
        }
        if (titles.length > MAX_TOPICS) return invalid('topics', 'Up to 100 topics.');
        const g: StoredGoal = { ...checked, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        store.learningGoals.push(g);
        titles.forEach((title, position) =>
          store.learningTopics.push({ id: crypto.randomUUID(), goalId: g.id, title, position, doneAt: null }),
        );
        return json(store, g, 201);
      }),
    ),

    http.put(
      `${API}/learning-goals/:id`,
      withStore(storeFor, async (store, request, params) => {
        const g = goalOf(store, params.id);
        if (!g) return notFound();
        const checked = checkGoal((await request.json()) as Partial<GoalRequest>);
        if (checked instanceof Response) return checked;
        Object.assign(g, checked);
        return json(store, g);
      }),
    ),

    http.delete(
      `${API}/learning-goals/:id`,
      withStore(storeFor, (store, _request, params) => {
        const g = goalOf(store, params.id);
        if (!g) return notFound();
        store.learningGoals = store.learningGoals.filter((x) => x.id !== g.id);
        store.learningTopics = store.learningTopics.filter((t) => t.goalId !== g.id);
        store.learningResources = store.learningResources.filter((r) => r.goalId !== g.id);
        for (const t of store.tasks) if (t.learningGoalId === g.id) t.learningGoalId = null;
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.post(
      `${API}/learning-goals/:id/topics`,
      withStore(storeFor, async (store, request, params) => {
        const g = goalOf(store, params.id);
        if (!g) return notFound();
        const count = orderedGoalTopics(store, g.id).length;
        if (count >= MAX_TOPICS) {
          const message = `A goal can have up to ${MAX_TOPICS} topics.`;
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'title', message }] });
        }
        const title = topicTitle(((await request.json()) as { title?: string }).title);
        if (title instanceof Response) return title;
        store.learningTopics.push({
          id: crypto.randomUUID(),
          goalId: g.id,
          title,
          position: count,
          doneAt: null,
        });
        return json(store, g, 201);
      }),
    ),

    http.patch(
      `${API}/learning-goals/:id/topics/:topicId`,
      withStore(storeFor, async (store, request, params) => {
        const g = goalOf(store, params.id);
        const t = g && store.learningTopics.find((x) => x.id === params.topicId && x.goalId === g.id);
        if (!g || !t) return notFound();
        const body = (await request.json()) as { done?: boolean; title?: string; position?: number };
        if (body.done === undefined && body.title === undefined && body.position === undefined) {
          return invalid('done', 'Send done, title or position.');
        }
        if (body.title !== undefined) {
          const title = topicTitle(body.title);
          if (title instanceof Response) return title;
          t.title = title;
        }
        if (body.done !== undefined) t.doneAt = body.done ? (t.doneAt ?? new Date().toISOString()) : null;
        if (body.position !== undefined) {
          const ordered = orderedGoalTopics(store, g.id);
          if (body.position < 0 || body.position >= ordered.length) {
            return invalid('position', `Must be between 0 and ${ordered.length - 1}.`);
          }
          const rest = ordered.filter((x) => x.id !== t.id);
          rest.splice(body.position, 0, t);
          renumber(rest);
        }
        return json(store, g);
      }),
    ),

    http.delete(
      `${API}/learning-goals/:id/topics/:topicId`,
      withStore(storeFor, (store, _request, params) => {
        const g = goalOf(store, params.id);
        const t = g && store.learningTopics.find((x) => x.id === params.topicId && x.goalId === g.id);
        if (!g || !t) return notFound();
        store.learningTopics = store.learningTopics.filter((x) => x.id !== t.id);
        renumber(orderedGoalTopics(store, g.id));
        return json(store, g);
      }),
    ),

    http.post(
      `${API}/learning-goals/:id/resources`,
      withStore(storeFor, async (store, request, params) => {
        const g = goalOf(store, params.id);
        if (!g) return notFound();
        if (store.learningResources.filter((r) => r.goalId === g.id).length >= MAX_RESOURCES) {
          const message = `A goal can have up to ${MAX_RESOURCES} links.`;
          return problem(422, 'RULE_VIOLATION', message, { errors: [{ field: 'url', message }] });
        }
        const checked = checkResource((await request.json()) as Partial<ResourceRequest>);
        if (checked instanceof Response) return checked;
        store.learningResources.push({
          ...checked,
          id: crypto.randomUUID(),
          goalId: g.id,
          createdAt: Date.now(),
        });
        return json(store, g, 201);
      }),
    ),

    http.put(
      `${API}/learning-goals/:id/resources/:resourceId`,
      withStore(storeFor, async (store, request, params) => {
        const g = goalOf(store, params.id);
        const r = g && store.learningResources.find((x) => x.id === params.resourceId && x.goalId === g.id);
        if (!g || !r) return notFound();
        const checked = checkResource((await request.json()) as Partial<ResourceRequest>);
        if (checked instanceof Response) return checked;
        Object.assign(r, checked);
        return json(store, g);
      }),
    ),

    http.delete(
      `${API}/learning-goals/:id/resources/:resourceId`,
      withStore(storeFor, (store, _request, params) => {
        const g = goalOf(store, params.id);
        const r = g && store.learningResources.find((x) => x.id === params.resourceId && x.goalId === g.id);
        if (!g || !r) return notFound();
        store.learningResources = store.learningResources.filter((x) => x.id !== r.id);
        return json(store, g);
      }),
    ),
  ];
}
