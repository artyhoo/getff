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
| `make self-audit` | Exit 2; pre-push backend gate failed on cargo toolchain evidence mismatch; pre-commit completed; no bypass |
| `npm run typecheck` | Exit 2; missing `oxlint/plugins-dev` in existing `eslint-rules/plugin-dual-engine.test.ts:18` |
| `npm test` (first full run) | Exit 1; core: 7 failed files, 11 failed tests, 5108 passed, 56 skipped; other workspaces: 43 and 504 passed, 1 skipped |
| `npm test` (final full run) | Exit 1; core: 7 failed files, 21 failed tests, 5098 passed, 56 skipped; other workspaces: 43 and 504 passed, 1 skipped |

The first nine tests failed before production files existed. Cold review then found
compaction while disarmed and unrelated-prompt activation defects. Regression tests
reproduced those failures before repair; all 13 now pass. A cold re-review ran the
suite on `/private/tmp` copies and independently confirmed compact/clear rehydration,
unrelated-prompt silence, bound-prompt delivery and duplicate suppression.

The full suite failures were in unchanged files. This is an observed scope fact, not a
claim that every failure has been reproduced on a pristine baseline:

- `audit-self/prove-rules.test.ts`: missing oxlint executable (failed suite setup).
- `eslint-rules/plugin-dual-engine.test.ts`: missing `oxlint/plugins-dev` (failed suite import).
- `install/delivered-scripts-lint-ignored.test.ts`: two invalid-JSON errors from unavailable oxlint output.
- `hooks/getff-work.test.ts`: five afterEach hook timeouts; one case also failed the expected delivery-symlink diagnostic.
- `hooks/glossary-counters.test.ts`: first run sequential ten-prompt control timed out at 5 seconds; final run passed.
- `hooks/husky-self-delegate.test.ts`: final run had 11 hook/commit timeout failures at 5 seconds; first run passed.
- `backends/cargo/capability-matrix.test.ts`: evidence claims rustc 1.96.1; resolving toolchain is 1.98.1.
- `skills/dispatcher/probe-inflight.test.ts`: remote-context and hanging-context stub calls were absent.

Exact final native argv/cwd are retained in `evidence/cc-native-commands.json`; the preparation call closed stdin. The initial capture appended probe-script stdin, not a canonical bridge payload; that failure and the bounded prompt-time retry remain disclosed.

Full logs remain at `/private/tmp/advisor-reminders-npm-test.log`,
`/private/tmp/advisor-reminders-npm-test-final.log`,
`/private/tmp/advisor-reminders-focused-final.log` and
`/private/tmp/advisor-reminders-typecheck.log` and
`/private/tmp/advisor-reminders-self-audit.log`; principle output is
`/private/tmp/advisor-reminders-principles.log`. No dependency install through the primary
checkout's node_modules symlinks was attempted. Unrelated modules were not repaired.

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

Local cold-review annotation is `.claude/reviews/latest.md`. No push, PR, merge, publish,
global config/trust write or pilot activation occurred. Final commit identity is the
session's REPORT; this file stays independent of its own commit hash.
