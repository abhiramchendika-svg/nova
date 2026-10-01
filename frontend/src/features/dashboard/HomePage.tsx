import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import { DomainDot, type Domain } from '@/components/ui/DomainDot';
import { Panel } from '@/components/ui/Panel';
import { Progress } from '@/components/ui/Progress';
import { useTimetableDay } from '@/features/academics/api';
import { useCurrentUser } from '@/features/auth/api';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { localParts, todayIn } from '@/lib/dates';
import { useDashboard } from './api';
import { formatBriefDate, greetingFor } from './format';
import { NeedsAttention } from './NeedsAttention';
import { NextSevenDays } from './NextSevenDays';
import { TodayClasses } from './TodayClasses';
import { TodayTasks } from './TodayTasks';
import type { AcademicsSummary, PlannerSummary } from './types';
import { UpcomingExams } from './UpcomingExams';

/**
 * Home — the Today view (docs/ui-design.md §5): today's classes and tasks, what needs the user
 * (ranked on the server), the academics and planner at a glance, the coming week and exams.
 * Developer activity fills in with Phase 4.
 */
export function HomePage() {
  const { data: user } = useCurrentUser();
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  const nowTime = localParts(now.toISOString(), timezone).time;
  const firstName = user?.displayName.split(' ')[0] ?? '';
  const today = todayIn(timezone);
  const day = useTimetableDay(); // shared with TodayClasses through the query cache
  const dashboard = useDashboard(); // shared with NeedsAttention through the query cache

  // A new account goes through setup first (skipping it counts as done)
  if (user && !user.onboardingCompleted) return <Navigate to="/app/welcome" replace />;

  return (
    <div className="animate-enter mx-auto grid max-w-[1360px] gap-5 px-4 py-6 lg:grid-cols-12 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 lg:col-span-12">
        <div>
          <p className="font-mono text-[12.5px] uppercase text-ink-3">
            {formatBriefDate(now, 'en-US', timezone)}
          </p>
          <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-[-0.015em] md:text-[30px]">
            {greetingFor(now, timezone)}, {firstName}.
          </h1>
          {day.data && !day.data.semesterId && (
            <p className="mt-1.5 text-ink-2">
              Add your semester and courses, and this page will tell you what needs you each day.
            </p>
          )}
        </div>
      </header>

      <Panel title="Today" className="lg:col-span-8">
        <div className="grid gap-6">
          <TodayClasses now={nowTime} />
          <TodayTasks today={today} timezone={timezone} />
        </div>
      </Panel>

      <Panel title="Needs attention" className="lg:col-span-4">
        <NeedsAttention />
      </Panel>

      <section
        aria-label="Summaries"
        className="grid rounded-md border border-line bg-surface md:grid-cols-3 lg:col-span-12"
      >
        <AcademicsCard summary={dashboard.data?.academics ?? null} />
        <PlannerCard summary={dashboard.data?.planner ?? null} />
        <DomainSummary
          domain="developer"
          title="Developer"
          text="Track projects, learning goals and your GitHub activity."
          to="/app/developer/projects"
          cta="Add a project"
        />
      </section>

      <Panel title="Next 7 days" className="lg:col-span-8">
        <NextSevenDays today={today} />
      </Panel>

      <Panel
        title="Exams"
        className="lg:col-span-4"
        action={
          <Link to="/app/academics/exams" className="text-[12.5px] font-medium text-ink-2 hover:text-ink">
            All exams
          </Link>
        }
      >
        <UpcomingExams />
      </Panel>
    </div>
  );
}

function DomainSummary({
  domain,
  title,
  text,
  to,
  cta,
}: {
  domain: Domain;
  title: string;
  text: ReactNode;
  to: string;
  cta: string;
}) {
  return (
    <div className="grid content-start gap-3 border-line p-5 [&+&]:border-t md:[&+&]:border-l md:[&+&]:border-t-0">
      <div className="flex items-center gap-2">
        <DomainDot domain={domain} />
        <h2 className="text-[14px] font-semibold">{title}</h2>
      </div>
      <div className="grid gap-2 text-[13px] text-ink-2">{text}</div>
      <Link
        to={to}
        className="inline-flex w-fit items-center gap-1 rounded-sm text-[13px] font-medium text-ink underline-offset-4 hover:underline"
      >
        {cta}
        <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}

const gpa = (n: number | null) => (n === null ? '—' : n.toFixed(2));

function AcademicsCard({ summary }: { summary: AcademicsSummary | null }) {
  if (!summary) {
    return (
      <DomainSummary
        domain="academics"
        title="Academics"
        text="Add your courses to track GPA, CGPA and attendance."
        to="/app/academics/courses"
        cta="Add courses"
      />
    );
  }
  const low = summary.lowestAttendance;
  return (
    <DomainSummary
      domain="academics"
      title="Academics"
      text={
        <>
          <p>
            <span className="font-medium text-ink">{summary.semesterName}</span> · {summary.credits} credits
          </p>
          <dl className="flex gap-6">
            <div>
              <dt className="text-[12px] text-ink-3">GPA</dt>
              <dd className="font-mono text-[18px] tabular text-ink">{gpa(summary.gpa)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-3">CGPA</dt>
              <dd className="font-mono text-[18px] tabular text-ink">{gpa(summary.cgpa)}</dd>
            </div>
          </dl>
          {low && (
            <p>
              Lowest attendance: {low.courseName} at{' '}
              <span
                className={cn(
                  'font-mono tabular',
                  low.target !== null && low.percentage < low.target ? 'text-critical' : 'text-ink',
                )}
              >
                {Number(low.percentage.toFixed(1))}%
              </span>
            </p>
          )}
        </>
      }
      to="/app/academics/grades"
      cta="Open grades"
    />
  );
}

function PlannerCard({ summary }: { summary: PlannerSummary | null }) {
  if (!summary || (summary.weekPlanned === 0 && summary.openToday === 0 && summary.doneToday === 0)) {
    return (
      <DomainSummary
        domain="planner"
        title="Planner"
        text="Plan tasks for today and see your weekly completion."
        to="/app/planner/tasks"
        cta="Open tasks"
      />
    );
  }
  const pct = summary.weekPlanned === 0 ? 0 : (summary.weekDone / summary.weekPlanned) * 100;
  return (
    <DomainSummary
      domain="planner"
      title="Planner"
      text={
        <>
          <p>
            Today: {summary.openToday} open · {summary.doneToday} done
          </p>
          {summary.weekPlanned > 0 && (
            <Progress
              value={pct}
              domain="planner"
              label={`This week: ${summary.weekDone} of ${summary.weekPlanned} planned tasks done`}
            />
          )}
          {summary.streakDays !== null && (
            <p>
              <span className="font-medium text-ink">{summary.streakDays}-day streak</span> of finishing
              something
            </p>
          )}
        </>
      }
      to="/app/planner/tasks"
      cta="Open tasks"
    />
  );
}
