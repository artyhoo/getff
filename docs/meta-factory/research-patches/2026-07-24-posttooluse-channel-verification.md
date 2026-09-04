<!-- scope:posttooluse-channel-verification -->

# PostToolUse channel verification — exit-1 stderr never reaches the model

> **Authoritative for:** the live-verified CC hook channel model (§2) — which output
> channels of a CC hook reach the model vs the operator; the F1-class completion sweep
> (§3); corrections to the aif-parity S4 synthesis (§4).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The S4 two-axis checklist itself — see
> [2026-07-23-aif-parity-s4-synthesis.md](2026-07-23-aif-parity-s4-synthesis.md) (append-only;
> corrected here, not edited there).

## §1 Problem

Every PostToolUse gate in this repo except `check-doc-authority-header.sh` reported CC
violations via `stderr + exit 1`, and multiple hooks self-documented that channel as
«advisory feedback» to the agent (`check-hook-marker.sh` pre-fix line 25, `validate-prompt.sh`
pre-fix line 78 «re-emit captured stderr so the model sees it»). PR #1116 (aif-parity F1)
fixed the *dependency-skip* visibility for two hooks but deliberately left the VIOLATION
path untouched, stating it «was never demonstrated broken».

It is broken — for the consumer the framework's goal cares about. The violation feedback
reaches the **operator's transcript**, never the **model**. On an interactive session a
human may relay it (attention-as-authority, exactly what
[attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)
forbids as a detection layer); in an autonomous aif container **nobody** receives it.

## §2 Evidence — two live probes from the model's own vantage (2026-07-24)

Both probes ran in a real CC session (worktree `happy-stonebraker-eb9898`, hooks registered
via `.claude/settings.json`), with the session's model itself as the observer — not a
prose-documentation claim (per
[phase-research-coverage.md §1.10](../../../.claude/rules/phase-research-coverage.md), the
harness contract was additionally confirmed against code.claude.com/docs/en/hooks).

1. **exit 1 + stderr → model receives NOTHING.** A marker-less probe file written under
   `.claude/hooks/` made the registered `check-hook-marker.sh` fire its violation path
   (confirmed out-of-band: `exit=1`, full `❌ hook-marker: …` text on stderr). The model's
   turn context received zero bytes from it — while `inject-matching-rule.sh`'s JSON
   `additionalContext` from the same Write arrived normally.
2. **exit 2 + stderr → model receives the full text.** Same probe with the hook's violation
   exit temporarily set to 2: the complete violation message arrived in the model's context
   as a `PostToolUse … blocking error` block, verbatim.

Docs corroboration (code.claude.com/docs/en/hooks): exit 1 = non-blocking, «stderr is shown
to the **user** … does NOT reach Claude»; exit 2 = «stderr text is fed back to **Claude**»;
for PostToolUse exit 2 cannot block (tool already ran) — it is precisely «show stderr to
Claude». `additionalContext` is supported on all events incl. PreToolUse, Stop, SubagentStop.

**Channel model (CC, verified):**

| hook output | model | operator |
|---|---|---|
| exit 0 + stdout JSON `hookSpecificOutput.additionalContext` | ✅ | ✅ |
| exit 0/1 + bare stdout/stderr | ❌ | partially (transcript) |
| exit 2 + stderr | ✅ (verbatim) | ✅ |

## §3 Root cause + solution (the fix shipped with this patch)

**Root cause chain:** (a) the exit-1-reaches-the-model misconception was codified in hook
comments and a locked test contract (`check-doc-authority.test.ts` pre-fix :273 asserted
exit 1 as THE violation contract); (b) #1116's F1 sweep enumerated only criterion (b) of the
kickoff's class definition (bare-stderr **printers**), never criterion (a) (silent
`command -v jq … || exit 0` guards) — the T-APF-A trap the kickoff itself pre-named; (c) the
consumer hook `check-doc-authority-header.sh` had already adopted exit 2 with the correct
rationale, so the repo carried both the right and the wrong pattern simultaneously.

**Solution (all with paired tests; hook suite 61 files / 955 tests green):**

1. **Violation channel → exit 2** on all four PostToolUse gates:
   `check-doc-authority.sh`, `validate-prompt.sh`, `check-hook-marker.sh`,
   `check-kickoff-traps.sh` (ZCode arms unchanged: `{additionalContext}` + exit 0).
   13 test assertions flipped 1→2 across 4 test files.
2. **Criterion (a) closed — loud dependency-skips** on the remaining registered gates:
   `check-hook-marker.sh`, `check-kickoff-traps.sh`, `validate-prompt.sh` (jq guard now
   path-scoped), `warn-subagent-report.sh`, `runtime-bridge-dispatch.sh` (notice only for
   `<!-- bridge: auto -->` kickoffs — a silently swallowed dispatch), and the consumer
   surface `check-doc-authority-header.sh`. Skips announce via `hookSpecificOutput`
   with a jq-free escaper (sed/tr) and a jq-free crude path parse (sed) so the notice
   fires only on in-scope edits, not on every Edit/Write in a jq-less environment.
3. **`warn-subagent-report.sh` main warning** (not just its skip) now goes out as
   SubagentStop `additionalContext` — its consumer is the orchestrator model, which
   provably never received the stderr-only warning. WARN-not-block preserved (exit 0).
4. **`validate-prompt.sh` gh soft-skip** (validator exit 2 when `gh` is absent — the aif
   container's steady state) is now loud instead of a silent `exit 0`.
5. **Manual-twin sync + drift guard:** `plugin/hooks/validate-prompt` (a
   `@plugin-transform: manual` twin the generator never rewrites) had missed #1116's fix
   entirely — hand-synced now, with invariant tests in `validate-prompt.test.ts` that fail
   if the twin drifts from the source's skip/violation channels again.

**Deliberate NOT-APPLICABLE (documented, not skipped silently):**

- `ask-question-reminder.sh` — silent jq-skip kept: documented consumer-guard (GH #934
  «never error-spam a consumer's every AskUserQuestion»); its recency-flag logic needs jq.
- Pure injectors (`inject-matching-rule`, `end-of-turn-reminder`, `inject-subagent-digest`,
  `inject-memory-codification`, `inject-subagent-context`) — a dead injector loses
  assistance, not enforcement-illusion; a per-edit notice would cost more context than it
  buys. Their real fix is P0 (deps in the container image).
- Unregistered hooks (`adopt-orchestrator-prompts`, `check-worker-dispatch-channel`,
  `worktree-setup`) — registered in no settings.json; behaviour change would reach nobody
  (same NA reasoning as #1116).

## §4 Corrections to the S4 synthesis (append-only — S4 is not edited)

1. **S4 §4 «most-uncertain row» was resolvable, and resolves to WORSE.** For
   `validate-prompt` / `check-hook-marker` / `check-kickoff-traps`, «fired quietly vs did
   not fire» is decidable from S4's own facts: jq is MISSING in the container (S2 §2.1) and
   each hook exits at its jq guard before any work — the same reasoning S4 §5 Q1 already
   applied to `check-doc-authority`. All three were registered gates that neither checked
   nor complained: ⚠️ WORSE (headline class), not ◻️ COVERAGE-LIMITED. Corrected rollup:
   **16 SAME / 7 WORSE / 0 BROKEN / 15 COVERAGE-LIMITED**.
2. **`done.md` of `multi-model-pipeline-pilot` carries pre-reclassification counts**
   («3 BROKEN / 14 COVERAGE-LIMITED») that its own S4 §4 supersedes («0 BROKEN / 18») —
   and both are now superseded by (1). The done.md is a closed artifact; this note is the
   correction record.
3. **#1116 PR-body claims corrected:** «no plugin twin exists» for `validate-prompt` is
   false (`git ls-tree 2a3cf3ee7 plugin/hooks/` lists it; the twin still carried the
   pre-fix silent skip). The Backward-check's «all `command -v` dependency guards were
   enumerated» reported only the stderr-printing subset — a
   [`#backward-check-restates-not-sweeps`](../../../.claude/rules/ai-laziness-traps.md)-adjacent
   under-enumeration (T21 incident counter unaffected: the surface list was not the diff's
   own files; the class definition was narrowed instead).

## §5 Prevention

1. **When a claim is about a harness channel, verify it from the receiver's seat.** A hook
   can be run manually and its bytes inspected forever without learning whether the model
   receives them; the decisive probe is «write the violating input in a live session and
   look at your own context». Cost: two Writes and one revert. (This is §1.10
   types-over-prose generalised to runtime channels: the receiving end is the type system.)
2. **A sweep must enumerate the class definition verbatim from its kickoff, criterion by
   criterion**, and report per-criterion population + verdicts. #1116's sweep answered
   criterion (b) and silently dropped criterion (a); quoting the two-criterion definition
   would have made the omission visible in the PR body itself.
3. **`@plugin-transform: manual` twins need a drift mechanism, not author memory.** Five
   manual twins exist; each fix to a manual-twinned source MUST touch the twin in the same
   commit, and the invariant belongs in a test (done here for `validate-prompt`; the other
   four manual twins are candidates the moment their sources take a fix).

## §6 §1.7 self-reflexive note

**Forward-check (this patch + its fix comply with active disciplines):**

- [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md) —
  the fix converts attention-dependent channels (stderr the model never sees) into
  deterministic model-visible ones; evidence `.claude/hooks/check-hook-marker.sh:31`
  (`_adv_violation` exit 2). ✓
- [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md) — all changes are
  bash + vitest; zero API-billed calls (`packages/core/hooks/validate-prompt.test.ts:1`). ✓
- [`dual-implementation-discipline.md §6`](../../../.claude/rules/dual-implementation-discipline.md) —
  every edited hook keeps its `@cc-only-rationale`/`@dual-pair` marker; ZCode arms
  byte-preserved (`.claude/hooks/check-kickoff-traps.sh:26`). ✓
- [`zcode-parity-doctrine.md §2`](../../../.claude/rules/zcode-parity-doctrine.md) — no census
  row changes classification: CC-side channel routing only; the ZCode
  `{additionalContext}`+exit-0 arms are untouched. ✓
- [`ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md) T2/T3/T20 — every
  channel claim carries a live probe or file:line; the decisive verdicts (exit-1 invisible /
  exit-2 visible) were run, not asserted (§2). T14 — the NA verdicts state their reason, not
  «clean» (§3). ✓

**Backward-check.** Class of this change = «hook output channels that must reach the model
(violations, dependency-skips)». Surfaces where the class occurs, enumerated via
`grep -lE 'command -v (jq|node)' .claude/hooks/*.sh` + `grep -l 'exit 1' .claude/hooks/*.sh`
against `.claude/settings.json` registrations: the four PostToolUse gates — FIXED (exit 2);
six silent dependency guards on registered/consumer gates — FIXED (loud scoped skips);
`warn-subagent-report` main warning — FIXED (SubagentStop additionalContext);
`ask-question-reminder`, five pure injectors, three unregistered hooks — NA with stated
reasons (§3); `deps-hash-check` + `inject-session-bootstrap` — SWEPT-CLEAN (UserPromptSubmit
stdout already reaches context; `.claude/hooks/deps-hash-check.sh:64-67`);
`plugin/hooks/validate-prompt` manual twin — FIXED + drift-guard; the four other manual
twins (`inject-matching-rule`, `inject-output-language`, `inject-project-digest`,
`inject-subagent-context`) — SWEPT-CLEAN today (their sources took no fix in this change;
flagged in §5 rule 3 as candidates the moment they do). Non-diff sibling checked:
`check-doc-authority-header.sh` was already exit-2-correct and is extended, not contradicted.

**Self-application (T15):** the patch's own §2 method — verify from the receiver's seat —
was applied to the patch's own claims: both probes were run against this session's model
before any hook was edited; the fix's tests re-run the same channel assertions per hook.

## §7 Tags

`#warning-nobody-reads` `#hope-as-gate` `#claim-from-memory-not-source`
`#discipline-application-scope-blindness` (sub-case (c): #1116's channel claims accepted
into S4/fix reasoning without independent verification) — plus prevention rule 1 as a
candidate §1 checklist item for [phase-research-coverage.md](../../../.claude/rules/phase-research-coverage.md)
if a second receiver-seat-verification incident accrues.
