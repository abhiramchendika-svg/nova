import { useQueries } from '@tanstack/react-query';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SelectField } from '@/components/ui/SelectField';
import { Switch } from '@/components/ui/Switch';
import { errorMessage, type ApiError } from '@/services/http';
import {
  coursesQuery,
  useGradesSummary,
  useGradingSchemes,
  useSemesters,
  useSetCourseGrade,
  useWhatIf,
} from './api';
import { Credits } from './Credits';
import { EXCLUSION_TEXT, formatGpa, formatNumber } from './format';
import type { Course, GradeDefinition, GradeKind, GradesSummary, Semester } from './types';

/**
 * Grades: CGPA first, then each semester's courses with their grades (J5 in architecture.md).
 * What-if mode lets the student try grades without saving them; its numbers are always labelled
 * as hypothetical so they can't be mistaken for the real ones.
 */
export function GradesPage() {
  const summary = useGradesSummary();
  const semesters = useSemesters();
  const schemes = useGradingSchemes();
  const ordered = useMemo(
    () => [...(semesters.data ?? [])].sort((a, b) => b.ordinal - a.ordinal), // newest first
    [semesters.data],
  );
  const courseQueries = useQueries({ queries: ordered.map((s) => coursesQuery(s.id)) });

  const [whatIfOn, setWhatIfOn] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const overrideList = useMemo(
    () =>
      Object.entries(overrides)
        .sort(([a], [b]) => a.localeCompare(b)) // stable query key
        .map(([courseId, gradeDefinitionId]) => ({ courseId, gradeDefinitionId })),
    [overrides],
  );
  const whatIf = useWhatIf(overrideList, whatIfOn);
  const whatIfResult = whatIfOn && overrideList.length > 0 ? whatIf.data : undefined;

  const toggleWhatIf = (on: boolean) => {
    setWhatIfOn(on);
    if (!on) setOverrides({});
  };

  const loading = summary.isPending || semesters.isPending || schemes.isPending;
  const failed = summary.error ?? semesters.error ?? schemes.error;

  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-5xl gap-5 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Grades</h1>
          <p className="mt-1 text-ink-2">Your GPA and CGPA, worked out from your course grades.</p>
        </div>
        <ButtonLink to="/app/academics/grades/schemes" size="sm" variant="ghost">
          Grading schemes
        </ButtonLink>
      </header>

      {loading ? (
        <div role="status" aria-busy="true" className="grid gap-4">
          <span className="sr-only">Loading your grades…</span>
          <Skeleton className="h-28" />
          <Skeleton className="h-48" />
        </div>
      ) : failed ? (
        <ErrorState
          title="We couldn’t load your grades."
          onRetry={() => {
            void summary.refetch();
            void semesters.refetch();
            void schemes.refetch();
          }}
          requestId={(failed as ApiError).problem?.requestId}
        />
      ) : ordered.length === 0 ? (
        <EmptyState
          title="Your grades live in your semesters."
          description="Add a semester and its courses first. Then set a grade on each course and your GPA and CGPA appear here."
          action={
            <ButtonLink to="/app/academics/courses" variant="primary" size="sm">
              Add a semester
            </ButtonLink>
          }
        />
      ) : (
        <>
          <Overview summary={summary.data!} />

          <section
            aria-label="What-if"
            className="grid gap-3 rounded-md border border-dashed border-line-strong bg-surface p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Switch label="Try what-if grades" checked={whatIfOn} onCheckedChange={toggleWhatIf} />
              {whatIfOn && overrideList.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setOverrides({})}>
                  <RotateCcw size={14} aria-hidden />
                  Reset
                </Button>
              )}
            </div>
            {whatIfOn && (
              <div aria-live="polite" className="grid gap-1 text-[13.5px] text-ink-2">
                {overrideList.length === 0 ? (
                  <p>
                    Nothing is saved in this mode. Pick a grade on any course below to see where you’d land.
                  </p>
                ) : whatIf.isError ? (
                  <p className="text-critical">{errorMessage(whatIf.error)}</p>
                ) : whatIfResult ? (
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone="academics">
                      <FlaskConical size={12} aria-hidden />
                      What-if
                    </Badge>
                    <span>
                      CGPA would be{' '}
                      <strong className="font-mono text-[15px] tabular text-ink">
                        {formatGpa(whatIfResult.projectedCgpa)}
                      </strong>{' '}
                      (includes expected grades). Nothing is saved.
                    </span>
                  </p>
                ) : (
                  <p>Calculating…</p>
                )}
              </div>
            )}
          </section>

          {ordered.map((semester, i) => (
            <SemesterGradesPanel
              key={semester.id}
              semester={semester}
              stats={summary.data!.semesters.find((s) => s.id === semester.id)}
              whatIfStats={whatIfResult?.semesters.find((s) => s.id === semester.id)}
              grades={schemes.data!.find((s) => s.id === semester.gradingScheme.id)?.grades ?? []}
              courses={courseQueries[i]?.data}
              coursesError={courseQueries[i]?.isError ?? false}
              whatIfOn={whatIfOn}
              overrides={overrides}
              onOverride={(courseId, gradeId) =>
                setOverrides((current) => {
                  const next = { ...current };
                  if (gradeId) next[courseId] = gradeId;
                  else delete next[courseId];
                  return next;
                })
              }
            />
          ))}

          {summary.data!.excluded.length > 0 && (
            <Panel title="Not counted in GPA">
              <ul className="grid gap-1.5 text-[13.5px]">
                {summary.data!.excluded.map((e) => (
                  <li key={e.courseId}>
                    <span className="font-medium text-ink">{e.courseName}</span>
                    <span className="text-ink-2">: {EXCLUSION_TEXT[e.reason]}.</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

function Overview({ summary }: { summary: GradesSummary }) {
  const mixed = summary.cgpaUnavailableReason === 'MIXED_SCALES';
  const hasProjection = summary.projectedCgpa !== null && summary.semesters.some((s) => s.hasExpectedGrades);
  return (
    <section
      aria-label="Overview"
      className="grid gap-4 rounded-md border border-line bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8"
    >
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-3">CGPA</p>
        <p className="mt-1 font-mono text-[40px] font-medium leading-[44px] tabular text-ink">
          {formatGpa(summary.cgpa)}
          {summary.cgpa !== null && summary.scale !== null && (
            <span className="ml-1.5 text-[16px] text-ink-3">/ {formatNumber(summary.scale)}</span>
          )}
        </p>
      </div>
      <div className="grid gap-1.5 text-[14px] text-ink-2">
        {mixed ? (
          <p>
            Your semesters use different grading scales, so NOVA doesn’t combine them into one CGPA. Each
            semester’s GPA is shown below.
          </p>
        ) : summary.cgpa === null ? (
          <p>Your CGPA appears once a course has a final grade.</p>
        ) : null}
        {hasProjection && (
          <p>
            Projected{' '}
            <strong className="font-mono tabular text-ink">{formatGpa(summary.projectedCgpa)}</strong> once
            your expected grades are included.
          </p>
        )}
        <p>
          <span className="font-mono tabular text-ink">{formatNumber(summary.completedCredits)}</span> of{' '}
          <span className="text-ink">
            <Credits value={summary.totalCredits} />
          </span>{' '}
          completed.
        </p>
      </div>
    </section>
  );
}

function SemesterGradesPanel({
  semester,
  stats,
  whatIfStats,
  grades,
  courses,
  coursesError,
  whatIfOn,
  overrides,
  onOverride,
}: {
  semester: Semester;
  stats: GradesSummary['semesters'][number] | undefined;
  whatIfStats: GradesSummary['semesters'][number] | undefined;
  grades: GradeDefinition[];
  courses: Course[] | undefined;
  coursesError: boolean;
  whatIfOn: boolean;
  overrides: Record<string, string>;
  onOverride: (courseId: string, gradeId: string | null) => void;
}) {
  const title = semester.current ? `${semester.name} (current)` : semester.name;
  return (
    <Panel
      title={title}
      domain="academics"
      action={
        <p className="text-[13px] text-ink-2">
          GPA{' '}
          <span className="font-mono text-[15px] font-medium tabular text-ink">{formatGpa(stats?.gpa)}</span>
          {stats?.hasExpectedGrades && stats.projectedGpa !== stats.gpa && (
            <>
              {' '}
              · projected <span className="font-mono tabular text-ink">{formatGpa(stats.projectedGpa)}</span>
            </>
          )}
          {whatIfStats && whatIfStats.projectedGpa !== stats?.projectedGpa && (
            <>
              {' '}
              · what-if{' '}
              <span className="font-mono tabular text-academics-text">
                {formatGpa(whatIfStats.projectedGpa)}
              </span>
            </>
          )}
        </p>
      }
    >
      {coursesError ? (
        <p className="text-[13px] text-critical">
          We couldn’t load this semester’s courses. Refresh to try again.
        </p>
      ) : !courses ? (
        <Skeleton className="h-20" />
      ) : courses.length === 0 ? (
        <EmptyState
          compact
          title="No courses in this semester."
          action={
            <ButtonLink to={`/app/academics/courses?semester=${semester.id}`} size="sm">
              Add courses
            </ButtonLink>
          }
        />
      ) : (
        <ul className="-mx-5 divide-y divide-line border-t border-line">
          {courses.map((course) => (
            <GradeRow
              key={course.id}
              course={course}
              grades={grades}
              defaultKind={semester.current ? 'EXPECTED' : 'FINAL'}
              whatIfOn={whatIfOn}
              override={overrides[course.id] ?? ''}
              onOverride={(gradeId) => onOverride(course.id, gradeId)}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function GradeRow({
  course,
  grades,
  defaultKind,
  whatIfOn,
  override,
  onOverride,
}: {
  course: Course;
  grades: GradeDefinition[];
  defaultKind: GradeKind;
  whatIfOn: boolean;
  override: string;
  onOverride: (gradeId: string | null) => void;
}) {
  const setGrade = useSetCourseGrade();
  const kind = course.grade?.kind ?? defaultKind;
  const gradeOptions = grades.map((g) => (
    <option key={g.id} value={g.id}>
      {g.label} · {formatNumber(g.points)}
      {g.countsInGpa ? '' : ' (not in GPA)'}
    </option>
  ));

  return (
    <li className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">
          {course.code && <span className="mr-2 font-mono text-[12.5px] text-ink-3">{course.code}</span>}
          {course.name}
        </p>
        <p className="text-[12.5px] text-ink-2">
          <Credits value={course.credits} />
          {whatIfOn && (
            <>
              {' '}
              · actual grade:{' '}
              {course.grade
                ? `${course.grade.label} (${course.grade.kind === 'FINAL' ? 'final' : 'expected'})`
                : 'none'}
            </>
          )}
        </p>
        {setGrade.isError && (
          <p className="mt-1 text-[12.5px] text-critical">{errorMessage(setGrade.error)}</p>
        )}
      </div>

      {whatIfOn ? (
        <SelectField
          label={`What-if grade for ${course.name}`}
          hideLabel
          controlSize="sm"
          className="w-44"
          value={override}
          onChange={(e) => onOverride(e.target.value || null)}
        >
          <option value="">Keep actual</option>
          {gradeOptions}
        </SelectField>
      ) : (
        <div className="flex gap-2">
          <SelectField
            label={`Grade for ${course.name}`}
            hideLabel
            controlSize="sm"
            className="w-36"
            value={course.grade?.gradeDefinitionId ?? ''}
            disabled={setGrade.isPending}
            onChange={(e) =>
              setGrade.mutate({ courseId: course.id, gradeDefinitionId: e.target.value || null, kind })
            }
          >
            <option value="">Not graded</option>
            {gradeOptions}
          </SelectField>
          <SelectField
            label={`Grade type for ${course.name}`}
            hideLabel
            controlSize="sm"
            className="w-32"
            value={kind}
            disabled={!course.grade || setGrade.isPending}
            onChange={(e) =>
              course.grade &&
              setGrade.mutate({
                courseId: course.id,
                gradeDefinitionId: course.grade.gradeDefinitionId,
                kind: e.target.value as GradeKind,
              })
            }
          >
            <option value="FINAL">Final</option>
            <option value="EXPECTED">Expected</option>
          </SelectField>
        </div>
      )}
    </li>
  );
}
