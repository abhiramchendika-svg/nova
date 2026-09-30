import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { useCreateSemester, useGradingSchemes, useSemesters } from '@/features/academics/api';
import { formatNumber, formatTerm } from '@/features/academics/format';
import {
  formFieldName,
  semesterSchema,
  toSemesterRequest,
  type SemesterValues,
} from '@/features/academics/schemas';
import { errorMessage } from '@/services/http';
import { Actions, StepHeader } from './parts';

const FIELDS = new Set(['name', 'ordinal', 'startsOn', 'endsOn', 'gradingSchemeId']);

/** Step 2: the current semester and how it's graded. Shows the saved one if it exists already. */
export function SemesterStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const semesters = useSemesters();
  const current = semesters.data?.find((s) => s.current);
  if (current) {
    const term = formatTerm(current.startsOn, current.endsOn);
    return (
      <div className="grid gap-5">
        <StepHeader title="Your semester">
          It’s saved. You can change it any time on the Courses page.
        </StepHeader>
        <p className="rounded-md border border-line px-4 py-3 text-[14px]">
          <strong className="font-semibold">{current.name}</strong> · {current.gradingScheme.name} (out of{' '}
          {formatNumber(current.gradingScheme.maxPoints)}){term && <> · {term}</>}
        </p>
        <Actions onBack={onBack}>
          <Button variant="primary" onClick={onDone}>
            Continue
          </Button>
        </Actions>
      </div>
    );
  }
  return <NewSemester nextOrdinal={(semesters.data?.length ?? 0) + 1} onBack={onBack} onDone={onDone} />;
}

function NewSemester({
  nextOrdinal,
  onBack,
  onDone,
}: {
  nextOrdinal: number;
  onBack: () => void;
  onDone: () => void;
}) {
  const schemes = useGradingSchemes();
  const create = useCreateSemester();
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<SemesterValues>({
    resolver: zodResolver(semesterSchema),
    defaultValues: {
      name: `Semester ${nextOrdinal}`,
      ordinal: String(nextOrdinal),
      startsOn: '',
      endsOn: '',
      gradingSchemeId: '',
      current: true,
      attendanceTarget: '',
    },
  });

  // Default to the first preset once the schemes arrive
  useEffect(() => {
    const first = schemes.data?.[0]?.id;
    if (first && !getValues('gradingSchemeId')) setValue('gradingSchemeId', first);
  }, [schemes.data, getValues, setValue]);

  const onSubmit = handleSubmit((values) =>
    create.mutate(toSemesterRequest({ ...values, current: true }), {
      onSuccess: onDone,
      onError: (error) => {
        for (const fe of error.fieldErrors) {
          const name = formFieldName(fe.field);
          if (FIELDS.has(name)) setError(name as keyof SemesterValues, { message: fe.message });
        }
      },
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <StepHeader title="Your current semester">
        Courses, grades and attendance all belong to a semester. Add past semesters later for your CGPA.
      </StepHeader>
      {create.isError && create.error.fieldErrors.length === 0 && (
        <FormAlert message={errorMessage(create.error)} />
      )}
      <div className="grid items-start gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Name" error={errors.name?.message} {...register('name')} />
        <Field label="Number" inputMode="numeric" error={errors.ordinal?.message} {...register('ordinal')} />
      </div>
      <SelectField
        label="Grading scheme"
        hint="Pick your university’s scale. You can build your own on the Grades page."
        error={errors.gradingSchemeId?.message}
        {...register('gradingSchemeId')}
      >
        {(schemes.data ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field
          label="Starts (optional)"
          type="date"
          error={errors.startsOn?.message}
          {...register('startsOn')}
        />
        <Field label="Ends (optional)" type="date" error={errors.endsOn?.message} {...register('endsOn')} />
      </div>
      <Actions onBack={onBack}>
        <Button type="submit" variant="primary" loading={create.isPending} disabled={!schemes.data}>
          Continue
        </Button>
      </Actions>
    </form>
  );
}
