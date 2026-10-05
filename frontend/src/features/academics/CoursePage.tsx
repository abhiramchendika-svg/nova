import { ArrowLeft, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { Progress } from '@/components/ui/Progress';
import { useSettings } from '@/features/settings/api';
import { formatDateTime } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import { useCourseOverview, useCourses, useDeleteResource, useSemesters } from './api';
import { AssignmentDialog } from './AssignmentDialog';
import { AssignmentItem } from './AssignmentItem';
import { attendanceVerdict } from './attendanceText';
import { CourseDialog } from './CourseDialog';
import { Credits } from './Credits';
import { DeleteAssignmentDialog } from './DeleteAssignmentDialog';
import { ExamDialog } from './ExamDialog';
import { daysUntilText, KIND_LABEL, prepText } from './examText';
import { formatPercent } from './format';
import { ResourceDialog } from './ResourceDialog';
import { CLASS_KIND_LABEL, DAY_SHORT } from './timetableText';
import type { Assignment, CourseOverview, CourseResource } from './types';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Hostname shown next to a link, so the destination is visible before opening it. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * One course in one place: attendance, open work, upcoming exams and links, from a single
 * request (GET /courses/{id}/overview).
 */
export function CoursePage() {
  const { courseId = '' } = useParams();
  const overview = useCourseOverview(courseId);
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();

  if (overview.isPending) {
    return (
      <Shell>
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading the course…</span>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </Shell>
    );
  }
  if (overview.isError) {
    return (
      <Shell>
        {overview.error.status === 404 ? (
          <EmptyState
            title="We couldn’t find that course."
            description="It may have been deleted, or the link is wrong."
            action={
              <ButtonLink to="/app/academics/courses" size="sm" variant="primary">
                Back to courses
              </ButtonLink>
            }
          />
        ) : (
          <ErrorState
            title="We couldn’t load this course."
            onRetry={() => void overview.refetch()}
            retrying={overview.isFetching}
            requestId={overview.error.problem.requestId}
          />
        )}
      </Shell>
    );
  }
  return <CourseView data={overview.data} timezone={timezone} />;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-5xl gap-5 px-4 py-6 lg:px-6">{children}</div>
  );
}

function CourseView({ data, timezone }: { data: CourseOverview; timezone: string }) {
  const { course } = data;
  const semesters = useSemesters();
  const semester = semesters.data?.find((s) => s.id === course.semesterId);
  const siblings = useCourses(course.semesterId);
  const [editingCourse, setEditingCourse] = useState(false);
  const [assignmentDialog, setAssignmentDialog] = useState<{ open: boolean; editing?: Assignment }>({
    open: false,
  });
  const [deletingAssignment, setDeletingAssignment] = useState<Assignment | null>(null);
  const [addingExam, setAddingExam] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  return (
    <Shell>
      <div>
        <Link
          to={`/app/academics/courses?semester=${course.semesterId}`}
          className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={14} aria-hidden />
          {semester ? `${semester.name} courses` : 'Courses'}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">
            {course.code && (
              <span className="mr-2 font-mono text-[16px] font-normal text-ink-3">{course.code}</span>
            )}
            {course.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
            <span>
              <Credits value={course.credits} />
            </span>
            {course.faculty && <span>· {course.faculty}</span>}
            {course.grade && (
              <Badge tone={course.grade.kind === 'FINAL' ? 'academics' : 'neutral'}>
                {course.grade.label}
                {course.grade.kind === 'EXPECTED' ? ' expected' : ''}
              </Badge>
            )}
          </p>
        </div>
        <Button onClick={() => setEditingCourse(true)} disabled={!semester}>
          <Pencil size={14} aria-hidden />
          Edit course
        </Button>
      </header>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="grid gap-4">
          <Panel
            title="Assignments"
            domain="academics"
            action={
              <Button size="sm" variant="ghost" onClick={() => setAssignmentDialog({ open: true })}>
                <Plus size={14} aria-hidden />
                Add
              </Button>
            }
          >
            {data.openAssignmentCount === 0 ? (
              <p className="text-[13px] text-ink-2">Nothing open for this course.</p>
            ) : (
              <>
                <p className="mb-3 text-[13px] text-ink-2">
                  <span className="font-mono tabular text-ink">{data.openAssignmentCount}</span> open
                  {data.overdueCount > 0 && (
                    <>
                      {' '}
                      · <span className="font-mono tabular text-critical">{data.overdueCount}</span> overdue
                    </>
                  )}
                </p>
                <ul
                  aria-label={`Open assignments for ${course.name}`}
                  className="@container -mx-5 divide-y divide-line border-y border-line"
                >
                  {data.openAssignments.map((a) => (
                    <AssignmentItem
                      key={a.id}
                      assignment={a}
                      timezone={timezone}
                      showCourse={false}
                      showUrgency
                      className="px-5"
                      onEdit={(x) => setAssignmentDialog({ open: true, editing: x })}
                      onDelete={setDeletingAssignment}
                      onChanged={setAnnouncement}
                    />
                  ))}
                </ul>
              </>
            )}
            <Link
              to={`/app/academics/assignments?course=${course.id}`}
              className="mt-3 inline-block text-[13px] font-medium text-academics-text hover:underline"
            >
              {data.openAssignmentCount > data.openAssignments.length
                ? `See all ${data.openAssignmentCount} open assignments`
                : 'All assignments for this course'}
            </Link>
          </Panel>

          <Panel
            title="Upcoming exams"
            domain="academics"
            action={
              <Button size="sm" variant="ghost" onClick={() => setAddingExam(true)}>
                <Plus size={14} aria-hidden />
                Add
              </Button>
            }
          >
            {data.upcomingExams.length === 0 ? (
              <p className="text-[13px] text-ink-2">No exams coming up.</p>
            ) : (
              <ul aria-label={`Upcoming exams for ${course.name}`} className="grid gap-3">
                {data.upcomingExams.map((e) => (
                  <li key={e.id} className="grid gap-1.5">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        to={`/app/academics/exams/${e.id}`}
                        className="font-medium text-ink hover:text-academics-text hover:underline"
                      >
                        {e.title}
                      </Link>
                      <span className="text-[12.5px] font-medium text-ink">{daysUntilText(e.daysUntil)}</span>
                    </p>
                    <p className="text-[12.5px] text-ink-2">
                      {KIND_LABEL[e.kind]} ·{' '}
                      <span className="tabular">{formatDateTime(e.startsAt, timezone)}</span>
                      {e.location && <> · {e.location}</>}
                    </p>
                    {e.prep.percentage !== null ? (
                      <Progress
                        value={e.prep.percentage}
                        label={`${e.title} prep: ${prepText(e.prep)}`}
                        domain="academics"
                        showLabel={false}
                      />
                    ) : null}
                    <p className="text-[12.5px] text-ink-2">
                      {prepText(e.prep)}
                      {e.prep.percentage !== null && (
                        <>
                          {' '}
                          (<span className="font-mono tabular">{e.prep.percentage}%</span>)
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid gap-4">
          <AttendancePanel data={data} />
          <Panel
            title="Weekly classes"
            domain="academics"
            action={
              <Link
                to={`/app/academics/timetable?semester=${course.semesterId}`}
                className="text-[12.5px] font-medium text-ink-2 hover:text-ink"
              >
                Timetable
              </Link>
            }
          >
            {data.timetable.length === 0 ? (
              <p className="text-[13px] text-ink-2">Not on your timetable yet.</p>
            ) : (
              <ul aria-label={`Weekly classes for ${course.name}`} className="grid gap-1.5 text-[13px]">
                {data.timetable.map((e) => (
                  <li key={e.id} className="flex flex-wrap gap-x-2">
                    <span className="w-9 font-medium text-ink">{DAY_SHORT[e.dayOfWeek]}</span>
                    <span className="font-mono tabular text-ink">
                      {e.startsAt}–{e.endsAt}
                    </span>
                    <span className="text-ink-2">
                      {CLASS_KIND_LABEL[e.kind]}
                      {e.location && <> · {e.location}</>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <LinksPanel courseId={course.id} resources={data.resources} />
        </div>
      </div>

      {semester && (
        <CourseDialog
          open={editingCourse}
          onOpenChange={setEditingCourse}
          semesterId={semester.id}
          semesterName={semester.name}
          course={course}
        />
      )}
      <AssignmentDialog
        open={assignmentDialog.open}
        onOpenChange={(o) => setAssignmentDialog((d) => ({ ...d, open: o }))}
        courses={siblings.data ?? [course]}
        timezone={timezone}
        assignment={assignmentDialog.editing}
        defaultCourseId={course.id}
      />
      <DeleteAssignmentDialog assignment={deletingAssignment} onClose={() => setDeletingAssignment(null)} />
      <ExamDialog
        open={addingExam}
        onOpenChange={setAddingExam}
        courses={siblings.data ?? [course]}
        timezone={timezone}
        defaultCourseId={course.id}
      />
    </Shell>
  );
}

function AttendancePanel({ data }: { data: CourseOverview }) {
  const a = data.attendance;
  const verdict = attendanceVerdict(a);
  return (
    <Panel title="Attendance" domain="academics">
      <div className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] text-ink-2">
            <span className="font-mono tabular text-ink">{a.attended}</span> of{' '}
            <span className="font-mono tabular text-ink">{a.conducted}</span> attended
          </p>
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
        <Link
          to={`/app/academics/attendance?semester=${data.course.semesterId}`}
          className="text-[13px] font-medium text-academics-text hover:underline"
        >
          Mark attendance
        </Link>
      </div>
    </Panel>
  );
}

function LinksPanel({ courseId, resources }: { courseId: string; resources: CourseResource[] }) {
  const [dialog, setDialog] = useState<{ open: boolean; editing?: CourseResource }>({ open: false });
  const [deleting, setDeleting] = useState<CourseResource | null>(null);
  const remove = useDeleteResource();
  return (
    <Panel
      title="Links"
      domain="academics"
      action={
        <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true })}>
          <Plus size={14} aria-hidden />
          Add
        </Button>
      }
    >
      {resources.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-ink-2">
          Keep the syllabus, lecture recordings or the course’s LMS page here.
        </p>
      ) : (
        <ul aria-label="Course links" className="grid gap-1">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center gap-1">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group grid min-w-0 flex-1 rounded-sm px-2 py-1.5 hover:bg-surface-2"
              >
                <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                  <span className="truncate">{r.title}</span>
                  <ExternalLink size={13} aria-hidden className="shrink-0 text-ink-3" />
                  <span className="sr-only">(opens in a new tab)</span>
                </span>
                <span className="truncate text-[12px] text-ink-3">{hostOf(r.url)}</span>
              </a>
              <IconButton label={`Edit ${r.title}`} onClick={() => setDialog({ open: true, editing: r })}>
                <Pencil size={15} aria-hidden />
              </IconButton>
              <IconButton label={`Delete ${r.title}`} onClick={() => setDeleting(r)}>
                <Trash2 size={15} aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <ResourceDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        courseId={courseId}
        resource={dialog.editing}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            remove.reset();
          }
        }}
        title="Remove this link?"
        description={
          <>
            <strong className="text-ink">{deleting?.title}</strong> will be removed from this course.
          </>
        }
        confirmLabel="Remove link"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() =>
          deleting && remove.mutate({ courseId, id: deleting.id }, { onSuccess: () => setDeleting(null) })
        }
      />
    </Panel>
  );
}
