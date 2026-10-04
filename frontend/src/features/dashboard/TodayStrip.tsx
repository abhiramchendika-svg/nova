import { cn } from '@/lib/cn';
import { DomainDot, type Domain } from '@/components/ui/DomainDot';
import { placeDay } from '@/features/academics/timetableLayout';
import { fitRange, formatMinutes, hourTicks, percentAt, toMinutes } from './timeScale';

export interface StripBlock {
  id: string;
  kind: 'class' | 'task';
  domain: Domain;
  title: string;
  /** Short label for narrow blocks, e.g. a course code. */
  shortTitle?: string;
  start: string; // HH:mm
  end: string; // HH:mm
  meta?: string;
}

export interface StripDue {
  id: string;
  title: string;
  at: string; // HH:mm
}

const blockTone: Record<Domain, string> = {
  academics: 'tint-academics border-academics/35 text-academics-text',
  planner: 'tint-planner border-planner/35 text-planner-text border-dashed',
  developer: 'tint-developer border-developer/35 text-developer-text border-dashed',
};

/** Full class names so Tailwind can see them (no string-built classes). */
const agendaBar: Record<Domain, string> = {
  academics: 'bg-academics',
  planner: 'bg-planner',
  developer: 'bg-developer',
};

interface AgendaItem {
  key: string;
  at: number;
  time: string;
  title: string;
  detail?: string;
  domain?: Domain;
  isDue?: boolean;
}

/**
 * The Today strip (ui-design.md §1, signature element 2).
 *  - ≥ md: horizontal timeline — classes on the top lane, planned work below, due times as
 *    dotted ticks, and a now line. Everything is placed by one time scale (timeScale.ts).
 *  - < md: the same items as a vertical agenda, which reads better on a phone.
 * The drawing is aria-hidden; screen readers get the agenda list, which is the same data.
 */
export function TodayStrip({
  blocks,
  dues = [],
  now,
  label = 'Today’s timeline',
}: {
  blocks: StripBlock[];
  dues?: StripDue[];
  /** Current time as HH:mm; omit to hide the now line. */
  now?: string;
  label?: string;
}) {
  const times = [
    ...blocks.flatMap((b) => [toMinutes(b.start), toMinutes(b.end)]),
    ...dues.map((d) => toMinutes(d.at)),
  ];
  const range = fitRange(times);
  const gridTicks = hourTicks(range, 1);
  const labelTicks = hourTicks(range, 2);
  const nowMin = now ? toMinutes(now) : null;
  // Overlapping blocks in a lane share its height instead of covering each other
  const classLanes = placeDay(
    blocks.filter((b) => b.kind === 'class').map((b) => ({ id: b.id, startsAt: b.start, endsAt: b.end })),
  );
  const taskLanes = placeDay(
    blocks.filter((b) => b.kind === 'task').map((b) => ({ id: b.id, startsAt: b.start, endsAt: b.end })),
  );
  const showNow = nowMin !== null && nowMin >= range.startMin && nowMin <= range.endMin;

  const agenda: AgendaItem[] = [
    ...blocks.map((b) => ({
      key: b.id,
      at: toMinutes(b.start),
      time: b.start,
      title: b.title,
      detail: `${b.start}–${b.end}${b.meta ? ` · ${b.meta}` : ''}`,
      domain: b.domain,
    })),
    ...dues.map((d) => ({
      key: d.id,
      at: toMinutes(d.at),
      time: d.at,
      title: `${d.title}`,
      detail: 'Due',
      isDue: true,
    })),
  ].sort((a, b) => a.at - b.at);

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{label}</figcaption>

      {/* Agenda: visible on small screens, and the accessible version everywhere */}
      <ol className="grid md:sr-only">
        {agenda.map((item, i) => {
          const nowBefore =
            showNow && nowMin !== null && item.at > nowMin && (i === 0 || (agenda[i - 1]?.at ?? 0) <= nowMin);
          return (
            <li key={item.key} className="grid">
              {nowBefore && (
                <span className="flex items-center gap-2 py-1 font-mono text-[11px] font-semibold text-ink">
                  {now} <span className="h-0.5 flex-1 rounded-full bg-ink" aria-hidden />
                  <span className="sr-only">now</span>
                </span>
              )}
              <span className="grid grid-cols-[48px_3px_1fr] items-start gap-3 border-b border-line py-2.5 last:border-0">
                <span className="font-mono text-[12px] text-ink-2">{item.time}</span>
                <span
                  aria-hidden
                  className={cn(
                    'h-full min-h-8 rounded-full',
                    item.isDue
                      ? 'border-l-2 border-dotted border-planner'
                      : item.domain
                        ? agendaBar[item.domain]
                        : 'bg-line-strong',
                  )}
                />
                <span className="grid">
                  <span className="text-[13.5px] font-medium">{item.title}</span>
                  {item.detail && <span className="text-[12px] text-ink-3">{item.detail}</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* Timeline drawing: md and up */}
      <div aria-hidden className="relative hidden select-none pb-7 pt-1 md:block">
        <div className="relative mb-1.5 h-4">
          {labelTicks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 font-mono text-[10.5px] text-ink-3"
              style={{ left: `${percentAt(t, range)}%` }}
            >
              {formatMinutes(t)}
            </span>
          ))}
        </div>

        <div className="relative h-[150px] border-y border-line">
          {gridTicks.map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 w-px bg-line"
              style={{ left: `${percentAt(t, range)}%` }}
            />
          ))}

          {blocks.map((b) => {
            const startMin = toMinutes(b.start);
            const endMin = toMinutes(b.end);
            const left = percentAt(startMin, range);
            const width = percentAt(endMin, range) - left;
            const past = nowMin !== null && endMin <= nowMin;
            const place = (b.kind === 'class' ? classLanes : taskLanes).get(b.id) ?? { lane: 0, lanes: 1 };
            const laneTop = b.kind === 'class' ? 8 : 80;
            const laneHeight = 58 / place.lanes;
            return (
              <div
                key={b.id}
                title={`${b.title} · ${b.start}–${b.end}${b.meta ? ` · ${b.meta}` : ''}`}
                className={cn(
                  'absolute overflow-hidden rounded-sm border px-1.5 py-1',
                  // Finished blocks step back to a neutral tone but stay readable (no opacity)
                  past ? 'border-line bg-surface-2 text-ink-2' : blockTone[b.domain],
                )}
                style={{
                  left: `${left}%`,
                  width: `calc(${width}% - 3px)`,
                  top: `${laneTop + place.lane * laneHeight}px`,
                  height: `${laneHeight - (place.lanes > 1 ? 2 : 0)}px`,
                }}
              >
                <span className="block truncate text-[12px] font-semibold leading-tight">
                  {b.shortTitle ?? b.title}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10.5px] text-ink-2">{b.start}</span>
              </div>
            );
          })}

          {dues.map((d) => {
            const pos = percentAt(toMinutes(d.at), range);
            return (
              <div
                key={d.id}
                className="absolute -inset-y-0.5 border-l-2 border-dotted border-planner"
                style={{ left: `${pos}%` }}
              >
                <span
                  className={cn(
                    'absolute -bottom-5 whitespace-nowrap font-mono text-[10.5px] font-medium text-planner-text',
                    // Keep labels near the right edge inside the drawing
                    pos > 70 ? 'right-1.5' : 'left-1.5',
                  )}
                >
                  {d.at} {d.title}
                </span>
              </div>
            );
          })}

          {showNow && (
            <div
              className="absolute -bottom-1 -top-2.5 w-0.5 rounded-full bg-ink"
              style={{ left: `${percentAt(nowMin, range)}%` }}
            >
              <span className="absolute -left-[3px] -top-0.5 size-2 rounded-full bg-ink" />
              <span className="absolute -bottom-5 -left-4 font-mono text-[10.5px] font-semibold text-ink">
                {now}
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-[11.5px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <DomainDot domain="academics" /> Class
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DomainDot domain="planner" /> Planned task
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DomainDot domain="developer" /> Learning
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 border-l-2 border-dotted border-planner" /> Due
          </span>
        </div>
      </div>
    </figure>
  );
}
