# Hook-nudge orchestration-mode — design spec

> **Date:** 2026-06-01.
> **Authoritative for:** the design of orchestration-mode-aware behaviour for the two reminder hooks (`end-of-turn-reminder.sh`, `ask-question-reminder.sh`) — the marker mechanism, the in-mode behaviour changes, the brainstorm nudge, and the test matrix.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The hook's surviving recap/fork-check semantics — see [`research-patches/2026-06-01-remove-claim-detector.md §4`](../../meta-factory/research-patches/2026-06-01-remove-claim-detector.md). The plain-language-tail checkpoint substance — see [`references/plain-language-tail.md`](../../../.claude/skills/pipeline/references/plain-language-tail.md).
>
> **Origin:** 2026-06-01 brainstorm of the question-loop battle-test tail (memory `qloop-hook-brainstorm-handoff`, items 2 + 6). The maintainer LOVES the hook in normal interactive mode; the problem is confined to *orchestration mode* (driving aif-handoff, relaying state every turn).

---

## §1 Problem

In **orchestration mode** (an interactive session driving the aif-handoff runtime, relaying task state turn after turn), the two reminder hooks misbehave — but ONLY in that mode. Two distinct defects, confirmed against the hook source:

1. **False fork-challenge (`end-of-turn-reminder.sh:83-85`).** The `asked` heuristic sets `asked=true` when the tail-500-chars match `Option [AB]|выбирай|decide|хочешь чтобы|which (option|approach)` **anywhere** — it cannot distinguish *asking a fork* ("Which option — A or B?") from *mentioning a decision* ("я выбрал Option A", "agent parked with Option A/B"). In orchestration mode I relay decisions every turn → Branch B fork-challenge cry-wolfs. Same low-precision class the project already dropped twice (claim-detector recall 0.43 / precision 0.20, [`remove-claim-detector.md`](../../meta-factory/research-patches/2026-06-01-remove-claim-detector.md); narrow-B FP 84%, [`narrow-b-benchmark.md`](../../meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md)).

2. **Recap under-fires where it is most wanted (`end-of-turn-reminder.sh:69-73`).** `long_text` requires `text_length > 500` AND markdown structure. In orchestration mode the valuable status turns are *short and dense* (decision relays) → below threshold → the **recap never fires**. Yet [`references/plain-language-tail.md`](../../../.claude/skills/pipeline/references/plain-language-tail.md) declares the recap **mandatory at orchestrator checkpoints "regardless of turn-length"**. Net effect during the battle-test: the maintainer got the *noise* (false fork-challenge on short relays) **without** the *value* (the simplifying recap).

A third, smaller item rides along (item 6 of the brainstorm): **brainstorm-mode under-fires.** `superpowers:brainstorming` is triggered by a semantic skill description (best-effort, under-fires). The fix channel already exists — `ask-question-reminder.sh` fires deterministically the moment an `AskUserQuestion` is about to post.

**Hard constraint (maintainer):** normal interactive mode must stay **byte-for-byte** as today. The maintainer values the full hook there; all changes are gated behind an explicit mode marker.

## §2 Design intent grounding

- The hook's **primary purpose is the recap**; low-precision triggers get removed, not kept ([`remove-claim-detector.md §0/§4`](../../meta-factory/research-patches/2026-06-01-remove-claim-detector.md)). Both changes below follow that established philosophy: drop the low-precision fork-regex *in mode*; make the high-value recap reachable *in mode*.
- aif-handoff is foreign (`lee-to/aif-handoff`, SSOT #27) — irrelevant to this spec except as the reason orchestration mode exists; nothing here touches aif.

## §3 Components

### 3.1 Mode marker (one deterministic signal)

A marker file `.claude/orchestration-mode`. A hook is in orchestration mode iff the marker exists **and is fresh** (mtime within a TTL — guards against a forgotten marker silently muting normal sessions forever).

- **Path resolution (test-hermetic):** `MARKER="${ORCHESTRATION_MODE_MARKER:-${CLAUDE_PROJECT_DIR:-.}/.claude/orchestration-mode}"`. The env override lets tests point at a temp file without writing into the repo.
- **Freshness TTL:** default 6h (`ORCHESTRATION_MODE_TTL_SECONDS`, default `21600`). `now - mtime > TTL` → treated as absent (stale).
- **Lifecycle:** the orchestrator/meta-orchestrator session creates the marker at orchestration start (`touch`) and removes it at end. Re-`touch` on activity keeps it fresh; the TTL is the backstop, not the primary clear.
- **Why a file, not an env var:** Stop hooks do not reliably inherit session env; a file is checkable by any hook with `[ -f ]`. (Rejected: env var — inheritance unreliable; transcript auto-detect — semantic/fragile.)
- A tiny shared resolver is acceptable (a 5-line `orchestration-mode.sh` sourced by both hooks) OR inline-duplicated 5 lines — decided at plan time; if shared, it carries a `@dual-pair` anchor per [`dual-implementation-discipline.md`](../../../.claude/rules/dual-implementation-discipline.md).

### 3.2 `end-of-turn-reminder.sh` — in-mode behaviour (normal mode untouched)

Read `orch_mode` once near the top (after the existing guards). Then:

- **Bug A fix (gated):** in the `asked` block, when `orch_mode=true`, **skip the decision-word `elif` regex** (`:83-85`). `asked` then triggers on `has_askuserquestion` OR a trailing `?` only. Genuine forks come via `AskUserQuestion` (still caught); inline questions end in `?` (still caught); decision **mentions** (declarative, no `?`) stop firing.
  - Residual (accepted): an imperative fork without `?` and without AUQ in-mode would be missed — but the fork-surfacing discipline routes such forks through `AskUserQuestion` anyway ([`recommendation-laziness-discipline.md §3`](../../../.claude/rules/recommendation-laziness-discipline.md)).
- **Recap fix (b), (gated):** when `orch_mode=true`, lower the `long_text` char threshold from `500` to a smaller value (`ORCHESTRATION_MODE_RECAP_MIN_CHARS`, default to be tuned at plan time, candidate `200`) **while keeping the markdown-structure grep gate** (`^#|^- |^\* |\*\*|```|link`). Short *structured* status fires the recap; short *unstructured* chatter ("ок, удалил") still does not.
- Branch A/B/C reminder **bodies are unchanged** — only the gating thresholds differ in mode.

### 3.3 `ask-question-reminder.sh` — brainstorm nudge (item 6, all modes)

Add one numbered point to the existing pre-question reminder (the hook already nudges "recommend-first"):

> «Если это развилка о дизайне/стратегии (а не быстрый A/B по фактам) — открой `superpowers:brainstorming` вместо голой карточки: исследуй → порекомендуй с аргументами, потом спрашивай.»

Always-on (design forks happen in normal mode too — this very session is the evidence). Stays a **prose nudge, not a gate** — the hook cannot mechanically tell design-fork from quick-fork, and gating a judgment call is `#gate-where-judgment-needed`. No new file (avoids `#two-prompts-drift`).

### 3.4 Brainstorm nudge on the aif-pull channel (item 6, recursive-self-application gap)

`ask-question-reminder.sh` only covers the path where *I* surface a question via `AskUserQuestion`. But aif-parked questions surface through a **different** channel — `questions.ts` `formatHuman` (`packages/runtime-bridge/src/cli/questions.ts:101-112`), the CC pull-channel I run to list parked aif forks. That output today carries no brainstorm cue, so an aif design-fork I read there and process without AUQ gets no "brainstorm-first" prompt.

**Fix:** when `formatHuman` returns a non-empty list, append a footer line:

> «⚠ Если среди этих есть развилка о дизайне/стратегии — открой `superpowers:brainstorming` ПЕРЕД ответом (исследуй → рекомендация с аргументами), не релей голой карточкой.»

Deterministic, fires every time aif questions surface. Prose nudge, not a gate (judgment). The empty case (`'No parked questions.'`) is unchanged. This is the **same discipline as §3.3, one channel over** — `#two-prompts-drift` is avoided because the two strings live at genuinely different surfacing points (I-ask vs aif-parked) and the wording is channel-specific.

> **Sequencing:** `formatHuman` is also touched by **item 4** (the mid-flight-park `isParked` fix). To keep `questions.ts` changes atomic-by-file and avoid a cross-PR conflict, this footer **ships inside item 4's PR**, not the hook-nudge branch. It is design-owned by this spec (item 6 family) but delivered with item 4's `questions.ts` reproduction. The hook-nudge umbrella (Tasks 1-3 in the plan) covers only `.claude/hooks/**`.

## §4 Test matrix (`packages/core/hooks/end-of-turn-reminder.test.ts`)

Marker injected via `ORCHESTRATION_MODE_MARKER` env pointing at a temp file (present/fresh, present/stale, absent).

| Case | Marker | Turn | Expected |
|---|---|---|---|
| Normal-mode regression (existing) | absent | all current cases | **unchanged** — every current assertion stays green |
| Bug A in-mode | fresh | short text "я выбрал Option A." (decision mention, no `?`) | **silent** (no fork-challenge) |
| Bug A in-mode, real Q | fresh | short text ending "… A или B?" | fires Branch B (trailing `?` still caught) |
| Bug A in-mode, AUQ | fresh | AskUserQuestion turn | fires Branch B (`has_askuserquestion`) |
| Recap (b) in-mode | fresh | short **structured** status (<500, markdown) | fires recap (Branch A) |
| Recap (b) in-mode, chatter | fresh | short **unstructured** "ок, удалил" | silent (markdown gate holds) |
| Stale marker = normal | stale (mtime > TTL) | short "я выбрал Option A." | behaves as normal mode (regex still active) |

`ask-question-reminder` has no companion unit test today; item 6 adds a grep-level assertion that the reminder text contains the brainstorm cue (lightweight, optional — decided at plan time).

## §5 Risks & mitigations

- **Stale marker mutes a normal session** → mtime TTL (§3.1); stale = absent.
- **Lowered threshold fires recap on trivial turns** → markdown-structure gate retained; only *structured* short turns qualify.
- **Brainstorm nudge over-fires** → prose nudge, not a gate; benign (worst case: an extra line the model reads and ignores).
- **Marker path drift between the two hooks** → shared resolver with `@dual-pair`, or identical inline 5 lines verified by a test.

## §6 Out of scope

- No change to aif-handoff (foreign runtime; SSOT #27).
- No change to normal-mode behaviour (hard constraint).
- The factual-claim scan stays removed (already done, `remove-claim-detector.md`).
- Items 1 (discipline PR), 3 (harvest rework-commit extension), 4 (questions.ts fix), 5 (cleanup) are tracked separately — not part of this umbrella.

## §7 Acceptance

1. Normal-mode test suite unchanged and green (byte-for-byte behaviour).
2. In-mode: decision-mention turn → silent; real question (`?`/AUQ) → fires.
3. In-mode: short structured status → recap fires; short chatter → silent.
4. Stale marker → behaves as normal mode.
5. `ask-question-reminder.sh` reminder text carries the brainstorm cue.
6. `@dual-pair`/marker-path consistency verified (test or shared resolver).
7. `formatHuman` (aif-pull channel) appends the brainstorm-nudge footer on a non-empty parked list; empty case unchanged. (Delivered in item 4's PR per §3.4; `aif-questions.test.ts` adds a footer-present assertion.)
