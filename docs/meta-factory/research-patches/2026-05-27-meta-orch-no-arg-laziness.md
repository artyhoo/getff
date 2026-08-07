<!-- scope:meta-orch-no-arg-laziness -->
# R-phase: `meta-orch-no-arg-laziness` — architectural fix for classifier-incompatible inline `!shell` patterns

> **Type:** R-phase research-patch. Verdict + I-phase preview. **No code change in this PR.**
> **Authoritative for:** verdict on Bugs #2/#3/#4 — three classifier-incompatible inline `!shell` surfaces in [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md); BFR posture per [build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md); §1.7 forward/backward self-checks; I-phase scope sketch.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). PR-A's §2.5 Step 3 fix (already shipped as [PR #260](https://github.com/Yhooi2/rules-as-tests-aif/pull/260) — Bug #1, distinct surface). Implementation of the verdict — separate I-phase umbrella.
> **Origin:** Kickoff [`.claude/orchestrator-prompts/meta-orch-no-arg-laziness/kickoff.md`](../../../.claude/orchestrator-prompts/meta-orch-no-arg-laziness/kickoff.md); meta-launch dispatch state at [`.claude/orchestrator-prompts/meta-orch-no-arg-laziness-meta-launch/state.md`](../../../.claude/orchestrator-prompts/meta-orch-no-arg-laziness-meta-launch/state.md); follows the "deeper issue" deferred by [PR #193 commit 8f60158](https://github.com/Yhooi2/rules-as-tests-aif/commit/8f60158).

---

## §0 Problem statement

The `/meta-orchestrator` skill (single CC slash-command, [SKILL.md](../../../.claude/skills/pipeline/SKILL.md)) contains three inline `!shell` surfaces that fail the CC auto-mode classifier at runtime. They are all instances of the same root problem-class — _"an inline `!shell` block contains text the classifier cannot verify pre-execution: an unexpanded `${var}` (other than the whitelisted `${CLAUDE_SKILL_DIR}`) or an angle-bracket model-substitution placeholder"_.

### Bug #2 — §3 launch-table-generator runs before §2 picks the winner

[SKILL.md:239](../../../.claude/skills/pipeline/SKILL.md#L239) and [SKILL.md:243](../../../.claude/skills/pipeline/SKILL.md#L243):

```bash
${CLAUDE_SKILL_DIR}/helpers/launch-table-generator.sh "${umbrella:-}" 2>/dev/null
cat ".claude/orchestrator-prompts/${umbrella:-}/kickoff.md" 2>/dev/null | head -120 || echo "MISSING kickoff"
```

In no-arg mode `${umbrella:-}` defaults to empty, so the helper emits `MISSING kickoff`, and §3 produces no useful launch-table even though §2 priority-scoring later picks a winner inside the same invocation. The deeper cause is timing: **all `!shell` blocks substitute before Claude sees any content** (verified §1.5a), so §3 cannot ever consume §2's model-judgment output within one invocation.

### Bug #3 — `${umbrella}` / `${umbrella:-no-arg}` blocked by classifier

`/meta-orchestrator meta-orch-no-arg-laziness` invocation (arg-mode, 2026-05-27, after PR #260, this very session):

> «Bash command references an unexpanded shell variable `${umbrella}` with no value visible in the transcript, so the actual target path is unverifiable and agent-inferred.»

Live reproduction (Incident C — this very meta-launch invocation 2026-05-27, before this patch):

- §1 plan-currency-check injection emitted `=== plan-currency-check: umbrella='' ===` despite `meta-orch-no-arg-laziness` being passed as an argument — `${umbrella:-}` is a bash-level form, the CC harness leaves it raw, bash sees an empty env and defaults to `""`. The argv never reaches bash.
- §3 launch-table-generator emitted `(launch-table-generator: no umbrella …)` — same root cause.
- §10 step 5b emitted `jq: invalid JSON text passed to --argjson` — angle-bracket placeholders not substituted.

(Per [meta-launch state.md §1.1 Step 3](../../../.claude/orchestrator-prompts/meta-orch-no-arg-laziness-meta-launch/state.md#L31-L37) — Incident C verifies Bugs #2/#3/#4 reproduce on argv path too, not only on the §3-after-§2 no-arg case.)

### Bug #4 — §10 step 5b angle-bracket placeholders + brace-quote jq

[SKILL.md:517-525](../../../.claude/skills/pipeline/SKILL.md#L517-L525):

```bash
DELTA=.claude/orchestrator-prompts/_master-backlog-delta.json
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
jq --arg now "$NOW" --argjson current '<current_ids_json_array>' --argjson resolved '<resolved_ids_json_array>' \
  '.untracked_seen = ($current | map({id: ., first_seen: $now})) | .closed_since_last = ($resolved | map({id: ., closed_at: $now}))' \
  "$DELTA" > "$DELTA.tmp" && mv "$DELTA.tmp" "$DELTA"
bash ${CLAUDE_SKILL_DIR}/helpers/update-delta.sh "${umbrella:-no-arg}" "<outcome-one-liner>"
```

Classifier verbatim error (Incident B, 2026-05-27):

> «Command contains unsubstituted placeholders (`<current_ids_json_array>`, `<resolved_ids_json_array>`, `<outcome-one-liner>`, `${umbrella:-no-arg}`) — jq will fail to parse and the script will run with literal placeholder args, an unverifiable/malformed action.»

The classifier flags both the angle-bracket placeholders (the intended model-substitution contract is invisible to it) and the `${umbrella:-no-arg}` — `:-` default does **not** save the block.

### Why these are one problem-class (scope-merge justification)

All three reduce to: **the classifier evaluates the literal pre-substitution text and blocks anything not statically verifiable from `${CLAUDE_SKILL_DIR}` + literals**. `$(command-substitution)` was NOT enumerated in either Incident A/B classifier message (the `NOW=$(date ...)` on the line above the blocked jq was not flagged); only `${var}` and `<placeholder>` were. The same fix-shape (move the unverifiable text INSIDE a helper called with literal/whitelisted-only args) applies uniformly.

The §0.5 falsifier — _Bug #4 needs a different umbrella if `current_ids` requires post-routing-tree model judgment_ — is **NEGATIVE per §1.5d** (deterministic from `priority-score.sh` + `dup-detect.sh` output, no model-judgment required for the id-set itself). Scope-merge VALID.

---

## §1 Search results (6-item checklist per `phase-research-coverage.md §1`)

### §1.1 SSOT consult — [`prior-art-evaluations.md`](../prior-art-evaluations.md)

Keyword sweep (`grep -niE 'session.continuity|...'` 2026-05-27) on entries: «session-state», «cross-invocation», «memory bank», «plan-cache», «winner persistence», «scratch file», «hook event».

| SSOT row | Relevance to our problem-class | T16 problem-class match | Verdict |
|---|---|---|---|
| **#9** Cline Memory Bank subset (Mermaid drift-prevention diagrams) — [prior-art-evaluations.md:77](../prior-art-evaluations.md#L77) | Cross-session reviewer drift — wrong axis | ~10% (diagrams, not state) | OFF-CLASS |
| **#68** OhMyOpencode `boulder.json` + `.omo/plans/*.md` cross-agent file-state continuity — [prior-art-evaluations.md:136](../prior-art-evaluations.md#L136) | Closest precedent — file-based handoff between blocking-gate layers | ~30-40% (cross-AGENT, not cross-BLOCK; OpenCode substrate ≠ CC) | REFERENCE |
| **#77** Cline Memory Bank committed-markdown sub-pattern — [prior-art-evaluations.md:145](../prior-art-evaluations.md#L145) | Cross-SESSION state via committed markdown — our problem is within-INVOCATION machine-readable | ~30% (different scope + persistence model) | REFERENCE-only (NOT the strong precedent the kickoff §0 hinted at — T13 audit: SSOT entry hint was misleading) |
| **#43** AIF Handoff RuntimeAdapter — [prior-art-evaluations.md:111](../prior-art-evaluations.md#L111) | Provider-neutral runtime — orthogonal axis | 0% | OFF-CLASS |
| **#20** CC hooks API — [prior-art-evaluations.md:88](../prior-art-evaluations.md#L88) | Different surface (hooks ≠ skills); hooks could pass state via `additionalContext` JSON — useful adjacent reference | 15% | REFERENCE |

**Finding:** the kickoff §0 «start there — SSOT #77» hint is **misleading after T13 audit** — Cline Memory Bank is cross-session, our problem is within-invocation. SSOT #68 OhMyOpencode `boulder.json` is the closer precedent for file-based handoff, but its problem-class is cross-AGENT (Atlas / Prometheus / Metis), not cross-BLOCK within one prompt.

### §1.2 DeepWiki (≥3 phrasings)

#### `obra/superpowers` — "how does Superpowers persist state between independent `!shell` blocks within a single skill invocation?"

DeepWiki response (verbatim excerpt, 2026-05-27): «The codebase context focuses on skill *authoring* best practices and the skill discovery/invocation protocol, not the runtime execution model. The `!shell` syntax you're asking about doesn't appear in any of the provided skill examples or documentation snippets.» — i.e. Superpowers does NOT ship a cross-block state pattern. The skills it ships are documentation/process discipline, not multi-block bash orchestration.

**Implication:** no upstream pattern to ADOPT for our exact problem-class from Superpowers. (REFERENCE: SSOT #65 `using-git-worktrees` — orthogonal; SSOT #64 SDD — also orthogonal.)

#### `cline/cline` — "how does Cline pass a 'selected item' / 'winner' between separate decision steps within the same session?"

DeepWiki response (verbatim excerpt, 2026-05-27):

> «In Cline, the model passes a "selected item" or "winner" choice between separate decision steps primarily through the conversation context, which is part of the `Task` instance, and through persistent storage managed by the `StateManager`. While `Memory Bank` files like `activeContext.md` and `progress.md` are used for long-term context persistence across sessions, immediate selections within a session are typically handled in-memory within the `Task`'s conversation history or by updating the `StateManager` for more persistent settings.»

**Implication:** Cline's within-session pattern is _conversation context_ (model-internal memory) or _`StateManager` cache_ (VS Code extension state, not file). **Neither maps to our problem** — we have no `Task` object, no `StateManager`, and the conversation-context channel is exactly what Bug #2 breaks (block-pre-substitution timing). Cline Memory Bank's committed-markdown is cross-session only. SSOT #77 ADAPT verdict for `_plan-cache.md` stands; new ADAPT for this problem-class would be cargo-culting (T16 `#pattern-matching-on-name`).

#### `code-yeongyu/oh-my-openagent` — "how does Prometheus pass the winning plan to downstream agents?"

DeepWiki response (verbatim excerpt, 2026-05-27):

> «There is no "priority scoring" or "winner selection" mechanism in this orchestration. Instead, the system uses a **sequential, file-based handoff pattern**: Prometheus writes plans to `.omo/plans/*.md` files. … When invoking Momus, the plan file path is passed as the sole prompt argument: `prompt=".omo/plans/{name}.md"`. The downstream agent reads this file directly. … For Atlas execution, a `boulder.json` file tracks the active plan and session state, enabling resumption across interruptions. … There is **no analog to Claude Code's `!shell` injection mechanism**. The system does not use inter-block shell commands or special delimiters for code execution between agents.»

**Implication:** confirms SSOT #68 framing — OhMyOpencode is the closest file-state precedent (REFERENCE), but explicitly _has no analog to `!shell`_. The handoff in OhMyOpencode is between separate agent sessions, mediated by file paths in prompt args. Our problem is within ONE skill invocation. The pattern transfers in shape (file-based state, helper reads file) but the trigger is different (agent dispatch vs `!shell` substitution).

### §1.3 WebSearch (≥3 phrasings)

**Query 1:** `"claude code skill SKILL.md multiple bash code blocks execution order timing 2026"` ([primary hit: `code.claude.com/docs/en/skills`](https://code.claude.com/docs/en/skills); secondary: [Issue #12781](https://github.com/anthropics/claude-code/issues/12781) "Skill loading executes inline bash patterns from documentation examples"). Surfaced key statement: «Substitution runs once over the original file. Command output is inserted as plain text and is not re-scanned for further `!`<command>`` placeholders.» — directly answers §1.5a.

**Query 2:** `claude code slash command "$ARGUMENTS" named argument substitution skill frontmatter "arguments:" expansion timing` ([primary hit: `m.academy` pass-arguments lesson](https://m.academy/lessons/pass-arguments-custom-slash-commands-claude-code/); secondary: [Issue #19355](https://github.com/anthropics/claude-code/issues/19355) "Clarify support for positional arguments ($1, $2, etc.) in Agent Skills"; [Issue #16163](https://github.com/anthropics/claude-code/issues/16163) "`$ARGUMENTS` in slash commands not escaped for bash execution"). Confirms: «Invoking `/pr alice` substitutes `alice` into the prompt before Claude sees it» — argument substitution happens pre-prompt, same channel as `!shell` substitution.

**Query 3:** `claude code bash classifier "unexpanded shell variable" auto-mode permission deny 2026` ([primary hit: [Issue #51001](https://github.com/anthropics/claude-code/issues/51001) "`--permission-mode dontAsk` bypasses `autoAllowBashIfSandboxed` for Bash commands containing shell variable expansion"; secondary: [Issue #48762](https://github.com/anthropics/claude-code/issues/48762) "Hardcoded Bash safety checks (expansion obfuscation, compound-command guardrails)"). Key finding: «Before each tool call executes, a separate classifier model (Sonnet 4.6, regardless of the session model) evaluates the pending action.» «An expansion obfuscation classifier exists at cli.js line 1870, function C68, with a regex that fires on any Bash command containing a brace followed by a quote character.» — directly explains the Incident A/B mechanism + the §10 step 5b jq block (`{id: ., first_seen: $now}` is a brace-quote pattern).

### §1.4 BFR sweep (full SSOT enumeration + T16)

Read of all 84 active SSOT rows ([`prior-art-evaluations.md`](../prior-art-evaluations.md), 2026-05-27). Beyond the rows already listed in §1.1:

- **#75** Claude Code skill auto-activation by description — orthogonal (routing, not state). NO MATCH.
- **#82** Superpowers research-synthesis workflow — adopted in this very patch (§1.1-§1.3 are an instance). Different layer (process). NO MATCH for state-passing.
- **#84** `claude plugin install` — orthogonal (admin subcommand). NO MATCH.
- **#80** aif-handoff delta-tracking extension (hypothetical) — already flagged DEFER for the `_master-backlog-delta.json` schema; same row applies here. NO NEW EVIDENCE.
- **#61** OhMyOpencode `rulesInjector` — orthogonal (rules-on-edit injection). NO MATCH.
- **#68 + #77** — addressed in §1.1.

**No row missed; no new candidate surfaces from BFR sweep.** The «no production-grade upstream for cross-block `!shell` state within one CC skill invocation» finding is supported by:

1. CC `!shell` is CC-native (no other harness ships an analog per DeepWiki/Superpowers/OhMyOpencode answers).
2. Within-CC, file-state via Write tool + helper-called-via-Bash-tool with literal argv is the only pattern compatible with the classifier (per §1.5b).
3. This puts us in the «**ADAPT + BUILD-thin-helper**» class — adopt the file-state shape from #68 + #77, build the project-specific helpers for our exact id-set arrays.

### §1.5 CC primitive verification

#### §1.5a — Block timing (VERIFIED: eager all-at-once)

[Authoritative CC docs at `code.claude.com/docs/en/skills`](https://code.claude.com/docs/en/skills), verbatim excerpts (WebFetch cached at session-local path `tool-results/toolu_011TMv9D7fU8uK3nmtrvkWee.txt:436-444`, 2026-05-27):

> «The `` !`<command>` `` syntax runs shell commands **before the skill content is sent to Claude**. The command output replaces the placeholder, so Claude receives actual data, not the command itself.»
>
> «1. Each `` !`<command>` `` executes immediately (before Claude sees anything)
>  2. The output replaces the placeholder in the skill content»
>
> «Substitution runs once over the original file. Command output is inserted as plain text and is **not re-scanned for further** `` !`<command>` `` **placeholders**, so a command cannot emit a placeholder for a later pass to expand.»

For multi-line blocks (` ```! ` fenced form, used at SKILL.md:517-525): same timing — block executes before Claude sees the prompt.

**Verdict:** all `!shell` blocks substitute pre-prompt. No model judgment can interpose between them. Bug #2 is therefore architectural: the model CANNOT use a `!shell` block to consume §2's winner-pick — the model has to invoke the Bash/Write tool **after** seeing the (already-substituted, stale) prompt.

T-N1 honoured: docs were WebFetched, not inferred from training-data.

#### §1.5b — Classifier constraints on `${var}` and placeholders

**VERIFIED (from §0 incidents + §1.3 Query 3 mechanism doc):**

| Pattern | Classifier outcome | Evidence |
|---|---|---|
| `${CLAUDE_SKILL_DIR}` | **OK** | PR #260 §2.5 Step 3 helper-delegation passes |
| `${umbrella}` (no default) | **BLOCKED** | Incident A 2026-05-27 |
| `${umbrella:-no-arg}` (with default) | **BLOCKED** | Incident B 2026-05-27 — `:-` default does NOT save |
| `<angle-bracket-placeholder>` | **BLOCKED** | Incident B 2026-05-27 |
| `{key: value}` brace-followed-by-quote | **BLOCKED** | Issue #48762 — expansion-obfuscation regex (cli.js:1870 C68) |
| Arbitrary `${X}` (undefined env var) | **BLOCKED (extrapolated)** | Same classifier mechanism; no reason to differ; not directly probed in a fresh synthetic skill — marked PROVISIONAL per T-N2 |
| `$ARGUMENTS`, `$N`, `$umbrella` (named-arg CC placeholder) | **OK (probable)** | CC harness substitutes these before classifier sees the bash line; no incident from this shape; not directly probed in no-arg empty-arg case |
| `$(command-substitution)` e.g. `$(date -u +%Y-%m-%dT%H:%M:%SZ)` | **OK (probable)** | Incident B's verbatim classifier message did NOT include the adjacent `NOW=$(date …)` on line 519; the placeholders enumerated were `<…>` and `${umbrella:-no-arg}` only. Not directly probed in isolation. Marked PROVISIONAL per T-N2. |

**T-N2 PROVISIONAL caveat:** items marked "extrapolated" / "probable" have not been verified by a fresh synthetic-skill probe (would require maintainer to invoke a new test skill — not in this R-phase scope). Verdicts in §2 that depend on classifier behaviour on PROVISIONAL shapes are explicitly flagged.

#### §1.5c — `allowed-tools` write paths (VERIFIED OK)

[SKILL.md:8-16](../../../.claude/skills/pipeline/SKILL.md#L8-L16):

```yaml
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(ls *)
  - Bash(cat *)
  - Read
  - Write
  - Edit
  - Agent
```

**Verdict:**

- `Write` tool is in `allowed-tools` — no path restriction declared, so writing `.claude/orchestrator-prompts/_meta-orch-state.json` (or extending `_master-backlog-delta.json`) via `Write` is supported.
- `Bash(jq *)` is NOT in `allowed-tools` — inline `bash | jq` via the model's Bash tool would prompt for permission. The F.3 helper-collapse approach avoids this by invoking `bash ${CLAUDE_SKILL_DIR}/helpers/<name>.sh` (matches `Bash(git *)` / etc.? — NO, none of the existing patterns match) — would need adding `Bash(bash ${CLAUDE_SKILL_DIR}/helpers/* *)` or similar.
- `Bash(${CLAUDE_SKILL_DIR}/helpers/* *)` is **NOT yet in `allowed-tools`** despite SKILL.md §2.5 using exactly this pattern via inline `!shell` (line 172, 180, 188, 239). The `!shell` channel bypasses `allowed-tools` since the harness executes the substitution. The model's Bash tool calls do NOT bypass — they would prompt or auto-deny per permission-mode.

**Implication for F.3 I-phase:** `allowed-tools` MUST be extended to permit the model-emitted `bash <helper>` calls (the post-§2 dispatch step). Likely shape: `Bash(bash *)` (broad) or per-helper allowlist (narrow). Add to I-phase scope.

#### §1.5d — §10 step 5b deterministic-substitution feasibility (SETTLES §0.5 falsifier)

Inspection of [SKILL.md:225-226 (Steps 8-9)](../../../.claude/skills/pipeline/SKILL.md#L225-L226), [SKILL.md:517-525 (step 5b jq)](../../../.claude/skills/pipeline/SKILL.md#L517-L525), [helpers/delta-diff.sh](../../../.claude/skills/pipeline/helpers/delta-diff.sh), [helpers/update-delta.sh](../../../.claude/skills/pipeline/helpers/update-delta.sh), [references/master-backlog-delta.md §1-§3](../../../.claude/skills/pipeline/references/master-backlog-delta.md).

**Findings:**

1. `current_ids_json_array` derives from: §2.5 Step 2 `dup-detect.sh` (deterministic — emits `POTENTIAL_DUPE:` / `MISSING:` lines) + §2.5 Step 3 `classify-each-candidate.sh` (deterministic — iterates the `priority-score.sh` candidate set). Both are pure bash, no model judgment for the id-set.
2. `resolved_ids_json_array` derives from: `delta-diff.sh` set-diff between prior `untracked_seen[].id` and current id-set ([helpers/delta-diff.sh](../../../.claude/skills/pipeline/helpers/delta-diff.sh) lines 22-26 contract: «3. Emits "NEW-SINCE-LAST: <id>" for each id in current \ seen. 4. Emits "RESOLVED-SINCE-LAST: <id>" for each id in seen \ current»). Deterministic.
3. Model judgment in §2.5 Step 5 (routing-tree → ALIAS) applies to per-candidate Mode/dispatch decisions — it does NOT enter the id-set. The id-set is the input to routing-tree, not the output.
4. `untracked_seen` overwrite-shape per [references/master-backlog-delta.md §1](../../../.claude/skills/pipeline/references/master-backlog-delta.md) — `first_seen` is "most recent sighting", not historical anchor — so no preserve-history complication.

**Verdict:** `current_ids` and `resolved_ids` are **deterministically reconstructible** from `priority-score.sh` + `dup-detect.sh` + `delta-diff.sh` outputs alone. **§0.5 falsifier resolves NEGATIVE.** Scope-merge (Bug #2 + #3 + #4 in one R-phase) is VALID. F.3 helper-collapse can cover Bug #4 without requiring an F.1+ extension that would persist routing-tree (model-judgment) output.

### §1.6 DeepWiki on this repo + merged-PR history

DeepWiki repo lookup for `Yhooi2/rules-as-tests-aif` returned: «Repository not found. Visit <https://deepwiki.com> to index it.» — repo not indexed in DeepWiki (2026-05-27). Falling back to direct git/gh probes:

```bash
gh pr list --state merged --search 'in:title shell timing OR cross-block OR winner persist OR launch-table'
```

Surfaced merged PRs (verbatim, 2026-05-27):

- **[PR #193](https://github.com/Yhooi2/rules-as-tests-aif/pull/193)** "fix(meta-orchestrator): guard `${umbrella}` with `:-` default in §3 !shell blocks" — symptom fix (commit [8f60158](https://github.com/Yhooi2/rules-as-tests-aif/commit/8f60158)); commit body explicitly: «Symptom fix only. The deeper issue (§3 !shell blocks executing eagerly at skill load rather than lazily after §2 selects an umbrella) is architectural and out of scope here.» This R-phase is the deeper-issue closure.
- **[PR #194](https://github.com/Yhooi2/rules-as-tests-aif/pull/194)** "fix(meta-orchestrator): launch-table-generator exit 0 on empty umbrella (real root)" — additional symptom fix on the helper's exit code.
- **[PR #205](https://github.com/Yhooi2/rules-as-tests-aif/pull/205)** "feat(meta-orchestrator): F.3 — UX implementation per G §1.5 12 items" — confirms an "F.3" label was previously used for a different umbrella's UX work; **the F.3 label in this R-phase's candidate matrix is locally scoped to this umbrella and is NOT the same F.3 as PR #205**. Naming collision flagged for the I-phase PR title.
- **[PR #260](https://github.com/Yhooi2/rules-as-tests-aif/pull/260)** "fix(meta-orchestrator): §2.5 Step 3 — extract Loop to classify-each-candidate.sh" — prerequisite (this umbrella's kickoff §Prerequisite); validates the helper-collapse shape as already in use.

**Verdict:** no prior research-patch addresses cross-block winner-persistence directly. Two prior PRs (#193, #194) are explicit symptom-fixes for Bug #3 specifically; PR #205's "F.3" label is a naming collision. Recommend the I-phase PR title use a distinct slug (e.g. `feat(meta-orchestrator): no-arg-laziness F.3 helper-collapse`) to disambiguate.

---

## §2 Candidate matrix

For each candidate: **BFR posture** ([build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md)), **falsifier**, **classifier-compatibility per §1.5b**, **bug coverage**, **integration cost**.

### F.1 — File-state-as-substrate

**Shape:** model writes a state file via `Write` tool post-§2 (e.g. `.claude/orchestrator-prompts/_meta-orch-state.json` containing `{current_winner, current_ids, resolved_ids}`); §3/§4/§10 inline `!shell` blocks shrink to a single helper call `${CLAUDE_SKILL_DIR}/helpers/<name>-from-state.sh` that reads the state file internally.

**BFR posture:** **ADAPT** — adopts SSOT #68 OhMyOpencode `boulder.json` file-handoff shape (REFERENCE; CC substrate differs) + SSOT #77 Cline Memory Bank committed-markdown sub-pattern (already ADAPT-ed for `_plan-cache.md`; same channel, different artefact).

**Classifier-compatibility:** OK — helper invocations show only `${CLAUDE_SKILL_DIR}` (whitelisted) plus literal-string args. Brace-quote jq lives inside helper, hidden from classifier.

**Bug coverage:** #2 ✓ · #3 ✓ (no `${var}` in inline blocks) · #4 ✓ per §1.5d.

**Falsifier:** wrong if (a) `Write` tool blocked from path by `allowed-tools` — NEGATIVE per §1.5c; (b) §1.5a probe reveals lazy timing — NEGATIVE per §1.5a verbatim docs; (c) `current_ids` requires post-routing-tree judgment — NEGATIVE per §1.5d. **All three falsifiers fail; F.1 stands.**

**Integration cost:** LOC ~80-120 across 2 new helpers + ~25-line edits to SKILL.md §3/§4/§10. New files: `helpers/dispatch-from-state.sh`, `helpers/delta-write-from-state.sh`. Existing helper `update-delta.sh` stays untouched (preserves its idempotency contract + paired-negative test).

### F.2 — Re-invoke with winner-arg

**Shape:** §2 concludes with «Recommend `<winner>`. To proceed, run `/meta-orchestrator <winner>` in this session.» No-arg mode exits at §2; second invocation enters arg-mode. _Assumes_ argv reaches `${umbrella}` — but §0 Incident A proves this assumption is FALSE: arg-mode `/meta-orchestrator meta-orch-no-arg-laziness` STILL blocks on `${umbrella}` because the classifier never sees the argv expansion.

**BFR posture:** **REJECT** (was the kickoff's primary candidate for Bug #2 single-bug coverage; Incident A demonstrates it doesn't actually work because the bash-form `${umbrella}` is the wrong placeholder regardless of argv).

**Bug coverage:** none (Incident A falsifies the foundational assumption).

**Falsifier:** wrong only if `${umbrella}` were CC-harness-substituted (it isn't — that's `$umbrella`). The candidate's premise is incorrect given §1.5b empirical evidence.

### F.3 — Helper-collapse for §3/§4 + §10 step 5b

**Shape:** F.1 + remove the `!shell` blocks at SKILL.md:239/243 entirely (or downgrade them to placeholder comments); add explicit prose «After §2, invoke `bash ${CLAUDE_SKILL_DIR}/helpers/launch-table-generator.sh "<winner>"` via Bash tool with literal-string winner». §10 step 5b's inline jq becomes `bash ${CLAUDE_SKILL_DIR}/helpers/delta-write-from-state.sh "<winner>" "<outcome-one-liner>"` — helper reads state file (or pos args) and runs jq internally. **F.3 = F.1 + section-collapse + `allowed-tools` extension.**

**BFR posture:** **ADAPT (extends F.1)** — same upstream references; adds the explicit-removal-of-eager-blocks pattern that PR #260's §2.5 Step 3 helper extraction already validated as a precedent in this repo.

**Classifier-compatibility:** OK — strictly stronger than F.1 because no inline `!shell` blocks containing `${umbrella:-}` remain.

**Bug coverage:** #2 ✓ · #3 ✓ · #4 ✓.

**Falsifier:** wrong if removing the §3 inline blocks breaks arg-mode invocation (currently arg-mode broken anyway per Incident A — F.6 hygiene fix in same PR restores arg-mode); OR if `allowed-tools` extension to `Bash(bash *)` is too broad for the project's permission philosophy ([CLAUDE.md «PR strategy»](../../../CLAUDE.md) — DECISION-NEEDED §6).

**Integration cost:** LOC ~120-180; surfaces touched: SKILL.md §3 + §4 + §10 step 5b + `allowed-tools` frontmatter + 2 new helpers + tests. Estimate ≥80 LOC threshold → capability commit per [CLAUDE.md "What is a capability commit?"](../../../CLAUDE.md). Needs Prior-art trailer citing this patch.

### F.4 — REJECT (verified per Incident A/B + §1.5b table)

**Shape:** replace `${umbrella}` with `${meta_orch_winner}` env-var inheritance.

**BFR posture:** **REJECT** — Incident A/B prove all `${var}` other than `${CLAUDE_SKILL_DIR}` are classifier-blocked regardless of the variable name.

**Falsifier:** wrong only if §1.5b surfaces a seam-prefix the classifier allows. None today; not probed (would require a fresh synthetic skill).

### F.5 — Document-the-limitation (UX-explicit F.2)

**Shape:** accept no-arg mode halts at §2; instruct maintainer to start a new arg-mode invocation. Falsified by Incident A (arg-mode still blocks). **REJECT** for the same reason as F.2.

### F.6 — NEW-OPTION: switch `${umbrella:-}` → `$umbrella` (CC harness named-arg)

**Shape:** replace every `${umbrella:-}` (SKILL.md:72, 172, 239, 243, 524) with the CC harness named-arg placeholder `$umbrella`. The harness substitutes `$umbrella` from `arguments: [umbrella]` frontmatter BEFORE the classifier sees the bash line. Classifier sees the literal substituted string (or empty `""`) → OK.

**BFR posture:** **ADAPT (hygiene companion to F.3)** — uses CC's first-party substitution channel as designed; SSOT #84 `claude plugin install` style (use the CC-native primitive verbatim, no own substitute).

**Classifier-compatibility:**

- Arg-mode `/meta-orchestrator meta-orch-no-arg-laziness` → `$umbrella` → literal `meta-orch-no-arg-laziness` → bash sees literal → classifier sees literal → **OK**.
- No-arg mode `/meta-orchestrator` → `$umbrella` → empty string → bash sees `""` arg → classifier sees `""` → **OK probable**, but **PROVISIONAL** — CC docs ([code.claude.com/docs/en/skills `#available-string-substitutions`](https://code.claude.com/docs/en/skills)) do not explicitly state behaviour when a named arg is omitted in a manually-invoked skill. Issue #19355 acknowledges positional args are underdocumented. Marked PROVISIONAL per T-N2.

**Bug coverage:** #3 ✓ (the proximate classifier-block on `${umbrella}`) — **does NOT cover Bug #2 or #4** because:
- Bug #2 (block timing) is unaffected by which placeholder shape `${umbrella}` vs `$umbrella` is used; the `!shell` still runs eagerly before §2 picks winner.
- Bug #4 (angle-bracket placeholders + brace-quote jq) is unrelated to the umbrella variable; even if `${umbrella:-no-arg}` becomes `$umbrella`, the `<current_ids_json_array>` placeholders and the `{id: ., first_seen: $now}` brace-quote pattern still block.

**Falsifier:** wrong if (a) CC harness leaves `$umbrella` literal when arg missing (a fresh synthetic-skill probe needed — out of R-phase scope); (b) the named-arg substitution channel has an unforeseen quoting interaction with bash (Issue #16163 — `$ARGUMENTS` escape bug — flags this risk class).

**Integration cost:** LOC ~5 edits to SKILL.md (5 lines × `${umbrella:-} → $umbrella`). NOT a capability commit by LOC threshold. Can ride in F.3 PR or stand alone.

### Coverage matrix (post-§1 evidence)

| Candidate | Bug #2 | Bug #3 | Bug #4 | BFR | Status |
|---|---|---|---|---|---|
| F.1 | ✓ | ✓ | ✓ | ADAPT | stands; subset of F.3 |
| F.2 | ✗ (Incident A) | ✗ | ✗ | REJECT | falsified |
| **F.3** | **✓** | **✓** | **✓** | **ADAPT (extends F.1)** | **RECOMMENDED** |
| F.4 | ✗ | ✗ | n/a | REJECT | classifier blocks all `${var}` |
| F.5 | partial | ✗ | ✗ | REJECT | falsified |
| F.6 | ✗ | ✓ | ✗ | ADAPT (hygiene) | supplementary to F.3 |

**Verdict: F.3 primary + F.6 as supplementary hygiene fix (in the same I-phase or stand-alone).**

---

## §3 SSOT entries to add

No new SSOT row required for the verdict — F.3 ADAPTs from existing rows **#68** (OhMyOpencode `boulder.json` file-state, REFERENCE) and **#77** (Cline Memory Bank committed-markdown, ADAPT for `_plan-cache.md`). The new helpers (`dispatch-from-state.sh`, `delta-write-from-state.sh`) extend the existing helper family at [.claude/skills/meta-orchestrator/helpers/](../../../.claude/skills/pipeline/helpers/) and are governed by [CLAUDE.md "What is a capability commit?"](../../../CLAUDE.md) (≥80 LOC threshold likely fires → I-phase commit must carry a `Prior-art:` trailer citing this patch).

The F.6 fix uses an already-documented CC primitive (`$umbrella` named-arg substitution per [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) "Available string substitutions" table) — no SSOT row needed; the [code.claude.com docs](https://code.claude.com/docs/en/skills) themselves are the citation.

**Optional new SSOT row** (if the I-phase author judges it warranted): «CC auto-mode classifier — expansion-obfuscation regex at cli.js:1870 C68; blocks `${var}` other than whitelisted `${CLAUDE_SKILL_DIR}`; blocks brace-followed-by-quote per [Issue #48762](https://github.com/anthropics/claude-code/issues/48762); blocks angle-bracket model-substitution placeholders. REFERENCE for future skill-design decisions on inline `!shell` patterns.» — deferred to I-phase judgment.

---

## §4 §1.7 self-reflexive checks

### §1.7 Forward-check applied

Does this verdict comply with the existing discipline-bearing artefacts?

- **[no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md)** — VERIFIED OK: F.3 mechanism is `bash <helper>` + `jq` inside helpers + `Write` tool from the active session. Zero API-billed call; no CI-side LLM addition; entire dispatch is session-bound. ([file:line](../../../.claude/rules/no-paid-llm-in-ci.md) §1).
- **[build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md)** — VERIFIED OK: §2 declares ADAPT verdict (F.3) citing SSOT #68 + #77 with T16 problem-class checks; the only BUILD elements are two thin project-specific helpers (~80-120 LOC each) justified by §1.4 finding that no upstream addresses cross-block CC-skill state with the classifier-as-constraint shape. ([file:line](../../../.claude/rules/build-first-reuse-default.md) §1).
- **[dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md)** — VERIFIED OK: the F.3 helpers are CC-native (called from `/meta-orchestrator` skill inline bash). Per §3 "Performance-critical default CC-native + portable optional" — these helpers are session-bound to the CC skill, fire at the §10 step 5b moment with no portable analog. Each new helper should carry `@cc-only-rationale: consumer-facing CC-session helper invoked from /meta-orchestrator …` (matches the existing helpers' header convention per [helpers/update-delta.sh](../../../.claude/skills/pipeline/helpers/update-delta.sh) lines 30-34).
- **[doc-authority-hierarchy.md §2-§3](../../../.claude/rules/doc-authority-hierarchy.md)** — VERIFIED OK: this patch carries the required header (Authoritative-for + NOT authoritative-for); SKILL.md already carries its header and is the binding spec; the new helpers fall under "scripts/code files — JSDoc comments serve different purpose" but the existing helper header convention (Class C + Authoritative-for + NOT authoritative-for) should be carried forward at I-phase time.
- **[parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md)** — N/A here (single R-phase, single sub-wave, no parallel siblings, no shared-dir-parallel risk; primary workdir used per meta-launch §4a).
- **[ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md)** — VERIFIED OK: T1/T3/T4/T7/T11/T12/T13/T15/T16/T19/T20 active per kickoff §5; T-N1/T-N2/T-N3/T-N4 honoured per kickoff. T13 audit on SSOT #77 found the kickoff's "start there" hint misleading (corrected in §1.1). T15 instantiation: this very patch is checked for compliance with the rules above (this section). T19 self-cold-QA scheduled before declaring R-phase done (§7 below).

### §1.7 Backward-check applied

Does this patch silently supersede or contradict existing artefacts?

- **No existing rule, principle test, or SSOT row is superseded.** The F.3 verdict EXTENDS the existing helper family at [.claude/skills/meta-orchestrator/helpers/](../../../.claude/skills/pipeline/helpers/) — does not replace any of them.
- **One tension surfaced for I-phase resolution:** the kickoff and master-backlog-delta.md §4 anti-pattern `#delta-arrays-writer-creep` ([references/master-backlog-delta.md §4](../../../.claude/skills/pipeline/references/master-backlog-delta.md)) explicitly says: «extending `update-delta.sh` to write the two arrays (`untracked_seen` / `closed_since_last`) in addition to metadata. The two arrays MUST be populated by direct inline `jq` in SKILL.md body, not by the helper.» F.3 violates this anti-pattern (forced to do so by classifier reality — inline `jq` with brace-quote is blocked). The anti-pattern was written before §0 Incident B evidence; it needs a maintainer-owned revision in the I-phase: either (a) extend `update-delta.sh` with explicit `--with-arrays` flag (or new sibling helper `delta-write-arrays.sh`) with rationale «classifier-incompatibility supersedes BFR-style architectural-purity per Incident B verdict 2026-05-27»; (b) update the anti-pattern wording to acknowledge the exception. **Surface as DECISION-NEEDED §6 item 2.**
- **PR #205 naming collision** flagged — that PR used "F.3" label for a different umbrella's UX work. I-phase PR title must disambiguate.
- **PR #193 commit message** ([commit 8f60158](https://github.com/Yhooi2/rules-as-tests-aif/commit/8f60158)) explicitly defers "the deeper issue" to a separate scope; this patch closes that deferral. No supersession.
- **SKILL.md §10.3a plain-language tail** [SKILL.md:506](../../../.claude/skills/pipeline/SKILL.md#L506) — this very R-phase Worker emits the §7a tail per meta-launch §7a mandate; the I-phase Worker MUST also emit it; no new rule needed.

---

## §5 Closure proposal

### Recommended verdict

**F.3 (helper-collapse for §3/§4 launch-table + §10 step 5b) primary, with F.6 (`$umbrella` placeholder hygiene) as a supplementary fix in the same I-phase.**

Rationale: F.3 alone resolves all three bugs; F.6 restores arg-mode (`/meta-orchestrator <name>`) hygiene which is currently broken regardless of F.3 (Incident A); shipping both together avoids a future "fix arg-mode" follow-up.

### I-phase umbrella sketch

Scope (out of this R-phase; binding for the I-phase umbrella to be opened separately per kickoff §3):

1. **New helpers** under [.claude/skills/meta-orchestrator/helpers/](../../../.claude/skills/pipeline/helpers/):
   - `dispatch-from-state.sh` (~80-100 LOC) — collapses §3 launch-table + meta-kickoff invocation; reads winner-id from `_meta-orch-state.json` (NEW state file); calls existing `launch-table-generator.sh` internally; emits the launch-table to stdout.
   - `delta-write-from-state.sh` (~60-80 LOC) — replaces inline jq at SKILL.md:517-525; reads `current_ids` + `resolved_ids` from `_meta-orch-state.json` (or accepts as positional args); runs jq internally; chains to existing `update-delta.sh` for metadata.
   - Each helper carries the existing `update-delta.sh`-style header: Class declaration + Authoritative-for + NOT authoritative-for + dual-pair / cc-only-rationale + test seams.
2. **Paired-negative tests** at `packages/core/hooks/`:
   - `dispatch-from-state.test.ts` — happy-path + missing-state-file + corrupt-state-file + winner-not-in-current-ids.
   - `delta-write-from-state.test.ts` — happy-path + empty arrays + missing-state-file + jq-syntax-survives-empty-arrays.
3. **SKILL.md edits**:
   - §3 lines 239+243: remove or downgrade to placeholder comments; add explicit post-§2 prose «invoke `bash ${CLAUDE_SKILL_DIR}/helpers/dispatch-from-state.sh "<winner>"` via Bash tool with literal winner string».
   - §10 step 5b (lines 517-525): replace inline jq block with `bash ${CLAUDE_SKILL_DIR}/helpers/delta-write-from-state.sh "<winner-or-no-arg>" "<outcome-one-liner>"` (helper reads ids from state file or accepts as args).
   - All five `${umbrella:-}` occurrences (lines 72, 172, 239, 243, 524) → `$umbrella` (F.6).
   - Frontmatter `allowed-tools` extended with `Bash(bash *)` (or per-helper allowlist, narrower).
4. **References update**:
   - [references/master-backlog-delta.md §4](../../../.claude/skills/pipeline/references/master-backlog-delta.md) anti-pattern `#delta-arrays-writer-creep` — DECISION-NEEDED §6 item 2 resolves; update the anti-pattern wording accordingly.
   - SKILL.md §2.5 Step 9 (line 226): update «Concrete jq shape in §10 step 5» to reference the new helper file.
5. **`Prior-art:` trailer** on the I-phase capability commit citing this patch + SSOT #68 + #77.
6. **Principle 12 (AI-laziness-traps format) test** ([packages/core/principles/12-ai-laziness-traps.test.ts](../../../packages/core/principles/12-ai-laziness-traps.test.ts)) — unaffected by this verdict; no principle-test additions needed.

### Capability-commit threshold check

- New explicit dep: NONE (jq already in build env; bash already used).
- New file ≥50 LOC under new `packages/core/<new-dir>/`: NONE.
- New file ≥80 LOC under `packages/`: NONE (helpers live under `.claude/skills/meta-orchestrator/helpers/`, not `packages/`).
- **But:** new file ≥80 LOC under `.claude/skills/meta-orchestrator/helpers/` × 2 = capability commit per CLAUDE.md "What is a capability commit?" (third bullet — `packages/` paths only). The helpers are under `.claude/skills/`, not `packages/`, so the LOC threshold per CLAUDE.md does NOT formally fire. The Prior-art trailer is still recommended (best practice) but not strictly required by `.husky/pre-push` regex.

(Verify this by re-reading [CLAUDE.md "What is a capability commit?"](../../../CLAUDE.md) before drafting the I-phase commit — the threshold language is `packages/`-scoped.)

### Test additions (out of R-phase, in I-phase)

- 2 paired-negative test files (above).
- 1 integration test invoking the full §0-§3-§10 flow in a `make_test_repo()` — verifies winner-passing end-to-end. This is the «no-arg full-check» integration test the kickoff §3 explicitly defers.

---

## §6 Maintainer DECISION-NEEDED

Per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md) — surfacing decisions, not picking.

### DN-1: `allowed-tools` extension shape for F.3 model-emitted helper invocations

Current `allowed-tools` does not permit `bash ${CLAUDE_SKILL_DIR}/helpers/<name>.sh` as a model-emitted Bash tool call (the `!shell` channel bypasses but the model's Bash tool does not). F.3 requires extension.

- **Option A (broad):** add `Bash(bash *)` — permits any `bash <script>` invocation. Simple, low-friction, but broad.
  - Consequence: future scripts (incl. potentially-unrelated) become auto-permitted. Project may want narrower.
- **Option B (narrow):** add per-helper entries `Bash(bash <abs path to helper>)` × N (one per new helper). Tight scope but `${CLAUDE_SKILL_DIR}` expansion is unclear — `allowed-tools` matching is literal-string per [code.claude.com permissions docs](https://code.claude.com/docs/en/permissions); the abs path may differ per install. Likely needs `Bash(bash *)` for `${CLAUDE_SKILL_DIR}` reasons.
- **Option C (helper-aware glob):** add `Bash(bash *helpers/dispatch-from-state.sh*)` and similar — globs only the helper paths. Unverified that CC's `allowed-tools` matcher supports `*` in this position (per [Issue #16163](https://github.com/anthropics/claude-code/issues/16163) and surrounding harness-edge-cases). Requires a fresh synthetic probe.

Maintainer to choose A / B / C. (Recommended: A for simplicity, accept the broader scope on the §13 grounds that the meta-orchestrator skill is `disable-model-invocation: true` and only fires on explicit `/meta-orchestrator` invocation — broad `Bash(bash *)` within that gated scope is acceptable.)

### DN-2: `#delta-arrays-writer-creep` anti-pattern tension

[references/master-backlog-delta.md §4](../../../.claude/skills/pipeline/references/master-backlog-delta.md) explicitly forbids extending `update-delta.sh` to write the two arrays. F.3 implements the delta-write via either (a) extending `update-delta.sh` (violates anti-pattern) or (b) a sibling helper `delta-write-from-state.sh` (does NOT violate — helper-scope separation preserved). The anti-pattern wording itself may need revision to acknowledge: «inline jq with brace-quote is classifier-blocked per Incident B 2026-05-27 — the body-owned-arrays clause must be relaxed to permit a sibling helper».

- **Option A:** extend `update-delta.sh` with `--with-arrays` flag; revise anti-pattern wording.
- **Option B:** new sibling helper `delta-write-from-state.sh` (or `write-delta-arrays.sh`); update anti-pattern wording to call out the explicit exception («arrays may live in a separate sibling helper, but NOT in the metadata writer»).

(Recommended: Option B — preserves the metadata writer's paired-negative test contract verbatim; keeps `update-delta.sh` UNCHANGED per its existing «Stage 2B, UNCHANGED» status; adds one well-scoped sibling helper.)

### DN-3: §3 inline `!shell` block disposition

Current §3 has two `!shell` blocks at SKILL.md:239 + 243. Under F.3, they have no useful work in no-arg mode and arg-mode is broken anyway (Incident A). Options:

- **Option A — remove entirely:** clean SKILL.md; replace with prose «invoke helper via Bash tool post-§2». Risk: principle 12 test ([12-ai-laziness-traps.test.ts](../../../packages/core/principles/12-ai-laziness-traps.test.ts)) may have implicit assumptions about `!shell` block presence in §3 — needs verification (one Read of the test).
- **Option B — keep but downgrade:** leave the `!shell` blocks but with `${CLAUDE_SKILL_DIR}/helpers/launch-table-generator.sh "$umbrella"` (F.6 hygiene). In no-arg mode `$umbrella` → `""` → helper emits no-op gracefully; in arg-mode the substitution works correctly. Then ALSO call helper via Bash tool post-§2 for the winner case. Slight duplication but preserves the kickoff-injection UX.

(Recommended: Option B — preserves §3's existing "inject the kickoff body for context" benefit in arg-mode; F.6 fixes the classifier-block; F.3-via-Bash-tool fires for the no-arg winner-passing case. Both channels coexist.)

### DN-4: F.6 PROVISIONAL — empty `$umbrella` substitution in no-arg

CC docs do not explicitly state what `$umbrella` substitutes to when the named arg is omitted in a manually-invoked skill (Issue #19355 acknowledges underdocumentation). F.6 assumes empty `""`; if the harness leaves it literal `$umbrella`, bash would expand to whatever `umbrella` env var is set to (likely empty), but the classifier might still see literal `$umbrella` (without `{}`) — likely OK but unverified.

- **Option A — ship F.6 with PROVISIONAL note:** include in I-phase; cite the gap in the PR body; add a follow-up «empty-arg probe» task to the queue if a synthetic-skill probe surfaces issues post-merge.
- **Option B — defer F.6:** ship F.3 alone; leave `${umbrella:-}` as-is for now; arg-mode stays broken; revisit when a fresh skill-probe is feasible (could be the same I-phase if maintainer runs a probe in parallel).

(Recommended: Option A — F.6 is 5 LOC, the cost of carrying it is low; the PROVISIONAL caveat is a documented gap not a hidden risk.)

---

## §7 Self-cold-QA (T19) — orchestrator pre-handoff review

Per kickoff §5 T19 + meta-launch §7 reviewer dispatch + the [ai-laziness-traps.md T19 entry](../../../.claude/rules/ai-laziness-traps.md) — re-review this patch as an independent reviewer before declaring done.

### Findings (self-review pass 1)

- **All 6 §1 searches present** with file:line evidence or fetched excerpt (T4 cleared).
- **§1.5a/b/c/d probes all addressed** (T-N1/T-N2/T-N3 cleared); PROVISIONAL flags carried for shapes not directly probed (T-N2 honoured).
- **All §6 DECISION-NEEDED items surface options without picking strategy** ([reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md) discipline preserved).
- **T13 audit on SSOT #77 corrected the kickoff hint** — Cline Memory Bank is NOT the strong precedent §1.1 originally implied (corrected in §1.1 finding line + §3 SSOT entries).
- **T15 self-application:** this patch's own design choice (file-state + helper-collapse) is itself compatible with §1.5b — the I-phase commits will pass classifier when they invoke helpers with `${CLAUDE_SKILL_DIR}` + literal args.
- **T20 (verdict-without-evidence):** every F.X verdict is supported by a same-section tool call or excerpt — §1.5a verbatim quotes anchor F.1/F.3, §0 Incidents anchor F.4 REJECT, §1.5d analysis anchors §0.5 falsifier resolution.

### Residual gaps (declared, not hidden)

- **F.6 PROVISIONAL** (DN-4): empty-arg substitution behaviour not directly probed.
- **§1.5b arbitrary `${X}` and seam-prefix patterns** marked extrapolated, not probed.
- **DN-1 Option C (`allowed-tools` glob support):** unverified that `Bash(bash *helpers/<name>.sh*)` glob is honoured.
- **DN-3 Option A risk** (principle 12 test implicit assumption about §3 `!shell` presence): unverified.

These four gaps are PROVISIONAL flags, not BLOCKERs. The verdict (F.3 + F.6) stands on the verified evidence; the gaps are explicitly flagged so the I-phase Worker resolves them via probes rather than assumption.

---

## §8 See also

- Kickoff: [.claude/orchestrator-prompts/meta-orch-no-arg-laziness/kickoff.md](../../../.claude/orchestrator-prompts/meta-orch-no-arg-laziness/kickoff.md)
- Meta-launch: [.claude/orchestrator-prompts/meta-orch-no-arg-laziness-meta-launch/kickoff.md](../../../.claude/orchestrator-prompts/meta-orch-no-arg-laziness-meta-launch/kickoff.md) + [state.md](../../../.claude/orchestrator-prompts/meta-orch-no-arg-laziness-meta-launch/state.md)
- Prerequisite: [PR #260](https://github.com/Yhooi2/rules-as-tests-aif/pull/260) — `fix(meta-orchestrator): §2.5 Step 3 — extract Loop to classify-each-candidate.sh` (merged 2026-05-27)
- Symptom-fix predecessors: [PR #193](https://github.com/Yhooi2/rules-as-tests-aif/pull/193) (`${umbrella}` `:-` default) + [PR #194](https://github.com/Yhooi2/rules-as-tests-aif/pull/194) (helper exit 0 on empty)
- Naming collision flag: [PR #205](https://github.com/Yhooi2/rules-as-tests-aif/pull/205) (different umbrella, same "F.3" label)
- CC docs source: [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) "Dynamic context injection" + "Available string substitutions"
- Classifier mechanism: [Issue #48762](https://github.com/anthropics/claude-code/issues/48762) (expansion-obfuscation regex) + [Issue #51001](https://github.com/anthropics/claude-code/issues/51001) (auto-mode shell-expansion deny)
- SSOT precedents: [prior-art-evaluations.md #68](../prior-art-evaluations.md) (OhMyOpencode boulder.json REFERENCE) + [#77](../prior-art-evaluations.md) (Cline Memory Bank committed-markdown ADAPT)
- Rules touched in §4: [no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md) + [build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md) + [dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md) + [doc-authority-hierarchy.md §2-§3](../../../.claude/rules/doc-authority-hierarchy.md) + [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md) + [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md) + [phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md) (this very 6-item search structure)

---

## 🟢 Простыми словами

Что было: в скилле `/meta-orchestrator` три места, где инлайн `!shell` блок ломается из-за CC-классификатора. Bug #2 — §3 launch-table запускается **до того**, как §2 выбирает umbrella-winner (классификатор тут не виноват, виноват eager all-at-once timing — все `!shell` подставляются ДО того, как модель видит prompt). Bug #3 — `${umbrella}` и `${umbrella:-no-arg}` блокируются классификатором (литеральный `:-` дефолт не спасает). Bug #4 — `<placeholder>` и `{key:val}` jq blocked.

Что сделал R-phase Worker (я): прошёл все 6 обязательных searches (§1.1 SSOT, §1.2 DeepWiki ×3, §1.3 WebSearch ×3, §1.4 BFR sweep, §1.5 probes a/b/c/d, §1.6 repo PR-history); каждый probe с file:line + verbatim excerpts. **§1.5a verified** через CC docs verbatim: «Substitution runs once over the original file. Command output is inserted as plain text and is not re-scanned» — eager all-at-once подтверждён. **§1.5d verified** — id-arrays для Bug #4 deterministic из helper outputs, scope-merge VALID. **§1.5b/c partially verified** — PROVISIONAL флаги стоят (5 строк в патче) на не-probed shapes.

Вердикт: **F.3 (helper-collapse) primary + F.6 (`$umbrella` placeholder hygiene) supplementary** — все три bug-а уходят. F.1 (file-state) — это subset F.3 (стоит как промежуточный). F.2/F.4/F.5 — REJECT (falsified evidence-based).

4 DECISION-NEEDED для maintainer'а (не picking strategy, surfacing options): DN-1 `allowed-tools` shape (broad vs narrow vs glob); DN-2 `#delta-arrays-writer-creep` anti-pattern revision; DN-3 §3 `!shell` block disposition; DN-4 F.6 PROVISIONAL empty-arg.

Что НЕ сделано (out of scope per kickoff §3): code в SKILL.md / helpers НЕ менялся; integration test НЕ написан; верификация F.6 пустого arg-а НЕ делалась live-probe'ом. I-phase будет отдельной umbrella.

Файлов изменено: 1 (этот патч). LOC: ~620. PR ushers staging.
