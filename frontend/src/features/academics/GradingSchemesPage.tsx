import { ArrowLeft, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { errorMessage } from '@/services/http';
import { useCloneScheme, useDeleteScheme, useGradingSchemes } from './api';
import { formatNumber } from './format';
import { SchemeEditorDialog } from './SchemeEditorDialog';
import type { GradingScheme } from './types';

export function GradingSchemesPage() {
  const schemes = useGradingSchemes();
  const clone = useCloneScheme();
  const [editor, setEditor] = useState<{ open: boolean; scheme?: GradingScheme }>({ open: false });
  const [deleting, setDeleting] = useState<GradingScheme | null>(null);
  const deleteScheme = useDeleteScheme();

  return (
    <div className="animate-enter mx-auto grid max-w-4xl gap-5 px-4 py-6 lg:px-6">
      <div>
        <ButtonLink to="/app/academics/grades" size="sm" variant="ghost" className="-ml-2">
          <ArrowLeft size={14} aria-hidden />
          Grades
        </ButtonLink>
      </div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">Grading schemes</h1>
          <p className="mt-1 max-w-[62ch] text-ink-2">
            Presets are examples, not your university’s official policy. Copy one and adjust it to match your
            grade table exactly.
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditor({ open: true })}>
          <Plus size={15} aria-hidden />
          New scheme
        </Button>
      </header>

      {clone.isError && (
        <p role="alert" className="text-[13px] text-critical">
          {errorMessage(clone.error)}
        </p>
      )}

      {schemes.isPending ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading grading schemes…</span>
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : schemes.isError ? (
        <ErrorState
          title="We couldn’t load your grading schemes."
          onRetry={() => void schemes.refetch()}
          retrying={schemes.isFetching}
          requestId={schemes.error.problem.requestId}
        />
      ) : (
        <ul className="grid gap-3">
          {schemes.data.map((scheme) => (
            <li key={scheme.id}>
              <article
                aria-labelledby={`scheme-${scheme.id}`}
                className="grid gap-3 rounded-md border border-line bg-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`scheme-${scheme.id}`} className="text-[15px] font-semibold">
                    {scheme.name}
                  </h2>
                  {scheme.builtIn && <Badge>Preset</Badge>}
                  <span className="text-[12.5px] text-ink-3">
                    {scheme.grades.some((g) => g.countsInGpa) ? (
                      <>
                        out of <span className="font-mono tabular">{formatNumber(scheme.maxPoints)}</span>
                      </>
                    ) : (
                      'no GPA grades'
                    )}
                  </span>
                  <div className="ml-auto flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={clone.isPending && clone.variables === scheme.id}
                      onClick={() => clone.mutate(scheme.id)}
                      aria-label={`Copy ${scheme.name}`}
                    >
                      <Copy size={14} aria-hidden />
                      Copy
                    </Button>
                    {!scheme.builtIn && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditor({ open: true, scheme })}
                          aria-label={`Edit ${scheme.name}`}
                        >
                          <Pencil size={14} aria-hidden />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleting(scheme)}
                          aria-label={`Delete ${scheme.name}`}
                        >
                          <Trash2 size={14} aria-hidden />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <ul aria-label={`Grades in ${scheme.name}`} className="flex flex-wrap gap-1.5">
                  {scheme.grades.map((g) => (
                    <li
                      key={g.id}
                      className="inline-flex items-center gap-1.5 rounded-xs border border-line px-2 py-0.5 text-[12.5px]"
                    >
                      <span className="font-semibold text-ink">{g.label}</span>
                      <span className="font-mono tabular text-ink-2">{formatNumber(g.points)}</span>
                      {!g.passing && <span className="text-ink-3">fail</span>}
                      {!g.countsInGpa && <span className="text-ink-3">not in GPA</span>}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ul>
      )}

      <SchemeEditorDialog
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        scheme={editor.scheme}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            deleteScheme.reset();
          }
        }}
        title="Delete this grading scheme?"
        description={
          <>
            <strong className="text-ink">{deleting?.name}</strong> will be removed. A scheme that a semester
            still uses can’t be deleted.
          </>
        }
        confirmLabel="Delete scheme"
        pending={deleteScheme.isPending}
        error={deleteScheme.isError ? errorMessage(deleteScheme.error) : null}
        onConfirm={() => deleting && deleteScheme.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
