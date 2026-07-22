# Adapter-factory conformance jig — frozen contract checklist (J1)

> **Status:** BINDING checked artifact — the executable-checklist half of the jig's frozen
> contract. Extracts [§2 of the design spec](2026-07-22-adapter-jig-design.md) (F1-F11) into an
> enumerated, per-row-checkable form with canonical homes RE-VERIFIED live at the J1 base
> (`origin/staging` @ `aebea3c02`, 2026-07-22). Companion to the design; produced by stage J1 of
> the `adapter-jig` umbrella.
>
> **Authoritative for:** the checkable enumeration of the frozen adapter contract — the F1-F11
> rows as individual checklist items, each with (a) its canonical definition home (file:line,
> live-verified at this base), (b) what the row freezes, (c) the forward-reference to the J2
> conformance arm that will gate it. §2 records the census-vs-live citation drift resolved at
> this base (T3). §3 names the thin exported contract surface.
>
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The contract's DESIGN + rationale + freeze mechanics — see
> [2026-07-22-adapter-jig-design.md §2](2026-07-22-adapter-jig-design.md) (SSOT; this doc
> SUBORDINATES to it — it re-expresses §2 as a checklist, never redefines it). The canonical
> TypeScript type definitions — see `packages/core/research/allowlist-resolver.ts` (this doc
> POINTS at them; it does not copy them — copying would be `#parallel-evolution-creep`). The
> 22-arm suite itself — J2 (this doc only forward-references the arms). Per-commit
> build-vs-reuse — [CLAUDE.md](../../../CLAUDE.md).

## §0 What this doc is (and is not)

The design spec's §2 froze the adapter narrow-waist as prose (F1-F11) with census-time file:line
citations. A frozen row with **no checked artifact** is attention-dependent (the exact defect
[design §3.4 arm D3](2026-07-22-adapter-jig-design.md) was born to catch: «F11 froze schema
parity on PR-body authority alone»). This doc is that checked artifact for the **freeze itself**:
one enumerated, verifiable row per frozen element, each pointing at its canonical home and its
future gate.

It adds **no runtime behaviour**. It does **not** duplicate the `EcosystemAdapter` / `ResolveCtx`
/ `InstalledMeta` / `Tier1Result` TypeScript types — those live once, in
`allowlist-resolver.ts`; this doc and the thin re-export (§3) point at them and freeze them by
**discipline + checklist + (J2) arm**, never by a second copy.

**Freeze mechanics (inherited, not redefined here):** a FROZEN row is never stage-delegable
inside a wiring lane — changing one is owner-preconditioned per
[rule-tests-surface-design](2026-07-21-rule-tests-surface-design.md):274-279. The J3 stamping
run's STOP line is the live enforcement: «if stamping requires touching a frozen row, the jig
design failed — STOP and revise the spec first» ([design §9 J3](2026-07-22-adapter-jig-design.md)).

## §1 The F1-F11 checklist (each row = one checkable freeze)

Rows tagged **INHERITED** have their freeze authority in an existing home rule/harness; the jig
row is a conformance-arm pointer, never a second change-control authority.

Legend for **J2 gate**: the conformance arm ([design §3](2026-07-22-adapter-jig-design.md)) that
will make this row checkable in J2. `→ discipline` = frozen by review discipline + this
checklist until an arm covers it (the row has no single deterministic arm; it is fed by the
listed arms).

| # | Element (what freezes) | Canonical home — RE-VERIFIED @ `aebea3c02` | J2 gate |
|---|---|---|---|
| **F1** | `EcosystemAdapter` = `{ ecosystem; listDirectDeps(root); readInstalledMeta(root, pkg) }` + `InstalledMeta`. The 3-method seam. New capability = new **optional** method with a documented default, never a signature change. | `allowlist-resolver.ts:133-137` (`EcosystemAdapter`), `:138-141` (`InstalledMeta`) — VERIFIED EXACT | A1 (adapter resolution = pure fn of manifest) + B3 (direct-deps-only) feed it; signature-freeze → discipline |
| **F2** | `ResolveCtx` = `{ root; adapter?; ackFilePath? }`; **absent adapter ⇒ Tier-1 always misses** (fail-closed default). | `allowlist-resolver.ts:164-171` (`ResolveCtx`), `:190-196` (adapter-less back-compat miss) — VERIFIED EXACT | B1 (adapter-less ⇒ miss, live) + G2 (all callsites migrated) |
| **F3** | `tier1For` host-derivation pipeline: prefix dispatch → direct-dep gate → `[homepage, repository]` → https-host extract → canonicalize → reject IP / single-label / punycode / multi-tenant apex → empty-hosts miss. Adapters **feed** it; never re-implement or bypass. | `allowlist-resolver.ts:189-243` (`tier1For`) — VERIFIED EXACT | B1 (poisoned-host negative) + B2 (value-guard) + B3 (direct-deps) |
| **F4** | `<ecosystem>:<bareName>` naming + `KNOWN_ECOSYSTEM_PREFIXES`; unknown prefix ⇒ `'unknown'` **fail-closed**. Adding a family extends the set — a checklist item, never an adapter-local parser. | `ecosystem-name.ts:22` (`KNOWN_ECOSYSTEM_PREFIXES = {npm,cargo,pip}`), `:31-45` (`parseEcosystemName`, unknown⇒`'unknown'`) — VERIFIED EXACT | B2 (unknown-prefix fail-closed branch) |
| **F5** | Typed-const declaration idiom `export const X: EcosystemAdapter = {`. The idiom **IS** contract: two tripwires regex-detect adapters via it. A stamped adapter MUST use it verbatim. | `ecosystem-npm.ts:56`, `ecosystem-cargo.ts:364`, `ecosystem-python.ts:216` (all VERIFIED EXACT); tripwire regexes `ecosystem-adapter-precondition.test.ts:79` (VERIFIED EXACT), `ecosystem-unwired-debt.test.ts:56` (census said `~57`; corrected) | **H3** (population-equality — the gate that makes «MUST use idiom verbatim» a gate, not a checklist item) |
| **F6** | Guard family: `isUnsafeDepName` on the **NAME** surface (mandatory, every adapter, population-enforced); `resolvedWithinRoot` realpath containment on the **VALUE** surface (per path-resolving adapter, adapter-local). | NAME guard population + detector `ecosystem-adapter-precondition.test.ts:92` (regex), `:96` (describe); VALUE guard gap documented `research-source-trust.md §5 item 2` (`:48-60`) — VERIFIED | **B2** for KNOWN surfaces; new-surface births = §5 review protocol's trust dimension (recorded gap, not a shipped mechanism) |
| **F7** | Delivery-cell grammar: fresh copy / structural-merge-or-REFUSE / REFUSE + namespaced reference / always-written bans target / idempotent re-run / namespaced consumer CI workflow / `.override.md` refresh escape. Cell file names vary per family; the grammar does not. | `setup.d/45-python.sh` — matrix `:10-48`; cells: `_py_copy_or_refresh:73` (override.md escape), `_py_sgconfig_merge:85` (structural-merge/REFUSE), `_py_join_researched_rules:161`, `_py_deliver_astgrep:191`, `_py_deliver_ruff:235` (REFUSE cells iii/iv), `_py_deliver_ci:340` (namespaced CI) — **DRIFTED from census, corrected (§2)** | C1 (matrix complete) + C2 (no consumer mutation) + C4 (no orphan residue) |
| **F8** | Firing self-check shape: plant violation in `mktemp -d` ONLY, assert delivered gates fire RED, absent tool ⇒ LOUD degrade with exact manual command, `rc=0` always. Every lane ships an equivalent. | `setup.d/45-python.sh:388-460` (`_py_firing_self_check`); wired `install.sh:215` (source) + `:226` (call) — **DRIFTED from census (`:340-412`; `install.sh:217`), corrected (§2)** | E1 (scratch red/green pair) + E2 (self-check resolves delivered config) |
| **F9** | Snapshot byte-identity harness + per-stack baselines; volatile artefacts excluded **per-file** — INHERITED (authority = the snapshot harness itself). | `tests/install-sh/snapshot.sh:38-62` (per-file exclusion discipline — VERIFIED EXACT), `:79-91` (python fixture dispatch) — census python rows `:239-250` **DRIFTED (§2)** | **C3** (exclusion masks no drift) |
| **F10** | CI-arm exact-pin posture; framework + consumer mirrored pin strings bump together — INHERITED (authority = [ci-tool-pinning.md] Rule A). | Framework: `.github/workflows/audit-self.yml:242` (`ruff==0.15.21`), `:257`/`:271-272` (`rust 1.96.1`) — **DRIFTED from census (`:231-232`,`:241-242`), corrected**; consumer mirror: `packages/core/templates/python/github-actions-ci.yml:7` (`@ast-grep/cli@0.44.1, ruff==0.15.21`) — **census wrongly cited `45-python.sh:320-322` (§2)** | **P1** (pinned toolchain + two-surface pin-sync) |
| **F11** | rules-lock schema parity: the CROSS-LANE **core field set** `{schemaVersion, framework, version, ruleIds, emittedAt, sourceFingerprint}` (= exported TS `RulesLock`) FROZEN-by-parity across lanes; per-lane tool-ban fields (e.g. python `ruffBans`) are per-lane-named EXTRAS (may be absent), never colliding with a core name. PLACEMENT stays FREE per §2.2. | `packages/core/installer/types.ts:36-43` (`RulesLock` core set) — VERIFIED EXACT (note: `ruffBans` is a bash-emitted lock EXTRA, **not** in the TS type — confirms F11's «NOT the TS type verbatim») | **D3** (schema parity, set-compare on ACTUAL emitted JSON) |

## §2 Live re-verification — census-vs-staging citation drift (T3)

The design spec's §2 citations were verified at `ffa571149`, which predates the W2-W4 merges.
Per [ai-laziness-traps.md T3](../../../.claude/rules/ai-laziness-traps.md), every row above was
RE-verified live at the J1 base `aebea3c02`. Nine of the eleven canonical homes are **byte-exact**
at the cited lines; the four below **drifted** (the lanes grew — W3 researched-rules join, W4/W5
lock writer + cargo lane, CI pin bumps) and are corrected in §1:

| Row | Census citation (@ `ffa571149`) | Corrected home (@ `aebea3c02`) | Cause of drift |
|---|---|---|---|
| F5 (unwired-debt regex) | `ecosystem-unwired-debt.test.ts:~57` | `:56` | minor line shift (approximate citation in census) |
| F7 | `45-python.sh:10-38, :73-79, :85-145, :148-184, :187-258, :292-329` | matrix `:10-48`; cells `:73`,`:85`,`:161`,`:191`,`:235`,`:340` | W3 `_py_join_researched_rules` (`:161`) + W5 join path inserted ahead of the deliver cells; file grew 45→626 lines |
| F8 | `45-python.sh:340-412`; wired `install.sh:217` | `45-python.sh:388-460`; wired `install.sh:215`(source)+`:226`(call) | same F7 growth pushed the firing self-check down |
| F9 | `snapshot.sh:239-250` (python rows) | `snapshot.sh:79-91` (python dispatch) | snapshot.sh restructured (now 322 lines); the `:38-62` exclusion block is unchanged/EXACT |
| F10 | `audit-self.yml:231-232, :241-242`; consumer `45-python.sh:320-322` | framework `audit-self.yml:242`,`:257`,`:271-272`; consumer `templates/python/github-actions-ci.yml:7` | W4 cargo CI arm added rows above the ruff/rust pins; consumer pins live in the CI **template**, never in `45-python.sh` (census mis-attributed the consumer mirror) |

The **frozen interface surface** (F1-F4, F11 — the types + naming + lock core-set) did **not**
change between the two states: F1/F2/F3/F4/F11 verify byte-exact at their census lines. Only the
delivery/firing/snapshot/CI **implementation** homes moved, which is expected — those are FREE-
per-lane bodies whose *grammar* is frozen, not their line positions.

## §3 The exported contract surface

`packages/core/research/adapter-contract.ts` is a **thin type re-export** (no runtime code) that
names the frozen F1/F2 surface as a single import point — «the frozen adapter contract surface» —
re-exporting `EcosystemAdapter`, `InstalledMeta`, `ResolveCtx`, `Tier1Result`, and
`ResolvedSources` from their canonical home (`allowlist-resolver.ts`) with a doc-comment pointing
here. It duplicates **no** definition (that would be `#parallel-evolution-creep`); it gives future
adapter authors a stable «import the contract, not the resolver internals» seam and keeps the F5
typed-const idiom (`: EcosystemAdapter =`) resolvable from one blessed module. Purely additive,
`tsc`-clean, zero behaviour change — a re-export declares no `EcosystemAdapter` **value**, so it
does not enter the F5/F6 tripwire populations.

## §4 §1.7 self-reflexive note

**Forward-check (this checklist complies with active disciplines):**

- [doc-authority-hierarchy.md §2-§3](../../../.claude/rules/doc-authority-hierarchy.md) — Authoritative-for
  header present; the Class field is rule-files-only per §3 and correctly absent here (non-rule
  spec, same shape as the parent design). ✓
- [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — markdown + a type re-export;
  no CI gate, no API call. ✓
- [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — REFERENCE:
  no new capability, no duplicated type; the doc POINTS at the one canonical definition. ✓
- [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md) — T3: every row's home
  re-verified live at `aebea3c02` (§1 «VERIFIED EXACT» / §2 drift table), the census lines NOT
  copied blindly; T15: this checklist is the freeze applied to itself — a frozen contract with
  its own checked artifact, the D3-arm-motivating defect answered for the whole §2. ✓

**Backward-check (class = frozen-contract-bearing artefacts of the adapter jig; sibling sweep):**

- [2026-07-22-adapter-jig-design.md §2](2026-07-22-adapter-jig-design.md) — SUBORDINATED, not
  contradicted: this doc re-expresses §2 as a checklist and SUPERSEDES its census citations only
  where they drifted (§2 table), never the freeze semantics. SWEPT-CLEAN. ✓
- The five canonical homes (`allowlist-resolver.ts`, `ecosystem-name.ts`, the three
  `ecosystem-*.ts` adapters, `installer/types.ts`, `snapshot.sh`, `audit-self.yml`,
  `45-python.sh`, the python CI template) — all cited as pointers, none modified by this doc.
  SWEPT-CLEAN. ✓
- `research-source-trust.md §5 item 2` — the F6 VALUE-guard gap is cited as the recorded sentinel,
  consistent with (not superseding) its home rule. SWEPT-CLEAN. ✓

## See also

- [2026-07-22-adapter-jig-design.md](2026-07-22-adapter-jig-design.md) — BINDING design (§2 the frozen contract this checklist checks; §3 the 22 arms it forward-references).
- [agents/adapter-jig-reviewer.md](../../../agents/adapter-jig-reviewer.md) — the named cold-review protocol (design §5 step 2) that walks the §3 groups as review dimensions.
- `packages/core/research/adapter-contract.ts` — the thin exported contract surface (§3).
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT (the adapter-conformance-jig entry added by J1).
