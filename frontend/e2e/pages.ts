import type { Page } from '@playwright/test';
import { demoIds } from './support';

/** Every in-app page and view, with the demo account's first record for detail pages. */
export async function appPaths(page: Page): Promise<string[]> {
  const ids = await demoIds(page);
  return [
    '/app',
    '/app/academics/courses',
    `/app/academics/courses/${ids.course}`,
    '/app/academics/assignments',
    '/app/academics/exams',
    `/app/academics/exams/${ids.exam}`,
    '/app/academics/timetable',
    '/app/academics/attendance',
    '/app/academics/grades',
    '/app/academics/grades/schemes',
    '/app/planner/tasks',
    '/app/planner/tasks?view=upcoming',
    '/app/planner/tasks?view=done',
    '/app/planner/calendar',
    '/app/planner/calendar?view=month',
    '/app/developer/projects',
    `/app/developer/projects/${ids.project}`,
    '/app/developer/learning',
    `/app/developer/learning/${ids.goal}`,
    '/app/developer/hackathons',
    `/app/developer/hackathons/${ids.hackathon}`,
    '/app/developer/internships',
    `/app/developer/internships/${ids.internship}`,
    '/app/developer/github',
    '/app/insights',
    '/app/insights?window=month',
    '/app/notifications',
    '/app/settings',
  ];
}
