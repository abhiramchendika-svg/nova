import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/patterns/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { Progress } from '@/components/ui/Progress';
import { ExamStudyPlan } from '@/features/planner/ExamStudyPlan';
import { useSettings } from '@/features/settings/api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/dates';
import { errorMessage } from '@/services/http';
import {
  useAddTopic,
  useCourses,
  useDeleteExam,
  useDeleteTopic,
  useExam,
  usePatchTopic,
  useSemesters,
} from './api';
import { ExamDialog } from './ExamDialog';
import { daysUntilText, KIND_LABEL, prepText } from './examText';
import { topicSchema } from './schemas';
import { pickSemester } from './selection';
import type { ExamDetail, ExamTopic } from './types';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** One exam and its prep checklist: tick topics off, add, rename, reorder and remove them. */
export function ExamPage() {
  const { examId = '' } = useParams();
  const exam = useExam(examId);
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();

  if (exam.isPending) {
    return (
      <Shell>
        <div role="status" aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading the exam…</span>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-48" />
        </div>
      </Shell>
    );
  }
  if (exam.isError) {
    return (
      <Shell>
        {exam.error.status === 404 ? (
          <EmptyState
            title="We couldn’t find that exam."
            description="It may have been deleted, or the link is wrong."
            action={
              <ButtonLink to="/app/academics/exams" size="sm" variant="primary">
                Back to exams
              </ButtonLink>
            }
          />
        ) : (
          <ErrorState
            title="We couldn’t load this exam."
            onRetry={() => void exam.refetch()}
            retrying={exam.isFetching}
            requestId={exam.error.problem.requestId}
          />
        )}
      </Shell>
    );
  }
  return <ExamView exam={exam.data} timezone={timezone} />;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="animate-enter mx-auto grid max-w-3xl gap-5 px-4 py-6 lg:px-6">{children}</div>;
}

function ExamView({ exam, timezone }: { exam: ExamDetail; timezone: string }) {
  const navigate = useNavigate();
  const semesters = useSemesters();
  const current = pickSemester(semesters.data ?? [], null);
  const courses = useCourses(current?.id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useDeleteExam();

  return (
    <Shell>
      <div>
        <Link
          to="/app/academics/exams"
          className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={14} aria-hidden />
          Exams
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <Badge>{KIND_LABEL[exam.kind]}</Badge>
            <span className="text-[13px] font-semibold text-ink">{daysUntilText(exam.daysUntil)}</span>
          </p>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">{exam.title}</h1>
          <p className="text-[13px] text-ink-2">
            <Link to={`/app/academics/courses/${exam.courseId}`} className="hover:text-ink hover:underline">
              {exam.courseCode && <span className="font-mono text-ink-3">{exam.courseCode} </span>}
              {exam.courseName}
            </Link>{' '}
            · <span className="tabular">{formatDateTime(exam.startsAt, timezone)}</span>
            {exam.durationMinutes !== null && <> · {exam.durationMinutes} min</>}
            {exam.location && <> · {exam.location}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditing(true)}>
            <Pencil size={14} aria-hidden />
            Edit exam
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(true)}>
            <Trash2 size={14} aria-hidden />
            Delete
          </Button>
        </div>
      </header>

      <Checklist exam={exam} />
      <ExamStudyPlan exam={exam} timezone={timezone} />

      <ExamDialog
        open={editing}
        onOpenChange={setEditing}
        courses={courses.data ?? []}
        timezone={timezone}
        exam={exam}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) remove.reset();
        }}
        title="Delete this exam?"
        description={
          <>
            <strong className="text-ink">{exam.title}</strong> and its checklist will be removed. This can’t
            be undone.
          </>
        }
        confirmLabel="Delete exam"
        pending={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onConfirm={() =>
          remove.mutate(exam.id, { onSuccess: () => navigate('/app/academics/exams', { replace: true }) })
        }
      />
    </Shell>
  );
}

function Checklist({ exam }: { exam: ExamDetail }) {
  const patch = usePatchTopic();
  const removeTopic = useDeleteTopic();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const busy = patch.isPending || removeTopic.isPending;
  const total = exam.topics.length;
  const error = patch.error ?? removeTopic.error;

  const move = (topic: ExamTopic, to: number) =>
    patch.mutate(
      { examId: exam.id, topicId: topic.id, position: to },
      { onSuccess: () => setAnnouncement(`Moved “${topic.title}” to position ${to + 1} of ${total}.`) },
    );

  return (
    <Panel title="Prep checklist" domain="academics">
      <div className="grid gap-4">
        {exam.prep.percentage !== null && (
          <Progress value={exam.prep.percentage} label={prepText(exam.prep)} domain="academics" />
        )}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {error && <p className="text-[13px] text-critical">{errorMessage(error)}</p>}
        {total === 0 ? (
          <p className="text-[13px] leading-relaxed text-ink-2">
            List what the exam covers, then tick each topic off as you revise it.
          </p>
        ) : (
          <ol aria-label="Topics" className="-mx-5 divide-y divide-line border-y border-line">
            {exam.topics.map((topic, i) => (
              <li key={topic.id} className="flex flex-wrap items-center gap-2 px-5 py-2">
                {renamingId === topic.id ? (
                  <RenameForm
                    topic={topic}
                    pending={patch.isPending}
                    onCancel={() => setRenamingId(null)}
                    onSave={(title) =>
                      patch.mutate(
                        { examId: exam.id, topicId: topic.id, title },
                        { onSuccess: () => setRenamingId(null) },
                      )
                    }
                  />
                ) : (
                  <>
                    <Checkbox
                      className="min-w-0 flex-1"
                      label={
                        <span className={cn(topic.done && 'text-ink-2 line-through decoration-ink-3')}>
                          {topic.title}
                        </span>
                      }
                      checked={topic.done}
                      disabled={busy}
                      onChange={(e) =>
                        patch.mutate({ examId: exam.id, topicId: topic.id, done: e.target.checked })
                      }
                    />
                    <div className="flex items-center">
                      <IconButton label={`Rename ${topic.title}`} onClick={() => setRenamingId(topic.id)}>
                        <Pencil size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Move ${topic.title} up`}
                        disabled={busy || i === 0}
                        className="disabled:opacity-40"
                        onClick={() => move(topic, i - 1)}
                      >
                        <ArrowUp size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Move ${topic.title} down`}
                        disabled={busy || i === total - 1}
                        className="disabled:opacity-40"
                        onClick={() => move(topic, i + 1)}
                      >
                        <ArrowDown size={15} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Delete ${topic.title}`}
                        disabled={busy}
                        onClick={() =>
                          removeTopic.mutate(
                            { examId: exam.id, topicId: topic.id },
                            { onSuccess: () => setAnnouncement(`Removed “${topic.title}”.`) },
                          )
                        }
                      >
                        <Trash2 size={15} aria-hidden />
                      </IconButton>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        <AddTopic examId={exam.id} />
      </div>
    </Panel>
  );
}

function RenameForm({
  topic,
  pending,
  onSave,
  onCancel,
}: {
  topic: ExamTopic;
  pending: boolean;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(topic.title);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = topicSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Name the topic.');
      return;
    }
    if (parsed.data === topic.title) onCancel();
    else onSave(parsed.data);
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-wrap items-start gap-2" noValidate>
      <Field
        ref={inputRef}
        label={`New name for ${topic.title}`}
        className="min-w-48 flex-1"
        value={value}
        error={error ?? undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          // Esc cancels the rename without closing anything around it
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      <div className="flex gap-2 pt-[26px]">
        <Button type="submit" size="sm" variant="primary" loading={pending}>
          Save
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AddTopic({ examId }: { examId: string }) {
  const add = useAddTopic();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = topicSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Name the topic.');
      return;
    }
    add.mutate({ examId, title: parsed.data }, { onSuccess: () => setValue('') });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-2">
      <Field
        label="Add a topic"
        placeholder="e.g. Indexing"
        className="min-w-48 flex-1"
        value={value}
        error={error ?? (add.isError ? errorMessage(add.error) : undefined)}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
          add.reset();
        }}
      />
      <Button type="submit" className="mt-[26px]" loading={add.isPending}>
        Add topic
      </Button>
    </form>
  );
}
