import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { THEME_STORAGE_KEY } from './theme';
import { ThemeMenu } from './ThemeMenu';

describe('ThemeMenu', () => {
  it('applies the chosen theme to <html> and persists it', async () => {
    const { user } = renderWithProviders(<ThemeMenu />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light'); // jsdom OS = light

    await user.click(screen.getByRole('button', { name: /theme/i }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('starts from the stored preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderWithProviders(<ThemeMenu />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Theme: dark' })).toBeInTheDocument();
  });
});
