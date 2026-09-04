<!-- scope: stage kickoff — beta-delivery-ux S2 (pipeline presets + /pipeline status + workspace one-command, spec A4/A5/A9). Dispatch input for ONE buildable task; the umbrella plan lives in ../beta-delivery-ux-meta-launch/kickoff.md and is NOT this file's scope. Tier 2 (no bridge-profile marker): top tier plans, executor implements + reviews. -->

# beta-delivery-ux S2 — pipeline presets + status + workspace one-command (A4/A5/A9)

> **Type:** execution-build, single PR onto `staging`.
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §4 **A4, A5, A9** are the design SSOT. On any divergence between this kickoff and the spec,
> **the spec wins** — surface the divergence, never improvise past a binding decision.
> **Umbrella context (read-only):** [`../beta-delivery-ux/kickoff.md`](kickoff.md) §2 row S2 +
> [`../beta-delivery-ux-meta-launch/kickoff.md`](../beta-delivery-ux-meta-launch/kickoff.md) §4 Stage 2 (S2 bullet) + §2.1 shared-surface ATTN.
> **Base branch:** `staging`.

## §0 Goal

Three daily-use UX artefacts that kill the «what do I run next?» question for both agents and humans:

1. **Pipeline launch presets (A4)** — four declarative presets (`aif` / `night` / `economy` / `sdd`)
   in pipeline `references/` as **data, not prose**; activated by `--preset <name>`
   (flag/env first per clig.dev); surfaced by a list verb; PROPOSED via a TTY row in the §3
   launch-table. Embeds at the three existing seams: the `--mode-*` override parser, the §2.5
   routing predicates, and the kickoff bridge-profile marker.
2. **`/pipeline status` (A5)** — read-only, sectioned status (in-factory / parked questions /
   ready-to-harvest + PR state), ending with suggested-next-command lines. Extension of the
   no-arg overview; NOT a dashboard.
3. **Workspace one-command (A9)** — `getff work <name>` composes worktree creation
   (REUSE `scripts/create-worktree.sh`) + dep wiring + per-detected-harness session start.
   CC → DEFER entirely to native flow; non-CC → launch/print; flag-first/non-TTY prints.

Ships in **`env`+** profiles. This is the first stage that lands real `env` payload
(S1 shipped `env` as a declaration identical to `core` — see meta-launch state.md OPEN owner fork).

## §1 Inputs (re-verify at entry)

- **`scripts/create-worktree.sh`** EXISTS on staging (`-rwxr-xr-x`, 7.3KB, verified at authoring).
  A9 REUSES it + ships it (zero `install.sh`/`setup.d` references today — verify still true at entry).
- **Pipeline mode-override parser** = `helpers/parse-override-flags.sh` (`.zcode/skills/pipeline/SKILL.md:48`,
  emits `OVERRIDE_MODE`/`OVERRIDE_REASON`). Presets embed at this seam + §2.5 Step 5 routing
  predicates (`.zcode/skills/pipeline/SKILL.md:183-185`) + the kickoff bridge-profile marker
  (emitted in `references/` → consumed by `dispatch.ts`).
- **`references/` dir** — `.zcode/skills/pipeline/references/` EXISTS today (contains
  `output-format.md`, `mode-overrides.md`, etc.). Preset data files land HERE.
- **`questions.ts`** = `packages/runtime-bridge/src/cli/questions.ts` (parked-questions collector).
  `/pipeline status` reads it for the «parked questions» section.
- **Bridge REST** = `curl "${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}/..."` — `/health`,
  `/runtime-profiles`, task list endpoints. `/pipeline status` reads these for the «in-factory» section.

### §1.1 Neighbor gate re-check (T-BDU-C)

- **Marker-emitting presets** (`economy`, `aif`) → emit `bridge-profile` marker. Acceptance-contour D1
  is UNBLOCKED (spec + `fidelity-verdict-in-pr-body` required-check both on staging). **Re-verify at entry.**
- **go lane** — this stage does NOT touch `setup.d/47-go.sh` (no install-surface payload here). go-lane
  descope is IRRELEVANT to S2. If you find yourself touching install-surface, STOP (out of scope).

## §2 The four presets — data, not prose (A4)

Define each preset as a **data file** in `.zcode/skills/pipeline/references/presets/<name>.json`
(or `.yaml` — pick the format that the existing `references/` files use; if mixed, match the
`mode-overrides.md` lineage). Each preset encodes a Mode decision + review posture + marker.

| Preset | Mode | Reviewer tier | bridge-profile marker? | When to pick |
|---|---|---|---|---|
| `aif` | autonomous (aif-handoff) | aif's own | **YES** — `bridge-profile: <full name>` | unattended / overnight dispatch |
| `night` | Mode-A inline (SDD) | session-bound | no | night-mode unattended single-session |
| `economy` | whole line on executor tier | cheap reviewer | **YES** — `bridge-profile: <full name>` | cost-conscious whole-line |
| `sdd` | in-session (SDD) | session-bound | no | interactive single-feature |

**Binding constraints from spec A4:**

1. **Menu-only UX is REJECTED** (breaks agents/CI). The `--preset` flag + env var MUST work
   non-interactively. The TTY menu row is ADDITIVE, never the only path.
2. **Flag/env first per clig.dev** — `--preset <name>` and `AIF_PIPELINE_PRESET=<name>` both resolve.
   Precedence: flag > env > default (no preset).
3. **The marker value must be the profile's FULL DISPLAY NAME, UNIQUE** under the resolver's
   case-insensitive substring match — verify against the live list at authoring:
   `curl -s "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles" | jq -r '.[].name'`. An ambiguous value
   aborts dispatch with `dispatch_failed` (3 prior recurrences — see CLAUDE.md «Marker value rule»).

**Preset data schema (PARKED — consumed across 3 seams, a wrong guess cascades):**
each preset data file's SCHEMA (the field names + structure) is a genuine fork — it is consumed by
the parser (seam #1), the routing predicates (seam #2), AND the marker emitter (seam #3), so a
schema chosen in isolation breaks the other two seams. Do NOT decide the schema alone. Park it with
at least two candidate schemas sketched + which seam each field serves. Candidate A (flat):
`{mode, reviewer_tier, marker: <name|null>, predicates: {bundle_opt_in, review_required, parallel_safe}}`.
Candidate B (layered): `{routing: {...}, marker: {...}, display: {...}}`. The maintainer picks;
implement the chosen one. (The `.json` vs `.yaml` FORMAT is a separate, lesser fork — also parked
in §7, but lower-stakes than the schema.)

**Three seams where presets embed (spec A4 — implement all three; the mechanism for each is parked):**

1. **`--mode-*` override parser** (`helpers/parse-override-flags.sh`) — a preset expands to the
   equivalent `--mode-*` flags it encodes. `--preset economy` ≡ `--mode-pair --reason=economy`.
   **Mechanism fork (park):** edit `parse-override-flags.sh` to translate preset→flags, OR add a
   preset-resolver that feeds the existing flag path. Park which.
2. **§2.5 routing predicates** (`.zcode/skills/pipeline/SKILL.md:183-185`) — a preset sets the
   `bundle_opt_in` / `review_required` / `parallel_safe` predicates to its encoded values,
   short-circuiting the routing tree. **Mechanism fork (park):** edit the routing tree directly,
   OR feed predicates via the preset-resolver from seam #1. Park which (the two seams may share
   one resolver — that is itself the design choice).
3. **Kickoff bridge-profile marker** — `economy`/`aif` presets emit the marker line into generated
   meta-kickoffs; `night`/`sdd` do not.

## §3 `/pipeline status` (A5) — read-only, sectioned

Extend the no-arg overview (§2 V3 path in SKILL.md) with a `status` subcommand. Three sections,
each rendering against LIVE bricks — never cached/stale:

| Section | Source | Renders |
|---|---|---|
| In-factory | bridge REST (`/health`, task list) | running aif tasks + their state |
| Parked questions | `questions.ts` output | each parked task + its fork |
| Ready-to-harvest + PR state | `gh pr list` | open PRs + mergeable state |

Ends with **suggested-next-command lines** (git-status shape; clig.dev «suggest what to run next»).
Consult found NO established status convention in agent frameworks — **BUILD-thin over ADOPTed shape**.

**NOT a dashboard.** No persistent state, no TUI, no refresh-loop. One-shot read + print.

## §4 Workspace one-command (A9) — REUSE, do not rebuild

`getff work <name>` (working name; final name at stage planning — if the chosen name collides with
an existing bin command, PARK the name choice):

1. **Worktree creation** — REUSE `scripts/create-worktree.sh` (verified portable, configurable
   base-ref, dual-pair with the CC hook). **Do NOT rewrite it.** Ship it (add to `setup.d` payload
   for `env`+ profiles — this is the S1 inventory gap: create-worktree.sh exists but is unshipped).
2. **Dep wiring** — detect package manager (npm/pnpm/yarn), run the install in the worktree.
3. **Per-detected-harness session start:**
   - **CC** → **DEFER entirely to the native flow** (desktop app has its own worktree UX;
     CLI → `claude -w`). NO wrapper involvement. Operator correction 2026-07-23 is binding.
   - **ZCode** → launch/print the ready command in the worktree dir.
   - **unknown harness** → print the exact next command.
4. **Flag-first / non-TTY prints instead of launching** (AI DX). `--no-launch` always prints.

Ships in **`env`+**. The Superset recipe (A1 satellite verdict) becomes the OPTIONAL comfort-UI
layer ABOVE this command, not the load-bearing path.

## §5 «Works» — acceptance (explicit + testable, evidence quoted in the PR body)

1. **Presets activate flag-only (non-TTY)** — `--preset economy` and `AIF_PIPELINE_PRESET=economy`
   both route correctly WITHOUT a TTY. Command + output (T3).
2. **`list` verb surfaces all four presets** — data-driven from the `references/presets/` files;
   adding a 5th preset file makes it appear with zero code change.
3. **Marker emission verified live** — `economy`/`aif` presets emit a UNIQUE marker value;
   prove it against `curl -s "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles" | jq -r '.[].name'`.
4. **`/pipeline status` renders all three sections against live bricks** — run it against a running
   aif + an open PR + a parked question; capture output. Prose-only = T3 fail.
5. **A9 smoke on CC AND one non-CC harness** — CC path = native deferral (prove no wrapper fires);
   non-CC = launch or exact printed command.
6. **`env` profile now carries real payload** — after S2, `--profile env` ships presets + status +
   A9 (the first divergence from `core`). This closes the S1 OPEN owner fork (state.md).

## §6 Out of scope (do NOT do these here)

- The tier-home doc + degradation matrix + CLAUDE.md pointer-ization → S3.
- GLM one-button flow + aif guided-install implementation → S4.
- `/arch` + `claude-glm-executor-handoff` shipping + runtime-bridge vendoring → S5.
- npm release mechanics → R1.
- Killer-layer code (track 1 owns).
- Editing `/arch` or `claude-glm-executor-handoff` CONTENT.
- Touching `setup.d/47-go.sh` or any go-lane row.
- Re-implementing `create-worktree.sh` (REUSE per §4).

## §7 AI-laziness traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this stage: T3, T7, T13, T16, T19, T20, T21.**

- **T3** — every «works» claim carries command + output. Preset activation, status rendering,
  A9 smoke — all live-fired, not prose.
- **T7** — do not pattern-match §5 into checkbox theater; the gates are live-fired evidence.
- **T13** — ADOPTED ≠ zero-work. clig.dev flag-first, the `gh workflow run` precedent,
  `create-worktree.sh`, git-status shape — each adopted for OUR problem class; confirm the upstream
  evidence transfers, or escalate to own-build audit depth.
- **T16** — the `gh workflow run` TTY-row precedent + clig.dev are ADOPTED **patterns**, not code.
  Write the explicit line: «Upstream problem class: X. Our problem class: Y. Match? evidence: …».
- **T19** — own adversarial cold-QA of the diff before handoff. CI ≠ design review.
- **T20** — verdicts (preset name choices, marker values, harness-detection calls) carry file:line
  or command output.
- **T21** — Backward-check enumerates **sibling surfaces**, not the diff (§8).
- **T-BDU-B (domain)** — «degradation counted as a pass». A9's print-fallback for unknown harness
  IS a designed success path; but if CC-detection fails and the wrapper launches when it should
  defer → that is a MISS, not a neutral fallback. Report it honestly.
- **T-BDU-C (domain)** — «the neighbor gate is probably clear by now». §1.1 is a snapshot; re-check
  marker-required-check + go-lane irrelevance at entry in both directions.

## §8 Park-don't-guess contract (BINDING — this task runs autonomously)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
> `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
> Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep
> moving" is the failure this whole loop exists to prevent.

**Known fork-prone spots in this stage — park these rather than guessing:**

- **Preset data format** (`.json` vs `.yaml`) — park if the `references/` lineage is unclear.
  Note: spec §11 F-B′ lists a THIRD option (shell-sourced) — if you reject shell-sourced, record
  WHY against F-B′'s criterion («readable by the launch-table renderer AND by agents without
  parsing prose»); do not silently drop it.
- **Preset data schema** (see §2 — the field structure consumed across 3 seams). THE load-bearing
  park. Do NOT decide alone; present ≥2 candidate schemas.
- **The `getff work` command name** — YOURS TO RESOLVE (technical fork, not a park): check
  `bin/` + `which getff` for collisions at entry; if clear, use `getff work`; record the check.
  Only park if a real collision is found.
- **CC harness detection mechanism** — how to detect «this is a CC session» reliably (env var?
  parent process?) without false-positives that launch when they should defer. If detection proves
  brittle, the spec's falsifier says «always print, never launch» — but the DETECTION design itself
  is a genuine fork (which signal?). Park it.
- **`economy` preset's reviewer-tier semantics** — «cheap reviewer» is underspecified. Park with
  candidate options stated: Option A → diff-only review on a cheap model (e.g. haiku-class; low
  cost, shallow); Option B → full-context review on a mid model (e.g. sonnet-class; higher cost,
  deeper); Option C → no separate reviewer, reuse the session-bound reviewer at executor tier.
  Do NOT guess; the maintainer picks the cost/depth tradeoff.
- **Marker value for `economy` vs `aif`** — both emit a marker; the VALUE must be unique under
  case-insensitive substring match. If the natural names collide, park the disambiguation.

Technical forks strictly inside the kickoff bounds (which JSON schema, where exactly to hook the
parser, how to format the status output) are yours to resolve — resolve them and record why.

## §8a Operator resolutions (2026-08-08 — re-dispatch rev; the six #1284 parks are ANSWERED)

The fd1d75e1 run correctly parked six forks (durable record: PR #1284 body, «Parked questions»).
The operator resolved them 2026-08-08. These are now BINDING — do not re-park them; implement as
resolved. Anything OUTSIDE these resolutions still follows the §8 contract. Where a §8 bullet
below conflicts with §8a, §8a wins (it is the answer to that bullet's park).

1. **Park-1 — preset data SCHEMA = Candidate A (flat) + one `description` field:**
   `{mode, reviewer_tier, marker: <name|null>, description, predicates: {bundle_opt_in,
   review_required, parallel_safe}}`. Rationale: all three seams are bash-3.2 + `jq` one-key
   lookups (`helpers/parse-override-flags.sh` header forbids associative arrays; each seam reads
   one path — `.mode` / `.predicates.*` / `.marker`). `description` feeds the §5 AC-2 `list`
   verb (zero-code 5th preset). Falsifier: per-harness variants or multi-marker needs → revisit
   Candidate B; no such requirement exists in the spec today.
2. **Park-2 — preset data FORMAT = JSON.** `jq` is already a hard helper dependency
   (`helpers/update-delta.sh`); YAML would add a `yq`-class toolchain dependency (rejected —
   new capability for a format choice). **F-B′ shell-sourced rejection recorded** (spec §11
   requires the WHY): sourcing data executes it as code — the flag parser itself rejected eval
   for injection risk (`parse-override-flags.sh` header, strategy C); data that executes fails
   the F-B′ criterion «readable … without parsing prose» in the harder direction (readable only
   BY executing). First non-`.md` entry under `references/` is accepted: the `.md` files are
   read-specs, presets are machine data — different roles, different formats.
3. **Park-3 — `economy` reviewer-tier semantics:** the whole line INCLUDING review runs on the
   executor tier (the §8 candidate «Option C» shape), with TWO binding additions: aif
   auto-review capped at **1 iteration** (per-task `maxReviewIterations: 1` — meta-launch
   decision 11 channel), and the **external cold fidelity round stays MANDATORY**. Evidence
   basis: every real defect in this umbrella was caught by the external fidelity seat, not aif
   auto-review (S1 MAJOR, S2 empty-done, S4 run-1 REVISE — meta-launch state.md §3.1/§5), and
   that seat is session-bound (no per-token cost), so review depth is preserved while the paid
   line stays cheap.
4. **Park-4 — CC harness detection for `getff work` = env-presence capability check:**
   `[ -n "${CLAUDE_CODE_SESSION_ID:-}" ]` (live-session marker; verified present in a live CC
   session 2026-08-08). Sanctioned form per `dual-implementation-discipline.md §4` («env var
   presence» is a capability check; the ban is brand-string branching in runtime logic).
   Semantics: var set ⇔ inside a live CC session ⇔ native worktree flow available → print the
   native-flow instruction, do not wrap. Outside a session the wrapper launches even when the
   `claude` binary is installed (installed ≠ in-session). Falsifier: a compatible harness
   setting the var without a native worktree flow → switch to an explicit capability probe.
5. **Park-5 — marker values: the CONDITIONAL park did NOT fire.** Live probe 2026-08-08
   (`curl -s "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles" | jq -r '.[].name'` →
   `Claude Opus (plan+review)` / `Z.AI GLM-5.2 SDK` / `Qwen3.8-Max-Preview`): no
   case-insensitive substring collision among full display names → use full display names
   as-is. This probe is a snapshot: §5 AC-3 (re-probe live at implementation) is unchanged and
   still binding.
6. **Park-6 — ship the FULL functional set together, same §1j profile gate (`env|factory|`
   `WITH_AIF_SUITE`):** `scripts/create-worktree.sh` (already shipped, #1284) +
   `scripts/worktree-node-modules.sh` + `scripts/link-coordination.sh`. Rationale:
   `create-worktree.sh:87` calls `worktree-node-modules.sh` (missing → worktree silently
   unprovisioned, the 2026-07-23 incident class exported to consumers) and `:127-130` calls
   `link-coordination.sh` (missing → loud, consumer-meaningless warning on every run); the
   kickoff §4 REUSE binding forbids rewriting the script, so the callees ship with it. All
   three verbatim via `copy_safe`, no rewrites. **AC addition:** fresh-consumer smoke — run the
   shipped `create-worktree.sh` in a clean consumer repo: exit 0, no missing-callee warning,
   `node_modules` symlinks present in the created worktree.

## §9 PR-body requirements (both gates are REQUIRED checks on `staging`)

This stage touches `.zcode/skills/pipeline/**` + `setup.d/**` (shipping create-worktree.sh) +
`packages/runtime-bridge/**` (status reads) → **the §1.7 mandate is ON**.

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
The class-surfaces here: `.zcode/skills/pipeline/**` (presets touch the parser + routing + marker
— sweep ALL three seams), `setup.d/**`, `packages/runtime-bridge/**`, the plugin channel,
the zcode twins, `packages/core/templates/**`. A Backward-check whose surface list equals your
own diff's file list is non-conformant by format.

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

## §10 Stop conditions

- A design decision would diverge from the binding spec → STOP and surface the divergence.
- The `--preset` flag cannot be made to work non-interactively → STOP (spec A4 REJECTS menu-only).
- CC harness detection would require launching when spec says defer → STOP, park the detection design.
- The marker value for `economy`/`aif` is ambiguous against the live runtime-profile list → park.
- Local CI-equivalent sweep goes red from a branch-introduced cause → fix before handoff.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
