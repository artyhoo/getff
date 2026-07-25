<!-- scope: stage kickoff — beta-delivery-ux S1 (install depth profiles, spec A1). Dispatch input for ONE buildable task; the umbrella plan lives in ../beta-delivery-ux-meta-launch/kickoff.md and is NOT this file's scope. Tier 2 (no bridge-profile marker): top tier plans, executor implements + reviews. -->

# beta-delivery-ux S1 — install depth profiles (A1)

> **Type:** execution-build, single PR onto `staging`.
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §4 **A1** is the design SSOT. On any divergence between this kickoff and the spec, **the
> spec wins** — surface the divergence, never improvise past a binding decision.
> **Umbrella context (read-only):** [`../beta-delivery-ux/kickoff.md`](kickoff.md) §2 row S1 +
> [`../beta-delivery-ux-meta-launch/kickoff.md`](../beta-delivery-ux-meta-launch/kickoff.md) §4 Stage 1.
> **Base branch:** `staging`.

## §0 Goal

Ship three named install depth profiles over the existing flag machinery, so a consumer picks
a depth instead of assembling flags, and no shipped convenience or guard is silently lost
between depths.

- **`core`** — default; today's default + full killer payload.
- **`env`** — `core` + `/arch`, tier-home doc, pipeline presets, status, night-mode/SDD. No aif runtime.
- **`factory`** — `env` + dispatcher/harvest/aif-doctor, runtime-bridge wiring, GLM one-button.

Selection surfaces: `--profile <name>` flag (agents/CI — flag-first), a TTY menu for humans,
and an AI-dialog smart default in `INSTALL-FOR-AI.md`. Each profile carries a **one-line
consequence description** at the prompt (ADOPT the rustup profile *vocabulary*).

Upgrade path = **re-run with a deeper profile**, using our stateless `--refresh` regen
semantics. This is NOT rustup's additive-components model — see T16 below.

## §1 Do this FIRST — U3 residue sweep (T17/T18, destructive-delegation guard)

Two dormant branches carry un-merged work on this exact surface. **Inspect both BEFORE writing
anything to `install.sh` / `setup.d/`.** Preserve future-value residue; verify redundancy
**empirically** (diff against `staging`), never from a branch name or from the table below.
Keeping is reversible; deleting is not.

| Branch | Ahead of staging | Last commit | Surface |
|---|---|---|---|
| `mif-s3-integ` (= `origin/mif-s3-revive-toolbootstrap`) | 5 commits | 2026-06-26 | tool-bootstrap layer revival, static stack column, `setup.d/05-mcp.sh` 5-field manifest read, `audit-self.yml` wiring |
| `feature/modular-install-fullpack-f6366e` | 2 commits | 2026-06-24 | `install.sh` → `setup.d/**` modularization + `PKG_ROOT` BASH_SOURCE fix; **likely already superseded by merged work — verify, do not assume** |

Record the sweep verdict per branch (SUPERSEDED-with-evidence / RESIDUE-PRESERVED-at-`<path>`)
in the PR body. A silent supersede is a T17 violation.

## §2 The payload inventory — this is the deliverable's spine

Produce a **per-profile payload inventory**: for every shipped artefact, a per-profile verdict.

**Two hard requirements (both are operator requirements from spec §4 A1, not preferences):**

1. **No shipped comfort or shield may be lost between profiles.** The inventory explicitly
   covers the convenience + guard hook set already shipping today: end-of-turn recap,
   ask-question reminder, inject-matching-rule, deps-hash staleness, plus the `.husky`
   pre-commit / pre-push gate chain.
2. **RE-TRIAGE today's dogfood-vs-consumer hook split — do not inherit it.** At `env`/`factory`
   depth the consumer authors their OWN kickoffs and AI docs, so contour-guard hooks
   (`check-kickoff-traps`, doc-authority checks) become consumer-relevant *shields* there.
   **Record a per-hook verdict per profile.** «It was dogfood-only before» is not a verdict.

**Satellite verdicts (operator-confirmed, spec §4 A1 — implement, do not re-litigate):**

- **AI Factory** — the FILE CONVENTION (`.ai-factory/` passport) stays core-shipped and
  load-bearing; the TOOL (`/aif-*` commands) is deliberately NOT shipped.
- **Superset** — recommendation + setup recipe only, never a default install.
- **aif-handoff** — the `factory` profile UPGRADES its `companions.manifest` row from
  detect+instruct to a consented guided INSTALL. **Scope note:** the *implementation* of that
  guided install is S4's job, not this stage's — S1 ships the profile's payload declaration and
  the inventory row, and stops there.

## §3 Descope — the go lane (verified at authoring, re-verify at entry)

Covered lanes: **js / python / cargo**. The **go lane is DESCOPED** — adapter-jig J3 is not
merged and `setup.d/47-go.sh` does not exist on `staging` (verified: `git ls-tree origin/staging
setup.d/` lists `46-cargo.sh`, no go file). Spec §8: «J3 owns `setup.d/47-go.sh` — A1 profiles
list it only after J3 merges».

**Re-verify this at stage entry — in BOTH directions** (T-BDU-C): if J3 has since merged, the
go row is in scope; if it still has not, do NOT create `setup.d/47-go.sh` here. If you find
yourself needing that file, **STOP and park the question**.

## §4 «Works» — acceptance (explicit + testable, evidence quoted in the PR body)

1. **Fresh-machine smoke per profile** — `core`, `env`, `factory` each install cleanly.
   Command + captured output, per profile. Prose does not count (T3).
2. **`--refresh` upgrade path proven** — install at `core`, re-run at `env`, show the deeper
   payload actually arrived and nothing from the shallower depth was lost.
3. **Existing flag back-compat kept** — every flag that worked before still works; profiles are
   a layer OVER the flag machinery, not a replacement for it.
4. **Payload inventory complete against the shipped population** — enumerate what EXISTS first
   (`ls`/`git ls-files` over the shipped hook/skill/template set), then verdict each row per
   profile. An inventory assembled from the artefacts you happened to open is a T10 violation.
5. **Non-TTY path works flag-only** — `--profile env` with no terminal must not block on a menu.

## §5 Out of scope (do NOT do these here)

- Pipeline presets / `/pipeline status` / the workspace one-command → S2.
- The tier-home doc + the CLAUDE.md pointer-ization → S3.
- The GLM one-button flow and the aif guided-install *implementation* → S4.
- Shipping `/arch` + `claude-glm-executor-handoff` into the skill set, runtime-bridge vendoring → S5.
- npm release mechanics, `files` allowlist, name freeze → R1.
- Killer-layer code (generation, trust threading, freshness engines) — track 1 owns it.
- Creating `setup.d/47-go.sh` (§3).
- Editing `/arch` or `claude-glm-executor-handoff` CONTENT.

## §6 AI-laziness traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this stage: T3, T7, T10, T13, T16, T17, T19, T20, T21.**

- **T3** — every «works» claim carries command + output. Fresh-machine smokes, not prose.
- **T7** — do not pattern-match §4 into checkbox theater; the gates are live-fired evidence.
- **T10** — enumerate the shipped population BEFORE verdicting it (§4 item 4).
- **T13** — ADOPTED ≠ zero-work. rustup profiles and clig.dev flag-first are adopted for OUR
  problem class; confirm the upstream evidence transfers.
- **T16** — rustup is an ADOPTED **pattern**, not code. Write the explicit line: «Upstream
  problem class: X. Our problem class: Y. Match? evidence: …». Our upgrade is stateless-regen
  (`--refresh`), rustup's is additive components — the vocabulary transfers, the mechanism does not.
- **T17** — the §1 residue sweep happens BEFORE any supersede call.
- **T19** — own adversarial cold-QA of the diff before handoff. CI ≠ design review.
- **T20** — verdicts (per-hook profile calls, supersede calls) carry file:line or command output.
- **T21** — the Backward-check enumerates **sibling surfaces**, not your diff (§8).
- **T-BDU-A (domain)** — «the profile payload looks complete because the happy stack installed».
  Completeness is judged against the §2 inventory on ALL covered lanes (js/python/cargo), never
  against one demo run.
- **T-BDU-C (domain)** — «the neighbor gate is probably clear by now». §3's go-lane verdict is a
  snapshot; re-check it at entry in both directions.

## §7 Park-don't-guess contract (BINDING — this task runs autonomously)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
> `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
> Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep
> moving" is the failure this whole loop exists to prevent.

Known fork-prone spots in this stage — park these rather than guessing: which shipped hooks
belong at which depth when the re-triage (§2 item 2) is genuinely ambiguous; whether a U3
residue commit (§1) is superseded when the diff is not decisive; any case where the profile
boundary would change WHAT gets built rather than HOW.

Technical forks strictly inside the kickoff bounds (which bash idiom, where to put a helper,
how to structure the inventory table) are yours to resolve — resolve them and record why.

## §8 PR-body requirements (both gates are REQUIRED checks on `staging`)

This stage touches `setup.d/**`, `install.sh`, `INSTALL-FOR-AI.md` and
`packages/core/templates/**` → **the §1.7 mandate is ON**.

**Required sections — H3 depth (`###`), the word «applied» is required, ≥40 non-whitespace
chars in EACH body, ≥1 `path.ext:N` citation per section:**

```markdown
### §1.7 Forward-check applied

<which existing disciplines were checked, with file:line evidence>

### §1.7 Backward-check applied

<sibling-surface sweep — see below>
```

**T21 — the Backward-check is where this stage will fail if you rush it.** Enumerate sibling
surfaces the diff did NOT touch and verdict each (`SWEPT-CLEAN(evidence)` / `GAP-FOUND(action)`).
The class-surfaces here: `install.sh`, `setup.d/**`, `INSTALL-FOR-AI.md`, the plugin channel
(`plugin/hooks/**`), the zcode twins, `packages/core/templates/**`. A Backward-check whose
surface list equals your own diff's file list is non-conformant by format.

**Also required: a `## Fidelity verdict` section.** `fidelity-verdict-in-pr-body` is a REQUIRED
staging check. **`FIDELITY: skipped` is NOT available to this PR** — it is a stage PR. It needs
a real GO block from a cold [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md)
run: `FIDELITY: GO` + `Basis:` + `Round:` + `Audited-SHA:` (must prefix the PR head SHA at merge
time) + ≥1 file:line evidence on a line other than `Basis:`. Exactly one such section, exactly
one `FIDELITY:` line — a rework round REPLACES the block, never appends.

**Pre-flight before `gh pr create`** (compose the body first, then check):

```bash
echo "$PR_BODY" | grep -cE '^### §1\.7 (Forward|Backward)-check applied'   # must be 2
echo "$PR_BODY" | grep -cE '[^[:space:]]+\.[a-z]+:[0-9]+'                  # must be >=2
```

## §9 Stop conditions

- A design decision would diverge from the binding spec → STOP and surface the divergence.
- You need `setup.d/47-go.sh` or a go-lane row → STOP (§3).
- The §1 residue diff is not decisive about supersession → park, do not guess.
- The §2 re-triage hits a hook whose depth is genuinely ambiguous → park.
- Local CI-equivalent sweep goes red from a branch-introduced cause → fix before handoff.
