import { http, HttpResponse, type HttpHandler } from 'msw';
import type { SearchHit, SearchResults } from '@/features/search/types';
import type { SettingsRequest } from '@/features/settings/types';
import { formatDay, localParts } from '@/lib/dates';
import { invalid, withStore } from './academicsHandlers';
import type { StoreFor } from './academicsHandlers';
import { API } from './http';

/** Mock search (docs/api.md §2.14): a port of SearchService: contains, starts-with first, then A–Z. */

const label = (value: string) => {
  const words = value.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const join = (...parts: (string | null | undefined)[]) =>
  parts.filter((p) => p && p.trim()).join(' · ') || null;

export function createSearchHandlers(storeFor: StoreFor, settingsFor: () => SettingsRequest): HttpHandler[] {
  return [
    http.get(
      `${API}/search`,
      withStore(storeFor, (store, request) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get('q') ?? '').trim();
        const limit = Number(url.searchParams.get('limit') ?? 5);
        if (q.length < 2) return invalid('q', 'Type at least 2 characters.');
        if (q.length > 100) return invalid('q', 'Keep it under 100 characters.');
        if (!(limit >= 1 && limit <= 10)) return invalid('limit', 'Must be between 1 and 10.');
        const needle = q.toLowerCase();
        const tz = settingsFor().timezone;
        const day = (iso: string) => formatDay(localParts(iso, tz).date);

        function find<T>(
          items: T[],
          primary: (t: T) => string,
          others: ((t: T) => string | null)[],
          hit: (t: T) => SearchHit,
        ) {
          return items
            .filter((t) =>
              [primary(t), ...others.map((o) => o(t))].some((v) => v?.toLowerCase().includes(needle)),
            )
            .sort((a, b) => {
              const sa = primary(a).toLowerCase().startsWith(needle) ? 0 : 1;
              const sb = primary(b).toLowerCase().startsWith(needle) ? 0 : 1;
              return sa - sb || primary(a).toLowerCase().localeCompare(primary(b).toLowerCase());
            })
            .slice(0, limit)
            .map(hit);
        }
        const courseLabel = (id: string) => {
          const c = store.courses.find((x) => x.id === id);
          return c ? (c.code ?? c.name) : null;
        };

        const body: SearchResults = {
          q,
          courses: find(
            store.courses,
            (c) => c.name,
            [(c) => c.code],
            (c) => ({
              id: c.id,
              title: c.name,
              subtitle: c.code,
              link: `/app/academics/courses/${c.id}`,
            }),
          ),
          assignments: find(
            store.assignments,
            (a) => a.title,
            [],
            (a) => ({
              id: a.id,
              title: a.title,
              subtitle: join(courseLabel(a.courseId), `due ${day(a.dueAt)}`, label(a.status)),
              link: `/app/academics/assignments?course=${a.courseId}`,
            }),
          ),
          exams: find(
            store.exams,
            (e) => e.title,
            [],
            (e) => ({
              id: e.id,
              title: e.title,
              subtitle: join(courseLabel(e.courseId), day(e.startsAt)),
              link: `/app/academics/exams/${e.id}`,
            }),
          ),
          tasks: find(
            store.tasks,
            (t) => t.title,
            [],
            (t) => ({
              id: t.id,
              title: t.title,
              subtitle:
                t.status === 'DONE'
                  ? 'Done'
                  : t.plannedFor
                    ? `Planned ${formatDay(t.plannedFor)}`
                    : t.dueAt
                      ? `Due ${day(t.dueAt)}`
                      : 'Unscheduled',
              link: `/app/planner/tasks?task=${t.id}`,
            }),
          ),
          projects: find(
            store.projects,
            (p) => p.name,
            [],
            (p) => ({
              id: p.id,
              title: p.name,
              subtitle: label(p.status),
              link: `/app/developer/projects/${p.id}`,
            }),
          ),
          learningGoals: find(
            store.learningGoals,
            (g) => g.title,
            [],
            (g) => ({
              id: g.id,
              title: g.title,
              subtitle: label(g.status),
              link: `/app/developer/learning/${g.id}`,
            }),
          ),
          hackathons: find(
            store.hackathons,
            (h) => h.name,
            [],
            (h) => ({
              id: h.id,
              title: h.name,
              subtitle: join(h.startsOn ? formatDay(h.startsOn) : null, label(h.status)),
              link: `/app/developer/hackathons/${h.id}`,
            }),
          ),
          internships: find(
            store.internships,
            (i) => i.company,
            [(i) => i.role],
            (i) => ({
              id: i.id,
              title: `${i.role} at ${i.company}`,
              subtitle: label(i.status),
              link: `/app/developer/internships/${i.id}`,
            }),
          ),
        };
        return HttpResponse.json(body);
      }),
    ),
  ];
}
