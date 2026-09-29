import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SelectField } from '@/components/ui/SelectField';
import { errorMessage } from '@/services/http';
import { useCourses, useDeleteCourse, useDeleteSemester, useMakeCurrentSemester, useSemesters } from './api';
import { CourseDialog } from './CourseDialog';
import { Credits } from './Credits';
import { formatNumber, formatTerm } from './format';
import { SemesterDialog } from './SemesterDialog';
import type { Course, Semester } from './types';

/** Which semester to show: the one in ?semester=, else the current one, else the latest. */
function pickSemester(semesters: Semester[], requestedId: string | null): Semester | undefined {
  return (
    semesters.find((s) => s.id === requestedId) ??
    semesters.find((s) => s.current) ??
    [...semesters].sort((a, b) => b.ordinal - a.ordinal)[0]
  );
}

export function CoursesPage() {
  const [params, setParams] = useSearchParams();
  const semesters = useSemesters();
  const list = semesters.data ?? [];
  const selected = pickSemester(list, params.get('semester'));
  const nextOrdinal = list.reduce((max, s) => Math.max(max, s.ordinal), 0) + 1;

  const [semesterDialog, setSemesterDialog] = useState<{ open: boolean; editing?: Semester }>({
    open: false,
  });
  const [courseDialog, setCourseDialog] = useState<{ open: boolean; editing?: Course }>({ open: false });
  const [deletingSemester, setDeletingSemester] = useState(false);

  const selectSemester = (id: string) => setParams({ semester: id }, { replace: true });

  return (
    <div className="animate-enter mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Courses</h1>
          <p className="mt-1 text-ink-2">Your semesters and the courses in each.</p>
        </div>
        {list.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSemesterDialog({ open: true })}>Add semester</Button>
            {selected && (
              <Button variant="primary" onClick={() => setCourseDialog({ open: true })}>
                <Plus size={15} aria-hidden />
                Add course
              </Button>
            )}
          </div>
        )}
      </header>

      {semesters.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading your semesters…</span>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-40" />
        </div>
      ) : semesters.isError ? (
        <ErrorState
          title="We couldn’t load your semesters."
          onRetry={() => void semesters.refetch()}
          retrying={semesters.isFetching}
          requestId={semesters.error.problem.requestId}
        />
      ) : !selected ? (
        <EmptyState
          title="Start with your current semester."
          description="Add it once, with its grading scheme. Your courses, grades and attendance all belong to a semester."
          action={
            <Button variant="primary" size="sm" onClick={() => setSemesterDialog({ open: true })}>
              Add semester
            </Button>
          }
        />
      ) : (
        <>
          <SemesterBar
            semesters={list}
            selected={selected}
            onSelect={selectSemester}
            onEdit={() => setSemesterDialog({ open: true, editing: selected })}
            onDelete={() => setDeletingSemester(true)}
          />
          <CourseList
            semester={selected}
            onAdd={() => setCourseDialog({ open: true })}
            onEdit={(course) => setCourseDialog({ open: true, editing: course })}
          />
        </>
      )}

      <SemesterDialog
        open={semesterDialog.open}
        onOpenChange={(open) => setSemesterDialog((d) => ({ ...d, open }))}
        semester={semesterDialog.editing}
        nextOrdinal={nextOrdinal}
        defaultCurrent={list.length === 0}
        onSaved={(s) => selectSemester(s.id)}
      />
      {selected && (
        <>
          <CourseDialog
            open={courseDialog.open}
            onOpenChange={(open) => setCourseDialog((d) => ({ ...d, open }))}
            semesterId={selected.id}
            semesterName={selected.name}
            course={courseDialog.editing}
          />
          <DeleteSemesterDialog
            semester={selected}
            open={deletingSemester}
            onOpenChange={setDeletingSemester}
            onDeleted={() => setParams({}, { replace: true })}
          />
        </>
      )}
    </div>
  );
}

function SemesterBar({
  semesters,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  semesters: Semester[];
  selected: Semester;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const makeCurrent = useMakeCurrentSemester();
  const term = formatTerm(selected.startsOn, selected.endsOn);
  return (
    <section
      aria-label="Semester details"
      className="grid gap-3 rounded-md border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Semester"
          className="min-w-56 flex-1 sm:flex-none"
          value={selected.id}
          onChange={(e) => onSelect(e.target.value)}
        >
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.current ? ' (current)' : ''}
            </option>
          ))}
        </SelectField>
        <div className="flex flex-wrap gap-1">
          {!selected.current && (
            <Button
              size="sm"
              variant="ghost"
              loading={makeCurrent.isPending}
              onClick={() => makeCurrent.mutate(selected.id)}
            >
              <Star size={14} aria-hidden />
              Make current
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil size={14} aria-hidden />
            Edit semester
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 size={14} aria-hidden />
            Delete semester
          </Button>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
        {selected.current && <Badge tone="academics">Current</Badge>}
        <span>
          Grading: <span className="text-ink">{selected.gradingScheme.name}</span> (out of{' '}
          <span className="font-mono tabular">{formatNumber(selected.gradingScheme.maxPoints)}</span>)
        </span>
        {term && <span>{term}</span>}
      </p>
      {makeCurrent.isError && <p className="text-[13px] text-critical">{errorMessage(makeCurrent.error)}</p>}
    </section>
  );
}

function CourseList({
  semester,
  onAdd,
  onEdit,
}: {
  semester: Semester;
  onAdd: () => void;
  onEdit: (course: Course) => void;
}) {
  const courses = useCourses(semester.id);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const deleteCourse = useDeleteCourse();

  if (courses.isPending) {
    return (
      <div role="status" aria-busy="true" className="grid gap-2">
        <span className="sr-only">Loading courses…</span>
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }
  if (courses.isError) {
    return (
      <ErrorState
        title="We couldn’t load these courses."
        onRetry={() => void courses.refetch()}
        retrying={courses.isFetching}
        requestId={courses.error.problem.requestId}
      />
    );
  }
  if (courses.data.length === 0) {
    return (
      <EmptyState
        title={`No courses in ${semester.name} yet.`}
        description="Add each course with its credits. Grades, attendance and deadlines attach to courses."
        action={
          <Button variant="primary" size="sm" onClick={onAdd}>
            Add course
          </Button>
        }
      />
    );
  }

  const totalCredits = courses.data.reduce((sum, c) => sum + c.credits, 0);
  return (
    <section aria-labelledby="course-list-heading" className="rounded-md border border-line bg-surface">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="course-list-heading" className="text-[15px] font-semibold">
          {courses.data.length} {courses.data.length === 1 ? 'course' : 'courses'}
        </h2>
        <p className="text-[12.5px] text-ink-2">
          <Credits value={totalCredits} />
        </p>
      </div>
      <ul className="divide-y divide-line">
        {courses.data.map((course) => (
          <li key={course.id} className="flex items-center gap-3 px-4 py-3">
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="truncate font-medium text-ink">
                {course.code && (
                  <span className="mr-2 font-mono text-[12.5px] text-ink-3">{course.code}</span>
                )}
                {course.name}
              </p>
              <p className="text-[12.5px] text-ink-2">
                <Credits value={course.credits} />
                {course.faculty && <> · {course.faculty}</>}
              </p>
            </div>
            {course.grade && (
              <Badge tone={course.grade.kind === 'FINAL' ? 'academics' : 'neutral'}>
                {course.grade.label}
                {course.grade.kind === 'EXPECTED' ? ' expected' : ''}
              </Badge>
            )}
            <IconButton label={`Edit ${course.name}`} onClick={() => onEdit(course)}>
              <Pencil size={15} aria-hidden />
            </IconButton>
            <IconButton label={`Delete ${course.name}`} onClick={() => setDeleting(course)}>
              <Trash2 size={15} aria-hidden />
            </IconButton>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            deleteCourse.reset();
          }
        }}
        title="Delete this course?"
        description={
          <>
            <strong className="text-ink">{deleting?.name}</strong> and its grade will be removed. This can’t
            be undone.
          </>
        }
        confirmLabel="Delete course"
        pending={deleteCourse.isPending}
        error={deleteCourse.isError ? errorMessage(deleteCourse.error) : null}
        onConfirm={() => deleting && deleteCourse.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </section>
  );
}

function DeleteSemesterDialog({
  semester,
  open,
  onOpenChange,
  onDeleted,
}: {
  semester: Semester;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const deleteSemester = useDeleteSemester();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) deleteSemester.reset();
        onOpenChange(next);
      }}
      title={`Delete ${semester.name}?`}
      description="This also deletes every course in it, with their grades. This can’t be undone."
      confirmLabel="Delete semester"
      typeToConfirm={semester.name}
      pending={deleteSemester.isPending}
      error={deleteSemester.isError ? errorMessage(deleteSemester.error) : null}
      onConfirm={() =>
        deleteSemester.mutate(semester.id, {
          onSuccess: () => {
            onOpenChange(false);
            onDeleted();
          },
        })
      }
    />
  );
}
