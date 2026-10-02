import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { errorMessage } from '@/services/http';
import { useCreateInternship, useUpdateInternship } from './internshipApi';
import { INTERNSHIP_STATUS_LABEL, INTERNSHIP_STATUSES } from './projectText';
import { internshipSchema, internshipValues, toInternshipRequest, type InternshipValues } from './schemas';
import type { Internship } from './types';

/** Server field → form field. Instants are edited as a date and a time. */
const FIELD_OF: Record<string, keyof InternshipValues> = {
  company: 'company',
  role: 'role',
  status: 'status',
  location: 'location',
  jobUrl: 'jobUrl',
  source: 'source',
  appliedOn: 'appliedOn',
  deadlineAt: 'deadlineDate',
  nextStep: 'nextStep',
  nextStepAt: 'nextStepDate',
  resumeVersion: 'resumeVersion',
  notes: 'notes',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-[13px] font-semibold text-ink-2">{title}</legend>
      {children}
    </fieldset>
  );
}

export function InternshipDialog({
  open,
  onOpenChange,
  timezone,
  internship,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user's timezone: dates and times mean that time there. */
  timezone: string;
  /** Edit this application; omit to add one. */
  internship?: Internship;
  /** Starting values when adding (e.g. the board column's status). */
  initial?: Partial<InternshipValues>;
  onSaved?: (saved: Internship) => void;
}) {
  const create = useCreateInternship();
  const update = useUpdateInternship();
  const mutation = internship ? update : create;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<InternshipValues>({
    resolver: zodResolver(internshipSchema),
    defaultValues: internshipValues(internship, timezone, initial),
  });

  useEffect(() => {
    if (open) {
      reset(internshipValues(internship, timezone, initial));
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, internship?.id]);

  const status = useWatch({ control, name: 'status' });

  const onSubmit = handleSubmit((values) => {
    const body = toInternshipRequest(values, timezone);
    const options = {
      onSuccess: (saved: Internship) => {
        onSaved?.(saved);
        onOpenChange(false);
      },
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          const name = FIELD_OF[fe.field];
          if (name) setError(name, { message: fe.message });
        }
      },
    };
    if (internship) update.mutate({ id: internship.id, body }, options);
    else create.mutate(body, options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'internship-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={internship ? 'Edit application' : 'New application'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {internship ? 'Save changes' : 'Add application'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-6">
        {formError && <FormAlert message={formError} />}
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field
            label="Company"
            placeholder="Acme"
            error={errors.company?.message}
            {...register('company')}
          />
          <Field
            label="Role"
            placeholder="Backend intern"
            error={errors.role?.message}
            {...register('role')}
          />
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <SelectField label="Stage" error={errors.status?.message} {...register('status')}>
            {INTERNSHIP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INTERNSHIP_STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
          <Field
            label="Applied on (optional)"
            type="date"
            hint={status === 'SAVED' ? 'Not sent yet' : 'Today if left empty'}
            error={errors.appliedOn?.message}
            {...register('appliedOn')}
          />
        </div>

        <Section title="The posting">
          <Field
            label="Job link (optional)"
            type="url"
            inputMode="url"
            placeholder="https://…"
            error={errors.jobUrl?.message}
            {...register('jobUrl')}
          />
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field
              label="Location (optional)"
              placeholder="Bengaluru · hybrid"
              error={errors.location?.message}
              {...register('location')}
            />
            <Field
              label="Found via (optional)"
              placeholder="LinkedIn, referral, campus"
              error={errors.source?.message}
              {...register('source')}
            />
          </div>
          <div className="grid grid-cols-[1fr_9rem] items-start gap-4">
            <Field
              label="Apply by (optional)"
              type="date"
              error={errors.deadlineDate?.message}
              {...register('deadlineDate')}
            />
            <Field
              label="Apply-by time"
              type="time"
              error={errors.deadlineTime?.message}
              {...register('deadlineTime')}
            />
          </div>
        </Section>

        <Section title="Next step">
          <Field
            label="What’s next (optional)"
            placeholder="Online assessment, technical interview…"
            error={errors.nextStep?.message}
            {...register('nextStep')}
          />
          <div className="grid grid-cols-[1fr_9rem] items-start gap-4">
            <Field
              label="Next step on (optional)"
              type="date"
              error={errors.nextStepDate?.message}
              {...register('nextStepDate')}
            />
            <Field
              label="Next step time"
              type="time"
              error={errors.nextStepTime?.message}
              {...register('nextStepTime')}
            />
          </div>
        </Section>

        <Field
          label="Resume version (optional)"
          placeholder="v3-backend"
          error={errors.resumeVersion?.message}
          {...register('resumeVersion')}
        />
        <TextAreaField label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
      </form>
    </Dialog>
  );
}
