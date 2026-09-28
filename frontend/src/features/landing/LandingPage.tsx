import { ArrowRight, Code2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Wordmark } from '@/components/patterns/TriMark';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { DomainDot, type Domain } from '@/components/ui/DomainDot';
import { Progress } from '@/components/ui/Progress';
import { ThemeMenu } from '@/features/theme/ThemeMenu';
import { ProductPreview } from './ProductPreview';

/** Public repository link; set VITE_REPO_URL once the repo is on GitHub. Hidden when unset. */
const REPO_URL: string | undefined = import.meta.env.VITE_REPO_URL || undefined;

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-line bg-surface">
        <nav aria-label="Site" className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
          <Link to="/" className="rounded-sm" aria-label="NOVA home">
            <Wordmark />
          </Link>
          <div className="hidden gap-5 text-[14px] text-ink-2 md:flex">
            <a href="#features" className="hover:text-ink">
              Features
            </a>
            <a href="#open-source" className="hover:text-ink">
              Open source
            </a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeMenu />
            <ButtonLink to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
              Log in
            </ButtonLink>
            <ButtonLink to="/register" variant="primary" size="sm">
              Get started
            </ButtonLink>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
            <div className="animate-enter">
              <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 font-mono text-[12px] text-ink-2">
                <span className="size-1.5 rounded-full bg-developer" aria-hidden />
                Open source · built for engineering students
              </p>
              <h1 className="mt-6 font-display text-[clamp(38px,5.4vw,62px)] font-semibold leading-[1.04] tracking-[-0.025em]">
                Your student life, <span className="text-ink-3">organized in one place.</span>
              </h1>
              <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-ink-2">
                NOVA brings your classes, deadlines, grades and developer growth into one calm dashboard, so
                every morning starts with a clear answer to{' '}
                <strong className="font-semibold text-ink">what now?</strong>
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink to="/register" variant="primary" size="lg">
                  Get started, free
                </ButtonLink>
                <a
                  href="#features"
                  className="inline-flex h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-5 text-[15px] font-medium hover:bg-surface-2"
                >
                  See how it works
                </a>
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* Pillars */}
        <section
          id="features"
          aria-labelledby="features-title"
          className="mx-auto max-w-6xl px-4 py-16 md:px-6 lg:py-20"
        >
          <p className="label-caps">One system, three questions</p>
          <h2
            id="features-title"
            className="mt-3 max-w-[22ch] font-display text-[32px] font-semibold leading-tight tracking-[-0.015em] md:text-[36px]"
          >
            Most tools answer one of these. NOVA answers all three together.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Pillar
              domain="academics"
              eyebrow="Academics"
              title="Know where you stand."
              text="Grades, CGPA and attendance with configurable grading schemes and thresholds. Every number shows how it was calculated."
            >
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[28px] font-medium leading-none tabular">8.62</p>
                  <p className="mt-1.5 text-[12px] text-ink-3">CGPA</p>
                </div>
                <Badge tone="good">Can miss 3 classes</Badge>
              </div>
            </Pillar>
            <Pillar
              domain="planner"
              eyebrow="Planner"
              title="Know what to do next."
              text="Classes, tasks and deadlines on one timeline, with the week’s workload visible at a glance."
            >
              <WeekLoad />
            </Pillar>
            <Pillar
              domain="developer"
              eyebrow="Developer growth"
              title="Know what you’re building toward."
              text="Projects, learning goals, hackathons, internships and GitHub activity, next to your coursework."
            >
              <Progress value={64} label="Spring Boot · 7 of 11 topics" domain="developer" />
            </Pillar>
          </div>
          <p className="mt-6 text-[12.5px] text-ink-3">Figures on this page are example data.</p>
        </section>

        {/* Cross-domain example */}
        <section aria-labelledby="connect-title" className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="label-caps">Why one system</p>
              <h2 id="connect-title" className="mt-3 font-display text-[28px] font-semibold leading-tight">
                Your exam and your hackathon are on the same weekend. NOVA notices.
              </h2>
              <p className="mt-3 max-w-[56ch] text-ink-2">
                Because academics, planning and developer work share one data model, NOVA can point out
                conflicts and patterns no single-purpose app can see. Every insight links back to the records
                it came from.
              </p>
            </div>
            <ul className="grid gap-2.5">
              <InsightExample
                tone="warning"
                text="Your Database Systems exam is in 9 days, and Hack Week starts the same Saturday."
              />
              <InsightExample tone="neutral" text="3 of your 5 deadlines next week fall on Wednesday." />
              <InsightExample tone="good" text="You completed 18 of 22 planned tasks this week (82%)." />
            </ul>
          </div>
        </section>

        {/* Open source */}
        <section
          id="open-source"
          aria-labelledby="oss-title"
          className="mx-auto max-w-6xl px-4 py-16 md:px-6"
        >
          <div className="grid gap-6 rounded-lg border border-line bg-surface p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <h2 id="oss-title" className="font-display text-[24px] font-semibold">
                Built in the open.
              </h2>
              <p className="mt-2 max-w-[60ch] text-ink-2">
                Java and Spring Boot, React and TypeScript, PostgreSQL. MIT licensed, documented and tested.
                Run it yourself or help build it.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Spring Boot', 'React 19', 'TypeScript', 'PostgreSQL', 'MIT'].map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            </div>
            {REPO_URL && (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-sm border border-line-strong px-5 text-[15px] font-medium hover:bg-surface-2"
              >
                <Code2 size={17} aria-hidden />
                View on GitHub
                <ArrowRight size={15} aria-hidden />
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-8 text-[13px] text-ink-3 md:px-6">
          <Wordmark className="text-[15px]" />
          <span>Student Developer OS</span>
          <span className="ml-auto">MIT License</span>
        </div>
      </footer>
    </div>
  );
}

function Pillar({
  domain,
  eyebrow,
  title,
  text,
  children,
}: {
  domain: Domain;
  eyebrow: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <article className="grid content-start gap-4 rounded-lg border border-line bg-surface p-6">
      <p className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
        <DomainDot domain={domain} />
        {eyebrow}
      </p>
      <h3 className="font-display text-[21px] font-semibold leading-snug">{title}</h3>
      <p className="text-[14px] leading-relaxed text-ink-2">{text}</p>
      <div className="mt-2 rounded-md border border-line bg-bg p-4">{children}</div>
    </article>
  );
}

/** Mini 7-day load bars: deadlines per day on one scale (max 4). */
function WeekLoad() {
  const days: [string, number][] = [
    ['M', 1],
    ['T', 0],
    ['W', 3],
    ['T', 1],
    ['F', 2],
    ['S', 0],
    ['S', 0],
  ];
  const max = 4;
  return (
    <div>
      <div
        className="flex h-16 items-end gap-2"
        role="img"
        aria-label="Example week: Monday 1 deadline, Wednesday 3, Thursday 1, Friday 2, others none"
      >
        {days.map(([d, n], i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1.5 text-center">
            <div
              className="rounded-t-xs bg-planner"
              style={{ height: `${(n / max) * 100}%`, minHeight: n ? 6 : 0 }}
            />
            <span className="font-mono text-[10.5px] text-ink-3">{d}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-ink-2">Wednesday is your heaviest day.</p>
    </div>
  );
}

function InsightExample({ tone, text }: { tone: 'warning' | 'neutral' | 'good'; text: string }) {
  const stripe = tone === 'warning' ? 'bg-warning-fill' : tone === 'good' ? 'bg-good' : 'bg-line-strong';
  return (
    <li className="grid grid-cols-[3px_1fr] gap-3 rounded-md border border-line bg-bg p-4 text-[14px]">
      <span className={`rounded-full ${stripe}`} aria-hidden />
      <span>{text}</span>
    </li>
  );
}
