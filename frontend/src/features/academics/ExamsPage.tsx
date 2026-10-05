import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { useSettings } from '@/features/settings/api';
import { useCourses, useExams, useSemesters } from './api';
import { ExamCard } from './ExamCard';
import { ExamDialog } from './ExamDialog';
import { pickSemester } from './selection';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Exams as countdowns, soonest first (J3 in architecture.md: "Am I ready for Friday's exam?"). */
export function ExamsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const semesters = useSemesters();
  const current = pickSemester(semesters.data ?? [], null);
  const courses = useCourses(current?.id);
  const courseId = params.get('course') ?? undefined;
  const upcoming = useExams({ upcoming: true, courseId });
  const [adding, setAdding] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const all = useExams({ upcoming: false, courseId }, showPast);

  const choices = courses.data ?? [];
  const noCourses = !semesters.isPending && (!current || (!courses.isPending && choices.length === 0));
  const past = (all.data ?? []).filter((e) => e.daysUntil < 0).reverse();

  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-5xl gap-5 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Exams</h1>
          <p className="mt-1 text-ink-2">How long you have, and how ready you are.</p>
        </div>
        {choices.length > 0 && (
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={15} aria-hidden />
            Add exam
          </Button>
        )}
      </header>

      {semesters.isPending || (current && courses.isPending) ? (
        <Loading />
      ) : semesters.isError || courses.isError ? (
        <ErrorState
          title="We couldn’t load your courses."
          onRetry={() => {
            void semesters.refetch();
            void courses.refetch();
          }}
          requestId={(semesters.error ?? courses.error)?.problem.requestId}
        />
      ) : noCourses ? (
        <EmptyState
          title="Exams belong to a course."
          description="Add your current semester and its courses first."
          action={
            <ButtonLink to="/app/academics/courses" size="sm" variant="primary">
              Go to courses
            </ButtonLink>
          }
        />
      ) : (
        <>
          <SelectField
            label="Course"
            controlSize="sm"
            className="w-56"
            value={courseId ?? ''}
            onChange={(e) => setParams(e.target.value ? { course: e.target.value } : {}, { replace: true })}
          >
            <option value="">All courses</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} · ${c.name}` : c.name}
              </option>
            ))}
          </SelectField>

          <section aria-labelledby="upcoming-heading" className="grid gap-3">
            <h2 id="upcoming-heading" className="text-[15px] font-semibold">
              Upcoming
            </h2>
            {upcoming.isPending ? (
              <Loading />
            ) : upcoming.isError ? (
              <ErrorState
                title="We couldn’t load your exams."
                onRetry={() => void upcoming.refetch()}
                retrying={upcoming.isFetching}
                requestId={upcoming.error.problem.requestId}
              />
            ) : upcoming.data.length === 0 ? (
              <EmptyState
                title="No exams coming up."
                description="Add one when it’s announced, with the topics to prepare, and NOVA counts down for you."
                action={
                  <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                    Add exam
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {upcoming.data.map((e) => (
                  <ExamCard key={e.id} exam={e} timezone={timezone} />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="past-heading" className="grid gap-3">
            <div className="flex items-center gap-2">
              <h2 id="past-heading" className="text-[15px] font-semibold">
                Past
              </h2>
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={showPast}
                aria-controls="past-list"
                onClick={() => setShowPast((v) => !v)}
              >
                {showPast ? 'Hide' : 'Show past exams'}
              </Button>
            </div>
            {showPast && (
              <div id="past-list">
                {all.isPending ? (
                  <Skeleton className="h-24" />
                ) : all.isError ? (
                  <ErrorState
                    title="We couldn’t load past exams."
                    onRetry={() => void all.refetch()}
                    requestId={all.error.problem.requestId}
                  />
                ) : past.length === 0 ? (
                  <p className="text-[13px] text-ink-2">No past exams yet.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {past.map((e) => (
                      <ExamCard key={e.id} exam={e} timezone={timezone} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}

      <ExamDialog
        open={adding}
        onOpenChange={setAdding}
        courses={choices}
        timezone={timezone}
        defaultCourseId={courseId}
        onSaved={(exam) => navigate(`/app/academics/exams/${exam.id}`)}
      />
    </div>
  );
}

function Loading() {
  return (
    <div role="status" aria-busy="true" className="grid gap-3 md:grid-cols-2">
      <span className="sr-only">Loading your exams…</span>
      <Skeleton className="h-36" />
      <Skeleton className="h-36" />
    </div>
  );
}
