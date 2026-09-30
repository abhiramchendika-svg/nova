import { useId, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Progress } from '@/components/ui/Progress';
import { SelectField } from '@/components/ui/SelectField';
import { formatDay } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useMarkAttendance } from './api';
import { AttendanceHistory } from './AttendanceHistory';
import { attendanceVerdict, MARK_LABEL, SOURCE_TEXT } from './attendanceText';
import { BaselineDialog } from './BaselineDialog';
import { formatPercent, formatTarget } from './format';
import type { AttendanceMark, CourseAttendance } from './types';

export function CourseAttendanceCard({
  attendance: a,
  today,
}: {
  attendance: CourseAttendance;
  today: string;
}) {
  const headingId = useId();
  const verdict = attendanceVerdict(a);
  const mark = useMarkAttendance();
  const [otherDay, setOtherDay] = useState(false);
  const [day, setDay] = useState(today);
  const [slot, setSlot] = useState(1);
  const [lastMarked, setLastMarked] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editingBaseline, setEditingBaseline] = useState(false);

  const heldOn = otherDay ? day : today;
  const whenLabel = heldOn === today ? 'today' : formatDay(heldOn);

  const markAs = (status: AttendanceMark) => {
    setLastMarked(null);
    mark.mutate(
      { courseId: a.courseId, heldOn, slot: otherDay ? slot : 1, status },
      { onSuccess: () => setLastMarked(`Marked ${MARK_LABEL[status].toLowerCase()} for ${whenLabel}.`) },
    );
  };

  return (
    <section aria-labelledby={headingId} className="grid gap-4 rounded-md border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="truncate text-[15px] font-semibold">
            {a.courseCode && (
              <span className="mr-2 font-mono text-[12.5px] font-normal text-ink-3">{a.courseCode}</span>
            )}
            {a.courseName}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            <span className="font-mono tabular">{a.attended}</span> of{' '}
            <span className="font-mono tabular">{a.conducted}</span> attended
            {a.target !== null && a.targetSource !== null && (
              <>
                {' '}
                · target <span className="font-mono tabular">{formatTarget(a.target)}</span> (
                {SOURCE_TEXT[a.targetSource]})
              </>
            )}
            {a.cancelled > 0 && <> · {a.cancelled} cancelled</>}
          </p>
        </div>
        <p className="font-mono text-[22px] font-medium leading-7 tabular text-ink">
          {formatPercent(a.percentage)}
        </p>
      </div>

      {a.percentage !== null && (
        <Progress
          value={a.percentage}
          label={`${a.courseName} attendance`}
          domain="academics"
          showLabel={false}
        />
      )}

      <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink">
        <Badge tone={verdict.tone}>{verdict.chip}</Badge>
        <span>{verdict.sentence}</span>
      </p>

      <div className="grid gap-1.5">
        <div
          role="group"
          aria-label={`Mark ${a.courseName} for ${whenLabel}`}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-[13px] text-ink-2">Mark {whenLabel}:</span>
          {(['PRESENT', 'ABSENT', 'CANCELLED'] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === 'PRESENT' ? 'primary' : 'secondary'}
              disabled={mark.isPending || (otherDay && !day)}
              onClick={() => markAs(status)}
            >
              {MARK_LABEL[status]}
            </Button>
          ))}
          <Button size="sm" variant="ghost" aria-expanded={otherDay} onClick={() => setOtherDay((v) => !v)}>
            {otherDay ? 'Use today' : 'Another day…'}
          </Button>
        </div>
        {otherDay && (
          <div className="flex flex-wrap items-start gap-3">
            <Field
              label="Day of the class"
              type="date"
              max={today}
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-44"
            />
            <SelectField
              label="Class that day"
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value))}
              className="w-40"
              hint="If it met more than once"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? '1st class' : n === 2 ? '2nd class' : n === 3 ? '3rd class' : '4th class'}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        <p aria-live="polite" className="min-h-[1lh] text-[12.5px]">
          {mark.isError ? (
            <span className="text-critical">{errorMessage(mark.error)}</span>
          ) : (
            lastMarked && <span className="text-ink-2">{lastMarked}</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-t border-line pt-3">
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? 'Hide history' : 'History'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditingBaseline(true)}>
          Starting counts
          {a.baselineConducted > 0 && (
            <span className="font-mono text-[12px] tabular text-ink-3">
              {a.baselineAttended}/{a.baselineConducted}
            </span>
          )}
        </Button>
      </div>
      {showHistory && <AttendanceHistory courseId={a.courseId} courseName={a.courseName} />}
      <BaselineDialog open={editingBaseline} onOpenChange={setEditingBaseline} course={a} />
    </section>
  );
}
