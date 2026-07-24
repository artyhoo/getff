# container-gate-reachability-audit — kickoff

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Type:** R-phase — enumeration audit, docs-only deliverable. **No source file may be edited.**
> **Origin:** aif-parity umbrella. Two prior probes answered «is this one hook silent?»; neither enumerated the population. This one enumerates.
> **Deliverable:** one research patch at `docs/meta-factory/research-patches/2026-07-24-container-gate-reachability.md`, plus the PR that lands it.
> **Base branch:** staging (tip at dispatch time: `3bbc58b8d`).

## §0 Cold-start context — self-contained, read only this

**The question.** You are running inside a container task worktree of this framework. The framework's whole thesis is that its rules are executable gates that fire at the earliest reachable channel. **Which of those gates are actually alive in the environment you are running in, and which are structurally inert?**

«Inert» has several distinct causes, and the audit's value is in telling them apart:

| cause | shape |
|---|---|
| **A — not registered** | the hook is not wired into the harness config that this session actually reads |
| **B — dependency absent** | the hook is registered and runs, but exits early because a tool it needs (`jq`, `node`, `tsx`, `python3`, `gh`) is not resolvable |
| **C — resolution path wrong** | the dependency exists in the environment but the hook looks for it at a path that does not resolve here (e.g. a repo-local `node_modules` that a git worktree does not have) |
| **D — output goes nowhere** | the hook runs and detects a violation, but reports on a channel this session never receives |
| **E — alive** | registered, dependencies resolve, output reaches the model |

**What changed recently, and why the audit is timed now.** Two fixes landed on `staging` before your base was synced:

- PR #1116 + #1120 made dependency-skips **loud on the model-visible channel** — a hook that skips now says so via `hookSpecificOutput.additionalContext`, instead of writing to a stderr nobody reads. So cause **B** and **C** are now *observable from your vantage*, where previously they were silent.
- The container's git base was stale by 4 commits and was synced to `3bbc58b8d` on 2026-07-24. Your worktree branched off the synced base, so you are the first task to run against the fixed hooks.

## §1 Population — enumerate before you sample

**T10 is the governing trap here: report completeness against what EXISTS, not against what you looked at.**

Start by enumerating the full population, and state its size:

```bash
ls -1 .claude/hooks/*.sh | wc -l
ls -1 plugin/hooks/* | wc -l
```

Then, for the registration question, find every config that could wire a hook into a session in this environment — the repo's own settings, any plugin manifest, any harness config rendered by `scripts/render-harness-config.mjs`, and whatever the running session actually loaded. Do not assume one file is the answer; report which ones exist here and what each registers.

## §2 Method — per hook, per cause

For **every** hook in the population, determine and record:

1. **Registered here?** — cite the config file and line that registers it, or state that no config in this environment does.
2. **Dependency guard** — quote the guard line with `file:line` (e.g. `command -v jq >/dev/null 2>&1 || exit 0`) and resolve each named dependency *in this environment* with `command -v`. Paste the output.
3. **Resolution paths** — any binary the hook invokes via a constructed path rather than `PATH` (grep for `node_modules/.bin`, `$REPO_ROOT/`, absolute interpreter paths). For each, test whether that exact path resolves *in this worktree*, and separately whether the binary exists *anywhere* in the environment. **These two answers differing is finding class C and is the most valuable thing this audit can surface.**
4. **Verdict** — exactly one of A / B / C / D / E, with the evidence that forced it.

**Then, live-fire what you can.** For hooks you classify as E (alive) or D (output goes nowhere), construct an input that *should* trip them and record what you actually observe from your own vantage — verbatim bytes, or the literal string `NOTHING APPEARED` if there is silence. Do not paraphrase hook output. Do not infer an outcome you did not observe.

**Where a live-fire is blocked** (permission layer, missing fixture, anything), say so, name the blocker, and mark the row `BLOCKED — <reason>`. A blocked probe is a legitimate result; a probe you skipped by reasoning «it would behave like the other one» is not (see T-CGR-A in §5).

## §3 Deliverable

One markdown file: `docs/meta-factory/research-patches/2026-07-24-container-gate-reachability.md`.

Required structure:

1. **Header blockquote** carrying `**Type:**`, `**Scope:**`, `**Verified against:**` (the staging SHA you are on, read with `git rev-parse`), `**Date:**`.
2. **§1 Population enumeration** — counts, with the commands that produced them. This section comes *before* any findings.
3. **§2 Environment resolution table** — every dependency named by any hook (`jq`, `node`, `tsx`, `python3`, `gh`, …) → `command -v` output → present/absent.
4. **§3 Per-hook verdict table** — hook | registered (config:line) | dependency guard (file:line) | resolution class | verdict A-E | evidence.
5. **§4 Live-fire results** — per attempted hook: input used, observed output verbatim or `NOTHING APPEARED` or `BLOCKED — <reason>`.
6. **§5 Rollup** — counts per verdict class, and explicitly: *how many registered gates enforce nothing here, and for which of the five causes.*
7. **§6 Coverage statement** — what fraction of the population you verified mechanically vs. inferred, and what would falsify your rollup.

## §4 Constraints (binding)

- **Docs-only.** The only file you create or modify is the research patch (plus whatever the repo's own generated-artefact hooks touch on commit). **Do not edit any hook, test, or source file.** If you find a bug, write it down — a fix is a different task and is already assigned elsewhere.
- **No `--no-verify`, no gate bypass.** If a commit gate rejects you, fix what it names and retry.
- **PR body needs `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied`** (H3 headers verbatim), each ≥40 non-whitespace characters and each citing at least one `file.ext:line`.
- **Commit trailer:** `Prior-art: skipped — research patch documenting an environment audit, no new capability` in the commit body and the PR body.
- **Park, don't guess.** An honest «I could not determine this, here is what blocked me» is worth more than a confident wrong row. The prior probe in this umbrella reported `tsx: MISSING` when `tsx` was in fact present at a different path — right symptom, wrong cause, because it checked one path and generalised. Do not repeat that.

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md` §2 and §3)

**Active canonical traps: T1, T3, T9, T10, T14, T15.**

- **T1 — «looked at 3, all clean, category done».** Sampling floor does not apply because this audit is exhaustive: every hook in the population gets a row. A missing row is a defect in the deliverable.
- **T3 — no prose-only findings.** Command + output, or `file:line` with the line's actual content. Nothing asserted from reading a doc.
- **T9 — do not sample the easy surfaces.** The hooks that are trivially alive are the least informative. Spend your effort on the ones where registration or resolution is ambiguous.
- **T10 — enumerate the population before sampling.** §1 comes before §3 in the deliverable for this reason. A rollup without a denominator is meaningless.
- **T14 — «no findings» ≠ «no defect».** If your coverage is partial, the finding is «coverage insufficient to conclude», not «clean». §6 exists to force this distinction.
- **T15 — self-application.** This framework's own thesis is that gates must fire at the earliest reachable channel. Report what this audit says about the framework running *on itself* in this environment: are the gates that guard this very PR alive for you right now?

**Domain-specific trap — T-CGR-A «inferred instead of attempted».** The tempting move, when a live-fire looks like it will behave the same as one you already ran, is to write down the expected result instead of running it. That exact substitution happened in the previous probe in this umbrella and was caught in review. Every row in §4 is either an observation or an explicit `BLOCKED — <reason>`. There is no third category, and «same shape as the row above, so presumably…» is not an observation.

## §6 Report — what to hand back

1. The PR number and branch.
2. The §5 rollup verbatim — counts per verdict class.
3. The single most consequential finding, stated in one sentence, with its evidence.
4. What you could not verify and why.
