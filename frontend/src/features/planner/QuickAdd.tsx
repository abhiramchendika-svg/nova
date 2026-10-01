import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { errorMessage } from '@/services/http';
import { useCreateTask } from './api';
import { taskTitle } from './schemas';

/** One line: type a title, press Enter, and it's planned for {@code plannedFor}. */
export function QuickAdd({
  plannedFor,
  label,
  onAdded,
}: {
  plannedFor: string;
  /** e.g. "Add a task for today". */
  label: string;
  onAdded?: (title: string) => void;
}) {
  const create = useCreateTask();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = taskTitle.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Give the task a title.');
      return;
    }
    const title = parsed.data;
    create.mutate(
      {
        title,
        description: null,
        category: null,
        priority: 'MEDIUM',
        plannedFor,
        plannedStart: null,
        dueAt: null,
        estimatedMinutes: null,
        recurrence: 'NONE',
        courseId: null,
        examId: null,
        projectId: null,
      },
      {
        onSuccess: () => {
          setValue('');
          onAdded?.(title);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-2">
      <Field
        label={label}
        placeholder="Type a title and press Enter"
        className="min-w-48 flex-1"
        value={value}
        error={error ?? (create.isError ? errorMessage(create.error) : undefined)}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
          create.reset();
        }}
      />
      <Button type="submit" className="mt-[26px]" loading={create.isPending}>
        Add
      </Button>
    </form>
  );
}
