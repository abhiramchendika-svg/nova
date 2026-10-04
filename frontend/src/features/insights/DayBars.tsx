import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatDay } from '@/lib/dates';

export interface DayBar {
  date: string;
  value: number;
  /** Days with a marker (e.g. an exam) get a dot above the bar. */
  marked?: boolean;
  /** The tooltip and table text for the day. */
  detail: string;
}

const WIDTH = 380;
const HEIGHT = 150;
const PAD_TOP = 18;
const PAD_BOTTOM = 22;

/**
 * A small one-series bar chart of days (ui-design.md: thin bars, 4px rounded ends on the baseline,
 * recessive axis, one y-scale), with a native tooltip per bar and a "View as table" toggle so it
 * never depends on seeing the chart.
 */
export function DayBars({
  title,
  description,
  bars,
  barClass,
  markerLabel,
  markerClass,
}: {
  title: string;
  description: string;
  bars: DayBar[];
  barClass: string;
  markerLabel?: string;
  markerClass?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = WIDTH / Math.max(1, bars.length);
  const barWidth = Math.max(5, Math.min(24, slot - 6));
  const plot = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const total = bars.reduce((n, b) => n + b.value, 0);
  const showMarker = markerLabel !== undefined && bars.some((b) => b.marked);

  return (
    <figure
      aria-labelledby={`${id}-title`}
      className="grid gap-2 rounded-md border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption>
          <span id={`${id}-title`} className="text-[14px] font-semibold text-ink">
            {title}
          </span>
          <span className="block text-[12.5px] text-ink-3">{description}</span>
        </figcaption>
        <Button size="sm" variant="ghost" aria-pressed={asTable} onClick={() => setAsTable((t) => !t)}>
          {asTable ? 'View as chart' : 'View as table'}
        </Button>
      </div>
      {asTable ? (
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">{title}</caption>
          <thead className="text-ink-3">
            <tr>
              <th scope="col" className="py-1 font-medium">
                Day
              </th>
              <th scope="col" className="py-1 font-medium">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bars.map((b) => (
              <tr key={b.date}>
                <th scope="row" className="py-1 font-normal text-ink-2">
                  {formatDay(b.date)}
                </th>
                <td className="py-1 font-mono tabular text-ink">{b.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-auto w-full"
            role="img"
            aria-label={`${title}: ${total} in total over ${bars.length} days. Use View as table for each day.`}
          >
            <line
              x1={0}
              x2={WIDTH}
              y1={HEIGHT - PAD_BOTTOM}
              y2={HEIGHT - PAD_BOTTOM}
              className="stroke-line"
              strokeWidth={1}
            />
            {bars.map((b, i) => {
              const h = b.value === 0 ? 0 : Math.max(4, (b.value / max) * plot);
              const x = i * slot + (slot - barWidth) / 2;
              const y = HEIGHT - PAD_BOTTOM - h;
              const label = formatDay(b.date);
              const showDayLabel = bars.length <= 8 || i % Math.ceil(bars.length / 7) === 0;
              return (
                <g key={b.date}>
                  <title>{`${label}: ${b.detail}`}</title>
                  {/* A taller transparent target than the bar, so hovering is easy */}
                  <rect x={i * slot} y={0} width={slot} height={HEIGHT - PAD_BOTTOM} fill="transparent" />
                  {h > 0 && (
                    <path
                      d={`M${x},${HEIGHT - PAD_BOTTOM} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + barWidth - 4} Q${x + barWidth},${y} ${x + barWidth},${y + 4} V${HEIGHT - PAD_BOTTOM} Z`}
                      className={barClass}
                    />
                  )}
                  {b.value > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 4}
                      textAnchor="middle"
                      className="fill-ink-2 font-mono text-[11px]"
                    >
                      {b.value}
                    </text>
                  )}
                  {b.marked && showMarker && (
                    <circle cx={x + barWidth / 2} cy={6} r={4} className={markerClass} />
                  )}
                  {showDayLabel && (
                    <text
                      x={i * slot + slot / 2}
                      y={HEIGHT - 6}
                      textAnchor="middle"
                      className="fill-ink-3 text-[11px]"
                    >
                      {bars.length <= 8 ? label.slice(0, 3) : label.slice(4)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {showMarker && (
            <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
              <svg aria-hidden viewBox="0 0 8 8" className="size-2">
                <circle cx={4} cy={4} r={4} className={markerClass} />
              </svg>
              {markerLabel}
            </p>
          )}
        </>
      )}
    </figure>
  );
}
