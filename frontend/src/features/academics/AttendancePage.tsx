import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { SelectField } from '@/components/ui/SelectField';
import { toSettingsRequest, useSettings, useUpdateSettings } from '@/features/settings/api';
import { todayIn } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useSemesterAttendance, useSemesters } from './api';
import { CourseAttendanceCard } from './CourseAttendanceCard';
import { formatTarget } from './format';
import { pickSemester } from './selection';

/**
 * Attendance (J4 in architecture.md: "Can I skip tomorrow's class?"). Each course leads with its
 * answer, "you can miss N more", and marking a class updates it immediately.
 */
export function AttendancePage() {
  const [params, setParams] = useSearchParams();
  const semesters = useSemesters();
  const settings = useSettings();
  const list = semesters.data ?? [];
  const selected = pickSemester(list, params.get('semester'));
  const attendance = useSemesterAttendance(selected?.id);
  const [editingDefault, setEditingDefault] = useState(false);

  // "Today" in the user's saved timezone, the same day the server checks against
  const today = todayIn(settings.data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const needsTarget =
    settings.data?.defaultAttendanceTarget === null &&
    (attendance.data ?? []).some((a) => a.status === 'NO_TARGET');

  return (
    <div className="animate-enter mx-auto grid max-w-4xl gap-5 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Attendance</h1>
          <p className="mt-1 text-ink-2">
            See how many classes you can miss, and mark each one as it happens.
          </p>
        </div>
        {list.length > 1 && selected && (
          <SelectField
            label="Semester"
            className="w-56"
            value={selected.id}
            onChange={(e) => setParams({ semester: e.target.value }, { replace: true })}
          >
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.current ? ' (current)' : ''}
              </option>
            ))}
          </SelectField>
        )}
      </header>

      {settings.data && (
        <DefaultTarget
          editing={editingDefault}
          onEditingChange={setEditingDefault}
          value={settings.data.defaultAttendanceTarget}
        />
      )}

      {needsTarget && !editingDefault && (
        <EmptyState
          compact
          title="Set your attendance target to see how many classes you can miss."
          description="NOVA doesn’t assume a rule. Use your university’s minimum, for example 75%."
          action={
            <Button size="sm" variant="primary" onClick={() => setEditingDefault(true)}>
              Set target
            </Button>
          }
        />
      )}

      {semesters.isPending || (selected && attendance.isPending) ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading your attendance…</span>
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : semesters.isError || attendance.isError ? (
        <ErrorState
          title="We couldn’t load your attendance."
          onRetry={() => {
            void semesters.refetch();
            void attendance.refetch();
          }}
          requestId={(semesters.error ?? attendance.error)?.problem.requestId}
        />
      ) : !selected ? (
        <EmptyState
          title="Attendance is tracked per course."
          description="Add your semester and its courses first."
          action={
            <ButtonLink to="/app/academics/courses" size="sm" variant="primary">
              Add a semester
            </ButtonLink>
          }
        />
      ) : attendance.data!.length === 0 ? (
        <EmptyState
          title={`No courses in ${selected.name} yet.`}
          action={
            <ButtonLink to={`/app/academics/courses?semester=${selected.id}`} size="sm" variant="primary">
              Add courses
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-4">
          {attendance.data!.map((a) => (
            <CourseAttendanceCard key={a.courseId} attendance={a} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}

const targetPattern = /^\d{1,2}(\.\d{1,2})?$/;

/** The user's default target, used when neither a course nor its semester sets one. Saved to settings. */
function DefaultTarget({
  value,
  editing,
  onEditingChange,
}: {
  value: number | null;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const settings = useSettings();
  const update = useUpdateSettings();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Move focus to the field when the user opens the editor (not on page load)
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const open = () => {
    setDraft(value === null ? '' : String(value));
    setError(null);
    update.reset();
    onEditingChange(true);
  };

  const save = () => {
    const text = draft.trim();
    if (text !== '' && (!targetPattern.test(text) || Number(text) <= 0)) {
      setError('Use a number between 0 and 100, like 75.');
      return;
    }
    if (!settings.data) return;
    update.mutate(
      { ...toSettingsRequest(settings.data), defaultAttendanceTarget: text === '' ? null : Number(text) },
      { onSuccess: () => onEditingChange(false) },
    );
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-ink-2">
        <span>
          Default target:{' '}
          <strong className="font-mono font-medium tabular text-ink">
            {value === null ? 'not set' : formatTarget(value)}
          </strong>
        </span>
        <span className="text-[12.5px] text-ink-3">
          Used when a course and its semester don’t set their own.
        </span>
        <Button size="sm" variant="ghost" onClick={open} className="ml-auto">
          {value === null ? 'Set default' : 'Change'}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
      className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-4"
    >
      <Field
        label="Default attendance target %"
        inputMode="decimal"
        className="w-56"
        hint="Leave empty for no default."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        error={error ?? (update.isError ? errorMessage(update.error) : undefined)}
        ref={inputRef}
      />
      <Button type="submit" size="sm" variant="primary" loading={update.isPending} className="mb-6">
        Save target
      </Button>
      <Button size="sm" onClick={() => onEditingChange(false)} className="mb-6">
        Cancel
      </Button>
    </form>
  );
}
