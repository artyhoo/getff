/**
 * Principle 33 — Adapter-jig arm registry: the meta-check SSOT over the conformance suite.
 *
 * The adapter-jig design spec (§3) defines 22 conformance arms in 8 groups with a UNIVERSAL
 * RED-provability requirement: every arm MUST ship a paired positive+negative case — an arm
 * with only green-path cases is REFUSED (ESLint RuleTester's mandatory valid+invalid pairing,
 * lifted from rule granularity to adapter-arm granularity; SSOT prior-art-evaluations.md#226
 * BUILD-with-cited-patterns, pairing pattern per #154). This module is the executable mirror
 * of the spec §3 table: a typed-const registry (`ADAPTER_JIG_ARMS`) + pure helpers consumed
 * by 33-adapter-jig-arm-registry.test.ts (the gate half — same data+test split idiom as
 * principle 31-rule-channel-declaration.{ts,test.ts}).
 *
 * What the gate asserts (see the .test.ts):
 *   1. PAIRING — every registered arm has >=1 positive AND >=1 negative case ref;
 *      a green-only arm is REFUSED (spec §3 universal RED-provability).
 *   2. REFERENCE RESOLUTION — every case ref's suite file exists AND contains its locator
 *      marker verbatim (principle-08 broken-ref idiom; a fabricated pairing is RED).
 *   3. CANONICAL IDS — registered ids/slugs/groups match the frozen §3 table; no duplicates.
 *   4. POPULATION SENTINEL — bidirectional set-equality between registry ids and `@arm:`
 *      markers discovered LIVE in the suites (packages/core/**\/*.test.ts +
 *      tests/install-sh/**\/*.test.sh): an arm marked in a suite but absent from the registry
 *      escapes the pairing meta-check (RED); a registry row with no live marker is a vacuous
 *      or lying reference (RED). Set-difference in BOTH directions — the H3
 *      `tripwire-population-equality` idiom / principle-21 drift-guard / principle-27
 *      `missingEntries` shape.
 *
 * Marker grammar (language-agnostic, grep-level — no parser needed):
 *   TS suites:   `// @arm:<id>:pos <slug>`  /  `// @arm:<id>:neg <slug>`
 *   bash suites: `# @arm:<id>:pos <slug>`   /  `# @arm:<id>:neg <slug>`
 * The registry `locator` field is the exact `@arm:<id>:<kind>` token (slug optional in the
 * suite line — the token must appear verbatim). Markers + registry row + the arm itself land
 * together, append-only, one increment at a time (J2 decisions log #3/#13).
 *
 * Note on ref targets vs the sentinel: `checkArmRefsResolve` only asserts existence +
 * verbatim-locator (so test fixtures can exercise it); the discipline that a REAL arm's
 * cases live inside SCANNED suites is carried by the population sentinel — a ref into a
 * non-suite file resolves here but REDs the sentinel (no live marker in any scanned suite).
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export type ArmGroup =
  | 'parsing'
  | 'trust'
  | 'delivery'
  | 'lock'
  | 'firing'
  | 'ci'
  | 'type-shape'
  | 'tripwire';

export interface CanonicalArm {
  readonly id: string;
  readonly group: ArmGroup;
  readonly slug: string;
}

/**
 * The frozen id-list — executable mirror of adapter-jig spec §3.1-§3.8 (22 arms, 8 groups).
 * Belt-and-suspenders vs the (stronger) registry-vs-live-suites sentinel: guards
 * registry-vs-spec drift (a silently-truncated or id-drifted registry) per the recon note.
 */
export const CANONICAL_ARMS: readonly CanonicalArm[] = [
  // §3.1 Parsing / resolution
  { id: 'A1', group: 'parsing', slug: 'no-new-throw-on-prewired-path' },
  { id: 'A2', group: 'parsing', slug: 'polyglot-precedence-pinned' },
  // §3.2 Trust
  { id: 'B1', group: 'trust', slug: 'tier1-trust-poisoned-negative' },
  { id: 'B2', group: 'trust', slug: 'value-guard-containment' },
  { id: 'B3', group: 'trust', slug: 'direct-deps-only' },
  // §3.3 Delivery cells
  { id: 'C1', group: 'delivery', slug: 'delivery-cell-matrix-complete' },
  { id: 'C2', group: 'delivery', slug: 'no-consumer-manifest-mutation' },
  { id: 'C3', group: 'delivery', slug: 'snapshot-exclusion-no-drift-mask' },
  { id: 'C4', group: 'delivery', slug: 'no-orphan-residue' },
  // §3.4 Lock integrity
  { id: 'D1', group: 'lock', slug: 'lock-never-stale-on-any-pass' },
  { id: 'D2', group: 'lock', slug: 'no-silent-fingerprint-degrade' },
  { id: 'D3', group: 'lock', slug: 'lock-schema-parity' },
  // §3.5 Firing
  { id: 'E1', group: 'firing', slug: 'scratch-consumer-red-green-pair' },
  { id: 'E2', group: 'firing', slug: 'self-check-resolves-delivered-config' },
  { id: 'E3', group: 'firing', slug: 'toolchain-freshness-vs-evidence' },
  // §3.6 CI pinning
  { id: 'P1', group: 'ci', slug: 'pinned-toolchain-in-ci' },
  // §3.7 Type-shape / wiring atomicity
  { id: 'G1', group: 'type-shape', slug: 'type-widening-exhaustiveness' },
  { id: 'G2', group: 'type-shape', slug: 'all-callsites-migrated-atomically' },
  { id: 'G3', group: 'type-shape', slug: 'zero-skill-core-edits' },
  // §3.8 Tripwire lockstep
  { id: 'H1', group: 'tripwire', slug: 'baseline-debt-lockstep' },
  { id: 'H2', group: 'tripwire', slug: 'tripwire-predicate-no-conjunctive-narrowing' },
  { id: 'H3', group: 'tripwire', slug: 'tripwire-population-equality' },
];

/** One resolvable pointer into an ACTUAL suite file (vitest .test.ts or bash .test.sh). */
export interface ArmCaseRef {
  /** Repo-relative file path of the suite carrying the case. */
  readonly suite: string;
  /** Exact `@arm:<id>:pos` | `@arm:<id>:neg` token present verbatim in that file. */
  readonly locator: string;
}

export interface ArmEntry {
  readonly id: string;
  readonly group: ArmGroup;
  readonly slug: string;
  /** >=1 GREEN-path case. */
  readonly positive: readonly ArmCaseRef[];
  /** >=1 RED-proof case (inverted assertion / violating fixture / pre-fix reproduction). */
  readonly negative: readonly ArmCaseRef[];
}

/**
 * Completeness gate flag — flipped to true by the FIN increment ONLY (J2 decisions log #3:
 * append-per-increment keeps the branch green after every commit; a count===22 assertion
 * landed upfront with zero arms would be RED from increment 1). While false, the gate asserts
 * registered ⊆ canonical; once true, it asserts set-EQUALITY with all 22 canonical ids.
 *
 * FIN (J2): flipped true — all 22 canonical arms are registered (A1-A2, B1-B3, C1-C4, D1-D3,
 * E1-E3, P1, G1-G3, H1-H3). The gate now asserts count===22 + zero unregistered canonical ids.
 */
export const REGISTRY_COMPLETE = true;

/**
 * The live arm registry. Populated APPEND-ONLY, one row per landed arm, in the same commit
 * as the arm's cases + their `@arm:` markers (spec §3 append-only; J2 decisions log #13).
 */
export const ADAPTER_JIG_ARMS: readonly ArmEntry[] = [
  // Increment A (J2). A1 landed fix+arm atomic: read-manifest.ts readPkg's unguarded
  // JSON.parse (a REAL live bug — resolveCtxForRoot threw SyntaxError on a malformed
  // package.json) wrapped try/catch→null in the same commit as the regression arm.
  {
    id: 'A1',
    group: 'parsing',
    slug: 'no-new-throw-on-prewired-path',
    positive: [
      { suite: 'packages/core/synthesizer/resolve-ctx.test.ts', locator: '@arm:A1:pos' },
    ],
    negative: [
      { suite: 'packages/core/synthesizer/resolve-ctx.test.ts', locator: '@arm:A1:neg' },
    ],
  },
  // A2 pins precedence at BOTH seams (J2 decisions log #4): detector level
  // (read-python-cargo.test.ts — package.json+Cargo and all-three combinations) AND
  // the production adapter-selection seam (resolve-ctx.test.ts polyglot fixture).
  {
    id: 'A2',
    group: 'parsing',
    slug: 'polyglot-precedence-pinned',
    positive: [
      { suite: 'packages/core/detector/read-python-cargo.test.ts', locator: '@arm:A2:pos' },
      { suite: 'packages/core/synthesizer/resolve-ctx.test.ts', locator: '@arm:A2:pos' },
    ],
    negative: [
      { suite: 'packages/core/detector/read-python-cargo.test.ts', locator: '@arm:A2:neg' },
    ],
  },
  // Increment B (J2). B1 poisoned-host FF2011 negative — retrofit gap: FF2011
  // (allowlist-resolver.ts:313) had ZERO behavioural coverage in the research
  // suite (only the diagnostics-registry shape test referenced the code). The
  // production error fires correctly (no fix needed); the arm pins it on the
  // production entrypoint seam (function-level per J2 decisions log #5, with the
  // cli.ts:70 → cli.ts:107 exit-1 wiring cited at the arm).
  {
    id: 'B1',
    group: 'trust',
    slug: 'tier1-trust-poisoned-negative',
    positive: [
      { suite: 'packages/core/synthesizer/resolve-ctx.test.ts', locator: '@arm:B1:pos' },
      // go lane (ledger A8-5): the marker pair has been live in this suite since the go
      // adapter landed; the registry never learned about it, so the pairing gate never
      // looked at it. Same arm — the adapter FEEDS raw synthesized URLs and tier1For's
      // multi-tenant reject stage decides — expressed on the go surface.
      { suite: 'packages/core/research/ecosystem-go.test.ts', locator: '@arm:B1:pos' },
    ],
    negative: [
      { suite: 'packages/core/synthesizer/resolve-ctx.test.ts', locator: '@arm:B1:neg' },
      { suite: 'packages/core/research/ecosystem-go.test.ts', locator: '@arm:B1:neg' },
    ],
  },
  // B2 aggregates the paired path-escape fixtures across ALL KNOWN path-resolving
  // surfaces: (a) the arm's ORIGIN surface (spec §3.2 B2 Origin — the W5 #1082
  // unsanitized-entryId arbitrary-write traversal): safeRenderedPath's safe-slug
  // format gate + resolved-path containment (rule-bootstrap-cli.ts), covered by
  // rule-bootstrap-practice.test.ts traversal/separator refusals + safe-slug pass
  // + the CLI-level exit-0/non-zero pair (refs appended in J2 B review round 1 —
  // the initial B row missed the origin surface); (b) the adapter realpath
  // surfaces: cargo path-override/workspace-member/vendored symlink branches +
  // python venv lib + the behavioural `../` VALUE pair; (c) the F4
  // genuinely-unknown-prefix fixture (gem: — the prior pip: fixture drifted to
  // the mismatch branch when pip became a KNOWN prefix). CENSUS ADJUDICATION
  // (J2 B review round 1): renderedRulePath (render-researched-astgrep.ts) also
  // builds `<id>.yml` paths from record entryIds, but its inputs are the
  // FRAMEWORK-committed PRACTICE_RECORDS fixtures (PR-reviewed, drift-gated)
  // writing under the committed LIVE_GEN_DIR — not consumer-authored input —
  // so it is OUT-OF-SCOPE for this consumer-trust arm; if that lane ever
  // accepts consumer-authored records, that is a surface BIRTH for the §5
  // review protocol below. HONEST POPULATION LIMIT (spec §3.2 B2, binding):
  // fixtures verify KNOWN surfaces only; a newly-born path-resolving surface is
  // caught by the §5 review protocol's trust dimension — a textual/registry
  // sentinel for surface births is a recorded gap (research-source-trust.md §5
  // item 2) and a promotion trigger, NOT a mechanism shipped by this arm.
  {
    id: 'B2',
    group: 'trust',
    slug: 'value-guard-containment',
    positive: [
      { suite: 'packages/core/research/ecosystem-cargo.test.ts', locator: '@arm:B2:pos' },
      { suite: 'packages/core/research/ecosystem-prefix-dispatch.test.ts', locator: '@arm:B2:pos' },
      { suite: 'packages/core/install/rule-bootstrap-practice.test.ts', locator: '@arm:B2:pos' },
    ],
    negative: [
      { suite: 'packages/core/research/ecosystem-cargo.test.ts', locator: '@arm:B2:neg' },
      { suite: 'packages/core/research/ecosystem-python.test.ts', locator: '@arm:B2:neg' },
      { suite: 'packages/core/research/ecosystem-prefix-dispatch.test.ts', locator: '@arm:B2:neg' },
      { suite: 'packages/core/research/ecosystem-adapter-precondition.test.ts', locator: '@arm:B2:neg' },
      { suite: 'packages/core/install/rule-bootstrap-practice.test.ts', locator: '@arm:B2:neg' },
    ],
  },
  // B3 direct-deps-only — per-family transitive-exclusion pairs across the three
  // wired lanes, with a REGISTERED positive per family (spec §3.2 B3 "Paired
  // fixture per family"): npm (tier1.test.ts S2-N2 + precondition Part B pair —
  // markers added), python (was the REAL gap — ecosystem-python.ts:219
  // listDirectDeps transitive exclusion entirely untested), cargo (the true
  // transitive-with-attacker-metadata negative (vendored-but-undeclared) paired
  // with the declared-serde-derives-Tier-1 positive — registered in J2 B review
  // round 1; it previously existed only as an untagged in-test control).
  {
    id: 'B3',
    group: 'trust',
    slug: 'direct-deps-only',
    positive: [
      { suite: 'packages/core/research/ecosystem-python.test.ts', locator: '@arm:B3:pos' },
      { suite: 'packages/core/research/ecosystem-adapter-precondition.test.ts', locator: '@arm:B3:pos' },
      { suite: 'packages/core/research/ecosystem-cargo.test.ts', locator: '@arm:B3:pos' },
      // go lane (ledger A8-5) — same arm, go's `// indirect` require-block form.
      { suite: 'packages/core/research/ecosystem-go.test.ts', locator: '@arm:B3:pos' },
    ],
    negative: [
      { suite: 'packages/core/research/ecosystem-python.test.ts', locator: '@arm:B3:neg' },
      { suite: 'packages/core/research/ecosystem-cargo.test.ts', locator: '@arm:B3:neg' },
      { suite: 'packages/core/research/tier1.test.ts', locator: '@arm:B3:neg' },
      { suite: 'packages/core/research/ecosystem-adapter-precondition.test.ts', locator: '@arm:B3:neg' },
      { suite: 'packages/core/research/ecosystem-go.test.ts', locator: '@arm:B3:neg' },
    ],
  },
  // Increment H (J2). H1+H3 co-located in ecosystem-unwired-debt.test.ts (J2
  // decisions log #10 — both arms guard the same census seam). The two census
  // regexes were extracted to packages/core/research/adapter-census.ts (single
  // source of truth) because both are now needed in BOTH consuming suites — the
  // decisions-log #10 extraction condition: the broad impl regex serves the
  // precondition suite AND the H3 equality gate; the narrow idiom regex serves
  // the unwired-debt census AND the same gate. PRIMARY retrofit finding (H3,
  // CONFIRMED live pre-extraction): the two private copies had already diverged
  // in matching breadth (narrow = typed-const idiom only; broad = 5 declaration
  // forms) — an off-idiom (satisfies-form) adapter entered the precondition
  // population yet escaped the BASELINE lockstep with zero RED (probed:
  // narrow=false, broad=true). H3 asserts population set-equality in BOTH
  // directions, turning spec §2 F5 "MUST use the idiom verbatim" into a gate.
  {
    id: 'H1',
    group: 'tripwire',
    slug: 'baseline-debt-lockstep',
    positive: [
      { suite: 'packages/core/research/ecosystem-unwired-debt.test.ts', locator: '@arm:H1:pos' },
    ],
    negative: [
      { suite: 'packages/core/research/ecosystem-unwired-debt.test.ts', locator: '@arm:H1:neg' },
    ],
  },
  // H2 fix+arm atomic: the I2 construction detector's flat-brace-group shape
  // (`[^{}]*`) was an UNDOCUMENTED structural narrowing — a nested-brace ctx
  // literal (`{ root, adapter: { ecosystem: 1 }, ackFilePath: root }`) evaded it
  // entirely (probed: flat=true, nested=false). Fixed to a token-alone union
  // predicate (key-position at any nesting depth) in the same increment as the
  // regression arm, per the arm's own no-conjunctive-narrowing principle; the
  // W2-rework corpus (adapter-less shape, `?:` declaration anti-tautology, real
  // production-literal attack) is registered as the arm's standing cases.
  {
    id: 'H2',
    group: 'tripwire',
    slug: 'tripwire-predicate-no-conjunctive-narrowing',
    positive: [
      {
        suite: 'packages/core/research/ackfilepath-plan-containment.test.ts',
        locator: '@arm:H2:pos',
      },
    ],
    negative: [
      {
        suite: 'packages/core/research/ackfilepath-plan-containment.test.ts',
        locator: '@arm:H2:neg',
      },
    ],
  },
  {
    id: 'H3',
    group: 'tripwire',
    slug: 'tripwire-population-equality',
    positive: [
      { suite: 'packages/core/research/ecosystem-unwired-debt.test.ts', locator: '@arm:H3:pos' },
    ],
    negative: [
      { suite: 'packages/core/research/ecosystem-unwired-debt.test.ts', locator: '@arm:H3:neg' },
    ],
  },
  // Increment G (J2). G1 retrofit (CREATE-the-invariant): the Stack union had
  // ZERO compiler-enumerated consumer — widening it produced no tsc error
  // anywhere (the sole production brancher, resolve-ctx.ts, ends in a bare npm
  // fallthrough BY DESIGN). The new detector/stack-exhaustiveness.test.ts
  // sentinel (assertNever idiom per grammar.ts:56) makes union-widening break
  // `tsc --noEmit`; the paired negative is a @ts-expect-error-pinned
  // incomplete switch (trybuild-style — the pairing lives at the typecheck
  // gate). RED-proven live both ways: directive removed → TS2345 at the
  // incomplete switch; union widened with 'go' → TS2345 at the sentinel.
  // Scope limit flagged: the sentinel guards type-enumeration only, NOT
  // resolve-ctx.ts's by-design npm-default routing.
  {
    id: 'G1',
    group: 'type-shape',
    slug: 'type-widening-exhaustiveness',
    positive: [
      { suite: 'packages/core/detector/stack-exhaustiveness.test.ts', locator: '@arm:G1:pos' },
    ],
    negative: [
      { suite: 'packages/core/detector/stack-exhaustiveness.test.ts', locator: '@arm:G1:neg' },
    ],
  },
  // G2 — the ADAPTER-keyed twin of the ackFilePath I2 tripwire (recon: the W2
  // «no third site» claim was protected only by the ackFilePath-keyed
  // detector, which cannot see a rogue `{ root, adapter: npmAdapter }` bypass
  // that omits ackFilePath). SCAN arm: zero hardcoded default-adapter ctx
  // literals outside the resolve-ctx.ts factory home; CENSUS arm: production
  // resolveCtxForRoot callsites set-equal to the frozen W2 pair
  // {cli.ts, file-clients.ts} (BASELINE-style both-directions prescription).
  // RED-proven live: pre-W2-style literal planted into the real cli.ts on
  // disk → SCAN flagged cli.ts AND CENSUS flagged the dropped caller.
  {
    id: 'G2',
    group: 'type-shape',
    slug: 'all-callsites-migrated-atomically',
    positive: [
      {
        suite: 'packages/core/research/ackfilepath-plan-containment.test.ts',
        locator: '@arm:G2:pos',
      },
    ],
    negative: [
      {
        suite: 'packages/core/research/ackfilepath-plan-containment.test.ts',
        locator: '@arm:G2:neg',
      },
    ],
  },
  // G3 — per-PR-diff scope guard, realized per J2 decisions log #9 as a PURE
  // prefix-set-membership check over a SUPPLIED changed-file list
  // (hooks/checks/skill-core-edit-scope.ts + GitProvider.changedFiles adapter),
  // NOT an on-disk existence check: 2 of the 3 spec-named protected surfaces
  // (.claude/skills/rule-tests/, agents/rule-test-author.md) are
  // rule-tests-surface S1 FUTURE artifacts absent from this repo by design —
  // an existence-based guard would be vacuously green for them (T15/T2). The
  // in-repo RED anchor is packages/core/ir/types.ts (exists); the absent
  // paths RED as string literals (creating them is an intersection too).
  // RED-proven live via inverted assertions on both the anchor and an
  // absent-path prefix hit.
  {
    id: 'G3',
    group: 'type-shape',
    slug: 'zero-skill-core-edits',
    positive: [
      { suite: 'packages/core/hooks/checks/skill-core-edit-scope.test.ts', locator: '@arm:G3:pos' },
    ],
    negative: [
      { suite: 'packages/core/hooks/checks/skill-core-edit-scope.test.ts', locator: '@arm:G3:neg' },
    ],
  },
  // Increment D (J2). Lock-integrity group — overwhelmingly a bring-cargo-up-to-
  // python-parity exercise (recon group D): the python lane is the mature reference
  // (11 lock arms), the cargo lane lacked BOTH a lock-degrade and a lock-schema arm.
  //
  // D1 registers the EXISTING python-rules-lock arms as the canonical cases (recon:
  // honest none-spotted — the W5 rework already made the skip guard content-aware,
  // 45-python.sh:559-567, and cargo's always-write, 46-cargo.sh, cannot go stale):
  // pos = arm 6 (true no-change re-run byte-stable), neg = arms 9 + 11 (the W3
  // --force-stale and W5 plain-pass-join-stale pre-fix reproductions — the exact
  // incidents the spec §3.4 D1 row cites). RED re-proven at registration time by
  // reverting the guard to the documented W5 flag-only state → arm 11 STALE.
  // Python-only by recon recommendation (j2.decisions.md #14): the incident class
  // lives entirely in the python join path; cargo achieves never-stale by
  // always-write (no skip guard to judge).
  {
    id: 'D1',
    group: 'lock',
    slug: 'lock-never-stale-on-any-pass',
    positive: [
      { suite: 'tests/install-sh/python-rules-lock.test.sh', locator: '@arm:D1:pos' },
    ],
    negative: [
      { suite: 'tests/install-sh/python-rules-lock.test.sh', locator: '@arm:D1:neg' },
    ],
  },
  // D2 fix+arm atomic (REAL retrofit bug, cargo lane): _cargo_write_rules_lock
  // (setup.d/46-cargo.sh) degraded SILENTLY to "sha256:unknown" — zero stderr on
  // BOTH triggers (hash-tool-absent ladder fallthrough AND delivered-clippy-absent)
  // — the exact W3 silent-degrade class the python lane fixed. Fixed in the same
  // increment: md5/md5sum fallback rungs (algorithm-prefixed so a fallback digest
  // is never mislabelled sha256) + the loud non-authoritative stderr warning on
  // both triggers, mirroring 45-python.sh. pos = python arm 4 + cargo arm 5b
  // (authoritative digest, no warning); neg = python arm 10 (W3 pre-fix repro) +
  // cargo arm 8 (both triggers + healthy-path no-noise control, RED pre-fix).
  {
    id: 'D2',
    group: 'lock',
    slug: 'no-silent-fingerprint-degrade',
    positive: [
      { suite: 'tests/install-sh/python-rules-lock.test.sh', locator: '@arm:D2:pos' },
      { suite: 'tests/install-sh/cargo-entry-lane.test.sh', locator: '@arm:D2:pos' },
    ],
    negative: [
      { suite: 'tests/install-sh/python-rules-lock.test.sh', locator: '@arm:D2:neg' },
      { suite: 'tests/install-sh/cargo-entry-lane.test.sh', locator: '@arm:D2:neg' },
    ],
  },
  // D3 fix+arm atomic (REAL retrofit bug, cargo lane): the shipped cargo lock
  // violated the frozen F11 core set — {framework, backend, emittedAt,
  // sourceFingerprint, note} was MISSING schemaVersion/version/rules (F11 froze
  // schema parity on PR-body authority alone; no checked artifact — the
  // attention-dependent gap the spec §3.4 D3 Origin flags). Fixed in the same
  // increment (writer now emits the full core set; rules=[] by contract — cargo
  // bans are clippy TOML lint config, not named rule ids; j2.decisions.md #15).
  // S1 §3 criterion 3: `rules` REPLACES the v1 `ruleIds` at schemaVersion=2.
  // The NEW cross-lane suite parses the ACTUAL emitted JSON of both lanes' scratch
  // installs (both writers are bash — TS types cannot gate them): pos = core ⊆
  // emitted for python AND cargo + extras tolerated; neg = renamed-core-field stub
  // discriminator (schemaVersion→schemaVer REDs the compare) + the pre-fix cargo
  // lock itself (RED-proven: "MISSING core field(s): schemaVersion version rules").
  {
    id: 'D3',
    group: 'lock',
    slug: 'lock-schema-parity',
    positive: [
      { suite: 'tests/install-sh/rules-lock-schema-parity.test.sh', locator: '@arm:D3:pos' },
    ],
    negative: [
      { suite: 'tests/install-sh/rules-lock-schema-parity.test.sh', locator: '@arm:D3:neg' },
    ],
  },
  // Increment E (J2). Firing group — both real retrofits are the SAME defect class the W4
  // cargo fix 32d52a37d closed (delivered-config discipline), propagated to (a) the shipped
  // F8 self-check on BOTH lanes and (b) the python resolver specifically.
  //
  // E1 fix+arm atomic (REAL retrofit bug, both lanes): the shipped install-time firing
  // self-checks (_py_firing_self_check, _cargo_firing_self_check) asserted ONLY the RED
  // direction — an over-broad/broken delivered config firing on ANY input printed
  // «enforcement is live» identically (RED-proven live: pre-fix code + an always-firing
  // config → false green on both lanes). Fixed in the same increment: paired CLEAN CONTROLS
  // (conforming code must stay quiet) + an OVER-BROAD verdict that refuses the green summary.
  // pos = entry-lane arm 6 (cargo) / arm 8 (python): clean control GREEN on a healthy install;
  // neg = arm 9 (cargo) / arm 12 (python): a planted over-broad config (bans the clean
  // control's own idiom / an $A match-everything rule) MUST be caught — green refused.
  {
    id: 'E1',
    group: 'firing',
    slug: 'scratch-consumer-red-green-pair',
    positive: [
      { suite: 'tests/install-sh/cargo-entry-lane.test.sh', locator: '@arm:E1:pos' },
      { suite: 'tests/install-sh/python-entry-lane.test.sh', locator: '@arm:E1:pos' },
    ],
    negative: [
      { suite: 'tests/install-sh/cargo-entry-lane.test.sh', locator: '@arm:E1:neg' },
      { suite: 'tests/install-sh/python-entry-lane.test.sh', locator: '@arm:E1:neg' },
    ],
  },
  // E2 fix+arm atomic (REAL latent bug, python lane — the W4 cargo finding-1 class): the
  // _ruffcfg fallback (45-python.sh) preferred the CONSUMER-owned ruff.toml over the
  // getff-owned getff-ruff.toml reference copy. Latent at HEAD (delivery always writes
  // .getff/ruff-bans.toml, the winning rung) but live on the pre-bans-file older-delivery
  // scenario the code comment anticipates: REFUSE-cell consumer config has no TID bans →
  // false SILENT (RED-proven live via the seam with the bans file absent). Fixed by swapping
  // the fallback to getff-owned-first, mirroring _cargo_delivered_clippy_path.
  // pos = cargo arms 5a/5b (existing W4 coverage, now registered) + python arm 10 (REFUSE
  // cell: fire via delivered config + lock fp hashes the delivered set, not the consumer's);
  // neg = python arm 11 (bans file absent → getff-ruff.toml must beat consumer ruff.toml).
  {
    id: 'E2',
    group: 'firing',
    slug: 'self-check-resolves-delivered-config',
    positive: [
      { suite: 'tests/install-sh/cargo-entry-lane.test.sh', locator: '@arm:E2:pos' },
      { suite: 'tests/install-sh/python-entry-lane.test.sh', locator: '@arm:E2:pos' },
    ],
    negative: [
      { suite: 'tests/install-sh/python-entry-lane.test.sh', locator: '@arm:E2:neg' },
    ],
  },
  // E3 (recon: honest none-spotted per lane — all four firing lanes already ship
  // checkToolchainFreshness with a drift paired-negative; the J2 delta is the POPULATION
  // sentinel preventing a FUTURE delivered lane from skipping the freshness gate).
  // Population by artifact presence (J2 decisions log #12): backends/<dir> with
  // firing.test.ts + capability-matrix.json. pos = the sentinel (real-tree wiring complete +
  // fixture-negative pairing inside the suite); neg = the four per-backend tagged drift
  // negatives (fabricated version drift → violation; RED-capability re-proven at
  // registration time via a live inverted assertion on the cargo suite).
  {
    id: 'E3',
    group: 'firing',
    slug: 'toolchain-freshness-vs-evidence',
    positive: [
      {
        suite: 'packages/core/backends/shared/toolchain-freshness-population.test.ts',
        locator: '@arm:E3:pos',
      },
    ],
    negative: [
      { suite: 'packages/core/backends/cargo/capability-matrix.test.ts', locator: '@arm:E3:neg' },
      { suite: 'packages/core/backends/ruff/capability-matrix.test.ts', locator: '@arm:E3:neg' },
      { suite: 'packages/core/backends/astgrep/capability-matrix.test.ts', locator: '@arm:E3:neg' },
      { suite: 'packages/core/backends/npm/capability-matrix.test.ts', locator: '@arm:E3:neg' },
      // golangci landed after E3 was registered and its drift negative went unlisted
      // (ledger A8-5) — the population sentinel could not see the omission because it
      // compared ID SETS, and E3 was present via the other four backends.
      {
        suite: 'packages/core/backends/golangci/capability-matrix.test.ts',
        locator: '@arm:E3:neg',
      },
    ],
  },
  // Increment C (J2). Delivery-cell group — bring the cargo cell matrix up to the python
  // precedent + close the two structural gaps no cell test could see (snapshot-exclusion
  // masking; orphan residue on refresh).
  //
  // C1 retrofit (REAL gap): the cargo delivery-cell matrix was materially under-tested vs
  // python-delivery.test.sh — the deny.toml REFUSE cell (iii), the getff-cargo.yml CI REFUSE
  // cell, and the idempotent re-run (cell v) had NO individual test, and cargo had no
  // copy-only-stub discriminating seam (the W4 MAJOR class lived precisely in an untested
  // REFUSE corner). pos = new arms 10/11/12 (deny REFUSE + CI REFUSE + cell-v idempotency,
  // driven through the REAL install.sh); neg = arm 13: a naive copy-only stub layer
  // (python-delivery.test.sh:24-26 PY_LAYER_UNDER_TEST precedent lifted to cargo via the
  // in-test run_cargo_delivery seam) clobbers all three REFUSE surfaces — RED-proven live
  // (the (5)/(10)/(11)/(14) positive assertions all ✗ against the stubs pre-landing).
  {
    id: 'C1',
    group: 'delivery',
    slug: 'delivery-cell-matrix-complete',
    positive: [
      { suite: 'tests/install-sh/cargo-entry-lane.test.sh', locator: '@arm:C1:pos' },
    ],
    negative: [
      { suite: 'tests/install-sh/cargo-entry-lane.test.sh', locator: '@arm:C1:neg' },
    ],
  },
  // C2 retrofit (REAL gap): ZERO assertions guarded the consumer MANIFEST (Cargo.toml)
  // byte-identity — the lane's read-only-manifest contract (46-cargo.sh:19-23, integration
  // lands only at .getff/Cargo.lints.toml) was asserted nowhere, and no --force variant of
  // any manifest-untouched check existed on either lane. pos = arm 14 (sha256 hash-compare
  // across plain install AND --force + the [lints.clippy] non-merge grep); neg = arm 15
  // (the forbidden «helpful auto-merge» stub appends [lints.clippy] into Cargo.toml — the
  // hash-compare MUST move; RED-proven live pre-landing).
  {
    id: 'C2',
    group: 'delivery',
    slug: 'no-consumer-manifest-mutation',
    positive: [
      { suite: 'tests/install-sh/cargo-entry-lane.test.sh', locator: '@arm:C2:pos' },
    ],
    negative: [
      { suite: 'tests/install-sh/cargo-entry-lane.test.sh', locator: '@arm:C2:neg' },
    ],
  },
  // C3 (recon: honest mostly-none-spotted — the live exclusions are correctly per-filename;
  // the single glob is the benign '*.tmp', now pinned by the sentinel arm). Behavioral
  // realization per J2 decisions log #7: the NEW suite extracts the REAL compute_fingerprint
  // from snapshot.sh (never a re-typed copy), proves volatile-only mutation invisible (pos),
  // one-byte deterministic-artefact drift still caught (neg), and that a deliberately
  // glob-broadened exclusion ('*/.getff/*') swallows the SAME mutation — the drift-mask C3
  // forbids, RED-proven live (assertion (2) ✗ under the broadened pipeline).
  {
    id: 'C3',
    group: 'delivery',
    slug: 'snapshot-exclusion-no-drift-mask',
    positive: [
      { suite: 'tests/install-sh/snapshot-exclusion-guard.test.sh', locator: '@arm:C3:pos' },
    ],
    negative: [
      { suite: 'tests/install-sh/snapshot-exclusion-guard.test.sh', locator: '@arm:C3:neg' },
    ],
  },
  // C4 fix+arm atomic (REAL gap): orphan residue was handled ONLY for directory-payload
  // deliveries (.getff/astgrep-rules via refresh_safe rm-rf, lib.sh #873); individually
  // delivered top-level files (deny.toml, getff-*.yml/toml, .getff/Cargo.lints.toml, …) had
  // NO sweep and NO report — a file dropped by a future template silently survived a
  // brownfield --refresh (same root cause as the #882 npm barrel prune, on lanes that test
  // never reaches; RED-proven live: pre-fix --refresh printed nothing for a planted
  // getff-header-marked stale file on BOTH lanes). Fixed in the same increment per J2
  // decisions log #8 (loud-report minimum, report-only — deletion is the irreversible
  // branch): lib.sh report_getff_orphans + refresh-path call in both lanes. pos = arm 1
  // (in-dir orphan swept) ; neg = arm 2 (copy_safe discriminator — orphan survives) + arm 3
  // (the pre-fix silent-survival reproduction, now the loud-report assertion) with arm 4 as
  // the false-positive control (clean refresh + headerless consumer file → zero reports).
  {
    id: 'C4',
    group: 'delivery',
    slug: 'no-orphan-residue',
    positive: [
      { suite: 'tests/install-sh/lane-orphan-residue.test.sh', locator: '@arm:C4:pos' },
    ],
    negative: [
      { suite: 'tests/install-sh/lane-orphan-residue.test.sh', locator: '@arm:C4:neg' },
    ],
  },
  // Increment P (J2). CI-pinning group — P1 pins the F10 TWO-SURFACE mirror invariant that the
  // per-line unpinned-tool-install gate (ci-tool-pinning.md §1 Rule A, Class A, at
  // hooks/checks/unpinned-tool-install.ts) STRUCTURALLY cannot see: that gate asserts each install
  // is pinned, never that the FRAMEWORK pin equals the CONSUMER pin. P1 adds exactly that missing
  // mirror (spec §3.6 / §2.1 F10), scoped to the getff-shipped-and-pinned tools present on BOTH
  // surfaces — ast-grep + ruff (J2 decisions log #11), joined by the go toolchain + golangci-lint
  // (J3), whose consumer half is the delivered CI template plus the lane's REFUSE-path hint. The
  // consumer surface is per-tool (`TrackedTool.consumerSurfaces` in hooks/pin-parity.test.ts), since
  // each lane delivers through its own files; keep this enumeration in step with that population.
  // rustc/cargo 1.96.1 is framework-pinned only
  // (46-cargo.sh leaves the consumer toolchain version unpinned), so a two-surface claim for it
  // would fabricate an invariant F10 does not state. NO fix (honest none-spotted): the real surfaces
  // already mirror (framework audit-self.yml ast-grep 0.44.1 == consumer 45-python.sh 0.44.1; ruff
  // 0.15.21 == 0.15.21). RED-proven live at registration by drifting a real consumer ruff pin to
  // 0.15.22 → one "ruff: pin divergence" violation; and a stubbed non-discriminating checkPinParity
  // fails all three paired negatives (divergence / consumer-float / framework-drop) — RED-before-GREEN.
  {
    id: 'P1',
    group: 'ci',
    slug: 'pinned-toolchain-in-ci',
    positive: [
      { suite: 'packages/core/hooks/pin-parity.test.ts', locator: '@arm:P1:pos' },
    ],
    negative: [
      { suite: 'packages/core/hooks/pin-parity.test.ts', locator: '@arm:P1:neg' },
    ],
  },
];

/** Gate 1 — pairing: a green-only (or red-only) arm is REFUSED. */
export function checkArmPairing(arms: readonly ArmEntry[]): string[] {
  const errs: string[] = [];
  for (const arm of arms) {
    if (arm.positive.length < 1) {
      errs.push(
        `arm ${arm.id} (${arm.slug}) has 0 positive cases — a red-only arm cannot prove the GREEN path exists`,
      );
    }
    if (arm.negative.length < 1) {
      errs.push(
        `arm ${arm.id} (${arm.slug}) has 0 RED-proof cases — green-only REFUSED per spec §3 universal RED-provability`,
      );
    }
  }
  return errs;
}

/** Gate 3 — canonical ids: unique, known, group+slug matching the frozen §3 table. */
export function checkArmIdsCanonical(arms: readonly ArmEntry[]): string[] {
  const errs: string[] = [];
  const canonicalById = new Map(CANONICAL_ARMS.map((c) => [c.id, c]));
  const seen = new Set<string>();
  for (const arm of arms) {
    if (seen.has(arm.id)) {
      errs.push(`arm ${arm.id} registered more than once — duplicate row`);
      continue;
    }
    seen.add(arm.id);
    const canonical = canonicalById.get(arm.id);
    if (!canonical) {
      errs.push(`arm ${arm.id} is not one of the 22 canonical spec §3 ids`);
      continue;
    }
    if (arm.group !== canonical.group) {
      errs.push(
        `arm ${arm.id} declares group "${arm.group}" but the canonical §3 group is "${canonical.group}"`,
      );
    }
    if (arm.slug !== canonical.slug) {
      errs.push(
        `arm ${arm.id} declares slug "${arm.slug}" but the canonical §3 slug is "${canonical.slug}"`,
      );
    }
  }
  return errs;
}

/**
 * Gate 2 — reference resolution (principle-08 broken-ref idiom): every ref's locator must be
 * the exact `@arm:<id>:<kind>` token for its arm+direction, its suite file must exist, and
 * the file must contain the locator verbatim. A dangling/fabricated pairing is RED.
 */
export function checkArmRefsResolve(
  arms: readonly ArmEntry[],
  repoRoot: string,
): string[] {
  const errs: string[] = [];
  for (const arm of arms) {
    const sides: ReadonlyArray<readonly [('pos' | 'neg'), readonly ArmCaseRef[]]> = [
      ['pos', arm.positive],
      ['neg', arm.negative],
    ];
    for (const [kind, refs] of sides) {
      for (const ref of refs) {
        const expected = `@arm:${arm.id}:${kind}`;
        if (ref.locator !== expected) {
          errs.push(
            `arm ${arm.id} ${kind} ref locator "${ref.locator}" is malformed — must be exactly "${expected}"`,
          );
          continue;
        }
        const abs = `${repoRoot}/${ref.suite}`;
        if (!existsSync(abs)) {
          errs.push(
            `arm ${arm.id} ${kind} ref suite "${ref.suite}" does not exist (dangling reference)`,
          );
          continue;
        }
        if (!readFileSync(abs, 'utf8').includes(ref.locator)) {
          errs.push(
            `arm ${arm.id} ${kind} ref suite "${ref.suite}" exists but does NOT contain marker "${ref.locator}" verbatim (marker-less / lying reference)`,
          );
        }
      }
    }
  }
  return errs;
}

/** A live `@arm:` marker discovered in a scanned suite file. */
export interface ArmMarker {
  readonly id: string;
  readonly kind: 'pos' | 'neg';
  /** The slug written after the locator — compared against the canonical §3 slug. */
  readonly slug: string;
  readonly file: string;
}

/**
 * A LIVE marker must OPEN a comment line: `// @arm:…` or `# @arm:…`, optionally
 * indented, followed by the arm's slug.
 *
 * The old pattern matched `@arm:<id>:<kind>` anywhere in the file, so ordinary prose
 * that CITES another arm counted as a live case — e.g. «control for the
 * vendored-but-UNDECLARED negative (@arm:B3:neg above)» in
 * packages/core/research/ecosystem-cargo.test.ts. Measured on this tree: 94 loose
 * matches vs 86 real markers, i.e. 8 phantom cases inflating the population the
 * sentinel compares (ledger A8-5).
 */
const ARM_MARKER_LINE_RE =
  /^[ \t]*(?:\/\/|#)[ \t]*@arm:([A-Z]\d+):(pos|neg)[ \t]+([a-z0-9-]+)/;

/** This principle's own test file — excluded from the scan: it necessarily contains
 *  synthetic `@arm:` tokens (RED-proof fixtures) that are not live suite cases. */
const SELF_TEST_BASENAME = '33-adapter-jig-arm-registry.test.ts';

/**
 * Enumerate the suite population the sentinel scans: git-tracked
 * packages/core/**\/*.test.ts + tests/install-sh/**\/*.test.sh.
 *
 * There is NO filesystem-walk fallback any more (ledger A8-5). It silently changed the
 * POPULATION the sentinel compares against — walking untracked and gitignored files that
 * `git ls-files` deliberately excludes — so a git failure degraded a set-equality gate into
 * a comparison against a different set, and reported the result as if it were the same
 * check. A gate that answers a question it was not asked is worse than one that says it
 * could not ask: this throws instead.
 */
export function enumerateSuiteFiles(repoRoot: string): string[] {
  let out: string;
  try {
    out = execFileSync(
      'git',
      ['-C', repoRoot, 'ls-files', '--', 'packages/core', 'tests/install-sh'],
      { encoding: 'utf8' },
    );
  } catch (err) {
    throw new Error(
      `adapter-jig arm sentinel: \`git ls-files\` failed in ${repoRoot}, so the suite ` +
        `population is unknown. Refusing to substitute a filesystem walk — it would compare ` +
        `a DIFFERENT set (untracked + gitignored files) and call the answer equality. ` +
        `Cause: ${(err as Error).message}`,
    );
  }
  return out
    .split('\n')
    .filter(Boolean)
    .filter((rel) => rel.endsWith('.test.ts') || rel.endsWith('.test.sh'))
    .filter((rel) => !rel.endsWith(`/${SELF_TEST_BASENAME}`))
    .sort();
}

/** Scan the given suite files (default: the enumerated population) for live `@arm:` markers. */
export function scanSuiteMarkers(
  repoRoot: string,
  files: readonly string[] = enumerateSuiteFiles(repoRoot),
): ArmMarker[] {
  const markers: ArmMarker[] = [];
  for (const rel of files) {
    const abs = `${repoRoot}/${rel}`;
    if (!existsSync(abs)) continue;
    for (const line of readFileSync(abs, 'utf8').split('\n')) {
      const match = ARM_MARKER_LINE_RE.exec(line);
      if (!match) continue;
      markers.push({
        id: match[1],
        kind: match[2] as 'pos' | 'neg',
        slug: match[3],
        file: rel,
      });
    }
  }
  return markers;
}

export interface PopulationParity {
  /** `<id>:<kind>` slots with a live suite marker but NO registry row. */
  readonly missingFromRegistry: string[];
  /** Registry `<id>:<kind>` slots with NO live marker in any scanned suite. */
  readonly missingFromSuites: string[];
}

/**
 * Gate 4 — the population sentinel: bidirectional set-difference over `<id>:<kind>` SLOTS,
 * not bare ids (ledger A8-5).
 *
 * Comparing ids alone made the gate answer a weaker question than the one it advertised:
 * an arm whose positive was marked and whose negative was not still showed the id on both
 * sides, so the missing RED-proof was invisible. Slots make each half of a pair its own
 * population member. Both directions RED; empty↔empty stays the legal starting state.
 */
export function checkPopulationParity(
  registrySlots: Iterable<string>,
  markerSlots: Iterable<string>,
): PopulationParity {
  const registry = new Set(registrySlots);
  const markers = new Set(markerSlots);
  return {
    missingFromRegistry: [...markers].filter((s) => !registry.has(s)).sort(),
    missingFromSuites: [...registry].filter((s) => !markers.has(s)).sort(),
  };
}

/** `<id>:<kind>` slots the registry declares — the left-hand side of the sentinel. */
export function registrySlots(arms: readonly ArmEntry[]): string[] {
  const out: string[] = [];
  for (const arm of arms) {
    if (arm.positive.length > 0) out.push(`${arm.id}:pos`);
    if (arm.negative.length > 0) out.push(`${arm.id}:neg`);
  }
  return [...new Set(out)].sort();
}

/** `<id>:<kind>` slots the live markers occupy — the right-hand side. */
export function markerSlots(markers: readonly ArmMarker[]): string[] {
  return [...new Set(markers.map((m) => `${m.id}:${m.kind}`))].sort();
}

/**
 * KNOWN drift the tightened registration gate reports but this change does NOT resolve,
 * because resolving it is a SEMANTIC call about what the arm is, not a typo fix — and both
 * live in suites owned elsewhere. Each entry is `<file>\t@arm:<id>:<kind>` plus a rationale.
 *
 * Every entry must still match a live marker (asserted below): a stale entry silently widens
 * the exemption, which is the failure mode this whole file exists to prevent. New drift is
 * NOT allowlisted — it reds.
 */
export interface KnownMarkerDrift {
  readonly file: string;
  readonly locator: string;
  readonly why: string;
}

export const KNOWN_MARKER_DRIFT: readonly KnownMarkerDrift[] = [
  {
    file: 'packages/core/research/ecosystem-go.test.ts',
    locator: '@arm:B2:neg',
    why:
      'Marked `name-guard-containment` while canonical B2 is `value-guard-containment`, and ' +
      'the case comment states outright that it is a dep-NAME traversal guard, distinct from ' +
      'the cargo VALUE-surface guard that go does not need. So this is a DIFFERENT concern ' +
      'reusing the B2 id, not a mislabelled B2: it needs either its own canonical arm or a ' +
      'reclassification, and that is the arm owner call, not this gate.',
  },
  {
    file: 'packages/core/backends/golangci/firing.test.ts',
    locator: '@arm:E3:neg',
    why:
      'Marked `identity-path-vs-stdout` (a wrong-jsonPath negative for parseCodesFromStdout) ' +
      'while canonical E3 is `toolchain-freshness-vs-evidence`. Unrelated concern reusing the ' +
      'E3 id; the golangci freshness negative that IS E3 lives in the sibling ' +
      'capability-matrix.test.ts and is now registered. Same owner call as above.',
  },
];

/** One tightened-registration violation, rendered for the failure message. */
export interface MarkerRegistrationReport {
  /** Live markers that are unregistered, mis-slugged, or in an unreferenced file. */
  readonly violations: string[];
  /** KNOWN_MARKER_DRIFT entries that no longer match any live marker (stale exemptions). */
  readonly staleExemptions: string[];
}

/**
 * Gate 5 — every LIVE marker must be REGISTERED (ledger A8-5).
 *
 * The old sentinel compared id sets, so `@arm:<id>:<kind>` in any scanned suite counted as a
 * live case regardless of its slug or whether the registry pointed at that file at all. The
 * promise in this file's header — «an arm marked in a suite but absent from the registry
 * escapes the pairing meta-check (RED)» — therefore held per ID, never per CASE. Three
 * conditions now make it hold per case:
 *
 *   1. the id is canonical (§3);
 *   2. the slug written after the locator IS that id's canonical slug — a marker naming a
 *      different concern is a different arm, not a spelling variant;
 *   3. the marker's FILE appears in that arm's refs for that kind — otherwise the case is
 *      invisible to checkArmRefsResolve, which only ever opens files the registry names.
 */
export function checkMarkerRegistration(
  arms: readonly ArmEntry[],
  markers: readonly ArmMarker[],
  exemptions: readonly KnownMarkerDrift[] = KNOWN_MARKER_DRIFT,
): MarkerRegistrationReport {
  const canonical = new Map(CANONICAL_ARMS.map((c) => [c.id, c.slug]));
  const byId = new Map(arms.map((a) => [a.id, a]));
  const exempt = new Set(exemptions.map((e) => `${e.file}\t${e.locator}`));
  const matched = new Set<string>();

  const violations: string[] = [];
  for (const m of markers) {
    const locator = `@arm:${m.id}:${m.kind}`;
    const key = `${m.file}\t${locator}`;
    if (exempt.has(key)) {
      matched.add(key);
      continue;
    }
    const canonSlug = canonical.get(m.id);
    if (canonSlug === undefined) {
      violations.push(`${m.file}: ${locator} — "${m.id}" is not a canonical §3 arm id`);
      continue;
    }
    if (m.slug !== canonSlug) {
      violations.push(
        `${m.file}: ${locator} is slugged "${m.slug}" but canonical ${m.id} is ` +
          `"${canonSlug}" — a marker naming a different concern is a different arm`,
      );
    }
    const arm = byId.get(m.id);
    const refs = m.kind === 'pos' ? (arm?.positive ?? []) : (arm?.negative ?? []);
    if (!refs.some((r) => r.suite === m.file)) {
      violations.push(
        `${m.file}: ${locator} is marked here but the registry lists no ${m.kind} ref to ` +
          `this file — the case escapes checkArmRefsResolve, which only opens referenced files`,
      );
    }
  }

  const staleExemptions = exemptions
    .filter((e) => !matched.has(`${e.file}\t${e.locator}`))
    .map((e) => `${e.file}: ${e.locator} — exempted but no live marker matches it any more`);

  return { violations: violations.sort(), staleExemptions: staleExemptions.sort() };
}

/** Canonical ids not yet registered — consumed by the REGISTRY_COMPLETE completeness gate. */
export function missingArmIds(arms: readonly ArmEntry[]): string[] {
  const registered = new Set(arms.map((a) => a.id));
  return CANONICAL_ARMS.map((c) => c.id).filter((id) => !registered.has(id));
}
