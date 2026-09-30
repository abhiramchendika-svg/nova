import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { FormAlert } from '@/components/patterns/FormAlert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { useCourses, useCreateCourse, useSemesters } from '@/features/academics/api';
import { Credits } from '@/features/academics/Credits';
import { errorMessage } from '@/services/http';
import { Actions, StepHeader } from './parts';
import { courseRowsSchema, emptyRow, filledRows, type CourseRowsValues } from './steps';

/**
 * Step 3: the semester's courses as quick rows (code, name, credits). Rows are saved one by one
 * with the normal course API; a row the server refuses stays with its message, the rest are kept.
 */
export function CoursesStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const semesters = useSemesters();
  const semester = semesters.data?.find((s) => s.current);
  const courses = useCourses(semester?.id);
  const create = useCreateCourse();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const existing = courses.data ?? [];

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CourseRowsValues>({
    resolver: zodResolver(courseRowsSchema),
    defaultValues: { rows: existing.length > 0 ? [emptyRow()] : [emptyRow(), emptyRow(), emptyRow()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  const onSubmit = handleSubmit(async (values) => {
    if (!semester) return;
    setFormError(null);
    const rows = values.rows.map((row, index) => ({ row, index }));
    const toSave = rows.filter(({ row }) => filledRows({ rows: [row] }).length > 0);
    if (toSave.length === 0 && existing.length === 0) {
      setFormError('Add at least one course to continue.');
      return;
    }
    setSaving(true);
    const saved: number[] = [];
    for (const { row, index } of toSave) {
      try {
        await create.mutateAsync({
          semesterId: semester.id,
          code: row.code.trim() || null,
          name: row.name.trim(),
          credits: Number(row.credits),
          faculty: null,
          colorHue: null,
          notes: null,
          attendanceTarget: null,
        });
        saved.push(index);
      } catch (error) {
        const fe = (error as { fieldErrors?: { field: string; message: string }[] }).fieldErrors ?? [];
        const field = fe.find((f) => f.field === 'name' || f.field === 'credits' || f.field === 'code');
        if (field) setError(`rows.${index}.${field.field as 'name'}`, { message: field.message });
        else setFormError(errorMessage(error));
        remove(saved);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <StepHeader title={`Courses in ${semester?.name ?? 'this semester'}`}>
        Add each course with its credits. Faculty, targets and grades can be filled in later on the Courses
        page.
      </StepHeader>
      {formError && <FormAlert message={formError} />}
      {existing.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-[13px] font-medium text-ink">Already added</p>
          <ul aria-label="Courses already added" className="grid gap-1 text-[13.5px] text-ink-2">
            {existing.map((c) => (
              <li key={c.id}>
                {c.code && <span className="mr-2 font-mono text-[12.5px] text-ink-3">{c.code}</span>}
                <span className="text-ink">{c.name}</span> · <Credits value={c.credits} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <fieldset className="grid gap-3">
        <legend className="sr-only">New courses</legend>
        {fields.map((field, i) => (
          // Phones: name on top, then code and credits; wider screens: one row per course
          <div
            key={field.id}
            role="group"
            aria-label={`Course ${i + 1}`}
            className="grid grid-cols-[1fr_96px] items-start gap-2 rounded-md border border-line p-3 sm:grid-cols-[110px_1fr_90px_36px] sm:border-0 sm:p-0"
          >
            <Field
              className="order-2 sm:order-1"
              label={`Course ${i + 1} code`}
              placeholder={i === 0 ? 'CSE 201' : undefined}
              error={errors.rows?.[i]?.code?.message}
              {...register(`rows.${i}.code`)}
            />
            <Field
              className="order-1 col-span-2 sm:order-2 sm:col-span-1"
              label={`Course ${i + 1} name`}
              placeholder={i === 0 ? 'Database Systems' : undefined}
              error={errors.rows?.[i]?.name?.message}
              {...register(`rows.${i}.name`)}
            />
            <Field
              className="order-3"
              label="Credits"
              inputMode="decimal"
              placeholder={i === 0 ? '4' : undefined}
              error={errors.rows?.[i]?.credits?.message}
              {...register(`rows.${i}.credits`)}
            />
            <IconButton
              label={`Remove course ${i + 1}`}
              className="order-4 col-span-2 justify-self-end sm:col-span-1 sm:mt-[26px]"
              disabled={fields.length === 1}
              onClick={() => remove(i)}
            >
              <Trash2 size={15} aria-hidden />
            </IconButton>
          </div>
        ))}
        <div>
          <Button size="sm" variant="ghost" onClick={() => append(emptyRow())} disabled={fields.length >= 12}>
            <Plus size={14} aria-hidden />
            Add another course
          </Button>
        </div>
      </fieldset>
      <Actions onBack={onBack}>
        <Button type="submit" variant="primary" loading={saving}>
          Continue
        </Button>
      </Actions>
    </form>
  );
}
