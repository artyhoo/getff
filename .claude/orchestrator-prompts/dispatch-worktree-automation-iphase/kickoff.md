# Umbrella: `dispatch-worktree-automation-iphase` — implement R-phase verdict (ADOPT `claude -w` + ADAPT WorktreeCreate hook)

> **Status:** DRAFT planned 2026-05-29. **NOT yet dispatched.** Waits on PR #271 merge to staging. I-phase implements R-phase verdict from [PR #271 research-patch](../../../docs/meta-factory/research-patches/2026-05-29-dispatch-worktree-automation.md) — no design questions remain; this kickoff only specifies the implementation work.
>
> **Authoritative for:** I-phase implementation of the dispatch-worktree-automation R-phase verdict — (a) meta-orchestrator generation guidance changes (SKILL.md §3/§4/§5 + meta-kickoff.template.md §4 + placeholders.md) replacing 7-step paste-block emission with `claude -w <name>` single-command form; (b) new `.claude/hooks/worktree-setup.sh` hook adapting `tfriedel/claude-worktree-hooks` precedent for project-specific `node_modules` symlinks; (c) paired-negative test for hook; (d) recursive acceptance test (does the new pipeline reduce step count 7→2 in practice).
>
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The R-phase verdict itself — see [PR #271](https://github.com/Yhooi2/rules-as-tests-aif/pull/271) (verdict source-of-truth; I-phase implements it, doesn't re-litigate). VS Code-tab dispatch channel (ATTN 3 from PR #271 §8) — out of scope, future Sub-wave if becomes recurring pain.
>
> **Class:** N/A (kickoff doc, not a rule). Discipline-bearing artefact — full §1.7 self-reflexive check at §6 + §7.

---

## §0 One-line frame

R-phase verdict (PR #271): **ADOPT Candidate E (`claude -w <name>` native CLI flag, verified live in CC v2.1.143) + ADAPT Candidate D2 (`tfriedel/claude-worktree-hooks` precedent → `.claude/hooks/worktree-setup.sh` for node_modules symlinks).** Reduces maintainer step count 7→2 per parallel sub-wave dispatch. I-phase implements this verdict in three artefacts: (1) meta-orchestrator generation guidance update; (2) new hook; (3) paired-negative test + recursive acceptance test.

---

## §1 Origin

**Verdict source.** [PR #271 research-patch §6 Recommendation](../../../docs/meta-factory/research-patches/2026-05-29-dispatch-worktree-automation.md) — Mode A inline R-phase with full §1.7, Phase −1 cold-review GO, all 6 search-coverage items executed (SSOT, DeepWiki ×3, WebSearch ×3, BFR sweep, CC primitive verification 5a/5b/5c/5d via live `claude --help` probe + WebFetch of authoritative docs, repo probe). Confidence: high on E (native flag verified live), medium on D2 hook stdin schema (marked UNVERIFIED — I-phase Worker MUST probe live before finalising field-extraction; surfaced as ATTN 4 in patch §8).

**Precedent for hook.** `tfriedel/claude-worktree-hooks` (public GitHub) — community-maintained CC hooks for worktree lifecycle. Direct adapt target per PR #271 §3 Candidate D2 analysis. I-phase Worker MUST read the upstream repo (DeepWiki or direct clone, NOT WebSearch summary) before drafting the hook — T13 anti-pattern (treating ADOPTED items as zero-work).

**Predecessor.** Today (2026-05-29) maintainer surfaced 7-step ritual as recurring pain → 14-hour drift around SKILL.md row 3 vs `#worker-dispatch-via-subagent` anti-pattern (SKILL.md:344-348) (PR #265, closed superseded) → R-phase identified `claude -w` as native solution → this I-phase implements it.

---

## §2 Admission gates — DO NOT dispatch this I-phase until ALL hold

1. **PR #271 merged to staging.** CI green + auto-merge fired. Falsifier: `gh pr view 271 --json state --jq .state` returns «MERGED». R-phase research-patch is the verdict source-of-truth; can't ship I-phase against unmerged verdict.
2. **ATTN 1 + 2 from PR #271 §8 — DECIDED 2026-05-29 by maintainer.** ✅
   - **(1) Worktree path convention: ADOPT CC default `.claude/worktrees/<name>/`** per [PR #271 R-phase verdict §6](../../../docs/meta-factory/research-patches/2026-05-29-dispatch-worktree-automation.md) citing Superpowers `using-git-worktrees` SKILL.md:200-204 Red Flag #1 (verbatim: «Use `git worktree add` when you have a native worktree tool (e.g., `EnterWorktree`). This is the #1 mistake — if you have it, use it.») + this session's empirical evidence that fighting CC defaults cost 14 hours. Maintainer confirmed 2026-05-29: «ADOPT CC default … 'не воюй с harness'». ✓
   - **(2) Branch name convention: ADOPT CC default `worktree-<name>`** for the worktree's auto-branch + optional per-umbrella rename via `git branch -m worktree-<name> <type>/<umbrella>` (one-liner, scriptable). Maintainer confirmed 2026-05-29: «ADOPT CC default … worktree-<name>». ✓
3. **ATTN 3 + 4 from PR #271 §8 acknowledged (not blocking):**
   - ATTN 3 (VS Code-tab dispatch channel) — out of I-phase scope. Surface as future Sub-wave if becomes recurring. ✓
   - ATTN 4 (aif-handoff bridge Sub-wave B coordination) — already CLOSED per PR #271 §8 (Sub-wave B verdict REJECT landed pre-this-patch). ✓
4. **Phase −1 cold-review of THIS kickoff complete.** 1× Opus reviewer per orchestrator skill Phase −1 protocol. Reviewer verifies §1.7 forward+backward + §3 scope decomposition + §11 dispatch channel correctness.

If any of (1) (2-decided) (4) fails → kickoff stays parked.

---

## §3 Implementation scope decomposition (3 sub-waves, partial parallelism)

### Sub-wave A — Hook implementation (`.claude/hooks/worktree-setup.sh` + test) **[parallel-safe with Sub-wave B]**

**File targets:**
- `.claude/hooks/worktree-setup.sh` — new file, ~30-50 LOC bash. Adapts `tfriedel/claude-worktree-hooks` precedent. Triggers on CC hook event (SessionStart most likely — Worker MUST probe `code.claude.com/docs/en/hooks.md` for exact event list).
- `packages/core/hooks/worktree-setup.test.ts` — paired-negative test (positive: hook runs symlinks in worktree, negative: hook no-ops in primary workdir).
- `.claude/settings.json` — single entry to register hook. **Agent-uncommittable** per memory `feedback_settings_json_agent_uncommittable` — emit as HEREDOC diff in PR body for maintainer manual apply.

**Behaviour (live-probe-derived, NOT pre-specified):**
- On hook event fire: detect whether session cwd is in a worktree (`git rev-parse --git-dir` ≠ `git rev-parse --git-common-dir`).
- If worktree: ensure `node_modules` symlink to primary workdir's `node_modules` exists; ensure `packages/core/node_modules` symlink to `../../node_modules` exists. Idempotent (skip if links already point correctly).
- If primary workdir: no-op exit 0.
- Submodule guard (Superpowers `using-git-worktrees` Step 0): `git rev-parse --show-superproject-working-tree` returning a path → treat as primary, no-op.

**Branch-rename scope (out of hook scope):** hook does NOT rename branches. If ATTN 2 = «hook auto-renames», that requires a SEPARATE hook addition (PostToolUse or end-of-init). For this I-phase, branch-rename stays manual (`git branch -m worktree-<name> <type>/<umbrella>` one-liner) OR maintainer keeps CC default name. Hook scope = node_modules symlinks ONLY.

**Probe required (T7 + T20):**
- Hook event: SessionStart vs PreToolUse vs other. Read CC docs `hooks.md` live.
- Hook input JSON schema (ATTN 4 from PR #271 §8 — was UNVERIFIED at R-phase). Specifically: does hook receive `cwd` field? Does it receive worktree-path-of-current-session? Worker MUST run a 1-line probe hook that dumps `cat` of stdin to `/tmp/probe-hook-input.json` and trigger it, then read the actual schema.
- `tfriedel/claude-worktree-hooks` upstream — read full repo (DeepWiki `ask_question` ≥2 phrasings on hook event + JSON schema patterns) before drafting. T13 mandate.

**Dual-implementation discipline ([§3](../../../.claude/rules/dual-implementation-discipline.md)):** new hook is CC-native (no portable analog — node_modules symlinks are platform-specific). Carry `# @cc-only-rationale: SessionStart hook for project-specific worktree node_modules linking; no portable analog (other harnesses don't have worktree concept identical to CC).` per [§6](../../../.claude/rules/dual-implementation-discipline.md). No `@dual-pair` needed (no portable counterpart proposed).

**Acceptance:**
- Hook executes within 200ms (no synchronous network call, no model invocation).
- Paired-negative test passes (vitest).
- HEREDOC diff for `.claude/settings.json` in PR body specifies exact `hooks.SessionStart` entry to add.
- README or hook header documents the contract.

### Sub-wave B — meta-orchestrator generation guidance update **[parallel-safe with Sub-wave A]**

**File targets:**
- `.claude/skills/meta-orchestrator/SKILL.md` §3 + §4 + §5 — **CLASSIFIER-BLOCKED** per session 2026-05-29 incident (same path classifier-protected as self-modification). I-phase Worker MUST emit recipe-script `/tmp/iphase-skill-edit.py` (similar shape to `/tmp/skill-edit.py` and `/tmp/skill-revert.py` precedents — OLD_N / NEW_N exact strings + assertions + dry-run support) for maintainer manual apply. Recipe-script + commit message must reference PR #271 verdict by URL.
- `.claude/skills/meta-orchestrator/templates/meta-kickoff.template.md` §4 — NOT classifier-blocked (template file, not SKILL config). Edit directly: `{{DISPATCH_INSTRUCTIONS}}` description in §4 prose; §4a Worker worktree setup section may shrink to a single-line reference to the new hook.
- `.claude/skills/meta-orchestrator/references/placeholders.md` `{{DISPATCH_INSTRUCTIONS}}` line 24 — update description from «name the worktree command (Mode B) or inline Agent dispatch (Mode A) per §5 Dispatch tree» to reflect `claude -w` shape.

**Generation guidance change (new format for §4 dispatch text):**

Old (7 steps per sub-wave):
```bash
cd /Users/art/code/rules-as-tests-aif
git fetch origin staging --quiet
git worktree add ../<repo>-<suffix> origin/staging
cd ../<repo>-<suffix>
[symlinks bash]
git checkout -b <branch>
# open fresh CC tab + paste prompt
```

New (2 steps per sub-wave) — pending ATTN 1+2 decisions:
```bash
claude -w <name>           # creates worktree at <CC-default-path>, opens session, hook runs symlinks
# paste prompt
```

If ATTN 1+2 = «ADOPT CC defaults» (my recommendation): `<name>` derives from umbrella + sub-wave. Hook handles node_modules symlinks transparently. Auto-branch is `worktree-<name>` (renamed by maintainer or hook to `<type>/<umbrella>` per ATTN 2 sub-decision).

**`#worker-dispatch-via-subagent` anti-pattern (SKILL.md:344-348) update:** add bug #39886 reference. Current carve-out remains (paste-fresh-tab is permitted channel for write-Workers); add note «Agent({isolation:\"worktree\"}) silently fails for write-Workers per Anthropic open bug #39886 — DO NOT use for write tasks until upstream fix; read-only research subagents (Phase −1 reviewers, Explore) safe». Tracker: I-phase Worker verifies #39886 is still open at write-time.

**Acceptance:**
- Recipe-script `/tmp/iphase-skill-edit.py` dry-run passes against current SKILL.md state.
- Template edit + placeholders update committed (no classifier-block on these files — verify with first edit attempt).
- Updated dispatch text generation tested: invoke `/meta-orchestrator <test-umbrella>` (e.g. `aif-handoff-as-runtime-bridge` if it stays in queue) and verify generated meta-launch kickoff §4 uses new 2-step format.

### Sub-wave C — Recursive acceptance test + docs **[sequential, after A + B merged]**

**File targets:**
- New dispatch test: pick a parked umbrella (e.g. `aif-handoff-as-runtime-bridge` Sub-wave A or B that were parked during this session's drift), dispatch via new pipeline (`claude -w <name>` + paste), measure step count. Target ≤2. Document as recursive acceptance test artefact at `docs/meta-factory/research-patches/<date>-dispatch-worktree-iphase-acceptance.md` (small patch, ~50 LOC).
- `CLAUDE.md` `## Parallel work` or new section — document new dispatch convention (one-liner pointing at the changed SKILL.md row).
- `.claude/session-bootstrap.md` — if invariants list mentions dispatch, update.

**STOP condition:** if recursive acceptance test fails (step count > 2 OR hook doesn't fire OR `claude -w` doesn't behave as documented in CC v2.1.143) → REVERT Sub-wave A + B, surface as bug to maintainer, escalate.

---

## §4 Five evaluation criteria — implementation correctness

Each Sub-wave PR must score against:

1. **No regression on existing dispatch.** Existing `aif-handoff-bridge-meta-launch` and other in-flight kickoffs still parseable; meta-orchestrator can still dispatch via old 7-step paste-block if maintainer manually chooses (graceful degradation during transition). Score: PASS / FAIL.
2. **Step count BEFORE/AFTER measured on real dispatch.** Sub-wave C acceptance test produces empirical 7→2 evidence. Score: integer.
3. **Hook idempotence.** Run hook ×3 in same worktree → no duplicate symlinks, no errors. Score: PASS / FAIL.
4. **CC version dependency.** Document required CC version (≥2.1.143 per R-phase probe). If consumer on older CC: hook fires but `claude -w` doesn't → degrades to old 7-step path. Score: version pinned in README or hook header.
5. **Audit trail.** PR body has recipe-script for SKILL.md classifier-blocked edits + HEREDOC settings.json diff + Sub-wave A/B test outputs. Reviewer can reconstruct what changed and verify. Score: PASS / FAIL.

---

## §5 AI-laziness traps (per [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md) mandatory cite + enumerate + ≥1 domain-specific)

See [`.claude/rules/ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md) for full catalogue.

**Active canonical traps for this I-phase:**

- **T3** (file:line per claim) — every claim about CC hook behaviour or `claude -w` flag behaviour cites either authoritative CC docs URL+excerpt or live-probe command output.
- **T7** (run the adversarial counter-prompt) — Sub-wave A Worker MUST live-probe hook input schema, not assume from PR #271's UNVERIFIED note.
- **T11** (BFR §3 6-layer applied) — hook implementation = BUILD; must justify against existing `tfriedel/claude-worktree-hooks` and any other community-maintained worktree hooks (DeepWiki on `tfriedel/claude-worktree-hooks` + WebSearch for «claude code worktree hook»).
- **T13** (verify ADOPTED items have upstream evidence) — direct read of `tfriedel/claude-worktree-hooks` repo (DeepWiki or clone), not just PR #271's adapter-name citation.
- **T15** (self-application) — does this I-phase use the new dispatch pipeline to dispatch itself? Partially yes (Sub-wave A and B can run via `claude -w` IF that flag works without the hook — first dispatch test in §11 will verify). Surface in §11.
- **T17** (preserve curated content during edit) — SKILL.md edits diff-only on the 3-4 targeted sections; nothing else touched. Recipe-script enforces this via assertions.
- **T19** (own cold-QA before handoff) — each Sub-wave PR cold-reviewed by 1× Opus reviewer before maintainer review.
- **T20** (verdict backed by evidence) — every implementation choice (event type, JSON schema field, exact bash form) backed by live-probe or upstream code reference.

**Domain-specific traps (NOT in canonical catalogue):**

- **T-DWA-IP-A** — «classifier-block-by-trial-and-error». I-phase Worker tempted to attempt `Edit` on `.claude/skills/meta-orchestrator/SKILL.md` directly, hit classifier-block, re-attempt with different framing. Counter: precedent confirmed (session 2026-05-29 hit this 3 times); proceed DIRECTLY to recipe-script. Don't waste tokens on re-attempts.
- **T-DWA-IP-B** — «settings.json bypass attempt». I-phase Worker tempted to use Bash `cat >> .claude/settings.json` or `jq` in-place edit. Per memory `feedback_settings_json_agent_uncommittable`: settings.json self-protects via deny-rule. Emit diff in PR body, maintainer applies. Don't attempt direct write.
- **T-DWA-IP-C** — «test-the-hook-by-running-the-test, not by triggering CC». I-phase Worker tempted to validate hook only via vitest paired-negative without empirically triggering it in a real `claude -w <name>` session. Counter: §11 self-application test = empirical hook trigger. Sub-wave C MUST include actual `claude -w <test-name>` invocation + observation of hook stdout/stderr/side-effects.

---

## §6 §1.7 Forward-check applied (kickoff-author obligation)

This kickoff is a discipline-bearing artefact — must comply with all active disciplines per `.claude/rules/`. Sweep:

- **[doc-authority-hierarchy.md §5](../../../.claude/rules/doc-authority-hierarchy.md):** kickoff under `.claude/orchestrator-prompts/<umbrella>/` (gitignored, folder-level scope-by-filename); per-file header at top of this file. ✓
- **[phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md):** R-phase already executed 6-item search (PR #271); this I-phase implements verdict, doesn't re-search. Worker §11 dispatch references PR #271 as binding evidence. ✓
- **[phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md):** this §6+§7 satisfies kickoff-level §1.7; each Sub-wave PR produces its own §1.7. Mandate transferred. ✓
- **[phase-research-coverage.md §1.11](../../../.claude/rules/phase-research-coverage.md):** state-claim discipline — Sub-wave A Worker MUST `gh pr view 271 --json state` before any «PR #271 merged» claim. ✓ (mandate in §11)
- **[phase-research-coverage.md §1.12](../../../.claude/rules/phase-research-coverage.md):** my §2 admission gates 2.1+2.2 lead with reasoned recommendations (ADOPT CC defaults) backed by Superpowers Red Flag #1 + session-empirical evidence. Falsifiers stated. Not option-dump. ✓
- **[build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md):** Sub-wave A hook = ADAPT (`tfriedel/claude-worktree-hooks` precedent); not BUILD-from-scratch. §3 6-layer applied at PR #271 R-phase + I-phase Worker re-runs DeepWiki on upstream before drafting. ✓
- **[no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md):** hook is deterministic bash + symlink ops. No LLM call. ✓
- **[reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md):** §2 admission gates 2.1+2.2 (ATTN 1+2) reserve maintainer-strategy calls; I-phase doesn't unilaterally pick CC-defaults despite my recommendation. ✓
- **[ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md):** §5 enumerates 8 canonical T-traps + 3 domain-specific T-DWA-IP-A/B/C. NOT blanket-reference. ✓
- **[parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md):** Sub-wave A + B parallel — use `claude -w` per `claude -w <sub-wave>` directly (NEW dispatch channel). Sub-wave C sequential after A+B merge. Per `parallel-subwave-isolation.md §4 N7`: Superpowers `using-git-worktrees` is dogfooded; `claude -w` IS the native primitive that skill's Red Flag #1 mandates. Direct alignment. ✓
- **[dual-implementation-discipline.md §6](../../../.claude/rules/dual-implementation-discipline.md):** Sub-wave A hook carries `@cc-only-rationale` marker (no portable analog). Sub-wave B updates affect CC-native artefacts (SKILL.md, template); no dual-pair triggered. ✓
- **[recommendation-laziness-discipline.md §3](../../../.claude/rules/recommendation-laziness-discipline.md):** ATTN 1+2 recommendations in §2 backed by SSOT-cited evidence (Superpowers Red Flag #1 = SSOT #65) + same-session command-output (kickoff §1 origin recap with 14-hour evidence). Falsifier stated for each. ✓

---

## §7 §1.7 Backward-check applied (kickoff-scope sweep)

Sweep of existing artefacts under this I-phase's scope — what does it interact with, what might it silently supersede?

- **[.claude/skills/meta-orchestrator/SKILL.md §3 + §4 + §5](../../../.claude/skills/pipeline/SKILL.md)** — DIRECT EDIT TARGETS (via recipe-script per classifier-block). Sub-wave B updates generation guidance. Row 3 (R-phase parallel) gets new anti-pattern note about bug #39886; row 5 (execution-build parallel) gets `claude -w` form. `#worker-dispatch-via-subagent` anti-pattern (SKILL.md:344-348) stays «bare-Agent forbidden + paste-fresh-tab permitted» BUT adds bug #39886 caveat for Agent+isolation channel.
- **[meta-kickoff.template.md §4 `{{DISPATCH_INSTRUCTIONS}}`](../../../.claude/skills/pipeline/templates/meta-kickoff.template.md)** — DIRECT EDIT TARGET (Sub-wave B). Placeholder description updated; §4a Worker worktree setup section may shrink to hook reference.
- **[meta-kickoff.template.md §4a Worker worktree setup](../../../.claude/skills/pipeline/templates/meta-kickoff.template.md)** — currently node_modules symlinks bash. Hook supersedes this OR coexists (defense-in-depth for cases where hook absent on consumer side). Decision: keep §4a as fallback for non-hook environments + add «if hook installed, this is no-op» preamble.
- **[placeholders.md `{{DISPATCH_INSTRUCTIONS}}` line 24](../../../.claude/skills/pipeline/references/placeholders.md)** — direct text update.
- **[.claude/settings.json](../../../.claude/settings.json)** — agent-uncommittable. Diff in PR body for maintainer apply. NOT silently superseded.
- **[.claude/hooks/](../../../.claude/hooks/)** — currently has `check-doc-authority.sh` + `inject-session-bootstrap.sh` + others. New `worktree-setup.sh` added. Coexists. No existing hook superseded.
- **[packages/core/hooks/*test.ts](../../../packages/core/hooks/)** — new test file `worktree-setup.test.ts` added. No existing test changed.
- **[PR #271 research-patch](../../../docs/meta-factory/research-patches/2026-05-29-dispatch-worktree-automation.md)** — verdict source. I-phase IMPLEMENTS, doesn't supersede.
- **[parallel-subwave-isolation.md §4 N7](../../../.claude/rules/parallel-subwave-isolation.md)** — references Superpowers `using-git-worktrees` as dogfooded primitive. `claude -w` direct realisation of that primitive. Rule still valid; no edit needed but Worker may add forward-ref to this I-phase's outcome.
- **`~/.claude/skills/orchestrator/SKILL.md` `## Cross-session dispatch — worktree by default`** — user-scope skill (classifier-protected, maintainer-only edit per memory `feedback_settings_json_agent_uncommittable` pattern). Currently mandates sibling-dir form `git worktree add ../<repo>-<task-slug>`. After ATTN 1 = ADOPT CC defaults, this section becomes STALE. **Out of I-phase scope** (user-scope edit requires maintainer-apply), but EXPLICITLY surfaced here as follow-up: maintainer should update that section post-merge to reference `claude -w <name>` form. Tracked in §8 ATTN 6 below. Surfacing prevents silent supersession.
- **[CLAUDE.md `## Parallel work`](../../../CLAUDE.md)** — if section exists, document new dispatch convention. If not, add minimal forward-pointer in `## See also` to SKILL.md changed row. Sub-wave C scope.
- **[aif-handoff-as-runtime-bridge kickoff](../aif-handoff-as-runtime-bridge/kickoff.md)** — currently parked during this drift. Once I-phase ships, dispatch SW-A + SW-B via NEW pipeline (= Sub-wave C recursive acceptance test exemplar).
- **`packages/core/principles/*.test.ts`** — no current principle test gates worktree-automation. After I-phase ships, if drift recurs (e.g. SKILL.md row generation diverges from `claude -w` form), principle test candidate. Not built now (future work).

No artefact silently superseded. All edit targets explicit.

---

## §8 ATTN / DECISION-NEEDED for maintainer

1. **ATTN 1 (worktree path):** ADOPT CC default `.claude/worktrees/<name>/` (my recommendation, §2.2.1 above). Maintainer: confirm or override.
2. **ATTN 2 (branch name):** ADOPT CC default `worktree-<name>` + per-umbrella rename script (my recommendation, §2.2.2 above). Maintainer: confirm or override (alternative: hook auto-renames).
3. **PR #271 status:** awaiting CI green + auto-merge. If CI red → triage failures; I-phase blocked until resolved.
4. **Bug #39886 tracking:** Worker (Sub-wave B) verifies open status at edit-time. If fixed by Anthropic → update `#worker-dispatch-via-subagent` anti-pattern (SKILL.md:344-348) wording (Agent+isolation channel un-blocked). Else: caveat ships as documented.
5. **Recursive acceptance umbrella choice (Sub-wave C):** pick parked umbrella for empirical dispatch test. Recommendation: `aif-handoff-as-runtime-bridge` Sub-wave A (MCP-consumer R-phase) — it's the predecessor that triggered this whole 14-hour drift; dispatching it via new pipeline closes the loop symbolically + empirically. Alternative: any other parked R-phase.

6. **Post-June-15 Anthropic pricing risk (surfaced 2026-05-29 by maintainer):** Memory `project_deterministic_offload_autonomy_economy` and `project_eot_hook_redesign_approved` reference a 2026-06-15 «metered storm» — Anthropic announces post-Max-plan pricing for some CC pathways. Verified facts: (a) `claude -p` (headless) + Agent SDK explicitly flagged metered/billed in those memory entries; (b) `claude -w` is a CLI flag wrapping `git worktree add` + `cd` + interactive session — interactive sessions are subscription-bundled at present. **Recommendation:** treat current verdict as DO-NOT-BLOCK on June-15 outcome. `claude -w` itself is free (shell command); the interactive CC sessions it opens carry the same risk as ANY current CC interactive session (global risk, not specific to this I-phase). **Falsifier:** wrong if June-15 announcement makes ALL CC interactive sessions metered (not just headless/SDK) — then `claude -w` opens metered sessions, and `aif-handoff-bridge` Variant-A-style external-runtime alternatives become attractive again. **Action:** WebFetch `anthropic.com/blog` or official announcements 1 week before 2026-06-15 + 1 day after. If announcement confirms global interactive metering → re-evaluate before Sub-wave C ship. Tracked in §10 STOP «Post-June-15 …» condition.

7. **Remote-sessions + Superpowers framework alternative (paradigm-level, surfaced 2026-05-29 by experienced maintainer-peer):** suggestion = «Включи remote-сессии. Поставь superpowers и при каждом старте задач запускай скилл `/using-super-powers`». Components: **(a)** migrate from local CLI `claude` to remote Claude Code sessions (claude.ai/code) — worktree management potentially handled by remote infrastructure; **(b)** Superpowers framework already installed in available skills (verified: `superpowers:using-git-worktrees` + `superpowers:dispatching-parallel-agents` + others); **(c)** auto-load `superpowers:using-superpowers` at every task start for systematic skill-discovery. **Relationship to current I-phase verdict:** orthogonal in (b) — Superpowers `using-git-worktrees` Red Flag #1 IS the primary input to current verdict (ADOPT `claude -w`); (c) is skill-discovery layer, doesn't touch worktree mechanics; (a) IS a paradigm-level alternative that could OBVIATE this entire I-phase IF remote handles worktree natively. **Status:** out of I-phase scope, requires separate R-phase to evaluate (a) — «does claude.ai/code expose worktree-equivalent surface, and at what cost-of-migration?». **Recommendation:** do NOT block this I-phase on (a); current verdict (`claude -w` local) is empirically grounded (v2.1.143 probe-verified) and ships incremental win regardless of remote-sessions outcome. If remote sessions later supersede local CLI, current I-phase artefacts (hook + SKILL.md guidance) become STALE but not load-bearing wrong. Surface as separate `remote-sessions-paradigm-evaluation` umbrella for parallel R-phase if maintainer prioritises. **Falsifier of «do not block»:** wrong if remote sessions are imminently ready AND migration cost is low — then shipping local-CLI artefacts wastes ~3 days of I-phase work. Maintainer call.

---

## §9 Sub-wave breakdown

| Sub-wave | Mode | Stage | Parallel-sibling | Deliverable |
|---|---|---|---|---|
| A — Hook + test | Mode A inline I-phase | 1 | B (file-lock OK: hook files vs SKILL.md/template files) | `.claude/hooks/worktree-setup.sh` + `packages/core/hooks/worktree-setup.test.ts` + PR-body settings.json HEREDOC |
| B — Generation guidance update | Mode A inline I-phase | 1 | A (same parallel cohort) | Recipe-script `/tmp/iphase-skill-edit.py` + template/placeholders direct edits + `#worker-dispatch-via-subagent` anti-pattern (SKILL.md:344-348) bug #39886 note |
| C — Recursive acceptance + docs | Mode A inline I-phase | 2 (after A+B merged) | — | Acceptance research-patch + CLAUDE.md fwd-ref + parked-umbrella dispatch test |

**Stage 1→2 gate:** `gh pr list --search "is:merged head:worktree-iphase-hook base:staging" --json number --jq '.[0]'` AND same for `head:worktree-iphase-skill-update` — BOTH must return ≥1 row before Sub-wave C dispatch.

---

## §10 STOP conditions

- **Sub-wave A STOP:** hook input JSON schema probe (`stdin` dump) returns shape NOT compatible with «detect worktree cwd» logic → escalate to maintainer; consider PreToolUse fallback. Don't ship a hook that runs blindly.
- **`claude -w` version mismatch:** if Worker's CC version < 2.1.143 OR `claude -w <name>` fails to open a session-with-worktree on Worker's setup → STOP Sub-wave A AND Sub-wave B. Hook alone shipped without the `claude -w` flag working = step count reduction not achieved (hook fires only when CC creates the worktree; if maintainer falls back to manual `git worktree add`, hook still works but pipeline win lost). Escalate; do NOT ship partial.
- **Post-June-15 Anthropic pricing change touches interactive sessions:** if `claude -w` opens interactive CC sessions that become metered (not subscription-bundled) after 2026-06-15 Anthropic pricing announcement → STOP Sub-wave C acceptance test (it would measure metered cost, not free pipeline). Re-evaluate I-phase verdict against new pricing model before ship. WebFetch `anthropic.com/blog` for announcement; check before Sub-wave C dispatch. Falsifier: announcement explicitly exempts interactive `claude` sessions from metering (only `claude -p` headless + Agent SDK affected) → proceed as planned. See §8 ATTN 6.
- **Sub-wave B STOP:** recipe-script `/tmp/iphase-skill-edit.py` dry-run fails (OLD_N strings drifted from current SKILL.md) → re-baseline against current state; possibly PR #271 verdict assumed different baseline. Investigate before forcing apply.
- **Sub-wave C STOP:** recursive acceptance test measures step count > 2 → REVERT Sub-wave A + B (open revert PR), surface as bug. Pipeline didn't deliver promised UX win.
- **Bug #39886 closed mid-implementation:** if Anthropic ships fix to #39886 during I-phase → re-evaluate `#worker-dispatch-via-subagent` anti-pattern (SKILL.md:344-348) wording before Sub-wave B PR (Agent+isolation channel may become permitted again).
- **Multiple classifier-blocks:** if Sub-wave B Worker hits classifier on additional files beyond SKILL.md (e.g. template, placeholders) → recipe-script broadens; don't bypass.

---

## §11 Worker dispatch — Sub-wave A + B (Stage 1 parallel)

**Per §2 admission gates** (PR #271 merged + ATTN 1+2 decided + Phase −1 GO), dispatch via `claude -w` directly. This IS the self-application test (T15) — if `claude -w` works for I-phase Worker dispatch BEFORE the hook is installed, the hypothesis «`claude -w` solves 80% of the problem standalone» is verified.

### Sub-wave A dispatch — terminal one-liner

```bash
claude -w iphase-hook
# CC creates worktree at .claude/worktrees/iphase-hook/ + branch worktree-iphase-hook (CC default per ATTN 1+2 DECIDED)
# then in the opened CC session, paste the prompt below
```

(If hook not yet installed: maintainer manually runs symlinks bash in opened session — known one-time cost, this Sub-wave installs the hook to eliminate it.)

Paste in opened CC session:

```text
/orchestrator dispatch-worktree-automation-iphase §3 Sub-wave A — Mode A inline I-phase: hook implementation per PR #271 verdict Candidate D2 (ADAPT tfriedel/claude-worktree-hooks for project-specific node_modules symlinks). Output: .claude/hooks/worktree-setup.sh + packages/core/hooks/worktree-setup.test.ts + PR-body HEREDOC diff for .claude/settings.json. Active T-traps per §5: T3, T7, T11, T13, T15, T17, T19, T20, T-DWA-IP-A, T-DWA-IP-B, T-DWA-IP-C. PR base: staging. §1.7 PR-body mandate per §4b template applies. Branch: worktree-iphase-hook (CC default per ATTN 1+2 DECIDED — no rename needed). MUST live-probe CC hook input JSON schema before drafting (PR #271 §8 ATTN 4 marked UNVERIFIED).
```

### Sub-wave B dispatch — terminal one-liner

```bash
claude -w iphase-skill-update
# CC creates worktree at .claude/worktrees/iphase-skill-update/ + branch worktree-iphase-skill-update
# then paste:
```

```text
/orchestrator dispatch-worktree-automation-iphase §3 Sub-wave B — Mode A inline I-phase: meta-orchestrator generation guidance update per PR #271 verdict Candidate E (ADOPT claude -w form). Output: recipe-script /tmp/iphase-skill-edit.py for SKILL.md §3+§4+§5 (classifier-blocked per session 2026-05-29 precedent — DO NOT attempt Edit, go straight to recipe per T-DWA-IP-A) + direct edits to meta-kickoff.template.md §4 + placeholders.md line 24 + `#worker-dispatch-via-subagent` anti-pattern (SKILL.md:344-348) bug #39886 note. Active T-traps: same set as Sub-wave A + emphasis on T17 (preserve curated SKILL.md content, diff-only). PR base: staging. §1.7 PR-body mandate per §4b applies. Branch: worktree-iphase-skill-update (CC default — no rename needed).
```

### Sub-wave C dispatch — terminal one-liner (AFTER Stage 1→2 gate)

```bash
claude -w iphase-acceptance
# CC creates worktree at .claude/worktrees/iphase-acceptance/ + branch worktree-iphase-acceptance
# then paste:
```

```text
/orchestrator dispatch-worktree-automation-iphase §3 Sub-wave C — Mode A inline I-phase: recursive acceptance test + docs. Output: docs/meta-factory/research-patches/<date>-dispatch-worktree-iphase-acceptance.md + CLAUDE.md forward-reference. Active T-traps: T3, T15 (self-application is the WHOLE POINT — this dispatch IS the test), T19, T20, T-DWA-IP-C. MUST empirically invoke claude -w <test-name> for a parked umbrella (recommendation: aif-handoff-as-runtime-bridge SW-A — closes the symbolic loop). Measure actual step count vs target ≤2. PR base: staging. §1.7 PR-body mandate per §4b applies. Branch: worktree-iphase-acceptance (CC default — no rename needed).
```

---

## §12 Out-of-scope (explicit anti-scope)

- **NOT modifying R-phase verdict.** PR #271 stands; I-phase implements as-is.
- **NOT building VS Code-tab dispatch alternative.** ATTN 3 out of scope per §2.
- **NOT writing principle test for worktree-automation discipline.** Future work if drift recurs.
- **NOT modifying parked umbrellas' kickoffs.** `aif-handoff-as-runtime-bridge` kickoff stays as-is; only its DISPATCH channel changes (via Sub-wave C test).
- **NOT closing or modifying `dispatch-worktree-automation` umbrella (the R-phase parent).** That's a separate retro task post-I-phase merge.
- **NOT touching cross-worktree-sync-research findings.** Orthogonal (gitignored coord-doc sync vs worktree creation primitive).

---

## See also

- [PR #271 research-patches/2026-05-29-dispatch-worktree-automation.md](https://github.com/Yhooi2/rules-as-tests-aif/pull/271) — verdict source-of-truth.
- [.claude/orchestrator-prompts/dispatch-worktree-automation/kickoff.md](../dispatch-worktree-automation/kickoff.md) — R-phase umbrella (parent).
- `tfriedel/claude-worktree-hooks` (public GitHub, no local path) — Sub-wave A hook ADAPT target.
- [.claude/rules/parallel-subwave-isolation.md §4 N7](../../../.claude/rules/parallel-subwave-isolation.md) — Superpowers Red Flag #1 dogfood that `claude -w` realises.
- [docs/meta-factory/prior-art-evaluations.md #65](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT for `using-git-worktrees` REFERENCE.
- [/tmp/skill-edit.py + /tmp/skill-revert.py](file:///tmp/) — recipe-script precedent for Sub-wave B classifier-blocked edits.
- Anthropic bug #39886 — Agent({isolation:"worktree"}) silently fails for write-Workers; tracked in §2.4 and Sub-wave B `#worker-dispatch-via-subagent` anti-pattern (SKILL.md:344-348) note.

Prior-art: prior-art-evaluations.md#65 (`using-git-worktrees` REFERENCE — `claude -w` is the harness-native realisation Red Flag #1 mandates).
