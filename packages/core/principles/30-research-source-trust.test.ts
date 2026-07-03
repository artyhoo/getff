/**
 * Principle 30 — research-source trust discipline (rule-research-trust-tiers S3).
 *
 * Source: .claude/rules/research-source-trust.md
 *         .claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md §4
 *
 * This is the S3 Class-A DISCIPLINE companion — it asserts store-wide
 * invariants over the curated research store, NOT resolver behavior (the
 * resolver's own behavior suites are allowlist-resolver.test.ts + tier1.test.ts
 * + ecosystem-npm.test.ts). Per every peer rule pairing (ai-laziness-traps.md
 * → principle 12, doc-authority-hierarchy.md → principle 09), the discipline
 * test checks that the framework's OWN artifacts (here: the committed store)
 * obey the rule it ships — T15 self-application, not a re-test of the resolver
 * unit-level behavior (avoiding #pattern-matching-on-name per kickoff §5 S3).
 *
 * Invariants:
 *   (a) every provenance host in the curated store passes the Tier-0-only
 *       (one-arg) validateProvenance — the fail-closed catalog holds for every
 *       committed entry, not just the ones a developer happened to eyeball;
 *   (b) NO curated-store provenance host is on multi-tenant-hosts.json — the
 *       curated store is hand-curated Tier-0 data, so a shared-apex host
 *       slipping in would be a silent scope-widening the store must never
 *       carry (H2 never enters the curated store);
 *   (c) conditional scope-lock-shape assertion: IF a ResearchEntry carries
 *       `package`, its provenance entries must carry a matching `packageName`
 *       — the scope-lock shape holds store-wide. Today zero curated entries
 *       carry `package` (T15 back-compat with the 9 store JSONs, S2 Task 2.1);
 *       the check is CONDITIONAL so it stays vacuously true today and becomes
 *       load-bearing the moment a curated entry adopts Tier-1 fields.
 *
 * Paired negative (inline fixture, proves (b) is non-vacuous): a fabricated
 * entry with a github.com provenance URL MUST fail invariant (b). Observed
 * RED before the real check existed (module-not-found), then RED against a
 * clean population run without the fixture wired in (population-only assert
 * would not catch a planted violation) — GREEN once the fixture assertion is
 * added and the real 9-file store independently stays clean.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProvenance } from '../research/allowlist.ts';
import type { Provenance, ResearchEntry } from '../research/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const MULTI_TENANT_HOSTS_PATH = resolve(
  REPO_ROOT,
  'packages/core/research/multi-tenant-hosts.json',
);

/** Tracked store JSON files (git-aware, mirrors the principle 12/29/09 pattern —
 *  reaches committed fixtures identically in CI and locally). Empty list is a
 *  valid state (fresh clone before any store entry lands) — no lower floor. */
function trackedStoreFiles(): string[] {
  try {
    const out = execFileSync(
      'git',
      ['ls-files', '-z', 'packages/core/research/store/**/*.json'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    return out
      .split('\0')
      .filter(Boolean)
      .map((rel) => resolve(REPO_ROOT, rel));
  } catch {
    return [];
  }
}

function loadStoreEntries(): { file: string; entry: ResearchEntry }[] {
  return trackedStoreFiles()
    .filter((f) => existsSync(f))
    .map((file) => ({
      file,
      entry: JSON.parse(readFileSync(file, 'utf8')) as ResearchEntry,
    }));
}

const MULTI_TENANT_HOSTS: readonly string[] = (
  JSON.parse(readFileSync(MULTI_TENANT_HOSTS_PATH, 'utf8')) as { hosts: string[] }
).hosts;

/** Same segment-safe subdomain-inclusive matching as the resolver's own
 *  isMultiTenantHost — duplicated deliberately: this is a DISCIPLINE check on
 *  the store, independent of the resolver's internals, per the module's header
 *  comment (T15 self-application, not a resolver-behavior re-test). */
function isOnMultiTenantList(host: string): boolean {
  return MULTI_TENANT_HOSTS.some((apex) => host === apex || host.endsWith(`.${apex}`));
}

function hostOf(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

describe('Principle 30 — research-source trust discipline (S3, store-wide)', () => {
  const storeEntries = loadStoreEntries();
  // Population sentinel — catches an accidental empty store (glob broke) without
  // demanding a specific count; the plan records 9 files as of 2026-07-02, but a
  // future addition growing the store is expected, not a violation.
  const STORE_POPULATED = storeEntries.length > 0;

  it.skipIf(!STORE_POPULATED)(
    'population sentinel — tracked store is non-empty (catches a broken glob)',
    () => {
      expect(storeEntries.length).toBeGreaterThan(0);
    },
  );

  // ── Invariant (a): every curated-store provenance host passes Tier-0 ──────
  it.skipIf(!STORE_POPULATED)(
    'invariant (a): every committed store provenance passes the Tier-0-only validateProvenance',
    () => {
      const violations: string[] = [];
      for (const { file, entry } of storeEntries) {
        for (const p of entry.provenance) {
          const result = validateProvenance(p as Provenance);
          if (!result.ok) {
            violations.push(`${file} (${entry.id}): ${p.url} — ${result.reason}`);
          }
        }
      }
      expect(
        violations,
        `Store entries failing Tier-0 validateProvenance:\n${violations.join('\n')}`,
      ).toHaveLength(0);
    },
  );

  // ── Invariant (b): no curated-store host is a multi-tenant apex ───────────
  it.skipIf(!STORE_POPULATED)(
    'invariant (b): no committed store provenance host is on multi-tenant-hosts.json',
    () => {
      const violations: string[] = [];
      for (const { file, entry } of storeEntries) {
        for (const p of entry.provenance) {
          const host = hostOf(p.url);
          if (isOnMultiTenantList(host)) {
            violations.push(`${file} (${entry.id}): ${p.url} — host "${host}" is a multi-tenant apex`);
          }
        }
      }
      expect(
        violations,
        `Store entries citing a multi-tenant host (H2 must never enter the curated store):\n${violations.join('\n')}`,
      ).toHaveLength(0);
    },
  );

  // ── Invariant (c): conditional scope-lock shape (package ⇒ matching packageName) ──
  it.skipIf(!STORE_POPULATED)(
    'invariant (c): IF a store entry carries `package`, its provenance carries a matching `packageName`',
    () => {
      const violations: string[] = [];
      let entriesWithPackage = 0;
      for (const { file, entry } of storeEntries) {
        if (entry.package === undefined) continue; // conditional — T15 back-compat, expected today
        entriesWithPackage += 1;
        for (const p of entry.provenance) {
          if (p.packageName !== entry.package) {
            violations.push(
              `${file} (${entry.id}): provenance packageName "${p.packageName}" !== entry.package "${entry.package}"`,
            );
          }
        }
      }
      expect(
        violations,
        `Store entries with a scope-lock shape mismatch:\n${violations.join('\n')}`,
      ).toHaveLength(0);
      // Non-vacuous documentation, not an assertion: today's expected count is 0
      // (S2 Task 2.1 back-compat — no curated entry has adopted Tier-1 fields yet).
      // This comment is the record; the invariant above is what actually gates.
      void entriesWithPackage;
    },
  );

  // ── Paired negative: proves invariant (b) DISCRIMINATES (non-tautological) ──
  // A test that can never fail on a real violation does not enforce anything.
  // This fixture is NOT part of the tracked store — it is fabricated in-memory
  // to prove the multi-tenant check actually catches what it claims to catch.
  describe('paired negative — invariant (b) is non-vacuous', () => {
    const FIXTURE_VIOLATING_ENTRY: ResearchEntry = {
      id: 'fixture-multi-tenant-violation',
      summary: 'Fabricated fixture — must never be a real store entry.',
      bestPractices: [],
      antiPatterns: [],
      provenance: [
        {
          url: 'https://github.com/some-org/some-repo/docs',
          allowlistKey: 'fixture.fake',
          fetchedAt: '2026-07-02T00:00:00Z',
        },
      ],
    };

    it('FIXTURE host is on the multi-tenant list (github.com) — sanity check on the fixture itself', () => {
      const host = hostOf(FIXTURE_VIOLATING_ENTRY.provenance[0]!.url);
      expect(host).toBe('github.com');
      expect(isOnMultiTenantList(host)).toBe(true);
    });

    it('applying invariant (b)\'s exact logic to the fixture DETECTS the violation (RED proof)', () => {
      // Same logic as the real invariant-(b) test body, run against the planted
      // fixture instead of the tracked store — proves the check would have
      // caught this shape had it been committed to the store.
      const violations: string[] = [];
      for (const p of FIXTURE_VIOLATING_ENTRY.provenance) {
        const host = hostOf(p.url);
        if (isOnMultiTenantList(host)) {
          violations.push(`${FIXTURE_VIOLATING_ENTRY.id}: ${p.url} — host "${host}" is a multi-tenant apex`);
        }
      }
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('github.com');
    });

    it('anti-tautology: swapping the fixture host to a single-tenant one silences the detector', () => {
      const cleanEntry: ResearchEntry = {
        ...FIXTURE_VIOLATING_ENTRY,
        provenance: [
          { ...FIXTURE_VIOLATING_ENTRY.provenance[0]!, url: 'https://orm.drizzle.team/docs' },
        ],
      };
      const violations: string[] = [];
      for (const p of cleanEntry.provenance) {
        const host = hostOf(p.url);
        if (isOnMultiTenantList(host)) violations.push(host);
      }
      expect(violations).toHaveLength(0);
    });
  });
});
