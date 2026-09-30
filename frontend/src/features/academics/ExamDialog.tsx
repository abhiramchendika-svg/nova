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
import { useCreateExam, useUpdateExam } from './api';
import type { CourseChoice } from './AssignmentDialog';
import { KIND_LABEL } from './examText';
import { examSchema, toExamRequest, type ExamValues } from './schemas';
import type { ExamDetail, ExamKind } from './types';

const KINDS: ExamKind[] = ['MIDTERM', 'FINAL', 'QUIZ', 'LAB', 'OTHER'];

/** Server field → form field. "topics[3]" errors land on the topics box. */
function formField(serverField: string): keyof ExamValues | null {
  if (serverField === 'startsAt') return 'date';
  if (serverField.startsWith('topics')) return 'topics';
  const known: (keyof ExamValues)[] = ['courseId', 'title', 'kind', 'durationMinutes', 'location'];
  return known.includes(serverField as keyof ExamValues) ? (serverField as keyof ExamValues) : null;
}

function defaults(timezone: string, exam?: ExamDetail, defaultCourseId?: string): ExamValues {
  if (exam) {
    const { date, time } = localParts(exam.startsAt, timezone);
    return {
      courseId: exam.courseId,
      title: exam.title,
      kind: exam.kind,
      date,
      time,
      durationMinutes: exam.durationMinutes === null ? '' : String(exam.durationMinutes),
      location: exam.location ?? '',
      topics: '',
    };
  }
  return {
    courseId: defaultCourseId ?? '',
    title: '',
    kind: 'MIDTERM',
    date: todayIn(timezone),
    time: '09:00',
    durationMinutes: '',
    location: '',
    topics: '',
  };
}

export interface ExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: CourseChoice[];
  timezone: string;
  /** Edit this exam; omit to add one. */
  exam?: ExamDetail;
  defaultCourseId?: string;
  /** Called with the saved exam (e.g. to open its page after adding). */
  onSaved?: (exam: ExamDetail) => void;
}

export function ExamDialog({
  open,
  onOpenChange,
  courses,
  timezone,
  exam,
  defaultCourseId,
  onSaved,
}: ExamDialogProps) {
  const create = useCreateExam();
  const update = useUpdateExam();
  const mutation = exam ? update : create;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ExamValues>({
    resolver: zodResolver(examSchema),
    defaultValues: defaults(timezone, exam, defaultCourseId),
  });

  useEffect(() => {
    if (open) {
      reset(defaults(timezone, exam, defaultCourseId));
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, exam?.id]);

  const choices =
    exam && !courses.some((c) => c.id === exam.courseId)
      ? [...courses, { id: exam.courseId, code: exam.courseCode, name: exam.courseName }]
      : courses;

  const onSubmit = handleSubmit((values) => {
    const options = {
      onSuccess: (saved: ExamDetail) => {
        onOpenChange(false);
        onSaved?.(saved);
      },
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          const name = formField(fe.field);
          if (name) setError(name, { message: fe.message });
        }
      },
    };
    if (exam) update.mutate({ id: exam.id, body: toExamRequest(values, timezone, false) }, options);
    else create.mutate(toExamRequest(values, timezone, true), options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'exam-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={exam ? 'Edit exam' : 'Add an exam'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {exam ? 'Save changes' : 'Add exam'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <Field
          label="Title"
          placeholder="Mid-semester 1"
          error={errors.title?.message}
          {...register('title')}
        />
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_160px]">
          <SelectField label="Course" error={errors.courseId?.message} {...register('courseId')}>
            <option value="" disabled>
              Choose a course
            </option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} · ${c.name}` : c.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Kind" error={errors.kind?.message} {...register('kind')}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Date" type="date" error={errors.date?.message} {...register('date')} />
          <Field
            label="Starts at"
            type="time"
            hint={`In your time zone (${timezone})`}
            error={errors.time?.message}
            {...register('time')}
          />
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field
            label="Duration in minutes (optional)"
            inputMode="numeric"
            error={errors.durationMinutes?.message}
            {...register('durationMinutes')}
          />
          <Field
            label="Room (optional)"
            placeholder="Hall B"
            error={errors.location?.message}
            {...register('location')}
          />
        </div>
        {!exam && (
          <TextAreaField
            label="Topics to prepare (optional)"
            hint="One per line. You can add, reorder and tick them off on the exam’s page."
            rows={4}
            error={errors.topics?.message}
            {...register('topics')}
          />
        )}
      </form>
    </Dialog>
  );
}
