import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/features/theme/ThemeProvider';

/**
 * App-wide providers. Tests render through this too, so they match production wiring. Tooltips are
 * only used inside the app shell, so their provider lives there (keeps Radix Tooltip off the landing page).
 */
export function Providers({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
