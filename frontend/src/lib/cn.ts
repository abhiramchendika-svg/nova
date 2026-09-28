import { clsx, type ClassValue } from 'clsx';

/** Join class names conditionally. Callers should add classes, not override component ones. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
