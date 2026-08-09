<!-- scope:kickoff-allowlist-obligation-closure -->

# Kickoff allowlist ↔ obligation closure — the gate is falsified; K6 is the reachable mechanism

> **Type:** research-patch (discovered gap + a rejected mechanism, with the measurement that rejected it). Owner: the session that ran the sweep, 2026-08-09.
> **Status:** DECIDED — no gate. The candidate-emission extension in [`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md) K6 ships in the same PR.
> **Reader:** anyone tempted to add «§2 allowlist vs §4 obligation» detection to [`.claude/hooks/check-kickoff-traps.sh`](../../../.claude/hooks/check-kickoff-traps.sh). Read §3–§4 first: the measurement that kills that design is here, so you do not have to re-derive it.

## §1 The gap in one sentence

A kickoff can mandate, in one section, an edit to a file another section forbids — making the stage **undoable as written** — and nothing checks the two sections against each other.

Live instance: `getff-freshness-widening-s1/kickoff.md` rev 3 (`7beecfe5a6`) mandated re-landing an SSOT row while its §2 omitted `docs/meta-factory/prior-art-evaluations.md`, and separately omitted `.github/workflows/audit-self.yml` without which the stage's own criterion-5/7/9 tests were unwired — therefore not gates at all. A cold fidelity audit returned KICKOFF-AMBIGUOUS **after a full implementation round had already been spent**. Fixed by hand in rev 4 (PR #1315).

Verified NOT to cover this class: [`check-kickoff-traps.sh`](../../../.claude/hooks/check-kickoff-traps.sh) (T-enumeration floor + the host-verify contract arm it delegates to `scripts/host-verify.sh`); [`12-ai-laziness-traps.test.ts:33`](../../../packages/core/principles/12-ai-laziness-traps.test.ts) (walks the same directory for §3 citation syntax only); [`scripts/host-verify.sh`](../../../scripts/host-verify.sh) (acceptance-command block only).

## §2 Population first (T10)

```bash
git ls-files '.claude/orchestrator-prompts/*/kickoff.md' | wc -l                                        # 305
git grep -lIiE '^#+ .*permitted files' -- '.claude/orchestrator-prompts/*/kickoff.md' | wc -l           # 9
git grep -lIiE '^#+ .*capability[- ]commit' -- '.claude/orchestrator-prompts/*/kickoff.md' | wc -l      # 21
```

The permitted-files convention is carried by **9 of 305** tracked kickoffs (7× `arch-v2-context-pipeline-s-*`, `getff-freshness-widening-s0`, `-s1`). The intersection «declares an allowlist **and** a capability-commit section» is **1** — the incident file itself. The class as originally framed («kickoffs carry both a §2 and a §4») describes one document, not a population; any gate's blast radius is the 9, not the 305.

## §3 Two detector variants, both run (T2 — not «would detect»)

Both extract the allowlist from the `Permitted files` section (splitting on `**Not permitted`), expand `{a,b}` braces, and match `**`/`*` globs.

**Variant A — path-closure.** Every backticked path-shaped token anywhere in the kickoff must be covered by the allowlist or the not-permitted list. Result: **110 flags across 9 files (12.2/file)**, worst file 35. Rejected on noise alone.

**Variant B — tightened.** Only *concrete* paths (has `/`, has an extension, no glob), only on lines carrying a mutation verb (`add|edit|write|append|re-land|wire|update|regenerate|create|modify|patch|extend|insert|delete|remove|rename|stamp|emit|bump`), and only outside the allowlist section itself:

```bash
MUT='\b(add|adds|adding|edit|edits|editing|write|writes|writing|append|appends|re-?land|lands|wire|wires|wiring|update|updates|regenerate|regenerates|create|creates|modify|modifies|patch|patches|extend|extends|insert|delete|deletes|remove|removes|rename|renames|stamp|stamps|emit|emits|bump|bumps)\b'
# per kickoff: grep -nE "$MUT" <file> | grep -oE '`[^`]+`' | ... | drop allowlist-covered
```

Result: **10 flags across 9 files (1.1/file)** — borderline against the pre-registered «≤1 false flag per file» bar, and every one of the 10 is a false flag on inspection: 5 are `file:line` citations used as evidence, 3 are paths §2 grants *by description* (see §4b), 1 is a bare mention in a parenthetical, 1 is a path inside a shell fixture string.

**The decisive leg — incident replay.** Variant B run against rev 3, the exact document the live audit failed on:

```text
--- INCIDENT REPLAY (rev 3, pre-fix) -> 0 flags
  caught audit-self.yml?  false
  caught prior-art-evaluations.md?  false
```

The strongest mechanical variant has **0/2 recall on the only two real incidents of this class**, at 1.1 false flags per file. A check that cannot fire on its own motivating defect is not a gate; shipping it would be `#discipline-theatre` ([phase-research-coverage.md §4](../../../.claude/rules/phase-research-coverage.md)) with a green suite over a dead mechanism.

## §4 Why recall is zero — two structural falsifiers

**(a) Mandates address by concept, not by path.** rev 3 §4 reads «SSOT row 241 … **RE-LAND the row** … in the SAME commit as the `Prior-art:` trailer». The string `docs/meta-factory/prior-art-evaluations.md` **does not occur in the document at all** — the obligation names «the SSOT». No path-vs-allowlist comparison can see it. The second incident is the mirror image: `.github/workflows/audit-self.yml` occurs exactly once, at `kickoff.md:58` of rev 3, inside a *descriptive* clause («is CI-wired via …»), while the mandate to wire criteria 5/7/9 never names the file. Distinguishing «this path must be edited» from «this path is background» is prose semantics.

**(b) Allowlists themselves grant by description.** [`arch-v2-context-pipeline-s-m/kickoff.md:157`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline-s-m/kickoff.md) opens §2 with «Exactly the grant list: **four §1.1 registry files**, …» — four paths are granted without being named (they are enumerated in §1 deliverable 1). Literal set-extraction from §2 is therefore unsound in the *permissive* direction too: 3 of variant B's 10 flags are edits that §2 genuinely permits.

Wrong if: a future convention required §2 to enumerate literal paths **and** every binding obligation to name its target path. Both are new authoring obligations across 9 existing files, and neither closes falsifier (a) for an obligation phrased as «the SSOT».

## §5 Verdict — detectability axis says injection, not gate

Per [rule-enforcement-channel-selection.md §1](../../../.claude/rules/rule-enforcement-channel-selection.md) the detectability axis resolves NO: the violation needs judgment, so gating it is `#gate-where-judgment-needed` (§5 of that rule). This matches the Class-B precedent of [source-before-shape.md](../../../.claude/rules/source-before-shape.md), whose header states the same reasoning for a structurally identical judgment call.

The judgment ceiling does **not** mean bare attention. Per [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md), a load-bearing check must be (a) a deterministic gate or (b) **a NAMED cold-agent protocol with structured output**. Branch (a) is falsified above; branch (b) is what ships — and it is what actually caught the incident (a cold fidelity audit, not a reviewer's eye).

## §6 The mechanism — K6 already owns this class

[`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md) K6 is defined as «self-consistency with declared non-goals — a dispatch input that silently reverses a descope, **contradicts a non-goal**, or buries a verdict under framing». A §2 allowlist *is* a declared non-goal, and an obligation mandating a file it forbids *is* a contradiction of one: the class is already K6's, and no new mechanism is warranted (build-vs-reuse: REUSE, no capability commit).

What was missing is the *emission* half — the allowlist is already an input to that seat, declared
at [`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md) Inputs item 2,
but it fed K1 anchor resolution only. K6's candidate extraction pulled the verdict lexicon plus the `## §4 Descopes` section only, so the allowlist never reached the adjudicator. This PR adds the permitted / not-permitted list and the concrete paths named in obligation sections as a second structured extractor. A flag density that disqualifies a gate is exactly the right density for a **candidate list**, which is K6's declared shape: «The candidate list is the deliverable; an empty candidate list is **not** "no framing bias"». Falsifiers (a) and (b) are both recorded there as named false-negative classes, beside the existing bare-priority-label one.

The shipped emission pipeline is narrower than variant B — it requires a `/` in the token (without it the extension pattern also matches symbols such as `SynthesizedRule.research`) — and was run over the population at authoring time: **3 candidates across the 9 files**, all benign (`arch-v2-context-pipeline-s-i` ×2 — a rule cited as *firing*, and a `/tmp` runtime path; `arch-v2-context-pipeline-s-m` ×1 — a parenthetical mention). On rev 3 it returns **zero**, which is the zero-recall result stated above, reproduced by the exact command the agent now carries.

## §7 Sweep of the 9 (judgment pass over the full population, not the detector)

| Kickoff | Verdict |
|---|---|
| `arch-v2-context-pipeline-s-d-prime` | CLEAN — and the model case: maintainer-owned `agents/*.md` are excluded from §2, and the edit that would need them travels «as a proposed diff in the PR body», never as a direct edit |
| `arch-v2-context-pipeline-s-e` | **RESIDUAL** — see below |
| `arch-v2-context-pipeline-s-g` | CLEAN |
| `arch-v2-context-pipeline-s-h` | CLEAN |
| `arch-v2-context-pipeline-s-i` | CLEAN |
| `arch-v2-context-pipeline-s-l` | CLEAN |
| `arch-v2-context-pipeline-s-m` | CLEAN — grants by description (§4b); not a contradiction |
| `getff-freshness-widening-s0` | CLEAN |
| `getff-freshness-widening-s1` | CLEAN since rev 4 (PR #1315) |

**The residual — `arch-v2-context-pipeline-s-e`.** §2 lists `.claude/rules/*` as NOT permitted (`kickoff.md:155`), while the §3 acceptance leg mandates «add a temp `.claude/rules/<fixture>.md` **without** `paths:` frontmatter … the fixture removed before commit» (`kickoff.md:189`). It is the same class as the incident, resolvable by reading (the fixture is uncommitted, so §2's *committed-files* reading holds), and the stage has already merged (`done.md` present). **Deliberately not edited here:** the stage is closed, the contradiction can no longer mislead an executor, and editing another umbrella's finished kickoff is the drive-by scope expansion CLAUDE.md `PR strategy` forbids — s-l's own §2 names «other stage kickoffs» as not permitted, which is the repo's norm on this. Recorded, not fixed.

Class incident counter: **2** (getff-s1 rev 3 — reached an implementation round; s-e — benign, closed).

## §8 Coverage honesty (T14) + self-application (T15)

**Coverage.** The «CLEAN» verdicts above are **not** the detector's output — the detector has 0 recall on the known incident, so its silence carries no information. They come from reading §2 plus the obligation-bearing sections of all 9 files: the full population rather than a sample, but a single judgment pass by one seat, with no cold second reading. A second seat could still find a case this pass read past. That is the honest ceiling, and it is the same ceiling K6 operates under.

**Self-application.** This patch proposes a mechanism, so it owes its own §5 test: is *its* deliverable gateable? No — «did the adjudicator actually compare the allowlist against the obligations?» is the same semantic judgment one level up, and per [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) it cannot become a CI gate either. The patch therefore does not claim a catch rate. What it does claim, and what is mechanically checkable, is narrower: the allowlist now reaches the adjudicator's input, where before it did not.

**Promotion trigger.** If a third incident lands whose obligation **names its target path literally**, falsifier (a) no longer covers the population and variant B becomes worth re-measuring — with the incident replay, not the flag count, as the acceptance leg.

## See also

- [`agents/dispatch-input-checker.md`](../../../agents/dispatch-input-checker.md) — K6, the mechanism this patch extends.
- [`.claude/rules/rule-enforcement-channel-selection.md §1/§5`](../../../.claude/rules/rule-enforcement-channel-selection.md) — the detectability axis + `#gate-where-judgment-needed`.
- [`.claude/rules/attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md) — why «a reviewer will read it» is not the fallback.
- [`.claude/rules/source-before-shape.md`](../../../.claude/rules/source-before-shape.md) — Class-B precedent for the same judgment-ceiling reasoning.
