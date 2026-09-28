import { Badge } from '@/components/ui/Badge';
import { DomainDot } from '@/components/ui/DomainDot';
import { Progress } from '@/components/ui/Progress';
import { TodayStrip, type StripBlock, type StripDue } from '@/features/dashboard/TodayStrip';

/** Example data for the landing preview only. Clearly labelled; never shown as a user's own figures. */
const DEMO_BLOCKS: StripBlock[] = [
  {
    id: 'ds',
    kind: 'class',
    domain: 'academics',
    title: 'Data Structures',
    shortTitle: 'DS',
    start: '09:00',
    end: '09:50',
    meta: 'LH-101',
  },
  {
    id: 'db',
    kind: 'class',
    domain: 'academics',
    title: 'Database Systems',
    shortTitle: 'DBMS',
    start: '10:00',
    end: '10:50',
    meta: 'LH-110',
  },
  { id: 'java', kind: 'task', domain: 'planner', title: 'Java assignment', start: '11:30', end: '13:00' },
  {
    id: 'lab',
    kind: 'class',
    domain: 'academics',
    title: 'DBMS Lab',
    start: '14:00',
    end: '15:40',
    meta: 'Lab 3',
  },
  {
    id: 'spring',
    kind: 'task',
    domain: 'developer',
    title: 'Spring Boot: JPA',
    shortTitle: 'Spring Boot',
    start: '16:00',
    end: '17:00',
  },
];
const DEMO_DUES: StripDue[] = [{ id: 'er', title: 'ER due', at: '17:30' }];

export function ProductPreview() {
  return (
    <figure
      className="m-0 overflow-hidden rounded-lg border border-line bg-bg shadow-dialog"
      aria-label="Preview of the NOVA Home dashboard with example data"
    >
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="ml-2 font-mono text-[11px] text-ink-3">nova · Home</span>
        <Badge className="ml-auto">Example data</Badge>
      </div>
      <div className="grid gap-3 p-4">
        <div>
          <p className="font-mono text-[11px] text-ink-3">WED 30 SEP</p>
          <p className="mt-1 font-display text-[19px] font-semibold leading-tight">
            <span className="font-mono font-medium">4</span> things need you today.
          </p>
        </div>
        <div className="rounded-md border border-line bg-surface px-3 pt-3">
          <TodayStrip blocks={DEMO_BLOCKS} dues={DEMO_DUES} now="11:52" label="Example timeline" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2.5 rounded-md border border-line bg-surface p-3">
            <p className="text-[12.5px] font-semibold">Needs attention</p>
            <AttentionRow tone="critical" badge="Overdue 1 day" title="OS assignment 2" />
            <AttentionRow tone="warning" badge="76.5%" title="Compilers attendance" />
          </div>
          <div className="grid content-start gap-2.5 rounded-md border border-line bg-surface p-3">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
              <DomainDot domain="developer" /> Spring Boot
            </p>
            <Progress value={64} label="7 of 11 topics" domain="developer" />
          </div>
        </div>
      </div>
    </figure>
  );
}

function AttentionRow({
  tone,
  badge,
  title,
}: {
  tone: 'critical' | 'warning';
  badge: string;
  title: string;
}) {
  return (
    <div className="grid grid-cols-[3px_1fr] gap-2.5">
      <span className={tone === 'critical' ? 'rounded-full bg-critical' : 'rounded-full bg-warning-fill'} />
      <div className="grid gap-1">
        <span className="text-[12.5px] font-medium">{title}</span>
        <Badge tone={tone} className="w-fit">
          {badge}
        </Badge>
      </div>
    </div>
  );
}
