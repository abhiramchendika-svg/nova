import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { LandingPage } from '@/features/landing/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { pageLoaders } from './pages';

// Code-split by area: visitors to the landing page don't download the app, and vice versa.
const AppShell = lazy(pageLoaders.AppShell);
const HomePage = lazy(pageLoaders.HomePage);
const LoginPage = lazy(pageLoaders.LoginPage);
const RegisterPage = lazy(pageLoaders.RegisterPage);
const CoursesPage = lazy(pageLoaders.CoursesPage);
const AttendancePage = lazy(pageLoaders.AttendancePage);
const AssignmentsPage = lazy(pageLoaders.AssignmentsPage);
const CoursePage = lazy(pageLoaders.CoursePage);
const ExamsPage = lazy(pageLoaders.ExamsPage);
const ExamPage = lazy(pageLoaders.ExamPage);
const TimetablePage = lazy(pageLoaders.TimetablePage);
const GradesPage = lazy(pageLoaders.GradesPage);
const GradingSchemesPage = lazy(pageLoaders.GradingSchemesPage);
const TasksPage = lazy(pageLoaders.TasksPage);
const CalendarPage = lazy(pageLoaders.CalendarPage);
const ProjectsPage = lazy(pageLoaders.ProjectsPage);
const ProjectPage = lazy(pageLoaders.ProjectPage);
const LearningPage = lazy(pageLoaders.LearningPage);
const GoalPage = lazy(pageLoaders.GoalPage);
const HackathonsPage = lazy(pageLoaders.HackathonsPage);
const HackathonPage = lazy(pageLoaders.HackathonPage);
const InternshipsPage = lazy(pageLoaders.InternshipsPage);
const InternshipPage = lazy(pageLoaders.InternshipPage);
const GitHubPage = lazy(pageLoaders.GitHubPage);
const InsightsPage = lazy(pageLoaders.InsightsPage);
const NotificationsPage = lazy(pageLoaders.NotificationsPage);
const SettingsPage = lazy(pageLoaders.SettingsPage);
const OnboardingPage = lazy(pageLoaders.OnboardingPage);

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    // First-run setup has its own focused layout (no sidebar), so it sits outside the app shell
    path: '/app/welcome',
    element: (
      <RequireAuth>
        <OnboardingPage />
      </RequireAuth>
    ),
  },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'academics/courses', element: <CoursesPage /> },
      { path: 'academics/courses/:courseId', element: <CoursePage /> },
      { path: 'academics/assignments', element: <AssignmentsPage /> },
      { path: 'academics/exams', element: <ExamsPage /> },
      { path: 'academics/exams/:examId', element: <ExamPage /> },
      { path: 'academics/timetable', element: <TimetablePage /> },
      { path: 'planner/tasks', element: <TasksPage /> },
      { path: 'planner/calendar', element: <CalendarPage /> },
      { path: 'developer/projects', element: <ProjectsPage /> },
      { path: 'developer/projects/:projectId', element: <ProjectPage /> },
      { path: 'developer/learning', element: <LearningPage /> },
      { path: 'developer/learning/:goalId', element: <GoalPage /> },
      { path: 'developer/hackathons', element: <HackathonsPage /> },
      { path: 'developer/hackathons/:hackathonId', element: <HackathonPage /> },
      { path: 'developer/internships', element: <InternshipsPage /> },
      { path: 'developer/internships/:internshipId', element: <InternshipPage /> },
      { path: 'developer/github', element: <GitHubPage /> },
      { path: 'insights', element: <InsightsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'academics/attendance', element: <AttendancePage /> },
      { path: 'academics/grades', element: <GradesPage /> },
      { path: 'academics/grades/schemes', element: <GradingSchemesPage /> },
    ],
  },
  // Anything else, including unknown pages inside /app, is a real 404
  { path: '*', element: <NotFoundPage /> },
];
