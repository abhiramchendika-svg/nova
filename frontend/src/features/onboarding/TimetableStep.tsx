import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useCourses, useSemesters, useTimetable } from '@/features/academics/api';
import { TimetableEntryDialog } from '@/features/academics/TimetableEntryDialog';
import { CLASS_KIND_LABEL, DAY_SHORT, weekOrder } from '@/features/academics/timetableText';
import { useSettings } from '@/features/settings/api';
import { Actions, StepHeader } from './parts';

/** Step 4 (skippable): weekly classes, so Home can show today's classes from day one. */
export function TimetableStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const settings = useSettings();
  const semesters = useSemesters();
  const semester = semesters.data?.find((s) => s.current);
  const courses = useCourses(semester?.id);
  const week = useTimetable(null);
  const [adding, setAdding] = useState(false);
  const entries = week.data ?? [];
  const order = weekOrder(settings.data?.weekStart ?? 'MON');

  return (
    <div className="grid gap-5">
      <StepHeader title="Your weekly classes">
        Add the classes that repeat each week. Home will show today’s classes and let you mark attendance in
        one tap. You can skip this and add them from the Timetable page later.
      </StepHeader>
      {entries.length > 0 ? (
        <ul aria-label="Classes added" className="grid gap-1.5 text-[13.5px]">
          {[...entries]
            .sort((a, b) => order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek))
            .map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-2">
                <span className="w-9 font-medium">{DAY_SHORT[e.dayOfWeek]}</span>
                <span className="font-mono tabular">
                  {e.startsAt}–{e.endsAt}
                </span>
                <span>{e.courseCode ?? e.courseName}</span>
                <span className="text-ink-2">{CLASS_KIND_LABEL[e.kind]}</span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-ink-2">No classes yet.</p>
      )}
      <div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={!courses.data?.length}>
          <Plus size={14} aria-hidden />
          Add a class
        </Button>
      </div>
      <Actions onBack={onBack}>
        <Button variant="primary" onClick={onDone}>
          {entries.length > 0 ? 'Continue' : 'Skip'}
        </Button>
      </Actions>
      <TimetableEntryDialog
        open={adding}
        onOpenChange={setAdding}
        courses={courses.data ?? []}
        days={order}
      />
    </div>
  );
}
