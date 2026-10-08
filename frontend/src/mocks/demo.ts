import { createAcademicStore, seedDemoAcademics, type AcademicStore } from './academics';
import { seedDemoCoursework } from './coursework';
import { seedDemoProjects } from './developer';
import { seedDemoHackathons } from './hackathons';
import { seedDemoInternships } from './internships';
import { seedDemoLearning } from './learning';
import { seedDemoTasks } from './planner';

/** How long a "Try the demo" account lives (DemoService's default). */
export const DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * The demo's clearly fictional data, relative to {@code now}: three semesters of courses and grades,
 * attendance, assignments, exams, links, tasks, projects, a learning goal, hackathons and internship
 * applications. The backend seeds the same story for a real demo account (DemoSeeder.java).
 */
export function seedDemoStore(now: Date = new Date()): AcademicStore {
  const store = createAcademicStore();
  seedDemoAcademics(store);
  seedDemoCoursework(store, now);
  seedDemoProjects(store, now);
  seedDemoLearning(store, now);
  seedDemoHackathons(store, now);
  seedDemoInternships(store, now);
  seedDemoTasks(store, now);
  return store;
}
