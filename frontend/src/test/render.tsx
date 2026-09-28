import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense, type ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Providers } from '@/app/Providers';
import { createQueryClient } from '@/app/queryClient';
import { routes } from '@/app/routes';

/** Render the real route tree at a path, with production providers and a fresh query cache. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
  const user = userEvent.setup();
  const utils = render(
    <Providers queryClient={queryClient}>
      <Suspense fallback={<p>Loading test route…</p>}>
        <RouterProvider router={router} />
      </Suspense>
    </Providers>,
  );
  return { ...utils, router, user, queryClient };
}

/** Render a single component with providers (no router). */
export function renderWithProviders(ui: ReactElement) {
  const queryClient = createQueryClient();
  const user = userEvent.setup();
  return { ...render(<Providers queryClient={queryClient}>{ui}</Providers>), user, queryClient };
}
