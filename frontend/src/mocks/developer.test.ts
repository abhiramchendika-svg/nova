import { describe, expect, it } from 'vitest';
import { normalizeLink, normalizeStack } from './developer';

/** Must agree with TechStackTest and WebLinksTest on the Java side. */
describe('mock project rules', () => {
  it('tidies a tech stack like TechStack.java', () => {
    expect(normalizeStack([' Spring  Boot ', 'react', '', null, 'React', 'PostgreSQL'])).toEqual({
      stack: ['Spring Boot', 'react', 'PostgreSQL'],
    });
    expect(normalizeStack(null)).toEqual({ stack: [] });
    expect(normalizeStack(Array.from({ length: 16 }, (_, i) => `t${i}`))).toHaveProperty('error');
    expect(normalizeStack(['x'.repeat(31)])).toHaveProperty('error');
    expect(normalizeStack(Array.from({ length: 20 }, () => 'Java'))).toEqual({ stack: ['Java'] });
  });

  it('accepts only full http(s) links like WebLinks.java', () => {
    expect(normalizeLink(' https://github.com/me/app ')).toBe('https://github.com/me/app');
    expect(normalizeLink('')).toBeNull();
    expect(normalizeLink(null)).toBeNull();
    expect(normalizeLink('github.com/me/app')).toBeUndefined();
    expect(normalizeLink('javascript:alert(1)')).toBeUndefined();
    expect(normalizeLink('ftp://example.com')).toBeUndefined();
  });
});
