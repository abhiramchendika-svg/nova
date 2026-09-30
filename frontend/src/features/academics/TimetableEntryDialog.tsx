import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { errorMessage } from '@/services/http';
import { useCreateEntry, useUpdateEntry } from './api';
import type { CourseChoice } from './AssignmentDialog';
import { entrySchema, toEntryRequest, type EntryValues } from './schemas';
import { CLASS_KIND_LABEL, DAY_NAME } from './timetableText';
import type { ClassKind, TimetableEntry } from './types';

const KINDS: ClassKind[] = ['LECTURE', 'LAB', 'TUTORIAL', 'OTHER'];
const FIELDS = new Set<keyof EntryValues>([
  'courseId',
  'dayOfWeek',
  'startsAt',
  'endsAt',
  'kind',
  'location',
  'instructor',
]);

function defaults(entry?: TimetableEntry, preset?: { dayOfWeek?: number; courseId?: string }): EntryValues {
  return {
    courseId: entry?.courseId ?? preset?.courseId ?? '',
    dayOfWeek: String(entry?.dayOfWeek ?? preset?.dayOfWeek ?? 1),
    startsAt: entry?.startsAt ?? '09:00',
    endsAt: entry?.endsAt ?? '09:50',
    kind: entry?.kind ?? 'LECTURE',
    location: entry?.location ?? '',
    instructor: entry?.instructor ?? '',
  };
}

export interface TimetableEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: CourseChoice[];
  /** The week in the user's order, for the day picker. */
  days: number[];
  /** Edit this class; omit to add one. */
  entry?: TimetableEntry;
  preset?: { dayOfWeek?: number; courseId?: string };
  /** Shown when editing: asks the page to confirm deleting this class. */
  onDelete?: (entry: TimetableEntry) => void;
}

export function TimetableEntryDialog({
  open,
  onOpenChange,
  courses,
  days,
  entry,
  preset,
  onDelete,
}: TimetableEntryDialogProps) {
  const create = useCreateEntry();
  const update = useUpdateEntry();
  const mutation = entry ? update : create;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<EntryValues>({ resolver: zodResolver(entrySchema), defaultValues: defaults(entry, preset) });

  useEffect(() => {
    if (open) {
      reset(defaults(entry, preset));
      create.reset();
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, entry?.id]);

  const onSubmit = handleSubmit((values) => {
    const options = {
      onSuccess: () => onOpenChange(false),
      onError: (error: { fieldErrors: { field: string; message: string }[] }) => {
        for (const fe of error.fieldErrors) {
          if (FIELDS.has(fe.field as keyof EntryValues)) {
            setError(fe.field as keyof EntryValues, { message: fe.message });
          }
        }
      },
    };
    if (entry) update.mutate({ id: entry.id, body: toEntryRequest(values) }, options);
    else create.mutate(toEntryRequest(values), options);
  });

  const formError =
    mutation.error && mutation.error.fieldErrors.length === 0 ? errorMessage(mutation.error) : null;
  const formId = 'timetable-entry-form';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? 'Edit class' : 'Add a class'}
      description={entry ? undefined : 'It repeats every week. Times are in your time zone.'}
      footer={
        <>
          {entry && onDelete && (
            <Button variant="ghost" className="mr-auto" onClick={() => onDelete(entry)}>
              Delete class
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending}>
            {entry ? 'Save changes' : 'Add class'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <SelectField label="Course" error={errors.courseId?.message} {...register('courseId')}>
          <option value="" disabled>
            Choose a course
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code ? `${c.code} · ${c.name}` : c.name}
            </option>
          ))}
        </SelectField>
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <SelectField label="Day" error={errors.dayOfWeek?.message} {...register('dayOfWeek')}>
            {days.map((d) => (
              <option key={d} value={String(d)}>
                {DAY_NAME[d]}
              </option>
            ))}
          </SelectField>
          <Field label="Starts" type="time" error={errors.startsAt?.message} {...register('startsAt')} />
          <Field label="Ends" type="time" error={errors.endsAt?.message} {...register('endsAt')} />
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-[140px_1fr]">
          <SelectField label="Kind" error={errors.kind?.message} {...register('kind')}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {CLASS_KIND_LABEL[k]}
              </option>
            ))}
          </SelectField>
          <Field
            label="Room (optional)"
            placeholder="Room 204"
            error={errors.location?.message}
            {...register('location')}
          />
        </div>
        <Field label="Instructor (optional)" error={errors.instructor?.message} {...register('instructor')} />
      </form>
    </Dialog>
  );
}
