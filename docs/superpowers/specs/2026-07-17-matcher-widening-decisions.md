# matcher-widening — decisions & findings log

Resume session (2026-07-21) working the night-mode kickoff. This file records forks
resolved autonomously (technical) and findings surfaced out-of-scope.

---

## D1 — base moved 28 commits (4a9b508a9 → 2c77e4407): rebased [technical, resolved]

The kickoff was written against base `4a9b508a9`. On resume, `origin/staging` had advanced
28 commits (tip `2c77e4407`). Rebased `feat/matcher-widening-multiedit` (4 commits) onto the
fresh tip via `git rebase --onto origin/staging 4a9b508a9`. No conflicts on the STEP-1 commit;
the STEP-2 WIP (stashed, re-applied by ref) merged cleanly except `check-hook-marker.test.ts`,
where staging #1030 (zcode-parity schema-compliance) had added a ZCODE arm + refactored
`runHook()` to return `{status,...}`. The 3 new `@file-content-gate` arms were reconciled to
`.status` (git rerere replayed the resolution; verified by `vitest`: 11/11 green).

Rationale: rebase (not merge) keeps the branch linear on the fresh base so STEP-2 is authored
against the current hook code (staging #1043 standardized `REPO_ROOT` env-first in the exact
hooks this PR extends).

## D2 — plugin channel appeared post-base: propagate widening surgically, NOT via render --write [technical, resolved]

**Finding (load-bearing).** STEP-1 (kickoff) widened 5 PostToolUse matchers `Edit|Write` →
`Edit|Write|MultiEdit` and regenerated `.claude/settings.json` via
`scripts/render-harness-config.mjs --write`. At STEP-1's base the plugin channel
(`plugin/hooks/hooks.json`, added by staging zcode-parity #1030/#1036/#1046) did NOT exist.
Post-rebase it does, and it carried the same 5 gate matchers **narrow** (`Edit|Write`) — the
widening had never reached it.

**Why render --write is the WRONG tool here.** `plugin/hooks/hooks.json` contains
hand-maintained ZCode-parity **twins** (`inject-project-digest`, `inject-output-language`,
`warn-subagent-report-zcode`) that are NOT in the harness-model SSOT and NOT produced by
`emitPlugin` (its `PLUGIN_INTERNAL_HOOKS` constant carries only `session-start`). A full
`render --write` regenerates the file from scratch and **clobbers all 5 twin refs**. Verified:
render output hook-name set = staging set minus those twins.

**Resolution.** Surgically widened the 5 `"matcher": "Edit|Write"` → `"matcher":
"Edit|Write|MultiEdit"` occurrences in `plugin/hooks/hooks.json` (sed, exact string),
preserving all twins. Result: narrow=0 wide=6, twins intact (5 refs), valid JSON, diff = 5
matcher lines only. `.claude/settings.json` (CC channel) IS fully render-reproducible (twins
are plugin-only), so it stays as STEP-1 rendered it.

## F1 — staging SSOT/render drift is pre-existing and UNGATED [finding, OUT OF SCOPE — surfaced, not fixed]

While resolving D2 I confirmed that on **pristine staging** (all three rendered files at their
committed state) `node scripts/render-harness-config.mjs --check` reports:

```text
✗ harness-config drift:
    - plugin/hooks/hooks.json: drift vs SSOT
```

i.e. staging's committed `plugin/hooks/hooks.json` is NOT reproducible from its own SSOT
(`harness-model.json`) — the zcode-parity twins were added directly to the rendered file. This
is a real discipline gap for a rules-as-tests project (an SSOT-render whose output has diverged
from the SSOT). It is **not CI-gated**: `.github/workflows/audit-self.yml` runs
`render-rules.ts --check` and `render-rule-index.mjs --check`, but NOT
`render-harness-config.mjs --check`. That is why staging is green despite the drift, and why
the kickoff's Task-D "render --check must be green" gate is **stale** (it was green at STEP-1's
older base, before the twins landed).

**Scope decision.** Per the PR-strategy discipline (CLAUDE.md — do not autonomously expand an
atomic PR to fix a separate systemic issue), this PR does NOT attempt to reconcile the
twin/SSOT drift. My matcher change is drift-neutral-to-improving on the matcher axis (after it,
the committed matchers MATCH render output; only the pre-existing twin drift remains). Surfaced
here + in the morning report for the operator to decide whether to open a separate task:
either (a) teach `emitPlugin` to emit the twins from a manifest so hooks.json is
render-reproducible again, or (b) add `render-harness-config.mjs --check` to CI as a gate once
(a) is done.
