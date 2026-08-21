# Stage S2 kickoff — `mif-s2-mcp-layer`

> **Umbrella:** `modular-install-fullpack` (see [`kickoff.md`](kickoff.md)). **Stage:** S2 of S0→S5. Parallel-with: S3.
> **Authoritative for:** S2 task — the `05-mcp` layer: per-project context7 → `.mcp.json` (regression L1) + `kind=mcp` in the manifest engine + user-scope DeepWiki inside the `-y` (yes) pass (detect-first).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md). Stack-aware tool selection — that is S3 (and gated by R1).

## §1 Stage goal

Fill the `05-mcp` layer (stub from S1) so MCP provisioning ships in `./setup`: restore the context7 `.mcp.json` write that fell out at the `./setup` migration (regression L1), teach the manifest engine a `kind=mcp` row type, and add the user-scope DeepWiki bootstrap inside the `-y` (yes) pass — **detect-first, idempotent, machine-scope-labelled** (umbrella kickoff §2.5).

## §2 Input — DEFINED BY S1 (predecessor)

**Read first:** S1's named output [`setup.d/LAYERS.md`](../../../setup.d/LAYERS.md) (layer registry + `lib.sh` API surface) + the `05-mcp` stub S1 placed. S2 fills that stub using `lib.sh` helpers; it does NOT re-cut layers. Also read `setup.d/engine.sh` (`companion_step` loop) and `setup.d/companions.manifest` (the `kind=` contract). If `LAYERS.md`, the `05-mcp` stub, or `lib.sh` is absent → **STOP** (S1 gate not met).

> **⚠ Channel/ordering constraint (review-finding I1, verified on code 2026-06-24):** `setup` runs `install.sh` FIRST (`setup:22`), THEN the wrapper companion loop (`setup:24-34`, reading `companions.manifest`), THEN the bridge. So **anything processed by the post-install wrapper loop runs AFTER `install.sh`'s `70-deps`** — which would break the fixed «`05-mcp` before deps» invariant (umbrella §2.5). Therefore **all per-project MCP provisioning is owned by the `05-mcp` layer INSIDE `install.sh`** (which sources `engine.sh` and consumes `kind=mcp` rows there, early). The post-install wrapper companion loop stays for `cc-plugin`/`external-service` rows ONLY — it does NOT process `kind=mcp`.

1. **Per-project MCP (`05-mcp` layer, INSIDE install.sh, runs EARLY, before `70-deps`):** write/merge `.mcp.json` with the context7 server (porting the logic from the **orphaned** `setup.sh:289-303` — see M2 note) via `lib.sh` file-merge helpers — detect-first (additive merge; never clobber a consumer's existing `.mcp.json` entries), `--force` honoured, `--dry-run` honoured.
2. **`kind=mcp` consumed by the `05-mcp` layer (NOT the wrapper loop):** teach the `05-mcp` layer to source `engine.sh` and detect-first install each `kind=mcp` manifest row via `claude mcp add ...` (official mechanism, no version pin — `companion-install-principle.md`) — **inside install.sh, before `70-deps`**. Do NOT route `kind=mcp` through the post-install `setup:24-34` loop (that runs after deps — §I1 note).
   > **M2:** `setup.sh` is **orphaned dead code** at HEAD (nothing sources it; `setup`→`install.sh`). Port its context7 block into the `05-mcp` layer — do NOT revive or wire into `setup.sh`.
3. **User-scope DeepWiki inside the `-y` pass:** a step in the yes-path that runs `claude mcp add --scope user deepwiki ...` ONLY when `claude mcp list --scope user | grep -q deepwiki` is empty (idempotent); the step prints an explicit «machine-scope (one-time)» label so the side-effect is visible. (User-scope is machine-global, so its ordering vs deps is irrelevant — but keep it in the install.sh yes-path for single-pass UX.)

## §4 Acceptance

- **Empirical, not «manifest contains a line» (T-MIF-A/T-MIF-C):** after `./setup` on a clean consumer, `mcp__context7__*` is actually reachable (probe a context7 call), not merely that `.mcp.json` was written.
- Re-running `./setup -y` does NOT duplicate the DeepWiki user-scope entry (detect-first verified by second-run no-op).
- `05-mcp` runs before `70-deps` (lexicographic order holds); MCP config lands even if a later dep-install fails.
- `--dry-run` shows the MCP step plan, writes nothing.

## §4c Autonomous aif-handoff dispatch — park-don't-guess contract (LIVE)

> Operator posture: **technical-auto + strategic-to-operator** (2026-06-24).

**Lever 1 — conservative aif config (review-finding I3: these are aif-container-side knobs — set them in the aif-handoff environment BEFORE its container starts, not via `export` in the dispatch shell, which won't propagate over REST. Only `AGENT_AUTO_REVIEW_STRATEGY` is repo-referenced; treat the others as aif-side config and verify they're honoured in your aif setup):**

```bash
export AGENT_MAX_REVIEW_ITERATIONS=1
export AGENT_AUTO_REVIEW_STRATEGY=closure_first
export AGENT_SKIP_REVIEW=false
```

**Lever 2 — park-don't-guess (addressed to the aif agent, verbatim):**

> **aif agent — fork discipline (non-negotiable):** PROCEED autonomously on the deterministic regression-restore: `.mcp.json` context7 write, `kind=mcp` engine wiring, detect-first DeepWiki step, the empirical reachability probe. **L1 fork (propose-only vs opt-in auto-install) — do NOT re-park here:** it is the SHARED fork resolved ONCE per umbrella §3.2 (single owner, conflicts with tool-bootstrapping Rule 3); follow that resolution, do not decide it independently. PARK (`manualReviewRequired`, «Option A → X / Option B → Y», STOP that task) on: **(1)** if restoring `.mcp.json` would overwrite a consumer's existing MCP entries any way other than additive merge (data-loss risk — park, never clobber). Do NOT add ANY stack-aware / tool-selection logic here — that is S3, and gated by R1 (umbrella §9). Touching it is out of scope; park if the plan seems to require it.

**Lever 3** — operator reviews aif's autonomous decisions, not only open questions.

**Egress gate (mandatory after `status=done`):**

```bash
npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging
```

## §stage-gate (before dispatching S2)

S2 depends on S1:

```bash
gh pr list --search "is:merged head:mif-s1-lib-and-layers base:staging" \
  --json number,mergedAt --limit 5 2>/dev/null | grep -q mergedAt \
  && echo "S1 GATE OPEN" || echo "S1 GATE CLOSED — do not dispatch S2"
```

## §5 AI-traps active (per `ai-laziness-traps.md §3`)

See [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md). **Active: T3, T11, T13, T15, T16, T19, T20.**

- **T13/T16** — context7/DeepWiki «adopted» ≠ reachable. Confirm the MCP actually loads, not that the row exists. «Upstream problem class vs ours» written explicitly if ADOPTing a pattern.
- **T3** — cite the legacy `setup.sh` line range you are restoring; verify the new write produces the same `.mcp.json` shape.
- **T19** — own cold-QA: dispatch on a throwaway clean repo and probe the MCP before handoff.

**Domain-specific:**
- **T-MIF-A** — «MCP адоптирован → ставится» без проверки. Counter: empirical install + reachability probe on a clean consumer.
- **T-MIF-C** — «context7 вернули» = строка в `.mcp.json`, но MCP не грузится. Counter: `mcp__context7__*` reachable, not only file written.

```bash host-verify
# Retro-marked 2026-08-21: §4 acceptance keeps the installed surface byte-identical (empirical consumer probes stay in §4; the snapshot compare is the repo-runnable guard)
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```
