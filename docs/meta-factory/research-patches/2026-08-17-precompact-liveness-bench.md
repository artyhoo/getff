<!-- scope:precompact-liveness-bench -->

# PreCompact liveness bench — the D8 gate, run before the residue writer was wired

> **Type:** research-patch (bench record). Not a design doc: it reports what was fired and
> what came back, including one half that could not be fired at all.
> **Owner:** the S2b session, 2026-08-17.
> **Gates:** [pipeline-chips ADR §D8](../../superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md)
> makes «PreCompact(auto) fires with `transcript_path` on a real auto-compact + the file is
> written» the liveness bench that F8 rides on, and orders it BEFORE the writer is wired.
> **Feeds:** ADR §7 row F8 (closed on this bench + the operator's 2026-08-17 GO) and the
> operator hand-off in the S2b PR body.
> **Active traps** ([ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md)):
> T2 (designing ≠ auditing — every claim below carries the command that produced it),
> T3 (no prose-only findings), T6 (predicate confidence, not «high»), T14 (an unfired half is
> «coverage insufficient», never «works»).
> Domain trap **T-BENCH-A** — *proving the script and calling it the event*. Feeding the hook
> a hand-written payload proves the extractor; it proves nothing about whether Claude Code
> delivers `PreCompact` with a `transcript_path`. The two are reported separately below and
> never summed into one verdict.

## §1 What the bench had to answer

Three independent questions, deliberately not collapsed:

1. **Contract** — given a PreCompact payload, does the hook write the residue, with the right
   body, without blocking?
2. **Delivery, manual half** — does Claude Code actually invoke a `PreCompact` hook on an
   operator-initiated `/compact`, with `transcript_path` populated?
3. **Delivery, auto half** — same, on a real auto-compaction at the context ceiling.

## §2 Question 1 — contract: PROVEN

Method: `spawnSync(bash, [hook], {input: <payload JSON>})` against on-disk JSONL fixtures plus
one real Claude Code transcript. Fifteen cases in
[`packages/core/hooks/precompact-residue.test.ts`](../../../packages/core/hooks/precompact-residue.test.ts),
green: `npx vitest run packages/core/hooks/precompact-residue.test.ts` → `Tests 15 passed (15)`.

Paired-negative (the test suite is not vacuous): the `isSidechain` filter was seeded broken
(`select(.isSidechain != true)` → `select(true)`), re-run, and exactly one case flipped —
`× NEVER captures a sidechain (subagent) recap … 1 failed | 14 passed` — then restored to
`15 passed`.

Live run against a real CC transcript (this session's own, 202 lines, not a fixture):

```text
# Session residue — Build stage S2b (PreCompact residue writer, ADR D8) of the pipeline-chips…
- **Written:** 2026-08-17T11:19:09Z (PreCompact, trigger=`manual`)
- **Branch:** `claude/suspicious-goldberg-d15ff2` @ `9374013e80`
- **Body source:** excerpt
```

End-to-end reader/writer agreement (the claim that matters — a residue nobody reads is
`#warning-nobody-reads`): the hook was run with `CLAUDE_PROJECT_DIR` set to the worktree and
no `AIF_RESIDUE_DIR`, landing at `.claude/orchestrator-prompts/_residue-e2e-proof.md`
(`git check-ignore -v` → `.gitignore:7`, so residues never enter a diff); the
[`pipeline/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) §1 Step-1 fence was then run
verbatim and printed that file's first 40 lines under its `--- PreCompact residue (S2b/D8)`
banner. Writer and reader resolve the directory through the SAME
`helpers/print-orch-home.sh`, so they agree by construction, not by two copies of one rule.

**Finding B-1 (language sensitivity, measured not assumed).** The recap marker is lang-pack
sourced. The same fixture scored `Body source: recap` under `AIF_HOOK_LANG=en` and
`Body source: excerpt` under the session's ambient `ru` — caught by a `bash -x` trace showing
`+ awk -v 'm=## 🟢 Простыми словами'`. Correct behaviour (category-3 match-data,
[language-discipline.md §1](../../../.claude/rules/language-discipline.md)), but it makes an
unpinned test a coin-flip: every case in the suite now pins `AIF_HOOK_LANG` explicitly, and
one case asserts the ru/en split in both directions.

## §3 Question 2 — manual delivery: NOT FIRED (blocked, cause identified)

The manual half could not be fired from this session, for a reason that is structural rather
than a missing step:

- Registration requires a `PreCompact` entry in `.claude/settings.json`, whose own deny-list
  carries `Edit(.claude/settings.json)` / `Write(.claude/settings.json)` (read live from the
  file) — the agent cannot write it, by design.
- Hooks are snapshotted at session start, so even a registration landed by the operator
  mid-session would not arm THIS session; the fire needs a fresh session.
- `/compact` is an operator action; the agent cannot invoke it.

**Finding B-2 (a real D8 defect, not a bench limitation).** D8 specifies the hook «on
`PreCompact` (matcher `auto`)». With that matcher the manual half is unfireable *by
construction* — the only half a human can trigger on demand is the one the matcher excludes.
The matcher is also unnecessary: a manual `/compact` discards the same context an auto-compact
does, so the residue is worth exactly as much there, and
[`precompact-residue.sh`](../../../.claude/hooks/precompact-residue.sh) treats the two
identically (asserted: «treats auto and manual identically — the writer is matcher-independent»).
**Resolution:** register with NO matcher (all triggers). Recorded in the ADR's D8 as a
refinement of the spec, not a silent deviation.

## §4 Question 3 — auto delivery: NOT OBSERVED, and not observable from history either

Auto-compaction cannot be induced on demand. The fallback — look for it in the historical
corpus — returned nothing: the 60 most-recently-modified transcripts outside this session
were scanned for `"isCompactSummary":true` and no file matched.

That null is consistent with the environment rather than surprising: this operator's Claude
Code runs a 1M-token window (the premise the D7 context-arm was corrected to in #1409), so
sessions end long before the ceiling. **Confidence, stated as a predicate** (T6): 1 of 3
questions proven mechanically; 2 of 3 blocked on capabilities the agent does not hold; corpus
coverage for the auto path = 0 observed events / 60 transcripts sampled. Per T14 this is
«coverage insufficient to conclude», NOT «the auto path works».

**This is the outcome D8 anticipated and accepted** — «an honest *auto path unverified,
manual path proven* is an acceptable bench outcome». What ships here is one notch below even
that: the manual path is proven at the CONTRACT level and unfired at the DELIVERY level. The
distinction is the whole point of T-BENCH-A, so it is stated rather than rounded up.

## §5 What remains, and who can do it

The residual bench is two operator actions, both in the S2b PR's hand-off block: land the
registration (one idempotent `jq` script touching `.claude/settings.json` and
`.ai-factory/harness-model.json` together — see §6), then in a **fresh** session run
`/compact` and check that `_residue-<session>.md` appeared under the orchestration home. The
auto half then closes itself the first time a session reaches the ceiling; no further action.

Until that fire is observed, the honest status of D8's delivery leg is **unverified**, and
this file is where the observation gets recorded when it happens.

## §6 Why registration is one atomic two-file step (measured)

`.claude/settings.json` is tracked AND rendered from `.ai-factory/harness-model.json`; the
drift gate checks the real tree on every CI run
([`harness-config-drift.test.ts`](../../../packages/core/hooks/harness-config-drift.test.ts):
«REAL-TREE (claude branch, ALWAYS in CI)»). Editing only the SSOT was tried in a sandbox copy
of both files:

```text
✗ harness-config drift:
    - .claude/settings.json: drift vs SSOT
```

exit 1. So the two files must move in ONE commit — and since one of them is agent-blocked,
that commit is the operator's. This is why the S2b PR ships the hook, the tests, the census
row and the reader, and registers nothing.

## §7 Self-application (T15)

Auditing this bench would ask: does its own claim structure survive the trap it names? The
one place it could have failed is §2's headline — «the hook works» would have quietly meant
«the event works». It is split into three numbered questions with separate verdicts precisely
so that summing them is impossible without noticing. The remaining weakness is that §4's null
rests on one corpus scan whose command is recorded but whose population (60 most-recent
transcripts) is convenience-sampled, not stratified — a T9 shortcut, declared: a stratified
scan across the full history would raise confidence in the null but cannot turn it into
evidence that the hook fires, which is the only thing that matters here.
