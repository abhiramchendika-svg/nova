import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { toSettingsRequest, useSettings, useUpdateSettings } from '@/features/settings/api';
import { TimeZoneField } from '@/features/settings/TimeZoneField';
import { deviceTimeZone } from '@/features/settings/timezones';
import { errorMessage } from '@/services/http';
import type { z } from 'zod';
import { settingsSchema } from '@/features/settings/schema';
import { StepHeader } from './parts';

const youSchema = settingsSchema.pick({
  timezone: true,
  universityName: true,
  defaultAttendanceTarget: true,
});
type YouValues = z.infer<typeof youSchema>;

/** Step 1: the settings everything else depends on ("today", and the attendance rule). */
export function YouStep({ firstName, onDone }: { firstName: string; onDone: () => void }) {
  const settings = useSettings();
  const update = useUpdateSettings();
  const saved = settings.data!;
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<YouValues>({
    resolver: zodResolver(youSchema),
    defaultValues: {
      // A new account starts on UTC; this device's zone is the better first guess
      timezone: saved.timezone === 'UTC' ? deviceTimeZone() : saved.timezone,
      universityName: saved.universityName ?? '',
      defaultAttendanceTarget:
        saved.defaultAttendanceTarget === null ? '' : String(saved.defaultAttendanceTarget),
    },
  });

  const onSubmit = handleSubmit((v) =>
    update.mutate(
      {
        ...toSettingsRequest(saved),
        timezone: v.timezone.trim(),
        universityName: v.universityName.trim() || null,
        defaultAttendanceTarget: v.defaultAttendanceTarget.trim() ? Number(v.defaultAttendanceTarget) : null,
      },
      {
        onSuccess: onDone,
        onError: (error) => {
          for (const fe of error.fieldErrors) {
            if (
              fe.field === 'timezone' ||
              fe.field === 'universityName' ||
              fe.field === 'defaultAttendanceTarget'
            ) {
              setError(fe.field, { message: fe.message });
            }
          }
        },
      },
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <StepHeader title={firstName ? `Welcome, ${firstName}.` : 'Welcome to NOVA.'}>
        Three quick things, then your semester and courses. It takes about three minutes, and everything can
        be changed later in Settings.
      </StepHeader>
      {update.isError && update.error.fieldErrors.length === 0 && (
        <FormAlert message={errorMessage(update.error)} />
      )}
      <Controller
        control={control}
        name="timezone"
        render={({ field }) => (
          <TimeZoneField
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.timezone?.message}
          />
        )}
      />
      <Field
        label="University (optional)"
        placeholder="Your university"
        error={errors.universityName?.message}
        {...register('universityName')}
      />
      <Field
        label="Minimum attendance your university requires % (optional)"
        inputMode="decimal"
        placeholder="75"
        hint="NOVA uses it to tell you how many classes you can miss. Leave it empty if you’re not sure."
        error={errors.defaultAttendanceTarget?.message}
        {...register('defaultAttendanceTarget')}
      />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={update.isPending}>
          Continue
        </Button>
      </div>
    </form>
  );
}
