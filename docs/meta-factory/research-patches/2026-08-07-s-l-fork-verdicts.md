<!-- scope:arch-v2-context-pipeline-s-l-fork-verdicts -->

# S-L fork verdicts — operator decisions on DECISION-NEEDED #5, #6, #7

> **Status:** operator verdicts, recorded 2026-08-07. Adjudicates the three DECISION-NEEDEDs
> routed by [`2026-08-07-s-l-recalculation.md`](2026-08-07-s-l-recalculation.md)
> (PR #1263, squash `a9fc0af959`) §1.5, §3.3 and §4.3.
> **Append-only.** It edits neither the merged S-L patch nor the S-H patches — and could not:
> the S-L patch sits at exactly 600 lines, the pre-commit markdown ceiling.
> **NOT authoritative for:** the naming RULE and the ADR-3 restatement — both were *delivered*
> by S-L and stand unchanged; only the term assignment and the denominator choice were open.
> Project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

## §0 The three verdicts

| fork | question left open by S-L | verdict | what it binds |
|---|---|---|---|
| **#5** | which channel, if either, keeps «harness remainder» | **Option A — retire the bare term** | ADR-3; every future session-start figure |
| **#6** | which denominator ADR-3 names, once one is measurable | **Option A — the seat first-turn total** | ADR-3 |
| **#7** | T-SH-B corpus drift, +11.1% sessions | **accept as accretion** | nothing — S-H's aggregates stand as published |

No published number changes value under any of the three. #5 and #6 are re-labellings; #7 is a
decision not to re-measure.

## §1 Fork #5 — retire the bare term (Option A)

Two explicit names replace it: **«billed first-turn seat cost»** (by-difference channel) and
**«`/context`-declared resident head»** (harness-declared channel).

**Grounds.** The term does not denote a single quantity: the two channels differ by a measured,
**non-constant** residual (16,196 tok on one day, ~17.3k on another — S-L §3.2). Option C was
dominated on evidence — it re-bases every figure onto the `/context` channel that S-L §3.1
measured **incomplete** (≥15,258 cp of billed harness payload in no category at all). Option B is
cheapest but keeps a name implying a completeness its channel does not have.

The decisive property is **asymmetry of error**: Option A stays correct whichever way the rule's
own falsifier resolves. If the residual proves seat-constant, A is merely verbose and can be
shortened later; if it stays variable, B would have been substantively wrong.

**Falsifier (carried forward, unspent).** A demonstration that the two channels differ by a fixed
offset across seat classes and dates would make one term plus a documented conversion sufficient.
At n=2 the data are consistent with «approximately constant» (the two readings differ by 6.8%), so
this is live and cheap — worth running before the naming rule is called settled.

## §2 Fork #6 — the seat first-turn total (Option A)

**Grounds.** The umbrella's own hard-won discipline decides this one: *a share's numerator must be
a provable subset of its denominator* — the class that consumed nine REVISE rounds. Only Option A
satisfies it (n=2, same seat class as the numerator; 35.4% on the pre-S-G pairing, inside the
withdrawn band). Option B (60-session median) spans seats carrying different repo rule-sets, so the
subset relation is not provable in principle. Option C (`/context`'s own total) denominates on the
channel §3.1 measured incomplete — it understates the denominator and overstates the share.

Option A also composes with #5: S-L records that A's and C's denominators differ by exactly the gap
#5 names, so choosing A in both keeps the pair coherent.

**This names the denominator; it does not produce a number.** ADR-3's share stays `UNMEASURED —
channel absent` until one `/context` reading is taken on a post-S-G seat — the falsifier S-L
delivered, and the natural first task of whichever stage next needs the figure.

## §3 Fork #7 — accept as accretion

The drift is **upward** (+11.1% sessions, +3.5% subagents in under a day), consistent with ordinary
accretion — this umbrella opened several seats that day, including the measured one. It is the
opposite class from the −27% retention event T-SH-B was written against. Every S-L measurement is a
*within-seat* comparison on named transcripts, so corpus size does not enter it, and S-H's
aggregates carry their own MEASURED-AT labels. Re-running them would be a **re-measurement, not a
correction**, and no consumer needs one.

**Wrong if** a consumer appears that needs S-H's aggregate tables on the current corpus — then a
superseding set is published as a NEW patch, never as an edit to the merged one.

## §4 §1.7 Forward-check — this change against the active disciplines

- **Code-level (R1-R20):** no code touched — a spec section, a kickoff cell, and this patch.
- **Principle-level:** principle 10 (scope annotation) verified green on this file; principle 13
  (§1.7 substance) is satisfied by this section plus §5 — and it **caught a real gap in this
  patch's first draft**, which shipped a backward-check with no forward-check. Recorded as an
  incident, not silently fixed: the gate did the work an author's re-read had already missed.
- **Commit-level:** not a capability commit (no new dependency, no file ≥50 LOC under a new
  `packages/core/` subdirectory, none ≥80 LOC under `packages/`) → `Prior-art:` escape hatch with
  rationale, per [CLAUDE.md](../../../CLAUDE.md).
- **Build-vs-reuse:** no capability is proposed; §5 explicitly *declines* to build the gate the
  naming rule would justify, and routes it to the operator instead.
- **Doc-authority:** the design spec is not listed in the Artifact Ownership Contract and is
  stage-edited by design — S-L §6 recorded the ADR-3 site as `GAP-FOUND, routed`, i.e. an edit
  deferred until this verdict existed. The umbrella kickoff was edited **in-cell only**: it stands
  at 592/600 lines, unchanged by this patch (`wc -l`), per the pre-commit markdown ceiling.
- **Kickoff-staging-placement:** the umbrella kickoff edit is merged to `staging`, where
  `/pipeline` and aif read it — not left on a worktree branch.

## §5 §1.7 Backward-check — the sweep, run not recalled

**Class of this change** = a live surface that uses «harness remainder» **bare as the label of a
quantity**, or that states a repo-owned always-on **share**. Population from
`grep -rn "harness remainder\|harness-remainder"` over `*.md`/`*.sh`/`*.ts` (38 hits) plus the
share sites.

| surface | verdict |
|---|---|
| [spec ADR-3](../../superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md) `:155` (bare term) + `:151` (stale «29-39%») | **GAP-FOUND → fixed here.** #1265 deliberately left it: it was reserved for #6 |
| umbrella kickoff `:102`, `:273`, `:309` | **SWEPT-CLEAN — out of class.** All three name the *deliverable* («P14 harness-remainder price list»), which is also the merged patch's filename. Renaming a proper noun would break provenance, not improve labelling |
| stage kickoffs `s-e:135`, `s-h:6,69`, `s-l:88,152` | **Out of class** — closed stages, historical dispatch inputs |
| `session-start-token-audit/kickoff.md:105,224,235` | **Out of class** — umbrella CLOSED (`done.md` present) |
| seven research patches carrying the term | **Out of class** — append-only; corrections land as a new patch, which is this one |
| `scripts/check-alwayson-budget.sh:13`, `packages/core/hooks/pre-push.ts:1252`, `.github/workflows/audit-self.yml:827` | **SWEPT-CLEAN** — already `UNMEASURED — channel absent` (PR #1265); verified the new ADR-3 wording agrees with all three |

The distinction that made the sweep non-mechanical: the term as a **quantity label** is retired; the
term as an **artifact title** is not. A sweep that missed it would have either renamed a merged
patch's filename or left the one real site standing.

## §6 Self-application (T15) + the honest limit

This patch issues three verdicts, so it owes its own evidence per
[`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md): each §
above carries grounds, a named falsifier, and the surfaces it binds. It introduces no new rule,
no capability and no gate — the naming rule it records was delivered by S-L and is enforced by
authoring discipline, not by a channel. **That is an honest limit, not a claim:** a naming
convention whose only enforcement is «sessions will remember» is
[`#hope-as-gate`](../../../.claude/rules/attention-is-not-a-mechanism.md). Promoting it to a gate
was **not** undertaken here — it is a capability commit, outside a verdict-recording scope, and is
surfaced for the operator rather than built.

**Tags:** `#claim-from-memory-not-source` (the #6 discipline this verdict applies),
`#discipline-application-scope-blindness` (sub-case (b) — the stale share survived in the spec
while three sibling copies were swept).
