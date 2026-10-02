import { ArrowRight, Clock, FileText, Plus, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Dialog } from '@/components/ui/Dialog';
import { useCourses, useSemesters } from '@/features/academics/api';
import { AssignmentDialog } from '@/features/academics/AssignmentDialog';
import { ExamDialog } from '@/features/academics/ExamDialog';
import { pickSemester } from '@/features/academics/selection';
import { GoalDialog } from '@/features/developer/GoalDialog';
import { HackathonDialog } from '@/features/developer/HackathonDialog';
import { InternshipDialog } from '@/features/developer/InternshipDialog';
import { ProjectDialog } from '@/features/developer/ProjectDialog';
import { useTask } from '@/features/planner/api';
import { TaskDialog } from '@/features/planner/TaskDialog';
import { useSettings } from '@/features/settings/api';
import { NAV_SECTIONS } from '@/layouts/navigation';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/services/http';
import { MIN_QUERY, useSearch } from './api';
import { readRecent, remember, type RecentItem } from './recent';
import { KIND_LABEL, KINDS } from './types';

type Action = 'task' | 'assignment' | 'exam' | 'project' | 'goal' | 'hackathon' | 'internship';

interface Option {
  key: string;
  group: string;
  label: string;
  detail: string | null;
  icon: 'page' | 'action' | 'record' | 'recent';
  run: () => void;
}

const ACTIONS: { action: Action; label: string; keywords: string }[] = [
  { action: 'task', label: 'New task', keywords: 'add todo planner' },
  { action: 'assignment', label: 'New assignment', keywords: 'add homework coursework' },
  { action: 'exam', label: 'New exam', keywords: 'add test midsem' },
  { action: 'project', label: 'New project', keywords: 'add build' },
  { action: 'goal', label: 'New learning goal', keywords: 'add learn study' },
  { action: 'hackathon', label: 'New hackathon', keywords: 'add event' },
  { action: 'internship', label: 'New internship application', keywords: 'add job apply' },
];

/** Every page in the navigation, plus "Mark today's attendance" (Home has today's classes). */
const PAGES = [
  ...NAV_SECTIONS.flatMap((s) =>
    s.items.map((i) => ({ label: i.label, to: i.to, section: s.label ?? 'NOVA' })),
  ),
];

const matches = (text: string, q: string) => text.toLowerCase().includes(q.toLowerCase());

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The ⌘K palette (docs/architecture.md §8): search everything you own, jump to any page, start a
 * new item, or reopen something recent. A combobox over a grouped listbox: arrows move, Enter opens.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [action, setAction] = useState<Action | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Fresh each time it opens
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery('');
      setDebounced('');
      setActive(0);
      setRecent(readRecent());
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 200);
    return () => window.clearTimeout(id);
  }, [query]);

  const search = useSearch(open ? debounced : '');
  const q = query.trim();

  const close = () => onOpenChange(false);
  const goTo = (to: string, item: RecentItem) => {
    remember(item);
    close();
    void navigate(to);
  };
  const openTask = (id: string, title: string, subtitle: string | null) => {
    remember({ kind: 'task', target: id, title, subtitle });
    close();
    setTaskId(id);
  };

  const options: Option[] = [];
  if (!q) {
    for (const r of recent) {
      options.push({
        key: `recent:${r.kind}:${r.target}`,
        group: 'Recent',
        label: r.title,
        detail: r.subtitle,
        icon: 'recent',
        run: () => (r.kind === 'task' ? openTask(r.target, r.title, r.subtitle) : goTo(r.target, r)),
      });
    }
  }
  for (const a of ACTIONS.filter((a) => !q || matches(`${a.label} ${a.keywords}`, q))) {
    options.push({
      key: `action:${a.action}`,
      group: 'Quick actions',
      label: a.label,
      detail: null,
      icon: 'action',
      run: () => {
        close();
        setAction(a.action);
      },
    });
  }
  if (!q || matches("mark today's attendance classes", q)) {
    options.push({
      key: 'action:attendance',
      group: 'Quick actions',
      label: 'Mark today’s attendance',
      detail: 'On Home',
      icon: 'action',
      run: () => goTo('/app', { kind: 'page', target: '/app', title: 'Home', subtitle: null }),
    });
  }
  for (const p of PAGES.filter((p) => !q || matches(`${p.label} ${p.section}`, q))) {
    options.push({
      key: `page:${p.to}`,
      group: 'Go to',
      label: p.label,
      detail: p.section === 'NOVA' ? null : p.section,
      icon: 'page',
      run: () => goTo(p.to, { kind: 'page', target: p.to, title: p.label, subtitle: p.section }),
    });
  }
  if (q.length >= MIN_QUERY && search.data) {
    for (const kind of KINDS) {
      for (const hit of search.data[kind]) {
        options.push({
          key: `${kind}:${hit.id}`,
          group: KIND_LABEL[kind],
          label: hit.title,
          detail: hit.subtitle,
          icon: 'record',
          run: () =>
            kind === 'tasks'
              ? openTask(hit.id, hit.title, hit.subtitle)
              : goTo(hit.link, {
                  kind: 'record',
                  target: hit.link,
                  title: hit.title,
                  subtitle: hit.subtitle,
                }),
        });
      }
    }
  }

  const current = Math.min(active, Math.max(0, options.length - 1));
  const optionId = (i: number) => `${listId}-option-${i}`;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (options.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((current + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((current - 1 + options.length) % options.length);
    } else if (e.key === 'Home' && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && e.ctrlKey) {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      options[current]?.run();
    }
  };

  // Keep the active option in view
  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionId is stable for a listId
  }, [current]);

  const groups: { name: string; items: { option: Option; index: number }[] }[] = [];
  options.forEach((option, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === option.group) last.items.push({ option, index });
    else groups.push({ name: option.group, items: [{ option, index }] });
  });

  const searching = q.length >= MIN_QUERY && (search.isFetching || debounced.trim() !== q);
  const status =
    q.length > 0 && q.length < MIN_QUERY
      ? 'Type one more character to search your records.'
      : search.isError && q.length >= MIN_QUERY
        ? errorMessage(search.error)
        : searching
          ? 'Searching…'
          : `${options.length} ${options.length === 1 ? 'result' : 'results'}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} title="Search NOVA" initialFocus={inputRef}>
        <div className="grid gap-3">
          <div className="relative">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={options.length ? optionId(current) : undefined}
              aria-autocomplete="list"
              aria-label="Search courses, tasks, projects and pages, or type an action"
              placeholder="Search or type a command…"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-11 w-full rounded-sm border border-line bg-surface pl-9 pr-3 text-[14.5px] text-ink outline-none focus-visible:border-focus"
            />
          </div>
          <p role="status" className="text-[12px] text-ink-3">
            {status}
          </p>
          <div
            id={listId}
            role="listbox"
            aria-label="Results"
            className="-mx-2 max-h-[min(60dvh,420px)] overflow-y-auto"
          >
            {groups.map((g) => (
              <div key={g.name} role="group" aria-label={g.name} className="mb-2">
                <div
                  aria-hidden
                  className="px-2 pb-1 pt-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3"
                >
                  {g.name}
                </div>
                {g.items.map(({ option, index }) => (
                  <div
                    key={option.key}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === current}
                    onMouseMove={() => index !== current && setActive(index)}
                    tabIndex={-1}
                    onClick={() => option.run()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') option.run();
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13.5px]',
                      index === current ? 'bg-surface-2 text-ink' : 'text-ink-2',
                    )}
                  >
                    <OptionIcon kind={option.icon} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-ink">{option.label}</span>
                      {option.detail && <span className="ml-2 text-[12px] text-ink-3">{option.detail}</span>}
                    </span>
                    {index === current && <ArrowRight size={13} aria-hidden className="text-ink-3" />}
                  </div>
                ))}
              </div>
            ))}
            {options.length === 0 && !searching && (
              <p className="px-2 py-6 text-center text-[13px] text-ink-2">Nothing matches “{q}”.</p>
            )}
          </div>
        </div>
      </Dialog>
      <PaletteDialogs
        action={action}
        onClose={() => setAction(null)}
        taskId={taskId}
        onTaskClose={() => setTaskId(null)}
      />
    </>
  );
}

function OptionIcon({ kind }: { kind: Option['icon'] }): ReactNode {
  const props = { size: 14, 'aria-hidden': true, className: 'shrink-0 text-ink-3' } as const;
  if (kind === 'action') return <Plus {...props} />;
  if (kind === 'recent') return <Clock {...props} />;
  if (kind === 'page') return <ArrowRight {...props} />;
  return <FileText {...props} />;
}

/** The dialogs the palette's actions open, and a task opened from a result. */
function PaletteDialogs({
  action,
  onClose,
  taskId,
  onTaskClose,
}: {
  action: Action | null;
  onClose: () => void;
  taskId: string | null;
  onTaskClose: () => void;
}) {
  const navigate = useNavigate();
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? browserZone();
  const needsCourses = action === 'assignment' || action === 'exam';
  const semesters = useSemesters();
  const term = pickSemester(semesters.data ?? [], null);
  const courses = useCourses(needsCourses ? term?.id : undefined);
  const choices = (courses.data ?? []).map((c) => ({ id: c.id, code: c.code, name: c.name }));
  const task = useTask(taskId);
  const openChange = (open: boolean) => !open && onClose();

  return (
    <>
      <TaskDialog open={action === 'task'} onOpenChange={openChange} timezone={timezone} />
      <AssignmentDialog
        open={action === 'assignment'}
        onOpenChange={openChange}
        courses={choices}
        timezone={timezone}
      />
      <ExamDialog
        open={action === 'exam'}
        onOpenChange={openChange}
        courses={choices}
        timezone={timezone}
        onSaved={(exam) => void navigate(`/app/academics/exams/${exam.id}`)}
      />
      <ProjectDialog
        open={action === 'project'}
        onOpenChange={openChange}
        onSaved={(p) => void navigate(`/app/developer/projects/${p.id}`)}
      />
      <GoalDialog
        open={action === 'goal'}
        onOpenChange={openChange}
        onSaved={(g) => void navigate(`/app/developer/learning/${g.id}`)}
      />
      <HackathonDialog
        open={action === 'hackathon'}
        onOpenChange={openChange}
        timezone={timezone}
        onSaved={(h) => void navigate(`/app/developer/hackathons/${h.id}`)}
      />
      <InternshipDialog
        open={action === 'internship'}
        onOpenChange={openChange}
        timezone={timezone}
        onSaved={(i) => void navigate(`/app/developer/internships/${i.id}`)}
      />
      {taskId && task.data && (
        <TaskDialog open onOpenChange={(o) => !o && onTaskClose()} timezone={timezone} task={task.data} />
      )}
    </>
  );
}
