<!-- scope:local-sweep-homebrew-path-no-go -->
# Local sweep Homebrew-PATH fix — study verdict NO-GO

> Scope: the Phase-0 study (2026-10-03) of the proposed fix for the PR #1998 incident class
> — «sweep exports the Homebrew PATH itself; one loud final line naming every skipped gate;
> optional block-with-escape arm». All three GO criteria evaluated with runnable evidence;
> criterion A vetoes. No code was changed. Every command below was run on this Mac
> (Apple Silicon, macOS 25.6.0, `/bin/bash` 3.2.57) in the kind-boyd-8b678b worktree at
> `1fab32c3ac5` unless stated otherwise.

## Problem

PR #1998 (2026-10-02) went CI-red on shellcheck SC2086 (`scripts/check-arch-retell.test.sh:69`)
while the local pre-push sweep was believed green. The working hypothesis — recorded in the
operator memory `feedback_prepush_warn_skip_stripped_path.md` and in the incident session's own
analysis — was: the sweep runs inside the pre-push hook with a Homebrew-stripped PATH, so the
`command -v`-guarded rows (`scripts/run-local-ci-sweep.sh:419` actionlint, `:429`
docs-quality-strict, `:440` shellcheck, `:461` vitest-spec-validation) WARN-skip and the sweep
passes without them. Proposed fix: (1) the sweep exports the Homebrew PATH itself, (2) one loud
final line naming every skipped gate, (3) optional block-with-escape.

## Finding 1 — the sweep is not in the pre-push hook (premise misattributed)

Two independent greps over every pre-push surface find no sweep reference:

```text
grep -n 'run-local-ci-sweep' packages/core/hooks/pre-push.ts        → no hits
grep -rn 'run-local-ci-sweep' packages/core/hooks/                  → no hits
```

`.husky/pre-push:43-51` execs `packages/core/hooks/pre-push.ts` (Node ≥20) or falls back to
`packages/core/hooks/pre-push.fallback.sh` — neither calls the sweep. The sweep's only callers
are agent-invoked skills: `.claude/skills/harvest/SKILL.md:77` and
`.claude/skills/dispatcher/SKILL.md:178`. An agent session's Bash tool on this Mac has the full
PATH (`command -v shellcheck` → `/opt/homebrew/bin/shellcheck`), so in the flow that actually
runs the sweep, the tool rows run for real.

## Finding 2 — on this Mac the «stripped PATH → silent green» state is unreachable

node exists at exactly one path on this machine:

```text
which -a node  → /opt/homebrew/bin/node   (only hit; no nvm, no miniconda, no bun, no /usr/local)
```

So node present ⟺ `/opt/homebrew/bin` on PATH ⟺ shellcheck/actionlint/vale/lychee/gh/ast-grep
all present (same directory). A PATH-stripped sweep cannot get past the first npm/npx row:

```text
env PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  SWEEP_DIFF_OVERRIDE="scripts/check-line-citations.mjs" bash scripts/run-local-ci-sweep.sh
→ EXIT=1 … line 1290: npx: command not found … SWEEP: stopped at reference-check (mode=diff)
```

Loud red, never a green with WARN-skips. The paired one-row demonstration (via the sanctioned
`SWEEP_GATES_FILE` seam) shows both shapes:

```text
stripped PATH:  [sweep] WARN-SKIP shellcheck — degraded, NOT a real run / SWEEP: 1 gate(s) passed
full PATH:      [sweep] PASS shellcheck
```

The row-level skip shape exists, but on this Mac no real sweep reaches it — the npm rows fail
first. The only environment found where a sweep can complete green with the tool rows skipped
is a Linux host whose node is not Homebrew's: the aif container (`aif-agent-1`: node
`/usr/local/bin/node`, gh `/usr/bin/gh`, shellcheck/actionlint/vale/lychee ABSENT) and, partly,
the PC (tools installed natively: `/usr/bin/shellcheck`, `~/.local/bin/{actionlint,vale,lychee}`;
gh ABSENT). No evidence was found of the sweep ever running in the container (no history, no
transcript hit), and fix (1) is a no-op there — `/opt/homebrew/bin` does not exist on Linux.

Related latent gap measured while testing: a push launched from a Homebrew-less context skips
the whole pre-push hook quietly — `env -i … bash .husky/pre-push` prints
`✅ fallback: no new commits.` and exits 0 (the bash fallback runs, the TS checks never do).

## Finding 3 — the incident class recurs, but not through this mechanism

Failed `audit-self.yml` rounds, 2026-08-03 → 2026-10-03 (sample, not exhaustive): 8 failed
rounds. The CI shellcheck step failed in exactly 2, from two independent branches:

- run `36789433657` 2026-09-30, `feat/ci-capture-runner-values` → PR #2006, fixed before merge
  by two shellcheck commits (`e4400449`, `2f27383c`);
- run `37011761518` 2026-10-02, `claude/arch-retell-source-column` → PR #1998 (SC2086).

That is ~3 events/quarter extrapolated — above the ≥2/quarter bar, with the honest caveat that
both events sit in the last three days of the window (a scripts-heavy wave, possibly a burst).
But in both cases the miss is «the sweep did not run shellcheck over the final tree» — not
«it ran and skipped». A Mac sweep run over the #1998 branch with tools present would have gone
RED (local 0.11.0 flags SC2086; the paired `PASS shellcheck` above is the current tree at the
same shellcheck scope). The incident session's sentence «pre-push хук исполняется с урезанным
PATH — Homebrew (где shellcheck) недоступен» is disproven by Findings 1-2.

## Criterion verdicts

**A. ПОЛЕЗНОСТЬ — NO-GO (veto).** The gap as specified — a sweep passing green because the
PATH hides installed tools — is unreachable on the machine that runs the sweep (Finding 2) and
rests on a caller that does not exist (Finding 1). The recurring class is real (Finding 3) but
its cause is the sweep not being run over the final tree; a PATH export inside the sweep does
not touch that.

**B. НЕ ЛОМАЕТ — passable with guards, but does not deliver what it promises.** Platform
safety is fine: the prepend is a no-op on Linux (verified natively on the PC), needs only the
`set -u`-safe `"${PATH:-}"` form, bash 3.2-compatible. Version pins agree today for
ast-grep 0.44.1, ruff 0.15.21, rustc 1.96.1, vale 3.23.0, lychee 0.24.2 (all == the
`audit-self.yml` pins). The standing exception is shellcheck: local 0.11.0 vs the CI runner
image's 0.9.0 (`audit-self.yml:1178-1194` installs nothing — it uses the preinstalled binary),
and this divergence has already produced local-green → CI-red twice (SC2015, PR #1003/#934;
PR #1615 with a severity-flag variant — operator memory
`feedback_shellcheck_gate_local_var_case_variant.md`). So even where the exported PATH makes
the row run, local PASS does not predict CI PASS for shellcheck.

**C. НЕ ЗАТРУДНЯЕТ — NO-GO against the stated 10 s bar.** The task's «shellcheck full scope
took ~1s» is stale. Measured twice on the current tree: 49.7 s and 47.4 s wall, 45.9 s user at
99% of one core, 106 files (`setup.d/*.sh install.sh scripts/*.sh scripts/lib/*.sh`). A context
newly activated by fix (1) pays ~50 s per push. The other newly-runnable rows are cheap:
actionlint 0.87 s, docs-quality-strict 4 s (offline vale+lychee, PASS), vitest-spec-validation
~2-3 s. Fix (2) costs nothing — but note the per-row lines already exist
(`run-local-ci-sweep.sh:1306` prints `WARN-SKIP <name> — degraded, NOT a real run` and the
output is captured to a log file), so a final aggregation line is a marginal UX increment, not
a mechanism (peer: attention-is-not-a-mechanism §1 — the skip lines' consumer is still someone
reading the push output).

## What the real fix direction is

The sweep's own promotion criterion has arguably fired:
`.claude/skills/harvest/SKILL.md:21` — «a harvest reddens CI **after** this skill ships (skill
skipped or a gate missing) → promote the sweep to a pre-push gate». Two CI-reds-after-harvest
in two days (#2006, #1998) match that trigger. Promotion is a design kickoff (which rows, what
cost budget on every push — Finding 3's 50 s shellcheck row is the main obstacle, and the
shellcheck 0.9/0.11 divergence means local-PASS ≠ CI-PASS regardless), not a PATH patch. If
promotion happens, the PATH question returns in a new form (git hooks inherit the pushing
process's environment, and a Homebrew-less push context currently bypasses the hook entirely —
Finding 2's last measurement); fix items (1) and (2) become inputs to that design, not a
standalone change.

## §1.7 self-review

- **Forward-check:** [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — all
  evidence is deterministic local commands and the GitHub REST API; no LLM calls.
  [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)
  — the conclusion recommends a channel change (promotion), not another warning line; fix (2)
  alone is explicitly downgraded for the `#warning-nobody-reads` shape.
  [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — no
  capability introduced (doc-only patch; the studied fix was not built).
- **Backward-check:** corrects the operator memory
  `feedback_prepush_warn_skip_stripped_path.md` (mechanism disproven; the «read the full gate
  output / rerun skipped gates by hand» habit survives). Consistent with
  [ci-tool-pinning.md](../../../.claude/rules/ci-tool-pinning.md) (no install step existed to
  pin shellcheck in CI — the version comes from the runner image; noted as context, not
  re-litigated here). No existing rule is contradicted; the promotion fork is surfaced for an
  explicit operator decision, not acted on (PR-strategy rule: no drive-by scope).
