import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render';
import { installMockApi } from '@/test/server';

describe('landing page', () => {
  it('states the promise and offers sign-up', async () => {
    installMockApi();
    renderRoute('/');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your student life, organized in one place.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get started, free' })).toHaveAttribute('href', '/register');
    for (const line of [
      'Know where you stand.',
      'Know what to do next.',
      'Know what you’re building toward.',
    ]) {
      expect(screen.getByRole('heading', { name: line })).toBeInTheDocument();
    }
  });

  it('labels its preview figures as example data', () => {
    installMockApi();
    renderRoute('/');
    expect(screen.getByText('Example data')).toBeInTheDocument();
    expect(screen.getByText('Figures on this page are example data.')).toBeInTheDocument();
  });

  it('has no serious accessibility violations', async () => {
    installMockApi();
    const { container } = renderRoute('/');
    expect(await axeViolations(container)).toEqual([]);
  });
});
