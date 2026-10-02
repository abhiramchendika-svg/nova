import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { useCourses, useExams, useSemesters } from '@/features/academics/api';
import { pickSemester } from '@/features/academics/selection';
import { useProjects } from '@/features/developer/api';
import type { ProjectStatus } from '@/features/developer/types';
import { localParts } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useCreateTask, useUpdateTask } from './api';
import { taskSchema, toTaskRequest, type TaskValues } from './schemas';
import { CATEGORIES, CATEGORY_LABEL, PRIORITY_LABEL, RECURRENCE_LABEL } from './taskText';
import type { Recurrence, Task } from './types';

/** Server field → form field. The deadline is one instant on the server. */
const SERVER_FIELDS: Record<string, keyof TaskValues> = {
  title: 'title',
  description: 'description',
  category: 'category',
  priority: 'priority',
  plannedFor: 'plannedFor',
  plannedStart: 'plannedStart',
  dueAt: 'dueDate',
  estimatedMinutes: 'estimatedMinutes',
  recurrence: 'recurrence',
  courseId: 'courseId',
  examId: 'examId',
  projectId: 'projectId',
};

/** Projects a new task can join; a task's existing link is kept as a choice even if it's finished. */
const ACTIVE_PROJECTS: ProjectStatus[] = ['IDEA', 'PLANNING', 'DEVELOPMENT'];

const RECURRENCES: Recurrence[] = ['NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY'];

const EMPTY: TaskValues = {
  title: '',
  description: '',
  category: '',
  priority: 'MEDIUM',
  plannedFor: '',
  plannedStart: '',
  dueDate: '',
  dueTime: '',
  estimatedMinutes: '',
  recurrence: 'NONE',
  courseId: '',
  examId: '',
  projectId: '',
  learningGoalId: '',
};

function valuesOf(task: Task, timezone: string): TaskValues {
  const due = task.dueAt ? localParts(task.dueAt, timezone) : null;
  return {
    title: task.title,
    description: task.description ?? '',
    category: task.category,
    priority: task.priority,
    plannedFor: task.plannedFor ?? '',
    plannedStart: task.plannedStart ?? '',
    dueDate: due?.date ?? '',
    dueTime: due?.time ?? '',
    estimatedMinutes: task.estimatedMinutes === null ? '' : String(task.estimatedMinutes),
    recurrence: task.recurrence,
    courseId: task.courseId ?? '',
    examId: task.examId ?? '',
    projectId: task.projectId ?? '',
    learningGoalId: task.learningGoalId ?? '',
  };
}

export interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user's timezone: a start time or deadline means that time there. */
  timezone: string;
  /** Edit this task; omit to add one. */
  task?: Task;
  /** Starting values when adding (e.g. the exam and course from an exam page). */
  initial?: Partial<TaskValues>;
  /** An exam to always offer (e.g. the exam page's own, which may already be past). */
  examChoice?: { id: string; courseId: string; title: string };
  /** A project to always offer (e.g. the project page's own, which may be completed). */
  projectChoice?: { id: string; name: string };
  /** Called with the saved task's title, for an announcement. */
  onSaved?: (title: string) => void;
}

export function TaskDialog({
  open,
  onOpenChange,
  timezone,
  task,
  initial,
  examChoice,
  projectChoice,
  onSaved,
}: TaskDialogProps) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const mutation = task ? update : create;
  const semesters = useSemesters();
  const current = pickSemester(semesters.data ?? [], null);
  const courses = useCourses(current?.id);
  const exams = useExams({ upcoming: true }, open);
  const projects = useProjects(ACTIVE_PROJECTS, open);

  const defaults = () => (task ? valuesOf(task, timezone) : { ...EMPTY, ...initial });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<TaskValues>({ resolver: zodResolver(taskSchema), defaultValues: defaults() });

  useEffect(() => {
    if (open) {
      reset(defaults());
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, task?.id]);

  // Course and exam options arrive after the form is reset; a select can't show a value it has no
  // option for, so put the chosen ones back once the options are there
  useEffect(() => {
    if (open) {
      setValue('courseId', getValues('courseId'));
      setValue('examId', getValues('examId'));
      setValue('projectId', getValues('projectId'));
    }
  }, [open, courses.data, exams.data, projects.data, setValue, getValues]);

  const courseId = useWatch({ control, name: 'courseId' });
  const plannedFor = useWatch({ control, name: 'plannedFor' });

  // A task linked to an older semester's course, or a past exam, keeps that link as a choice
  const courseChoices = (courses.data ?? []).map((c) => ({
    id: c.id,
    label: c.code ? `${c.code} · ${c.name}` : c.name,
  }));
  if (task?.courseId && !courseChoices.some((c) => c.id === task.courseId)) {
    courseChoices.push({ id: task.courseId, label: task.courseCode ?? task.courseName ?? 'Linked course' });
  }
  const allExams = (exams.data ?? []).map((e) => ({ id: e.id, courseId: e.courseId, label: e.title }));
  if (examChoice && !allExams.some((e) => e.id === examChoice.id)) {
    allExams.push({ id: examChoice.id, courseId: examChoice.courseId, label: examChoice.title });
  }
  if (task?.examId && !allExams.some((e) => e.id === task.examId)) {
    allExams.push({ id: task.examId, courseId: task.courseId ?? '', label: task.examTitle ?? 'Linked exam' });
  }
  const projectChoices = (projects.data ?? []).map((p) => ({ id: p.id, label: p.name }));
  for (const extra of [
    projectChoice && { id: projectChoice.id, label: projectChoice.name },
    task?.projectId && { id: task.projectId, label: task.projectName ?? 'Linked project' },
  ]) {
    if (extra && !projectChoices.some((p) => p.id === extra.id)) projectChoices.push(extra);
  }
  const examChoices = courseId ? allExams.filter((e) => e.courseId === courseId) : allExams;

  const onSubmit = handleSubmit((values) => {
    const body = toTaskRequest(values, timezone);
    const options = {
      onSuccess: () => {
        onSaved?.(body.title);
        onOpenChange(false);
      },
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          const name = SERVER_FIELDS[fe.field];
          if (name) setError(name, { message: fe.message });
        }
      },
    };
    if (task) update.mutate({ id: task.id, body }, options);
    else create.mutate(body, options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'task-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={task ? 'Edit task' : 'New task'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {task ? 'Save changes' : 'Add task'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <Field
          label="Title"
          placeholder="Revise joins"
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field
            label="Day (optional)"
            type="date"
            hint="The day you mean to do it"
            error={errors.plannedFor?.message}
            {...register('plannedFor')}
          />
          <Field
            label="Start time (optional)"
            type="time"
            hint={plannedFor ? `In your time zone (${timezone})` : 'Needs a day'}
            error={errors.plannedStart?.message}
            {...register('plannedStart')}
          />
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <SelectField label="Repeat" error={errors.recurrence?.message} {...register('recurrence')}>
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABEL[r]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Priority" error={errors.priority?.message} {...register('priority')}>
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field
            label="Due date (optional)"
            type="date"
            hint="A hard deadline, if there is one"
            error={errors.dueDate?.message}
            {...register('dueDate')}
          />
          <Field
            label="Due time (optional)"
            type="time"
            hint="23:59 if left empty"
            error={errors.dueTime?.message}
            {...register('dueTime')}
          />
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <SelectField
            label="Course (optional)"
            error={errors.courseId?.message}
            {...register('courseId', {
              onChange: (e: { target: { value: string } }) => {
                const exam = allExams.find((x) => x.id === getValues('examId'));
                if (exam && e.target.value && exam.courseId !== e.target.value) setValue('examId', '');
              },
            })}
          >
            <option value="">None</option>
            {courseChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Exam (optional)" error={errors.examId?.message} {...register('examId')}>
            <option value="">None</option>
            {examChoices.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <SelectField
            label="Project (optional)"
            error={errors.projectId?.message}
            {...register('projectId')}
          >
            <option value="">None</option>
            {projectChoices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Category"
            hint="Automatic: from the course, project or learning goal, else Personal"
            error={errors.category?.message}
            {...register('category')}
          >
            <option value="">Automatic</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
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
