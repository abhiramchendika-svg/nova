import { Link } from 'react-router';
import { Panel } from '@/components/ui/Panel';
import { useInsights } from './api';
import { InsightCard } from './InsightCard';

/** Home: the two highest-ranked insights for this week, with a link to the rest. */
export function WeekInsights({ className }: { className?: string }) {
  const insights = useInsights('WEEK');
  const top = insights.data?.insights.slice(0, 2) ?? [];
  return (
    <Panel
      title="This week"
      className={className}
      action={
        <Link to="/app/insights" className="text-[12.5px] font-medium text-ink-2 hover:text-ink">
          All insights
        </Link>
      }
    >
      {insights.isPending ? (
        <p role="status" className="text-[13px] text-ink-3">
          Working out your week…
        </p>
      ) : insights.isError ? (
        <p role="alert" className="text-[13px] text-ink-2">
          We couldn’t work out this week’s insights.
        </p>
      ) : top.length === 0 ? (
        <p className="text-[13px] text-ink-2">
          Nothing to point out yet. Insights appear once NOVA has a week of your data.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {top.map((i) => (
            <InsightCard key={i.id} insight={i} compact />
          ))}
        </div>
      )}
    </Panel>
  );
}
