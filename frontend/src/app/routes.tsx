import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { LandingPage } from '@/features/landing/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Code-split by area: visitors to the landing page don't download the app, and vice versa.
const AppShell = lazy(() => import('@/layouts/AppShell').then((m) => ({ default: m.AppShell })));
const HomePage = lazy(() => import('@/features/dashboard/HomePage').then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const CoursesPage = lazy(() =>
  import('@/features/academics/CoursesPage').then((m) => ({ default: m.CoursesPage })),
);
const AttendancePage = lazy(() =>
  import('@/features/academics/AttendancePage').then((m) => ({ default: m.AttendancePage })),
);
const AssignmentsPage = lazy(() =>
  import('@/features/academics/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })),
);
const CoursePage = lazy(() =>
  import('@/features/academics/CoursePage').then((m) => ({ default: m.CoursePage })),
);
const ExamsPage = lazy(() =>
  import('@/features/academics/ExamsPage').then((m) => ({ default: m.ExamsPage })),
);
const ExamPage = lazy(() => import('@/features/academics/ExamPage').then((m) => ({ default: m.ExamPage })));
const TimetablePage = lazy(() =>
  import('@/features/academics/TimetablePage').then((m) => ({ default: m.TimetablePage })),
);
const GradesPage = lazy(() =>
  import('@/features/academics/GradesPage').then((m) => ({ default: m.GradesPage })),
);
const GradingSchemesPage = lazy(() =>
  import('@/features/academics/GradingSchemesPage').then((m) => ({ default: m.GradingSchemesPage })),
);
const SectionPlaceholder = lazy(() =>
  import('@/pages/SectionPlaceholder').then((m) => ({ default: m.SectionPlaceholder })),
);

/** Sections that exist in the navigation but ship in a later phase (docs/architecture.md §18). */
const PLANNED: { path: string; phase: string }[] = [
  { path: 'academics/*', phase: 'Phase 2' },
  { path: 'planner/*', phase: 'Phase 3' },
  { path: 'developer/*', phase: 'Phase 4' },
  { path: 'insights', phase: 'Phase 5' },
  { path: 'settings/*', phase: 'Phase 2' },
];

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      // Specific routes win over the section placeholders below (React Router ranks by specificity)
      { path: 'academics/courses', element: <CoursesPage /> },
      { path: 'academics/courses/:courseId', element: <CoursePage /> },
      { path: 'academics/assignments', element: <AssignmentsPage /> },
      { path: 'academics/exams', element: <ExamsPage /> },
      { path: 'academics/exams/:examId', element: <ExamPage /> },
      { path: 'academics/timetable', element: <TimetablePage /> },
      { path: 'academics/attendance', element: <AttendancePage /> },
      { path: 'academics/grades', element: <GradesPage /> },
      { path: 'academics/grades/schemes', element: <GradingSchemesPage /> },
      ...PLANNED.map(({ path, phase }) => ({ path, element: <SectionPlaceholder phase={phase} /> })),
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
