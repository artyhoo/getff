# matcher-widening — decisions & findings log

Resume session (2026-07-21) working the night-mode kickoff. This file records forks
resolved autonomously (technical) and findings surfaced out-of-scope.

---

## D5 — second rebase onto staging trunk-restore (8 inherited reds + F1 cleared) [technical, resolved]

During cold-review the branch inherited 8 pre-existing staging test failures (staging trunk was
red: `harness-config-drift`, `inject-subagent-context` ×5, principle 11, principle 13 — verified
identical on a pristine `origin/staging` worktree, so NONE were introduced by this PR). Before
push, `origin/staging` advanced to `4e8da8357`, whose `62d90304d fix(gates): restore green trunk`
fixes exactly those blockers (+ the F1 render/twin drift). Rebased onto it. One conflict, in
`plugin/hooks/hooks.json`: staging inserted an `Agent|Task → warn-subagent-report-zcode` entry
adjacent to `validate-prompt`, colliding with this PR's `validate-prompt` matcher widening.
Resolved by keeping staging's new entry AND the widened `Edit|Write|MultiEdit` (narrow=0, twins
intact, valid JSON). Baselines auto-merged (staging's inject-* re-capture and F2's produced
identical hashes — same source). Post-rebase: full `vitest principles/ hooks/` = **1147/1147
green**, byte-identical green, `render --check` green (F1 now moot — staging fixed it). This PR
adds zero red.

---

## D4 — Layer 1 extended with a @matcher-parity rule for case-TOOL hooks [technical, resolved]

**Gap found (cold-review MAJOR).** Layer 1 as first committed only marked the 3 path-only
content-gates (`validate-prompt`, `check-doc-authority`, `check-doc-authority-header`). The 3
case-TOOL content-gates (`check-kickoff-traps`, `check-worker-dispatch-channel`, and
`check-hook-marker` itself) carry an internal `case "$TOOL" in Edit | Write | MultiEdit)` filter
and NO `@file-content-gate` marker, so they had NO edit-time protection against matcher
narrowing. Their internal `case` does NOT protect them: a narrowed matcher stops the hook being
invoked at all, so the `case` never runs. The kickoff (§autonomy) deferred them to "Layer 2
population sweep", but the design's Layer 2 (sweep `@file-content-gate` markers) would ALSO miss
them — they are unmarked.

**Resolution.** Added a second Layer-1 invariant, `@matcher-parity`: any hook with a
`case "$TOOL" in <tools>)` line must have its registered matcher ⊇ that case-arm set. This uses
each hook's EXISTING author-declaration (the `case` line) — no new marker, no allowlist (round-4
rejected allowlists). It is **self-calibrating**: `inject-memory-codification` (A5, Write-only)
has `case "$TOOL" in Write)` + matcher `Write` → parity `{Write} ⊆ {Write}` GREEN, with no
hardcoded MultiEdit demand. This restores the original `design.md:65` two-rule intent. Verified:
all 5 real case-arm hooks GREEN (incl. `inject-matching-rule` EWM/EWM — the open item from the
review is resolved, no pre-existing inconsistency).

## D3 — Layer 2 lives in the CC-config bucket, NOT the agnosticism probe [technical, resolved — operator-flagged]

**Concern (operator).** The kickoff/`design.md:67` put Layer 2 in
`tests/agnosticism/probes/channel-coverage.sh`. But that probe is **harness-agnostic by design**
(runs with CC absent; its `PORTABLE` verdict, per principle 21, means "works across harnesses").
The matcher requirement involves `MultiEdit`, which is **CC-only** (inert on ZCode —
`render-harness-config.mjs` says so). Adding it there would (a) overload the `PORTABLE` verdict
with a CC-config-consistency meaning (a hook with a valid `@cc-only-rationale` — portable by the
probe's definition — could report non-PORTABLE for a matcher bug, which principle 21 misreads as
"doesn't work across harnesses"), and (b) make a deliberately harness-independent probe assert a
CC-only fact. The whole matcher-widening is a CC-config concern with zero agnosticism dimension.

**Resolution.** Layer 2 is a vitest describe block in `packages/core/hooks/check-hook-marker.test.ts`
(the hooks / CC-config bucket), NOT `tests/agnosticism/`. It runs the REAL `check-hook-marker.sh`
edit-time gate against EVERY tracked `.claude/hooks/*.sh` at once, against the live
`.claude/settings.json` — catching a matcher narrowed directly in the SSOT/settings.json even
when no hook `.sh` is edited (the vector Layer 1 cannot see). Reuses the edit-time gate verbatim
(no parallel population reader → no `#parallel-evolution-creep`), and keeps `MultiEdit` out of
the agnosticism probe. Two RED fixtures (narrow `@file-content-gate`; narrow case-TOOL parity)
prove the backstop is non-vacuous; a population sentinel (≥5 hooks) guards a broken glob. This
supersedes the kickoff Task-C plan (channel-coverage.sh extension + `tests/fixtures/matcher-drift/`
+ a `*.paired-negative.test.ts`) — none of those are created.

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

## F2 — staging's byte-identical baselines were STALE for zcode-parity inject-* hooks [finding + forced correction]

Re-capturing the install-sh byte-identical baselines (needed because my `check-doc-authority-header.sh`
marker edit shifts its shipped fingerprint) surfaced that **origin/staging's baselines were already
stale** for three consumer-shipped hooks it changed via zcode-parity but never re-captured:
`inject-matching-rule.sh`, `inject-output-language.sh`, `inject-project-digest.sh`. Proof: my
source for these is byte-identical to staging's (`git diff origin/staging` empty), yet
staging's baseline records an OLD hash (e.g. inject-matching-rule ts-server/greenfield:
staging baseline `e1f96e6…` vs actual source `8edd7ff…`). So staging's own byte-identical
(a bash install-sh test, NOT run by the vitest suite where the other 8 failures live) is
red/stale too — another facet of the pre-existing staging breakage.

**Forced correction (not scope creep).** `snapshot.sh` captures ALL stacks/hooks in one pass;
there is no way to re-capture only `check-doc-authority-header` (mine) without also refreshing
the stale inject-* entries. byte-identical is a gate → it must be green → a full re-capture is
mandatory. My captured baselines record the CORRECT current source hashes (verified: capture ==
`shasum` of the source). When the separate staging fix re-captures, it will produce identical
hashes (same source) → clean converge, no conflict. Baseline delta vs staging = exactly
{check-doc-authority-header (mine, marker), inject-matching-rule, inject-output-language,
inject-project-digest (staging-stale, corrected)}. Framework-internal hooks (check-hook-marker,
check-doc-authority, validate-prompt) are shipped to 0 consumers → my edits to them do not touch
any baseline.

## F1 — staging SSOT/render drift is pre-existing and UNGATED [finding, OUT OF SCOPE — surfaced, not fixed]

While resolving D2 I confirmed that on **pristine staging** (all three rendered files at their
committed state) `node scripts/render-harness-config.mjs --check` reports:

```text
✗ harness-config drift:
    - plugin/hooks/hooks.json: drift vs SSOT
```

i.e. staging's committed `plugin/hooks/hooks.json` is NOT reproducible from its own SSOT
(`harness-model.json`).

**Precise mechanism (corrected after finding the second generator).** There are TWO plugin
generators, and the drift is only in the seam between them:

- `scripts/generate-plugin-twins.sh` generates the plugin **sidecar SCRIPTS**
  (`plugin/hooks/<name>`) from `.claude/hooks/<name>.sh` (identity / sed / manual modes). It
  IS gated — `.husky/pre-commit` (lines 158-166) regenerates + `git add`s them whenever a
  `.claude/hooks/*.sh` source is staged. (Side effect observed this session: committing an
  edited hook also re-synced a pre-existing stale twin, `plugin/hooks/end-of-turn-reminder`,
  because the hook `git add`s the whole `plugin/hooks/` dir — deterministic, benign.)
- `scripts/render-harness-config.mjs` (`emitPlugin`) generates the `hooks.json`
  **REGISTRATION** (matchers + which hooks are wired), but only from harness-model model-hooks
  + a `session-start` internal. The three ZCode-parity twin **entries** in `hooks.json`
  (`inject-project-digest`, `inject-output-language`, `warn-subagent-report-zcode`) are NOT in
  the model and NOT produced by `emitPlugin` → they are hand-maintained in `hooks.json`.

So the drift is specifically: the `hooks.json` twin-entry **registration** is not
render-reproducible. It is **not CI-gated**: `.github/workflows/audit-self.yml` runs
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
