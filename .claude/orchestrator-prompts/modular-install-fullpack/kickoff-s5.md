# Stage S5 kickoff — `mif-s5-timeliner-acceptance`

> **Umbrella:** `modular-install-fullpack` (see [`kickoff.md`](kickoff.md)). **Stage:** S5 of S0→S5 (terminal, cross-cutting).
> **Authoritative for:** S5 task — dogfood `./setup -y` on the Timeliner consumer until «всё сразу как надо» + the shipped rule actually fires.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md). Framework-defect SSOT — GitHub issue tracker (consumer-findings doc is a historical snapshot).

## §1 Stage goal

Prove the umbrella's real success criterion (umbrella §2.6) on a live consumer: `./setup -y` on Timeliner installs the fulpack **right the first time** AND **a shipped rule actually fires** — not just «files landed».

## §2 Input — DEFINED BY S4 (predecessor) + findings backlog

**Read first:** the S4 `-y` (yes-path) one-shot behaviour; `docs/meta-factory/consumer-findings-timeliner.md` (F1–F13, the polygon defect backlog + which are fixed/open); plans-check §5 (the Node-version `.ts`-loading fragility: planted-violation RED on Node 22, class #636/#642/#644). If `./setup -y` is not yet the one-shot from S4 → **STOP** (S4 gate not met).

## §3 Deliverables

1. Run `./setup -y` on a clean Timeliner checkout; record every manual tail step still required (target: zero).
2. Triage findings against F1–F13: which still reproduce, which block the fulpack, which don't. File/close issues (tracker is SSOT).
3. **Enforcement-liveness proof (the real gate):** (a) after `-y`, pre-push is FULL (dev-deps present), NOT REDUCED; (b) a planted-violation test (e.g. `f17-lint-rules-planted-violation`) is GREEN on Timeliner's target Node. **Self-contained failure mode to watch (inlined so this gate needs no external doc — review-finding M3):** shipped `.ts` ESLint rules can fail to load via the tsx loader on Node 22 (planted violation NOT flagged + uncaught exception) — same class as fixes #636/#642/#644 (which made `.ts` eslint config load via the tsx loader); note CI runs Node 20, so a Node-22 consumer can be RED where CI is green. If RED on the target Node, that is a blocker to surface, not to paper over.
4. Iterate: `./setup -y` → fix blocking finding → repeat until «всё сразу зелёное» + rule fires.

## §4 Acceptance

- `./setup -y` on Timeliner reaches a working fulpack with **zero manual tail steps**.
- pre-push runs FULL (not REDUCED); planted-violation test GREEN on the target Node version.
- Remaining F-items are either closed or explicitly classified non-blocking (with evidence), not silently ignored (T14: clean ≠ covered — state coverage).
- Umbrella `done.md` written at S5 merge (schema per CLAUDE.md «Umbrella closure convention»).

## §4c Autonomous aif-handoff dispatch — park-don't-guess contract (LIVE)

> Operator posture: **technical-auto + strategic-to-operator** (2026-06-24). S5 is acceptance/triage — MORE forks are genuinely strategic here; lean toward parking.

**Lever 1 — conservative aif config (review-finding I3: these are aif-container-side knobs — set them in the aif-handoff environment BEFORE its container starts, not via `export` in the dispatch shell, which won't propagate over REST. Only `AGENT_AUTO_REVIEW_STRATEGY` is repo-referenced; treat the others as aif-side config and verify they're honoured in your aif setup):**

```bash
export AGENT_MAX_REVIEW_ITERATIONS=1
export AGENT_AUTO_REVIEW_STRATEGY=closure_first
export AGENT_SKIP_REVIEW=false
```

**Lever 2 — park-don't-guess (addressed to the aif agent, verbatim):**

> **aif agent — fork discipline (non-negotiable):** PROCEED autonomously on the deterministic verification: run `./setup -y`, capture output, run the planted-violation test, record findings with evidence. PARK (`manualReviewRequired`, «Option A → X / Option B → Y», STOP that task) on every JUDGEMENT fork: **(1)** «is finding Fx a fulpack blocker or acceptable?» — operator decides scope; **(2)** any framework-source fix beyond Timeliner config (changing the shipped framework is a separate concern — surface, do not patch the framework mid-acceptance, per PR-strategy in CLAUDE.md); **(3)** if the planted-violation test is RED on the target Node, park with the failure mode stated — do NOT downgrade the test or the acceptance bar to make it pass. «Declaring victory at floor depth» (T14) is the failure this prevents.

**Lever 3** — operator reviews aif's autonomous decisions, not only open questions.

**Egress gate (mandatory after `status=done`):**

```bash
npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging
```

## §stage-gate (before dispatching S5)

S5 depends on S4:

```bash
gh pr list --search "is:merged head:mif-s4-full-oneshot base:staging" \
  --json mergedAt --limit 5 2>/dev/null | grep -q mergedAt \
  && echo "S4 GATE OPEN" || echo "S4 GATE CLOSED — do not dispatch S5"
```

## §5 AI-traps active (per `ai-laziness-traps.md §3`)

See [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md). **Active: T1, T3, T6, T14, T15, T19, T20.**

- **T14** — clean run ≠ no problem. Distinguish «covered, fires» from «didn't look». State coverage honestly (T6 — not «high confidence»).
- **T1** — don't stop at «3 things worked»; the criterion is enforcement-liveness on the target Node, end-to-end.
- **T3** — every «Fx fixed/blocking» claim carries the actual repro/probe output.
- **T19** — own cold-QA before declaring the umbrella done.

**Domain-specific:**
- **T-MIF-E** — «файлы легли → готово». The umbrella's whole point (§2.6) is the rule FIRES, not that the install exited 0. Counter: planted-violation GREEN on target Node is the gate.

```bash host-verify
# Retro-marked 2026-08-21: §4 acceptance keeps the installed surface byte-identical (empirical consumer probes stay in §4; the snapshot compare is the repo-runnable guard)
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```
