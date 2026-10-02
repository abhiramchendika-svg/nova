/** GET /api/v1/search (docs/api.md §2.14). */

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string | null;
  link: string;
}

export interface SearchResults {
  q: string;
  courses: SearchHit[];
  assignments: SearchHit[];
  exams: SearchHit[];
  tasks: SearchHit[];
  projects: SearchHit[];
  learningGoals: SearchHit[];
  hackathons: SearchHit[];
  internships: SearchHit[];
}

export type SearchKind = Exclude<keyof SearchResults, 'q'>;

export const KIND_LABEL: Record<SearchKind, string> = {
  courses: 'Courses',
  assignments: 'Assignments',
  exams: 'Exams',
  tasks: 'Tasks',
  projects: 'Projects',
  learningGoals: 'Learning goals',
  hackathons: 'Hackathons',
  internships: 'Internships',
};

export const KINDS = Object.keys(KIND_LABEL) as SearchKind[];
