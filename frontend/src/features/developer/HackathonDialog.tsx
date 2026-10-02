import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { errorMessage } from '@/services/http';
import { useProjects } from './api';
import { useCreateHackathon, useUpdateHackathon } from './hackathonApi';
import { HACKATHON_STATUS_LABEL, HACKATHON_STATUSES, MODE_LABEL } from './projectText';
import { hackathonSchema, hackathonValues, toHackathonRequest, type HackathonValues } from './schemas';
import type { Hackathon, HackathonMode } from './types';

/** Server field → form field. The deadlines are edited as a date and a time. */
const FIELD_OF: Record<string, keyof HackathonValues> = {
  name: 'name',
  status: 'status',
  organizer: 'organizer',
  mode: 'mode',
  location: 'location',
  websiteUrl: 'websiteUrl',
  startsOn: 'startsOn',
  endsOn: 'endsOn',
  registrationDeadline: 'registrationDate',
  submissionDeadline: 'submissionDate',
  teamName: 'teamName',
  teamMembers: 'teamMembers',
  projectId: 'projectId',
  result: 'result',
  repoUrl: 'repoUrl',
  demoUrl: 'demoUrl',
  certificateUrl: 'certificateUrl',
  notes: 'notes',
};

const MODES: HackathonMode[] = ['OFFLINE', 'ONLINE', 'HYBRID'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-[13px] font-semibold text-ink-2">{title}</legend>
      {children}
    </fieldset>
  );
}

export function HackathonDialog({
  open,
  onOpenChange,
  timezone,
  hackathon,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user's timezone: deadlines mean that time there. */
  timezone: string;
  /** Edit this hackathon; omit to add one. */
  hackathon?: Hackathon;
  onSaved?: (saved: Hackathon) => void;
}) {
  const create = useCreateHackathon();
  const update = useUpdateHackathon();
  const mutation = hackathon ? update : create;
  const projects = useProjects(null, open);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<HackathonValues>({
    resolver: zodResolver(hackathonSchema),
    defaultValues: hackathonValues(hackathon, timezone),
  });

  useEffect(() => {
    if (open) {
      reset(hackathonValues(hackathon, timezone));
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, hackathon?.id]);

  // Project options arrive after the reset; put the chosen one back once they're there
  useEffect(() => {
    if (open) setValue('projectId', getValues('projectId'));
  }, [open, projects.data, setValue, getValues]);

  const projectChoices = (projects.data ?? []).map((p) => ({ id: p.id, label: p.name }));
  if (hackathon?.projectId && !projectChoices.some((p) => p.id === hackathon.projectId)) {
    projectChoices.push({ id: hackathon.projectId, label: hackathon.projectName ?? 'Linked project' });
  }

  const onSubmit = handleSubmit((values) => {
    const body = toHackathonRequest(values, timezone);
    const options = {
      onSuccess: (saved: Hackathon) => {
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
    if (hackathon) update.mutate({ id: hackathon.id, body }, options);
    else create.mutate(body, options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'hackathon-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={hackathon ? 'Edit hackathon' : 'New hackathon'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {hackathon ? 'Save changes' : 'Add hackathon'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-6">
        {formError && <FormAlert message={formError} />}
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_10rem]">
          <Field
            label="Name"
            placeholder="Smart City Hack"
            error={errors.name?.message}
            {...register('name')}
          />
          <SelectField label="Status" error={errors.status?.message} {...register('status')}>
            {HACKATHON_STATUSES.map((s) => (
              <option key={s} value={s}>
                {HACKATHON_STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
        </div>

        <Section title="When and where">
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field
              label="Starts (optional)"
              type="date"
              error={errors.startsOn?.message}
              {...register('startsOn')}
            />
            <Field
              label="Ends (optional)"
              type="date"
              hint="Leave empty for a one-day event"
              error={errors.endsOn?.message}
              {...register('endsOn')}
            />
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-[10rem_1fr]">
            <SelectField label="Format (optional)" error={errors.mode?.message} {...register('mode')}>
              <option value="">Not set</option>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </SelectField>
            <Field label="Venue (optional)" error={errors.location?.message} {...register('location')} />
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field
              label="Organiser (optional)"
              error={errors.organizer?.message}
              {...register('organizer')}
            />
            <Field
              label="Website (optional)"
              type="url"
              inputMode="url"
              placeholder="https://…"
              error={errors.websiteUrl?.message}
              {...register('websiteUrl')}
            />
          </div>
        </Section>

        <Section title="Deadlines">
          <div className="grid grid-cols-[1fr_9rem] items-start gap-4">
            <Field
              label="Registration closes"
              type="date"
              error={errors.registrationDate?.message}
              {...register('registrationDate')}
            />
            <Field
              label="Registration time"
              type="time"
              error={errors.registrationTime?.message}
              {...register('registrationTime')}
            />
          </div>
          <div className="grid grid-cols-[1fr_9rem] items-start gap-4">
            <Field
              label="Submissions close"
              type="date"
              error={errors.submissionDate?.message}
              {...register('submissionDate')}
            />
            <Field
              label="Submission time"
              type="time"
              error={errors.submissionTime?.message}
              {...register('submissionTime')}
            />
          </div>
          <p className="text-[12.5px] text-ink-3">
            Both optional. Without a time, a deadline means 23:59 that day.
          </p>
        </Section>

        <Section title="Team and project">
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label="Team name (optional)" error={errors.teamName?.message} {...register('teamName')} />
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
          </div>
          <Field
            label="Teammates (optional)"
            placeholder="Asha, Ravi, Meera"
            error={errors.teamMembers?.message}
            {...register('teamMembers')}
          />
        </Section>

        <Section title="Outcome">
          <Field
            label="Result (optional)"
            placeholder="e.g. Top 10 of 80 teams"
            hint="In your own words; NOVA never guesses it"
            error={errors.result?.message}
            {...register('result')}
          />
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field
              label="Repository (optional)"
              type="url"
              inputMode="url"
              placeholder="https://github.com/…"
              error={errors.repoUrl?.message}
              {...register('repoUrl')}
            />
            <Field
              label="Demo (optional)"
              type="url"
              inputMode="url"
              placeholder="https://…"
              error={errors.demoUrl?.message}
              {...register('demoUrl')}
            />
          </div>
          <Field
            label="Certificate (optional)"
            type="url"
            inputMode="url"
            placeholder="https://…"
            error={errors.certificateUrl?.message}
            {...register('certificateUrl')}
          />
        </Section>

        <TextAreaField label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
      </form>
    </Dialog>
  );
}
