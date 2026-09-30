import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { FormAlert } from '@/components/patterns/FormAlert';
import { errorMessage } from '@/services/http';
import { useCreateCourse, useUpdateCourse } from './api';
import { courseSchema, formFieldName, toCourseRequest, type CourseValues } from './schemas';
import type { Course } from './types';

const FIELDS = new Set(['code', 'name', 'credits', 'faculty', 'attendanceTarget']);

export interface CourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: string;
  semesterName: string;
  /** Edit this course; omit to add one. */
  course?: Course;
}

function defaults(course?: Course): CourseValues {
  return {
    code: course?.code ?? '',
    name: course?.name ?? '',
    credits: course ? String(course.credits) : '',
    faculty: course?.faculty ?? '',
    attendanceTarget: course?.attendanceTarget == null ? '' : String(course.attendanceTarget),
  };
}

export function CourseDialog({ open, onOpenChange, semesterId, semesterName, course }: CourseDialogProps) {
  const create = useCreateCourse();
  const update = useUpdateCourse();
  const mutation = course ? update : create;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CourseValues>({ resolver: zodResolver(courseSchema), defaultValues: defaults(course) });

  useEffect(() => {
    if (open) {
      reset(defaults(course));
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, course?.id]);

  const onSubmit = handleSubmit((values) => {
    const options = {
      onSuccess: () => onOpenChange(false),
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          const name = formFieldName(fe.field);
          if (FIELDS.has(name)) setError(name as keyof CourseValues, { message: fe.message });
        }
      },
    };
    if (course) {
      const keep = { colorHue: course.colorHue, notes: course.notes };
      update.mutate({ id: course.id, body: toCourseRequest(values, course.semesterId, keep) }, options);
    } else {
      create.mutate(toCourseRequest(values, semesterId), options);
    }
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'course-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={course ? 'Edit course' : 'Add a course'}
      description={course ? undefined : `To ${semesterName}.`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {course ? 'Save changes' : 'Add course'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <div className="grid items-start gap-4 sm:grid-cols-[140px_1fr]">
          <Field
            label="Code (optional)"
            placeholder="CSE 201"
            error={errors.code?.message}
            {...register('code')}
          />
          <Field
            label="Name"
            placeholder="Database Systems"
            error={errors.name?.message}
            {...register('name')}
          />
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-[140px_1fr]">
          <Field
            label="Credits"
            inputMode="decimal"
            error={errors.credits?.message}
            {...register('credits')}
          />
          <Field label="Faculty (optional)" error={errors.faculty?.message} {...register('faculty')} />
        </div>
        <Field
          label="Attendance target % (optional)"
          inputMode="decimal"
          hint="Only if this course has its own rule. Leave empty to use the semester’s or your default."
          error={errors.attendanceTarget?.message}
          {...register('attendanceTarget')}
        />
      </form>
    </Dialog>
  );
}
