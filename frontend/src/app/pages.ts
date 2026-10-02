/**
 * Every lazily loaded page, by name. Routes build React.lazy components from these; tests call
 * {@link preloadPages} first, so a cold import of a page (slow on some machines) happens before a
 * test starts timing, not inside its first findBy… wait.
 */
export const pageLoaders = {
  AppShell: () => import('@/layouts/AppShell').then((m) => ({ default: m.AppShell })),
  HomePage: () => import('@/features/dashboard/HomePage').then((m) => ({ default: m.HomePage })),
  LoginPage: () => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
  RegisterPage: () => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })),
  CoursesPage: () => import('@/features/academics/CoursesPage').then((m) => ({ default: m.CoursesPage })),
  AttendancePage: () =>
    import('@/features/academics/AttendancePage').then((m) => ({ default: m.AttendancePage })),
  AssignmentsPage: () =>
    import('@/features/academics/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })),
  CoursePage: () => import('@/features/academics/CoursePage').then((m) => ({ default: m.CoursePage })),
  ExamsPage: () => import('@/features/academics/ExamsPage').then((m) => ({ default: m.ExamsPage })),
  ExamPage: () => import('@/features/academics/ExamPage').then((m) => ({ default: m.ExamPage })),
  TimetablePage: () =>
    import('@/features/academics/TimetablePage').then((m) => ({ default: m.TimetablePage })),
  GradesPage: () => import('@/features/academics/GradesPage').then((m) => ({ default: m.GradesPage })),
  GradingSchemesPage: () =>
    import('@/features/academics/GradingSchemesPage').then((m) => ({ default: m.GradingSchemesPage })),
  ProjectsPage: () => import('@/features/developer/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
  ProjectPage: () => import('@/features/developer/ProjectPage').then((m) => ({ default: m.ProjectPage })),
  LearningPage: () => import('@/features/developer/LearningPage').then((m) => ({ default: m.LearningPage })),
  GoalPage: () => import('@/features/developer/GoalPage').then((m) => ({ default: m.GoalPage })),
  HackathonsPage: () =>
    import('@/features/developer/HackathonsPage').then((m) => ({ default: m.HackathonsPage })),
  HackathonPage: () =>
    import('@/features/developer/HackathonPage').then((m) => ({ default: m.HackathonPage })),
  InternshipsPage: () =>
    import('@/features/developer/InternshipsPage').then((m) => ({ default: m.InternshipsPage })),
  InternshipPage: () =>
    import('@/features/developer/InternshipPage').then((m) => ({ default: m.InternshipPage })),
  GitHubPage: () => import('@/features/developer/GitHubPage').then((m) => ({ default: m.GitHubPage })),
  CalendarPage: () => import('@/features/planner/CalendarPage').then((m) => ({ default: m.CalendarPage })),
  TasksPage: () => import('@/features/planner/TasksPage').then((m) => ({ default: m.TasksPage })),
  SettingsPage: () => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
  OnboardingPage: () =>
    import('@/features/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
  SectionPlaceholder: () =>
    import('@/pages/SectionPlaceholder').then((m) => ({ default: m.SectionPlaceholder })),
};

export function preloadPages(): Promise<unknown[]> {
  return Promise.all(Object.values(pageLoaders).map((load) => load()));
}
