/** Insights (docs/api.md §2.14). Every insight carries its numbers, formula, sources and a link. */

export type InsightWindow = 'WEEK' | 'MONTH';
export type InsightSeverity = 'WARN' | 'INFO' | 'GOOD';
export type InsightDomain = 'academics' | 'planner' | 'developer' | 'cross';

export interface InsightFact {
  label: string;
  value: string;
}

export interface InsightSource {
  kind: string;
  id: string | null;
  label: string;
  link: string;
}

export interface Insight {
  id: string;
  rule: string;
  domain: InsightDomain;
  severity: InsightSeverity;
  text: string;
  evidence: {
    from: string;
    to: string;
    facts: InsightFact[];
    formula: string;
    note: string | null;
  };
  sources: InsightSource[];
  moreSources: number;
  link: string;
}

export interface QuietRule {
  rule: string;
  title: string;
  reason: string;
}

export interface Insights {
  window: InsightWindow;
  from: string;
  to: string;
  insights: Insight[];
  quiet: QuietRule[];
  charts: {
    tasksPerDay: { date: string; planned: number; done: number }[];
    deadlinesPerDay: { date: string; deadlines: number; exams: number }[];
  };
}
