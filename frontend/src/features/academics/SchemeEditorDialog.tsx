import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { errorMessage } from '@/services/http';
import { useCreateScheme, useUpdateScheme } from './api';
import { formFieldName, schemeSchema, toSchemeRequest, type SchemeValues } from './schemas';
import type { GradingScheme } from './types';

const NEW_SCHEME: SchemeValues = {
  name: '',
  maxPoints: '10',
  grades: [
    { label: 'A', points: '10', passing: true, countsInGpa: true },
    { label: 'F', points: '0', passing: false, countsInGpa: true },
  ],
};

function defaults(scheme?: GradingScheme): SchemeValues {
  if (!scheme) return NEW_SCHEME;
  return {
    name: scheme.name,
    maxPoints: String(scheme.maxPoints),
    grades: scheme.grades.map((g) => ({
      id: g.id,
      label: g.label,
      points: String(g.points),
      passing: g.passing,
      countsInGpa: g.countsInGpa,
    })),
  };
}

/**
 * Create or edit a grading scheme. Grades are listed best first; editing keeps each grade's id,
 * so courses already graded with it keep their grade and simply follow the new points.
 */
export function SchemeEditorDialog({
  open,
  onOpenChange,
  scheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheme?: GradingScheme;
}) {
  const create = useCreateScheme();
  const update = useUpdateScheme();
  const mutation = scheme ? update : create;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SchemeValues>({ resolver: zodResolver(schemeSchema), defaultValues: defaults(scheme) });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'grades' });

  useEffect(() => {
    if (open) {
      reset(defaults(scheme));
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, scheme?.id]);

  const onSubmit = handleSubmit((values) => {
    const body = toSchemeRequest(values);
    const options = {
      onSuccess: () => onOpenChange(false),
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          setError(formFieldName(fe.field) as 'name', { message: fe.message });
        }
      },
    };
    if (scheme) update.mutate({ id: scheme.id, body }, options);
    else create.mutate(body, options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const gradesError = errors.grades?.message ?? errors.grades?.root?.message;
  const formId = 'scheme-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={scheme ? 'Edit grading scheme' : 'New grading scheme'}
      description="List grades best first. Mark which grades are a pass and which count towards GPA."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {scheme ? 'Save scheme' : 'Create scheme'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_120px]">
          <Field
            label="Name"
            placeholder="SRM AP 10-point"
            error={errors.name?.message}
            {...register('name')}
          />
          <Field
            label="Maximum"
            inputMode="decimal"
            error={errors.maxPoints?.message}
            {...register('maxPoints')}
          />
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-medium text-ink">Grades</legend>
          {gradesError && (
            <p role="alert" className="text-[12.5px] text-critical">
              {gradesError}
            </p>
          )}
          <ol className="grid gap-2">
            {fields.map((field, index) => {
              const n = index + 1;
              return (
                <li key={field.id} className="grid gap-2 rounded-sm border border-line p-2.5">
                  <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                    <Field
                      label={`Grade ${n} label`}
                      error={errors.grades?.[index]?.label?.message}
                      {...register(`grades.${index}.label`)}
                    />
                    <Field
                      label={`Grade ${n} points`}
                      inputMode="decimal"
                      error={errors.grades?.[index]?.points?.message}
                      {...register(`grades.${index}.points`)}
                    />
                    <div className="flex pt-6">
                      <IconButton
                        label={`Move grade ${n} up`}
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUp size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Move grade ${n} down`}
                        disabled={index === fields.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDown size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Remove grade ${n}`}
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                      >
                        <Trash2 size={15} aria-hidden />
                      </IconButton>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--academics)]"
                        {...register(`grades.${index}.passing`)}
                      />
                      Pass
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--academics)]"
                        {...register(`grades.${index}.countsInGpa`)}
                      />
                      Counts towards GPA
                    </label>
                  </div>
                </li>
              );
            })}
          </ol>
          <Button
            size="sm"
            className="w-fit"
            disabled={fields.length >= 20}
            onClick={() => append({ label: '', points: '0', passing: true, countsInGpa: true })}
          >
            <Plus size={14} aria-hidden />
            Add grade
          </Button>
        </fieldset>
      </form>
    </Dialog>
  );
}
