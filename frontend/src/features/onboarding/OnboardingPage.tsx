import { Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorState } from '@/components/patterns/ErrorState';
import { PageSkeleton } from '@/components/patterns/Skeleton';
import { TriMark } from '@/components/patterns/TriMark';
import { Button } from '@/components/ui/Button';
import { useCourses, useSemesters } from '@/features/academics/api';
import { useCurrentUser } from '@/features/auth/api';
import { useCompleteOnboarding, useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/services/http';
import { CoursesStep } from './CoursesStep';
import { GitHubStep } from './GitHubStep';
import { GoalsStep } from './GoalsStep';
import { SemesterStep } from './SemesterStep';
import { resumeStep, STEPS, type StepIndex } from './steps';
import { TimetableStep } from './TimetableStep';
import { YouStep } from './YouStep';

/**
 * First-run setup (architecture.md J1): You → Semester → Courses → Timetable → Goals → GitHub → Home. Every step
 * saves through the normal APIs as you continue, so leaving halfway loses nothing, and coming
 * back resumes from what's saved. "Skip setup" (or finishing) marks onboarding done.
 */
export function OnboardingPage() {
  const user = useCurrentUser();
  const settings = useSettings();
  const semesters = useSemesters();
  const current = semesters.data?.find((s) => s.current);
  const courses = useCourses(current?.id);
  const ready = settings.data && semesters.data && (!current || courses.data);

  if (settings.isError || semesters.isError || courses.isError) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorState
          title="We couldn’t load your setup."
          onRetry={() => {
            void settings.refetch();
            void semesters.refetch();
            void courses.refetch();
          }}
        />
      </div>
    );
  }
  if (!ready) return <PageSkeleton label="Loading your setup" />;

  return (
    <Flow
      firstName={user.data?.displayName.split(' ')[0] ?? ''}
      start={resumeStep(Boolean(current), courses.data?.length ?? 0)}
    />
  );
}

function Flow({ firstName, start }: { firstName: string; start: StepIndex }) {
  const navigate = useNavigate();
  const complete = useCompleteOnboarding();
  const [step, setStep] = useState<StepIndex>(start);
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1) as StepIndex);
  const back = () => setStep((s) => Math.max(0, s - 1) as StepIndex);
  const finish = () => complete.mutate(undefined, { onSuccess: () => navigate('/app', { replace: true }) });

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-6">
        <TriMark size={24} />
        <span className="font-display text-[16px] font-semibold">NOVA</span>
        <Button className="ml-auto" size="sm" variant="ghost" onClick={finish} disabled={complete.isPending}>
          Skip setup
        </Button>
      </header>

      <main className="mx-auto grid max-w-2xl gap-6 px-4 py-6">
        <nav aria-label="Setup steps">
          <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {STEPS.map((name, i) => (
              <li
                key={name}
                aria-current={i === step ? 'step' : undefined}
                className={cn(
                  'grid gap-1.5 text-[12.5px]',
                  i === step ? 'font-semibold text-ink' : i < step ? 'text-ink-2' : 'text-ink-3',
                )}
              >
                <span
                  aria-hidden
                  className={cn('h-1 rounded-full', i <= step ? 'bg-academics' : 'bg-surface-3')}
                />
                <span className="flex items-center gap-1">
                  {i < step && <Check size={12} aria-hidden />}
                  <span className="sr-only">
                    Step {i + 1} of {STEPS.length}:{' '}
                  </span>
                  {name}
                  {i < step && <span className="sr-only"> (done)</span>}
                </span>
              </li>
            ))}
          </ol>
        </nav>

        {complete.isError && <p className="text-[13px] text-critical">{errorMessage(complete.error)}</p>}

        <section className="grid gap-5 rounded-lg border border-line bg-surface p-5 md:p-7">
          {step === 0 && <YouStep firstName={firstName} onDone={next} />}
          {step === 1 && <SemesterStep onBack={back} onDone={next} />}
          {step === 2 && <CoursesStep onBack={back} onDone={next} />}
          {step === 3 && <TimetableStep onBack={back} onDone={next} />}
          {step === 4 && <GoalsStep onBack={back} onDone={next} />}
          {step === 5 && <GitHubStep onBack={back} onFinish={finish} finishing={complete.isPending} />}
        </section>
      </main>
    </div>
  );
}
