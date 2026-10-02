import type { GoalStatus, LearningGoal } from '@/features/developer/types';
import { addDays } from '@/lib/dates';
import type { AcademicStore } from './academics';

/** Learning goals for the mock API: ports of LearningService.java's rules. */

export interface StoredGoal {
  id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  targetOn: string | null;
  createdAt: string;
}

export interface StoredTopic {
  id: string;
  goalId: string;
  title: string;
  position: number;
  doneAt: string | null;
}

export interface StoredResource {
  id: string;
  goalId: string;
  title: string;
  url: string;
  createdAt: number;
}

export function orderedGoalTopics(store: AcademicStore, goalId: string): StoredTopic[] {
  return store.learningTopics.filter((t) => t.goalId === goalId).sort((a, b) => a.position - b.position);
}

export function toGoal(store: AcademicStore, g: StoredGoal): LearningGoal {
  const topics = orderedGoalTopics(store, g.id).map((t) => ({
    id: t.id,
    title: t.title,
    position: t.position,
    done: t.doneAt !== null,
    doneAt: t.doneAt,
  }));
  const done = topics.filter((t) => t.done).length;
  const total = topics.length;
  return {
    ...g,
    progress: {
      done,
      total,
      percentage: total === 0 ? null : Math.floor((200 * done + total) / (2 * total)),
    },
    nextTopic: topics.find((t) => !t.done) ?? null,
    openTasks: store.tasks.filter((t) => t.learningGoalId === g.id && t.status !== 'DONE').length,
    topics,
    resources: store.learningResources
      .filter((r) => r.goalId === g.id)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(({ id, title, url }) => ({ id, title, url })),
  };
}

/** A clearly fictional demo goal, relative to today in UTC. */
export function seedDemoLearning(store: AcademicStore, now: Date = new Date()): void {
  const today = now.toISOString().slice(0, 10);
  const id = '00000000-0000-4000-8000-0000000fe001';
  store.learningGoals.push({
    id,
    title: 'Spring Boot',
    description: 'Enough to build and test a REST API on my own.',
    status: 'ACTIVE',
    targetOn: addDays(today, 45),
    createdAt: new Date(now.getTime() - 20 * 86_400_000).toISOString(),
  });
  [
    'Dependency injection',
    'Spring Data JPA',
    'Validation',
    'Spring Security',
    'Testing with MockMvc',
  ].forEach((title, i) =>
    store.learningTopics.push({
      id: `00000000-0000-4000-8000-0000000fe1${String(i).padStart(2, '0')}`,
      goalId: id,
      title,
      position: i,
      doneAt: i < 2 ? new Date(now.getTime() - (10 - i) * 86_400_000).toISOString() : null,
    }),
  );
  store.learningResources.push({
    id: '00000000-0000-4000-8000-0000000fe201',
    goalId: id,
    title: 'Spring Boot reference',
    url: 'https://docs.spring.io/spring-boot/',
    createdAt: 1,
  });
}
