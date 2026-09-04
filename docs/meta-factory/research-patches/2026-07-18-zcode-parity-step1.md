<!-- scope:zcode-parity-step1-emit-wrapper -->
# ZCode parity step 1 — emit-wrapper infra + end-of-turn-reminder B2-C + B1 latent fix

**Date:** 2026-07-18
**Umbrella:** `feat/zcode-parity-step1-emit-wrapper` (base `staging`)
**Authoritative plan:** `/tmp/zcode-parity-orch/plan-v3.md` (Phase -1 round 3, dual Opus reviewers GO with advisory fixes integrated)
**Process anchor:** `superpowers:subagent-driven-development` (Coordinator → implementer → spec-reviewer → code-quality-reviewer); no paid LLM in CI

## Goal (one paragraph)

Ship three concrete deliverables from plan-v3: (1) `_zcode-emit` additive helper + unit tests (zero adopters — infrastructure-first, declared follow-up umbrella for migration); (2) Bespoke #1 end-of-turn-reminder B2-C fix (grep `(type|role)` alternation + thin-recap branch using `reason` field); (3) B1 source-level fix for `inject-project-digest.sh:18` (latent bug, prepares for future plugin-channel shipping). 9 files total per plan-v3 scope table (10 shipped — the parallel `principles/24-plugin-manifest-integrity.test.ts` V8 skip-list extension is documented below as a plan-deviation).

## Deliverables shipped

### 1. Mechanism 1 — `_zcode-emit` universal emit-wrapper helper

- `plugin/hooks/_zcode-emit` (NEW, extensionless): two sourced functions per plan-v3 pinned signatures:
  - `_ze_classify` — reads stdin; classifies into {empty → silent, valid-JSON + allowed-key → byte-identical pass-through, anything-else → `{additionalContext:<text>}` wrap}.
  - `_ze_emit` — `_is_zcode` gate (ZCode → classify; non-ZCode → cat).
  - Allowed top-level keys (any one → pass-through): `additionalContext`, `additional_context`, `hookSpecificOutput`, `hookEventName`, `decision`, `reason`, `systemMessage`, `continue`, `stopReason`, `suppressOutput`. Matches every shape emitted across `plugin/hooks/` today (verified via grep at Stage 1).
- `packages/core/hooks/_zcode-emit.test.ts` (NEW, 17 tests): empty/whitespace silent, byte-identical pass-through (incl. full allowed-key sweep), plain-text wrap (with `jq -Rs` escaping), zero-allowed-keys wrap, multiline + trailing-newline strip-emit, double-wrap prevention, `decision:block` pass-through, non-zcode cat gate, sourcing-contract assertions.
- `tests/plugin/hook-paths.test.sh` (EDIT): L29 skip-list extended with `_zcode-*` glob + comment; new case (h) `repo_root_resolution_form` — T21 sibling-sweep over the 8 in-sweep plugin twins (Form A env-first OR Form B cd-guard).
- `packages/core/principles/24-plugin-manifest-integrity.test.ts` (EDIT, plan-deviation): V8 marker-check extended with the same `_zcode-*` skip. **Plan-deviation note:** plan-v3's 9-file scope named only `hook-paths.test.sh` as the gate-compat edit, but the repo runs a SECOND parallel marker gate in `principles/24` V8 with the same skip-set (`run-hook.cmd|*.json|*.md`). Without extending it, the principle-24 test fails `[V8] hook _zcode-emit: missing @dual-pair/@cc-only-rationale marker`. Same rationale as T-ZP-C: helpers are internal infrastructure, not delivery-channel artifacts. Stage 1 caught this via `make self-audit`.

**Adoption scope (honest):** ZERO existing twins migrated. Helper is new infrastructure; migration of 9 existing twins to source `_zcode-emit` is a declared follow-up umbrella (Q-tracked-1).

### 2. Bespoke #1 — end-of-turn-reminder B2-C

- `.claude/hooks/end-of-turn-reminder.sh` + `plugin/hooks/end-of-turn-reminder` twin (byte-identical mirror, T-ZP-A — diff = zero):
  - **Part A:** L52 + L176 `grep '"type":"assistant"'` → `grep -E '"(type|role)":"assistant"'`. Both arms load-bearing (T7): CC legacy transcripts carry an outer `"type":"assistant"` per entry (verified Mode A on `~/.claude/projects/-Users-art-code-BDDS/0b42f1ff-*.jsonl`); ZCode synthetic transcripts (`{message:{…,role:"assistant"}}` via `$_n` producer at `zcode.cjs:~1072550`) have NO outer type → only the `role` arm matches. Both arms tested in isolation.
  - **Part B:** introduces `_is_zcode()` (canonical form, verified across 7 plugin twins; end-of-turn-reminder previously had NO ZCode gate). Thin-recap branch fires when `_is_zcode AND text > 500 chars AND markdown-dense`. Emits `{decision:"block", reason:<Branch A nudge>, systemMessage:<glance>}` — the proven Stop-hook shape (T-ZP-B: `reason`, NOT `additionalContext`). Insertion point: after `last_line` extraction, before existing recap cascade.
  - **Part C (documented degradation):** L43 (ai-title grep) + L45 (user-message grep) assume CC's outer `type`. ZCode synthetic lacks `ai-title` AND likely lacks outer type on user turns → anchor falls through to `aif_msg_eot_anchor_fallback`. Part B does NOT depend on the anchor, so this is non-plan-breaking. L43/L45 fixes deferred (plan-v3 §"Non-goals").
- `packages/core/hooks/end-of-turn-reminder.test.ts` (EDIT, +7 tests, 37 total): `zcode_synthetic_transcript_last_line_extracted_via_role`, `cc_transcript_last_line_extracted_via_type`, `Part A both arms proven asymmetric via direct grep on fixtures` (T7 anti-pattern guard), `zcode_long_markdown_emits_block_decision_with_reason_field`, `thin_recap_emits_reason_not_additional_context` (T-ZP-B backward), `non_zcode_skips_thin_recap` (gate backward), `non_zcode_long_markdown_still_uses_existing_cascade` (additive, not replacement).
- `tests/fixtures/zcode-synthetic-transcript.jsonl` (NEW): single line, byte-pinned per `$_n` producer evidence — `{message:{content:[{text:<676 chars markdown>,type:"text"}],role:"assistant"}}`. Compact JSON (`separators ',',':'`) so the literal `"role":"assistant"` matches the production grep. NO outer type field — load-bearing for the role-arm test.
- `tests/fixtures/cc-transcript-legacy.jsonl` (NEW): 2-line sanitized snippet with outer `"type":"assistant"` + `message.{type:"message",role:"assistant",content:[…]}`. Outer type field is what the type-arm matches.

### 3. B1 — `inject-project-digest.sh:18` env-first REPO_ROOT (source-level)

- `.claude/hooks/inject-project-digest.sh` L18 (EDIT): `REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"` → `REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"`. Subshell-aware env-first (T16: NOT the deps-hash-check cd-guard form). Source-level fix only — inject-project-digest is NOT shipped via the plugin channel today (declared follow-up umbrella).
- `packages/core/hooks/inject-project-digest.test.ts` (EDIT, +3 tests, 10 total): `env_var_first_resolution_reads_consumer_root` (plugin-twin scenario — hook + fixture in SEPARATE temp roots; with `CLAUDE_PROJECT_DIR=<consumer>`, fixture IS read), `dogfood_fallback_when_env_unset` (env unset → $0-relative fallback resolves correctly), `backward_plugin_twin_fixture_not_read_without_rewrite` (simulated pre-fix path → silent exit 0). **Mutation-gate proof:** reverting L18 to pre-fix causes ONLY `env_var_first_resolution_reads_consumer_root` to fail (9/10 stay green — original tests place hook + fixture under the same root).

## Bespoke #2 — REJECTED (corrected rationale)

`.claude/hooks/warn-subagent-report.sh` is CC-only by design. Reject with these reasons:

- **(a) Self-declared CC-only:** `.claude/hooks/warn-subagent-report.sh:7` — `@cc-only-rationale: internal orchestrator hook, maintainer-env only, no portable fire-point`.
- **(b) Event inexpressible on ZCode:** fires on `SubagentStop` (excluded from `ZCODE_EVENTS` at `scripts/render-harness-config.mjs:46-54`). **Stop ≠ SubagentStop** — this was the v2 factual error (reviewer-B MAJOR): v2 conflated Stop with SubagentStop and claimed CC had no subagent-summary nudge. CC DOES have one (warn-subagent-report on SubagentStop); it just doesn't fire on ZCode because the event itself is missing.
- **(c) Already-declared degradation:** `scripts/render-harness-config.mjs:256` documents `"NO backup: warn-subagent-report is post-dispatch (scans the finished report); no updatedInput analogue exists on zcode — CC-only"`.
- **(d) Existing CC hook + test sufficient:** `.claude/hooks/warn-subagent-report.sh` + `packages/core/hooks/warn-subagent-report.test.ts` already exist (both canonical, verified Mode A).

**Plan action:** no code change. This entry is the explicit reject rationale.

## Mechanism 2 — REJECTED (architectural respect for hand-maintained SSOT)

`scripts/render-harness-config.mjs:332-335` explicitly documents the SSOT design:

> *"COVERAGE: a hook works on ZCode ONLY if it has a plugin sibling (T-PLUG-A real copy under `plugin/hooks/<name>`). The sibling scripts are **hand-maintained** (precedent: session-start, inject-matching-rule); this emitter renders only the wiring JSON."*

Verified via direct diff of 5 twins vs sources (Mode A): every twin has a hand-crafted divergence that auto-derivation cannot reproduce without a per-hook transform DSL:

| Twin | Hand-crafted divergence from `.claude/hooks/<name>.sh` source |
|---|---|
| `inject-matching-rule` | Variable rename `REPO_ROOT`→`PROJECT_DIR`; 15-line T-PLUG-A relocation comment added; multi-line comment block reworded |
| `validate-prompt` | Extra line ADDED: `[[ ! -f "$VALIDATOR" ]] && exit 0` (consumer guard for plugins lacking `packages/core/`) |
| `inject-subagent-context` | `.sh` suffix REMOVED from sibling-call; 4-line TWIN DIVERGENCE comment added |
| `runtime-bridge-dispatch` | `SCRIPT_DIR` intermediate DROPPED entirely; collapsed into one env-first line |
| `check-doc-authority` | env-first rewrite only (the simplest case) |

**Implication:** Mechanism 2 ("auto-derive twin scripts from a sidecar") would either regress 4 of these twins (lose consumer guards, renames, comment provenance) or require a per-hook transform DSL that doesn't exist and is out of scope. **Twin generation stays hand-maintained per existing SSOT.** The atomic-write concern (M1) is preserved by applying to the existing `settings.json.tmp` write path in `register_cc_hook` (`setup.d/lib.sh:902` — verified same-filesystem invariant at Stage 1: tmp is `dirname(settings)/settings.json.tmp`, `mv` is rename-within-same-FS, atomic).

## SubagentStart degradation (documented)

`.claude/hooks/inject-project-digest.sh` is registered on BOTH `UserPromptSubmit` AND `SubagentStart` (`install.sh:507-508`). On ZCode:

- **UserPromptSubmit:** plain stdout is auto-injected — works on ZCode.
- **SubagentStart:** requires JSON `hookSpecificOutput.additionalContext` (jq required). SubagentStart IS in `ZCODE_EVENTS`, so the hook DOES fire — BUT the plugin-twin payload path would hit the B1 latent bug (now fixed at source level; twin not shipped). The current backup mechanism on ZCode is `inject-subagent-context` on `PreToolUse:Agent` (`scripts/render-harness-config.mjs:253-254`), which is the CAT-B sibling-source path that does not read repo files via `REPO_ROOT`.

**Documented gap:** inject-project-digest's SubagentStart loud-declaration (renderer-side) was removed with Mechanism 2. Restoring it requires (a) shipping the plugin twin, (b) B1 guard at twin level (now source-ready), (c) a renderer-side loud-declaration. All three are deferred to the follow-up umbrella.

## Anchor degradation (Part C — documented)

`.claude/hooks/end-of-turn-reminder.sh`:

- **L43** `grep '"type":"ai-title"'`: on ZCode, returns nothing (anchor falls through). ZCode synthetic transcripts have no `ai-title` field.
- **L45** `grep -m1 '"type":"user"'`: on ZCode, likely fails on the user-message shape if it uses `"role":"user"` instead of outer `"type":"user"`.

**Result:** anchor degrades to `aif_msg_eot_anchor_fallback` under ZCode. Part B (thin-recap) does NOT depend on the anchor quality — it only uses `${anchor}` for the `systemMessage` glance line, which degrades gracefully to the fallback string. Non-plan-breaking. Restoration deferred (plan-v3 §"Non-goals").

## Q-tracked follow-ups

1. **9-twin migration to source `_zcode-emit` + integration tests** (promoted from deferral to declared follow-up). Helper ships with zero adopters; migration is incremental per-twin with one integration test per adoption. Maintenance-cost rationale: the inline `_is_zcode` / `_emit_ctx` / `_adv_violation` trio is currently copy-pasted across ~7 plugin twins — expensive to maintain, error-prone on update; the helper consolidates it.
2. **inject-project-digest plugin twin shipping + B1 guard at twin level + SubagentStart loud-declaration.** Source-level B1 fix (this umbrella) prepares for shipping; the twin itself + renderer-side SubagentStart declaration remain.

## Plan deviations (cold-review log)

| # | Deviation | Rationale |
|---|---|---|
| 1 | Added `packages/core/principles/24-plugin-manifest-integrity.test.ts` V8 skip-list extension (10th file vs plan-v3's 9). | Plan-v3 scope table named only `hook-paths.test.sh` as the gate-compat edit, but the repo runs a SECOND parallel marker gate in `principles/24` V8 with the same skip-set. Without extending it, `[V8] hook _zcode-emit: missing marker` fails. Same T-ZP-C rationale. Stage 1 caught via `make self-audit`. |
| 2 | `_ze_classify` uses `jq -r 'keys[0]'` + bash `case` for allowed-key check instead of a regex on the serialized form. | Plan-v3 §"Mechanism 1" did not pin the implementation. A regex anchored on `^"` would miss `{"key":…}` (leading `{`); the `keys[0]` extraction is robust to pretty-printing and key order. Same external behaviour, cleaner implementation. |
| 3 | Restored §7 active-AI-traps enumeration in `.claude/orchestrator-prompts/zcode-parity-step1-emit-wrapper/kickoff.md` (was stashed pre-branch). | Required by `principles/12-ai-laziness-traps.test.ts` gate (every kickoff must cite T-numbers). The stash was an artifact of branch creation; restoring is bookkeeping, not a semantic change. |

## §1.7 Self-review — Forward-check + Backward-check (T15 recursive self-application)

Per `.claude/rules/phase-research-coverage.md §1.7` + principle-13 substance requirement. Each shipped fix has a firing test that proves the fix works (forward-check), and removing the fix makes the test fail (backward-check / mutation-gate). The §1.7 tables copied into the PR body (plan-v3 §1.7 lines 211-250) are the canonical statement; this section records the in-repo evidence.

### Forward-check (each fix has a firing test)

| Fix | Test (file:name) | Evidence (file:line or test result) |
|-----|------------------|-------------------------------------|
| Mechanism 1 wrapper pass-through | `_zcode-emit.test.ts :: passthrough_valid_json_allowed_key` + `passthrough_preserves_all_allowed_keys` | `packages/core/hooks/_zcode-emit.test.ts:74,85` — sweeps the full allowed-key set; 17/17 tests pass |
| Mechanism 1 wrapper plain-text wrap | `_zcode-emit.test.ts :: wrap_plain_text` + `wrap_plain_text_escapes_special_chars` | `packages/core/hooks/_zcode-emit.test.ts:111,123` — jq -Rs escaping verified |
| Mechanism 1 wrapper empty silent | `_zcode-emit.test.ts :: empty_silent_exit0` + `whitespace_only_silent_exit0` | `packages/core/hooks/_zcode-emit.test.ts:55,65` |
| Mechanism 1 wrapper edge cases | `_zcode-emit.test.ts :: multiline_trailing_newline / wrap_zero_allowed_keys / double_wrap_prevention` | `packages/core/hooks/_zcode-emit.test.ts:151,135,163` |
| Mechanism 1 non-ZCode gate | `_zcode-emit.test.ts :: non_zcode_passthrough_cat` | `packages/core/hooks/_zcode-emit.test.ts:191` — `ZCODE_PROJECT_DIR` unset → cats stdin byte-for-byte |
| Mechanism 1 gate-compat | `tests/plugin/hook-paths.test.sh` + `principles/24-plugin-manifest-integrity.test.ts` | `_zcode-emit` in skip-lists (this Stage 2 commit); hook-paths green (68 checks); principle-24 V8 green |
| Bespoke #1 Part A ZCode arm | `end-of-turn-reminder.test :: zcode_synthetic_transcript_last_line_extracted_via_role` | `packages/core/hooks/end-of-turn-reminder.test.ts:705` — synthetic `{role:assistant,type:text,…}` → `last_line` non-empty via role arm |
| Bespoke #1 Part A CC arm | `end-of-turn-reminder.test :: cc_transcript_last_line_extracted_via_type` | `packages/core/hooks/end-of-turn-reminder.test.ts:722` — CC outer `"type":"assistant"` matched via type arm |
| Bespoke #1 Part A asymmetry guard | `end-of-turn-reminder.test :: Part A both arms proven asymmetric via direct grep on fixtures` | `packages/core/hooks/end-of-turn-reminder.test.ts:749` — T7 anti-pattern guard |
| Bespoke #1 Part B thin-recap | `end-of-turn-reminder.test :: zcode_long_markdown_emits_block_decision_with_reason_field` | `packages/core/hooks/end-of-turn-reminder.test.ts:779` — >500 chars markdown under `_is_zcode` → `{decision:block, reason}` (NOT additionalContext) |
| Bespoke #1 Part B gate | `end-of-turn-reminder.test :: non_zcode_skips_thin_recap` | `packages/core/hooks/end-of-turn-reminder.test.ts:810` — non-ZCode env, Part B does not fire |
| B1 source-level rewrite | `inject-project-digest.test :: env_var_first_resolution_reads_consumer_root` | `packages/core/hooks/inject-project-digest.test.ts` (Stage 4) — plugin-twin scenario, fixture IS read with rewrite |
| B1 source-level fallback | `inject-project-digest.test :: dogfood_fallback_when_env_unset` | `packages/core/hooks/inject-project-digest.test.ts` — fallback resolves correctly when env unset |

### Backward-check (mutation-gate — each test fails without the fix)

| Fix removed → | Test that catches the regression | Proof |
|---------------|----------------------------------|-------|
| Mechanism 1 wrapper absent (helper deleted) | `_zcode-emit.test.ts :: passthrough_valid_json_allowed_key` etc. | all 17 unit tests fail (function undefined) |
| Mechanism 1 helper not sourced by adopter | n/a (no adopter in this umbrella — integration test deferred to follow-up umbrella) | honest scope: helper has zero adopters; Q-tracked-1 |
| Gate skip-list not extended | `tests/plugin/hook-paths.test.sh` + `principles/24-plugin-manifest-integrity.test.ts` | gate fails: `_zcode-emit` swept, no marker → check (b) / V8 fails |
| Bespoke #1 Part A `role` arm dropped (keep `type` only) | `zcode_synthetic_transcript_last_line_extracted_via_role` fails | synthetic line has no outer type → `last_line` empty (current runtime-DEAD state). Direct grep: `grep -cE '"type":"assistant"' zcode-synthetic-transcript.jsonl` = 0 |
| Bespoke #1 Part A `type` arm dropped (keep `role` only) | `cc_transcript_last_line_extracted_via_type` fails | CC line's outer type is the matchable field for any future CC variant where message lacks role. role-only misses it on CC |
| Bespoke #1 Part A both arms dropped | either Part A test fails (current runtime-DEAD state) | direct grep asymmetry pinned by `Part A both arms proven asymmetric` test |
| Bespoke #1 Part B branch absent | `zcode_long_markdown_emits_block_decision_with_reason_field` fails: no `{decision:"block"}` emitted | verified by smoke test pre-edit (silent exit 0 on ZCode fixture) |
| Bespoke #1 Part B uses `additionalContext` instead of `reason` | `thin_recap_emits_reason_not_additional_context` fails | `packages/core/hooks/end-of-turn-reminder.test.ts:796` asserts `reason` present AND `additionalContext` absent |
| Bespoke #1 Part B `_is_zcode` gate absent | `non_zcode_skips_thin_recap` fails: branch fires on CC dogfood → regression | verified: smoke test with `ZCODE_PROJECT_DIR` unset, short markdown → silent (Part B skipped, cascade also silent on short text) |
| B1 rewrite absent (env-first arm removed) | `env_var_first_resolution_reads_consumer_root` fails | mutation-gate proof: reverting L18 to `REPO_ROOT="$(cd …)"` causes ONLY this test to fail (9/10 stay green — original tests place hook + fixture under same root) |

### T21 sibling-sweep (counter-pattern done right)

- **B1 sweep — env-first form invariant:** `tests/plugin/hook-paths.test.sh` case (h) `repo_root_resolution_form` iterates the 8 in-sweep plugin twins (Form A env-first OR Form B cd-guard) — `check-doc-authority`, `check-hook-marker`, `check-kickoff-traps`, `check-worker-dispatch-channel`, `inject-matching-rule`, `runtime-bridge-dispatch`, `validate-prompt`, `deps-hash-check`. Non-sweep twins skipped by name. Catches future regressions when new twins are hand-added without the guard.
- **B2 sweep — warn-subagent-report CC-only containment:** no test added — the existing `scripts/render-harness-config.mjs:256` declaration is the SSOT; a gate-test asserting the renderer's own declaration would be tautological. Honest scope decision (plan-v3 §1.7 sibling-sweep notes).

### T15 recursive self-application

Every hook edit in this umbrella passes the project's own `make self-audit` (311 tests, 34 files). The Stage 2/3/4 commits each ran self-audit before commit; the final pre-PR run is green. This IS the T15 discipline applied to itself: the parity infra we ship is itself gated by the parity-enforcement framework that runs on every push.

## Self-audit evidence

- `make self-audit` final run: GREEN, 311 tests across 34 files (pre-push-check + pre-commit-check + principles-meta-tests).
- `_zcode-emit.test.ts`: 17 tests, all pass.
- `end-of-turn-reminder.test.ts`: 37 tests, all pass; Part A both arms confirmed asymmetric via direct grep; Part B `reason` field asserted (not `additionalContext`).
- `inject-project-digest.test.ts`: 10 tests, all pass; mutation-gate proof documented above.
- `tests/plugin/hook-paths.test.sh`: 68 checks (was 53), all pass; case (h) asserts 8 in-sweep twins.
- Twin byte-identity (T-ZP-A): `diff .claude/hooks/end-of-turn-reminder.sh plugin/hooks/end-of-turn-reminder` = zero.
