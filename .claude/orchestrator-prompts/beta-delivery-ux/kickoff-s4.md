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

- **aif REST route source** = `packages/api/src/routes/runtimeProfiles.ts` + `packages/api/src/schemas.ts`
  **in the aif-handoff repo — a HOST path, NOT reachable from the container worker** (see §7d.0; the
  container mounts only `$PROJECTS_DIR`, one level below the aif-handoff repo root). Do **not** try to
  read it, and do **not** park on being unable to. **The live API is the authoritative oracle and it
  IS reachable** — verify the schema by probing it (§7d.1), never by guessing.
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

### §4.1 Host-verify contract ([destination-environment-verification.md §1](../../rules/destination-environment-verification.md))

This stage ships a shell helper, an install-time gate, and a `tests/install-sh/` suite — exactly
the container≠host surface the rule exists for. A green container run is **not** evidence. Run
these on the **host** (`bash scripts/host-verify.sh beta-delivery-ux`) before accepting the work;
they decide acceptance:

```bash host-verify
bash tests/install-sh/glm-onebutton.test.sh
```

Note the ordering: the command targets a file this stage introduces, so it resolves only once the
branch is checked out on the host — which is precisely when acceptance happens. It will not
resolve against bare `staging`, and that is expected, not a defect in the contract.

**Run 3 showed this contract can pass over a broken flow** — the suite mocked a non-existent
endpoint, so «green» meant «the mock agrees with the helper», not «the helper works». The contract's
teeth are therefore §7d.6: the stub is fail-closed and carries a paired-negative that fails on the
run-3 helper. A green run of the command above is evidence only if §7d.6 is delivered.

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
- **T-BDU-D (domain, added run 3)** — «the kickoff told me to read a file I cannot reach, so I
  filled the gap from plausibility». Run 3 guessed a REST route that does not exist, and the sin
  was the guess, not the unreachability. When an instructed source is unreachable: try the **live
  probe** (§7d.1); if that too is unavailable, **PARK with the failed access quoted** — never
  substitute a plausible shape. The tell: any endpoint, field, or status code in the diff that no
  command output in the PR body establishes.

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
   The minimal set is defined against the LIVE schema, not the spec sketch — and the schema is
   **probed, not read** (§7d.0: that source file is host-only; the earlier «re-read the file at
   entry» instruction was unexecutable and is retracted). Establish it with the §7d.1 probe.
   Rationale: smallest surface to break on aif upgrades. **`runtimeId` + `providerId` are part of
   the schema-required set** — see §7d.2.
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

## §7b Dispatcher resolution — the key-acquisition channel (run-2 KICKOFF-AMBIGUOUS, CLOSED)

**Provenance, stated honestly:** §7a is the *operator's* resolution set. This section is **not** —
it was authored by the `/dispatcher` session on 2026-08-08 to close the `KICKOFF-AMBIGUOUS` that
run 2's cold fidelity audit raised (PR #1300). It adds **no new decision**; it supplies the one
step §7a omitted, and it is the *unique* completion that leaves all three §7a clauses intact.
The operator may override it — if they do, §7b loses to their call.

**The gap (verified against source, not inferred).** §7a #1 puts only the env-var NAME in the
profile; §7a #4(ii) puts the VALUE in `${XDG_CONFIG_HOME:-$HOME/.config}/getff/glm.env`; §7a #3
requires the validation ping to run **through the created profile**. Nothing connects (ii) to the
process that needs it:

- aif resolves the key from **its own runtime `process.env`, by that name** —
  `packages/runtime/src/resolution.ts:217-219` (`resolveApiKey(envVarName, env)` →
  `normalizeString(env[envVarName])`) and `:247`
  (`const env = input.env ?? (process.env as RuntimeResolutionEnv)`), in the aif-handoff repo.
- that process env is populated from the compose env-file — `docker-compose.yml:15`, `:59`, `:94`
  (`env_file: .env`, all three services).
- therefore a file at `~/.config/getff/glm.env` is **invisible** to the aif runtime unless the
  flow also makes it reachable there. Without that step §7a #3 is unreachable except by
  dereferencing the value, which §7a #1 + §2 constraint 1 forbid.

**Resolution — bind the OUTCOME, leave the mechanism to the worker (a §7 technical fork).**

1. The flow MUST make the key value reachable in the **aif runtime's process environment** under
   the §7a #1 name (`ANTHROPIC_AUTH_TOKEN`), sourced from the §7a #4(ii) file. `glm.env` stays the
   canonical getff-owned storage location — this adds the wiring, it does not move the file.
2. The **mechanism is yours to pick** (compose `env_file:` entry, the aif deployment's own `.env`,
   or an equivalent) — deployments vary, so the kickoff does not prescribe one. Record which you
   picked and why, per §7.
3. The helper MUST **verify reachability before** the §7a #3 ping and fail honestly if absent —
   an unreachable key is an **objective-3 MISS** per §2 constraint 4, never a silent warning-and-continue.
4. **Unchanged and still binding:** the value never enters the profile, never enters `curl` argv
   or any command line (process-table exposure — run-2 watch-list W-2), and is never echoed. It
   moves file → process env only.

**Falsifier:** if the live aif deployment reads its key by some channel other than
`process.env[<name>]`, this resolution is wrong — PARK with the contradicting source quoted.

## §7c Binding corrections carried from run 2 (NOT forks — implement as stated)

Run 2's audit findings that are settled by in-repo source. Do not re-derive, do not park.

1. **The project-defaults write path was invented.** `scripts/getff-glm-onebutton.sh:135` used
   `PATCH $AIF_URL/project`, which does not exist. The authoritative contract was reachable in the
   container: `packages/runtime-bridge/src/cli/aifHttp.ts:96` — **`PUT /projects/:id` with a full
   `createProjectSchema` body** is the only write path; `aifHttp.ts:90` — aif has **no**
   `GET /projects/:id`, so read current state via `GET /projects` and filter by id, then PUT the
   full body back with your fields changed.
2. **Both halves of §7a #2 must be written.** Run 2 wrote only Task+Review (`:138`) and omitted
   `defaultPlanRuntimeProfileId`, silently leaving Plan on whatever was set before. Write
   Plan→top-tier **and** Task+Review→executor-tier, or the step is not delivered.
3. **The ping target is the profile, not the vendor.** Run 2 pinged `$GLM_BASE_URL` directly
   (`:171`), which proves the key but not the route the flow just built (watch-list W-3). Route it
   through the aif profile id created in step A.
4. **`setup.d/10-skills.sh` stays untouched** — S5 is its sole editor (W-5, held CLEAN in run 2;
   keep it that way).

## §7d Binding corrections carried from run 3 (NOT forks — implement as stated)

Run 3 (aif task `e65989fa`, Audited-SHA `53fce45f51`) delivered every §7c correction (W-2..W-5
CLEAN) and raised **no** `KICKOFF-AMBIGUOUS`. It stopped on five items. Four are defects in the
work; the first is a defect in **this kickoff**, and it is upstream of the rest.

### §7d.0 The dispatcher's defect — a host path handed to a container worker (RETRACTED instruction)

`§1` and `§7a #1` both ordered you to «re-read `~/code/aif-handoff/…/runtimeProfiles.ts` at entry».
**That file is not reachable from the container by any path**, so the instruction was unexecutable
and the run guessed instead of parking. Measured 2026-08-09 from `aif-handoff-agent-1`:
`PROJECTS_HOST_ROOT=/Users/art/code/aif-handoff` and `PROJECTS_DIR=$PROJECTS_HOST_ROOT/projects` —
only `projects/` is mounted, so the repo root that holds `packages/api/` sits one level **above**
the mount. This is the same class as state.md §2 decision 14 (an empirical sweep ordered over
branches the worker could not see). Both instructions are now retracted and replaced by §7d.1.

**The generalisation, and it is binding for the rest of this kickoff:** when a fact about aif is
needed, the **live API is the oracle**, not the source tree. It is reachable from the container
(`curl -s -o /dev/null -w '%{http_code}' "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles"` → `200`, measured 2026-08-09).
If a needed fact is reachable by neither source nor probe, **that** is a §7 park.

### §7d.1 Establish the schema by probe, at entry (replaces «re-read the file»)

**First, the base URL — and this is a trap the run-3 helper is already sitting in.** The helper
resolves `AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"`
(`scripts/getff-glm-onebutton.sh:94`). That fallback is correct for a **consumer's** machine and
**wrong inside the agent container**, where `RUNTIME_BRIDGE_AIF_URL` is unset and `localhost` is the
container itself. Measured 2026-08-09 from `aif-handoff-agent-1`: `GET http://localhost:3009/runtime-profiles`
→ curl exit 7 (`000`, connection refused); `GET http://api:3009/runtime-profiles` → **`200`**. So
when probing from the container, export `RUNTIME_BRIDGE_AIF_URL=http://api:3009` first. Do **not**
change the helper's shipped default — the default is for consumers; this is your probe environment.

Run these first and quote the outputs in the PR body (T3):

```bash
export RUNTIME_BRIDGE_AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://api:3009}"   # container only
A="$RUNTIME_BRIDGE_AIF_URL"
# (a) required-field discovery — the API names its own required fields
curl -s -X POST -H 'Content-Type: application/json' -d '{"name":"probe-only"}' "$A/runtime-profiles"
# (b) route-existence discovery — 404 means the route does not exist
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' \
  "$A/runtime-profiles/validate"
```

Dispatcher's own run, 2026-08-09, from `aif-handoff-agent-1` — reproduce it, do not trust it:

- (a) → `400` with `ZodError`, `path: ["runtimeId"]` and `path: ["providerId"]`, both
  `"expected string, received undefined"`.
- (b) → `400` (**not** 404): the route exists and rejects an empty body.
- Control: `POST "$A/runtime-profiles/deadbeef/v1/messages"` → **`404`**.

**Consequence for §4 item 1 («live end-to-end … against a running aif»).** If the run-3 helper was
ever «run» in-container without that export, it could not have reached aif at all — which is
consistent with the suite mocking every call (§7d.6). A live end-to-end claim must therefore quote
the base URL it used alongside the transcript.

### §7d.2 `runtimeId` + `providerId` are REQUIRED in the create body

`getff-glm-onebutton.sh:222-226` omits both, so step 5 can never run live (400, never 201). Add
them to the §7a #1 minimal set — they *are* «schema-required fields», which §7a #1 already
mandates. Populate them from the §7d.1(a) probe + the `GET /runtime-profiles` shape (§1), never
from a guess.

### §7d.3 The ping splits in two — aif has no single endpoint that satisfies §7a #3

The guessed path does not exist (§7d.1 control → 404). But `POST /runtime-profiles/validate` does
**not** replace it either, and the dispatcher fired its own §7d.3 falsifier rather than leave the
worker to discover this: for a profile with `transport: "api"`, `validateClaudeConnection` returns
`{ok:true, message:"Claude API profile configured"}` after checking only that `apiKey` and `baseUrl`
are non-empty — **no network call at all**
(aif-handoff `packages/runtime/src/adapters/claude/index.ts:468-479`; host-read, quoted here
because you cannot read it — §7d.0). Live confirmation, 2026-08-09: `POST /validate` against the
`Qwen3.8-Max-Preview` profile returned `ok:true` in well under a second. `POST /runtime-profiles/models`
is not the answer either — it returned a **static Claude catalogue** (`Sonnet 4.6`, `Opus 4.6`) for a
Qwen profile, so it is not querying the provider.

So §7a #3 («one real minimal model call») and §7c #3 («the ping target is the profile, not the
vendor») cannot both be met by one aif REST call. **Dispatcher resolution — same provenance and
standing as §7b: authored by the dispatcher, not the operator, and overridable by them.** Do both
halves, and report them as one objective:

1. **Route proof — `POST /runtime-profiles/validate`** with the step-A profile id. This is what
   proves aif resolved *the profile the flow just built*: the response echoes the resolved
   `baseUrl`, `apiKeyEnvVar`, `model`, `transport`, and `hasApiKey`. Required: `ok:true`.
2. **Model proof — one 1-token-scale completion** against the `baseUrl` **read back from that same
   response** (never a hardcoded `$GLM_BASE_URL` — that was run 2's W-3 defect), with the model from
   the same response. Reading the route back out of aif is what makes this «through the profile»
   rather than «at the vendor».

Both must pass. Either failing is an objective-3 MISS per §2 constraint 4. **Falsifier:** if you
find an aif endpoint that does perform a real completion through a stored profile, prefer it and
collapse the two halves back into one — quote the route and its live output.

### §7d.4 §7b #1 is still undelivered — verifying reachability is not making it reachable

`getff-glm-onebutton.sh:204-216` correctly implements §7b #3 (verify-before-ping), but `:191-198`
prints wiring instructions and `exit 1`. Nothing performs §7b #1, so a first run always ends in a
MISS. Implement the wiring step itself (mechanism still yours per §7b #2), then verify, then ping.
A helper that can only ever instruct is the `#warning-nobody-reads` shape
([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md)).

**Use the §7d.3(1) response as the §7b #3 verifier — it is exact, and it never touches the value.**
`hasApiKey` is `Boolean(resolved.apiKey)` and `resolved.apiKey` is `normalizeString(env[envVarName])`
read from the aif runtime's own `process.env` (aif-handoff `packages/runtime/src/resolution.ts:426`
and `:217-219`). So `hasApiKey:true` **is** the proof that §7b #1's outcome was achieved — the key
is reachable in the aif runtime under the §7a #1 name — obtained without dereferencing it, without
it entering argv, and without echoing it (§7b #4 intact). `hasApiKey:false` is an objective-3 MISS,
not a warning to print.

### §7d.5 §3's companion install is prose in a field the engine never reads

`companions.manifest:33` puts clone+compose into `install_cmd`, but `setup.d/engine.sh:18`
early-returns past that field for `kind=external-service`, and `bridge-guided.sh:11-29` only prints
hints. There is therefore **no consent surface**, and §4 item 4's «decline → `env` degradation» has
nothing to decline. Either deliver a real consent+install path for this kind, or PARK (§7) with
`engine.sh:18` quoted — but do **not** leave prose in a dead field and report the objective met.

### §7d.6 MAJOR — the suite must not green-light routes that do not exist

`tests/install-sh/glm-onebutton.test.sh:78-86` mocks the guessed ping path → `200` and
`POST /runtime-profiles` → `201` **regardless of body**. §4.1's `host-verify` command therefore
passes *over* §7d.2 and §7d.3. A mock that invents an endpoint is not a test, it is a second
implementation of the bug.

**Binding shape (fail-closed, not a reminder):** the `curl()` stub MUST reject any request whose
path is not in an explicit allowlist, and MUST reject a create body missing a required field —
returning the same `400` the live API returns, so the test fails when the helper is wrong. The
allowlist is pinned by the §7d.1 probe and each entry carries the date it was probed. Add a
paired-negative case proving the stub **fails** on the run-3 helper (guessed ping path + create body
without `runtimeId`/`providerId`); a stub that cannot fail on the known-bad input is not evidence.

**No `it.fails()`-as-delivery.** A known-broken path may not be shipped as a passing suite plus an
expected-to-fail marker plus an operator TODO. Either fix it or PARK it per §7.

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
