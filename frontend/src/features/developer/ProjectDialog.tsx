import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { errorMessage } from '@/services/http';
import { useCreateProject, useProjects, useUpdateProject } from './api';
import { STATUS_LABEL, STATUSES } from './projectText';
import { projectSchema, toProjectRequest, type ProjectValues } from './schemas';
import { TechStackField } from './TechStackField';
import type { Project } from './types';

/** Server field → form field (the same names). */
const FIELDS: (keyof ProjectValues)[] = [
  'name',
  'status',
  'description',
  'techStack',
  'repoUrl',
  'demoUrl',
  'startedOn',
  'targetOn',
];

function defaults(project?: Project): ProjectValues {
  return {
    name: project?.name ?? '',
    status: project?.status ?? 'IDEA',
    description: project?.description ?? '',
    techStack: project?.techStack ?? [],
    repoUrl: project?.repoUrl ?? '',
    demoUrl: project?.demoUrl ?? '',
    startedOn: project?.startedOn ?? '',
    targetOn: project?.targetOn ?? '',
  };
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this project; omit to add one. */
  project?: Project;
  onSaved?: (saved: Project) => void;
}) {
  const create = useCreateProject();
  const update = useUpdateProject();
  const mutation = project ? update : create;
  // Suggestions for the stack: everything used in the user's other projects
  const all = useProjects(null, open);
  const suggestions = [
    ...new Map(
      (all.data ?? [])
        .filter((p) => p.id !== project?.id)
        .flatMap((p) => p.techStack)
        .map((t) => [t.toLowerCase(), t] as const),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProjectValues>({ resolver: zodResolver(projectSchema), defaultValues: defaults(project) });

  useEffect(() => {
    if (open) {
      reset(defaults(project));
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, project?.id]);

  const onSubmit = handleSubmit((values) => {
    const body = toProjectRequest(values);
    const options = {
      onSuccess: (saved: Project) => {
        onSaved?.(saved);
        onOpenChange(false);
      },
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          const name = FIELDS.find((f) => f === fe.field);
          if (name) setError(name, { message: fe.message });
        }
      },
    };
    if (project) update.mutate({ id: project.id, body }, options);
    else create.mutate(body, options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'project-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={project ? 'Edit project' : 'New project'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {project ? 'Save changes' : 'Add project'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_11rem]">
          <Field
            label="Name"
            placeholder="Campus bus tracker"
            error={errors.name?.message}
            {...register('name')}
          />
          <SelectField label="Status" error={errors.status?.message} {...register('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
        </div>
        <TextAreaField
          label="What it is (optional)"
          error={errors.description?.message}
          {...register('description')}
        />
        <Controller
          control={control}
          name="techStack"
          render={({ field }) => (
            <TechStackField
              value={field.value}
              onChange={field.onChange}
              suggestions={suggestions}
              error={errors.techStack?.message}
            />
          )}
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
            label="Live demo (optional)"
            type="url"
            inputMode="url"
            placeholder="https://…"
            error={errors.demoUrl?.message}
            {...register('demoUrl')}
          />
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field
            label="Started (optional)"
            type="date"
            error={errors.startedOn?.message}
            {...register('startedOn')}
          />
          <Field
            label="Target date (optional)"
            type="date"
            error={errors.targetOn?.message}
            {...register('targetOn')}
          />
        </div>
      </form>
    </Dialog>
  );
}
