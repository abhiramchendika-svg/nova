import { z } from 'zod';

/** Kept in sync with backend validation (RegisterRequest / LoginRequest). */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(1, 'Tell us what to call you.').max(80, 'Keep it under 80 characters.'),
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

/** Only allow in-app redirects after login, so ?next= can't send users to another site. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/app';
  return next;
}
