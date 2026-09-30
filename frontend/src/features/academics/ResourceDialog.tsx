import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { errorMessage } from '@/services/http';
import { useAddResource, useUpdateResource } from './api';
import { resourceSchema, type ResourceValues } from './schemas';
import type { CourseResource } from './types';

export function ResourceDialog({
  open,
  onOpenChange,
  courseId,
  resource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  /** Edit this link; omit to add one. */
  resource?: CourseResource;
}) {
  const add = useAddResource();
  const update = useUpdateResource();
  const mutation = resource ? update : add;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ResourceValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: { title: resource?.title ?? '', url: resource?.url ?? '' },
  });

  useEffect(() => {
    if (open) {
      reset({ title: resource?.title ?? '', url: resource?.url ?? '' });
      add.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, resource?.id]);

  const onSubmit = handleSubmit((values) => {
    const body = { title: values.title.trim(), url: values.url.trim() };
    const options = {
      onSuccess: () => onOpenChange(false),
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          if (fe.field === 'title' || fe.field === 'url') setError(fe.field, { message: fe.message });
        }
      },
    };
    if (resource) update.mutate({ courseId, id: resource.id, body }, options);
    else add.mutate({ courseId, body }, options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'resource-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={resource ? 'Edit link' : 'Add a link'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {resource ? 'Save changes' : 'Add link'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <Field label="Title" placeholder="Syllabus" error={errors.title?.message} {...register('title')} />
        <Field
          label="Link"
          type="url"
          inputMode="url"
          placeholder="https://"
          error={errors.url?.message}
          {...register('url')}
        />
      </form>
    </Dialog>
  );
}
