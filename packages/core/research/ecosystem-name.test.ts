// Stage S4 — ecosystem-prefix parsing (research-source-trust.md §4, now SHIPPED).
// Provenance.packageName / ResearchEntry.package may carry an explicit
// "<ecosystem>:<bareName>" prefix; unprefixed names default to npm (implicit,
// back-compat with every pre-S4 entry). Unknown prefixes fail closed.
import { describe, it, expect } from 'vitest';
import { parseEcosystemName } from './ecosystem-name.ts';

describe('parseEcosystemName', () => {
  it('cargo: prefix parses to {ecosystem:"cargo", bareName}', () => {
    expect(parseEcosystemName('cargo:serde')).toEqual({ ecosystem: 'cargo', bareName: 'serde' });
  });

  it('npm: prefix parses to {ecosystem:"npm", bareName}', () => {
    expect(parseEcosystemName('npm:foo')).toEqual({ ecosystem: 'npm', bareName: 'foo' });
  });

  it('pip: prefix parses to {ecosystem:"pip", bareName} (LG-S4 — pipAdapter shipped)', () => {
    expect(parseEcosystemName('pip:requests')).toEqual({ ecosystem: 'pip', bareName: 'requests' });
  });

  it('unprefixed name defaults to {ecosystem:"npm", bareName:name} (implicit back-compat)', () => {
    expect(parseEcosystemName('drizzle-orm')).toEqual({ ecosystem: 'npm', bareName: 'drizzle-orm' });
  });

  it('unprefixed scoped npm name (contains "/", not ":") still defaults to npm', () => {
    expect(parseEcosystemName('@scope/name')).toEqual({ ecosystem: 'npm', bareName: '@scope/name' });
  });

  it('unknown prefix fails closed: {ecosystem:"unknown", bareName} — never silently falls back to npm', () => {
    expect(parseEcosystemName('evil:foo')).toEqual({ ecosystem: 'unknown', bareName: 'evil:foo' });
  });

  it('a bare name that happens to contain ":" but is not a known-ecosystem prefix is treated as unknown', () => {
    expect(parseEcosystemName('gem:rails')).toEqual({ ecosystem: 'unknown', bareName: 'gem:rails' });
  });
});
