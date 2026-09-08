# Dynamic context window — bounded compaction + handoff continuity

> **Rigor label (L0, effort-worthiness §2):** `build-and-verify` — reversible, operator-axis
> hooks plus one settings key; no consumer-shipped surface, no irreversible action.
> **Status:** SUPERSEDED IN PLACE by round 2. Final shape after two cold review rounds: the
> PAIR ships (compaction point + explicit window declaration, D3+D12); stage B is withdrawn as
> immaterial (F5); the enforcement gate is re-scoped to its own design round (D13). The A+B/C
> staging that decision D1 authorised did not survive its own review — see §Changelog round 2.

## Context

A session on a 1M window today climbs until Claude Code's own untuned auto-compaction fires,
and the repo's context arm (`.claude/hooks/end-of-turn-reminder.sh:189-353`) responds by
advising the operator to write a handoff and continue in a FRESH session. Two defects follow.

First, the advice is prose, not a mechanism — the class that already failed twice in one
session (F10, `.claude/rules/autonomous-loop-continuity.md`), and that
`.claude/rules/attention-is-not-a-mechanism.md §1` forbids as a detection layer.

Second, and measured during this design pass: `.claude/hooks/precompact-residue.sh` writes a
deterministic residue at every auto-compaction, and nothing reads it. Its only named reader is
`/pipeline` §1 (`.claude/skills/pipeline/SKILL.md:87`). Every compaction outside a `/pipeline`
invocation therefore writes a handoff that nothing consumes — `#warning-nobody-reads` with the
file already on disk.

The gap is wider than "a hook forgot to read a file". Round-1 cold review established that this
repo has **no SessionStart hook capable of injecting anything at all**. Despite its name,
`.claude/hooks/inject-session-bootstrap.sh` is registered under `UserPromptSubmit`
(`.claude/settings.json`; the script's own header says so), and the single registered
`SessionStart` entry is `scripts/link-coordination.sh`, invoked with `>/dev/null 2>&1` so its
stdout is discarded by construction. Stage B is therefore a NEW hook on an unused event, not an
edit to an existing reader.

### Verified environment facts (2026-09-08)

| Fact | Evidence | Consequence |
|---|---|---|
| `autoCompactWindow` setting exists | strings in Claude Code 2.1.233 native binary; settings-reference table row | bounded compaction is a setting, not a capability |
| Its units are an ABSOLUTE TOKEN COUNT, range 100000–1000000, default unset | settings-reference.md#autocompactwindow, fetched 2026-09-08 | `300000` is expressible and in range |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` overrides the setting, same units | settings-reference.md, fetched 2026-09-08 | env-var delivery path exists |
| Stop hook blocks via top-level `decision: "block"` + `reason`; `permissionDecision` is PreToolUse-only | hooks.md, fetched 2026-09-08; matches live `end-of-turn-reminder.sh:477,698` | the band gate reuses proven machinery |
| `stop_hook_active` IS in Stop's stdin | hooks.md, fetched 2026-09-08 | loop guard available to the band gate |
| SessionStart `source` values include `compact`; output injects via `additionalContext` | hooks.md, fetched 2026-09-08 | re-injection path exists |
| Compaction summary keeps intent, concepts, files, errors, pending tasks; DROPS full tool outputs and intermediate reasoning; re-reads recently modified files | context-window docs, fetched 2026-09-08 | the handoff's real job is reasoning + rejected alternatives, not "what am I doing" |

**K-pass note (§1.5 step 4).** The first research distillate claimed `autoCompactWindow` was a
fraction defaulting to `0.9`, and claimed Stop blocks via `permissionDecision: "deny"`. Both
were wrong. The second claim contradicted a live production hook in this repo, which is what
triggered re-verification. A spec written on the unverified distillate would have shipped
`autoCompactWindow: 0.3` — below the documented minimum. Recorded because the K-pass paid for
itself on its first use in this contour.

**Drill-downs (§1.5, cap 3, all recorded):** (1) `strings` over the CC native binary —
confirm the setting key exists at all; (2) settings-reference.md — confirm the key and scope;
(3) context-window docs — compaction semantics. Reason for going direct rather than one
round-trip to the producing seat: `SendMessage` is disabled in this session, so the
membrane-preserving first choice was unavailable; a fresh cold seat re-verified instead.

## Decision

Three layers, staged. Stage A+B ship together; stage C is gated.

- **A — bounded compaction (settings).** `autoCompactWindow: 300000`, so compaction fires at a
  chosen point rather than at an untuned one. Delivery per D9.
- **B — the missing reader.** A NEW hook, registered on `SessionStart`, reads the residue and
  injects it via `hookSpecificOutput.additionalContext` when `source == "compact"`. Closes the
  written-but-unread gap. It does not touch `inject-session-bootstrap.sh`, which serves a
  different event.
- **C — the handoff-maintenance band (GATED, not authorised by this spec).** From the soft
  floor onward, the Stop hook blocks the turn until the handoff's content has changed, with a
  `mechanical-tail:` escape token.

### Live decision register

| Decision | Status | Resolution | Falsifier |
|---|---|---|---|
| D1 — stage C now, or after a measurement | answered (operator) | B now; C gated on D8's measurement | Wrong if the D8 measurement shows the compaction summary loses decisions badly enough that a continuation follows a false trail — then C was needed immediately |
| D2 — does the session become effectively endless | answered (operator) | Yes, that is the goal. The fresh-session advice in the context arm is retired as unreachable | Wrong if quality degrades measurably across 2-3 successive compactions, making a clean window worth the restart. Independent support: Amp retired its Handoff feature in favour of automatic compaction (§Prior art) |
| D3 — the compaction point | from premise 1, verified in range | `autoCompactWindow: 300000` | Wrong if 300k proves too low and compaction churns (thrash: compact, re-read files, re-climb) — symptom is repeated compaction within few turns |
| D4 — band-gate enforcement (stage C) | author-decided | `decision: "block"` + `reason`, escape token `mechanical-tail: <rationale ≥20 chars>`; freshness judged by CONTENT change, never mtime | Wrong if content-hash comparison is defeatable by trivial appends in practice — then the gate needs a required-section schema |
| D5 — which SessionStart sources re-inject | author-decided | `compact` only; `startup`/`resume`/`clear`/`fork` return without output | Wrong if `resume` sessions also arrive without their residue and the operator notices the gap |
| D10 — channel for stage B, after round-1 correction | author-decided (round 1) | A NEW `SessionStart` hook. REJECTED alternative: piggyback the already-registered `UserPromptSubmit` injector and detect a just-happened compaction from residue mtime. Rejected because it fires on the operator's NEXT prompt, which in an autonomous loop may be many turns later or never — the sessions that most need continuity are exactly the ones that would not get it | Wrong if registering a new `SessionStart` hook proves impossible in practice, in which case the rejected alternative returns as the degraded path |
| D11 — who registers the hook and the setting | author-decided (round 1) | Both stage A's `autoCompactWindow` and stage B's hook registration land in `.claude/settings.json`, which is agent-uncommittable (deny-list entries at `.claude/settings.json:56-57`). They bundle into ONE operator hand-action, delivered as a copy-paste block by the implementing task. The env var `CLAUDE_CODE_AUTO_COMPACT_WINDOW` remains the no-settings fallback for stage A only | Wrong if the operator declines the hand-action, in which case stage B is undeliverable and only the env-var half of stage A survives |
| D6 — the handoff artifact | author-decided | Reuse the existing residue file. Stage C's model-authored section is additive; the PreCompact writer must never overwrite it | Wrong if one file with two writers races at compaction time — then split into sibling files |
| D7 — audience axis | author-decided | Operator-axis / framework-internal only, matching `precompact-residue.sh`'s own `@cc-only-rationale` (dual-implementation-discipline §3) | Wrong if consumers hit the same unread-residue gap — widening is then a separate decision, never a side effect |
| D8 — what gates stage C | author-decided | ONE real post-compaction session, reviewed by a seat cold for it: compare the pre-compaction transcript against the post-compaction summary plus residue, and list what a continuation needed but did not have. Owner: the session that ships B. Trigger: first auto-compaction after B merges | Wrong if no session compacts within a reasonable window — then the measurement needs a synthetic fixture instead |
| D9 — how the setting is delivered | OPEN — verify at implementation | `.claude/settings.json` is tracked but agent-uncommittable by harness policy; the renderer owns only `hooks`. Either the operator hand-applies the key, or delivery rides `CLAUDE_CODE_AUTO_COMPACT_WINDOW` in the shell environment | Wrong if the harness renderer can in fact own non-hook keys — then A becomes a rendered artefact |

## Testing seams

One existing seam per changed unit, no new harness:

- Stage B: a NEW test beside the existing hook family in `packages/core/hooks/`. Round-1 cold
  review established there is no `SessionStart`-`source` fixture anywhere in the repo to copy,
  and that the nearest-named test, `inject-session-bootstrap.test.ts`, asserts its subject
  ignores stdin — so it is neither the seam nor a template. The new fixtures: a stdin payload
  with `source=compact` plus a residue on disk must emit that residue as
  `additionalContext`; `source=startup` must emit nothing; a missing residue must exit clean
  and silent.
- Stage C (when authorised): `packages/core/hooks/end-of-turn-reminder.test.ts` is the seam —
  the arm under test is a sibling of the existing F10 block arm. Fixtures: transcript above
  the floor with an untouched handoff → block; same with the escape token → allow; below the
  floor → allow; `stop_hook_active` set → allow, so the gate cannot loop.

## Consequences

- The context arm's fresh-session advice becomes wrong text and must be retired in the same
  change (D2), or it will keep advising an action that no longer applies.
- The deep floor (500k) becomes unreachable while compaction sits at 300k. It is not deleted;
  it becomes the arm for a session running with compaction disabled.
- Stage C is the only part that costs turns, and it is not authorised here.
- The residue file gains a second reader, so its format is now load-bearing for two consumers
  (`/pipeline` §1 and the injector) — a format change must consider both.

## Prior art (research pass 2026-09-08; every source fetched that day)

The operator's premise 4 cited "the latest GPT/Codex" as inspiration. It checks out, with a
correction that matters.

**OpenAI Codex CLI** ships this shape today, roughly three weeks old at the time of this pass.
Behind `features.context_management.experimental_mode` (stage `UnderDevelopment`,
`default_enabled: false`, gated to ChatGPT Plus/Pro auth) it exposes a private `notes` tool
described as notes "that survive context-window transitions within this rollout", an
ID-addressable `history` tool to "Recover prior conversation after a context-window reset", a
per-turn developer message telling the model to "take incremental notes while you work", a
one-shot reminder at `reminder_threshold_tokens` (default 6144 tokens REMAINING), and a
`auto_compact_fallback_buffer_tokens` overdraft (default 16384) reserved so the last note can
still be written. Its rollover then "skips model/server summarization and installs a fresh
context window" — the notes ARE the handoff. Claude Code offers no equivalent
skip-the-summary rollover, so this design keeps the summary and adds the handoff beside it.

**Where the components stand:** a model-written artifact surviving the reset (Codex `notes`,
Amp Handoff 2025-10, Cline Focus Chain, Anthropic `memory_20250818`), a warning band before
the threshold (Anthropic context editing warns "to preserve important information"; Codex's
6144/16384 pair), rolling refresh on a cadence (Cline `remindClineInterval: 6` messages;
Codex's per-turn guidance), and compacting at a chosen point below the hardware edge (Codex
`model_auto_compact_token_limit`; Amp at 90%) are ALL settled prior art. Stage A and stage B
of this design are therefore reuse, not capability.

**The novel component is enforcement.** Across the seven systems examined — Codex, Amp,
Cline, Cursor, Windsurf, Aider, Roo — plus the Anthropic context-editing API, the handoff
write is prompted and never gated. Codex even ships a `Stop` hook with `decision: "block"`
and PreCompact hooks that can abort a turn, and wires neither to verifying a note exists.
No system or paper was found that makes turn completion conditional on the handoff being
current. That is exactly the `#hope-as-gate` → deterministic-gate conversion of
`.claude/rules/attention-is-not-a-mechanism.md §2`, applied to context management. This is
what stage C would contribute, and it is the reason C is worth building IF D8 shows loss.
Scope caveat carried from the research: the negative claim is bounded by the systems actually
examined, not the full product landscape (OpenCode, Gemini CLI, Devin, Zed and others were
not checked).

**Counter-evidence, recorded because it is the strongest argument against.** Amp built
handoff-instead-of-compaction, shipped it 2025-10-23, and retired it 2026-05-06: "Handoff is
gone. As described above, compaction made it obsolete", replaced by "Compaction now runs
automatically when the context window is 90% full" (spot-checked directly against the source
during this pass — the quote reproduces). Qualification: Amp's Handoff was human-initiated
(`/handoff` or asking the agent), so it may have died of friction rather than of design, and
an automatic enforced version is not obviously the thing they retired. That reading is
consistent with the evidence but is not stated anywhere — UNVERIFIED. Either way it argues
for this spec's staging: ship the cheap deterministic half, measure, then decide on the gate.

**Evidence for the other side.** "Governance Decay: How Context Compaction Silently Erases
Safety Constraints" (arXiv 2606.22528, 1,323 episodes across 7 model families) measures
standing-constraint violation rising from 0% with the policy in full context to 30% after
compaction, up to 59%, and proposes quarantining constraints from lossy compaction. For a
repo whose thesis is that rules must survive to the channel where they fire, that is the
failure mode named and quantified — and it is the sharpest available statement of what
stage C would be protecting.

**Band width is untested territory.** Every prior band is a thin edge: Codex's 6144 tokens of
a 272k window is about 2%, and the Anthropic trigger is a single point. A band from 200k to
300k on a 1M window is roughly 10%, with many turns of redundant refresh, betting that the
write cost is below the re-derivation cost. No prior art sizes a band this way, and none
validates one. Stage C must therefore carry its own measurement rather than lean on precedent.

## Operator premise register (verbatim-faithful, 2026-09-08)

1. «выставить окно контекстное лимитное» — bound the compaction point rather than let it sit
   at an untuned default.
2. «после 200к контекста просто чтобы каждая сессия уже начинала каждый вызов вести и
   обновлять хендов свой» — from ~200k every turn maintains the session's own handoff.
3. «если только не совсем немного осталось механической работы» — exemption when only a small
   mechanical tail remains; this is the origin of the `mechanical-tail:` escape token.
4. «тогда автоматическое сжатие например на 300к контекста будет всегда норм потому что будет
   всегда хендов для продолжения идеи» — compaction at ~300k is safe because a current handoff
   always exists.
5. «только токены не трать сильно на ее проверку фабла нет почти всю работу и проверку в аиф
   диспетч и опус» — token economy: verification and build belong in aif and Opus, not in a
   top-tier authoring session.
6. Answered in dialogue: stage B first with C gated on measurement (D1); an endless session is
   the goal and the fresh-session advice should go (D2).

Premise 2's threshold (200k) is NOT carried into stage A/B: the band it describes belongs to
stage C, which is gated. When C is authorised, its floor is a live decision, since the repo's
calibrated soft floor (300k) now coincides with the compaction point rather than preceding it.

## Changelog

### Round 1 — cold bottom-up seat, 2026-09-08

- **B1 — the named SessionStart injector is a UserPromptSubmit hook. FIXED.** Verified
  independently against the live `.claude/settings.json` hook registrations before accepting.
  Stage B was rewritten from "teach the existing injector to read the residue" to "add a new
  hook on an event this repo does not currently use". Consequence recorded as D10.
- **M1 — the cited stage-B testing seam was the wrong file. FIXED.** The seams section now
  names a new test and states why no existing fixture can be copied.
- **Minor — `end-of-turn-reminder.sh` line citation overshot its block by seven lines. FIXED.**
- **D9's settings.json constraint — ACCEPTED, absorbed as D11.** The seat confirmed the
  enforcing mechanism is real deny-list entries rather than repo prose, which upgrades D9 from
  an open question to a settled constraint with a named delivery plan.

### Round 2 — cold top-down seat, 2026-09-08

Seven findings plus two escalations. Verified independently before disposition; the two that
changed the design are recorded first.

- **F3 — stage A silently re-scales the shipped D7 context arm. ACCEPTED, and it is the most
  important finding of this contour.** Verified on code: the arm resolves its window as
  DECLARED (`AIF_CTX_WINDOW`) → OBSERVED (the ceiling `precompact-residue.sh` records at each
  auto-compaction) → 1000000 default (`end-of-turn-reminder.sh:297-315`), then derives
  `soft = min(300000, 70% of window)` and `deep = min(500000, 90% of window)`
  (`end-of-turn-reminder.sh:332-337`). Setting `autoCompactWindow: 300000` makes the observed
  ceiling 300000, so the floors become 210000 and 270000 and the arm fires at 21% and 27% of a
  real 1M window — the same class as the four measured wrong session stops of 2026-08-16/17
  that the arm was rebuilt to prevent, and it fires in EVERY repo, since
  `plugin/hooks/end-of-turn-reminder` ships to consumers. The `ctx_tokens > ctx_window` escape
  never rescues it, because after compaction usage stays below the poisoned ceiling.
  **Resolution:** stage A is not one setting. It is the pair — `autoCompactWindow: 300000`
  AND an explicit `AIF_CTX_WINDOW=1000000` declaration, which wins the cascade outright. The
  pair is now the unit; shipping the setting alone is a regression.
- **F1 — the rule layer across compaction. DISSOLVED by evidence.** The concern was that this
  repo's rules are session-scoped loads and would be lost, pushing enforcement later down the
  channel ladder. Checked against the vendor's own context-window model: only the skill-
  descriptions listing carries `noSurviveCompact: true`; both `~/.claude/CLAUDE.md` and the
  project CLAUDE.md are startup auto-loads without that flag, and path-scoped rules carry
  `restoredAfterCompact: true`. So CLAUDE.md survives and `paths:`-scoped rules are restored.
  The residual, now recorded as a real but smaller fact: **the skill listing does NOT survive
  compaction**, so after a compaction skills stop auto-triggering by description and must be
  invoked by name. That belongs in the verified-facts table, not in a blocker.
- **F5 — stage B ships the pipe without the payload. ACCEPTED, and it changes the verdict on
  B.** The residue body is the last model-authored recap slice or the last 60 lines of
  assistant text — that is "what am I doing", which the compaction summary already preserves.
  Combined with F1, the content actually lost at compaction is intermediate reasoning and
  rejected alternatives, which is stage C's payload and not stage B's. Stage B as specified is
  therefore close to immaterial by effort-worthiness test 3.
- **F4 — D8 is a promise, not a mechanism. ACCEPTED.** Its owner ends at merge, no channel
  carries the obligation, it states no decision rule, and it prescribes comparing against a
  pre-compaction transcript that nothing snapshots. A gate for C must be a named channel with
  a threshold, or C is simply authorised or not on its own merits.
- **F6 — the audience premise is false for the touched artifacts. ACCEPTED.** Verified:
  `plugin/hooks/end-of-turn-reminder` and `plugin/hooks/inject-session-bootstrap` both exist as
  consumer twins, and `plugin/hooks/session-start` already runs with matcher
  `startup|clear|compact`. So the arm stage A perturbs IS consumer-shipped, and any stage-B
  hook placed in the plugin tree would ship a residue reader to consumers who receive no
  residue writer. D7's operator-axis claim holds only for `precompact-residue.sh` itself.
- **F2 — wrong hook event. FIXED in round 1** (see above).
- **F7 — stage A has no testing seam and no repo artifact. ACCEPTED as a known limit**, now
  material because F3 makes A the widest-blast-radius change. Both delivery branches are
  invisible to the repo, so no session can confirm which configuration it is running in.
- **E1 — env-var delivery is machine-global. ESCALATED to the concept holder.** Whether
  bounded compaction should apply to every Claude Code session on the machine, or only to this
  project, is a value the reviewer must not price. With F3 attached, the global branch would
  also export the floor re-scale everywhere.
- **E2 — how much post-compaction degradation buys an endless session. ESCALATED.** D2's
  falsifier is disarmed by the decision it is attached to, since D2 removes the very prompt
  that would surface degradation.
- **Notes lane N1-N6 — recorded, not round-triggering.** N1 (the writer truncates the whole
  file, so D6's never-overwrite promise needs a read-merge-write restructure) and N4 (session-id
  continuity across compaction is assumed, not verified) both bite only when C lands and belong
  to C's own design round. N5 (missing doc-authority header) is a convention gap at this path.

### Round-2 consequence: the staging cut does not survive its own review

With F1 dissolved and F5 accepted, the honest position is that stage B — the half authorised
by decision D1 — carries little. What compaction actually destroys is intermediate reasoning
and rejected alternatives, and only stage C captures those. Meanwhile F3 shows stage A is
safe only as a PAIR with the window declaration. The A+B/C cut is therefore superseded, and
the choice among the surviving options is the concept holder's — recorded in the handoff, not
decided here.

## Final disposition (2026-09-08, after round 2)

- **D1 REVISED (operator, post-review).** The original "B now, C after measurement" is
  withdrawn. What ships now is the PAIR only. The gate gets its own design round rather than
  riding along as a stage — the operator's stated reason being that the gate is the one part
  with no precedent anywhere and three unresolved design questions, and unresolved decisions
  are most expensive when settled inside an implementation.
- **D12 — delivery scope. Author-decided, not escalated.** Project-scoped
  `.claude/settings.json`, NOT the machine-global env var. E1 asked the operator to price this;
  it does not need pricing, because for an untested settings pair the reversibility measure
  decides it outright: a project key is one edit to revert and is visible in git, while a shell
  export propagates silently to the aif container and the PC sessions. **Widening trigger,
  recorded so the second step is not left to memory:** widen to the machine only after this
  repo has run through at least three auto-compactions with no observed misfire of the D7 arm,
  and record the widening in this file. Absent that record, the scope stays project-local.
- **D13 — the gate's own round.** The enforcement gate (formerly stage C) is the surviving
  proposal: from a floor to be chosen, the Stop hook blocks the turn until the handoff's
  content has changed, with a `mechanical-tail:` escape token. Three questions must be settled
  in ITS design round, not in implementation: (a) where its floor sits now that 300000 is the
  compaction point rather than the degradation warning; (b) how the PreCompact writer stops
  truncating the whole residue file, since D6's never-overwrite promise requires a
  read-merge-write restructure (round-2 note N1); (c) whether its payload is a new
  model-authored section or a restructured residue, given that the compaction summary already
  preserves "what am I doing" and only intermediate reasoning and rejected alternatives are
  actually lost.
- **Stage B — WITHDRAWN.** Not rejected on principle: it is the injection pipe the gate will
  need, and it should be built WITH the gate, when there is a payload worth injecting. Building
  it now would ship a channel whose content duplicates the compaction summary.
- **D4, D6, D10, D11 — carried forward to D13's round** as inputs, not as settled decisions.

### What ships now, exactly

Two keys in `.claude/settings.json`, applied together. They are a pair by construction: the
first without the second re-scales the shipped D7 context arm to fire at 21% and 27% of the
real window (round-2 finding F3).

```json
{
  "autoCompactWindow": 300000,
  "env": { "AIF_CTX_WINDOW": "1000000" }
}
```

Delivery is an operator hand-action: `.claude/settings.json` carries
`Edit(.claude/settings.json)` and `Write(.claude/settings.json)` on its own permission
deny-list, so no agent session can apply this. The file already has an `env` block, so the
second key is an addition to it rather than a new block.

**Verification after applying, since D-F7 correctly noted stage A has no repo-visible seam:**
the next auto-compaction should occur near 300k rather than near the model default, and the
context arm's soft line should still quote a window of roughly 1000000 rather than 300000. A
soft line quoting 300000 means the declaration did not take, and the pair must be reverted
until it does.
