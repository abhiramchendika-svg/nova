import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { DomainDot, type Domain } from '@/components/ui/DomainDot';
import { Panel } from '@/components/ui/Panel';
import { useCurrentUser } from '@/features/auth/api';
import { formatBriefDate, greetingFor } from './format';

/**
 * Home — the Today view. Phase 1 ships the final layout with deliberate empty states;
 * each panel fills in as its feature lands (Academics in Phase 2, Planner in Phase 3,
 * Developer in Phase 4). Layout follows docs/ui-design.md §5.
 */
export function HomePage() {
  const { data: user } = useCurrentUser();
  const now = new Date();
  const firstName = user?.displayName.split(' ')[0] ?? '';

  return (
    <div className="animate-enter mx-auto grid max-w-[1360px] gap-5 px-4 py-6 lg:grid-cols-12 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 lg:col-span-12">
        <div>
          <p className="font-mono text-[12.5px] uppercase text-ink-3">{formatBriefDate(now)}</p>
          <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-[-0.015em] md:text-[30px]">
            {greetingFor(now)}, {firstName}.
          </h1>
          <p className="mt-1.5 text-ink-2">
            Add your semester and courses, and this page will tell you what needs you each day.
          </p>
        </div>
      </header>

      <Panel title="Today" className="lg:col-span-8">
        <EmptyState
          title="Your day is clear."
          description="Once your timetable and tasks are in, today’s classes, planned work and due times line up here on one timeline."
          action={
            <ButtonLink to="/app/academics/timetable" size="sm">
              Add your timetable
            </ButtonLink>
          }
        />
      </Panel>

      <Panel title="Needs attention" className="lg:col-span-4">
        <EmptyState
          compact
          title="Nothing needs you right now."
          description="Overdue work, close deadlines and attendance risks will be ranked here."
        />
      </Panel>

      <section
        aria-label="Summaries"
        className="grid rounded-md border border-line bg-surface md:grid-cols-3 lg:col-span-12"
      >
        <DomainSummary
          domain="academics"
          title="Academics"
          text="Add your courses to track GPA, CGPA and attendance."
          to="/app/academics/courses"
          cta="Add courses"
        />
        <DomainSummary
          domain="planner"
          title="Planner"
          text="Plan tasks for today and see your weekly completion."
          to="/app/planner/tasks"
          cta="Open tasks"
        />
        <DomainSummary
          domain="developer"
          title="Developer"
          text="Track projects, learning goals and your GitHub activity."
          to="/app/developer/projects"
          cta="Add a project"
        />
      </section>

      <Panel title="Next 7 days" className="lg:col-span-8">
        <EmptyState
          compact
          title="Nothing due yet. Enjoy the breathing room."
          description="Assignments, exams and deadlines for the coming week will show here, with your busiest day highlighted."
        />
      </Panel>

      <Panel title="Exams" className="lg:col-span-4">
        <EmptyState
          compact
          title="No exams scheduled."
          description="Add an exam to see a countdown and track your preparation topic by topic."
        />
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
  text: string;
  to: string;
  cta: string;
}) {
  return (
    <div className="grid content-start gap-3 border-line p-5 [&+&]:border-t md:[&+&]:border-l md:[&+&]:border-t-0">
      <div className="flex items-center gap-2">
        <DomainDot domain={domain} />
        <h2 className="text-[14px] font-semibold">{title}</h2>
      </div>
      <p className="text-[13px] text-ink-2">{text}</p>
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
