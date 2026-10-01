import { http, HttpResponse, type HttpHandler } from 'msw';
import type { TaskCategory, TaskRequest, TaskStatus } from '@/features/planner/types';
import type { SettingsRequest } from '@/features/settings/types';
import { addDays, daysBetween, localParts, todayIn, zonedToInstant } from '@/lib/dates';
import type { AcademicStore } from './academics';
import { invalid, notFound, withStore, type StoreFor } from './academicsHandlers';
import { buildCalendar } from './calendar';
import { buildDashboard } from './dashboard';
import { API, problem } from './http';
import {
  isOpenTask,
  localDay,
  nextCreatedAt,
  nextDay,
  rankToday,
  rankWithinDay,
  toTask,
  type StoredTask,
} from './planner';

/** Mock tasks API (docs/api.md §2.9): the same routes, rules and error shapes as TaskController. */

const CATEGORIES: TaskCategory[] = ['ACADEMIC', 'CODING', 'PERSONAL', 'INTERNSHIP', 'OPEN_SOURCE', 'PROJECT'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_UPCOMING_DAYS = 62;
const MAX_BATCH = 30;

type Checked =
  | { error: Response }
  | { fields: Omit<StoredTask, 'id' | 'status' | 'completedAt' | 'seriesId' | 'createdAt'> };

/** Bean validation on TaskRequest plus TaskService.apply; {@code prefix} is "tasks[i]." in a batch. */
function check(store: AcademicStore, body: Partial<TaskRequest>, prefix = ''): Checked {
  const fail = (field: string, message: string) => ({ error: invalid(prefix + field, message) });
  const title = body.title?.trim() ?? '';
  if (!title) return fail('title', 'Give the task a title.');
  if (title.length > 160) return fail('title', 'Keep it under 160 characters.');
  if (body.description && body.description.length > 4000)
    return fail('description', 'Keep notes under 4000 characters.');
  if (body.category && !CATEGORIES.includes(body.category))
    return { error: problem(400, 'MALFORMED_REQUEST', 'Bad category') };
  if (body.plannedStart && !HHMM.test(body.plannedStart))
    return fail('plannedStart', 'Use a time like 18:30.');
  const minutes = body.estimatedMinutes;
  if (
    minutes !== null &&
    minutes !== undefined &&
    !(Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440)
  ) {
    return fail('estimatedMinutes', 'Use 1 to 1440 minutes.');
  }
  const course = body.courseId ? store.courses.find((c) => c.id === body.courseId) : null;
  if (body.courseId && !course) return fail('courseId', 'Choose one of your courses.');
  const exam = body.examId ? store.exams.find((e) => e.id === body.examId) : null;
  if (body.examId && !exam) return fail('examId', 'Choose one of your exams.');
  if (exam && course && exam.courseId !== course.id)
    return fail('examId', 'That exam belongs to another course.');
  const courseId = course?.id ?? exam?.courseId ?? null;
  const project = body.projectId ? store.projects.find((p) => p.id === body.projectId) : null;
  if (body.projectId && !project) return fail('projectId', 'Choose one of your projects.');
  const recurrence = body.recurrence ?? 'NONE';
  if (body.plannedStart && !body.plannedFor) return fail('plannedStart', 'Pick a day before a start time.');
  if (recurrence !== 'NONE' && !body.plannedFor)
    return fail('plannedFor', 'A repeating task needs a day to start from.');
  return {
    fields: {
      title,
      description: body.description?.trim() || null,
      category: body.category ?? (courseId ? 'ACADEMIC' : project ? 'PROJECT' : 'PERSONAL'),
      priority: body.priority ?? 'MEDIUM',
      plannedFor: body.plannedFor ?? null,
      plannedStart: body.plannedStart ?? null,
      dueAt: body.dueAt ? new Date(body.dueAt).toISOString() : null,
      estimatedMinutes: minutes ?? null,
      recurrence,
      courseId,
      examId: exam?.id ?? null,
      projectId: project?.id ?? null,
    },
  };
}

function created(fields: Extract<Checked, { fields: unknown }>['fields']): StoredTask {
  return {
    ...fields,
    id: crypto.randomUUID(),
    status: 'TODO',
    completedAt: null,
    seriesId: fields.recurrence !== 'NONE' ? crypto.randomUUID() : null,
    createdAt: nextCreatedAt(),
  };
}

function paged(url: URL): { page: number; size: number } | Response {
  const page = Number(url.searchParams.get('page') ?? '0');
  const size = Number(url.searchParams.get('size') ?? '20');
  if (!(page >= 0)) return invalid('page', 'Must be 0 or more.');
  if (!(size >= 1 && size <= 100)) return invalid('size', 'Must be between 1 and 100.');
  return { page, size };
}

export function createPlannerHandlers(storeFor: StoreFor, settingsFor: () => SettingsRequest): HttpHandler[] {
  const tz = () => settingsFor().timezone;
  const json = (store: AcademicStore, tasks: StoredTask[]) => {
    const now = new Date();
    return tasks.map((t) => toTask(store, t, now, tz()));
  };
  const page = (store: AcademicStore, all: StoredTask[], p: number, size: number) =>
    HttpResponse.json({
      items: json(store, all.slice(p * size, p * size + size)),
      page: p,
      size,
      totalItems: all.length,
      totalPages: Math.ceil(all.length / size),
    });

  return [
    http.get(
      `${API}/dashboard`,
      withStore(storeFor, (store) => HttpResponse.json(buildDashboard(store, settingsFor()))),
    ),

    http.get(
      `${API}/calendar`,
      withStore(storeFor, (store, request) => {
        const url = new URL(request.url);
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const date = /^\d{4}-\d{2}-\d{2}$/;
        if (!from || !date.test(from)) return problem(400, 'MALFORMED_REQUEST', 'Missing or bad "from"');
        if (!to || !date.test(to)) return problem(400, 'MALFORMED_REQUEST', 'Missing or bad "to"');
        if (to < from) return invalid('to', 'The end date can’t be before the start date.');
        if (daysBetween(from, to) + 1 > MAX_UPCOMING_DAYS)
          return invalid('to', 'Show at most 62 days at once.');
        return HttpResponse.json(buildCalendar(store, from, to, tz()));
      }),
    ),

    // Specific paths first: MSW takes the first matching handler, and "today" would match ":id"
    http.get(
      `${API}/tasks/today`,
      withStore(storeFor, (store, request) => {
        const zone = tz();
        const day = new URL(request.url).searchParams.get('date') || todayIn(zone);
        const now = new Date();
        const dayStart = Date.parse(zonedToInstant(day, '00:00', zone));
        const dayEnd = Date.parse(zonedToInstant(addDays(day, 1), '00:00', zone));
        const open = store.tasks
          .filter(isOpenTask)
          .filter(
            (t) =>
              (t.plannedFor !== null && t.plannedFor <= day) ||
              (t.dueAt !== null && Date.parse(t.dueAt) < dayEnd),
          )
          .sort(rankToday(now, dayEnd));
        const done = store.tasks
          .filter((t) => t.status === 'DONE' && t.completedAt !== null)
          .filter((t) => Date.parse(t.completedAt!) >= dayStart && Date.parse(t.completedAt!) < dayEnd)
          .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
        return HttpResponse.json({ date: day, tasks: json(store, open), completed: json(store, done) });
      }),
    ),

    http.get(
      `${API}/tasks/upcoming`,
      withStore(storeFor, (store, request) => {
        const days = Number(new URL(request.url).searchParams.get('days') ?? '14');
        if (!(Number.isInteger(days) && days >= 1 && days <= MAX_UPCOMING_DAYS)) {
          return invalid('days', `Use 1 to ${MAX_UPCOMING_DAYS} days.`);
        }
        const zone = tz();
        const today = todayIn(zone);
        const last = addDays(today, days);
        const dayEnd = Date.parse(zonedToInstant(addDays(today, 1), '00:00', zone));
        const windowEnd = Date.parse(zonedToInstant(addDays(last, 1), '00:00', zone));
        const byDay = new Map<string, StoredTask[]>();
        for (const t of store.tasks.filter(isOpenTask)) {
          let key: string | null = null;
          if (t.plannedFor !== null) {
            if (t.plannedFor > today && t.plannedFor <= last) key = t.plannedFor;
          } else if (t.dueAt !== null && Date.parse(t.dueAt) >= dayEnd && Date.parse(t.dueAt) < windowEnd) {
            key = localDay(t.dueAt, zone);
          }
          if (key) byDay.set(key, [...(byDay.get(key) ?? []), t]);
        }
        const unscheduled = store.tasks
          .filter((t) => isOpenTask(t) && t.plannedFor === null && t.dueAt === null)
          .sort((a, b) => a.createdAt - b.createdAt);
        return HttpResponse.json({
          from: addDays(today, 1),
          to: last,
          days: [...byDay.entries()]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([date, tasks]) => ({ date, tasks: json(store, [...tasks].sort(rankWithinDay)) })),
          unscheduled: json(store, unscheduled),
        });
      }),
    ),

    http.get(
      `${API}/tasks/completed`,
      withStore(storeFor, (store, request) => {
        const p = paged(new URL(request.url));
        if (p instanceof Response) return p;
        const all = store.tasks
          .filter((t) => t.status === 'DONE')
          .sort(
            (a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!) || a.id.localeCompare(b.id),
          );
        return page(store, all, p.page, p.size);
      }),
    ),

    http.get(
      `${API}/tasks`,
      withStore(storeFor, (store, request) => {
        const url = new URL(request.url);
        const p = paged(url);
        if (p instanceof Response) return p;
        const statuses = url.searchParams.getAll('status') as TaskStatus[];
        const category = url.searchParams.get('category');
        const courseId = url.searchParams.get('courseId');
        const examId = url.searchParams.get('examId');
        const projectId = url.searchParams.get('projectId');
        const sort = url.searchParams.get('sort');
        let compare = (a: StoredTask, b: StoredTask) => b.createdAt - a.createdAt || a.id.localeCompare(b.id);
        if (sort) {
          const [field, direction = 'asc', extra] = sort.split(',').map((x) => x.trim());
          if (
            extra !== undefined ||
            !['plannedFor', 'dueAt', 'createdAt'].includes(field!) ||
            !['asc', 'desc'].includes(direction)
          ) {
            return invalid('sort', 'Sort by plannedFor, dueAt or createdAt, e.g. plannedFor,asc.');
          }
          const sign = direction === 'desc' ? -1 : 1;
          const key = (t: StoredTask): number | string | null =>
            field === 'plannedFor'
              ? t.plannedFor
              : field === 'dueAt'
                ? t.dueAt
                  ? Date.parse(t.dueAt)
                  : null
                : t.createdAt;
          compare = (a, b) => {
            const x = key(a);
            const y = key(b);
            if (x === null || y === null) return x === y ? a.id.localeCompare(b.id) : x === null ? 1 : -1; // nulls last
            return sign * (x < y ? -1 : x > y ? 1 : 0) || a.id.localeCompare(b.id);
          };
        }
        const all = store.tasks
          .filter((t) => statuses.length === 0 || statuses.includes(t.status))
          .filter((t) => !category || t.category === category)
          .filter((t) => !courseId || t.courseId === courseId)
          .filter((t) => !examId || t.examId === examId)
          .filter((t) => !projectId || t.projectId === projectId)
          .sort(compare);
        return page(store, all, p.page, p.size);
      }),
    ),

    http.post(
      `${API}/tasks/batch`,
      withStore(storeFor, async (store, request) => {
        const body = (await request.json()) as { tasks?: Partial<TaskRequest>[] };
        const requests = body.tasks ?? [];
        if (requests.length === 0) return invalid('tasks', 'Add at least one task.');
        if (requests.length > MAX_BATCH) return invalid('tasks', `Add at most ${MAX_BATCH} tasks at once.`);
        const made: StoredTask[] = [];
        for (const [i, r] of requests.entries()) {
          const checked = check(store, r, `tasks[${i}].`);
          if ('error' in checked) return checked.error; // nothing saved yet: all or nothing
          made.push(created(checked.fields));
        }
        store.tasks.push(...made);
        return HttpResponse.json({ tasks: json(store, made) }, { status: 201 });
      }),
    ),

    http.post(
      `${API}/tasks`,
      withStore(storeFor, async (store, request) => {
        const checked = check(store, (await request.json()) as Partial<TaskRequest>);
        if ('error' in checked) return checked.error;
        const task = created(checked.fields);
        store.tasks.push(task);
        return HttpResponse.json(json(store, [task])[0], {
          status: 201,
          headers: { Location: `/api/v1/tasks/${task.id}` },
        });
      }),
    ),

    http.get(
      `${API}/tasks/:id`,
      withStore(storeFor, (store, _request, params) => {
        const task = store.tasks.find((t) => t.id === params.id);
        return task ? HttpResponse.json(json(store, [task])[0]) : notFound();
      }),
    ),

    http.put(
      `${API}/tasks/:id`,
      withStore(storeFor, async (store, request, params) => {
        const task = store.tasks.find((t) => t.id === params.id);
        if (!task) return notFound();
        const checked = check(store, (await request.json()) as Partial<TaskRequest>);
        if ('error' in checked) return checked.error;
        const f = checked.fields;
        if (
          task.seriesId &&
          f.plannedFor &&
          store.tasks.some(
            (t) => t.id !== task.id && t.seriesId === task.seriesId && t.plannedFor === f.plannedFor,
          )
        ) {
          return problem(409, 'CONFLICT', 'Another repeat of this task is already planned for that day.');
        }
        Object.assign(task, f);
        if (f.recurrence !== 'NONE' && !task.seriesId) task.seriesId = crypto.randomUUID();
        return HttpResponse.json(json(store, [task])[0]);
      }),
    ),

    http.patch(
      `${API}/tasks/:id/status`,
      withStore(storeFor, async (store, request, params) => {
        const task = store.tasks.find((t) => t.id === params.id);
        if (!task) return notFound();
        const { status } = (await request.json()) as { status?: TaskStatus };
        if (!status || !['TODO', 'IN_PROGRESS', 'DONE'].includes(status))
          return invalid('status', 'Choose a status.');
        const completing = status === 'DONE' && task.status !== 'DONE';
        if (status === 'DONE') task.completedAt ??= new Date().toISOString();
        else task.completedAt = null;
        task.status = status;
        let next: StoredTask | null = null;
        if (completing && task.recurrence !== 'NONE' && task.plannedFor) {
          const day = nextDay(task.recurrence, task.plannedFor);
          if (!store.tasks.some((t) => t.seriesId === task.seriesId && t.plannedFor === day)) {
            // The deadline moves by the same number of calendar days in the user's timezone
            const shift = daysBetween(task.plannedFor, day);
            let dueAt: string | null = null;
            if (task.dueAt) {
              const { date, time } = localParts(task.dueAt, tz());
              dueAt = zonedToInstant(addDays(date, shift), time, tz());
            }
            next = {
              ...task,
              id: crypto.randomUUID(),
              status: 'TODO',
              completedAt: null,
              plannedFor: day,
              dueAt,
              createdAt: nextCreatedAt(),
            };
            store.tasks.push(next);
          }
        }
        const [t, n] = json(store, next ? [task, next] : [task]);
        return HttpResponse.json({ task: t, nextInstance: n ?? null });
      }),
    ),

    http.delete(
      `${API}/tasks/:id`,
      withStore(storeFor, (store, request, params) => {
        const task = store.tasks.find((t) => t.id === params.id);
        if (!task) return notFound();
        const series = new URL(request.url).searchParams.get('series') === 'true';
        store.tasks = store.tasks.filter((t) => {
          if (t.id === task.id) return false;
          const laterRepeat =
            series &&
            task.seriesId !== null &&
            task.plannedFor !== null &&
            t.seriesId === task.seriesId &&
            isOpenTask(t) &&
            t.plannedFor !== null &&
            t.plannedFor >= task.plannedFor;
          return !laterRepeat;
        });
        return new HttpResponse(null, { status: 204 });
      }),
    ),
  ];
}
