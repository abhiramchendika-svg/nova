import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { errorMessage } from '@/services/http';
import { useSetBaseline } from './api';
import type { CourseAttendance } from './types';

const count = z
  .string()
  .trim()
  .regex(/^\d{1,4}$/, 'Use a whole number, like 34.');

const baselineSchema = z
  .object({ conducted: count, attended: count })
  .refine((v) => Number(v.attended) <= Number(v.conducted), {
    path: ['attended'],
    message: 'You can’t have attended more classes than were held.',
  });

type BaselineValues = z.infer<typeof baselineSchema>;

/**
 * The counts a student starts from, copied from the university portal ("28 of 34"). Classes marked
 * in NOVA are added on top, so this is set once, when the student starts tracking.
 */
export function BaselineDialog({
  open,
  onOpenChange,
  course,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CourseAttendance;
}) {
  const setBaseline = useSetBaseline();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<BaselineValues>({ resolver: zodResolver(baselineSchema) });

  useEffect(() => {
    if (open) {
      reset({ conducted: String(course.baselineConducted), attended: String(course.baselineAttended) });
      setBaseline.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, course.courseId]);

  const onSubmit = handleSubmit((v) =>
    setBaseline.mutate(
      { courseId: course.courseId, conducted: Number(v.conducted), attended: Number(v.attended) },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          for (const fe of error.fieldErrors) {
            if (fe.field === 'conducted' || fe.field === 'attended')
              setError(fe.field, { message: fe.message });
          }
        },
      },
    ),
  );

  const formError =
    setBaseline.error && setBaseline.error.fieldErrors.length === 0 ? errorMessage(setBaseline.error) : null;
  const formId = 'baseline-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Starting counts for ${course.courseName}`}
      description="Copy these from your university portal. Classes you mark in NOVA are added on top."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={setBaseline.isPending}>
            Save counts
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid items-start gap-4 sm:grid-cols-2">
        {formError && (
          <div className="sm:col-span-2">
            <FormAlert message={formError} />
          </div>
        )}
        <Field
          label="Classes held so far"
          inputMode="numeric"
          error={errors.conducted?.message}
          {...register('conducted')}
        />
        <Field
          label="Classes you attended"
          inputMode="numeric"
          error={errors.attended?.message}
          {...register('attended')}
        />
      </form>
    </Dialog>
  );
}
