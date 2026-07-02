# rule-research-trust-tiers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Authoritative for:** implementation sequencing of the rule-research-trust-tiers umbrella (S1–S3 tasks, S4 sketch): signatures, schema diffs, fixtures, RED-first paired-negative order, commit discipline.
> **NOT authoritative for:** architecture, AC, DECISION-NEEDED — owned by the [kickoff](../../../.claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md); project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

**Goal:** Replace the hardcoded 7-key allowlist (`packages/core/research/allowlist.ts:8-17`) with a tiered resolver — Tier 0 builtin / Tier 1 derived from local installed-package metadata with scope-lock / Tier 2 committed ack file — fail-closed, offline-deterministic.

**Architecture:** A new resolver port (`allowlist-resolver.ts`) computes the allowed-source set from three tiers evaluated in order (first match wins); `validateProvenance(p, resolved, opts?)` consumes it. Tier-1 derivation sits behind an **ecosystem-adapter seam** from day 1 (`EcosystemAdapter`; npm is the first adapter) so future toolchains (`cargo`/`pip`/`go`/`maven`) are a parameter (`{toolchain, stack}`), not a fork — per maintainer direction 2026-07-02. Factory stays no-network: Tier-1 reads only local files.

**Tech Stack:** TypeScript (Node 20+, ESM, `.ts` imports), vitest, Ajv (already a dep — `internal-validators.ts`), zero new npm dependencies (kickoff AC 6).

## Global Constraints

- **No new npm dependency** (kickoff AC 6). Host derivation = **exact canonicalized metadata host**, subdomain-inclusive; NO eTLD+1/PSL computation (DN #3 resolved 2026-07-02: Option D).
- **Offline determinism:** Tier-1 resolution reads ONLY local files; the AC 2 throwing-`fetch` test is the falsifier (T-RTT-B). Never fix the test — fix the implementation.
- **Fail-closed:** anything not authorized by a tier fails validation with a reason string.
- **Cross-tier invariants (kickoff §4):** https-only; registrable hostnames only (reject bare IPv4 AND bracketed IPv6 — `URL.hostname` returns `[::1]` with brackets); canonicalize (lowercase, strip trailing dot); reject any `xn--` DNS label **outside an explicit Tier-2 ack**; subdomain semantics: bare domain includes subdomains (kickoff §3 row 7).
- **Zero behavior change for the 7 Tier-0 keys** (kickoff AC 4): existing `allowlist.test.ts` and all downstream suites stay untouched-green.
- **TDD:** every paired negative observed RED before its fix (kickoff AC 1).
- **English-only** doc bodies (principle 22); **≤600 lines** per markdown file (pre-commit gate).
- Branch per stage from `staging`; one PR per stage; S1 → S2 sequential (shared `allowlist.ts`, DN #4 lead); §1.7 Forward/Backward block in each PR body.

## DECISION-NEEDED dependency map (do not bake in silently)

| DN | Blocks | Plan assumption (every dependent task is marked) |
|---|---|---|
| #1 signal policy | S2 Task 2.2 | **ANSWERED (2026-07-02): metadata-alone**; context7 = discovery-only, zero trust weight |
| #2 ack UX | S1 Task 1.4 | **ANSWERED (2026-07-02): agent-assisted file-edit-in-PR** — agent may draft/write the entry; trust act = human merge; `ackedBy` = human |
| #3 host derivation | S2 Task 2.2 | **ANSWERED (2026-07-02): Option D — exact host**, subdomain-inclusive; no eTLD+1/PSL anywhere |
| #4 umbrella shape | PR order | **ANSWERED (maintainer, 2026-07-02): lead confirmed** — standalone umbrella, S1→S2 sequential |
| #5 generate-first S0 rider | S3 Task 3.4 | **ANSWERED (maintainer, 2026-07-02): staleness marker ships in the generate-first umbrella** — Task 3.4 dropped |
| #6 multi-tenant containment | S2 Tasks 2.2–2.3 | **ANSWERED (2026-07-02): Option A via C's list** (`multi-tenant-hosts.json`); path-scoping (B) closed pending a dedicated design |
| #7 ctx wiring to external validator | S2 Task 2.6 (public API) | **ANSWERED (2026-07-02): Option A confirmed** (optional `resolveCtx?` param, threaded from both synthesizer call-sites; absent ⇒ Tier-0-only) |

**All seven DNs are resolved (maintainer approval 2026-07-02, deep-research round 2 — see kickoff §8 RESOLVED lines). S1/S2 dispatch is unblocked.**

> **S1 status:** executed 2026-07-02 with full TDD in the Cowork sandbox (Tasks 1.1–1.5; RED-first evidence in the PR body draft). Deliverable: `git am`-ready patch `s1-resolver-tier2.patch` + `s1-pr-body.md`. Human steps remaining: local eslint, commit-via-am, push (pre-push gate), PR.

## File structure (whole umbrella)

```text
packages/core/research/
  allowlist.ts                     # MODIFY (S1): keep ALLOWED_SOURCES + one-arg wrapper, delegate
  allowlist-resolver.ts + .test.ts # CREATE (S1): resolver port, tiers, invariant helpers + S1 negatives
  research-allowlist.schema.json   # CREATE (S1): Tier-2 ack-file schema (Ajv, same pattern as plan schema)
  internal-validators.ts           # MODIFY (S1): compile + export validateAckFileShape
  ecosystem-npm.ts + .test.ts      # CREATE (S2): npm EcosystemAdapter (alias/scoped/workspace/repo forms)
  multi-tenant-hosts.json          # CREATE (S2): DN#6 Option-C data file
  tier1.test.ts                    # CREATE (S2): S2 paired negatives + AC 2 + AC 3 E2E
  types.ts                         # MODIFY (S2): Provenance.packageName?/finalUrl?; ResearchEntry.package?
  research-plan.schema.json        # MODIFY (S2): same fields, same commit as types + fixtures
  validate-plan.ts                 # MODIFY (S2, DN#7-A): optional resolveCtx? param
  research-adapter-anthropic.ts    # MODIFY (S2): per-target entry.package stamping (M4 seam)
  fixtures/tier1-single-root/      # CREATE (S2): AC 3 stub fixture (checked-in node_modules stub)
packages/core/synthesizer/
  cli.ts + file-clients.ts         # MODIFY (S2, DN#7-A): thread resolveCtx
packages/core/principles/
  09-doc-authority-hierarchy.ts    # MODIFY (S3): REQUIRED_HEADER_DOCS += rule path
  09-doc-authority-hierarchy.test.ts # MODIFY (S3): sentinel 84 → 85 (re-read current value at ship)
  30-research-source-trust.test.ts # CREATE (S3): dedicated Class-A principle test (slot ≥30, confirm at ship)
.claude/rules/research-source-trust.md   # CREATE (S3): discipline rule (Class A)
agents/rule-researcher.md          # MODIFY (S2 protocol bits; S3 tiers table)
.claude/skills/rule-research/SKILL.md    # MODIFY (S3): pointer to tiers
docs/meta-factory/architecture.md  # MODIFY (S3): §2.4 note
docs/meta-factory/prior-art-evaluations.md # MODIFY (S1, S2): new SSOT entries (next free IDs — #186+ as of 2026-07-02, confirm at ship)
.gitignore                         # MODIFY (S2): un-ignore fixture node_modules stub
```

---

## Stage S1 — resolver port + Tier 2 (PR 1)

**Capability commit:** YES (`allowlist-resolver.ts` ≥80 LOC under `packages/`). Commit trailers (one line each, per CLAUDE.md syntax):

```text
Prior-art: prior-art-evaluations.md#186 (cargo-vet audits.toml, ADAPT — committed human-acked trust records map onto .ai-factory/research-allowlist.json).
Prior-art: prior-art-evaluations.md#187 (TUF targets-delegation, ADOPT-VOCABULARY — tier/delegation naming; terminating delegation ≙ explicit subdomain restricts).
```

The two SSOT rows land **in the same commit** as the resolver (per CLAUDE.md build-vs-reuse invariant; verdicts + rationale + trigger-to-revisit; kickoff §3 rows 5 and 4 are the content source). IDs #186/#187 assume SSOT max = #185 (2026-07-02) — confirm at ship.

### Task 1.1: Invariant helpers (canonicalize / registrable / punycode)

**Files:**
- Create: `packages/core/research/allowlist-resolver.ts`
- Test: `packages/core/research/allowlist-resolver.test.ts`

**Interfaces (Produces):**

```ts
export function canonicalizeHost(host: string): string;          // lowercase, strip one trailing dot
export function isIpLiteral(host: string): boolean;              // bare IPv4 OR bracketed IPv6 "[::1]"
export function hasPunycodeLabel(host: string): boolean;         // any DNS label starts with "xn--"
export function hostMatches(host: string, allowed: readonly string[]): boolean; // === or endsWith("."+a)
```

- [ ] **Step 1: Write failing helper tests**

```ts
// packages/core/research/allowlist-resolver.test.ts
import { describe, it, expect } from 'vitest';
import {
  canonicalizeHost, isIpLiteral, hasPunycodeLabel, hostMatches,
} from './allowlist-resolver.ts';

describe('host invariant helpers', () => {
  it('canonicalizes; rejects IP literals (bare IPv4 + bracketed IPv6)', () => {
    expect(canonicalizeHost('NextJS.org.')).toBe('nextjs.org');
    expect(isIpLiteral('127.0.0.1')).toBe(true);
    expect(isIpLiteral('[::1]')).toBe(true);      // URL.hostname keeps brackets
    expect(isIpLiteral('nextjs.org')).toBe(false);
  });
  it('detects xn-- per DNS label (URL.hostname is already ASCII)', () => {
    expect(hasPunycodeLabel('docs.xn--caf-dma.com')).toBe(true);
    expect(hasPunycodeLabel('nextjs.org')).toBe(false);
  });
  it('matches bare domain inclusive of subdomains, segment-safe', () => {
    expect(hostMatches('docs.nextjs.org', ['nextjs.org'])).toBe(true);
    expect(hostMatches('evilnextjs.org', ['nextjs.org'])).toBe(false); // no substring match
  });
});
```

- [ ] **Step 2: Run to verify RED** — `npx vitest run packages/core/research/allowlist-resolver.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement helpers**

```ts
// packages/core/research/allowlist-resolver.ts (top of new file)
export function canonicalizeHost(host: string): string {
  const lower = host.toLowerCase();
  return lower.endsWith('.') ? lower.slice(0, -1) : lower;
}
export function isIpLiteral(host: string): boolean {
  if (host.startsWith('[') && host.endsWith(']')) return true;         // IPv6 per URL.hostname
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);                          // bare IPv4
}
export function hasPunycodeLabel(host: string): boolean {
  return host.split('.').some((label) => label.startsWith('xn--'));
}
export function hostMatches(host: string, allowed: readonly string[]): boolean {
  return allowed.some((a) => host === a || host.endsWith(`.${a}`));
}
```

- [ ] **Step 4: Run to verify GREEN.**
- [ ] **Step 5: Commit** — `git add packages/core/research/allowlist-resolver.{ts,test.ts} && git commit -m "feat(research): host invariant helpers for tiered allowlist resolver"`. (The PR-level squash commit MUST carry the stage-header `Prior-art:` trailers.)

### Task 1.2: Tier-2 ack-file schema + parser (fail-closed)

**Files:**
- Create: `packages/core/research/research-allowlist.schema.json`
- Modify: `packages/core/research/internal-validators.ts` (add second compiled validator, same Ajv instance pattern as `research-plan.schema.json`)
- Modify: `packages/core/research/allowlist-resolver.ts`
- Test: `packages/core/research/allowlist-resolver.test.ts`

**Interfaces (Produces):**

```ts
export interface AckEntry {
  key: string;            // enters the allowlistKey namespace
  hosts: string[];        // registrable, canonicalized at load
  scope?: string;         // optional package scope-lock (checked in S2 against entryPackage)
  reason: string;
  ackedBy: string;
  ackedAt: string;        // ISO 8601 calendar date (YYYY-MM-DD, optional time suffix)
}
export class AckFileError extends Error {}   // thrown on ANY malformed entry — fail-closed and loud
export function loadAckFile(path: string): Map<string, AckEntry>;  // key → entry; missing file ⇒ empty Map
```

- [ ] **Step 1: Write failing tests — paired negatives S1-N2, S1-N3 (RED first)**

```ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAckFile, AckFileError } from './allowlist-resolver.ts';

function ackFile(entries: unknown[]): string {
  const p = join(mkdtempSync(join(tmpdir(), 'ack-')), 'research-allowlist.json');
  writeFileSync(p, JSON.stringify({ entries }, null, 2));
  return p;
}
const GOOD = { key: 'drizzle.docs', hosts: ['orm.drizzle.team'],
  reason: 'ORM docs for researched practices', ackedBy: 'art', ackedAt: '2026-07-02' };

describe('Tier-2 ack file — fail-closed parsing', () => {
  it('S1-N2: entry WITHOUT ack fields fails', () => {
    const { ackedBy: _drop, ...noAck } = GOOD;
    expect(() => loadAckFile(ackFile([noAck]))).toThrow(AckFileError);
  });
  it('S1-N3: malformed ackedAt date fails', () => {
    expect(() => loadAckFile(ackFile([{ ...GOOD, ackedAt: 'yesterday' }]))).toThrow(AckFileError);
    expect(() => loadAckFile(ackFile([{ ...GOOD, ackedAt: '2026-13-45' }]))).toThrow(AckFileError);
  });
  it('positive control: a well-formed ack loads', () => {
    expect(loadAckFile(ackFile([GOOD])).get('drizzle.docs')?.hosts).toEqual(['orm.drizzle.team']);
  });
});
```

Also test: missing file ⇒ empty Map (fail-closed default, not an error); duplicate `key` ⇒ `AckFileError`.

- [ ] **Step 2: Run to verify RED.**
- [ ] **Step 3: Implement schema + parser**

`research-allowlist.schema.json` (schema `description` field should note: cargo-vet-shaped committed ack records; a punycode `xn--` host listed here is a deliberate explicit ack):

```json
{ "$schema": "http://json-schema.org/draft-07/schema#", "title": "ResearchAllowlist",
  "type": "object", "additionalProperties": false, "required": ["entries"],
  "properties": { "entries": { "type": "array", "items": {
    "type": "object", "additionalProperties": false,
    "required": ["key", "hosts", "reason", "ackedBy", "ackedAt"],
    "properties": {
      "key":    { "type": "string", "minLength": 1 },
      "hosts":  { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
      "scope":  { "type": "string" },
      "reason": { "type": "string", "minLength": 1 },
      "ackedBy":{ "type": "string", "minLength": 1 },
      "ackedAt":{ "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}(T.*)?$" }
    } } } } }
```

Parser in `allowlist-resolver.ts`: read file (ENOENT → empty Map), `JSON.parse`, run `validateAckFileShape` (new export from `internal-validators.ts`, compiled from the schema above via the existing Ajv instance), then per entry: `Date.parse(ackedAt)` must be finite (schema pattern alone accepts 2026-13-45); canonicalize each host; reject IP literals (`AckFileError`). Punycode hosts are **kept** — listing one IS the explicit Tier-2 ack (kickoff §4 carve-out). Duplicate `key` → `AckFileError`.

- [ ] **Step 4: Run to verify GREEN.**
- [ ] **Step 5: Commit** — `git commit -m "feat(research): Tier-2 ack-file schema + fail-closed parser"`.

### Task 1.3: `resolveAllowedSources(ctx)` + two-arg `validateProvenance`

**Files:**
- Modify: `packages/core/research/allowlist-resolver.ts`
- Test: `packages/core/research/allowlist-resolver.test.ts`

**Interfaces (Produces — S2 and DN#7 threading rely on these exact names):**

```ts
import { ALLOWED_SOURCES } from './allowlist.ts';
import type { Provenance } from './types.ts';
import type { ProvenanceValidation } from './allowlist.ts';

export interface EcosystemAdapter {
  readonly ecosystem: string;                                  // 'npm' first; 'cargo'/'pip'/... in S4
  listDirectDeps(root: string): Set<string>;
  readInstalledMeta(root: string, pkg: string): InstalledMeta | null;
}
export interface InstalledMeta {
  homepage?: string;
  repository?: string | { type?: string; url?: string };
}
export interface ResolveCtx {
  root: string;                 // consumer root: the directory containing the consumer package.json
  adapter?: EcosystemAdapter;   // default set in S2 (npmAdapter); S1: Tier-1 always misses
  ackFilePath?: string;         // default: join(root, '.ai-factory', 'research-allowlist.json')
}
export type Tier1Result =
  | { ok: true; hosts: readonly string[] }
  | { ok: false; reason: string };
export interface ResolvedSources {
  tier0: Readonly<Record<string, readonly string[]>>;
  tier2: ReadonlyMap<string, AckEntry>;
  tier1For(packageName: string): Tier1Result;    // S1 stub: always { ok:false, reason:'…no ecosystem adapter…' }
}
export function resolveAllowedSources(ctx?: ResolveCtx): ResolvedSources;
export function validateProvenance(
  p: Provenance,
  resolved: ResolvedSources,
  opts?: { entryPackage?: string },              // scope-lock left side; used by Tier-1 (S2) + Tier-2 scope
): ProvenanceValidation;
```

Tier evaluation order inside the two-arg `validateProvenance` (kickoff §4 "first match wins"):

1. Parse URL (malformed → fail); `https:` only; `canonicalizeHost`; `isIpLiteral` → fail.
2. **Tier 0:** `p.allowlistKey in resolved.tier0` → `hostMatches` builtin hosts; `hasPunycodeLabel` → fail. Match ⇒ ok.
3. **Tier 1:** only when BOTH `p.packageName` (S2 field) and `opts?.entryPackage` present: unequal ⇒ fail `cross-package provenance: …` (T-RTT-A); else `resolved.tier1For(p.packageName)` — grant ⇒ `hostMatches` (+ punycode fail); miss ⇒ carry the reason to step 5.
4. **Tier 2:** `resolved.tier2.get(p.allowlistKey)` → `entry.scope` set AND `opts?.entryPackage !== entry.scope` ⇒ fail; `hostMatches` acked hosts. A punycode URL host passes ONLY via an acked host that itself carries the `xn--` label (explicit-ack carve-out; strict — an `xn--` subdomain of a non-punycode acked host is rejected).
5. Fail with the most specific reason: Tier-1 miss (AC 3's class: `` host not authorized: `<pkg>` is not a direct dependency ``), else `unknown allowlistKey: <key>`, else host-mismatch.

- [ ] **Step 1: Write failing tests — S1-N1, S1-N4, S1-N5 + carve-out + positive (RED first)**

```ts
import { resolveAllowedSources, validateProvenance } from './allowlist-resolver.ts';

const PROV = (over: Partial<Provenance> & { url: string; allowlistKey: string }) =>
  ({ fetchedAt: '2026-07-02T00:00:00Z', ...over }) as Provenance;

describe('validateProvenance(p, resolved) — S1 tiers 0+2', () => {
  const resolvedEmpty = resolveAllowedSources();          // no ctx: tier0 only, tier2 empty
  it('S1-N1: unknown key still fails', () => {
    const v = validateProvenance(PROV({ url: 'https://orm.drizzle.team/docs', allowlistKey: 'drizzle.docs' }), resolvedEmpty);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/unknown allowlistKey/);
  });
  it('S1-N4: http:// fails even for a known key', () => {
    const v = validateProvenance(PROV({ url: 'http://nextjs.org/docs', allowlistKey: 'next.official' }), resolvedEmpty);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/non-https/);
  });

  // with an ack file (use Task 1.2 ackFile() helper via ResolveCtx)
  const ctxWith = (entries: unknown[]) =>
    resolveAllowedSources({ root: '/tmp/unused', ackFilePath: ackFile(entries) });
  it('S1-N5: xn-- host fails outside an explicit Tier-2 ack', () => {
    const resolved = ctxWith([GOOD]);   // GOOD acks orm.drizzle.team only
    const v = validateProvenance(PROV({ url: 'https://xn--caf-dma.com/x', allowlistKey: 'drizzle.docs' }), resolved);
    expect(v.ok).toBe(false);
  });
  it('carve-out: an explicitly-acked punycode host passes (kickoff §4)', () => {
    const resolved = ctxWith([{ ...GOOD, key: 'idn.docs', hosts: ['xn--caf-dma.com'] }]);
    const v = validateProvenance(PROV({ url: 'https://xn--caf-dma.com/x', allowlistKey: 'idn.docs' }), resolved);
    expect(v.ok).toBe(true);
  });
  it('positive control: well-formed ack authorizes its key + host', () => {
    const v = validateProvenance(PROV({ url: 'https://orm.drizzle.team/docs/rls', allowlistKey: 'drizzle.docs' }), ctxWith([GOOD]));
    expect(v.ok).toBe(true);
  });
});
```

Also test: Tier-0 regression (builtin key + `https://nextjs.org/docs` passes through the new path).

- [ ] **Step 2: Run to verify RED** (missing exports / wrong behavior).
- [ ] **Step 3: Implement `resolveAllowedSources` + two-arg `validateProvenance`** per the tier-order spec above. `tier0` is the existing `ALLOWED_SOURCES` object (imported, not copied). S1 `tier1For` stub returns `{ ok: false, reason: 'Tier-1 unavailable: no ecosystem adapter wired (S2)' }`.
- [ ] **Step 4: Run to verify GREEN.**
- [ ] **Step 5: Commit** — `git commit -m "feat(research): tiered resolveAllowedSources + two-arg validateProvenance (Tier 0 + Tier 2)"`.

### Task 1.4: Back-compat one-arg wrapper (zero behavior change)

**Files:**
- Modify: `packages/core/research/allowlist.ts` (keep `ALLOWED_SOURCES`, `AllowlistKey`, `ProvenanceValidation` exports; reimplement the one-arg `validateProvenance(p)` as a delegation to the resolver with a Tier-0-only `ResolvedSources`)
- Test: existing `packages/core/research/allowlist.test.ts` must stay **untouched** and green (kickoff AC 4).

- [ ] **Step 1: Run the existing suite first** — `npx vitest run packages/core/research/` → GREEN baseline.
- [ ] **Step 2: Reimplement the wrapper**

```ts
// allowlist.ts — body of the existing export replaced; signature and semantics identical
import { resolveAllowedSources, validateProvenance as validateWith } from './allowlist-resolver.ts';
const TIER0_ONLY = resolveAllowedSources();   // module-scope: pure of ALLOWED_SOURCES, no fs read
export function validateProvenance(p: Provenance): ProvenanceValidation {
  return validateWith(p, TIER0_ONLY);
}
```

Note: `resolveAllowedSources()` with no ctx must therefore do **zero fs access** (empty tier2) — keep that property; it is what makes the wrapper safe for the three untouched callers (`load.ts:43`, `validate-plan.ts:29`, `research-adapter-anthropic.ts:212`). DN #2 resolved: no in-session auto-ack path in code — the agent may draft entries (Task 2.5 protocol), activation = human-merged PR.
Watch one seam: `validateWith` must reproduce the current reason strings for Tier-0 misses (`unknown allowlistKey: …`, `non-https URL: …`, `malformed URL: …`, `host … not allowed under key …`) — `research-adapter-anthropic.ts` and install-layer guidance print them; grep before renaming any wording: `git grep -n 'unknown allowlistKey\|not allowed under key' packages/`.

- [ ] **Step 3: Run the FULL research + synthesizer suites** — `npx vitest run packages/core/research/ packages/core/synthesizer/` → GREEN, zero test edits.
- [ ] **Step 4: Commit** — `git commit -m "refactor(research): one-arg validateProvenance delegates to resolver (Tier-0-only, zero behavior change)"`.

### Task 1.5: SSOT entries + PR

- [ ] Append SSOT rows **#186 (cargo-vet, ADAPT)** and **#187 (TUF, ADOPT-VOCABULARY)** to `docs/meta-factory/prior-art-evaluations.md` (append-only; content source = kickoff §3 rows 5/4 + the cargo-vet human-in-the-loop quote from the mozilla book Commands page; Verdict + Rationale + Trigger-to-revisit per row; confirm free IDs at ship).
- [ ] Run `npm --prefix packages/core run test:principles` → GREEN.
- [ ] Open PR 1 onto `staging`: title `feat(research): tiered allowlist resolver — S1 resolver port + Tier 2`. PR body carries the §1.7 Forward/Backward block (Forward: no-paid-llm-in-ci — resolver is deterministic, zero API calls; build-first-reuse-default — ADAPT cargo-vet/TUF per SSOT #186/#187; dual-implementation §2(iv) — TS package capability, no hook surface. Backward: codifies kickoff §4 Tier-0/2; supersedes nothing; AC 4 zero-behavior-change evidenced by untouched-green `allowlist.test.ts`). Squash commit message carries both `Prior-art:` trailers.

## Stage S2 — Tier 1 derivation (npm) + scope-lock + taint banner (PR 2)

**Capability commit:** YES (`ecosystem-npm.ts` new file; `multi-tenant-hosts.json` data). Trailer:

```text
Prior-art: prior-art-evaluations.md#188 (registry/installed-package metadata as trust source, ADAPT — author-controlled + unverified per npm docs; phishing-homepage abuse campaigns Dec-2025/May-2026; bounded by same-package scope-lock + multi-tenant ineligibility).
```

SSOT row #188 lands in the same commit (kickoff §3 rows 1–3 are the content source).

**Blocked on:** maintainer answers to **DN #6** (Task 2.3) and **DN #7** (Task 2.6). Everything else can proceed under the leads with tasks marked.

### Task 2.1: Types + schema fields (same commit as first fixture use)

**Files:**
- Modify: `packages/core/research/types.ts`
- Modify: `packages/core/research/research-plan.schema.json`

**Interfaces (Produces):**

```ts
export interface Provenance {
  url: string;
  allowlistKey: string;   // unchanged, required. Tier-1 convention: set it to the package name
  fetchedAt: string;      // (not a Tier-0 key; routing falls through to Tier 1/2).
  packageName?: string;   // NEW (S2): Tier-1 scope-lock right-hand side
  finalUrl?: string;      // NEW (S2): post-redirect URL — agent-protocol obligation, NOT validator-
}                         // verified (kickoff §4); when present it must pass the same tier (checked).
export interface ResearchEntry {
  /* existing fields unchanged */
  package?: string;       // NEW (S2): trusted scope-lock left side; required for Tier-1 authorization,
}                         // absent on Tier-0 curated entries (T15 back-compat with the 9 store JSONs)
```

Schema diff (`research-plan.schema.json`): add the three properties as optional `{"type":"string"}` under `definitions.Provenance.properties` / `definitions.ResearchEntry.properties`. `required` arrays and `additionalProperties:false` unchanged. **Back-compat proof:** all 9 committed store JSONs lack the new fields — optional-under-`additionalProperties:false` means they keep validating byte-for-byte (kickoff AC 4); the schema+types+any fixture using the fields land in ONE commit (kickoff S2 ordering constraint).

- [ ] **Step 1 (RED):** add a schema round-trip test in `tier1.test.ts`: a plan with `package` + `packageName` + `finalUrl` fails `validateResearchPlanShape` **before** the schema edit (unknown property under `additionalProperties:false`).
- [ ] **Step 2:** apply type + schema diffs. Test flips GREEN. Also assert an existing store JSON (e.g. `store/next/16.x/nextjs-app-router.json`) still validates (load it through `validateEntry`).
- [ ] **Step 3: Commit** — `git commit -m "feat(research): optional package/packageName/finalUrl fields (types + schema, back-compat)"`.

### Task 2.2: npm EcosystemAdapter

**Files:**
- Create: `packages/core/research/ecosystem-npm.ts`
- Test: `packages/core/research/ecosystem-npm.test.ts`

**Interfaces (Produces):**

```ts
import type { EcosystemAdapter, InstalledMeta } from './allowlist-resolver.ts';
export const npmAdapter: EcosystemAdapter;   // { ecosystem: 'npm', listDirectDeps, readInstalledMeta }
export function extractHttpsHost(repoOrHomepage: InstalledMeta['repository'] | string | undefined): string | null;
```

Behavior spec (all local fs, zero network — DN #1 resolved: metadata-alone; DN #3 resolved: exact-host):

- `listDirectDeps(root)`: keys of `dependencies` ∪ `devDependencies` from `<root>/package.json`, kept only when `<root>/node_modules/<key>/package.json` exists (scoped names resolve to `node_modules/@scope/name/package.json`). npm alias values (`"x": "npm:real@1"`) resolve by KEY (`node_modules/x/package.json` — npm installs the real package under the alias dir). Workspace-linked packages: `node_modules/<name>` is a symlink — `existsSync` + `readFileSync` follow it; use the linked `package.json` (kickoff §4 edge cases).
- `readInstalledMeta(root, pkg)`: parse `homepage` + `repository` from the installed `package.json`; missing file → `null`.
- `extractHttpsHost`: `https://…` URL → canonicalized host; `git+https://…` → strip `git+`; `{type,url}` object → recurse on `url`; `org/repo` shorthand, `git@…`, `git://…`, bare names → `null` (no https host extractable ⇒ contributes nothing, kickoff §4).

- [ ] **Step 1 (RED):** unit tests over a `mkdtempSync` fixture tree: direct dep listed; devDep listed; transitive-only (present in `node_modules`, absent from `package.json`) NOT listed; scoped dep resolves; alias resolves by key; `extractHttpsHost` table-test for the five repository forms.
- [ ] **Step 2:** implement; GREEN.
- [ ] **Step 3: Commit** — `git commit -m "feat(research): npm ecosystem adapter — direct deps + installed metadata (offline)"`.

### Task 2.3: Multi-tenant host list + Tier-1 derivation *(DN #6 resolved: A-via-C)*

**Files:**
- Create: `packages/core/research/multi-tenant-hosts.json`
- Modify: `packages/core/research/allowlist-resolver.ts` (real `tier1For`)
- Test: `packages/core/research/tier1.test.ts`

`multi-tenant-hosts.json` (initial content — data file, refreshable without code change; matching rule: `host === entry || host.endsWith('.'+entry)`):

```json
{ "hosts": ["github.com", "gitlab.com", "bitbucket.org", "codeberg.org", "sourceforge.net",
  "github.io", "gitlab.io", "readthedocs.io", "readthedocs.org", "gitbook.io", "vercel.app",
  "netlify.app", "pages.dev", "surge.sh", "herokuapp.com", "web.app", "firebaseapp.com",
  "azurewebsites.net", "workers.dev", "npmjs.com", "npmjs.org", "jsdelivr.net", "unpkg.com",
  "medium.com", "notion.site", "hashnode.dev", "dev.to"] }
```

`tier1For(pkg)` spec: `pkg ∈ adapter.listDirectDeps(root)` else miss `` host not authorized: `<pkg>` is not a direct dependency `` (the AC 3 reason class — exact string, the E2E asserts it); read meta; for each of homepage/repository → `extractHttpsHost` → skip if null; skip if `hasPunycodeLabel` or `isIpLiteral`; keep the **exact canonicalized host — no registrable-domain collapse** (DN #3 resolved: Option D; subdomain-inclusive `hostMatches` already covers `docs.<host>` pages); skip if the host equals or falls under a multi-tenant apex (`host === entry || host.endsWith('.'+entry)`, H2/DN #6 — this also catches a metadata host that IS a shared apex); collect. Empty set ⇒ miss `` no Tier-1-eligible host in <pkg> metadata (multi-tenant or non-https) ``.

- [ ] **Step 1 (RED, kickoff S2 paired negatives — write ALL seven, observe each RED before its fix):**

```ts
// tier1.test.ts — fixture builder: makeConsumerRoot({ deps, nodeModules }) → tmp dir
it('S2-N1: dep-absent package derives nothing', () => {
  const r = resolveAllowedSources({ root: rootWithout('drizzle-orm'), adapter: npmAdapter });
  expect(r.tier1For('drizzle-orm')).toMatchObject({ ok: false, reason: expect.stringContaining('not a direct dependency') });
});
it('S2-N2: transitive-only dep derives nothing', () => { /* in node_modules, NOT in package.json deps */ });
it('S2-N3: multi-tenant homepage yields no Tier-1 host (github.com AND foo.github.io)', () => { /* both variants */ });
it('S2-N4: repository without extractable https host yields nothing (org/repo shorthand; git@ URL)', () => {});
it('S2-N5: cross-package provenance fails (T-RTT-A)', () => {
  const v = validateProvenance(
    PROV({ url: 'https://evil.example/docs', allowlistKey: 'react', packageName: 'evil-pkg' }),
    resolved, { entryPackage: 'react' });
  expect(v.ok).toBe(false);
  expect(v.reason).toMatch(/cross-package/);
});
it('S2-N6: xn-- (IDN) homepage host derives nothing', () => {});
it('S2-N7: IP-literal homepage host derives nothing (127.0.0.1 AND [::1])', () => {});
it('positive control: single-tenant homepage authorizes ONLY its own package', () => {
  // https://orm.drizzle.team → hosts ['orm.drizzle.team'] (exact, DN#3-D); passes for entryPackage 'drizzle-orm', fails for 'hono'
});
```

- [ ] **Step 2:** implement `tier1For` + wire Tier-1 branch in `validateProvenance` (order per Task 1.3 spec). GREEN.
- [ ] **Step 3 (AC 2, T-RTT-B falsifier):**

```ts
it('AC 2: Tier-1 resolution never egresses and is byte-deterministic', () => {
  const saved = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error('egress attempt at validate time'); }) as typeof fetch;
  try {
    const a = JSON.stringify(resolveAllowedSources(ctx).tier1For('drizzle-orm'));
    const b = JSON.stringify(resolveAllowedSources(ctx).tier1For('drizzle-orm'));
    expect(a).toBe(b);
    expect(JSON.parse(a).ok).toBe(true);
  } finally { globalThis.fetch = saved; }
});
```

- [ ] **Step 4: Commit** — `git commit -m "feat(research): Tier-1 derivation from local npm metadata — scope-locked, multi-tenant-ineligible (DN#6 lead A-via-C)"`.

### Task 2.4: AC 3 E2E fixture (checked-in stub `node_modules`)

**Files:**
- Create: `packages/core/research/fixtures/tier1-single-root/package.json` (`{"dependencies":{"drizzle-orm":"^0.40.0"}}`)
- Create: `packages/core/research/fixtures/tier1-single-root/node_modules/drizzle-orm/package.json` (`{"name":"drizzle-orm","version":"0.40.0","homepage":"https://orm.drizzle.team"}`)
- Create: `packages/core/research/fixtures/tier1-single-root/research-plan.json` (one entry, `package:"drizzle-orm"`, provenance `allowlistKey:"drizzle-orm"`, `packageName:"drizzle-orm"`, url `https://orm.drizzle.team/docs/rls`)
- Modify: `.gitignore` — add `!packages/core/research/fixtures/**/node_modules/` (a stub `node_modules` is normally ignored; without the negation the fixture silently never lands — verify with `git status` after `git add`)
- Test: `packages/core/research/tier1.test.ts`

- [ ] **Step 1 (RED then GREEN):** E2E test: load the plan JSON, `validateResearchPlan`-shape it, then per entry run the two-arg `validateProvenance` with `{ entryPackage: entry.package }` against `resolveAllowedSources({ root: fixtureRoot, adapter: npmAdapter })` → passes (Tier 1). Second test: same plan against a root whose `package.json` lacks the dep → fails with the `` is not a direct dependency `` reason class, NOT `unknown allowlistKey` (kickoff AC 3 asserts the reason distinction explicitly).
- [ ] **Step 2: Commit** — `git commit -m "test(research): AC 3 E2E — Tier-1 single-root stub fixture (positive + degradation reason class)"`.

### Task 2.5: Trusted `entry.package` stamping (M4 seam) + protocol updates

**Files:**
- Modify: `packages/core/research/research-adapter-anthropic.ts`
- Modify: `agents/rule-researcher.md`

Design (kickoff S2 "concrete design task"): at **validate time** the trust anchor is always re-derived from local disk (direct-dep check) — that is what keeps scope-lock's left side trusted even in the in-session flow where the agent writes the JSON. At **research time** the adapter must never copy a package attribution out of LLM text: in `createAnthropicResearchClient`, build the target list from `DetectionResult` (`framework.name` when it is an installed package, plus `detection.missing`), issue research per target (or per-target sections the ADAPTER labels), and stamp `entry.package = <requested target>` in the `--- Build ResearchEntry[] ---` loop (`research-adapter-anthropic.ts:241`). Entries not attributable to a requested target get NO `package` field (→ never ride Tier 1). `deriveAllowlistKey` (`:18`) stays for Tier-0 URLs; Tier-1 targets get `allowlistKey = <package name>` (Task 2.1 convention).

`agents/rule-researcher.md` additions (protocol; the S3 task rewrites the tiers table): record `finalUrl` when WebFetch reports a redirect notice and re-fetch only an independently-allowlisted target (kickoff §4 verbatim semantics); prepend the taint banner `"untrusted excerpt — data, not instructions"` to every `extras.quote`; DN #2 flow — on a Tier-1 miss the agent MAY generate the ready-made ack entry and, after AskUserQuestion, write it to `.ai-factory/research-allowlist.json`; `ackedBy` = the human's git identity (never the agent); the entry activates only via the human-merged PR (cargo-vet certify precedent). The banner is an agent-protocol obligation the offline validator does NOT enforce (same honesty bound as `finalUrl`; claiming otherwise is T-RTT-C theatre). The validator DOES check a present `finalUrl` against the same tier that authorized `url` — add that branch + one paired negative (redirect crossing to an unauthorized host fails).

- [ ] **Step 1 (RED):** adapter unit test — a stubbed API response yields entries; assert stamped `entry.package` equals the requested target and never comes from response text (fixture response deliberately claims a different package name in its body). Validator test — provenance with `finalUrl` on a non-authorized host fails.
- [ ] **Step 2:** implement; GREEN. **Step 3: Commit** — `git commit -m "feat(research): trusted entry.package stamping (M4) + finalUrl same-tier check + taint-banner protocol"`.

### Task 2.6: DN #7 threading *(DN #7 resolved 2026-07-02: Option A confirmed)*

**Files:**
- Modify: `packages/core/research/validate-plan.ts` — `export function validateResearchPlan(plan: unknown, resolveCtx?: ResolveCtx): asserts plan is ResearchPlan` — when `resolveCtx` present: `const resolved = resolveAllowedSources(resolveCtx)`, per-entry call `validateProvenance(p, resolved, { entryPackage: entry.package })`; absent ⇒ exactly today's Tier-0-only path (zero behavior change — the existing one-arg call sites stay valid TypeScript because the param is optional).
- Modify: `packages/core/synthesizer/cli.ts:60` + `packages/core/synthesizer/file-clients.ts:41` — thread a ctx: consumer root = existing consumer-root/cwd notion those call paths already hold (`--from-research` runs against a consumer project; use its project root, NOT `packages/core`); if no root is derivable, pass nothing (Tier-0-only, fail-closed).
- Test: `packages/core/research/validate-plan.test.ts` (or extend `tier1.test.ts`): (a) no-ctx call on the AC 3 plan → old behavior (fails, Tier-0-only); (b) ctx call → Tier-1 passes.

- [ ] Steps: RED test → implement → GREEN → run the FULL suite `npx vitest run packages/core/` → commit `git commit -m "feat(research): optional resolveCtx threading to external validator (DN#7 Option A)"`.

### Task 2.7: SSOT #188 + PR 2

- [ ] SSOT row #188 (registry-metadata ADAPT, abuse-evidence citation per kickoff §3 row 1; include round-2 citations — StarJacking Checkmarx 2022, Beamglea Socket 2025-10, npm-provenance repository-field verification, exact-host rationale: sleevi/psl-problems + IMC 2023 + Anthropic allowed_domains semantics) in the capability commit; squash carries the `Prior-art:` trailer above.
- [ ] Full gates: `npx vitest run packages/core/ && npm --prefix packages/core run test:principles` → GREEN. Kickoff AC 1 (all 7 S2 negatives RED-first documented in PR body), AC 2, AC 3, AC 4, AC 6 evidenced in the PR body §1.7 block.
- [ ] PR 2 onto `staging` after PR 1 merges (same-file contention, DN #4 lead).

## Stage S3 — docs + rule + dedicated principle test (PR 3)

**Capability commit:** the principle test is a test-addition for the S1/S2 capability — if the pre-push size gate fires on it, use the escape hatch trailer: `Prior-art: skipped — principle test + docs for capability shipped in S1/S2 (SSOT #186-#188), no new capability`.

### Task 3.1: `.claude/rules/research-source-trust.md`

Structure (mirror peer rules, e.g. `ci-tool-pinning.md`): Class-A header (companion = the Task 3.2 principle test) + Authoritative-for/NOT-authoritative-for + Origin (2026-07-02 dialogue + kickoff) + §1 the tier model (pointer to kickoff §4, not a copy — single source of truth per dual-implementation §7) + §2 the **§4.5 re-tightening trigger verbatim** (Path B code-gen ⇒ Tier-1 downgrades to Tier-2-ack for code-generating flows — a named trigger) + §3 anti-patterns **`#trust-by-name-not-scope`** (authorizing a host because a familiar package names it, without the same-package scope-lock — T16 shape) and **`#allowlist-as-code-not-data`** (extending trust by editing framework source instead of the Tier-2 data file — the exact pre-umbrella failure, kickoff §1) + §4 promotion/retirement (peer-rule style) + §5 §1.7 self-reflexive note. ≤600 lines. English body.

- [ ] Write the rule; run `npx vitest run packages/core/principles/22-internal-english.test.ts` → GREEN.

### Task 3.2: Dedicated principle test (slot ≥30 — confirm lowest free slot at ship; 30 as of 2026-07-02)

**Files:**
- Create: `packages/core/principles/30-research-source-trust.test.ts`

Store-wide **discipline** invariants (NOT resolver behavior — that lives in the S1/S2 suites; kickoff S3 warns against `#pattern-matching-on-name` here):

```ts
// For every committed curated store entry (packages/core/research/store/**/*.json):
//  (a) every provenance URL host passes the one-arg Tier-0 validateProvenance (fail-closed catalog);
//  (b) no provenance URL host is on multi-tenant-hosts.json (H2 never enters the curated store);
//  (c) if an entry carries `package`, its provenance entries carry a matching `packageName` (scope-lock
//      shape holds store-wide; today zero entries carry it — the check is conditional, T15 back-compat).
// Paired negative: an inline fixture entry with a github.com provenance URL must FAIL check (b)
// (proves the multi-tenant assertion is non-vacuous).
```

- [ ] RED (write test; (b) is RED until the test loads the S2 data file correctly — then GREEN against the real store: verified 2026-07-02, all 9 store files cite only nextjs.org / react.dev / tailwindcss.com) → GREEN → commit.

### Task 3.3: Principle 09 registration + docs sweep

- [ ] Append `'.claude/rules/research-source-trust.md'` to `REQUIRED_HEADER_DOCS` (`packages/core/principles/09-doc-authority-hierarchy.ts:28`).
- [ ] Bump the sentinel in `09-doc-authority-hierarchy.test.ts:93`: `toBeLessThanOrEqual(84)` → `(85)` and extend the line-92 lockstep comment (`… → 85: +research-source-trust.md, <ship date>`). **Re-read the current bound first** — 84 is the 2026-07-02 value; if it moved, bump from the current value.
- [ ] `agents/rule-researcher.md`: replace the static «Allowlist keys → hosts» table section (line ~120) with the tiers table (Tier 0 builtin keys / Tier 1 derived — direct deps, single-tenant hosts only / Tier 2 `.ai-factory/research-allowlist.json` ack); keep «extend the data, not this protocol» — it is now literally true for consumers.
- [ ] `.claude/skills/rule-research/SKILL.md`: pointer to the tiers section of the rule.
- [ ] `docs/meta-factory/architecture.md` §2.4: one paragraph — allowlist is resolver-computed (three tiers), factory still offline.
- [ ] Run: `npm --prefix packages/core run test:principles` → GREEN (09 with 85, 12, 22, 30 all green).
- [ ] Commit + PR 3 (§1.7 block; Forward: doc-authority-hierarchy §2-§3 — the new rule carries Class + header + is registered in principle 09; Backward: codifies kickoff §4/§4.5).

### Task 3.4 — DROPPED (DN #5 answered 2026-07-02: staleness marker belongs to the generate-first umbrella, not S3; mutually exclusive homes per kickoff §9)

## Stage S4 — sketch only (triggered, not scheduled)

Do NOT build now (kickoff: trigger = first non-JS consumer request, first documented injection attempt, or Path B activation). When triggered: new `ecosystem-<name>.ts` implementing `EcosystemAdapter` (the S1 seam) over `Cargo.toml`/`pyproject.toml`+dist-info/`go.mod`/`pom.xml` local snapshots — still zero-network at validate time. `packageName` gains an ecosystem-prefix convention (`npm:` implied today; `cargo:serde`) — reserve it with one line in the rule now (Task 3.1 §1), implement then. Dual-context research hardening (kickoff §3 row 9) gets its own R-phase.

## AC ↔ stage mapping (kickoff §6)

| AC | Proven by |
|---|---|
| 1 (suites green, negatives RED-first) | S1 Tasks 1.1–1.4 (5 negatives + carve-out + positive); S2 Tasks 2.3/2.5 (7 negatives + positive); each RED observed before its fix, logged in PR bodies |
| 2 (throwing-fetch determinism) | S2 Task 2.3 Step 3 (exact test shown) |
| 3 (E2E single-root fixture, new reason class) | S2 Task 2.4 (fixture layout + both assertions) |
| 4 (7 Tier-0 keys zero behavior change) | S1 Task 1.4 (untouched-green `allowlist.test.ts` + full-suite run); S2 Task 2.1 Step 2 (store JSON round-trip) |
| 5 (principles 09/22 on docs; 12 on kickoff) | S3 Task 3.3 run; kickoff 12+22 verified green 2026-07-02 (this session) |
| 6 (no new dep; exact-host, no PSL) | S2 Task 2.3 (DN#3 = Option D; code comment + rule §1 note); `package.json` diff empty of new deps |

## Self-application (T15)

- The framework's own 9 curated store JSONs pass the new resolver unchanged: they route Tier-0 by `allowlistKey`, carry no `package` field, and cite only single-tenant hosts (verified against origin/staging 2026-07-02: `nextjs.org`, `react.dev`, `tailwindcss.com`) — asserted forever by principle 30 checks (a)+(b).
- The S3 rule file itself carries the doc-authority header and is registered in principle 09 in the same PR (the rule ships enforced, not prose-only).
- The AC 2 test guards the framework's own validate path, not just consumer paths (T-RTT-B falsifier).
- This plan's paired-negative discipline applies to the principle test too (Task 3.2 inline negative fixture).

## Verification at each PR gate

```bash
npx vitest run packages/core/research/ packages/core/synthesizer/   # feature suites
npm --prefix packages/core run test:principles                      # principles incl. 09/12/22 (+30 from S3)
wc -l .claude/rules/research-source-trust.md                        # ≤600 (S3); Prior-art trailer in squash msg
```
