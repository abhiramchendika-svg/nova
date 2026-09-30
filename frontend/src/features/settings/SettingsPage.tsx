import { zodResolver } from '@hookform/resolvers/zod';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ErrorState } from '@/components/patterns/ErrorState';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/services/http';
import { useSettings, useUpdateSettings } from './api';
import { fromSettingsValues, settingsSchema, toSettingsValues, type SettingsValues } from './schema';
import { toLocalTheme } from './accountTheme';
import { TimeZoneField } from './TimeZoneField';
import type { Settings } from './types';

const FIELDS = new Set<keyof SettingsValues>([
  'timezone',
  'weekStart',
  'universityName',
  'defaultAttendanceTarget',
  'theme',
]);

const THEMES: { value: Settings['theme']; label: string; Icon: typeof Sun }[] = [
  { value: 'LIGHT', label: 'Light', Icon: Sun },
  { value: 'DARK', label: 'Dark', Icon: Moon },
  { value: 'SYSTEM', label: 'Match this device', Icon: Monitor },
];

/** Account preferences (docs/api.md §2.1). One form, one save: the API replaces them all together. */
export function SettingsPage() {
  const settings = useSettings();
  return (
    <div className="animate-enter mx-auto grid max-w-2xl gap-5 px-4 py-6 lg:px-6">
      <header>
        <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Settings</h1>
        <p className="mt-1 text-ink-2">How NOVA reads your time, your targets and your screen.</p>
      </header>
      {settings.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading your settings…</span>
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : settings.isError ? (
        <ErrorState
          title="We couldn’t load your settings."
          onRetry={() => void settings.refetch()}
          retrying={settings.isFetching}
          requestId={settings.error.problem.requestId}
        />
      ) : (
        <SettingsForm saved={settings.data} />
      )}
    </div>
  );
}

function SettingsForm({ saved }: { saved: Settings }) {
  const update = useUpdateSettings();
  const { setPreference } = useTheme();
  const [justSaved, setJustSaved] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    resetField,
    getFieldState,
    setError,
    formState: { errors, isDirty },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toSettingsValues(saved),
  });

  // The theme choice previews straight away; if the form is left unsaved, the saved theme comes back
  const theme = useWatch({ control, name: 'theme' });
  const savedTheme = useRef(saved.theme);
  useEffect(() => {
    savedTheme.current = saved.theme;
  }, [saved.theme]);
  useEffect(() => {
    setPreference(toLocalTheme(theme));
  }, [theme, setPreference]);
  useEffect(() => () => setPreference(toLocalTheme(savedTheme.current)), [setPreference]);
  // A theme picked from the top-bar menu meanwhile is saved already; show it here unless edited
  useEffect(() => {
    if (!getFieldState('theme').isDirty) resetField('theme', { defaultValue: saved.theme });
  }, [saved.theme, getFieldState, resetField]);

  const onSubmit = handleSubmit((values) => {
    setJustSaved(false);
    update.mutate(fromSettingsValues(values), {
      onSuccess: (next) => {
        reset(toSettingsValues(next));
        setJustSaved(true);
      },
      onError: (error) => {
        for (const fe of error.fieldErrors) {
          if (FIELDS.has(fe.field as keyof SettingsValues)) {
            setError(fe.field as keyof SettingsValues, { message: fe.message });
          }
        }
      },
    });
  });

  const formError = update.error && update.error.fieldErrors.length === 0 ? errorMessage(update.error) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {formError && <FormAlert message={formError} />}

      <Section title="Time and calendar">
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
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-[13px] font-medium text-ink">Week starts on</legend>
          <div className="flex gap-4">
            {(
              [
                ['MON', 'Monday'],
                ['SUN', 'Sunday'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-[13.5px] text-ink">
                <input
                  type="radio"
                  value={value}
                  className="accent-[var(--academics)]"
                  {...register('weekStart')}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="text-[12.5px] text-ink-3">Used by the timetable and weekly views.</p>
        </fieldset>
      </Section>

      <Section title="Academics">
        <Field
          label="University (optional)"
          placeholder="Your university"
          error={errors.universityName?.message}
          {...register('universityName')}
        />
        <Field
          label="Default attendance target % (optional)"
          inputMode="decimal"
          hint="Used when neither a course nor its semester sets its own. Leave empty and NOVA won’t assume a rule."
          error={errors.defaultAttendanceTarget?.message}
          {...register('defaultAttendanceTarget')}
        />
      </Section>

      <Section title="Appearance">
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-[13px] font-medium text-ink">Theme</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {THEMES.map(({ value, label, Icon }) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2.5 text-[13.5px] text-ink',
                  'has-[:checked]:border-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus/25',
                  'border-line-strong',
                )}
              >
                <input type="radio" value={value} className="sr-only" {...register('theme')} />
                <Icon size={15} aria-hidden />
                {label}
              </label>
            ))}
          </div>
          <p className="text-[12.5px] text-ink-3">
            Saved to your account, so every device you sign in on matches.
          </p>
        </fieldset>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" loading={update.isPending} disabled={!isDirty}>
          Save changes
        </Button>
        {isDirty && (
          <Button onClick={() => reset(toSettingsValues(saved))} disabled={update.isPending}>
            Discard
          </Button>
        )}
        <p aria-live="polite" className="text-[13px] text-ink-2">
          {justSaved && !isDirty ? 'Saved.' : ''}
        </p>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `settings-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="grid gap-4 rounded-md border border-line bg-surface p-5">
      <h2 id={id} className="text-[15px] font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
