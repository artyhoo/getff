<!-- scope: beta-ai-docs-agnosticism S3 D3 — owner-gated patch proposals (P1 zcode-doctrine D7 conversion, P2 living-docs-auditor contradiction, P3 README claim drift). Flagged for MAINTAINER SIGN-OFF; this stage made ZERO direct edits to the proposal targets. -->

# S3 owner proposals — three owner-gated fixes awaiting maintainer sign-off

> **Authoritative for:** the D3 deliverable of beta-ai-docs-agnosticism S3 — patch PROPOSALS for
> files this stage may not edit (maintainer-owned agents, `.claude/rules/*`, README.md).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists).
> Inventory of derivable-prose rows: [2026-09-01-s3-derivable-prose-inventory.md](2026-09-01-s3-derivable-prose-inventory.md).
> Spec: [2026-07-23-beta-program-design.md §6 C5 + §2 D7](../../superpowers/specs/2026-07-23-beta-program-design.md).

Per the Artifact Ownership Contract (CLAUDE.md) and the spec D7 carve-out, every proposal below
ships its machinery (renderer / evidence / suggested wording) OUTSIDE the owner-gated path; the
owner lands the file change. None has been applied.

---

## P1 — zcode-parity-doctrine §2: convert the derivable rollup to a generated section

**Target (owner-gated):** `.claude/rules/zcode-parity-doctrine.md` §2 (hook census table).
**Ownership class:** `.claude/rules/*` — maintainer-only. **Inventory row:** D2-table row 4
(`PROPOSE-to-owner`).

**What is derivable (the D7 falsifier applied):** only three quantities in §2 are functions of a
mechanical source — the hook population, the plugin-twin presence set, and the classification
rollup (the doctrine itself already carries a hand-counted rollup at `zcode-parity-doctrine.md:65`).
The per-row classification RATIONALE («works via 4D hybrid», degraded-arm wording) is judgment
prose and STAYS hand-maintained in the table. The proposal converts only the compact counts.

**Scope reconciliation (round-1 fidelity fix, 2026-09-01) — the kickoff's «§2/§3 status columns»
vs this proposal's narrow §2-counts scope:**

- **§2 Status column (`:35-63`) — judgment-bearing, stays prose.** The D7 falsifier («a doc class
  proves non-derivable → it stays prose with an owner and a review trigger»): each Status cell is
  a per-row design verdict carrying its rationale, e.g. `:61` «works via 4D hybrid (#1046):
  PostToolUse:Agent real-time arm + Stop completeness arm deliver the report the SubagentStop
  event would have carried», `:62` «impossible (event ∉ `ZCODE_EVENTS`); CC harness feature, not
  in default settings». None of these is a mechanical function of a source of truth; a renderer
  that emitted them would be laundering judgment through a fence (T-BAD-C). The derivable residue
  of §2 — the rollup counts — is exactly what this proposal converts.
- **§3 Stage/Status/PR table (`:71-84`) — PARKED (§6), not converted and not asserted
  judgment-bearing.** The §3 Status cell («Implemented» / «Implemented (research only)») is
  _borderline-derivable_: it is a function of each row's cited PR's merge state, but the only
  faithful source is networked (`gh pr view`) or heuristic (git-log search per row) — both break
  the offline-safe, deterministic drift-gate design every S3 renderer shares. Per kickoff §6
  (which names «the zcode-doctrine proposal's scope» as a park-prone spot), the maintainer picks:
  **Option A** — widen the P1 renderer with a second generated section for §3 Stage/Status/PR,
  sourced from git/PR state; consequence: the gate's source becomes networked or
  heuristic-derived (non-deterministic offline), and Decision/Notes stay hand-maintained beside a
  generated Status column. **Option B** — §3 STAYS-PROSE with owner + trigger (D7 falsifier
  line): owner = framework maintainers (`.claude/rules/*`); trigger = any stage merge or
  Wave-B status flip; consequence: hand-sync continues, but owned and triggered instead of
  silent. Until sign-off, P1 does NOT claim §3 and the doctrine's §3 status-drift class must NOT
  be considered closed by landing P1. (The failure the round-1 audit named — «maintainer lands
  P1 believing status-drift is closed while §3 keeps hand-syncing» — is closed by THIS
  paragraph, either by the park record or by a later Option-A widening, not by silent omission.)

**Machinery already shipped (this stage, outside the owner path):**
`scripts/render-zcode-parity-rollup.mjs` — PROPOSAL renderer, uncommitted-to-CI by design.

Measured output at authoring (branch `feature/beta-ai-docs-agnosticism-fc864f`):

```text
$ npx tsx scripts/render-zcode-parity-rollup.mjs --emit ; echo "EXIT=$?"
[render-zcode-parity-rollup] hooks: 21; plugin twins: 15; table rows parsed: 21
- Hook population: **21** (= `ls .claude/hooks/*.sh | wc -l`)
- Plugin twins shipped: **15** of 21 — `ask-question-reminder`, … (15 names)
- Classification rollup (census SSOT): `framework-internal` = 2; `parity` = 11; `plugin-gap` = 1;
  `zcode-gap` = 4; `cc-only` = 3; Total = 21
EXIT=0
```

Cross-check against the hand rollup: doctrine `:65` reads «`parity` (strict) = 10 …; `parity` with
role annotation = 1 (15); `framework-internal` = 2 …; Total = 21» — the renderer merges the strict +
annotated parity rows into one `parity` = 11 bucket (annotation variant is preserved in the row
prose). All other buckets identical; Total identical.

Fail-loud before landing (the renderer refuses to be silently green):

```text
$ npx tsx scripts/render-zcode-parity-rollup.mjs --check ; echo "EXIT=$?"   # unpiped
✗ target fence `getff:begin section=zcode-parity-rollup` not present in .claude/rules/zcode-parity-doctrine.md yet —
  the landing is a MAINTAINER action (proposal: …/2026-09-01-s3-owner-proposals.md §P1).
EXIT=2
```

**Maintainer landing plan (3 steps, precedent: `00-rule-index.md` via `render-rule-index.mjs`):**

1. Paste the `--emit` body into a fence at the end of doctrine §2 (after `:65`):
   `<!-- getff:begin section=zcode-parity-rollup plan=scripts/render-zcode-parity-rollup.mjs -->` …
   `<!-- getff:end section=zcode-parity-rollup -->` (REUSE of `packages/core/composition/fence.ts`
   machinery — SSOT #208 — no second fence engine).
2. Flip the renderer's `--check` arm from fail-loud-exit-2 to the `regionsMatch` body-compare
   (mirror `scripts/render-presets.mjs:89-103`).
3. Wire `- run: npx tsx scripts/render-zcode-parity-rollup.mjs --check` into
   `.github/workflows/audit-self.yml` → `manifest-render-check` (the pattern of the two S3
   gates already wired there — `render-install-roster` + `render-presets`; `render-rule-index`
   and `render-rules` predate S3). Do NOT wire step 3 before step 1 — the current exit-2 makes a
   premature CI wiring red, never silently green.

**Explicitly NOT absorbed:** the parked D3 loud-declaration sync
(`scripts/render-harness-config.mjs:256-268`, doctrine `:69` «deliberately parked») stays parked —
separate wording + snapshot consequences, separate decision.

---

## P2 — living-docs-auditor.md: `/aif-verify` gate contradiction

**Target (owner-gated):** `agents/living-docs-auditor.md` — framework-maintainer-owned (Artifact
Ownership Contract). **Inventory row:** D5(ii).

**The contradiction (both lines quoted at HEAD):**

- `agents/living-docs-auditor.md:110` — «2 FAIL, 1 WARN — `/aif-verify` blocked.»
- `agents/living-docs-auditor.md:173` — «Only FAIL blocks `/aif-verify`.»
- `skills/getff/SKILL.md:128` — «`/aif-verify` — a pre-PR command belonging to the EXTERNAL AI
  Factory tool, which this installer does not bundle … not a step in this project's gate».

The agent asserts a blocking gate that the shipped skill explicitly denies exists in this
project. A consumer following the auditor would wait for a gate that never runs.

**Replacement text (carried VERBATIM from S1 — PR #1311 body, `## Parked questions` item 3;
provisioned host-side 2026-09-01 by the coordinator, replacing the round-0 P-GH park):**

- `agents/living-docs-auditor.md:110` → «2 FAIL, 1 WARN — the pre-PR gate blocks
  (`./scripts/audit-ai-docs.sh`; under an external AI Factory this surfaces as `/aif-verify`).»
- `agents/living-docs-auditor.md:173` → «Only FAIL blocks the gate.»

Provenance: PR #1311 body, parked question 3 (S1's reviewed wording — carried, not re-drafted).
Still a PROPOSAL: zero direct edits to `agents/living-docs-auditor.md` by this stage (D7
carve-out); the maintainer lands these two line replacements at sign-off.

---

## P3 — README.md claim drift (feeds from the D4 cold-auditor dry-run)

**Target (owner-gated):** `README.md` §Why-this-exists-adjacent claims — deliberate-edit surface.
**Source:** cold dry-run of `agents/claims-conformance-auditor.md` over README (this stage):
56 claims enumerated, 47 VERIFIED / 6 GAP / 3 UNVERIFIABLE. GAP rows, each with the probe output
(re-run this session). **Cold-QA recheck (same day):** the `:30` ESLint row did NOT survive its
recheck — retracted in-table below; **5 actionable rows** remain:

| README line        | Doc says                                                                     | Probe → actual                                                                                                                                                                                                                                                                                                                                                                                                                           | Correct claim                                                                                          |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `:20`              | «8 shipped by default» sub-agents                                            | `npx tsx scripts/render-install-roster.mjs` roster → **11** `.claude/agents/` files shipped (aif-init, capability-reuse-auditor, claims-conformance-auditor, compliance-verifier, docplan-auditor, fidelity-auditor, living-docs-auditor, memory-codification-auditor, review-sidecar, rule-researcher, rule-test-author)                                                                                                                | «11 shipped by default» — or render the roster line from the installer manifest (P1-pattern candidate) |
| `:30`              | «ESLint 10 flat config»                                                      | **RETRACTED on recheck (2026-09-01, same session):** the dry-run's quoted probe output was unreproducible — root `package.json` contains **no** `eslint` key; the shipped pin is `packages/core/package.json:94: "eslint": "^10.4.0"`, so README:30 «ESLint 10 flat config» is **correct as written**. No change proposed. (Only `packages/preset-react-spa/package.json:25` pins `^9.0.0` — a React preset, not this claim's referent.) | — (README stays)                                                                                       |
| `:133`, `:218-220` | install prints «`npx husky init`» + «`npx depcruise --init`» as wiring steps | `setup.d/99-finalize.sh:425` → «do NOT run 'npx husky init' — it would clobber the shipped .husky/pre-commit + pre-push»; `setup.d/40-configs.sh:367` → `.dependency-cruiser.cjs` is COPIED by the install (no `--init` needed)                                                                                                                                                                                                          | drop both instructions; installer ships the hooks path + depcruise config itself                       |
| `:191`             | «R4 … returns `pass` with `(skipped: no src/domain)`»                        | `packages/core/audit-self/audit-ai-docs.ts:191` → `return { result: 'warn', message: …(skipped: no src/domain…) }` — the skip is **WARN**-classed, not `pass` (R17 half of the caveat not re-probed this session; needs its own firing check before rewording)                                                                                                                                                                           | «R4 reports WARN (skipped)» — the caveat's R4 example no longer exists as written                      |
| `:285`             | Wave B stages 5/6/7B/9C «implementation-pending»                             | `.claude/rules/zcode-parity-doctrine.md:69` → «Status column reflects runtime reality for all Wave B stages (5/6/7B/9C merged via #1043/#1044/#1046/#1047)»                                                                                                                                                                                                                                                                              | «implemented and merged»; keep doctrine §3 as the live status SSOT                                     |
| `:274`             | «all 20 hooks»                                                               | `ls .claude/hooks/*.sh \| wc -l` → **21**                                                                                                                                                                                                                                                                                                                                                                                                | «all 21 hooks» — or derive from the census (P1-pattern candidate)                                      |

(The 3 UNVERIFIABLE rows — macOS/CI-minutes runtime-behaviour claims — need a human probe; not
patch material.)

**Suggested mechanism (for maintainer consideration, not built):** rows like `:20`/`:274` are
roster counts — the same derivable class D2 migrated elsewhere; if the maintainer prefers, they
convert to generated sections fed by the installer manifests rather than being hand-corrected
(now), so the drift class closes instead of being re-fixed at the next agent/hook landing.

---

## Sign-off record

| Proposal | Target owner                 | Direct edits made by this stage | Machinery location                       |
| -------- | ---------------------------- | ------------------------------- | ---------------------------------------- |
| P1       | `.claude/rules/*` maintainer | **none**                        | `scripts/render-zcode-parity-rollup.mjs` |
| P2       | framework maintainers        | **none**                        | evidence quoted above                    |
| P3       | README maintainers           | **none**                        | evidence table above                     |

`git diff --name-only` against the three targets is empty at this branch's tip (verified in the
PR body §4 acceptance item).
