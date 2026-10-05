import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Button } from '@/components/ui/Button';
import { useProjects } from './api';
import { ProjectCard } from './ProjectCard';
import { ProjectDialog } from './ProjectDialog';
import { GROUP_ORDER, STATUS_LABEL } from './projectText';
import type { Project, ProjectStatus } from './types';

const GROUP_HEADING: Partial<Record<ProjectStatus, string>> = { IDEA: 'Ideas' };

/** Projects by where they are: being built first, then planned, ideas and finished work. */
export function ProjectsPage() {
  const projects = useProjects();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const byStatus = new Map<ProjectStatus, Project[]>();
  for (const p of projects.data ?? []) byStatus.set(p.status, [...(byStatus.get(p.status) ?? []), p]);
  const archived = byStatus.get('ARCHIVED') ?? [];

  return (
    <div className="animate-enter mx-auto grid grid-cols-1 max-w-6xl gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Projects</h1>
          <p className="mt-1 text-ink-2">What you’re building, from idea to shipped.</p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden />
          New project
        </Button>
      </header>

      {projects.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-3 md:grid-cols-2">
          <span className="sr-only">Loading your projects…</span>
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : projects.isError ? (
        <ErrorState
          title="We couldn’t load your projects."
          onRetry={() => void projects.refetch()}
          retrying={projects.isFetching}
          requestId={projects.error.problem.requestId}
        />
      ) : projects.data.length === 0 ? (
        <EmptyState
          title="Your first project starts here."
          description="Track what you’re building, from idea to shipped: milestones, tasks and links in one place."
          action={
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              Add project
            </Button>
          }
        />
      ) : (
        <>
          {GROUP_ORDER.filter((s) => byStatus.has(s)).map((status) => (
            <Group
              key={status}
              title={GROUP_HEADING[status] ?? STATUS_LABEL[status]}
              projects={byStatus.get(status)!}
            />
          ))}
          {archived.length > 0 && (
            <div className="grid gap-4">
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-expanded={showArchived}
                  onClick={() => setShowArchived((v) => !v)}
                >
                  {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
                </Button>
              </div>
              {showArchived && <Group title="Archived" projects={archived} />}
            </div>
          )}
          {GROUP_ORDER.every((s) => !byStatus.has(s)) && !showArchived && (
            <p className="text-[13px] text-ink-2">All your projects are archived.</p>
          )}
        </>
      )}

      <ProjectDialog
        open={adding}
        onOpenChange={setAdding}
        onSaved={(p) => void navigate(`/app/developer/projects/${p.id}`)}
      />
    </div>
  );
}

function Group({ title, projects }: { title: string; projects: Project[] }) {
  const id = `group-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="grid grid-cols-1 gap-3">
      <h2 id={id} className="flex items-baseline gap-2 text-[15px] font-semibold">
        {title}{' '}
        <span className="font-mono text-[12px] font-normal tabular text-ink-3">{projects.length}</span>
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </section>
  );
}
