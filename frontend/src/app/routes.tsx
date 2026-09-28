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
      ...PLANNED.map(({ path, phase }) => ({ path, element: <SectionPlaceholder phase={phase} /> })),
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
