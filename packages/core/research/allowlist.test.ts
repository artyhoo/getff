import { describe, expect, it } from 'vitest';
import { ALLOWED_SOURCES, validateProvenance } from './allowlist.ts';

describe('validateProvenance — source allowlist enforcement', () => {
  it('accepts an exact-host match under a known key', () => {
    const result = validateProvenance({
      url: 'https://nextjs.org/docs/app',
      allowlistKey: 'next.official',
      fetchedAt: '2026-05-08',
    });
    expect(result).toEqual({ ok: true });
  });

  it('accepts a subdomain match under a known key (`docs.tailwindcss.com`)', () => {
    const result = validateProvenance({
      url: 'https://docs.tailwindcss.com/installation',
      allowlistKey: 'tailwind.official',
      fetchedAt: '2026-05-08',
    });
    expect(result.ok).toBe(true);
  });

  it('accepts reactnative.dev under react-native.official (RN/expo stacks, #812)', () => {
    const result = validateProvenance({
      url: 'https://reactnative.dev/docs/platform-specific-code',
      allowlistKey: 'react-native.official',
      fetchedAt: '2026-06-29',
    });
    expect(result).toEqual({ ok: true });
  });

  it('accepts a docs.expo.dev subdomain under expo.official (expo consumers, #812)', () => {
    const result = validateProvenance({
      url: 'https://docs.expo.dev/guides/environment-variables/',
      allowlistKey: 'expo.official',
      fetchedAt: '2026-06-29',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a non-RN host under react-native.official (paired-negative)', () => {
    const result = validateProvenance({
      url: 'https://github.com/facebook/react-native',
      allowlistKey: 'react-native.official',
      fetchedAt: '2026-06-29',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/host github\.com not allowed/);
  });

  it('rejects URL whose hostname does not belong to the allowlistKey hosts', () => {
    const result = validateProvenance({
      url: 'https://nextjs.org/docs',
      allowlistKey: 'react.official',
      fetchedAt: '2026-05-08',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/host nextjs\.org not allowed/);
  });

  it('rejects unknown allowlistKey', () => {
    const result = validateProvenance({
      url: 'https://example.com',
      allowlistKey: 'made-up-key',
      fetchedAt: '2026-05-08',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown allowlistKey/);
  });

  it('rejects malformed URL', () => {
    const result = validateProvenance({
      url: 'not a url',
      allowlistKey: 'next.official',
      fetchedAt: '2026-05-08',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/malformed URL/);
  });

  it('rejects http (non-https) URL', () => {
    const result = validateProvenance({
      url: 'http://nextjs.org/docs',
      allowlistKey: 'next.official',
      fetchedAt: '2026-05-08',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/non-https/);
  });

  it('exposes the allowlist keys as a typed constant', () => {
    expect(Object.keys(ALLOWED_SOURCES)).toContain('next.official');
    expect(Object.keys(ALLOWED_SOURCES)).toContain('react.official');
    expect(Object.keys(ALLOWED_SOURCES)).toContain('tailwind.official');
  });
});
