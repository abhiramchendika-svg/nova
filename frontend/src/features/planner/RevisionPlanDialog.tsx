import type { ExamDetail } from '@/features/academics/types';
import { localParts } from '@/lib/dates';
import { studyTitle } from './revisionPlan';
import { StudyPlanDialog } from './StudyPlanDialog';

/**
 * "Plan my revision": the exam's unfinished topics spread over the days before the exam, linked to
 * the exam and its course.
 */
export function RevisionPlanDialog({
  open,
  onOpenChange,
  exam,
  existingTitles,
  timezone,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamDetail;
  /** Titles of the exam's tasks so far, so topics already planned are skipped. */
  existingTitles: string[];
  timezone: string;
  onSaved?: (count: number) => void;
}) {
  return (
    <StudyPlanDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Plan your revision"
      topics={exam.topics}
      existingTitles={existingTitles}
      endDay={localParts(exam.startsAt, timezone).date}
      endLabel="the day before the exam"
      emptyChecklist="Add topics to the prep checklist first, then plan them here."
      noDaysLeft="There’s no day left before the exam to plan."
      toRequest={(topic, plannedFor, estimatedMinutes) => ({
        title: studyTitle(topic),
        description: null,
        category: null,
        priority: 'MEDIUM',
        plannedFor,
        plannedStart: null,
        dueAt: null,
        estimatedMinutes,
        recurrence: 'NONE',
        courseId: exam.courseId,
        examId: exam.id,
        projectId: null,
        learningGoalId: null,
        hackathonId: null,
      })}
      timezone={timezone}
      onSaved={onSaved}
    />
  );
}
