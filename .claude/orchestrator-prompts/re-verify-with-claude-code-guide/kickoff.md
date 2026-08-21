# Re-verify 4 GO Results via Claude-Code-Guide — KICKOFF

> **Status:** ARMED 2026-05-16. Created by Queue mode bootstrap orchestrator as Artefact B.
> **Type:** KICKOFF FILE — instruction document for a FUTURE session to execute. This file does NOT perform the re-verification. The future session that reads this file performs the actual cross-verification.
> **Mode:** Queue mode (Worker + Reviewer), Opus everywhere, burn-mode authorized.
> **Estimated effort:** 2-4 hours wall-clock single session; 0-1 reviewer iterations expected.
> **Output shape:** 1 research-patch at `docs/meta-factory/research-patches/2026-MM-DD-claude-code-guide-cross-verification.md`.
> **Parent context:** `.claude/orchestrator-prompts/queue-mode-bootstrap/state.md` — see History for dispatch record.

> **Authoritative for:** re-verification methodology for the 4 parent-session GO outputs; acceptance criteria for the cross-verification research-patch; T-AO-K dual-channel mandate applied retroactively.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). NOT authoritative for Queue mode workflow — see Artefact A skill at `~/.claude/skills/orchestrator/references/queue-mode.md` once created.

---

## §0 How to use this kickoff (read FIRST)

You are a **Worker subagent** dispatched by a Queue mode Orchestrator. Read this file end-to-end before any action. Then execute §4 Methodology in order, writing the research-patch incrementally as you go.

**What you are NOT doing:**
- You are NOT overwriting or editing any parent research-patch.
- You are NOT making architecture decisions (D1-D4 are for the maintainer).
- You are NOT running the re-verification inside this kickoff-writing session. That was this file's author's job to describe; yours is to execute it.
- You are NOT dispatching nested Workers — you ARE the Worker.

**Read order:**
1. This file end-to-end.
2. §3 Hard constraints (mandatory before touching any file).
3. §2 Step-0 mandatory reads.
4. Peek at each parent patch (wc -l + first 30 lines) — §4.1 claim inventory starts from there.
5. Begin §4.2 per-claim verification, writing the output research-patch incrementally.

---

## §1 Problem this session solves

The parent session (autonomous-research-orchestrator, completed 2026-05-16) produced 4 GO outputs:
- 3 research-patches (research-tooling-evaluation, §13.33 hook-architecture, §1.7 think-time-gate)
- 1 SSOT-corrections commit on branch `docs/aif-ssot-corrections` @ `828e31c`

All 4 were reviewed via DeepWiki + context7 only. **No `claude-code-guide` subagent was used for any Claude-Code-specific claim.** This is the single-channel verification gap that T-AO-K (a new trap surfaced 2026-05-16) exists to prevent.

**The specific incident:** Reviewer #4 iter 0 caught an Elicitation hook mischaracterization in parent patch #4 (think-time-§17-gate) via a DeepWiki query alone. The HARD-FIX was correct — DeepWiki happened to be right. But the verification chain was single-channel. If DeepWiki had been wrong (or had hallucinated a hook event name), the error would have propagated into the GO'd patch unchallenged. The structural gap is: **for Claude Code internals (hook events, MCP contracts, settings, harness behavior), the authoritative first channel is the official Claude Code documentation** — reachable via `subagent_type: claude-code-guide` which can WebFetch from `docs.claude.com` — not a third-party documentation aggregator.

**This session's job:** apply the T-AO-K dual-channel mandate retroactively to all 4 parent outputs. Identify Claude-Code-specific claims, verify each via `claude-code-guide` first + DeepWiki second, and produce a single research-patch documenting findings (AFIRMs, FLAGs, REVISION-NOTEs).

---

## §2 Step-0 mandatory reads

Per [.claude/session-bootstrap.md](../../session-bootstrap.md) Step 0 reading order — cite invariants inline when dispatching any sub-tool:

1. **[README.md#why-this-exists](../../../README.md#why-this-exists)** — project goal: AI agents can't silently bypass undocumented conventions — every codified rule fails CI on violation. Three invariants: (1) build-vs-reuse SSOT consult before capability commit; (2) recursive self-application green; (3) search-coverage 6-item checklist on negative-existence claims.

2. **[CLAUDE.md](../../../CLAUDE.md)** — Artifact Ownership Contract. Critical for this session: parent patches are **read-only** (owned by maintainer session that committed them). You may NOT edit them. Your output is a NEW research-patch.

3. **[.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md)** — T1-T16 canonical catalogue + obligations on kickoff authors (§3). Active traps for this session: enumerated in §6 below.

4. **[.claude/rules/no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)** — no API-billed LLM in CI. This session runs in an active Claude Code subscription session — permitted. No CI gate may call the API as a consequence of this research-patch.

5. **[.claude/rules/doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md)** — your output research-patch must include an `Authoritative-for` header per §2-§3 of that rule.

6. **Parent patches (read for claim inventory — §4.1):**
   - `docs/meta-factory/research-patches/2026-05-16-research-tooling-evaluation.md` (387 lines)
   - `docs/meta-factory/research-patches/2026-05-16-§13.33-hook-architecture-research.md` (786 lines)
   - `docs/meta-factory/research-patches/2026-05-16-§17-think-time-gate.md` (470 lines)
   - `docs/aif-ssot-corrections` branch commit `828e31c` — read `docs/meta-factory/prior-art-evaluations.md` on that commit via `git show 828e31c:docs/meta-factory/prior-art-evaluations.md`

7. **Parent state.md** — `.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md` — especially the REVIEW-COMPLETE #4 iter 0 entry recording the Elicitation hook HARD-FIX. This is the empirical anchor for T-AO-K.

8. **Queue mode Artefact A references** (once created by prior queue step): `~/.claude/skills/orchestrator/references/ai-laziness-traps-orchestrator.md` — for T-AO-K full description. If not yet created, use meta-kickoff §8 T-AO-K definition directly.

---

## §3 Hard constraints

1. **Read-only on all parent patches.** Do NOT edit `docs/meta-factory/research-patches/2026-05-16-*.md`. Your output is a NEW research-patch with findings only.

2. **Read-only on commit `828e31c`.** Inspect via `git show` commands; do NOT checkout or cherry-pick. Do NOT modify `docs/meta-factory/prior-art-evaluations.md`.

3. **Flag, do NOT decide.** When you find a discrepancy between parent patch claims and CC docs — flag it for the maintainer. Do NOT retroactively amend the parent patch. Use REVISION-NOTE format (defined in §4.6) when the underlying recommendation is still valid despite a claim being imprecise.

4. **T16 problem-class check is mandatory for every "native CC feature could replace X" finding.** Per T16: verify that the native CC feature solves the SAME problem class as the parent patch's proposed solution. Name-matching is not evidence. Upstream problem class vs this project's problem class must be stated explicitly.

5. **Output annotation required.** First line of the research-patch MUST be `<!-- scope:claude-code-guide-cross-verification -->`. This is enforced by `packages/core/principles/10-research-patch-annotation.test.ts`.

6. **No paid LLM in CI.** Any finding that proposes an automated follow-on check must be deterministic or subscription-bundled. If `claude-code-guide` is used in the verification session (active subscription) — permitted. If proposed as a CI gate step — rejected per policy.

7. **Authoritative-for header required.** Per `.claude/rules/doc-authority-hierarchy.md §2-§3`, the research-patch must include an `Authoritative-for` block after the title.

8. **Principles tests mandatory before RESEARCH-COMPLETE.** Run `npm run test:principles` (from `/Users/art/code/rules-as-tests-aif/`) as the final step before reporting RESEARCH-COMPLETE. Log the green run in state.md. Do NOT report RESEARCH-COMPLETE if any test fails.

---

## §4 Methodology

### §4.1 Patch-by-patch claim weight classification

Before enumerating individual claims, confirm patch scope via `wc -l` + `head -30` per patch. Then classify each patch's CC-claim weight:

| # | Patch | Line count | Weight | Rationale |
|---|-------|-----------|--------|-----------|
| 1 | research-tooling-evaluation | 387 | **LIGHT** | Primarily DeepWiki vs context7 comparison; few CC-specific internals claims; no hook events or MCP contract assertions |
| 3 | §13.33 hook-architecture | 786 | **HEAVY** | References Husky integration with CC hooks; mentions specific shell hook events; discusses Stryker-in-CI (not CC-specific but testable); discusses TypeScript hook runner options in CC context |
| 4 | §1.7 think-time-gate | 470 | **CRITICAL** | Entire patch concerns Claude Code hook events; hook H1 (Stop), H10 (verdict-as-tool-call MCP), W1 bundle; iter 0 had documented HARD-FIX on Elicitation hook mischaracterization — even post-fix claims warrant dual-channel re-verification |
| 5 | aif-ssot-corrections (828e31c) | varies | **LIGHT** | SSOT register updates; entries #27-#30 corrections and #42-#46 new entries; content is about AIF tool decisions, not CC internals |

**Weight definitions for this session:**
- **LIGHT:** ≤5 CC-specific claims. Sample all; verify all. Low verification cost.
- **HEAVY:** 6-20 CC-specific claims. Enumerate ALL; verify ALL (T1 sampling floor — no skipping for HEAVY).
- **CRITICAL:** >20 CC-specific claims OR claims about hook event behavior that was already HARD-FIX'd once. Enumerate ALL; verify ALL; run adversarial counter-prompt after each group of 5 (T7).

### §4.2 Per-claim verification via claude-code-guide (first channel)

For each CC-specific claim identified in §4.1:

1. **Formulate a specific question** — not «is this correct?» but «per official CC docs, what is the exact behavior of [hook/feature/event]? What events fire and in what order?»

2. **Dispatch `claude-code-guide` subagent** with that question. The subagent has tools: Bash, Read, WebFetch, WebSearch. Direct it to:
   - WebFetch the relevant `docs.claude.com` page
   - Return the verbatim relevant excerpt plus the URL
   - Return any version caveat if the feature is version-specific

3. **Continuity rule (T-AO-K counter, send-message pattern):** per Anthropic's agent docstring guidance — «check if there is already a running or recently completed claude-code-guide agent that you can continue via SendMessage». Reuse the same claude-code-guide instance for multiple questions within the same patch's claim group. Spawn a fresh instance only when switching to a different patch or when the prior instance's context is exhausted. This saves quota and preserves context across a patch's full claim set.

4. **Record in output research-patch:** claim text (verbatim quote from parent patch, with line number), CC docs excerpt, URL, and preliminary verdict (AFFIRM / FLAG / REVISION-NOTE).

**Example question pattern for hook events (patch #4 / CRITICAL):**
```
Per official Claude Code docs (docs.claude.com), what hook events are available in Claude Code settings.json hooks configuration? Specifically: does a "Stop" hook event exist? Does "UserPromptSubmit" exist? Was "Elicitation" ever a valid hook event name, and if so, is it still valid? Please WebFetch the current hooks documentation page and return the verbatim hook event list with the source URL.
```

### §4.3 Cross-check with DeepWiki (second channel)

After claude-code-guide returns for each claim group, cross-check with DeepWiki:

```
ask_question repo="anthropics/claude-code" question="<same question as §4.2>"
```

Record DeepWiki's answer alongside claude-code-guide's. If they agree → higher confidence in AFFIRM. If they diverge → FLAG regardless of which source "seems more authoritative" (divergence itself is the finding).

**Divergence handling:**
- Minor wording difference with same factual content → AFFIRM with note
- Factual difference (e.g. one says event exists, other says it doesn't) → FLAG (D3 applies — default is 2/2 agreement for AFFIRM)
- Both say claim is wrong → FLAG + parent-patch error confirmed

### §4.4 Divergence protocol

When claude-code-guide and DeepWiki diverge on a factual claim:

1. Document the exact divergence (channel A says X, channel B says Y).
2. Attempt one resolution step: WebFetch the specific `docs.claude.com` URL that channel A cited, confirm the text is actually there (not a hallucination).
3. If confirmed via direct WebFetch → AFFIRM the WebFetch-confirmed channel; note DeepWiki divergence.
4. If WebFetch fails or contradicts both channels → FLAG as "unresolvable at this time — maintainer-decision D3".
5. Never silently pick one channel over the other without the WebFetch confirmation step.

### §4.5 Native Claude Code feature scan

For each native CC capability surfaced in §4.2-§4.3 verification, ask: **does this capability overlap with (or could replace) what any parent patch proposed?**

Mandatory checks (non-exhaustive — Worker must extend per actual verification findings):

- **Hook events scope:** does CC's hook system have a native verdict-gate primitive, or is H10 (verdict-as-tool-call MCP) the correct architectural choice? (parent patch #4 proposed H10 — verify if there's a simpler native path)
- **Stop hook behavior:** does the Stop hook in CC's harness actually fire in the temporal gap described by patch #4 (pre-commit, in-dialogue)? Or is it post-interaction? This determines whether H1 addresses the gap at all.
- **MCP subagent patterns:** does CC's native MCP server pattern support the W1 bundle approach proposed in patch #4? Any CC-native constraints that would make W1 harder or easier than patch #4 assumed?
- **claude-code-guide itself:** is `subagent_type: claude-code-guide` a stable published API or an internal-only feature? What's its documented scope? Does it support the continuity pattern described in §4.2 step 3?
- **Hook runner alternatives:** patch #3 discusses custom TypeScript hook runner (D6). Does CC itself provide any hook runner abstraction that would make D6's OWN-BUILD recommendation premature?

**For each overlap found — T16 check is mandatory:**
- State upstream CC feature's problem class explicitly.
- State parent patch's problem class explicitly.
- Assess match: SAME-CLASS (native CC feature IS a drop-in), ADJACENT-CLASS (native CC feature handles overlapping but not identical problem — note the difference), DIFFERENT-CLASS (name suggests overlap but function does not match — flag as #pattern-matching-on-name per T16).
- Only SAME-CLASS findings warrant a "native CC feature could replace parent's proposed solution" recommendation.

**Project AI-agnostic posture note (D2):** even if a native CC feature is SAME-CLASS with a parent proposal, the project's design is AI-agnostic (rules work for Claude Code AND other AI harnesses). SAME-CLASS finding → surface as D2 item for maintainer. Worker does NOT decide to adopt the CC-specific path.

### §4.6 Per-patch verdict

After completing §4.2-§4.5 for each patch, produce a per-patch summary verdict:

- **AFFIRM:** both channels agree the claim is correct. No action needed on parent patch.
- **FLAG:** channels disagree, or both channels say the parent claim is wrong. Maintainer must decide (D1): issue revision-patch on original, or note only in this cross-verification patch.
- **REVISION-NOTE:** claim was imprecise or partially wrong, but the underlying recommendation still holds. Parent patch's conclusion is sound; the evidence it cited was off. Note the correction; no revision-patch required unless maintainer prefers.

Per-patch verdict table format (include in output §5 of research-patch):

```markdown
| Patch | CC-claims verified | AFFIRM | FLAG | REVISION-NOTE | Overall verdict |
|-------|-------------------|--------|------|---------------|-----------------|
| #1 research-tooling | N | n | n | n | [AFFIRM / FLAG / REVISION-NOTE] |
| #3 hook-architecture | N | n | n | n | [AFFIRM / FLAG / REVISION-NOTE] |
| #4 think-time-gate | N | n | n | n | [AFFIRM / FLAG / REVISION-NOTE] |
| #5 SSOT-corrections | N | n | n | n | [AFFIRM / FLAG / REVISION-NOTE] |
```

---

## §5 Output requirements

### §5.1 File location

```
docs/meta-factory/research-patches/2026-MM-DD-claude-code-guide-cross-verification.md
```

Replace `MM-DD` with today's date at time of execution.

### §5.2 Required structure

```markdown
<!-- scope:claude-code-guide-cross-verification -->
# Claude-Code-Guide Cross-Verification — research patch

> **Authoritative for:** dual-channel re-verification findings for 4 parent-session GO outputs (2026-05-16 autonomous research run); per-claim AFFIRM/FLAG/REVISION-NOTE verdicts; D1-D4 open decisions for maintainer.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). NOT authoritative for the original parent patches — those remain unchanged at their original paths.

## §1 Scope + context
## §2 Method summary (dual-channel protocol)
## §3 Patch #1 — research-tooling-evaluation (LIGHT)
## §4 Patch #3 — §13.33 hook-architecture (HEAVY)
## §5 Patch #4 — §1.7 think-time-gate (CRITICAL)
## §6 Patch #5 — aif-ssot-corrections commit 828e31c (LIGHT)
## §7 Native CC feature scan summary (§4.5 results)
## §8 Per-patch verdict table
## §9 Open decisions for maintainer (D1-D4)
## §10 Self-application (§8 mandate)
## §11 See also
```

### §5.3 Content requirements per section

- **§3/§4/§5/§6 (per-patch sections):** include full claim-by-claim table: claim text (with parent-patch line number), claude-code-guide finding (URL + excerpt), DeepWiki finding (brief), verdict per claim.
- **§7:** native CC feature scan — for each overlap found, include T16 problem-class check with both classes named.
- **§8:** verdict table per §4.6 format. Must be substantive (actual counts, not "N/A").
- **§9:** D1-D4 items pre-populated in this kickoff; add any additional Dn items surfaced during verification.
- **§10:** self-application section (see §8 of this kickoff for mandate).

### §5.4 Incremental write discipline

Write each section (§3, §4, §5, §6, §7, §8, §9, §10, §11) to the file as completed — do NOT accumulate in memory and dump at end (T-AO-C counter). After each section, append one-line summary to state.md History:

```
- <ISO-timestamp> — re-verify §<N> complete: <patch-id> — <N-claims> claims, <n-affirm> AFFIRM, <n-flag> FLAG, <n-revision> REVISION-NOTE
```

**Final step before RESEARCH-COMPLETE:** run `cd /Users/art/code/rules-as-tests-aif && npm run test:principles`. If any test fails, fix the violation (likely `<!-- scope:... -->` annotation missing or malformed) and re-run. Log green run: `- <ISO-timestamp> — principles tests green (N tests passed)`.

---

## §6 AI laziness traps active

Per `.claude/rules/ai-laziness-traps.md §3`, kickoff authors must enumerate active T-numbers. Enumerated below — justification per trap.

**Canonical traps:**

- **T1 (sampling floor):** HEAVY and CRITICAL patches require ALL claims verified, not a sample. Sampling floor = 5 per category minimum; for CRITICAL patch #4, floor = ALL claims (no exceptions). If the first 5 look clean, that is a sampling artifact — continue.

- **T3 (every claim cites source):** each claim entry in the output research-patch must record: (a) parent patch line number, (b) claude-code-guide response URL + verbatim excerpt, (c) DeepWiki response summary. Prose-only findings are insufficient.

- **T7 (adversarial counter-prompt):** after completing claim inventory for HEAVY and CRITICAL patches, ask explicitly: «what Claude Code capability did I fail to check? What hook event or MCP feature is used in this patch that I have not yet verified?» Run this as a literal self-prompt and record the answer in the output §10 self-application section.

- **T11 (build-vs-reuse before claiming native CC replaces proposal):** for each SAME-CLASS native CC feature finding in §4.5 — consult the SSOT (`docs/meta-factory/prior-art-evaluations.md`) for any existing entry covering that feature before proposing the parent patch's solution is wrong.

- **T13 (ADOPTED-MECHANISM problem-class check):** native Claude Code features are ADOPTED-MECHANISM by definition. Upstream problem class must be stated for each. Don't assume because the CC docs describe «verdict gate primitive» that it is designed for the §1.7 temporal gap problem.

- **T15 (self-application):** this verification session itself makes CC-specific claims (e.g. about claude-code-guide subagent, about SendMessage continuity). Those claims must ALSO be dual-channel verified (§8 self-application mandate). Not opt-in.

- **T16 (problem-class match):** for every §4.5 native CC feature overlap — state upstream problem class and this project's problem class explicitly. Overlap in name does not imply overlap in problem class.

**T-AO additions:**

- **T-AO-C (file-write delay):** do NOT accumulate the research-patch in memory across all patches and write at the end. Write each §N section as completed. Context exhaustion risk is highest for CRITICAL patch #4 (470 lines to read + multiple claude-code-guide queries).

- **T-AO-K (NEW — single-channel verification, reflexively applies HERE):** this session's purpose is to APPLY dual-channel discipline. If in the course of verifying patch claims you use only one channel (e.g. only DeepWiki, or only claude-code-guide) — that IS the trap. Both channels are mandatory for every CC-specific claim in HEAVY and CRITICAL patches. For LIGHT patches, both channels are strongly recommended; single-channel permitted only with explicit justification logged in state.md. **This trap applies reflexively to your own claims:** any statement in the output research-patch about what CC docs say must itself be dual-channel sourced.

- **T-AO-L (principles tests unknown to Worker):** you may not know all project-local principle tests. Before reporting RESEARCH-COMPLETE, run `npm run test:principles` and fix any violations. Do NOT skip this step.

**Domain-specific trap (this session):**

- **T-Verify-A — treating iter-1-fixed claim as verified:** parent patch #4 had an Elicitation hook claim HARD-FIX'd in iter 1. The temptation is to treat the post-fix patch as «already verified by reviewer». Counter: the reviewer verified via DeepWiki alone (single-channel). The iter-1 fix itself is what needs dual-channel re-verification in this session. Do not skip §5 (CRITICAL patch) on the grounds that «the reviewer already caught the error».

---

## §7 Open decisions (Dn) for maintainer

Worker surfaces these as RECOMMENDATION items in the output research-patch §9. Worker does NOT decide.

**D1 — Revision-patch policy:** if a parent patch's claim is confirmed wrong by dual-channel verification, should the project issue a revision-patch on the original patch, or is notation in this cross-verification research-patch sufficient? Options:
- Option A → note only in this cross-verification patch; parent patch stands as historical record with its original content; future readers consult this patch for corrections.
- Option B → issue an explicit revision-patch on the original (separate file, same mechanism as parent patch, REVISION header). More visible; adds doc surface. Downstream: consequence Y = accumulates per-correction patch files.

**D2 — AI-agnostic posture vs CC-native optimizations:** if §4.5 finds that a native CC feature is SAME-CLASS with a parent patch's proposed solution — does the project's AI-agnostic design posture prevent adopting the CC-native path? Options:
- Option A → strict AI-agnostic: CC-native features are never adopted even when SAME-CLASS; project stays portable across AI harnesses.
- Option B → pragmatic: when Claude Code is the active runtime and a native feature is demonstrably better (simpler, more reliable, no extra dep), adopt it with an explicit compatibility note (e.g. «CC-native §1.7 gate; fallback: Husky pre-push for non-CC runtimes»).
- Option C → case-by-case: maintainer decides per finding; no blanket policy.

**D3 — Confidence threshold for AFFIRM:** default in this session is 2/2 channel agreement = AFFIRM. Is 2/2 the right threshold, or should single-channel (WebFetch-confirmed) be sufficient for AFFIRM when DeepWiki cannot find the answer? Options:
- Option A → strict 2/2: any single-channel result is FLAG regardless of WebFetch confirmation.
- Option B → pragmatic: WebFetch of official docs.claude.com URL is conclusive; DeepWiki used as supplement, not co-equal channel.

**D4 — Fallback if claude-code-guide subagent unavailable:** if the future session executing this kickoff does not have `subagent_type: claude-code-guide` available in the session system reminder — how should it proceed? Options:
- Option A → escalate immediately (per §6.3 ESCALATE:K:tool-unavailable); do NOT proceed with single-channel.
- Option B → fallback to WebFetch of docs.claude.com directly (same info, different routing; session performs WebFetch itself without subagent dispatch). Document the fallback in state.md.

---

## §8 Self-application

This kickoff describes a verification methodology. The kickoff's §4.2 and §4.3 themselves assert facts about how Claude Code works (e.g. "claude-code-guide subagent has tools: Bash, Read, WebFetch, WebSearch"; "SendMessage continuity pattern per Anthropic docstring"). These claims were authored by the kickoff-writing session and are themselves CC-specific claims.

**Mandate for the future Worker session executing this kickoff:** before closing §10 of the output research-patch, apply T15 self-application explicitly:

1. List all CC-specific claims made in THIS kickoff document (the one you are reading now) — especially §4.2 (subagent tools, continuity pattern) and §4.3 (DeepWiki ask_question syntax).

2. For each kickoff-document claim: record whether you verified it via claude-code-guide + DeepWiki during this session.

3. If any kickoff-document claim is wrong per your dual-channel verification — note it in §10 as REVISION-NOTE. Do NOT silently proceed with the incorrect kickoff claim.

**Why this matters:** if this kickoff's description of how to invoke claude-code-guide is wrong, the entire verification methodology is broken. The kickoff is load-bearing documentation. Per the project's thesis — documents lie; tests don't — the kickoff description of the verification method is itself verifiable and must be verified.

---

## §9 See also

- **Parent patches (READ-ONLY):**
  - `docs/meta-factory/research-patches/2026-05-16-research-tooling-evaluation.md` (387 lines, LIGHT)
  - `docs/meta-factory/research-patches/2026-05-16-§13.33-hook-architecture-research.md` (786 lines, HEAVY)
  - `docs/meta-factory/research-patches/2026-05-16-§17-think-time-gate.md` (470 lines, CRITICAL)
  - Commit `828e31c` on branch `docs/aif-ssot-corrections` (LIGHT)

- **Parent session state (empirical record of single-channel gap):**
  - `.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md` — REVIEW-COMPLETE #4 iter 0 entry records the Elicitation hook HARD-FIX caught via DeepWiki alone. This is the empirical anchor for T-AO-K.

- **T-AO-K definition:**
  - `~/.claude/skills/orchestrator/references/ai-laziness-traps-orchestrator.md` (once Artefact A is created) — T-AO-K entry
  - Alternatively: meta-kickoff at `.claude/orchestrator-prompts/queue-mode-bootstrap/kickoff.md §8 T-AO-K`

- **Discipline rules:**
  - `.claude/rules/ai-laziness-traps.md` — T1-T16 canonical catalogue; §3 kickoff-author obligations
  - `.claude/rules/no-paid-llm-in-ci.md` — applies to any automated follow-on check proposed in output
  - `.claude/rules/doc-authority-hierarchy.md` — output research-patch header format

- **Queue mode bootstrap state:**
  - `.claude/orchestrator-prompts/queue-mode-bootstrap/state.md` — update after each major step (per §5.4 incremental write discipline)

- **Relevant principle tests (run before RESEARCH-COMPLETE):**
  - `packages/core/principles/10-research-patch-annotation.test.ts` — `<!-- scope:... -->` annotation on first line
  - Other principles: enumerate via `ls packages/core/principles/*.test.ts` and read any test that might apply to the output type

---

## Acceptance criteria (for Reviewer to check)

- [ ] File exists at `docs/meta-factory/research-patches/2026-MM-DD-claude-code-guide-cross-verification.md`
- [ ] First line is exactly `<!-- scope:claude-code-guide-cross-verification -->`
- [ ] Authoritative-for header present (per doc-authority-hierarchy §3 format)
- [ ] §3/§4/§5/§6 each present with per-claim tables (not stubs); HEAVY patch #3 and CRITICAL patch #4 must have ALL claims enumerated (T1 sampling floor)
- [ ] §7 native CC feature scan present with T16 problem-class checks for each overlap found
- [ ] §8 per-patch verdict table present with actual counts
- [ ] §9 open decisions (D1-D4) present with both options described
- [ ] §10 self-application section present: kickoff's own CC claims verified via dual-channel
- [ ] T-AO-K present in §6 with reflexive "applies HERE" note
- [ ] T-AO-L present in §6 (principles tests run)
- [ ] T-Verify-A present in §6 (iter-1-fixed claim not treated as already verified)
- [ ] state.md updated with per-section History entries
- [ ] `npm run test:principles` ran green; logged in state.md
- [ ] No edits to parent patches; no edits to SSOT or project-scope files
- [ ] No PRs opened, no commits pushed

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
