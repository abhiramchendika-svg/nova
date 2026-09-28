import { Suspense, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { PageSkeleton } from '@/components/patterns/Skeleton';
import { Providers } from './Providers';
import { createQueryClient } from './queryClient';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <Providers queryClient={queryClient}>
      <Suspense fallback={<PageSkeleton />}>
        <RouterProvider router={router} />
      </Suspense>
    </Providers>
  );
}
