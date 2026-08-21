# Mode-B file-prompt — SubagentStop REPORT-schema WARN hook (#108 follow-up, maintainer chose WARN over block)

> Open a FRESH Claude Code session (Opus). Copy this ENTIRE file as the first message. Self-contained — assume zero prior context.

## TASK
Ship the deferred #108 candidate-3 as a **WARN** (non-blocking) hook: on `SubagentStop`, scan the finishing subagent's output for the canonical orchestrator REPORT sections and, if some are missing, print them to **stderr with exit 0** (surface, do NOT block). Maintainer explicitly chose WARN over block (exit 2) — see WHY. R-phase contract-verify + small implement. SSOT #108 (already merged; this is its candidate-3, no new SSOT row).

## WHY WARN, NOT BLOCK (the decision is made — do not re-litigate, just honor it)
- A REPORT's *substance* is judgment, not mechanically gateable; a gate can only check *header presence* → header-presence gate = `#discipline-theatre` (`rule-enforcement-channel-selection.md §1` + §5 `#gate-where-judgment-needed`).
- `SubagentStop` fires on ALL subagents (Explore, one-shot reads, cold-reviewers) — they legitimately have no REPORT schema. A blocking `exit 2` would stall them (same T16 shape that dropped ConfigChange). WARN can't stall anything.
- WARN complements the orchestrator's existing manual 6-item REPORT check (Phase 4) + Recovery-pattern re-dispatch — it makes the gap louder, never breaks the loop.

## UMBRELLA / GIT
- New concern dir `subagentstop-report-warn` (NOT under the closed `companion-adoption-iphase`).
- BASE: `origin/staging` (trunk). Commit `feat(...)` English, Conventional Commits. Project rules in CLAUDE.md + `.claude/rules/` auto-load — reference, don't restate.

## STEP 0 — WORKTREE FIRST (parallel-subwave-isolation §1)
```bash
cd /Users/art/code/rules-as-tests-aif
git fetch origin staging
bash scripts/create-worktree.sh subagentstop-warn   # off refreshed origin/HEAD (staging)
```
All work inside it. Fails → STOP + report, no shared-dir work. If the worktree already exists, `git -C <wt> fetch origin staging && git -C <wt> merge --ff-only origin/staging` before resuming.

## STEP 1 — VERIFY THE `SubagentStop` CONTRACT (load-bearing, T20 / own-stack-first)
**Dual-channel = two structurally-different sources** (a dispatched worker CANNOT spawn `claude-code-guide` — do not try):
- **Channel 1:** `WebFetch https://code.claude.com/docs/en/hooks`.
- **Channel 2:** `mcp__deepwiki__ask_question` on `anthropics/claude-code`.
Two WebFetch to the same domain is NOT dual-channel. Quote a line from each (T3).
Verify, quoting doc lines per claim:
1. **Output-readability (the load-bearing question):** does the `SubagentStop` stdin payload give a way to read the subagent's final output/transcript so the hook can scan it for REPORT sections? (e.g. `agent_transcript_path`, `last_assistant_message`, `agent_id`). **If the payload exposes NO readable output → the WARN cannot inspect anything → mark INCONCLUSIVE, write the REPORT + DECISION-NEEDED, and do NOT ship a hook that scans nothing (that's T-108-A `#discipline-theatre`).**
2. **Non-blocking confirm:** confirm plain stdout / stderr semantics for `SubagentStop` and that **exit 0** is non-blocking (exit 2 = block — we are NOT using it). Confirm whether stderr is surfaced to the user/orchestrator.
3. **Canonical stdin JSON shape** for `SubagentStop` (you need it for the STEP-2 smoke test — do NOT approximate from another event).

## STEP 2 — IMPLEMENT the WARN hook (only if STEP-1 readability VERIFIED)
- `.claude/hooks/warn-subagent-report.sh` (deterministic bash; `# @cc-only-rationale: internal orchestrator hook, maintainer-env only, no portable fire-point`).
- **Which field to scan (load-bearing — resolves the scan-nothing trap, B1):** `last_assistant_message` is OPTIONAL (often absent); `agent_transcript_path` is REQUIRED (a JSONL file). **Priority:** if `last_assistant_message` is non-empty → scan it. **Else** open `agent_transcript_path` as JSONL and extract the subagent's final assistant text — **reuse the exact pattern already in [`.claude/hooks/end-of-turn-reminder.sh:30-41`](../../hooks/end-of-turn-reminder.sh)** (grep `"type":"assistant"` lines → tail to last → `jq -r '.message.content[]? | select(.type=="text") | .text'`). Read that file before writing yours. If BOTH yield empty → silent exit 0 (genuinely nothing to scan; not theatre because the *capability* to scan was verified — note this distinction in REPORT).
- Required REPORT sections to check for: **`VERIFY`, `Confidence`, `ATTN`** (the three load-bearing; keep the required-set small + documented in a comment). If ≥1 missing (and the noise guard says this IS a REPORT) → **stderr**: `⚠ SubagentStop: REPORT missing section(s): <list>` and **exit 0**. All present → **silent exit 0**.
- **Noise guard (concrete, not prose — M1):** warn ONLY when BOTH hold: (1) `agent_type` is NOT a known read-only type — **skip entirely (silent exit 0) when `agent_type` ∈ {`Explore`}** (this is the reliable negative filter the payload gives you; extend the skip-set only with types you can name); AND (2) the scanned text carries a REPORT cue as a **standalone label**, matched by `grep -qE '(^|\n)(#{1,3} *VERIFY\b|VERIFY:|Confidence:|ATTN:|Commit:)'` — a bare word "report"/"confidence" in prose must NOT match. Document the exact regex in a comment. Warn-on-everything OR skip-everything are both T-108-A theatre.
- Paired self-test `packages/core/hooks/warn-subagent-report.test.ts` (structure mirrors `inject-subagent-digest.test.ts` for stdin-payload plumbing, but you MUST exercise BOTH read paths — M2/M3):
  - **positive-A** (`last_assistant_message` path): payload carries a REPORT-shaped string missing `ATTN` → stderr lists `ATTN`, exit 0.
  - **positive-B** (`agent_transcript_path` path): write a REAL temp JSONL fixture file on disk (assistant turn with REPORT text missing `Confidence`), pass its path in the payload → stderr lists `Confidence`, exit 0. (The mirror test never touches disk — you must create the fixture; without it the path silently no-ops and the test false-greens.)
  - **negative** = a complete REPORT (all 3 sections) → silent, exit 0.
  - **negative-2** = `agent_type: "Explore"` with a non-REPORT blob → silent, exit 0 (noise guard holds).
  - T-108-A: prove it actually warns (A+B) AND is correctly silent (both negatives).

## DISCIPLINE (must hold)
- **dual-implementation-discipline**: CC-native internal hook → CC-native-only fine; `@cc-only-rationale` header (above).
- **no-paid-llm-in-ci**: deterministic bash only, zero API/LLM.
- **Capability-commit**: the new test file likely ≥80 LOC under `packages/` → capability commit → `Prior-art:` trailer required: `Prior-art: prior-art-evaluations.md#108 (SubagentStop REPORT-schema gate — candidate-3 of #108, shipped as WARN per maintainer decision 2026-06-01; block dropped — judgment target, #gate-where-judgment-needed).`
- **§1.7 PR body**: exact `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` headers (each body ≥40 non-ws chars, Forward needs ≥1 `file.ext:NNN` citation). CI gate `discipline-self-check.yml`.
- **settings.json is SELF-PROTECTED** — you write the hook + test + the exact `SubagentStop` wiring snippet IN THE PR BODY for the maintainer to land. Do NOT edit `.claude/settings.json` (reading it to draft the snippet is fine).

## T-TRAPS ACTIVE (.claude/rules/ai-laziness-traps.md §2)
- **T20 / own-stack-first** — verify the SubagentStop contract with a tool call before any claim.
- **T16** — does SubagentStop actually expose the subagent's output? If not, the whole WARN is inert — confirm, don't assume.
- **T3** — every contract claim = quoted doc line.
- **T-108-B (verify-the-easy-field-not-the-format)** — confirming `agent_transcript_path` exists in the TS type ≠ knowing the JSONL line format you must parse. Verify the actual transcript JSONL shape (look at a real session transcript / the `end-of-turn-reminder.sh:30-41` parser), not just the type signature.
- **T-108-A (gate-fires-but-does-nothing)** — a WARN that scans nothing, or warns on everything, is theatre. Positive (both read paths) + negative + Explore-skip tests are mandatory.
- **T15 self-application** — the hook must pass its own smoke-test before you claim it works.
- **reviewer-discipline §2** — if STEP-1 surfaces a real fork, surface DECISION-NEEDED, don't decide.

## VERIFY / FINISH
- `bash .claude/hooks/warn-subagent-report.sh < test-input` smoke (positive warns to stderr+exit0; negative silent+exit0) — use the STEP-1 canonical stdin shape.
- **Marker gate:** the repo's `check-hook-marker.sh` PostToolUse hook fires on edits to `.claude/hooks/*.sh` and requires `@dual-pair` or `@cc-only-rationale` — confirm your `@cc-only-rationale` header is in place (else the edit is blocked / `check:all` fails).
- `npm test` for the new test → green. `npm run check:all` → green (fallback `npm test`+`npm run lint` if aggregate unavailable; report which you ran).
- **settings.json snippet:** model it structurally on the EXISTING `SubagentStart` entry in `.claude/settings.json` (a no-matcher single-hook array), NOT on the `Stop` entry. Put it in the PR body for the maintainer to land.
- Commit (capability + Prior-art trailer). Push. ONE PR → base `staging`, title `feat(hooks): SubagentStop REPORT-schema WARN (non-blocking, #108 candidate-3)`, §1.7 body + the settings.json wiring snippet. Do NOT merge. Do NOT edit settings.json.

## REPORT back (strict)
- STEP-1: per-item dual-channel result + quoted doc lines + VERIFIED/INCONCLUSIVE (esp. output-readability).
- Files + diff stat. Commit SHA. VERIFY outputs (smoke + test + check:all). settings.json snippet.
- DECISION-NEEDED (if any) + ATTN. Confidence with explicit predicates.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
