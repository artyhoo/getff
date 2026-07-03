# Dual-implementation discipline — discipline rule

> **Class:** A — the §5 drift-check + §6 marker-presence sketches ship as an executable check: [tests/agnosticism/probes/channel-coverage.sh](../../tests/agnosticism/probes/channel-coverage.sh) (Surface 8, CI-run by [packages/core/principles/21-agnosticism-conformance.test.ts](../../packages/core/principles/21-agnosticism-conformance.test.ts); seeded-break paired-negative in [tests/agnosticism/harness-self.test.sh](../../tests/agnosticism/harness-self.test.sh)) + the edit-time gate [.claude/hooks/check-hook-marker.sh](../hooks/check-hook-marker.sh) (§6, PostToolUse). The §8 *semantic* anti-patterns (`#two-prompts-drift` ≥3-line divergence, `#sync-by-copy-paste`, `#brand-name-detection`) remain reviewer-time judgment, not gated. Promotion history: §9.
> **Authoritative for:** dual-implementation discipline rule — §1 problem, §2 triggers + non-triggers, §3 audience triage, §4 detection mechanism, §5 drift check, §6 CC-bias mitigation, §7 single source of truth, §8 anti-patterns, §9 promotion / retirement, §10 see also.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Build-vs-reuse (upstream adoption vs build) — see [build-first-reuse-default.md](build-first-reuse-default.md). Search-coverage discipline — see [phase-research-coverage.md](phase-research-coverage.md).

> **Origin:** 2026-05-16 strategic D-items dialogue, D2 verdict B+ «soft case-by-case + dual-implementation discipline» ([decisions.md §D2](../orchestrator-prompts/d-items-strategic-dialogue/decisions.md)). Maintainer framing: «Claude Code лучший — используем его фичи когда есть». Design session 2026-05-17.
>
> **Companion executable test:** [tests/agnosticism/probes/channel-coverage.sh](../../tests/agnosticism/probes/channel-coverage.sh) — Surface 8 of principle 21 (shipped 2026-07-02); enforces §5 (`@dual-pair` anchor resolves to a real counterpart) + §6 (every CC hook declares a delivery-channel marker), population-wide and off-CC. See §9.

---

## §1 — Problem this solves

Three failure modes accumulate silently without this rule:

**(a) Two-prompt drift.** A capability ships as both a CC hook and a portable agent markdown. Both are edited over time independently. By month 3 they describe subtly different behaviour — the CC hook got a new edge case; the agent was never updated. No mechanical check notices. **Decision 4 (2026-05-11)** reached the CC-native choice ad-hoc for cross-editor parity; that decision was sound but left no audit trail for future similar calls.

**(b) Silent CC vendor lock-in.** «CC is best» reasoning accumulates across many small per-feature decisions. No single decision is wrong; the composed result is that the consumer-facing product works only inside Claude Code. Portable fallback gets omitted every time because «we use CC anyway». Future portability costs escalate unnoticed.

**(c) Capability-check brittleness.** Code or scripts detect the CC harness by brand-name string rather than capability presence. When CC renames a hook event type or a compatible harness uses a different brand identifier, the branch silently falls through to the wrong path.

This rule does not ask «should we build or adopt?» (that is [build-first-reuse-default.md](build-first-reuse-default.md)). It asks: once we have an own-built feature, which delivery channel(s) should it ship through, and how do we keep them from diverging?

---

## §2 — Triggers and non-triggers

**This rule applies when:**

- Shipping a new feature that has a CC-native primitive available (e.g. a hook event type) AND the feature is intended for consumer projects.
- Shipping a feature where consumers may use non-Claude-Code harnesses (Cursor, Aider, Codex) and the feature is semantically useful outside CC.
- Refactoring an existing feature that already crosses channels (e.g. converting a portable agent into a CC hook, or adding a portable fallback to an existing hook).

**This rule does NOT apply to:**

**(i) Markdown-only artefacts** — rules, docs, research-patches, prose discipline. Nothing to «make portable»; the file IS the portable artefact. Examples: this file itself; `docs/meta-factory/retros/phase-8-retro.md`. (CC auto-loading via `.claude/rules/` is a harness convenience, not a capability — the markdown content is harness-agnostic; consumers on Cursor/Aider can read the same file.)

**(ii) Internal-only tooling** that will not ship to consumer projects and is not intended for replication. Examples: `.claude/orchestrator-prompts/d-items-strategic-dialogue/decisions.md` (orchestrator internal); `.husky/pre-push` (repo-internal Husky hook, not CC-specific, already universal).

**(iii) One-off fixes** that don't introduce a reusable capability — bug fix in an existing hook with no new delivery channel, snapshot regeneration, typo correction. Matches the «Refactors, doc edits, test additions» carve-out from the capability-commit definition in CLAUDE.md.

**(iv) TypeScript packages under `packages/`** — library capabilities that ship as functions/classes, not as hook/agent/skill artefacts. These are governed by the capability-commit gate in [CLAUDE.md](../../CLAUDE.md) (Build-vs-reuse invariant + Prior-art trailer), not by delivery-channel triage. If such a package later grows a CC-native primitive (e.g. a published hook factory), at that moment §2 applies to the *hook surface*, not the underlying library.

---

## §3 — Triage by audience

### Internal tooling — default: CC-native only

Internal means: used exclusively inside the maintainer's own development environment, not shipped to consumer projects, not intended for replication.

**Default:** ship CC-native only. Portable fallback is unnecessary overhead.

**Examples:** `.claude/hooks/inject-session-bootstrap.sh` (CC UserPromptSubmit hook; maintainer-environment only); `.claude/hooks/deps-hash-check.sh` (CC-native, internal dev tooling).

**May deviate when:** the tooling is explicitly designed for replication by consumer-maintained companion projects (e.g., a hook template published as part of `install.sh` payload). In that case treat as Consumer-facing.

### Consumer-facing — default: dual (CC-native primary + portable fallback)

Consumer-facing means: shipped to consumer projects via `install.sh`, or consumed by an active AI session in a consumer's harness.

**Default:** ship CC-native primary for CC consumers; ship portable markdown fallback for non-CC consumers. Both reference the same SSOT spec (§7).

**Examples:** `agents/compliance-verifier.md` (portable markdown read by any AI session); `agents/living-docs-auditor.md` (same); `.claude/skills/pipeline/` + `.claude/skills/dispatcher/` (orchestration skills — **test-proven portable-with-graceful-degradation**, NOT CC-only: helpers self-resolve via `$(dirname "${BASH_SOURCE[0]}")`, a `CC-absent degradation` path is shipped, and `packages/core/principles/21-agnosticism-conformance.test.ts` enforces it). When a CC hook is added to complement one of these agents, the pair is dual-channel.

**May deviate when:** consumer-base is provably CC-only by current usage data AND the capability is not semantically meaningful outside CC (e.g., a PostToolUse hook providing real-time edit feedback has no portable equivalent that would fire at the same moment).

> **Posture reconciliation (agnosticism-remediation T-D, 2026-06-16, #577).** The Umbrella-1 conformance audit (#564) + principle 21 **proved** the orchestration skills (`pipeline`/`dispatcher`) reach **functional parity** off-CC — substrate is test-proven portable, the workflow is preserved even when invoked differently (slash-command sugar may differ). This rule therefore does **NOT** accept «orchestration is CC-only»; the achieved bar is portable-with-graceful-degradation. The one residual off-CC degradation — the dispatcher's autonomous technical-fork resolution becomes surface-to-operator (`dispatcher/SKILL.md` `CC-absent degradation`) — is **accepted by design** under functional parity (workflow continues; one autonomy step is manual): a documented degradation, NOT a portability gap. **Not a goal change** — the implementation already meets the higher bar.

### Performance-critical — default: CC-native first; portable optional

Performance-critical means: must fire at edit-time or on every tool invocation; latency matters.

**Default:** CC-native is the primary; portable fallback is optional but encouraged when the semantic content is useful in async review mode.

**Examples:** `.claude/hooks/check-doc-authority.sh` (PostToolUse, fires per edit); `.claude/hooks/validate-prompt.sh` (similar). A portable audit equivalent could be an `agents/doc-authority-auditor.md` read during session review, but the edit-time gate is CC-native only — no portable hook fires at the same moment.

**May deviate when:** the «performance-critical» classification was over-applied and the check tolerates pre-push or session-start timing.

### Deviation accountability (applies to all three categories)

Each «may deviate when» exit requires a documented rationale in the artefact header, parallel to §6:

```bash
# @deviation-rationale: <§3 category default> — <specific condition justifying deviation>
```

Examples: `# @deviation-rationale: Consumer-facing default dual — consumer base provably CC-only per <metric or doc reference>`; `# @deviation-rationale: Performance-critical default CC-native — check tolerates pre-push timing per <evidence>`. Undocumented deviation = §8 `#cc-only-without-rationale` (and its symmetric counterpart for portable-only choices when CC-native would have been the default). The B+ soft posture preserves judgment freedom; the marker preserves audit trail.

---

## §4 — Detection mechanism: capability-check, not brand-name

When runtime code must detect whether a CC-native primitive is available, use **capability checks** (env var presence, settings.json key, hook event name existence) — not brand-name string matching.

```bash
# BAD — brand-name detection; breaks on compatible harnesses or renames
if [[ "$AI_HARNESS" == "claude" ]]; then ...

# GOOD — capability check; survives renames and cross-harness compatibility
if [[ -n "$CLAUDE_CODE_HOOKS_ENABLED" ]] || \
   jq -e '.hooks.UserPromptSubmit' .claude/settings.json &>/dev/null 2>&1; then ...
```

Brand-name detection fails on: (a) CC renames an identifier; (b) a compatible harness uses a different self-identifier; (c) silent migration to a new env convention.

---

## §5 — Drift check between channels (deterministic, no LLM)

When a feature ships in two channels, both artefacts must reference the **same SSOT anchor** (SSOT entry ID, principle slot, or rule slug) in their preambles. The anchor is the binding shared specification.

**Annotation convention (channel-specific syntax for the same anchor):**

- **Bash scripts** (CC hooks under `.claude/hooks/`): `# @dual-pair: <anchor>` (shell comment).
- **Markdown agents/skills** (under `agents/`, `.claude/skills/`): `<!-- @dual-pair: <anchor> -->` (HTML comment — markdown has no `#` comment syntax; `#` is a heading).
- **TypeScript principles / shipped code:** `// @dual-pair: <anchor>` (line comment).

The mechanical check matches on the literal substring `@dual-pair: <anchor>` regardless of surrounding comment syntax — `grep` doesn't care about the host language.

**Mechanical check sketch (≤20 LOC; runnable):**

```bash
# Each CC hook that is part of a dual-pair declares: # @dual-pair: <anchor>
# Its portable counterpart (agent or skill) declares the same anchor in
# that file's comment syntax (HTML comment for markdown, // for TS, # for bash).
# This check surfaces pairs where the portable side is missing or mismatched.
grep -rl '@dual-pair:' .claude/hooks/ 2>/dev/null | while read hook; do
  anchor=$(grep '@dual-pair:' "$hook" | sed -E 's/.*@dual-pair:[[:space:]]*//;s/[[:space:]]*-->.*$//')
  match=$(grep -rl "@dual-pair:[[:space:]]*$anchor" agents/ .claude/skills/ 2>/dev/null | head -1)
  if [ -z "$match" ]; then
    echo "DRIFT: $hook declares dual-pair '$anchor' — no portable counterpart found"
  fi
done
```

This check now runs in **CI** as [tests/agnosticism/probes/channel-coverage.sh](../../tests/agnosticism/probes/channel-coverage.sh) (Surface 8 of principle 21) — population-wide and off-CC — complementing the edit-time gate [.claude/hooks/check-hook-marker.sh](../hooks/check-hook-marker.sh). (Was a reviewer-session step until 2026-07-02; see §9.)

---

## §6 — «CC лучший» bias mitigation

Every CC-native artefact that ships **without** a portable fallback must carry a single-line rationale marker in its header:

```bash
# @cc-only-rationale: <reason>
```

Acceptable reasons: «edit-time PostToolUse enforcement — no portable hook fires at this moment»; «internal orchestrator script, not consumer-shipping path». Unacceptable: «CC is best», «we prefer CC», silence.

**Mechanical check sketch (≤20 LOC; runnable):**

```bash
# Every .claude/hooks/*.sh must have either @dual-pair or @cc-only-rationale
for h in .claude/hooks/*.sh; do
  has_marker=$(grep -E '^# @(dual-pair|cc-only-rationale):' "$h")
  if [ -z "$has_marker" ]; then
    echo "MISSING marker: $h — add @dual-pair or @cc-only-rationale"
  fi
done
```

---

## §7 — Single source of truth: one logic, two channels

When a feature ships dual, the two artefacts derive from **one canonical spec** — not two independent documents.

- **Rule + principle test pair:** the `.md` rule is the SSOT for human-readable discipline; the `.test.ts` is mechanical enforcement. Both carry the same rule slug in their headers.
- **CC hook + portable agent pair:** the portable agent's markdown is the authoritative human-readable spec. The CC hook is a mechanical implementation of the same check. The hook header carries `# spec: agents/<name>.md`.

Never maintain two independent prompts describing «the same thing» separately. When one is updated the other should be derivable. Drift between them is `#two-prompts-drift` (§8).

---

## §8 — Anti-patterns

**`#two-prompts-drift`** — two artefacts for the «same» capability diverge by ≥3 substantive lines (excluding boilerplate, comments, path references). Falsification: `diff -u agent.md hook-spec-comment.md | grep '^[+-]' | grep -v '^[+-][+-][+-]'` shows >3 non-boilerplate differences. Counter: extract the canonical spec to one SSOT file; the other channel is a thin pointer.

**`#brand-name-detection`** — code branches on a brand string (`"claude"`, `"cc"`, `ANTHROPIC`) in runtime logic. Falsification: `grep -rn '"claude"\|"cc"\|ANTHROPIC' .claude/hooks/` finds conditional branches (not comments or doc strings). Counter: capability-check per §4.

**`#cc-only-without-rationale`** — a CC-native hook ships without `@cc-only-rationale` or `@dual-pair` marker. Falsification: §6 grep finds hooks lacking both markers. Counter: add the marker at ship time; retroactive addition is acceptable if done in the same PR.

**`#dual-when-internal-only`** — portable + CC-native versions both shipped for tooling classified as internal-only per §3 (e.g., orchestrator prompt files, retro docs). Falsification: §3 triage sweep identifies artefact as «internal» but both channels exist. Counter: collapse to CC-native; record rationale per §6.

**`#sync-by-copy-paste`** — two channel artefacts share semantic text via manual copy rather than a SSOT pointer. Falsification (reviewer-time, not mechanical CI): when two artefacts in a `@dual-pair` share ≥5 consecutive non-boilerplate lines verbatim AND neither carries a `# spec: <path>` (or `<!-- spec-of: <path> -->`) cross-reference, the pair is sync-by-copy. Counter: extract shared spec; one channel becomes the SSOT, the other points to it via `spec:` marker. This is the enforcement-side of §7. Reviewer-time grep sketch:

```bash
# For each @dual-pair, surface candidates lacking spec-of marker
grep -rl '@dual-pair:' .claude/hooks/ agents/ .claude/skills/ 2>/dev/null | while read f; do
  grep -qE '(spec:|spec-of:)' "$f" || echo "SYNC-RISK: $f has @dual-pair but no spec-of pointer"
done
```

**`#capability-check-by-version`** — code gates on a specific Claude Code version string (`>= 2.1.98`) rather than feature presence. Falsification: `grep -rn 'version.*[0-9]\.[0-9]' .claude/hooks/` finds version-string conditionals. Counter: gate on the specific env var or settings key the feature introduces, not version.

---

## §9 — Promotion / retirement

**Definition for promotion counting:** a «dual-channel artefact» for §9 purposes is a CC hook file carrying `@dual-pair: <anchor>` paired with a markdown agent or skill carrying the same anchor in its file-appropriate comment syntax (§5). **Rule + principle-test pairings** (e.g., `.claude/rules/doc-authority-hierarchy.md` + `packages/core/principles/09-doc-authority-hierarchy.test.ts`) follow §7's SSOT pattern but are **NOT** counted toward this threshold — they predate the rule, share a different lifecycle (test enforces the rule, rather than two channels enforcing the same semantic check), and are not the target surface of §5/§6 mechanical checks.

**Promotion — LANDED (2026-07-02), ahead of the thresholds below.** The §5 + §6 mechanical sketches shipped as [tests/agnosticism/probes/channel-coverage.sh](../../tests/agnosticism/probes/channel-coverage.sh) — a Surface-8 probe of principle 21 (**REUSE** of the existing agnosticism harness rather than a dedicated `packages/core/principles/<N>-dual-implementation.test.ts` slot; the probe is a bash artefact under `tests/`, not a capability commit → no new principle slot consumed). It enforces §5 (anchor resolves to a real counterpart) + §6 (marker present) across the whole CC-hook population, off-CC, with a seeded-break paired-negative in `harness-self.test.sh`.

The original triggers that *would* have fired this promotion — 3 `#two-prompts-drift`/`#cc-only-without-rationale` violations in a 6-month window, OR the 5th dual-channel artefact — are now moot for §5/§6. A dedicated TypeScript principle slot stays unneeded unless drift complexity outgrows the bash probe (then: promote the §5/§6 sketches to TS at the lowest-free slot, extensible to AST inspection). The §8 *semantic* anti-patterns are NOT covered by the probe and retain the violation-count trigger above for their own future mechanisation.

**Retirement:** if 12 consecutive months pass with zero dual-channel features shipped AND zero anti-pattern incidents, archive to prose under `CLAUDE.md ## Delivery channel choices` and delete this file. Matches peer-rule retirement criteria in reviewer-discipline.md and parallel-subwave-isolation.md.

### Current state at codification (2026-05-17)

Zero dual-channel feature pairs exist today. The 4 existing `.claude/hooks/*.sh` and 4 `agents/*.md` files predate this rule and currently lack `@dual-pair` / `@cc-only-rationale` markers. **The annotation protocol is forward-going:** existing artefacts receive markers at next touch (refactor, bug fix, semantic update) — NOT via a retroactive sweep in the same PR as this rule. Maintainer may choose to batch-annotate as a separate atomic commit; this is permitted, not required.

At codification (2026-05-17) the §6 grep reported 4 «MISSING marker» findings (`check-doc-authority.sh`, `deps-hash-check.sh`, `inject-session-bootstrap.sh`, `validate-prompt.sh`) — the expected forward-going starting state, not a violation.

**Update (2026-07-02).** All four now carry markers: `deps-hash-check.sh` gained `@dual-pair: deps-hash-check-dogfood`; the other three gained `@cc-only-rationale` when the Surface-8 probe shipped. The channel-coverage probe reports **zero** non-PORTABLE across the full CC-hook population (tracked `.claude/hooks/**` ∪ settings-wired scripts). §6 marker discipline is now CI-enforced, not forward-going-only.

---

## §10 — See also

- [build-first-reuse-default.md](build-first-reuse-default.md) — orthogonal rule (adopt-vs-build, not delivery channel); §3 triage applies only after BFR-default verdict is BUILD or ADAPT
- [phase-research-coverage.md §1.7](phase-research-coverage.md) — self-reflexive forward/backward trigger this rule walks itself through
- [doc-authority-hierarchy.md](doc-authority-hierarchy.md) — header format precedent
- [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) — hard constraint on §5 drift check (must be deterministic grep/diff, not LLM)
- [ai-laziness-traps.md §2 T16](ai-laziness-traps.md) — pattern-matching-on-name trap; relevant to §3 triage (classifying artefact by name similarity rather than actual delivery-channel problem class)
- SSOT #20 (CC hooks API, ADOPT) — adjacent precedent; CC hook as primary channel
- SSOT #21 (cross-editor parity, WATCHLIST) — Decision 4 (2026-05-11) chose CC-native primary; this rule provides the audit trail that decision lacked
- SSOT #43 (RuntimeAdapter, ADOPT VOCABULARY) — vocabulary precedent for channel abstraction terminology
