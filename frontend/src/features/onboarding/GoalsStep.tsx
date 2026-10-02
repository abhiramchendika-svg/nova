import { zodResolver } from '@hookform/resolvers/zod';
import type { FormEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { useCreateGoal, useGoals } from '@/features/developer/learningApi';
import { goalSchema, topicLines, type GoalValues } from '@/features/developer/schemas';
import { errorMessage } from '@/services/http';
import { Actions, StepHeader } from './parts';

const FIELDS: (keyof GoalValues)[] = ['title', 'targetOn', 'topics'];

/**
 * Step 5 (skippable): one thing you're learning outside class, broken into topics. Saved with the
 * normal learning-goal API, so it shows up on Learning and in Home's Developer card straight away.
 */
export function GoalsStep({
  onBack,
  onFinish,
  finishing,
}: {
  onBack: () => void;
  onFinish: () => void;
  finishing: boolean;
}) {
  const goals = useGoals();
  const create = useCreateGoal();
  const existing = goals.data ?? [];

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<GoalValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: { title: '', status: 'ACTIVE', description: '', targetOn: '', topics: '' },
  });
  const title = useWatch({ control, name: 'title' });
  const topics = useWatch({ control, name: 'topics' });
  const blank = !title.trim() && !topics.trim();

  const onSubmit = handleSubmit((v) => {
    create.mutate(
      {
        title: v.title.trim(),
        status: 'ACTIVE',
        description: null,
        targetOn: v.targetOn || null,
        topics: topicLines(v.topics),
      },
      {
        onSuccess: onFinish,
        onError: (error) => {
          for (const fe of error.fieldErrors) {
            const name = fe.field.startsWith('topics') ? 'topics' : FIELDS.find((f) => f === fe.field);
            if (name) setError(name, { message: fe.message });
          }
        },
      },
    );
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (!blank) return void onSubmit(event);
    event.preventDefault();
    onFinish();
  };

  const formError = create.error && create.error.fieldErrors.length === 0 ? errorMessage(create.error) : null;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <StepHeader title="Something you’re learning">
        Outside class: a framework, a language, interview prep. Break it into topics and tick them off as you
        go. You can skip this and add goals from the Learning page later.
      </StepHeader>
      {formError && <FormAlert message={formError} />}
      {existing.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-[13px] font-medium text-ink">Already added</p>
          <ul aria-label="Goals already added" className="grid gap-1 text-[13.5px] text-ink">
            {existing.map((g) => (
              <li key={g.id}>{g.title}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid items-start gap-4 sm:grid-cols-[1fr_11rem]">
        <Field
          label="What you’re learning"
          placeholder="Spring Boot"
          error={errors.title?.message}
          {...register('title')}
        />
        <Field
          label="Target date (optional)"
          type="date"
          error={errors.targetOn?.message}
          {...register('targetOn')}
        />
      </div>
      <TextAreaField
        label="Topics (optional)"
        hint="One per line."
        placeholder={'Dependency injection\nSpring Data JPA\nTesting'}
        error={errors.topics?.message}
        {...register('topics')}
      />
      <Actions onBack={onBack}>
        <Button type="submit" variant="primary" loading={create.isPending || finishing}>
          {blank ? 'Skip and finish' : 'Save and finish'}
        </Button>
      </Actions>
    </form>
  );
}
