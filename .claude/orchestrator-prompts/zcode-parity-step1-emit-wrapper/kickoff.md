# KICKOFF — zcode-parity-step1-emit-wrapper (EXECUTION-BUILD umbrella)

> **Type:** execution-build umbrella — plan is reviewer-GO (Phase -1 round 3, dual Opus reviewers, both GO with advisory fixes integrated). This kickoff executes plan-v3 verbatim; it does NOT re-plan.
> **Origin:** orchestrator session `/tmp/zcode-parity-orch/orchestrator-prompt.md` (ZCode parity iteration loop). Plan evolved v1 → v2 → v3; v3 reached GO.
> **Base branch:** `staging` (NOT `main`).
> **Plan file (authoritative for this umbrella):** `/tmp/zcode-parity-orch/plan-v3.md`. **Read it first, in full.**
> **Reviewer GO evidence:** Phase -1 round 3 dual-reviewer verdicts (both GO) — preserved in orchestrator session transcript; advisory fixes integrated into plan-v3 §"Advisory fixes integrated" + §"Sibling-sweep T21 (final, corrected)".
> **Process anchor:** `superpowers:subagent-driven-development` (Coordinator→implementer→spec-reviewer→code-quality-reviewer). No paid LLM in CI (all work session-bound).

---

## §0 Cold-start context — what is already settled (DO NOT re-litigate)

- **Architectural scope-narrowing is settled.** Mechanism 2 (twin auto-derivation) was DROPPED in v3 because `scripts/render-harness-config.mjs:333` documents the SSOT: "sibling scripts are hand-maintained; this emitter renders only the wiring JSON". Verified via direct diff: 5 plugin twins have hand-crafted divergences (rename, added guard, suffix drop, intermediate-var drop) that auto-derivation cannot reproduce without a per-hook transform DSL. **Do not reintroduce auto-derivation in implementation.**
- **Bespoke #2 (warn-subagent-report ZCode variant) is REJECTED.** CC-only by design: `@cc-only-rationale` at `.claude/hooks/warn-subagent-report.sh:7`; fires on SubagentStop (not in `ZCODE_EVENTS`); already declared CC-only at `render-harness-config.mjs:256`. Do NOT build a ZCode variant. Document the reject rationale only.
- **B2-C is chosen.** Rejected: B2-A (cost, anchor absent), B2-B (loses only Stop recap). Do not re-debate.
- **B1 fix is subshell-aware source-level rewrite** (NOT the cwd-guard form). Use `REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"` matching the 7-env-first-twins precedent + deps-hash-check cd-guard form. v1's "byte-identical cd-guard" claim was wrong (T16 trap).
- **Stop-hook emit field is `reason`, NOT `additionalContext`.** Verified `.claude/hooks/end-of-turn-reminder.sh:227` comment + L234-235 emit code.

---

## §1 Goal (one paragraph)

Ship three concrete deliverables from plan-v3: (1) `_zcode-emit` additive helper + unit tests (zero adopters — infrastructure-first, declared follow-up umbrella for migration); (2) Bespoke #1 end-of-turn-reminder B2-C fix (grep `(type|role)` alternation + thin-recap branch using `reason` field); (3) B1 source-level fix for `inject-project-digest.sh:18` (latent bug, prepares for future plugin-channel shipping). Plus doc + gate-compat + tests. **9 files total** (see plan-v3 scope table).

## §2 Stages (sequential; execution-build, not brainstorm)

### Stage 1 — Pre-flight + plan re-read
1. `git status --short` — stash any WIP not belonging to this umbrella.
2. `git fetch origin && git checkout -b feat/zcode-parity-step1-emit-wrapper staging`.
3. **Read `/tmp/zcode-parity-orch/plan-v3.md` in full.** It is the authoritative spec.
4. Verify the 4 in-plan assumptions that were "verify at implementation time":
   - `settings.json.tmp` same-filesystem invariant (for M1 fold) — confirm `register_cc_hook` writes tmp in same dir as final.
   - CC transcript legacy shape (for fixture) — read 1-2 lines from any CC session transcript under `~/.claude/projects/` to confirm `{…, "type":"assistant", "message":{…, "role":"assistant", "content":[…]}}`.
   - `tests/plugin/hook-paths.test.sh` gate (b) marker check at L52 (for gate skip-list extension decision).
   - `end-of-turn-reminder.sh` L52 + L176 grep lines exact form (for Part A syntactic correctness).
   If any assumption fails, STOP and surface to operator (do NOT proceed with a wrong assumption).

### Stage 2 — Mechanism 1 (helper + tests + gate-compat) — files #1, #2, #3
1. Write `plugin/hooks/_zcode-emit` (extensionless, ~25-30 lines). Functions `_ze_classify` + `_ze_emit` per plan-v3 §"Mechanism 1" (signatures pinned there).
2. Write `packages/core/hooks/_zcode-emit.test.ts` — unit tests: empty / pass-through / wrap / edge cases (multiline trailing newline, zero allowed keys, double-wrap prevention) / non-ZCode gate (passthrough cat).
3. Extend `tests/plugin/hook-paths.test.sh` — add `_zcode-emit` to L29 skip-list + comment justifying helpers-as-internal-infra. Also add new case (h) `repo_root_resolution_form` per plan-v3 §"Sibling-sweep T21 (final, corrected)" — iterates the 8 in-sweep twins, asserts Form A OR Form B resolution, skips non-sweep twins by name.
4. Run `<CHECK_ALL>` (typically `make self-audit` + relevant test subset). Gate green.

### Stage 3 — Bespoke #1 (end-of-turn-reminder B2-C) — files #4, #5, #6
1. Create test fixtures first (TDD):
   - `tests/fixtures/zcode-synthetic-transcript.jsonl` — single line, byte-pinned per `$_n` producer evidence: `{message:{content:[{text:"<500+ chars markdown with ## or ** or \n\n>",type:"text"}],role:"assistant"}}`.
   - `tests/fixtures/cc-transcript-legacy.jsonl` — sanitized 2-line snippet, shape `{…, "type":"assistant", "message":{…, "type":"message", "role":"assistant", "content":[…]}}`. Do NOT read live `/Users/art/.claude/projects/…` path.
2. Edit `.claude/hooks/end-of-turn-reminder.sh`:
   - **Part A**: L52 + L176 grep → `grep -E '"(type|role)":"assistant"'` (both arms load-bearing).
   - **Part B**: introduce `_is_zcode` (canonical form `_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }`); insert thin-recap branch **immediately after the `last_line` extraction block (post-L176 grep), before existing recap logic**; emit `{decision:"block", reason:"<nudge>", systemMessage:"<optional>"}` (NOT additionalContext). Branch fires when `_is_zcode` AND last assistant text > 500 chars AND markdown-dense.
3. Edit `plugin/hooks/end-of-turn-reminder` (twin) — byte-identical mirror of source changes.
4. Edit/extend `packages/core/hooks/end-of-turn-reminder.test.ts` — forward-checks: `zcode_synthetic_transcript_last_line_extracted_via_role`, `cc_transcript_last_line_extracted_via_type`, `zcode_long_markdown_emits_block_decision_with_reason_field`, `non_zcode_skips_thin_recap`. Backward-checks: each fix-removed variant must fail. **Field-shape backward-check:** `thin_recap_emits_reason_not_additional_context` asserts `reason:` key present AND `additionalContext:` key absent.
5. Run `<CHECK_ALL>`. Green.

### Stage 4 — B1 source-level (inject-project-digest) — files #7, #8
1. Edit `.claude/hooks/inject-project-digest.sh:18` — change `REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"` to `REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"`.
2. Edit/extend `packages/core/hooks/inject-project-digest.test.ts` — forward-checks: `env_var_first_resolution_reads_consumer_root` (fixture at `$CLAUDE_PROJECT_DIR/.claude/session-bootstrap.md` IS read with rewrite), `dogfood_fallback_when_env_unset` (fallback resolves correctly when env unset). Backward-check: rewrite absent → fixture NOT read.
3. Run `<CHECK_ALL>`. Green.

### Stage 5 — Doc — file #9
1. Write `docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md`. Sections:
   - Deliverables shipped (3 concrete + gate-compat + tests).
   - Bespoke #2 reject rationale (corrected — Stop≠SubagentStop; CC has subagent-summary on SubagentStop; reject is event-inexpressibility + already-declared).
   - Mechanism 2 rejection rationale (hand-maintained-twin SSOT at render-harness-config.mjs:333; verified divergences).
   - SubagentStart degradation (inject-project-digest L267-268 CC registration on SubagentStart; silent-drop on plugin channel; backup = inject-subagent-context on PreToolUse:Agent).
   - Anchor degradation (Part C — L43 ai-title + L45 user-message greps on ZCode; anchor falls through to fallback; non-plan-breaking for B2-C).
   - Q-tracked follow-ups: (1) 9-twin migration to source `_zcode-emit` + integration tests; (2) inject-project-digest plugin twin shipping + B1 guard at twin level + SubagentStart loud-declaration.
2. Commit + push.

### Stage 6 — Pre-PR self-audit (Phase 4.5)
1. Cross-reference every `[x]` checkbox in PR body against a specific tool-call output (file:line, test result, grep output). Unverified → `[ ]` + ATTN.
2. Run final `<CHECK_ALL>` once.
3. Push + open PR. Base: `staging`. Title: `feat(zcode-parity): step 1 — emit-wrapper infra + end-of-turn-reminder B2-C + B1 latent fix`.

---

## §3 Acceptance criteria (from kickoff + plan-v3)

- [ ] All 9 files in plan-v3 scope table created/edited as specified.
- [ ] `<CHECK_ALL>` green at end of each stage AND finally.
- [ ] `_zcode-emit.test.ts` unit tests pass (Mechanism 1 forward+backward).
- [ ] `end-of-turn-reminder.test.ts` Part A both arms tested in isolation + Part B `reason` field asserted.
- [ ] `inject-project-digest.test.ts` B1 env-first resolution + fallback.
- [ ] `tests/plugin/hook-paths.test.sh` extended with `_zcode-emit` skip-list + case (h) repo_root_resolution_form sweep over 8 twins.
- [ ] `docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md` written with all required sections.
- [ ] §1.7 forward + backward checks in PR body (copy from plan-v3 §1.7 tables).
- [ ] PR base = `staging`.

## §4 §1.7 PR-body draft (copy from plan-v3 §1.7)

> The PR body MUST contain §1.7 Forward-check + Backward-check tables verbatim from plan-v3 (`/tmp/zcode-parity-orch/plan-v3.md` §1.7). The local git-safety hook validates §1.7 sections on `gh pr create/edit`. Use `--body-file` for reliable body extraction.

## §5 Non-goals (DO NOT do in this umbrella)

- Mechanism 2 (twin auto-derivation) — DROPPED, see §0.
- Bespoke #2 (warn-subagent-report ZCode variant) — REJECTED, see §0.
- Migration of 9 existing plugin twins to source `_zcode-emit` — declared follow-up umbrella.
- inject-project-digest plugin twin shipping — declared follow-up umbrella.
- L43/L45 anchor-extraction grep fixes — documented as honest degradation only.
- SubagentStart loud-declaration renderer-side — documented in doc only (renderer-side infra removed with Mechanism 2).

## §6 ATTN escalation triggers

- **STOP + surface to operator** if any §2 Stage 1 verification assumption fails.
- **STOP + surface** if a test stubbornly refuses to pass after 2 reasonable fix attempts — likely a plan gap, not impl bug.
- **STOP + surface** if `<CHECK_ALL>` is red at end of Stage 6 with no clear path — do NOT ship red.

## §7 Active AI-traps (per `.claude/rules/ai-laziness-traps.md §2`)

Worker executing §2 must hold these T-numbers active throughout (T7 anti-pattern: blanket «see ai-laziness-traps.md» without enumeration is itself the violation):

- **T3** — re-verify every plan-v3 "verified Mode A" fact the Worker relies on for a test assertion (CC transcript shape, zcode.cjs offsets, twin byte-divergences). Stage 1 step 4 already does this for 4 assumptions.
- **T7** — the `grep -E '"(type|role)"'` alternation is load-bearing BOTH arms; a Worker reasoning loosely may collapse to `"type"` only because it looks more standard. The plan explicitly forbids this.
- **T15** — recursive self-application: every hook edit must pass the project's own `make self-audit`. Skipping on a «small hook fix» is the canonical T15.
- **T16** — B1 fix is subshell-aware env-first, NOT byte-identical cd-guard (the plan-v3 §0 already carries this as a settled correction; do not regress by pattern-matching on `deps-hash-check.sh:55`).
- **T19** — Stage 6 self-audit + sibling post-review kickoff together satisfy cold-QA; CI green alone ≠ design review.
- **T20** — every `[x]` checkbox in the PR body must cite a specific tool-call output (file:line, test result, grep output).
- **T21** — B1 sibling-sweep over 8 plugin twins (case (h) `repo_root_resolution_form`) is the T21 counter-pattern done right: assert invariant across siblings, not just the edited file.

**Domain-specific traps (NOT in canonical catalogue):**

- **T-ZP-A** — `plugin/hooks/end-of-turn-reminder` twin MUST be byte-identical to `.claude/hooks/end-of-turn-reminder.sh` source changes; twin drift = silent CC/ZCode parity regression.
- **T-ZP-B** — Stop-hook `decision:block` delivers the nudge via the `reason` field, NOT `additionalContext` (PostToolUse/PreToolUse field). Pattern-matching on other hooks' `additionalContext` emits regresses here.
- **T-ZP-C** — `_zcode-emit` is a *sourced helper*, not a hook — belongs in the `tests/plugin/hook-paths.test.sh` skip-list, NOT subject to the `@dual-pair`/`@cc-only-rationale` marker gate.

---

## §8 Post-implementation review task

A separate kickoff exists at `.claude/orchestrator-prompts/zcode-parity-step1-emit-wrapper/post-review-kickoff.md` — it runs AFTER this umbrella's PR is merged (or after Stage 6 push, at operator discretion). It verifies plan-adherence + test quality + gate effectiveness on the shipped code.
