# Advisor role reminder verification — 2026-10-06

> **Authoritative for:** evidence and remaining limits of this local implementation.
> **NOT authoritative for:** project goal, transport acceptance, native-harness support in general or pilot admission.

Implementation worktree: `/Users/art/.codex/worktrees/advisor-role-reminders/rules-as-tests-aif`.
Branch: `codex/advisor-role-reminders`. Base: `3a94e6b2139079250a31fcd1041fe7637a3c6cc0`.
`git ls-remote --symref origin HEAD` returned `refs/heads/staging` and that same SHA.
The worktree was created and attached through the app before any write.

## Deterministic evidence

Commands below ran in the implementation worktree unless a package cwd is stated.

| Command | Result |
|---|---|
| `python3 -B -m unittest discover -s tests/advisor-role-reminders -v` | Exit 0; 13 tests |
| `ruff check --no-cache scripts/advisor-role-reminders/reminders.py tests/advisor-role-reminders/test_reminders.py` | Exit 0 |
| `shellcheck -x scripts/advisor-role-reminders/hook.sh` | Exit 0 |
| `bash -n scripts/advisor-role-reminders/hook.sh` | Exit 0 |
| `npm --prefix packages/core test -- hooks/advisor-role-reminders.test.ts hooks/inject-matching-rule.test.ts hooks/hook-emit-prelude.test.ts hooks/harness-config-drift.test.ts` | Exit 0; 4 files, 98 tests |
| `npm --prefix packages/core run test:principles` | Exit 0; 57 files, 658 passed, 1 skipped |
| `make self-audit` | Exit 2 in the first session (cargo toolchain evidence mismatch). Revalidated: Exit 0 after `bash scripts/build-getff-dist.sh` added the one new shipped file to `packages/getff/MANIFEST.sha256`; no bypass |
| `npm run typecheck` | Exit 2 in the first session (missing `oxlint/plugins-dev`). Revalidated: Exit 0 after reinstalling dependencies from lockfiles |
| `npm test` (first-session full runs) | Exit 1 in the first session; failures retained below as historical record |
| `npm test` (revalidated, default parallelism) | Exit 1; core: the two load-sensitive files named in the Revalidation section; other workspaces: 43 and 504 passed, 1 skipped |
| `vitest run --root packages/core --no-file-parallelism` (revalidated) | Exit 0 — 329 files, 5194 passed, 9 skipped (pre-existing skips); no test newly skipped, no timeout widened |

The first nine tests failed before production files existed. Cold review then found
compaction while disarmed and unrelated-prompt activation defects. Regression tests
reproduced those failures before repair; all 13 now pass. A cold re-review ran the
suite on `/private/tmp` copies and independently confirmed compact/clear rehydration,
unrelated-prompt silence, bound-prompt delivery and duplicate suppression.

## Revalidation — 2026-10-06 (finish session, same worktree)

The first session's three validation blockers were environment-shaped and were repaired
without touching the reminder implementation:

- Dependencies were reinstalled from lockfiles in this worktree (`npm ci` at the root,
  then `npm ci --prefix packages/core`; both exit 0). `node_modules` on both levels are
  real directories, not symlinks into another checkout. The missing `oxlint/plugins-dev`
  resolved: installed `oxlint@1.86.0` ships `dist/plugins-dev.js`, and `npm run typecheck`
  is now Exit 0.
- Rust: `rustup toolchain list` shows `1.96.1-aarch64-apple-darwin (active)` and
  `rustc --version` resolves 1.96.1 with `RUSTUP_TOOLCHAIN=1.96.1` exported for all
  cargo/tsc-adjacent commands. The 1.98.1 mismatch was the first session's shell state.
- `make self-audit` failed once on a real gate of this change: the new
  `packages/core/hooks/advisor-role-reminders.test.ts` was shipped but absent from
  `packages/getff/MANIFEST.sha256`. Rebuilt per the gate's own recipe
  (`bash scripts/build-getff-dist.sh`); the manifest diff is exactly one added line.
  Self-audit is now Exit 0.
- Full-suite reruns after the repairs flake under default file parallelism in exactly one
  family, in files this diff does not touch: `hooks/husky-self-delegate.test.ts` (its 5 s
  default timeouts) and `skills/dispatcher/probe-inflight.test.ts` (f)/(g) (empty stub log
  when the probe process is killed under contention). The mechanism class is measured in
  the probe test's own header: the first exec of a freshly created executable costs
  ~0.65–1.6 s in the macOS kernel scan, per path, inflating under file parallelism.
  Classification evidence: every input those suites read (`.husky/*` hook files,
  `probe-inflight.sh`, `execution.md`) is md5-identical to the pristine staging checkout;
  the same two-file pair passes 95/95 there and `probe-inflight.test.ts` alone passes
  67/67 in this worktree; the pristine staging checkout under default parallelism is
  fully green (327 files, 5186 passed, 16 skipped); and a sequential rerun here
  (`vitest run --root packages/core --no-file-parallelism` — no test newly skipped, no
  timeout widened) is fully green: 329 files, 5194 passed, 9 skipped.
  `tests/hooks/prior-art-trailer-hook.test.sh` is Exit 0.

Exact final native argv/cwd are retained in `evidence/cc-native-commands.json`; the preparation call closed stdin. The initial capture appended probe-script stdin, not a canonical bridge payload; that failure and the bounded prompt-time retry remain disclosed.

Full logs remain at `/private/tmp/advisor-reminders-npm-test.log`,
`/private/tmp/advisor-reminders-npm-test-final.log`,
`/private/tmp/advisor-reminders-focused-final.log` and
`/private/tmp/advisor-reminders-typecheck.log` and
`/private/tmp/advisor-reminders-self-audit.log`; principle output is
`/private/tmp/advisor-reminders-principles.log`. Revalidation logs:
`/private/tmp/rr-npm-test.log` (full suite), `/private/tmp/rr-self-audit2.log`,
`/private/tmp/rr-husky.log`, `/private/tmp/rr-anchor.log`,
`/private/tmp/rr-priorart.log`, `/private/tmp/rr-core-test.log` (core-workspace rerun)
and the `/private/tmp/advisor-rr-npmci-*.log` install logs. No dependency install through
the primary checkout's node_modules symlinks was attempted. Unrelated modules were not
repaired.

## Live delivery cells

All probes were standalone mock enrollment; no bridge pilot or transport modules ran.
CC commands used ordinary `claude -p`, an explicit session ID, existing `--model glm-5.3`,
`--permission-prompts none`, `--output-format json` and invocation-scoped `--settings`.
Settings added only the reminder command with mock binding/state paths. Each call was
bounded to 45 or 50 seconds. Runtime `modelUsage` reported `glm-5.3`; no provider/profile,
global config, permissions or credentials changed. Reported cost basis is `unknown`;
these session probes do not infer subscription billing.

| Cell | Evidence / limit |
|---|---|
| CC executor preparation at bound launch | Initial and final SessionStart probes quoted the full exact text and explained REPORT preparation before authorship; `evidence/cc-native-final.json` |
| CC executor consumption at bound launch | Final SessionStart probe quoted the exact consumption text and described checking permissions/policy before action; `evidence/cc-native-final.json` |
| CC prompt-bound preparation | A first final probe returned `ABSENT`. A capture-only wrapper showed its parent Python script had been appended through inherited stdin, changing the submitted prompt hash. The selector correctly stayed silent; a clean-stdin recheck hit the 45-second bound (inconclusive). The final bound-launch preparation check is recorded with its receipt |
| Codex continuing desktop explicit consume + prepare fallback | This session received both senior reminders from `reminders.py` tool results before a mock evidence review/preparation rehearsal; model commentary retained failure/unknown, kept the hypothesis open and independently chose verification |
| Codex native sidecar / inline local hooks | Unresolved: CLI 0.160.0, hooks feature enabled. `config/read` showed active project layer with no disabledReason, but `hooks/list` returned zero reminder hooks, no warnings/errors, for both regular `.codex/hooks.json` and inline `.codex/config.toml` |
| Codex native trust-review / receipt | Unresolved: no reminder definition appeared in discovery, so no pending/trusted native reminder status or model receipt was established; no trust or bypass action taken |
| Arbitrary file/shell reads, advisor forks, full accepted bridge | Not verified or claimed; use explicit prepare/read and bind each actual recipient context after accepted transport integration |

Codex native CLI probes returned their requested sentinel response (exit 0); this does
not prove hook receipt. Read-only app-server probes used generated live protocol schemas
and `hooks/list` / filtered `config/read`. Retained evidence shows only layer metadata
and reminder-specific hook rows, not configuration contents or credentials.
The local ignored `.codex/config.toml` retains the prepared inline registration for
inspection. It grants no trust and has no active enrollment.

The desktop fallback mock REPORT preserved: `check failed`, destination receipt
`UNKNOWN`, the trust-block hypothesis, and the worker's attempted method/verdict
instruction. The model did not upgrade that instruction into authority. This proves
one receipt/rehearsal, not semantic compliance over future tasks or real transport.

## Integration and self-review

See [README](README.md) for exact flags and controller responsibilities. After transport
acceptance, its preparation/read path calls the selector before composition/action and
delivers trusted `additional_context` outside decoded canonical data. Native launch
uses the shared registration plus explicit enrollment/activation. The controller owns
source validation, activation cancellation, confirmed lifecycle epochs and failure
reporting. No existing reporting or decision rights changed.

Backward sweep read eight sibling delivery lanes without the originating diff. It
identified card summarization, digest newline handling, capped handoff restoration and
session-only memory caches as unsuitable for canonical payload transport. These are
reuse limits, not this task's expansion targets. The implementation leaves those
contracts intact and uses the shared emitter plus a narrow role/phase ledger.

Forward-check: one English text source, no semantic filtering, no paid LLM in CI;
all regression tests are deterministic. Backward-check: existing matching-rule callers,
renderer, transport owner, installers and parent files remain outside the diff.
The output-production ledger is not a receipt journal; timeout loss requires diagnosed
fresh-epoch retry. Native duplicate lifecycle callbacks lack event IDs and cannot be
made once-only from their currently consumed schema.

## Changed files

- `.gitignore`: excludes only runtime enrollment/state.
- `packages/core/hooks/advisor-role-reminders.test.ts`: normal-suite entry for boundary regressions.
- `scripts/advisor-role-reminders/reminders.json`: the four texts and version.
- `scripts/advisor-role-reminders/reminders.py`: bound selector, canonical-byte envelope and ledger.
- `scripts/advisor-role-reminders/hook.sh`, `hooks.json`: shared-emitter native adapter and scoped registration input.
- `scripts/advisor-role-reminders/README.md`, `VERIFICATION.md`: integration contract and this evidence.
- `scripts/advisor-role-reminders/evidence/*.json`: sanitized native receipts, argv and discovery metadata.
- `tests/advisor-role-reminders/test_reminders.py`: deterministic boundary tests.

Local cold-review annotation is `.claude/reviews/latest.md` — intentionally untracked
local-only scratch, preserved outside the commit per the acceptance packet; a fresh
review of the final SHA is recorded in the PR description instead. No push, PR, merge, publish,
global config/trust write or pilot activation occurred. Final commit identity is the
session's REPORT; this file stays independent of its own commit hash.
