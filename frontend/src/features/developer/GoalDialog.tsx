import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { errorMessage } from '@/services/http';
import { useCreateGoal, useUpdateGoal } from './learningApi';
import { GOAL_STATUS_LABEL, GOAL_STATUSES } from './projectText';
import { goalSchema, topicLines, type GoalValues } from './schemas';
import type { LearningGoal } from './types';

const FIELDS: (keyof GoalValues)[] = ['title', 'status', 'description', 'targetOn', 'topics'];

function defaults(goal?: LearningGoal): GoalValues {
  return {
    title: goal?.title ?? '',
    status: goal?.status ?? 'ACTIVE',
    description: goal?.description ?? '',
    targetOn: goal?.targetOn ?? '',
    topics: '',
  };
}

export function GoalDialog({
  open,
  onOpenChange,
  goal,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this goal; omit to add one (with optional starter topics). */
  goal?: LearningGoal;
  onSaved?: (saved: LearningGoal) => void;
}) {
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const mutation = goal ? update : create;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<GoalValues>({ resolver: zodResolver(goalSchema), defaultValues: defaults(goal) });

  useEffect(() => {
    if (open) {
      reset(defaults(goal));
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, goal?.id]);

  const onSubmit = handleSubmit((v) => {
    const body = {
      title: v.title.trim(),
      status: v.status,
      description: v.description.trim() || null,
      targetOn: v.targetOn || null,
      ...(goal ? {} : { topics: topicLines(v.topics) }),
    };
    const options = {
      onSuccess: (saved: LearningGoal) => {
        onSaved?.(saved);
        onOpenChange(false);
      },
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          const name = fe.field.startsWith('topics') ? 'topics' : FIELDS.find((f) => f === fe.field);
          if (name) setError(name, { message: fe.message });
        }
      },
    };
    if (goal) update.mutate({ id: goal.id, body }, options);
    else create.mutate(body, options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'goal-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? 'Edit learning goal' : 'New learning goal'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {goal ? 'Save changes' : 'Add goal'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_9rem]">
          <Field
            label="What you’re learning"
            placeholder="Spring Boot"
            error={errors.title?.message}
            {...register('title')}
          />
          <SelectField label="Status" error={errors.status?.message} {...register('status')}>
            {GOAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {GOAL_STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
        </div>
        <Field
          label="Target date (optional)"
          type="date"
          className="sm:w-52"
          hint="When you’d like to have it down"
          error={errors.targetOn?.message}
          {...register('targetOn')}
        />
        <TextAreaField
          label="Why, or what “done” means (optional)"
          error={errors.description?.message}
          {...register('description')}
        />
        {!goal && (
          <TextAreaField
            label="Topics (optional)"
            hint="One per line. You can add, reorder and tick them off later."
            placeholder={'Dependency injection\nSpring Data JPA\nTesting'}
            error={errors.topics?.message}
            {...register('topics')}
          />
        )}
      </form>
    </Dialog>
  );
}
