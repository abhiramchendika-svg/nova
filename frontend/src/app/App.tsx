import { Suspense, useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { PageSkeleton } from '@/components/patterns/Skeleton';
import { Providers } from './Providers';
import { createQueryClient } from './queryClient';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  const [queryClient] = useState(createQueryClient);
  // Mock mode only (`npm run dev:mock`): lets the e2e suite drop cached data, so a page's error and
  // loading states show even if an earlier page already fetched what it needs
  useEffect(() => {
    if (window.__novaMock) {
      window.__novaMock.forgetCache = () =>
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    }
  }, [queryClient]);
  return (
    <Providers queryClient={queryClient}>
      <Suspense fallback={<PageSkeleton />}>
        <RouterProvider router={router} />
      </Suspense>
    </Providers>
  );
}
