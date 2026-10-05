import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/dates';
import { shortUrl } from './projectText';
import type { Project } from './types';

const STACK_SHOWN = 5;

/** One project at a glance: what, with what, how far along, what's next. */
export function ProjectCard({ project: p }: { project: Project }) {
  const headingId = `project-${p.id}`;
  const extra = p.techStack.length - STACK_SHOWN;
  const next = p.nextMilestone;
  return (
    <article
      aria-labelledby={headingId}
      className="grid min-w-0 grid-cols-1 content-start gap-3 rounded-md border border-line bg-surface p-4"
    >
      <h3 id={headingId} className="text-[15px] font-semibold leading-snug">
        <Link to={`/app/developer/projects/${p.id}`} className="hover:underline">
          {p.name}
        </Link>
      </h3>
      {p.description && <p className="line-clamp-2 text-[13px] text-ink-2">{p.description}</p>}
      {p.techStack.length > 0 && (
        <ul aria-label="Tech stack" className="flex flex-wrap gap-1.5">
          {p.techStack.slice(0, STACK_SHOWN).map((t) => (
            <li key={t} className="tint-developer rounded-xs px-1.5 py-0.5 text-[12px] text-developer-text">
              {t}
            </li>
          ))}
          {extra > 0 && <li className="px-1 py-0.5 text-[12px] text-ink-3">+{extra} more</li>}
        </ul>
      )}
      {p.progress.total > 0 ? (
        <Progress
          value={p.progress.percentage ?? 0}
          domain="developer"
          label={`${p.progress.done} of ${p.progress.total} milestones`}
        />
      ) : (
        <p className="text-[12.5px] text-ink-3">No milestones yet</p>
      )}
      {(next || p.openTasks > 0) && (
        <p className="text-[12.5px] text-ink-2">
          {next && (
            <>
              Next: <span className="text-ink">{next.title}</span>
              {next.dueOn && (
                <span className={cn(next.overdue && 'text-critical')}>
                  {' '}
                  · {next.overdue ? 'was due' : 'due'} {formatDay(next.dueOn)}
                </span>
              )}
            </>
          )}
          {next && p.openTasks > 0 && ' · '}
          {p.openTasks > 0 && `${p.openTasks} open ${p.openTasks === 1 ? 'task' : 'tasks'}`}
        </p>
      )}
      {(p.repoUrl || p.demoUrl) && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
          {p.repoUrl && <ExternalLinkText href={p.repoUrl} label="Code" />}
          {p.demoUrl && <ExternalLinkText href={p.demoUrl} label="Demo" />}
        </p>
      )}
    </article>
  );
}

/** A link that leaves NOVA: new tab, no referrer or opener, and says where it goes. */
export function ExternalLinkText({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 items-center gap-1 font-medium text-ink-2 hover:text-ink hover:underline"
    >
      <span className="text-ink-3">{label}:</span>
      <span className="truncate">{shortUrl(href)}</span>
      <ExternalLink size={12} aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
