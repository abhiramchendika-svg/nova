import { addDays, daysBetween } from '@/lib/dates';

export interface PlannedTopic {
  topic: string;
  date: string;
}

/** The title a revision task gets, so a later plan can tell which topics already have one. */
export const studyTitle = (topic: string) => `Study: ${topic}`;

/**
 * Spreads topics over the days from {@code today} up to the day before the exam, in checklist
 * order, as evenly as the days allow (more topics than days → several on some days; fewer → gaps).
 * Returns an empty list when there's no day left before the exam.
 */
export function planRevision(topics: string[], today: string, examDay: string): PlannedTopic[] {
  const days = daysBetween(today, examDay);
  if (days < 1 || topics.length === 0) return [];
  return topics.map((topic, i) => ({
    topic,
    date: addDays(today, Math.floor((i * days) / topics.length)),
  }));
}
