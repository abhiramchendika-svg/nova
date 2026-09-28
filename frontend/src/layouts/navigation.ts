import { BarChart3, CalendarDays, Code2, GraduationCap, Home, Settings, type LucideIcon } from 'lucide-react';
import type { Domain } from '@/components/ui/DomainDot';

export interface NavItem {
  label: string;
  to: string;
  /** Domain items show a coloured dot; top-level items show an icon. */
  domain?: Domain;
  icon?: LucideIcon;
  /** Only match this exact path (used for Home so it isn't active everywhere under /app). */
  end?: boolean;
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
}

/** Information architecture from docs/architecture.md §8. One source for sidebar, rail and bottom bar. */
export const NAV_SECTIONS: NavSection[] = [
  { label: null, items: [{ label: 'Home', to: '/app', icon: Home, end: true }] },
  {
    label: 'Academics',
    items: [
      { label: 'Courses', to: '/app/academics/courses', domain: 'academics' },
      { label: 'Assignments', to: '/app/academics/assignments', domain: 'academics' },
      { label: 'Exams', to: '/app/academics/exams', domain: 'academics' },
      { label: 'Attendance', to: '/app/academics/attendance', domain: 'academics' },
      { label: 'Grades', to: '/app/academics/grades', domain: 'academics' },
      { label: 'Timetable', to: '/app/academics/timetable', domain: 'academics' },
    ],
  },
  {
    label: 'Planner',
    items: [
      { label: 'Tasks', to: '/app/planner/tasks', domain: 'planner' },
      { label: 'Calendar', to: '/app/planner/calendar', domain: 'planner' },
    ],
  },
  {
    label: 'Developer',
    items: [
      { label: 'Projects', to: '/app/developer/projects', domain: 'developer' },
      { label: 'Learning', to: '/app/developer/learning', domain: 'developer' },
      { label: 'Hackathons', to: '/app/developer/hackathons', domain: 'developer' },
      { label: 'Internships', to: '/app/developer/internships', domain: 'developer' },
      { label: 'GitHub', to: '/app/developer/github', domain: 'developer' },
    ],
  },
  {
    label: 'Review',
    items: [
      { label: 'Insights', to: '/app/insights', icon: BarChart3 },
      { label: 'Settings', to: '/app/settings', icon: Settings },
    ],
  },
];

export interface TabItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  /** Path prefix that marks the tab active (a tab covers a whole section). */
  matchPrefix?: string;
}

/** Mobile bottom bar: the three domains plus Home; everything else lives under "More". */
export const TAB_ITEMS: TabItem[] = [
  { label: 'Home', to: '/app', icon: Home, end: true },
  { label: 'Planner', to: '/app/planner/tasks', icon: CalendarDays, matchPrefix: '/app/planner' },
  { label: 'Academics', to: '/app/academics/courses', icon: GraduationCap, matchPrefix: '/app/academics' },
  { label: 'Developer', to: '/app/developer/projects', icon: Code2, matchPrefix: '/app/developer' },
];

/** Page title for the current path, used by the top bars. */
export function titleForPath(pathname: string): string {
  if (pathname === '/app' || pathname === '/app/') return 'Home';
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.to) return item.label;
      // Items marked `end` (Home) only match exactly; otherwise '/app' would swallow every route.
      if (!item.end && pathname.startsWith(`${item.to}/`)) return item.label;
    }
  }
  return 'NOVA';
}
