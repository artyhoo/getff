# Adapter-factory conformance jig — design

> **Status:** DRAFT binding design, authored 2026-07-22 in the pipeline-ecosystem-wiring meta
> session from three synthesis inputs: a read-only contract census (this worktree, branch =
> staging + `ffa571149`), a conformance-arm catalogue built from the four ecosystem-wiring PRs
> (W1 #1074 in artyhoo/getff; W2 #1076, W3 #1078, W4 #1080 in this repo, all MERGED 2026-07-21),
> and two prior-art sweeps (11 external WebSearch phrasings + full SSOT verdict-column sweep).
> Five operator decisions recorded 2026-07-22 are binding inputs (§4, §7, §8 restate them).
> **Branch-lag disclosure:** census file:line citations were verified at `ffa571149`, which
> predates the W2-W4 merges (`git merge-base --is-ancestor 6f1c6be02 HEAD` → false). Where the
> two states diverge (ctx factory, cargo lane, BASELINE value), PR# citations describe the
> wired `origin/staging` state the jig actually inherits; census file:lines describe the frozen
> interface surface, which W2-W4 did not change.
> **Authoritative for:** the adapter-factory conformance jig design — frozen contract (§2),
> conformance suite (§3), invocation contexts (§4), process rig (§5), family taxonomy + walls
> (§7), non-goals (§8), staging sketch (§9).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The `rule-tests` surface + ecosystem-wiring umbrella contour — see
> [2026-07-21-rule-tests-surface-design.md](2026-07-21-rule-tests-surface-design.md) Part II;
> this spec SUBORDINATES to its §7 delegation criterion, §8 prohibitions, and §10 collision
> rule wherever they touch. Per-commit build-vs-reuse gate — [CLAUDE.md](../../../CLAUDE.md).
> Harness-axis parity — [zcode-parity-doctrine.md](../../../.claude/rules/zcode-parity-doctrine.md)
> (different axis; see §8). Executor-loop mechanics — `superpowers:subagent-driven-development`.

## §1 Problem + evidence

One night of ecosystem wiring (2026-07-21) produced four merged stages — W1 #1074 (Stack type
widening + polyglot detection, getff), W2 #1076 (pip + cargo adapters wired into production
ResolveCtx), W3 #1078 (python rules-lock variant), W4 #1080 (cargo delivery slice + pinned CI
arm). Every MAJOR defect lived in **template-shaped glue** — code that looks like the previous
lane with names swapped — and none was caught by the existing gate stack. Each was caught only
by adversarial review plus live firing proofs:

- **W2 MAJOR** (fix `77ec10daf`): the new ctx factory unconditionally ran `readAif()` →
  `AifSchemaError` thrown on a JS consumer with a headingless `.ai-factory/DESCRIPTION.md` — a
  crash on a path that never threw before wiring. Fixed with `{skipAif:true}` (adapter choice
  depends only on the toolchain manifest) + RED→GREEN regression test.
- **W3 MAJOR** (fix `18336846c`): `copy_safe` overwrote delivered configs under `--force` while
  the lock regenerated only on `--refresh` — the lock lied about the delivered set.
- **W4 MAJOR** (fix `32d52a37d`, reproduced with real cargo 1.96.1): in the REFUSE cell both
  the firing self-check and the lock resolved the CONSUMER's `clippy.toml` instead of the
  delivered `getff-clippy.toml` → false SILENT verdict + lock fingerprinting the wrong file.
- **Minors of the same class:** silent fingerprint degrade to a constant on hash-tool-less
  hosts (W3); a security tripwire narrowed by a conjunctive predicate term (W2); implicit
  polyglot manifest precedence, pinned via a characterization test (W1 #1074 «Tests» section —
  provenance is the test evidence, not a labelled review finding); a «staleness ledger» prose
  mislabel on the cargo lock (W4, fix `32d52a37d` — excluded from arm-hood with rationale, §3
  preamble).

The loop kept paying within the same session: W5's adversarial review (PR pending at authoring
time) reproduced two more MAJORs in the same glue class — a delivered-set change on a PLAIN
pass (a researched-rule join) that the lock's overwrite-flag guard could not see (the lock lied
again, one guard-generation later), and an unsanitized record-derived id used as a filesystem
path (arbitrary-write traversal, both attacks reproduced at `rule-bootstrap-cli.ts:167`). Both
land as arms below (D1 strengthened; B2).

The economics: defects concentrate in the corners (REFUSE cell, flag paths, degraded hosts,
polyglot repos), and each new ecosystem re-pays the full adversarial-review cost while still
leaking corner-case MAJORs toward the field. The jig converts each incident into a **permanent
stack-agnostic conformance arm** (operator decision 5: the frozen narrow waist is the adapter
CONTRACT + this CONFORMANCE SUITE; the jig itself stays hand-written and minimal; every
production/review incident becomes a permanent arm — the learning loop). All incident claims
above were verified against the PR bodies at catalogue time.

## §2 The frozen contract

What the jig freezes (the narrow waist) vs what stays free per ecosystem. Freeze mechanics:
changing a FROZEN row is owner-preconditioned per the delegation criterion of
[rule-tests-surface-design](2026-07-21-rule-tests-surface-design.md):274-279 (frozen artifacts
are never stage-delegable); FREE rows are stage-delegable inside a wiring lane.

### §2.1 FROZEN rows

Rows tagged INHERITED have their freeze authority in an existing home rule/harness; the jig row
is a conformance-arm pointer, never a second change-control authority over the same surface.

| # | Element | Location (census @ `ffa571149`) | What freezes |
|---|---|---|---|
| F1 | `EcosystemAdapter` — `{ ecosystem; listDirectDeps(root); readInstalledMeta(root, pkg) }` + `InstalledMeta` | `packages/core/research/allowlist-resolver.ts:133-137`, `:138-141` | The 3-method seam. New capability = new optional method with a documented default, never a signature change. |
| F2 | `ResolveCtx` — `{ root; adapter?; ackFilePath? }`; absent adapter ⇒ Tier-1 always misses | `allowlist-resolver.ts:164-171`, back-compat `:190-196` | The optional-adapter shape + fail-closed default. |
| F3 | `tier1For` host-derivation pipeline: prefix dispatch → direct-dep gate → `[homepage, repository]` → https-host extract → canonicalize → reject IP / single-label / punycode / multi-tenant apex | `allowlist-resolver.ts:189-243` | The behavioural contract every adapter's outputs must survive. Adapters feed it; they never re-implement or bypass it. |
| F4 | `<ecosystem>:<bareName>` naming + `KNOWN_ECOSYSTEM_PREFIXES`; unknown prefix ⇒ `'unknown'` fail-closed | `packages/core/research/ecosystem-name.ts:22`, `:31-45` | The prefix scheme. Adding a family extends the set — a jig checklist item, never an adapter-local parser. |
| F5 | Typed-const declaration idiom `export const X: EcosystemAdapter = {` | `ecosystem-npm.ts:56`, `ecosystem-cargo.ts:364`, `ecosystem-python.ts:216` | The idiom IS contract: two tripwires regex-detect adapters via it (`ecosystem-adapter-precondition.test.ts:79`; `ecosystem-unwired-debt.test.ts:~57`). A stamped adapter MUST use it verbatim. |
| F6 | Guard family: `isUnsafeDepName` on the NAME surface (mandatory, every adapter); `resolvedWithinRoot` realpath containment on the VALUE surface (per path-resolving adapter) | precondition test population; gap documented in `research-source-trust.md` §5 item 2 | NAME guard is population-enforced; VALUE guard is adapter-local and must be re-implemented per path-resolving adapter — backed by arm B2 (paired path-escape fixtures per path-resolving surface), no longer a bare checklist item. |
| F7 | Delivery-cell grammar: fresh copy / structural-merge-or-REFUSE / REFUSE + namespaced reference / always-written bans target / idempotent re-run / namespaced consumer CI workflow / `.override.md` refresh escape | `setup.d/45-python.sh:10-38` (matrix), `:73-79`, `:85-145`, `:148-184`, `:187-258`, `:292-329` | The cell taxonomy and REFUSE-LOUDLY semantics. Cell file names vary per family; the grammar does not. |
| F8 | Firing self-check shape: plant violation in `mktemp -d` ONLY, assert delivered gates fire RED, absent tool ⇒ LOUD degrade with exact manual command, rc=0 always | `setup.d/45-python.sh:340-412`; wired at `install.sh:217` | The proof-of-enforcement cell ([attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)). Every lane ships an equivalent. |
| F9 | Snapshot byte-identity harness + per-stack baselines; volatile artefacts excluded per-file — INHERITED (authority = the snapshot harness itself) | `tests/install-sh/snapshot.sh:38-62`, python rows `:239-250` | The fingerprint format and the exclusion discipline (§3 arm C3). New lane = one dispatch block + captured baselines. |
| F10 | CI-arm exact-pin posture, framework + consumer mirrored pin strings bump together — INHERITED (authority = [ci-tool-pinning.md] Rule A) | `.github/workflows/audit-self.yml:231-232`, `:241-242`; `setup.d/45-python.sh:320-322` | The two-surface pin-sync invariant (§3 arm P1). |
| F11 | rules-lock schema parity: the JS/TS `RulesLock` field set `{schemaVersion, framework, version, ruleIds, <tool-bans>, emittedAt, sourceFingerprint}` is the cross-lane schema | W3 #1078 + W4 #1080 PR bodies («schema parity») | Schema FROZEN-by-parity across lanes; PLACEMENT stays FREE per §2.2. A lane drifting the field set breaks the future lock-reader before it exists. |

### §2.2 FREE rows (vary per family; stage-delegable)

Adapter internals (manifest parsing, metadata lookup); native tool choice + invocation; delivered
config file names (namespaced per family); lock **placement** per lane — a recorded divergence,
not an accident: cargo lock at `.ai-factory/synthesizer-output/rules-lock.cargo.json` vs python
lock at `.getff/rules-lock.python.json` (python lane forbids `.ai-factory/`; W4 #1080 PR body
«Cross-stack rules-lock placement»). Any future lock-reader arm must encode per-lane placement
resolution, never a single path convention. Also free: the TS detector arm — the census confirms
`packages/core/detector/` has NO python/cargo arm at `ffa571149` (`types.ts:5` union) and non-npm
detection lives bash-side (`install.sh:225-251`); W1 #1074 widened the type on the getff side.
Where wired-state facts matter below, the authority is the merged PR, not the census snapshot:
ctx factory `resolveCtxForRoot` (W2 #1076, replacing the inline literals at
`synthesizer/cli.ts:69` + `file-clients.ts:46`), `setup.d/46-cargo.sh` (W4 #1080), BASELINE
2→0 (W2 #1076).

## §3 The conformance suite

Eighteen arms in eight groups. **Universal RED-provability requirement:** every arm MUST be
proven discriminating before it counts — RED-before-GREEN against a violating implementation or
an inverted assertion, with paired positive+negative cases. The pairing is enforced at the jig's
case-schema level: an arm with only green-path cases is REFUSED (ESLint RuleTester's mandatory
valid+invalid pairing, lifted to adapter-capability granularity — §6). The in-repo precedent is
`tests/install-sh/python-delivery.test.sh:25-26` (assertions proven discriminating against a
copy-only stub). **Arms are append-only:** every future incident lands as a permanent arm in the
same PR as its fix (operator decision 5).

**Execution contexts** (each arm belongs to a primary context; §4 claims scope to these):
`standing-CI` — deterministic re-run on every push once landed: A1, A2, B1, B2, C1, C2, C3, D1,
D2, E1, E2, E3, P1, G1, G2, H1, H2. `per-PR-diff` — evaluated against a PR's changed-file set:
G3. `consumer-install-time` (additional context) — E1/E2 also re-prove themselves at every
consumer install as the shipped firing self-check (F8). The stamp-time human obligations (family
classification, consumer-site census) are §5 advisor consult points, deliberately NOT arms.

**Excluded-with-rationale:** the W4 prose-mislabel minor (fix `32d52a37d`) is a
documentation-tense accuracy incident — not deterministically arm-able without a paid-LLM prose
judge ([no-paid-llm-in-ci.md]); routed to review-time T3 discipline instead. Recorded here so
the append-only loop stays honest about its one exclusion.

### §3.1 Parsing / resolution

| Arm | Check | Origin | RED-proof |
|---|---|---|---|
| A1 `no-new-throw-on-prewired-path` | Adapter resolution is a pure function of the ecosystem manifest; never a new throw/non-zero exit on input that succeeded pre-wiring; optional-metadata reads are skippable. | W2 #1076 MAJOR, fix `77ec10daf` | Consumer with malformed/absent optional metadata (broken `.ai-factory/`, corrupt unrelated-stack file) ⇒ same verdict + exit 0 as the pre-wiring default; regression RED→GREEN. |
| A2 `polyglot-precedence-pinned` | Co-existing manifests ⇒ explicit, documented, characterization-tested precedence per combination. | W1 #1074 MINOR | Inverted-assertion proof; a precedence flip without a matching test update is RED. |

### §3.2 Trust

| Arm | Check | Origin | RED-proof |
|---|---|---|---|
| B1 `tier1-trust-poisoned-negative` | Adapter-derived Tier-1 host set proven live on the PRODUCTION entrypoint: authorized-host plan exit 0; poisoned-host plan refused exit 1 with the provenance error. | Standing invariant; executed W2 #1076 (scratch python + cargo consumers, both arms live) | The negative arm must actually fire; a trust check whose poisoned arm never runs is vacuous and RED. |
| B2 `value-guard-containment` | Every record/plan-derived identifier or path used on the filesystem VALUE surface is validated (safe-slug format) AND realpath-contained inside its designated directory before any read/write; unknown ecosystem prefixes hit the F4 fail-closed branch. | `research-source-trust.md` §5 item 2 documented gap; reproduced live in W5 review (unsanitized `entryId` → arbitrary-write traversal, `rule-bootstrap-cli.ts:167`, both attacks reproduced) | Paired path-escape fixtures per path-resolving surface: traversal/separator id refused loudly (RED-provable), safe slug passes; unknown-prefix fixture must land in `'unknown'` fail-closed. |

### §3.3 Delivery cells

| Arm | Check | Origin | RED-proof |
|---|---|---|---|
| C1 `delivery-cell-matrix-complete` | Fresh \| idempotent re-run \| REFUSE/namespace cells all implemented AND individually tested; no untested cell. | `45-python.sh` grammar; W4 MAJOR lived precisely in the untested REFUSE corner | Each cell RED-before-GREEN vs a copy-only stub (python-delivery.test.sh precedent). |
| C2 `no-consumer-manifest-mutation` | Consumer manifest + all pre-existing configs byte-identical before/after install, including under `--force`; integration content lands only under the namespaced dir. | W4 #1080 (`.getff/Cargo.lints.toml` reference file, never auto-edits `Cargo.toml`) | Hash-compare arm; any mutation is RED. |
| C3 `snapshot-exclusion-no-drift-mask` | Snapshot exclusions listed per-file, never glob-wide; excluding a volatile artefact must not mask drift of deterministic artefacts. | W3 #1078 (lock excluded for `emittedAt`; empirically re-proved `*.yml` still fingerprinted) | Mutate one delivered rule/config byte with the exclusion in place ⇒ snapshot gate still RED; a mutation-swallowing exclusion is itself RED. |

### §3.4 Lock integrity

| Arm | Check | Origin | RED-proof |
|---|---|---|---|
| D1 `lock-never-stale-on-any-pass` | The lock regenerates whenever the DELIVERED set may have changed — every overwrite flag path AND any join/augment path that mutates delivered artefacts on a plain pass. The skip guard must be CONTENT-AWARE (delivered-set fingerprint vs the lock's `sourceFingerprint`), never existence- or flag-only. | W3 #1078 MAJOR (fix `18336846c` — flag-path guard); W5 review MAJOR — reproduced one guard-generation later: a plain-pass researched-rule join changed the delivered set while the flag-only guard skipped | Change a source template ⇒ each overwrite invocation moves the fingerprint (RED stale → GREEN moved); author a new researched rule ⇒ a PLAIN re-run must move the lock too; a true no-change re-run stays byte-stable. |
| D2 `no-silent-fingerprint-degrade` | Hash tool absent ⇒ documented fallback rungs + LOUD non-authoritative stderr warning; never a silent constant/empty fingerprint. | W3 #1078 MINOR (empty-string degrade; fixed with md5 rungs + `⚠ … non-authoritative`) | Strip all hash tools from PATH; silent stderr or constant fingerprint is RED. Lane-independent (lock writer is shell-level). |

### §3.5 Firing

| Arm | Check | Origin | RED-proof |
|---|---|---|---|
| E1 `scratch-consumer-red-green-pair` | Fresh scratch consumer (manifest only): real install → plant violation → native tool exits non-zero; paired clean control exits zero. Exit codes are captured artefacts, not prose. | Standing (wiring kickoff §2 works-criteria); executed W3 (`yaml.load` RED / `safe_load` GREEN) + W4 (clippy fired RED on planted `std::env::var`) | Missing either direction is vacuous and RED (an always-red harness passes identically without the green control). |
| E2 `self-check-resolves-delivered-config` | Self-check AND lock fingerprint resolve the DELIVERED config, never the consumer's pre-existing same-named file — especially in the REFUSE cell. | W4 #1080 MAJOR, fix `32d52a37d` (`_cargo_delivered_clippy_path` resolver; arms 5a/5b) | Fixture where consumer owns the tool's default config name; planted violation must fire via the delivered namespaced config; lock fp == delivered file's hash. |
| E3 `toolchain-freshness-vs-evidence` | Committed firing evidence records the producing tool version; a freshness gate REDs on drift between evidence and the live/pinned tool. | W4 #1080 (`deriveRustcVersion` + `checkToolchainFreshness` + paired negatives); pattern from `backends/*/capability-matrix.test.ts` | The paired negative (fabricated version drift) demonstrated RED-capable, not assumed. |

### §3.6 CI pinning

| Arm | Check | Origin | RED-proof |
|---|---|---|---|
| P1 `pinned-toolchain-in-ci` | Every toolchain install line exact-pinned; every third-party action full-SHA-pinned; new lane covered by the unpinned-tool-install gate; consumer refuse-path pin strings mirror the framework pins (F10). | Standing ([ci-tool-pinning.md] Rule A); executed W4 (`rustup … 1.96.1` + SHA-pinned `actions/cache`) | Grep arm: floating tag, range, or `latest` is RED; pin-string divergence between the two surfaces is RED. |

### §3.7 Type-shape / wiring atomicity

| Arm | Check | Origin | RED-proof |
|---|---|---|---|
| G1 `type-widening-exhaustiveness` | No non-exhaustive switch/default arm silently absorbs a widened stack variant: union consumers stay compiler-enumerated (`satisfies never`-style default arms or equivalent), `tsc --noEmit` clean. The live human census of consumer sites is a §5 advisor consult point — a process obligation, deliberately not an arm. | W1 #1074 (union widened against a ~4-site census, `tsc --noEmit` clean) | Type-level paired negative: widen the union without handling ⇒ `tsc` RED; a default-arm fallthrough routing the new stack down the npm path is RED. |
| G2 `all-callsites-migrated-atomically` | Every production ctx-construction site migrated in one atomic PR; zero hardcoded default-adapter literals remain on production paths. | W2 #1076 (both sites: `synthesizer/cli.ts` + `file-clients.ts`; §1.7 git-grep verified no third site) | Grep arm for the construction pattern; it permanently catches any later bypass construction. |
| G3 `zero-skill-core-edits` | Wiring touches only detector + adapter + delivery slice + tests; skill/agent/IR surfaces are name-only-diff clean. If an edit there is needed, the architecture failed — STOP, never fork the protocol. | Standing ([rule-tests spec]:310-312 D2 acceptance + T-UTS-A); attested across all four PRs | Diff-scope assertion: any intersection with `.claude/skills/rule-tests/`, `agents/rule-test-author.md`, `packages/core/ir/types.ts` is RED. |

### §3.8 Tripwire lockstep

| Arm | Check | Origin | RED-proof |
|---|---|---|---|
| H1 `baseline-debt-lockstep` | Adding an adapter increments the unwired-debt BASELINE; wiring decrements it — both atomically in the same PR, strict `===`. | Standing; executed W2 (2→0 in the wiring commit; `ecosystem-unwired-debt.test.ts:103` + prescription `:112-113`) | Mismatch in EITHER direction (debt re-growth or partial wiring) is RED. |
| H2 `tripwire-predicate-no-conjunctive-narrowing` | Retargeting a security tripwire never adds conjunctive co-presence terms; it keys on the invariant-bearing token alone; every retarget ships non-vacuous arms proving previously-caught shapes still trip. | W2 #1076 MINOR (`ackFilePath:` ∧ `adapter:` conjunction missed adapter-less construction; broadened + 2 arms) | Replay the tripwire corpus INCLUDING token-absent constructions; an AND-term diff without a paired negative arm is RED. |

## §4 The two invocation contexts

**Framework-side stamping (default — operator decision 1).** The factory stamps an adapter once
per ecosystem family (§7). The full suite runs framework-side at stamp time; thereafter CI
re-runs the standing-context arms as a purely deterministic battery, the per-PR-diff arm runs
per PR event, and E1/E2 additionally re-prove themselves at every consumer install (§3 context
legend). Who types the adapter code — human-by-template or AI — is tactical per
stack (operator decision 3); the jig is the quality floor either way, and AI generation is
session-bound per [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md):22 — CI
never calls an LLM, it only re-runs the suite.

**Consumer-side (two grades — operator decisions 1-2).**

1. *Shipped verification half:* the install-time firing self-check (F8) re-proves the adapter's
   delivery on every consumer install — this already ships today (`45-python.sh:340-412`) and is
   the per-lane instance of arm E1/E2 running on the consumer's real tree (mktemp-planted, never
   in consumer sources). The generation half never ships.
2. *Self-certification pressure valve (long tail):* a consumer may run the SAME jig against an
   adapter the framework has not stamped (their in-house ecosystem). The results artifact is a
   machine-readable file marked `self-certified` — certification = passing the kit, not prose
   (TCK model, §6), and the artifact-not-auditor governance follows the OpenID/TMForum
   self-certification pattern. Upstream path = give-back: a PR carrying the adapter + its
   results artifact, which the framework re-runs before promotion to stamped status. CI checks
   only artifact freshness/consistency — no human review bottleneck, no LLM
   ([attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md):
   the gate is the artifact check; human attention is merge authority only). The valve's
   TOOLING (artifact schema, marking, give-back docs) is roadmap behind a demand trigger (§8) —
   the design intent here is binding, the machinery is deliberately unscheduled.

## §5 The process rig

The night's workflow shape is the rig — it caught 100% of the MAJORs that the existing gates
missed (§1), so the jig codifies it rather than inventing a new loop:

1. **Implement** a wiring stage inside its lane (executor tier; loop mechanics owned by
   `superpowers:subagent-driven-development` + night-mode — this spec defines only WHAT gets
   verified, never the dispatch machinery).
2. **Adversarial multi-dimension review** — a cold reviewer walks the §3 groups as its review
   dimensions (parsing / trust / delivery / lock / firing / CI / type-shape / tripwire), one
   verdict per group. The protocol is a NAMED artifact shipped by J1 —
   `agents/adapter-jig-reviewer.md` (cold by construction: input = the diff + the §3 group
   list, NEVER the PR narrative; output = structured one-verdict-per-group report) — satisfying
   [attention-is-not-a-mechanism.md](../../../.claude/rules/attention-is-not-a-mechanism.md):17-18
   clause (b); the deterministic suite itself is clause (a). Same construction as
   `agents/backward-sweep-auditor.md` ([ai-laziness-traps.md T21](../../../.claude/rules/ai-laziness-traps.md)).
3. **Verify** — live firing proofs with real pinned tools (E1-E3 arms), never prose claims.
4. **Rework** — fixes land with their regression arms in the same PR (the append-only loop).

**Advisor consult points** (senior-tier judgment, not gates): (a) pre-stamp — family
classification against §7 incl. wall check, plus the live census of stack-type consumer sites
(the process half split out of arm G1); (b) post-implement, pre-review — arm-coverage
sanity («which §3 arm covers this new corner?»); (c) pre-merge — the session reads
`agents/compliance-verifier.md` for §1.7 substance per [CLAUDE.md](../../../CLAUDE.md) See-also.

## §6 Prior-art & BFR

Overall verdict: **BUILD-with-cited-patterns.** No artifact-level ADOPT exists — every surveyed
kit is bound to its host language/protocol (Java/Go/Rust/Python/JS/gRPC). Vocabulary is adopted
from TCK + RuleTester; the execution pattern is adapted from terraform-plugin-testing. Two-axis
adjudication per [build-first-reuse-default.md §1.1](../../../.claude/rules/build-first-reuse-default.md):38-41:
*operator axis* — reuse in-repo assets maximally (snapshot harness F9, capability-matrix schema,
the two adapter tripwires, the entry-lane/cell-grid grammar — all listed as J2 assembly inputs,
§9; arms land inside EXISTING suites, never a new runner); *shipped axis* — only the
verification half ships, portable bash, degrades loudly, zero hard companion dependence.

**External (11 WebSearch phrasings run 2026-07-22; all 6 seeded leads verified + 3 discovered):**

| Candidate | Verdict | Borrowed pattern |
|---|---|---|
| Java TCK / Jakarta CTS | ADOPT-VOCABULARY | Certification = passing the kit; every contract assertion maps to ≥1 executable test; «supported» claims backed by a jig run, not docs prose. |
| terraform-plugin-testing | ADAPT | Vendor ships the one blessed harness; acceptance runs against the REAL system in declarative steps; post-run dangling-residue sweep. |
| K8s conformance (Sonobuoy) + CSI csi-sanity | REFERENCE | Conformance = named core subset, not all features; test at the wire/protocol boundary so implementation language is irrelevant; self-run committed results artifact. |
| ESLint RuleTester | ADOPT-VOCABULARY | Harness-enforced mandatory valid+invalid pairing, lifted to arm-schema level (§3 universal requirement). Rule-granularity RuleTester is already ADOPTed in-stack (SSOT #154). |
| LSP harnesses + JDBC CTS | REFERENCE | Negative lessons: frozen spec WITHOUT an official kit ⇒ ecosystem drift (LSP); access-encumbered kit ⇒ nobody certifies (JDBC). The jig is free + in-repo from day one. |
| pytest `pytester` | REFERENCE | Host-in-a-sandbox fixture: provision throwaway workspace → install → run real binary once → structured result. |
| Rust trybuild | REFERENCE | Expected-failure output as adjacent regenerable snapshot — reuse the existing `SNAPSHOT_MODE` discipline (F9), never a second snapshot system. |
| Pact / CDC | REFERENCE | Pending-pact graded verification: a not-yet-stamped family runs the FULL jig, publishes coverage, does not hard-fail (roadmap, §8). |
| OpenID / TMForum CTK | REFERENCE | Self-certification via committed evidence artifact (§4 valve governance). |

**In-repo verdicts (existing, cited by SSOT id — none re-opened):** #43 ADOPT VOCABULARY
(adapter + registry naming); #197 / #223 ADAPT (the cargo/pip adapters the jig generalizes
from); #216 BUILD (python delivery seam); #219 BUILD (the parent stack-agnostic core the jig
stamps INTO — the jig extends it, never re-opens it); #209 ADAPT (capability matrix +
honest-degradation gate — the jig's conformance cells extend this schema rather than minting a
parallel one; arm E3 already reuses it); #203 ADAPT; #200 BUILD (config-sync family — the
macro creep guard the jig must answer to); #154 ADOPT; #183 BUILD; #191 KEEP NARROW; #21
WATCHLIST.

**Negative finding + owed residual:** zero SSOT rows match conformance/TCK/certification
(grep 2026-07-22 — nearest is #209). The J1 capability commit therefore MUST add a new SSOT
entry with the 6-item search checklist. Residual before that commit lands: a targeted DeepWiki
pass over the companion pool (CC, AIF, oh-my-openagent) for a harness-agnostic agent-hook /
adapter conformance kit — the external sweep's recorded falsifier, not yet probed beyond the
generic phrasing.

## §7 Family taxonomy + walls

Adapters are stamped per ecosystem FAMILY, not per tool (operator decision 4). Family membership
test = a shared manifest standard, not brand names.

| Family | Members | Manifest | Tier-1 registry host | Status / cost |
|---|---|---|---|---|
| npm | npm, pnpm, yarn-classic | `package.json` | registry.npmjs.org | Wired (default adapter). |
| python | pip, poetry, pdm, uv | `pyproject.toml` (PEP 621/508) + `.dist-info/METADATA` | pypi.org | Adapter wired W2 #1076; delivery lane shipped (`45-python.sh`, lock W3 #1078). |
| cargo | cargo | `Cargo.toml` `[package]` | crates.io | Adapter wired W2 #1076; delivery lane W4 #1080. |
| go | go modules | `go.mod` / `go.sum` | proxy.golang.org | **Cheapest next** (J3): single declarative manifest, machine-decidable deps, one dominant tool (golangci-lint). |
| jvm-maven | maven | `pom.xml` (declarative XML) | repo.maven.apache.org | Moderate; checkstyle/spotbugs lane research needed. |
| ruby / php / dotnet | bundler / composer / nuget | Gemfile.lock, composer.json, `*.csproj` | rubygems.org / packagist.org / nuget.org | Moderate; declarative manifests; unscheduled. |
| **WALLS** | gradle, bazel, cmake | Turing-complete build programs (Groovy/Kotlin DSL, Starlark, CMake lang) | — | **Flagged, not solved** (operator decision 4). Static `listDirectDeps` is undecidable in general. Research questions, not commitments: lockfile-based reading (`gradle.lockfile`, bazel `MODULE.bazel.lock`) as a partial-metadata path; else the family is refused loudly (§8). No stamping attempt without a dedicated research patch. |

## §8 Non-goals + honest limits

- **The jig itself is hand-written, minimal, frozen** — never generated, never a new runner.
  Inherited prohibitions verbatim from [rule-tests spec]:315: no new runners, no third
  freshness ledger, no per-stack skill generation (the :313-314 IR-freeze prohibition is
  carried by arm G3).
- **No runtime-AI in trust decisions.** Tier-1 derivation, guards, and every §3 arm are
  deterministic; AI appears only as session-bound author/reviewer
  ([attention-is-not-a-mechanism.md]:17-18; [no-paid-llm-in-ci.md]:22, :28).
- **Weak-metadata ecosystems degrade loudly.** An adapter that cannot honestly derive Tier-1
  hosts returns empty (F3 empty-hosts miss path, `allowlist-resolver.ts:235-240`) — fail-closed,
  never fabricated hosts; walls are refused with a named reason, not half-stamped.
- **Not the harness axis.** [zcode-parity-doctrine.md] owns harness (CC/ZCode/Cursor) parity;
  this jig owns the ecosystem/toolchain axis. Same word «conformance», different problem class —
  the T16 name-match guard is explicit here.
- **Not rule quality.** The jig certifies adapter + delivery conformance; rule content/substance
  belongs to the rule-research pipeline (#183) and its own gates.
- **No consumer manifest mutation, ever** (arm C2 — a limit, restated as a non-goal).
- **Pending-pact graded scoreboard** (Pact pattern, §6) is roadmap, not in J1-J3.
- **Consumer self-certification valve TOOLING** (results-artifact schema, `self-certified`
  marking, give-back docs — §4 grade 2) is **roadmap behind a demand trigger**: it builds when
  the first consumer asks to certify an unstamped ecosystem (the pulled-trigger precedent of
  python-delivery-v0). Building it for a population of zero would be
  `#integration-overhead-overestimate` ([build-first-reuse-default.md §4]). The §4 design
  intent is binding; no J-stage ships the machinery.
- **Consumer-side full-jig runs are self-certified only** — the framework never presents them as
  stamped without the §4 give-back re-run.

## §9 Implementation staging sketch

Implementation is a **FUTURE umbrella** — this spec is the binding design, not a kickoff. One
PR per stage; every stage kickoff MUST name `ir-unfreeze` + `ecosystem-wiring` in its
pre-dispatch in-flight probe and serialize emission-touching stages per the cross-umbrella
collision rule ([rule-tests spec]:344-358), including the merge-forward-never-rebase recovery
and the staging-placement rule (no stream dispatches until this spec's PR merges to staging).

- **J1 — contract extraction.** Freeze §2 into a checked artifact: contract doc + exported
  contract types + the jig checklist (F1-F11 rows as checkable items) + the named cold-review
  protocol `agents/adapter-jig-reviewer.md` (§5 step 2 — clause (b) must exist as an artifact
  at first use, not as prose intent). New SSOT entry (conformance-kit problem class, §6
  negative finding) in the same capability commit, after the DeepWiki companion-pool residual
  runs. No behaviour change.
- **J2 — conformance-suite assembly (no new runner).** Land the eighteen arms INSIDE the
  EXISTING suites — vitest under `packages/core/` (research/ + backends/ + principles/) and the
  `tests/install-sh` bash suites — so the §8 «no new runners» prohibition holds literally.
  Assembly inputs: the entry-lane + delivery cell-grid grammar (`python-entry-lane.test.sh`,
  `python-delivery.test.sh`), snapshot harness (F9), the two adapter tripwires, the
  capability-matrix schema (E3). The universal valid+invalid pairing (§3) is enforced by a
  meta-check over the arm registry landed in the EXISTING principles suite (population
  sentinel included). Retrofit-run against the three wired lanes (npm/python/cargo) — findings
  expected; each finding lands as a fix + its arm.
- **J3 — first stamped family (demand-gated).** Executes when the first new-family demand
  arrives; **go is the pre-selected candidate** (§7 cost ranking — a ranking, not a demand
  signal; stamping ahead of demand would be build-ahead-of-need). The jig's own acceptance
  test: stamp the family end-to-end THROUGH the jig — adapter + delivery lane + pinned
  native-linter CI arm + scratch red/green pair — with zero skill/IR edits and BASELINE
  lockstep. If stamping requires touching a frozen row, the jig design failed: STOP and revise
  this spec first.

## §10 §1.7 self-reflexive note

**Forward-check (this design complies with active disciplines):**

- [attention-is-not-a-mechanism.md]:17-18 — every load-bearing check here is a deterministic
  gate (§3 arms) or a NAMED cold-agent protocol with structured output (§5 step 2); no bare
  attention anywhere in the design. ✓
- [no-paid-llm-in-ci.md]:22, :28 — CI re-runs the deterministic suite only; all LLM work
  (generation, review) is session-bound. ✓
- [rule-enforcement-channel-selection.md]:45 — arms land at the earliest reachable channel:
  typed-const tripwires + vitest at pre-push, firing self-checks at consumer install time,
  CI as last resort. ✓
- [dual-implementation-discipline.md]:71, :75 — the shipped verification half is portable bash
  with loud degrade; no CC-native hard dependence. ✓
- [build-first-reuse-default.md]:38-41 — §6 adjudicates operator vs shipped axes separately;
  BUILD verdict carries the cited-pattern composition + the owed SSOT entry. ✓
- [doc-authority-hierarchy] — Authoritative-for header present above; the Class field is
  rule-files-only per its §3 and is correctly absent here (non-rule spec, same shape as the
  parent spec). ✓
- [ai-laziness-traps.md §2] — T3: every load-bearing claim carries file:line or PR# (census
  claims re-verified live: `resolve-ctx.ts` + `46-cargo.sh` absent at HEAD, `BASELINE = 2` at
  `ecosystem-unwired-debt.test.ts:103`, W2 non-ancestry via `git merge-base`); T11/T12: 11
  external phrasings + full SSOT sweep, falsifier recorded (§6 residual); T15: the jig
  self-applies — every arm must survive its own RED-provability rule, and J3 is the jig
  auditing itself; T16: explicit problem-class separations (§8 harness-axis guard; §6
  per-candidate match statements in the input sweeps). ✓

**Backward-check (class = adapter/ecosystem design-bearing artefacts; sibling sweep):**

- [2026-07-21-rule-tests-surface-design.md] Part II §7-§8, §10 — SUBORDINATED, not contradicted:
  delegation criterion inherited (§2 freeze mechanics), D2 promoted to permanent arm G3,
  prohibitions restated verbatim (§8), collision rule bound on J1-J4 (§9). SWEPT-CLEAN. ✓
- `.claude/orchestrator-prompts/ecosystem-wiring/kickoff.md` — its §2 works-criteria and §5
  STOP lines become standing arms (E1, B1, G3); no contradiction; the umbrella's incident
  yield is this spec's §1 evidence base. SWEPT-CLEAN. ✓
- [zcode-parity-doctrine.md] — orthogonal axis, explicitly disclaimed (§8); neither doc claims
  the other's census. SWEPT-CLEAN. ✓
- [build-first-reuse-default.md §1.1] — consistent: no new dependency, no standing infra beyond
  test assets; the one capability commit (J1) carries the SSOT entry per the cost gate.
  SWEPT-CLEAN. ✓
- `docs/meta-factory/prior-art-evaluations.md` — append-only respected: entry PROPOSED here,
  LANDED only in the J1 commit (this spec edits no SSOT rows). SWEPT-CLEAN. ✓
- Reused assets (`45-python.sh`, `snapshot.sh`, `ecosystem-unwired-debt.test.ts`,
  `ecosystem-adapter-precondition.test.ts`, `backends/shared/capability-matrix.ts`,
  `tests/agnosticism/*`) — all cited as J2 inputs; none superseded or modified by this spec.
  SWEPT-CLEAN. ✓
- One surface NOT in this diff swept for consistency: the census's stale-vs-staging divergence
  (W2-W4 merged after this branch was cut) is disclosed in the header rather than silently
  normalized — the two citation regimes (census file:line vs PR#) are kept distinct throughout.
  GAP-DISCLOSED (resolved at J1 rebase). ✓

[ci-tool-pinning.md]: ../../../.claude/rules/ci-tool-pinning.md
[rule-tests spec]: 2026-07-21-rule-tests-surface-design.md
[attention-is-not-a-mechanism.md]: ../../../.claude/rules/attention-is-not-a-mechanism.md
[no-paid-llm-in-ci.md]: ../../../.claude/rules/no-paid-llm-in-ci.md
[rule-enforcement-channel-selection.md]: ../../../.claude/rules/rule-enforcement-channel-selection.md
[dual-implementation-discipline.md]: ../../../.claude/rules/dual-implementation-discipline.md
[build-first-reuse-default.md]: ../../../.claude/rules/build-first-reuse-default.md
[build-first-reuse-default.md §1.1]: ../../../.claude/rules/build-first-reuse-default.md
[build-first-reuse-default.md §4]: ../../../.claude/rules/build-first-reuse-default.md
[doc-authority-hierarchy]: ../../../.claude/rules/doc-authority-hierarchy.md
[ai-laziness-traps.md §2]: ../../../.claude/rules/ai-laziness-traps.md
[zcode-parity-doctrine.md]: ../../../.claude/rules/zcode-parity-doctrine.md
[2026-07-21-rule-tests-surface-design.md]: 2026-07-21-rule-tests-surface-design.md
