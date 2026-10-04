import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { DomainDot } from '@/components/ui/DomainDot';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/dates';
import type { Insight } from './types';

const SEVERITY: Record<Insight['severity'], { tone: BadgeTone; label: string }> = {
  WARN: { tone: 'warning', label: 'Worth a look' },
  INFO: { tone: 'neutral', label: 'For your info' },
  GOOD: { tone: 'good', label: 'Going well' },
};

const range = (from: string, to: string) =>
  from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;

/**
 * One insight: the sentence, then "How we got this": the numbers, the dates, the formula and the
 * records it came from. Nothing is shown that can't be traced back.
 */
export function InsightCard({ insight, compact = false }: { insight: Insight; compact?: boolean }) {
  const severity = SEVERITY[insight.severity];
  return (
    <article aria-label={insight.text} className="grid gap-2.5 rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        {insight.domain !== 'cross' ? (
          <DomainDot domain={insight.domain} />
        ) : (
          <span aria-hidden className="flex gap-0.5">
            <DomainDot domain="academics" />
            <DomainDot domain="planner" />
          </span>
        )}
        <Badge tone={severity.tone}>{severity.label}</Badge>
      </div>
      <p className={cn('text-ink', compact ? 'text-[14px]' : 'text-[15px] font-medium')}>{insight.text}</p>
      {!compact && (
        <details className="group text-[13px]">
          <summary className="cursor-pointer select-none text-ink-2 hover:text-ink">How we got this</summary>
          <div className="mt-2 grid gap-2.5 border-l-2 border-line pl-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {insight.evidence.facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-ink-3">{f.label}</dt>
                  <dd className="font-mono tabular text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-ink-2">
              <span className="text-ink-3">Dates:</span> {range(insight.evidence.from, insight.evidence.to)}
            </p>
            <p className="text-ink-2">
              <span className="text-ink-3">Formula:</span> {insight.evidence.formula}
            </p>
            {insight.evidence.note && <p className="text-ink-2">{insight.evidence.note}</p>}
            {insight.sources.length > 0 && (
              <div>
                <p className="text-ink-3">From</p>
                <ul className="mt-0.5 grid gap-0.5">
                  {insight.sources.map((s) => (
                    <li key={`${s.kind}:${s.id ?? s.label}`}>
                      <Link to={s.link} className="text-ink underline-offset-2 hover:underline">
                        {s.label}
                      </Link>
                    </li>
                  ))}
                  {insight.moreSources > 0 && <li className="text-ink-3">and {insight.moreSources} more</li>}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
      <Link
        to={insight.link}
        className="inline-flex w-fit items-center gap-0.5 text-[13px] font-medium text-ink-2 hover:text-ink"
      >
        Open
        <span className="sr-only">: {insight.text}</span>
        <ChevronRight size={14} aria-hidden />
      </Link>
    </article>
  );
}
