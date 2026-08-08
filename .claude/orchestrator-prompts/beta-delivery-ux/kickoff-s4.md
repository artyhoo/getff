<!-- scope: stage kickoff — beta-delivery-ux S4 (GLM one-button + aif companion guided-install, spec A2 + A1 companion-upgrade). Dispatch input for ONE buildable task; the umbrella plan lives in ../beta-delivery-ux-meta-launch/kickoff.md and is NOT this file's scope. Tier 2 (no bridge-profile marker): top tier plans, executor implements + reviews. -->

# beta-delivery-ux S4 — GLM one-button + aif companion install (A2)

> **Type:** execution-build, single PR onto `staging`.
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §4 **A2** is the design SSOT (plus the A1 companion-manifest upgrade the `factory` profile
> triggers). On any divergence between this kickoff and the spec, **the spec wins** — surface
> the divergence, never improvise past a binding decision.
> **Umbrella context (read-only):** [`../beta-delivery-ux/kickoff.md`](kickoff.md) §2 row S4 +
> [`../beta-delivery-ux-meta-launch/kickoff.md`](../beta-delivery-ux-meta-launch/kickoff.md) §4 Stage 2 (S4 bullet).
> **Base branch:** `staging`.

## §0 Goal

The GLM executor tier connects with **exactly one human-entered key**, and the rest is automation.
ADAPT the aider onboarding pattern: detect missing executor profile → ONE explanation (z.ai
subscription, $18/mo Coding Plan) → human pastes ONE key into an untracked env location →
automation does the rest (create the aif runtime profile via REST, set per-mode defaults, run a
validation ping, ship the glm-handoff skill).

Plus: the `factory` profile UPGRADES the aif-handoff `companions.manifest` row from detect+instruct
(S1 shipped the declaration) to a **consented guided INSTALL** (official repo, docker compose,
detect-first; decline → graceful `env`-level degradation).

**The installer NEVER handles the key value.** The executor of the flow is an AI session driven by
an INSTALL-FOR-AI step + a bash helper — no GUI/wizard (BFR cost gate).

## §1 Inputs (re-verify at entry — REST shapes are designed-not-proven)

**CRITICAL — spec A2 calls the aif REST field shapes «designed-not-proven, verify at implementation».**
I (the dispatcher) live-probed the bridge at authoring time. The actual `createRuntimeProfile`
shape from the live aif (`curl -s "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles" | jq '.[0] | keys'`):

```text
apiKeyEnvVar, baseUrl, createdAt, defaultModel, enabled, headers, id, lastUsage,
lastUsageAt, name, options, projectId, providerId, runtimeId, runtimeLimitSnapshot,
runtimeLimitUpdatedAt, transport, updatedAt
```

That is **18 fields** — the spec's sketch implied fewer. **The exact field mapping for OUR
one-button flow (which fields to populate, which to leave to defaults) is a genuine fork — PARK it
(§7).** Do NOT assume the sketch maps 1:1.

- **aif REST route source** = `~/code/aif-handoff/packages/api/src/routes/runtimeProfiles.ts`
  (`createRuntimeProfileSchema` — Hono router). **Re-read this file at stage entry** to confirm the
  schema; the live probe above is the shape but the validation rules live in the schema.
- **Per-mode defaults** — Plan→top tier, Task/Review→executor tier. HOW per-mode defaults are set
  (per-task field? project-level? env?) is a genuine fork — the spec doesn't pin it. Park (§7).
- **Validation ping** — what constitutes «validated»? A `/health` 200? A real model call? Park
  the success criterion if ambiguous (§7).
- **glm-handoff skill** — EXISTS at `.zcode/skills/claude-glm-executor-handoff/`.
  **CRISP STAGE BOUNDARY (resolves the S4/S5 collision):**
  - **S4 OWNS:** the one-button automation (REST profile create + per-mode defaults + validation
    ping), the `companions.manifest` aif-handoff row upgrade (declaration → guided install), and
    the `INSTALL-FOR-AI.md` one-button step. S4 does **NOT** edit `setup.d/10-skills.sh`.
  - **S5 OWNS:** the `setup.d/10-skills.sh` shipped-set wiring for BOTH `/arch` AND
    `claude-glm-executor-handoff` (S5 is the single editor of that file for this umbrella).
  The skill FILE exists today (this repo); «shipping» it to a consumer = the `setup.d/10-skills.sh`
  row, which is **S5's exclusive job**. S4's role is the automation that makes the shipped skill
  *usable* (profile creation + key wiring). Do NOT add the glm-handoff row to `setup.d/10-skills.sh`
  here — that is S5's atomic edit; doing it here is a cross-stage collision.
- **`companions.manifest` aif-handoff row** — S1 shipped it as `kind=external-service` declaration
  with placeholder detect/install. S4 replaces the placeholders with the guided-install commands.
  The `@profile: factory` marker (S1) stays; S4 adds the real implementation behind it.

### §1.1 Companion manifest engine — does it enforce `@profile:` markers today?

**OPEN (verify at entry).** S1's MINOR-2 noted the engine may not read the `@profile: factory`
marker yet. S4 must verify: does `setup.d/engine.sh` companion_step gate on `@profile:`? If not,
S4 adds the gate OR parks the gap. **Do NOT assume the gate exists — verify in `engine.sh` source.**

## §2 The one-button flow (A2) — the aider pattern, adapted

**Executor of the flow (WHO runs the automation — this was ambiguous, now fixed):**
the flow is driven by **the consumer's in-session AI agent** (Claude Code / Codex / etc. — whatever
harness the consumer installed getff into) reading an `INSTALL-FOR-AI.md` step. That agent:
(a) runs the bash helper that probes `/runtime-profiles` for a missing GLM profile, (b) prints the
explanation + the exact env-file path for the human to paste the key into, (c) after the human
confirms the paste, runs the REST automation. It is NOT a separate getff-spawned daemon, NOT the
aif-handoff worker, NOT a GUI. **This is the aider pattern: the existing agent session IS the
executor; the bash helper is the one-button.** Record this interpretation in the PR body; if it
diverges from the spec's intent, park.

```text
detect missing executor profile (bridge REST: /runtime-profiles → no GLM profile?)
  → ONE explanation (z.ai Coding Plan, $18/mo, the key goes to an UNTRACKED env location)
  → human pastes ONE key (into the env file at the path the helper prints — location PARKED §7)
  → automation (the consumer's in-session agent runs the bash helper):
      1. create the aif runtime profile via REST (POST /runtime-profiles — field mapping PARKED §7)
      2. set per-mode defaults (Plan→top, Task/Review→executor — mechanism PARKED §7)
      3. run a validation ping (success criterion PARKED §7)
      4. the glm-handoff skill is already in the factory payload (S5 wired setup.d/10-skills.sh)
  → done: one key in, full GLM executor tier wired
```

**Binding constraints from spec A2:**

1. **The installer NEVER handles the key value.** The key goes to an untracked env file the human
   creates/pastes; automation reads the ENV VAR NAME (never the value) when calling the model.
2. **No GUI/wizard** (BFR cost gate). Executor = AI session + bash helper.
3. **REFERENCE claude-code-router + LiteLLM** as mapping-layer precedents — we do NOT rebuild routing.
   Confirm the precedent transfers (T13/T16) or escalate.
4. **Degradation honesty (r2):** if REST automation fails and the flow degrades to guided manual
   steps, that is an **objective-3 MISS** (AI-performs-setup), NOT a neutral fallback. Phase 1
   exits only with the automated one-key path proven end-to-end.

## §3 The factory companion upgrade (A1) — guided INSTALL, not detect+instruct

The `factory` profile's aif-handoff row in `setup.d/companions.manifest` upgrades from the S1
declaration to a **consented guided INSTALL**:

- **official repo path** (the aif-handoff repo), **docker compose** (detect-first; the engine
  checks if aif is already running before offering install), **decline → graceful `env`-level
  degradation** (the consumer keeps `env` depth; nothing breaks).
- **Opt-in, never a hard dependency** ([companion-install-principle.md](../../rules/companion-install-principle.md)).
- The `@profile: factory` marker (S1) gates this row; S4 ensures the engine enforces it (§1.1).

## §4 «Works» — acceptance (explicit + testable, evidence quoted in the PR body)

1. **Live end-to-end on a clean machine against a running aif** — the full one-button flow runs:
   detect → explain → one key → REST create → defaults → ping → skill ship. Command + output (T3).
2. **The key value is NEVER touched by tooling** — grep the diff + the helper script: the key
   exists only in the untracked env file; automation references the ENV VAR NAME. Prove it.
3. **Validation ping proves a real model call** (or whatever the parked success criterion resolves
   to) — not just a `/health` 200.
4. **Factory companion install is consented + detect-first** — running aif → no re-install prompt;
   no aif → guided install offered; decline → `env`-level degradation recorded honestly.
5. **Degrade-to-manual counts as objective-3 MISS** — if the flow cannot complete automated, the
   PR body records it as a MISS with the blocker, NOT as «degraded gracefully» (T-BDU-B).

## §5 Out of scope (do NOT do these here)

- Pipeline presets / `/pipeline status` / workspace one-command → S2.
- Tier-home doc + degradation matrix + CLAUDE.md pointer → S3.
- **`setup.d/10-skills.sh` wiring for `/arch` OR `glm-handoff` → S5** (S5 is the SOLE editor of
  that file for this umbrella; S4 does NOT touch it — see §1 boundary). S4 ships the *automation*
  that makes the (S5-wired) glm-handoff skill usable, not the wiring itself.
- `/arch` wiring + runtime-bridge vendoring → S5.
- npm release mechanics → R1.
- Killer-layer code (track 1 owns).
- Editing `/arch` or `claude-glm-executor-handoff` CONTENT.
- Touching `setup.d/47-go.sh` or any go-lane row.
- Rebuilding routing (REFERENCE claude-code-router/LiteLLM; do not reimplement).

## §6 AI-laziness traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this stage: T3, T7, T13, T16, T17, T19, T20, T21.**

- **T3** — every «works» claim carries command + output. The end-to-end flow, the validation ping,
  the companion install — all live-fired.
- **T7** — do not pattern-match §4 into checkbox theater.
- **T13** — ADOPTED ≠ zero-work. The aider onboarding pattern, claude-code-router/LiteLLM
  precedents — each adopted for OUR problem class; confirm the evidence transfers.
- **T16** — aider is an ADOPTED **pattern**, not code. Write: «Upstream problem class: X. Our
  problem class: Y. Match? evidence: …».
- **T17** — the S1 `companions.manifest` declaration is residue; supersede it WITH EVIDENCE (the
  new guided-install row replaces the placeholder; record the supersede in the PR body).
- **T19** — own adversarial cold-QA of the diff before handoff. CI ≠ design review. The key-handling
  invariant (§4 item 2) deserves extra scrutiny.
- **T20** — verdicts (field mapping, per-mode default mechanism, ping criterion) carry file:line
  or command output. Since several are PARKED, the park records must cite the schema source.
- **T21** — Backward-check enumerates **sibling surfaces**, not the diff (§8).
- **T-BDU-B (domain)** — «degradation counted as a pass». The companion `decline → env` IS a
  designed success path; but the one-button flow degrading to guided manual is a MISS. Distinguish.
- **T-BDU-C (domain)** — «the neighbor gate is probably clear by now». §1 REST shapes re-verified
  live at entry (re-probe the bridge); §1.1 engine enforcement verified in source.

## §7 Park-don't-guess contract (BINDING — this task runs autonomously)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
> `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
> Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep
> moving" is the failure this whole loop exists to prevent.

**Known fork-prone spots in this stage — park these rather than guessing:**

- **REST field mapping** (§1) — which of the 18 fields to populate for the GLM profile, which to
  leave to defaults. PARK with the live schema cited. Do NOT assume the spec sketch maps 1:1.
- **Per-mode default mechanism** (§1) — project-level `defaultPlanRuntimeProfileId` vs per-task
  field vs env. The mechanism is underspecified. Park.
- **Validation ping success criterion** (§1) — `/health` 200 vs real model call vs both. Park.
- **Key env-file location + env-var NAME** — TWO distinct decisions, both genuine forks:
  (i) **env-var NAME** the automation reads (e.g. `ZAI_API_KEY`) — this is the load-bearing
  contract (the REST `apiKeyEnvVar` field holds the NAME, never the value). The name must match
  what the GLM SDK / aif expects. Park if the canonical name is unclear.
  (ii) **file path** where the human pastes the key — `$XDG_CONFIG_HOME/getff/glm.env` (XDG) vs
  `~/.config/getff/glm.env` (literal) vs repo-local `.env`. Note: on macOS `$XDG_CONFIG_HOME` is
  typically UNSET, so XDG-default + literal-`~/.config/` DIVERGE by platform. This is a
  platform-dependent genuine fork — park it; do NOT «resolve» by picking XDG (it silently breaks
  macOS where the var is unset). Park both sub-decisions with the platform tradeoff stated.
- **Companion engine `@profile:` enforcement** (§1.1) — if `engine.sh` does not gate on the marker,
  park whether S4 adds the gate or defers it.

Technical forks strictly inside the kickoff bounds (bash helper structure, detect-probe wording,
INSTALL-FOR-AI step phrasing) are yours to resolve — resolve them and record why.

## §7a Operator resolutions (2026-08-08 — re-dispatch rev; the run-1 parks are ANSWERED)

Run 1 (aif task `5a567e97`) parked the three §7 forks correctly and was held un-harvested.
The operator resolved them 2026-08-08 («A, A, B»). These are now BINDING — do not re-park them;
implement as resolved. Anything OUTSIDE these resolutions still follows the §7 contract.

1. **REST field mapping = Option A — MINIMAL set.** Populate only: schema-required fields +
   profile display name + model + `apiKeyEnvVar` (the NAME, never the value) + the base-URL
   field targeting the Z.ai Anthropic-shape endpoint. Everything else stays on server defaults.
   Re-read the live schema at entry (`~/code/aif-handoff/packages/api/src/routes/runtimeProfiles.ts`,
   `createRuntimeProfileSchema`) — the minimal set is defined against the LIVE schema, not the
   spec sketch. Rationale: smallest surface to break on aif upgrades.
2. **Per-mode defaults = Option A — project-level aif runtime-profile config.** Write
   Plan→top-tier / Task+Review→executor-tier into the same project-level config the system
   already reads (the channel `tier-home.md` names as owning tier→model instantiation). Do NOT
   invent an env or per-task channel.
3. **Validation ping = Option B — one real minimal model call** (1-token-scale completion via the
   created profile), proving key + model + route together. `/health` alone is NOT acceptance.
   On failure: honest degradation to the guided-manual path with the error shown (spec r2
   binding — degradation honesty).
4. **Key env contract (delegated resolution, evidence-backed — falsifiers stated):**
   (i) env-var NAME = `ANTHROPIC_AUTH_TOKEN` — the canonical name for the Z.ai Anthropic-shape
   endpoint per the shipped skill's D3 row
   (`.claude/skills/claude-glm-executor-handoff/SKILL.md:36`, citing docs.z.ai). Falsifier: if
   the live `createRuntimeProfileSchema` names a different expected var, PARK with the schema
   quoted. (ii) file path = `${XDG_CONFIG_HOME:-$HOME/.config}/getff/glm.env` — the XDG Base
   Directory spec's OWN fallback semantics, valid on macOS (var unset → literal `~/.config`)
   and Linux alike; this is the spec default, not a platform guess.

## §8 PR-body requirements (both gates are REQUIRED checks on `staging`)

This stage touches `.zcode/skills/**` (glm-handoff shipping) + `setup.d/**` (companions.manifest
upgrade) + `INSTALL-FOR-AI.md` (one-button step) + possibly `packages/runtime-bridge/**` →
**the §1.7 mandate is ON**.

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
The class-surfaces here: `.zcode/skills/**`, `setup.d/**` (companions.manifest + engine),
`INSTALL-FOR-AI.md`, `packages/runtime-bridge/**`, the plugin channel, the zcode twins,
`packages/core/templates/**`. A Backward-check whose surface list equals your own diff's file
list is non-conformant by format.

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
- The REST field mapping cannot be resolved without a guess → park it; do NOT guess.
- The key-handling invariant (§4 item 2) would be violated by the chosen implementation → STOP.
- The one-button flow cannot complete automated end-to-end → record as objective-3 MISS, park.
- Local CI-equivalent sweep goes red from a branch-introduced cause → fix before handoff.
