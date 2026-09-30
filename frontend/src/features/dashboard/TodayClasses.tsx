import { Undo2 } from 'lucide-react';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useDeleteMark, useMarkAttendance, useTimetableDay } from '@/features/academics/api';
import { MARK_LABEL } from '@/features/academics/attendanceText';
import { CLASS_KIND_LABEL, ordinalClass } from '@/features/academics/timetableText';
import type { AttendanceMark, DayClass, TimetableDay } from '@/features/academics/types';
import { errorMessage } from '@/services/http';
import { TodayStrip, type StripBlock } from './TodayStrip';

const MARK_TONE: Record<AttendanceMark, BadgeTone> = {
  PRESENT: 'good',
  ABSENT: 'critical',
  CANCELLED: 'neutral',
};

/**
 * Today's classes from the timetable (GET /timetable/day): the timeline strip, then one row per
 * class to mark it present, absent or cancelled in one tap. Marks use the same attendance slot
 * as the Attendance page, so they show up there straight away.
 */
export function TodayClasses({ now }: { now: string }) {
  const day = useTimetableDay();

  if (day.isPending) {
    return (
      <div role="status" aria-busy="true" className="grid gap-3">
        <span className="sr-only">Loading today’s classes…</span>
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (day.isError) {
    return (
      <ErrorState
        title="We couldn’t load today’s classes."
        onRetry={() => void day.refetch()}
        retrying={day.isFetching}
        requestId={day.error.problem.requestId}
      />
    );
  }
  const d = day.data;
  if (!d.semesterId) {
    return (
      <EmptyState
        title="Your day is clear."
        description="Once your timetable and tasks are in, today’s classes, planned work and due times line up here on one timeline."
        action={
          <ButtonLink to="/app/academics/timetable" size="sm">
            Add your timetable
          </ButtonLink>
        }
      />
    );
  }
  if (!d.inTerm) {
    return (
      <EmptyState
        title="No classes today."
        description="Today is outside your current semester’s dates. Update them on the Courses page if the term has started."
      />
    );
  }
  if (d.classes.length === 0) {
    return (
      <EmptyState
        title="No classes today."
        description="Nothing on your timetable for today."
        action={
          <ButtonLink to="/app/academics/timetable" size="sm">
            Open timetable
          </ButtonLink>
        }
      />
    );
  }

  const blocks: StripBlock[] = d.classes.map(({ entry: e }) => ({
    id: e.id,
    kind: 'class',
    domain: 'academics',
    title: e.courseName,
    shortTitle: e.courseCode ?? e.courseName,
    start: e.startsAt,
    end: e.endsAt,
    meta: [CLASS_KIND_LABEL[e.kind], e.location].filter(Boolean).join(' · '),
  }));
  const perCourse = (courseId: string) => d.classes.filter((c) => c.entry.courseId === courseId).length;

  return (
    <div className="grid gap-4">
      {/* The timeline is a picture of the list below, so it's shown from md up and hidden from
          screen readers; the marking list carries the same times, kinds and rooms. */}
      <div aria-hidden className="hidden md:block">
        <TodayStrip blocks={blocks} now={now} label="Today’s classes" />
      </div>
      <section aria-labelledby="mark-today-heading" className="grid gap-2">
        <h3 id="mark-today-heading" className="text-[13.5px] font-semibold">
          Mark today’s classes
        </h3>
        <ul className="divide-y divide-line rounded-md border border-line">
          {d.classes.map((c) => (
            <ClassRow key={c.entry.id} item={c} day={d} showSlot={perCourse(c.entry.courseId) > 1} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function ClassRow({ item, day, showSlot }: { item: DayClass; day: TimetableDay; showSlot: boolean }) {
  const mark = useMarkAttendance();
  const undo = useDeleteMark();
  const e = item.entry;
  const name = `${e.courseCode ? `${e.courseCode} ` : ''}${e.courseName}${showSlot ? ` (${ordinalClass(item.slot)})` : ''}`;
  const error = mark.error ?? undo.error;

  return (
    <li className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium text-ink">{name}</p>
        <p className="text-[12px] text-ink-2">
          <span className="font-mono">
            {e.startsAt}–{e.endsAt}
          </span>{' '}
          · {CLASS_KIND_LABEL[e.kind]}
          {e.location && <> · {e.location}</>}
        </p>
        {error && <p className="text-[12px] text-critical">{errorMessage(error)}</p>}
      </div>
      {item.attendance ? (
        <div className="flex items-center gap-1.5">
          <Badge tone={MARK_TONE[item.attendance.status]}>{MARK_LABEL[item.attendance.status]}</Badge>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Undo ${MARK_LABEL[item.attendance.status].toLowerCase()} for ${name}`}
            loading={undo.isPending}
            onClick={() => undo.mutate(item.attendance!.recordId)}
          >
            <Undo2 size={14} aria-hidden />
            Undo
          </Button>
        </div>
      ) : (
        <div role="group" aria-label={`Mark ${name}`} className="flex flex-wrap gap-1.5">
          {(['PRESENT', 'ABSENT', 'CANCELLED'] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === 'PRESENT' ? 'primary' : 'secondary'}
              disabled={mark.isPending}
              onClick={() => mark.mutate({ courseId: e.courseId, heldOn: day.date, slot: item.slot, status })}
            >
              {MARK_LABEL[status]}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}
