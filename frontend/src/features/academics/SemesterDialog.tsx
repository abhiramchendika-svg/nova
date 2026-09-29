import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { FormAlert } from '@/components/patterns/FormAlert';
import { errorMessage } from '@/services/http';
import { useCreateSemester, useGradingSchemes, useUpdateSemester } from './api';
import { formFieldName, semesterSchema, toSemesterRequest, type SemesterValues } from './schemas';
import type { Semester } from './types';

const FIELDS = new Set([
  'name',
  'ordinal',
  'startsOn',
  'endsOn',
  'gradingSchemeId',
  'current',
  'attendanceTarget',
]);

export interface SemesterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this semester; omit to create one. */
  semester?: Semester;
  /** Suggested number for a new semester (one after the highest so far). */
  nextOrdinal?: number;
  /** Tick "current" by default (true for a user's first semester). */
  defaultCurrent?: boolean;
  onSaved?: (semester: Semester) => void;
}

function defaults(
  semester: Semester | undefined,
  nextOrdinal: number,
  firstSchemeId: string,
  defaultCurrent: boolean,
): SemesterValues {
  return {
    name: semester?.name ?? `Semester ${nextOrdinal}`,
    ordinal: String(semester?.ordinal ?? nextOrdinal),
    startsOn: semester?.startsOn ?? '',
    endsOn: semester?.endsOn ?? '',
    gradingSchemeId: semester?.gradingScheme.id ?? firstSchemeId,
    current: semester?.current ?? defaultCurrent,
    attendanceTarget: semester?.attendanceTarget == null ? '' : String(semester.attendanceTarget),
  };
}

export function SemesterDialog({
  open,
  onOpenChange,
  semester,
  nextOrdinal = 1,
  defaultCurrent = false,
  onSaved,
}: SemesterDialogProps) {
  const schemes = useGradingSchemes();
  const create = useCreateSemester();
  const update = useUpdateSemester();
  const mutation = semester ? update : create;
  const firstSchemeId = schemes.data?.[0]?.id ?? '';

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SemesterValues>({
    resolver: zodResolver(semesterSchema),
    defaultValues: defaults(semester, nextOrdinal, firstSchemeId, defaultCurrent),
  });

  // Fresh values each time the dialog opens (and once schemes have loaded)
  useEffect(() => {
    if (open) {
      reset(defaults(semester, nextOrdinal, firstSchemeId, defaultCurrent));
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opening or schemes arrive
  }, [open, semester?.id, firstSchemeId]);

  const onSubmit = handleSubmit((values) => {
    const body = toSemesterRequest(values);
    const options = {
      onSuccess: (saved: Semester) => {
        onSaved?.(saved);
        onOpenChange(false);
      },
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          const name = formFieldName(fe.field);
          if (FIELDS.has(name)) setError(name as keyof SemesterValues, { message: fe.message });
        }
      },
    };
    if (semester) update.mutate({ id: semester.id, body }, options);
    else create.mutate(body, options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'semester-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={semester ? 'Edit semester' : 'Add a semester'}
      description={semester ? undefined : 'Your courses, grades and attendance belong to a semester.'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {semester ? 'Save changes' : 'Add semester'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Name" error={errors.name?.message} {...register('name')} />
          <Field
            label="Number"
            inputMode="numeric"
            hint="1 for your first semester"
            error={errors.ordinal?.message}
            {...register('ordinal')}
          />
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field
            label="Starts on (optional)"
            type="date"
            error={errors.startsOn?.message}
            {...register('startsOn')}
          />
          <Field
            label="Ends on (optional)"
            type="date"
            error={errors.endsOn?.message}
            {...register('endsOn')}
          />
        </div>
        <SelectField
          label="Grading scheme"
          error={errors.gradingSchemeId?.message}
          hint={
            <>
              Presets are examples. Need your university’s exact scale?{' '}
              <Link
                to="/app/academics/grades/schemes"
                className="font-medium text-ink underline underline-offset-4"
              >
                Manage grading schemes
              </Link>
            </>
          }
          disabled={!schemes.data}
          {...register('gradingSchemeId')}
        >
          {schemes.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.builtIn ? ' (preset)' : ''}
            </option>
          ))}
        </SelectField>
        <Field
          label="Attendance target % (optional)"
          inputMode="decimal"
          hint="Leave empty to use your default target."
          error={errors.attendanceTarget?.message}
          {...register('attendanceTarget')}
        />
        <Checkbox label="This is my current semester" {...register('current')} />
      </form>
    </Dialog>
  );
}
