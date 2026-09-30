import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { localParts, todayIn } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useCreateAssignment, useUpdateAssignment } from './api';
import { PRIORITY_LABEL } from './assignmentText';
import { assignmentSchema, toAssignmentRequest, type AssignmentValues } from './schemas';
import type { Assignment } from './types';

/** Server field → form field. The due date and time are one instant on the server. */
const SERVER_FIELDS: Record<string, keyof AssignmentValues> = {
  courseId: 'courseId',
  title: 'title',
  dueAt: 'dueDate',
  priority: 'priority',
  estimatedMinutes: 'estimatedMinutes',
  description: 'description',
};

export interface CourseChoice {
  id: string;
  code: string | null;
  name: string;
}

export interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Courses the assignment can belong to (the current semester's). */
  courses: CourseChoice[];
  /** The user's timezone: "due 23:59" means 23:59 there. */
  timezone: string;
  /** Edit this assignment; omit to add one. */
  assignment?: Assignment;
  /** Pre-selected course when adding (e.g. from a course page). */
  defaultCourseId?: string;
}

function defaults(timezone: string, assignment?: Assignment, defaultCourseId?: string): AssignmentValues {
  if (assignment) {
    const { date, time } = localParts(assignment.dueAt, timezone);
    return {
      courseId: assignment.courseId,
      title: assignment.title,
      dueDate: date,
      dueTime: time,
      priority: assignment.priority,
      estimatedMinutes: assignment.estimatedMinutes === null ? '' : String(assignment.estimatedMinutes),
      description: assignment.description ?? '',
    };
  }
  return {
    courseId: defaultCourseId ?? '',
    title: '',
    dueDate: todayIn(timezone),
    dueTime: '23:59',
    priority: 'MEDIUM',
    estimatedMinutes: '',
    description: '',
  };
}

const courseLabel = (c: CourseChoice) => (c.code ? `${c.code} · ${c.name}` : c.name);

export function AssignmentDialog({
  open,
  onOpenChange,
  courses,
  timezone,
  assignment,
  defaultCourseId,
}: AssignmentDialogProps) {
  const create = useCreateAssignment();
  const update = useUpdateAssignment();
  const mutation = assignment ? update : create;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AssignmentValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: defaults(timezone, assignment, defaultCourseId),
  });

  useEffect(() => {
    if (open) {
      reset(defaults(timezone, assignment, defaultCourseId));
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, assignment?.id]);

  // An assignment from an older semester keeps its course as a choice while it's edited
  const choices =
    assignment && !courses.some((c) => c.id === assignment.courseId)
      ? [...courses, { id: assignment.courseId, code: assignment.courseCode, name: assignment.courseName }]
      : courses;

  const onSubmit = handleSubmit((values) => {
    const body = toAssignmentRequest(values, timezone);
    const options = {
      onSuccess: () => onOpenChange(false),
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          const name = SERVER_FIELDS[fe.field];
          if (name) setError(name, { message: fe.message });
        }
      },
    };
    if (assignment) update.mutate({ id: assignment.id, body }, options);
    else create.mutate(body, options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'assignment-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={assignment ? 'Edit assignment' : 'Add an assignment'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {assignment ? 'Save changes' : 'Add assignment'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <Field
          label="Title"
          placeholder="Lab report 3"
          error={errors.title?.message}
          {...register('title')}
        />
        <SelectField label="Course" error={errors.courseId?.message} {...register('courseId')}>
          <option value="" disabled>
            Choose a course
          </option>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {courseLabel(c)}
            </option>
          ))}
        </SelectField>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Due date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
          <Field
            label="Due time"
            type="time"
            hint={`In your time zone (${timezone})`}
            error={errors.dueTime?.message}
            {...register('dueTime')}
          />
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <SelectField label="Priority" error={errors.priority?.message} {...register('priority')}>
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </SelectField>
          <Field
            label="Estimate in minutes (optional)"
            inputMode="numeric"
            error={errors.estimatedMinutes?.message}
            {...register('estimatedMinutes')}
          />
        </div>
        <TextAreaField
          label="Notes (optional)"
          error={errors.description?.message}
          {...register('description')}
        />
      </form>
    </Dialog>
  );
}
