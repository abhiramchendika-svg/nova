import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Wordmark } from '@/components/patterns/TriMark';
import { ThemeMenu } from '@/features/theme/ThemeMenu';

/** Shared frame for login and sign-up: brand, one focused card, nothing else competing. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-4 py-5">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link to="/" aria-label="NOVA home" className="rounded-sm">
          <Wordmark />
        </Link>
        <ThemeMenu />
      </header>
      <main id="main" className="grid flex-1 place-items-center py-10">
        <div className="animate-enter w-full max-w-[400px]">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.015em]">
            {title}
          </h1>
          <p className="mt-2 text-[14.5px] text-ink-2">{subtitle}</p>
          <div className="mt-7 rounded-lg border border-line bg-surface p-6">{children}</div>
          <p className="mt-5 text-center text-[13.5px] text-ink-2">{footer}</p>
        </div>
      </main>
    </div>
  );
}
