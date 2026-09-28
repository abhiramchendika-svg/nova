import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { clampPercent } from '@/lib/math';
import { initialsFor } from '@/lib/format';
import { Badge } from './Badge';
import { Button } from './Button';
import { Field } from './Field';
import { Progress } from './Progress';

describe('Button', () => {
  it('blocks clicks and announces busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('links the label and the error message to the input', () => {
    render(<Field label="Credits" error="Must be 0 or more." />);
    const input = screen.getByLabelText('Credits');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Must be 0 or more.');
  });
  it('uses the hint as description when there is no error', () => {
    render(<Field label="Password" hint="At least 10 characters." />);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('At least 10 characters.');
  });
});

describe('Progress', () => {
  it('exposes its value to assistive tech and clamps it', () => {
    render(<Progress value={140} label="Spring Boot" />);
    const bar = screen.getByRole('progressbar', { name: 'Spring Boot' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });
  it.each([
    [-5, 0],
    [42.4, 42.4],
    [101, 100],
    [Number.NaN, 0],
  ])('clampPercent(%s) → %s', (input, expected) => {
    expect(clampPercent(input)).toBe(expected);
  });
});

describe('Badge', () => {
  it('pairs status colour with an icon so meaning is not colour-only', () => {
    const { container } = render(<Badge tone="critical">Overdue</Badge>);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});

describe('initialsFor', () => {
  it.each([
    ['Abhiram Chendika', 'AC'],
    ['Abhi', 'A'],
    ['  riya   k  sharma ', 'RS'],
    ['', '?'],
  ])('%s → %s', (name, expected) => {
    expect(initialsFor(name)).toBe(expected);
  });
});
