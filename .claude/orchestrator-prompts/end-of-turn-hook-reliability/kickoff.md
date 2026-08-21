# End-of-turn reminder hook — reliability audit + targeted refinements

> **Status:** ARMED, ready to dispatch (planning artefact only; no code edits yet).
> **Date drafted:** 2026-05-17.
> **Authoritative for:** scope of this work unit, bug inventory, prior-attempt history, phase ordering, acceptance criteria, T-trap enumeration for the executing session.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Session-level ordering — see [`post-1a-coordination/kickoff.md` §3.6](../post-1a-coordination/kickoff.md).
> **Companion executable artefact:** `.claude/hooks/end-of-turn-reminder.sh` (the subject of this kickoff).
> **Origin trigger:** orchestrator session 2026-05-17 observed empirical silent false-negative — hook fired only 2× per session despite ≥5 qualifying long-markdown turns, including the very brainstorm of how to improve the hook (meta-irony documented in §1).

---

## §0 Step 0 — mandatory reading before any action

Read in this order. **Phase -1 reviewer does NOT auto-load memory** — every constraint pulled from memory must be embedded in this kickoff or re-read by the executing session.

1. [README.md#why-this-exists](../../../README.md#why-this-exists) — project goal anchor.
2. [.claude/session-bootstrap.md](../../../.claude/session-bootstrap.md) — invariants restatement.
3. [CLAUDE.md](../../../CLAUDE.md) — capability-commit gate, Artifact Ownership Contract.
4. [.claude/rules/ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) §2 + §3 — required T-enumeration discipline.
5. [.claude/rules/dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md) — hook annotation discipline (this hook carries `@cc-only-rationale`).
6. [.claude/rules/phase-research-coverage.md](../../../.claude/rules/phase-research-coverage.md) §1 + §1.7 — search-coverage checklist, forward/backward when PR ships.
7. [.claude/rules/no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — runtime constraint: no paid-LLM inside the hook.
8. **This kickoff** (you are here).
9. `.claude/hooks/end-of-turn-reminder.sh` — the hook itself; read in full before diagnosing.

---

## §1 Why this kickoff exists

### §1.1 The empirical incident (2026-05-17, orchestrator session 08570cad)

During an orchestrator session where the maintainer + assistant were **literally discussing how the hook should work**, the assistant produced three consecutive long-markdown analytical turns (7151 / 8152 / 1377 chars; each containing `##` headings, bullets, tables, code blocks). By the current trigger logic (`text_length > 500 AND grep -qE '^#|^- |^\* |\*\*|```|\[[^]]+\]\([^)]+\)'`) **every one of these turns should have fired `trigger_report=true`**.

**None did.** Empirical fire log for the session (from `~/.claude/projects/-Users-art-code-rules-as-tests-aif/08570cad-*.jsonl`):

```
2026-05-17T11:36:09Z — fire
2026-05-17T11:50:29Z — fire
(silent thereafter — 3 qualifying turns went un-instrumented)
```

This is **not** a design false-negative (the formal triggers would have matched). It is a **runtime silent-fail** — the hook itself appears to skip qualifying turns for reasons we have not yet isolated.

### §1.2 Why this matters beyond «cosmetic improvement»

Item 5a (§13.34 autonomous-self-audit R-phase, [scaffold](../autonomous-self-audit-research/research-prompt.md)) is explicitly **sequenced after** this hook «has accumulated enough live data» per [`post-1a-coordination/kickoff.md` §3.6 line 164](../post-1a-coordination/kickoff.md). The hook is a literal §13.34 candidate-mechanism-A prototype. **If the hook is silently broken, Item 5a's «live data» premise is false** — the R-phase would proceed on phantom evidence. Reliability audit must complete before Item 5a is dispatched.

Plus recursive self-application: the hook IS the executable artefact for the Feynman-second-pass discipline. A hook that silently doesn't fire = `#discipline-theatre` — the rule exists in code but doesn't enforce. Project invariant #2 («recursive self-application green») requires the artefact actually catches what it's designed to catch.

---

## §2 Scope

### §2.1 In scope

- Audit current `.claude/hooks/end-of-turn-reminder.sh` runtime behaviour: diagnose root cause of silent false-negative.
- Decide between three responses: (a) revert hook entirely until TS rewrite, (b) patch in-place on bash, (c) leave as-is + hold for Wave 10.
- If (b): minimal bash refinements — throttling, multi-paragraph proxy, code-block carve-out — as **separate atomic commits**, each with own §1.7 Forward/Backward.
- Document findings in a research-patch under `docs/meta-factory/research-patches/2026-05-XX-end-of-turn-hook-reliability.md` regardless of (a)/(b)/(c) choice — captures empirical data for §13.34 follow-up.

### §2.2 Out of scope (DO NOT do in this R-phase)

- **TS-core mdast rewrite** — belongs in Wave 10 ([Item 5c](../post-1a-coordination/kickoff.md) §3.6). This kickoff may produce a *requirements doc* for that rewrite but must not start it.
- **Changing hook trigger semantics beyond agreed §2.1 list** — adding semantic content classifiers, sentence-length analysis, NLP heuristics, etc. → out. YAGNI.
- **Re-introducing aggregation/isMeta logic from closed PR #73.** Maintainer explicit rejection 2026-05-17 (see §4.4 below).
- **Drive-by improvements to other hooks** under `.claude/hooks/`. Per `no-drive-by-prs` discipline.
- **Cross-worktree-sync overlap** — if cross-worktree-sync R-phase ([Item 2.5](../cross-worktree-sync-research/kickoff.md)) discovers this kickoff's content also exists in another worktree, surface as observation; do NOT autonomously merge.

---

## §3 Known bugs / gaps inventory

### §3.1 [RUNTIME, CONFIRMED] Silent false-negative (PRIMARY)

**Symptom:** hook does not fire on majority of qualifying long-markdown turns within a session.

**Evidence:** session `08570cad-*.jsonl`, only 2 fires (timestamps 11:36, 11:50) despite ≥5 turns >500 chars containing markdown patterns. Three consecutive substantial turns at 11:52 / 11:56 / 11:57 silent.

**Working hypotheses (rank-ordered, must verify):**

1. **`stop_hook_active=true` sticks across user-prompt boundaries.** After a fire, the assistant's Feynman-pass continuation triggers a second Stop event with the flag set (→ silent exit, correct). Hypothesis: the flag fails to reset when the next user message arrives, so all subsequent Stops in the session see it as `true`.
2. **CC has an internal Stop-hook rate limit** (undocumented). After N fires-per-session, further fires are suppressed.
3. **Hook exits non-zero silently due to `set -euo pipefail` + jq edge** on specific assistant content (e.g. text containing characters that break jq's `-r` parse).
4. **Transcript-buffer race when assistant output is large** — `tail -r` reads incomplete final line; `grep -m1` matches an earlier entry, jq returns empty.

### §3.2 [DESIGN, PREDICTED] Dense-prose false-negative

Long pure-prose answer (≥500 chars, multiple paragraphs, no `#`/`-`/`*`/```` ```/link markdown) → current regex `^#|^- |^\* |\*\*|```|\[[^]]+\]\([^)]+\)` doesn't match → skip. Yet this is precisely the highest-risk class for pattern-match Layer-1.

Mitigation candidate: paragraph-count proxy (`\n\n` separators) — if ≥3 paragraphs AND length > 500, fire even without markdown markers.

### §3.3 [DESIGN, PREDICTED] No throttling — saturates if §3.1 fixed

Once §3.1 is fixed, the hook fires on **every** qualifying turn. In a session with 8 long Q&A in a row, this produces 8 Feynman injections. The assistant defaults to producing Feynman blocks as a ritual → pattern-match on the ritual itself (T7).

Mitigation candidate: per-session cooldown via mtime of `/tmp/.eot-last-fire-<session_hash>` (e.g. ≥5 min gap), with severity-bypass for very-long turns (>3000 chars) and AskUserQuestion.

### §3.4 [DESIGN, PREDICTED] Form vs content — pasted-content false-positive

600 chars of pasted error log inside ```` ``` ```` triggers `trigger_report=true`, but Feynman doesn't semantically apply to mechanical paste content.

Mitigation candidate (bash): code-block carve-out — compute `prose_chars` outside fences; if `prose_chars / total < 0.3` → skip. Edge case, lower priority than §3.1-§3.3.

Note: full form-vs-content discrimination is **the natural domain of mdast** in Wave 10 TS rewrite. Bash mitigation should be limited and clearly marked «MVP, will be replaced».

---

## §4 Previous attempts inventory (chronological)

### §4.1 PR #70 — initial hook merge

Merged then **reverted** in commit `4307ac7 Revert "feat(hooks): add end-of-turn reminder Stop hook (#70)"`. Reason for revert not in this kickoff's scope to reconstruct — read the revert commit message and PR #70 closing comments if relevant to your investigation.

### §4.2 PR #71 — re-introduction of the hook (CURRENT BASELINE)

Merged 2026-05-17 (commit `060ed23`). This is what currently lives on `main`. Stop-event hook with `tail -r | grep -m1 '"type":"assistant"'` + length/markdown trigger logic. **The hook this kickoff audits is precisely this version.**

### §4.3 PR #72 — permission fix

Merged 2026-05-17 (commit `9c86693`). Added the required `.claude/settings.json` permission entry so the hook actually executes. Critical: per maintainer investigation in session `2389cb56-*.jsonl`, **the original «hook didn't fire on turns 1+2 of session 7cea0913» symptom that motivated PR #73 was caused by missing permission, NOT by a race condition.** Once permission was granted, hook fired from turn 3 onward.

### §4.4 PR #73 — aggregation attempt (CLOSED, NOT MERGED)

Closed without merging 2026-05-17 with full rationale ([PR #73 close comment](https://github.com/Yhooi2/rules-as-tests-aif/pull/73)). Summary of what happened:

1. **Hypothesis:** race condition — CC writes thinking-block to JSONL before text-block; Stop hook reads file mid-write, sees only thinking, exits.
2. **Static investigation by maintainer** (session `2389cb56-*.jsonl`) **REJECTED the hypothesis.** In every observed transcript, text is the last entry of the assistant turn. The original `tail -r | grep -m1` reads it correctly when it runs.
3. **Despite rejection, an aggregation refactor was committed (`0de0dfa`)** — re-reading «all assistant entries since last user boundary» via jq instead of «just the last line». Defense-in-depth motivation.
4. **The aggregation introduced its own bug:** boundary detector missed `isMeta:true` user entries (Stop-hook-feedback injected as meta user-message) → boundary jumped back to the previous real user prompt → text from TWO assistant turns concatenated → false re-fire (empirical: `text_len=955` on a ~65-char actual response).
5. **Patched in-flight** by adding `isMeta == true` to the boundary condition. Two changes now load-bearing on each other (symbiotic — neither needed alone, both needed together).
6. **Cold reviewer (Phase -1 Mode A Opus) flagged a second latent bug** in the aggregation path: `// -1` fallback at the boundary — when zero qualifying user entries exist, slice becomes `$all[0:]` = entire transcript → false-positive `trigger_report` on accumulated prior-turn text. Reachable in sub-agent / programmatic invocations.
7. **Decision (maintainer + reviewer convergence):** YAGNI. Original code worked when permission was correct; aggregation solved a non-existent problem and introduced two real bugs.

**Hard constraint inherited from §4.4:** do NOT re-introduce aggregation, isMeta-boundary, or `// -1` patterns. If a future fix appears to need them, that is a sign the diagnosis is wrong (T16 pattern-matching-on-name applied to PR #73's failure mode).

---

## §5 Phases of work

### Phase A — Audit (REQUIRED, 1-2h focused)

Diagnose §3.1 root cause empirically. No code edits.

**A.1 Reproduce empirically.** Open a fresh CC session in a worktree. Generate 3 long-markdown responses. Record fire events via `grep 'End-of-turn reminder injected'` on the session JSONL. Confirm the silent false-negative reproduces.

**A.2 Instrument the hook (temporary, NOT to be committed).** Apply a local-only debug patch that writes `transcript_path`, `stop_hook_active`, `text_length`, `has_askuserquestion`, and `trigger_report/trigger_question` decisions to `/tmp/eot-debug.log` on every invocation. Verify the hook is invoked but exits silently — vs. not invoked at all.

**A.3 Test hypotheses in order:**
- **H1 (`stop_hook_active` stuck):** check `stop_hook_active` value across consecutive fires in the debug log. If `true` after the first fire and never resets → H1 confirmed.
- **H2 (CC rate-limit):** if H1 disproven, check whether hook is being invoked at all (log presence). If hook NOT invoked → CC-side suppression → H2 indicated.
- **H3 (jq edge):** if hook invoked but exits before fire decision, identify which line. Trace input that breaks parse.
- **H4 (transcript race):** check if `tail -r | grep -m1` matches a stale entry — compare grep output vs `jq -c 'select(.type=="assistant")' | tail -1` of the same file. If they differ → confirms H4 territory.

**A.4 Produce audit research-patch.** `docs/meta-factory/research-patches/2026-05-XX-end-of-turn-hook-reliability.md`. Record: hypothesis tested, evidence (log excerpts, file:line), verdict for each H1-H4, recommended fix path.

**Acceptance for Phase A:** research-patch committed with root cause identified + verdict on (a)/(b)/(c) from §2.1 + §1.7 Forward/Backward sections.

### Phase B — Decision gate (orchestrator + maintainer)

Based on Phase A audit, choose:

- **(a) Revert hook entirely.** If root cause is fundamental (e.g., CC behaviour we cannot control) and the hook adds noise without value. New PR reverting #71. Status of feature: paused until Wave 10 TS rewrite.
- **(b) Patch in-place on bash.** If root cause is a fixable bash defect. Proceed to Phase C with minimal-scope commits.
- **(c) Leave as-is until Wave 10.** If root cause is fixable but the fix would be substantial enough to warrant TS rewrite. Hook stays live but acknowledged unreliable. Phase A research-patch becomes input to Wave 10 R-phase.

**This is a decision-needed surface per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md).** Executing session SURFACES options with consequences; maintainer chooses; do NOT pick autonomously unless maintainer explicitly delegates.

### Phase C — Implementation (CONDITIONAL on B=b, 2-4h)

**Atomic commits, in order, each with separate §1.7 Forward/Backward:**

- **C.1** — fix the §3.1 root cause identified in Phase A. Minimum scope, single fix per commit.
- **C.2** — add throttling per §3.3 (cooldown via `/tmp/.eot-last-fire-<session_hash>`, severity-bypass for >3000 chars and AskUserQuestion). Separate commit.
- **C.3** — add multi-paragraph proxy per §3.2 (paragraph count ≥3 AND length > 500 ⇒ fire even without markdown markers). Separate commit.
- **C.4** — optional code-block carve-out per §3.4 (compute `prose_chars` outside fences; skip if ratio low). Separate commit, marked «MVP, replaced in Wave 10». **Do not ship C.4 unless §3.4 false-positives observed empirically in Phase A.**

Each commit must:
- Not be a capability commit (per [CLAUDE.md](../../../CLAUDE.md) — file <50 LOC change typical, not under `packages/`, no new deps → no `Prior-art:` trailer needed; verify with `.husky/pre-push` locally).
- Carry `# @cc-only-rationale: ...` marker (already present on hook).
- Include test transcript fixture if practical (sample JSONL fragment exhibiting the case the commit fixes).

### Phase D — Wave 10 input (lightweight artefact, 30 min)

Append a section to `docs/meta-factory/open-questions.md` (or appropriate Wave 10 prep doc — verify which exists) summarising:
- Bash-version limitations that mdast naturally solves (form/content, dense-prose detection).
- Bash-version mechanisms that should transfer to TS as-is (throttling state file, AskUserQuestion handling).
- The §3.1 root cause + Phase C fix — ensure TS rewrite doesn't reintroduce it.

---

## §6 AI-laziness traps active for this R-phase

Per [`.claude/rules/ai-laziness-traps.md` §3](../../../.claude/rules/ai-laziness-traps.md) — kickoff cites the rule, enumerates applicable T-numbers, AND adds ≥1 domain-specific trap. Blanket reference is itself T7.

**Canonical traps active:**

- **T1 sampling-shallow.** Two fires in one session is a small sample. Phase A must reproduce in ≥2 independent fresh sessions before concluding root cause.
- **T3 plausible-without-verification.** Every hypothesis verdict in §A.4 research-patch must cite a debug log line or grep output. No prose-only «I think H1 is the cause».
- **T7 follow-prompt-literally.** Do not just enumerate H1-H4 and pick the «most plausible» — run each test and produce evidence.
- **T11 designing-without-prior-art.** Before proposing throttling design, check whether CC documentation / `claude-code-guide` agent describes a built-in throttling mechanism we can use instead of `/tmp/.eot-last-fire`.
- **T13 ADOPTED-zero-work.** Phase D's «what transfers to TS as-is» — even if mdast is well-validated upstream, our problem-class (assistant-turn analysis, not generic markdown lint) requires explicit problem-class matching per §16 of ai-laziness-traps.
- **T15 self-application MANDATORY.** This kickoff's recommendations must themselves pass Feynman-check: each fix must produce a 1-line «what does this catch / what does it miss» summary.
- **T16 pattern-matching-on-name.** «We had a race-condition fix once» (PR #73) — do not reach for the same fix shape if symptoms look superficially similar. Read §4.4 first.

**Domain-specific traps for THIS R-phase:**

- **T-EOT-A — «fixes broke it» phantom.** Symptom: maintainer's framing suggests «возможно фиксы его сломали». Reality check: `main` contains only PR #71 + #72; PR #73 was closed without merge; there are no «fixes» on main beyond the initial implementation. The runtime fault, whatever it is, lives in the original PR #71 code OR in CC harness behaviour — not in a delta we can revert in isolation. Counter: confirm what's actually on main (`git log origin/main -- .claude/hooks/end-of-turn-reminder.sh`) before reasoning about regressions.

- **T-EOT-B — solving the wrong layer.** Tempted output: «let's add throttling and multi-paragraph proxy, they're clearly improvements». Reality: with §3.1 unfixed, NEITHER improvement helps (improving trigger accuracy when the hook doesn't fire at all = improving a dial that's disconnected). Counter: Phase A MUST complete before Phase C. Throttling on top of a silent-fail hook would mask the real defect further.

- **T-EOT-C — «restart-the-old-fix-because-we're-here».** Tempted output: «while we're auditing, let me try aggregation + isMeta + `// -1` fallback once more, this time more carefully». Counter: §4.4 explicit reject. The diagnosis that motivated those fixes (race condition) was statically refuted; re-introducing them under «improvement» framing is exactly the failure mode the close of PR #73 documented.

---

## §7 Acceptance criteria

### Phase A acceptance

- [ ] Audit research-patch committed to `docs/meta-factory/research-patches/2026-05-XX-end-of-turn-hook-reliability.md` with required header per [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md).
- [ ] Each H1-H4 hypothesis has a verdict (CONFIRMED / REJECTED / INCONCLUSIVE) backed by debug-log file:line or grep output.
- [ ] Root cause identified OR explicit «inconclusive after 2 sessions — escalate» finding.
- [ ] §1.7 Forward and Backward sections present in research-patch + in any PR that ships from it.
- [ ] Decision-needed surface for Phase B written with consequences of each (a)/(b)/(c).

### Phase B acceptance

- [ ] Maintainer pick recorded in research-patch.
- [ ] If (a) revert — new PR opened, no further phases.
- [ ] If (b) patch — Phase C dispatched.
- [ ] If (c) defer — Phase D dispatched as Wave 10 input only.

### Phase C acceptance (if dispatched)

- [ ] Each commit (C.1-C.4) is atomic, single-concern, has §1.7 Forward/Backward.
- [ ] Each commit verified by: empirical reproduction of pre-fix state, post-fix state, behaviour delta documented.
- [ ] Hook still carries `@cc-only-rationale` marker.
- [ ] No new `@dual-pair` / portable fallback added (per [dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md) internal tooling default).
- [ ] No paid-LLM call introduced (per [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md)).

### Phase D acceptance (if dispatched)

- [ ] Wave 10 input section appended to appropriate doc (open-questions.md or Wave 10 prep doc).
- [ ] Cross-reference from this kickoff to that section.

---

## §8 Capability-commit consideration

Per [CLAUDE.md «Build-vs-reuse invariant»](../../../CLAUDE.md), capability commits trigger if:
- new explicit dep in `package.json` (no — hook is pure bash)
- new file ≥50 LOC under new `packages/core/<dir>/` (no)
- new file ≥80 LOC anywhere under `packages/` (no)

Phase C edits are **modifications** to existing `.claude/hooks/end-of-turn-reminder.sh`. The file is <50 LOC and not under `packages/`. **No commit in Phase C is a capability commit.** No `Prior-art:` trailer required on functional commits, but `.husky/pre-push` will not complain. (If C.1 happens to grow the file substantially, re-check threshold before commit.)

---

## §9 Worktree + session dispatch

Per [orchestrator skill cross-session dispatch](~/.claude/skills/orchestrator/SKILL.md) — **mandatory worktree**, not shared workdir:

```bash
git worktree add ../rules-as-tests-aif-eot-hook origin/main
cd ../rules-as-tests-aif-eot-hook
git checkout -b audit/end-of-turn-hook-reliability
claude  # fresh Opus session
```

Phase A (audit) can run as **Mode A inline Agent on Opus** for the diagnostic synthesis, OR as a dedicated fresh Opus session. Phase C (implementation) → **Mode B file-prompts on Sonnet** if maintainer-present, or Mode A if autonomous.

---

## §10 References

- [`.claude/hooks/end-of-turn-reminder.sh`](../../../.claude/hooks/end-of-turn-reminder.sh) — the subject artefact.
- [`.claude/rules/ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md) — T-trap discipline (§3 enumeration mandate).
- [`.claude/rules/dual-implementation-discipline.md`](../../../.claude/rules/dual-implementation-discipline.md) — `@cc-only-rationale` annotation, §2 internal-tooling carve-out.
- [`.claude/rules/phase-research-coverage.md`](../../../.claude/rules/phase-research-coverage.md) — search-coverage §1, §1.7 Forward/Backward.
- [`.claude/rules/no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md) — runtime constraint.
- [`.claude/rules/reviewer-discipline.md`](../../../.claude/rules/reviewer-discipline.md) — Phase B decision-needed surfacing.
- [`post-1a-coordination/kickoff.md` §3.6](../post-1a-coordination/kickoff.md) — session ordering; **this kickoff inserts as Item 2.7** between 2.5 cross-worktree-sync and 3 companion-integration-analysis.
- [`autonomous-self-audit-research/research-prompt.md`](../autonomous-self-audit-research/research-prompt.md) — Item 5a downstream dependency on this hook's reliability.
- [`migration-ast/`](../migration-ast/) — if exists, prior art on AST-migration patterns; check before designing Wave 10 input.
- Closed PR #73 thread — full rationale on what aggregation tried and why rejected.
- Maintainer investigation session `2389cb56-5959-4503-9ed9-7dea6e0f6d16.jsonl` — origin of race-condition rejection.
- Origin session `08570cad-c697-4a9b-a2ca-b00fec323266.jsonl` — empirical silent false-negative observation (this kickoff's trigger).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
