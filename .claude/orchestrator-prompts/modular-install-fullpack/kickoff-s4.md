# Stage S4 kickoff — `mif-s4-full-oneshot`

> **Umbrella:** `modular-install-fullpack` (see [`kickoff.md`](kickoff.md)). **Stage:** S4 of S0→S5.
> **Authoritative for:** S4 task — `./setup -y`/`--yes` = run all layers + true non-interactivity; dev-deps install on the yes-path so enforcement is live.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md). Timeliner acceptance — that is S5.

## §1 Stage goal

Make `./setup -y` (`--yes`; `--full`/`--all` accepted aliases) the **single «на всё согласен» switch for everyone** (umbrella §2.2/§2.3): run every layer non-interactively and install dev-deps so the shipped rules-as-tests actually enforce (without dev-deps, pre-push is REDUCED — rules don't fire).

## §2 Input — DEFINED BY S1+S2+S3 (predecessors)

**Read first:** S1's [`setup.d/LAYERS.md`](../../../setup.d/LAYERS.md) (the dispatcher + layer set), the `05-mcp` layer from S2, the revived tool-bootstrap layer + `15-companions-stack` from S3. Also read the **`setup` wrapper** (`setup:8-22`) and `install.sh:78` flag-parse — S4 owns the wrapper plumbing (§3.1). **Re-confirm the flag-forward seam against S1's ACTUAL dispatcher shape** (review-finding M4): S1 rewrote `install.sh` into a thin dispatcher, and S1's byte-identical invariant pins filesystem output, NOT the `setup`↔`install.sh` flag interface — so verify the current interface from `LAYERS.md` + the post-S1 `install.sh`, not the pre-S1 monolith. S4 wires `--full` to run all layers in order + removes the interactive tail. If `LAYERS.md` or any of S1/S2/S3 layers are absent → **STOP** (gates not met).

## §3 Deliverables

1. **Plumb `./setup -y` end-to-end** (review-finding C1 + flag-revision 2026-06-24 — canonical is `-y`/`--yes`, NOT a new `--full` on the wrapper): the wrapper already parses `--yes`/`--all` (`setup:8`, MODE=yes) — the gap is `setup:22` forwards only `${STACK}`/`${DRY}`, not the yes-mode. So: (a) **add a short `-y`** alias (and accept `--full` as an alias) in the wrapper arg loop; (b) on the yes-path (`--yes`/`-y`/`--all`/`--full`) **forward `--full` to `install.sh`** on `setup:22` (install.sh's internal `--full` is its scope=full gate — do NOT rename it, ~7 sites depend on it); (c) (T2b) under the yes-path, `install.sh` must NOT block on the interactive stack `read -rp` at `install.sh:181` — infer the stack or require it as an arg.
2. **The yes-path runs ALL layers** (05-mcp → … → 70-deps) in one pass, non-interactive, including the S2 DeepWiki machine-scope step (detect-first) and the S3 tool-bootstrap seed.
3. **dev-deps default-on on the yes-path** (umbrella §2.3): the forwarded `--full` makes `install.sh` install the dev-deps the shipped artifacts need (no copy-paste tail), so pre-push runs in FULL mode, not REDUCED. Single flag, no self/consumer branch.

## §4 Acceptance

- `./setup -y <stack>` (and aliases `--yes`/`--all`/`--full`) runs end-to-end **non-interactively** (no `read` prompt blocks), exit 0, all layers applied.
- After `-y`, `git push` runs the FULL pre-push (not REDUCED) — dev-deps present, rules-as-tests load.
- `-y` is one flag for all; no hidden personal-vs-consumer code path (grep for a self/consumer branch → none).
- Idempotent: second `./setup -y` is a no-op / «already installed».
- `--full` still works as an alias (back-compat); install.sh-internal `--full` is unchanged (not renamed).

## §4c Autonomous aif-handoff dispatch — park-don't-guess contract (LIVE)

> Operator posture: **technical-auto + strategic-to-operator** (2026-06-24).

**Lever 1 — conservative aif config (review-finding I3: these are aif-container-side knobs — set them in the aif-handoff environment BEFORE its container starts, not via `export` in the dispatch shell, which won't propagate over REST. Only `AGENT_AUTO_REVIEW_STRATEGY` is repo-referenced; treat the others as aif-side config and verify they're honoured in your aif setup):**

```bash
export AGENT_MAX_REVIEW_ITERATIONS=1
export AGENT_AUTO_REVIEW_STRATEGY=closure_first
export AGENT_SKIP_REVIEW=false
```

**Lever 2 — park-don't-guess (addressed to the aif agent, verbatim):**

> **aif agent — fork discipline (non-negotiable):** PROCEED autonomously on the decided wiring: make `-y`/`--yes` the canonical switch, forward `--full` to `install.sh` on the yes-path, dev-deps default-on on the yes-path (umbrella §2.2/§2.3 — already decided, do NOT relitigate). PARK (`manualReviewRequired`, «Option A → X / Option B → Y», STOP that task) on: **(1)** how to resolve stack under `--yes` when it cannot be inferred (require explicit arg vs default to a stack — behaviour-changing); **(2)** anything that would introduce a new flag or a self/consumer branch (umbrella §2.3 forbids the branch — if the plan seems to need one, park). Do NOT weaken any existing safety default (`--force`/skip-if-exists) to «make `--full` smoother» — park if tempted.

**Lever 3** — operator reviews aif's autonomous decisions, not only open questions.

**Egress gate (mandatory after `status=done`):**

```bash
npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging
```

## §stage-gate (before dispatching S4)

S4 depends on S1, S2, AND S3 — **all three must be merged** (single aggregate verdict, review-finding I3):

```bash
open=0
for b in mif-s1-lib-and-layers mif-s2-mcp-layer mif-s3-revive-toolbootstrap; do
  gh pr list --search "is:merged head:$b base:staging" --json mergedAt --limit 3 2>/dev/null \
    | grep -q mergedAt && { echo "  $b ✓"; open=$((open+1)); } || echo "  $b ✗ not merged"
done
[ "$open" -eq 3 ] && echo "S4 GATE OPEN (3/3)" || echo "S4 GATE CLOSED ($open/3) — do not dispatch S4"
```

## §5 AI-traps active (per `ai-laziness-traps.md §3`)

See [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md). **Active: T3, T5, T15, T16, T19, T20.**

- **T16** — `--full` today = «only dev-deps». Do NOT assume «full уже значит фулпак»; S4 is what makes it true.
- **T3** — cite `install.sh:181` (the interactive blocker) + the `--full`/`--yes` parse sites; verify non-interactive run empirically.
- **T19** — own cold-QA: a real `./setup -y` on a throwaway repo, then `git push` confirming FULL (not REDUCED) pre-push, before handoff.

**Domain-specific:**
- **T-MIF-D** — declaring «non-interactive» from the flag-parse code without a real run. Counter: actually run `./setup -y </dev/null` and confirm no prompt blocks + FULL pre-push fires.

```bash host-verify
# Retro-marked 2026-08-21: §4 acceptance keeps the installed surface byte-identical (empirical consumer probes stay in §4; the snapshot compare is the repo-runnable guard)
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```
