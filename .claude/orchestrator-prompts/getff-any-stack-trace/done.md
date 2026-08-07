# getff-any-stack-trace — DONE

- Final PR: #1262
- Closed: 2026-08-07
- Summary: Tier-1 host-derivation threaded end-to-end across the python lane, agent surface + git-hook rung + research paths shipped, and the W6 acceptance cell + one-beat cold-run protocol landed — gate `getff-freshness-widening` (spec §10) per the routed-onward findings below.

## What landed (per stage, with PR + content)

- **S1 #1166** — Tier-1 host-derivation threaded into the generation bridge; D7 `Project-URL: Documentation, <url>` field parsed from `.dist-info/METADATA` via `ecosystem-python.ts:230`. Three fixtures green (npm host-threading regression guard + python Tier-1 admission + python Tier-0-still-trumps-Tier-1 priority guard).
- **S2 #1169** — Python lane agent surface: skills (`/rule-research`, `/scenario-generator`, `/install-companion`, `/audit-ai-doc`), curated 2 agents (`rule-researcher`, `rule-test-author`), hooks + `.claude/settings.json` wiring, `.mcp.json`, starter `AGENTS.md`, `.ai-factory/` subtree. D8 lifts the prior `.ai-factory` consumer-install ban (`setup.d/45-python.sh`).
- **S2b #1233** — Python git-hook rung (HMR class): pre-push firing gate delivered as bare `core.hooksPath`-style bash (`setup.d/45-python.sh` + `packages/core/templates/shared/getff-python/hooks/`), augment-first (never clobber consumer's existing `core.hooksPath`), Node-free, integration arm for pre-commit consumers. SSOT #237 verdict BUILD per the runner-role criteria.
- **R1 #1254** — Lane × channel-rung parity audit (supersedes the unreleased round 1). Documents cargo/go template rung parity GAPs, the `--refresh` framework-reconciliation gap, and the cargo rung-5 delivery cascade — all routed to widening.
- **S3 #1253** — One-beat continuation clause (`agents/rule-researcher.md` `## § continuation — one-beat cold-branch`) + per-stack research paths (python arm concrete at `setup.d/45-python.sh`, rust pointer for the future rust lane). F-A resolved to DECLARE: generation needs Node (`npx tsx` from the framework checkout); the python **install** stays Node-free (verified by the S4 cell's Node-stripped-PATH assertion).
- **S4 = this PR** — W6 «unfamiliar-stack e2e» cell v1 green in CI (`tests/consumer-matrix/python-unfamiliar-stack-cell.sh` + the `consumer-matrix-python-unfamiliar-stack-cell` job wired into `ci-success` `needs:`); RED/GREEN/REJECT discrimination arms quoted verbatim; R1-input assertion (the `master`-default-branch fixture settles R1 §5.1's parked question for the python lane); one-beat cold-run protocol artefact authored (`agents/getff-cold-run-prober.md`, framework-only); SSOT #239 ADAPT verdict + T16 problem-class comparison recorded.

## Descoped / routed onward (named, not elided)

- **Cell full (dep-bump → targeted staleness assertion)** — assigned to `getff-freshness-widening` (spec §9.2). The W6 v1 cell covers install → generation → RED/GREEN/REJECT only; the staleness arm is out of scope here.
- **cargo/go widening** — R1 §5.1 routed cargo + go rung parity to widening; the S4 cell touches the python lane only. The cargo/go template `branches: [main]` substitution question (R1 §5.1 parked) remains open for those lanes; S4's python fixture does NOT mechanically settle it for cargo/go (R1 explicitly routed those).
- **The `--refresh` framework-reconciliation gap** — R1 routed this to widening; untouched here.
- **The cargo rung-5 delivery cascade** — R1 routed this to widening; untouched here.
- **One-beat cold-run protocol RUN** — **PARKED** per kickoff §4 trigger #2. The container in which S4 executes cannot produce a genuinely cold agent + fresh consumer: (1) the prober's own §Hard constraints require top-level invocation (`claude --agent`) because a normal CC subagent cannot spawn subagents, and this stage runs as a dispatched worker inside the aif container; (2) any subagent spawned from this layer inherits the framework repo as ambient context, violating cold-start condition #3 ("No framework-source access"); (3) the cold agent must not know it is participating in a probe (cold-start condition #2), but a subagent shares the parent session's summary. The AUTHORING stands; the RUN defers to the host per the protocol's §Honest deferral section (mirrors `shipped-agent-liveness-prober.md` T-M2PROBE-A). The host's accepting session executes the binding cold-run; this container's park is the honest result, not a GREEN manufactured under warm conditions (per spec §9.3 T-S4-C — never edit the protocol until it passes, never report a warm run as cold per T-AST-B).

## What this umbrella proved (the load-bearing claims)

- **Tier-1 host-derivation is real, not theoretical** — S1 wired it through the bridge and S4's W6 cell demonstrates it end-to-end against a vendored `.dist-info/METADATA` (no network, deterministic).
- **The python lane's agent surface closes the consumer journey at delivery time** — S2's curated 2-agent + 4-skill set is what the cold-run protocol exercises.
- **Local git-hook delivery is achievable Node-free and framework-free** — S2b's bare `core.hooksPath` rung passes the runner-role criteria that pre-commit fails (SSOT #237 BUILD verdict).
- **A scripted W6 cell can discriminate** — RED on planted `print()` violation, GREEN on `logger.info()` clean code, REJECT on `pip:requests` (provenance-rejected, `research-only` verdict logged loudly, never silently written). The cell IS a gate, not coverage theatre (kickoff §5 T-S4-A counter).
- **The framework's shipped docs are an empirical question, not an article of faith** — the one-beat cold-run protocol (authored build-only here, run deferred to host) makes the docs the system under test.

## Gate

This `done.md` gates `getff-freshness-widening` (spec §10). The widening umbrella inherits: the W6 cell pattern (apply per stack), the routed-onward findings above (cell full + cargo/go rungs + `--refresh` + cargo rung-5 cascade), and the cold-run protocol (re-run on widening if a new stack lane's docs are not yet proven).
