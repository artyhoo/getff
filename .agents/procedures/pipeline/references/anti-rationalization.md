# §2 Step 4.1 — DECISION-NEEDED anti-rationalization clause

> **Authoritative for:** what counts as an answered `/pipeline §2 Step 4` fork — the content-tiebreaker test, the not-an-answer list, the re-surface pattern, the rationalization to refuse, and the advisor-branch detail (register target, consumer degradation, the two asymmetries). Body of `../SKILL.md §2` points here.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). Reviewer/orchestrator role separation — see [reviewer-discipline.md](../../../rules/reviewer-discipline.md).

A genuine answer to a §2 Step 4 DECISION-NEEDED is a **content-based tiebreaker** from the maintainer — they name a reason rooted in project priority («pick n7 because the trial output unblocks n8's R3» / «pick n8, deadline is real» / «pick n7, n8 needs an SSOT entry first»). The reason has to be about the umbrellas, not about the maintainer.

The following are **NOT** answers — they are _deferred_ DECISION-NEEDED (the maintainer declined to decide, not decided):

- «выбирай сам» / "you decide" / "I trust you" — delegation, not decision
- «оба норм» / "both fine" / "either works" — confirmation that the tie is real, not a tiebreaker
- «я устал» / "I'm busy" / "decide quickly" — availability constraint, not a priority signal
- "it's not strategy, just technical details" — framing, not content (the meta-orchestrator's role is exactly to refuse this framing when scores are equal — if it really were «just technical details», the scores would have separated)

When the maintainer's reply is in this list, the correct response is **re-surface DECISION-NEEDED with sharper framing**, not pick. Example re-surface:

> «I understand you don't want to decide, but I can't either — scores are equal and there's no contentful tiebreaker. One question back: **is there a downstream wave that one of them unblocks more strongly?** If not — flip a coin in front of me and I'll record the result in state.md as «coin-flip per maintainer 2026-XX-XX». Or say «pick n7 because <X>» / «pick n8 because <Y>» — one line.»

This re-surface bounds the maintainer's effort (one question or one coin-flip, not a re-analysis) while preserving the discipline that the meta-orchestrator does not unilaterally pick strategy.

## The advisor branch answers to the same test

Since §2 Step 4 routes a priority fork to the advisor first (an ask file + `ASK`) when one is reachable, the verdict that comes back in `## Answer` is judged by exactly the list above — the seat changed, the test did not. «выбирай сам» / «оба норм» from the advisor is a **deferred ask**, not an answer: re-surface in that ask file, or let the fork fall through to the maintainer branch.

**Register target.** The `decisions-entry:` that a `status: answered` ask must carry is the orch-home priority register `_priority.decisions.md` — underscore-prefixed and gitignored, following the live sibling convention (`.claude/orchestrator-prompts/_getff-ai-site-umbrella.decisions.md`). The schema only checks that the pointer leads with a path ending in `.decisions.md`; naming the target here is what keeps a priority verdict from being recorded in a different place each time.

**Consumer-install degradation.** `scripts/check-ask-files.sh` is not delivered by `setup.d/` (ledger C-2), so outside the operator repo §2 Step 4 is always the DECISION-NEEDED branch. The advisor half is operator-repo-only at v1 — a consumer install loses the routing, never the discipline.

Two asymmetries are worth naming, because they are what makes the advisor branch cheap:

- An advisor verdict is **recorded before it is applied** — the `decisions-entry:` pointer is a schema field the pre-push `ask-file-schema` section checks, so «the advisor said so» can never be an unwritable claim. A maintainer answer in chat has no such register; that is why §2 Step 4 still writes the outcome into `state.md`.
- An ask is **non-blocking at night**: the fork waits in the mailbox while the rest of §2 proceeds, where a DECISION-NEEDED at night means stay parked. Filing the ask is therefore never a reason to dispatch Stage 1 early — it is a reason not to lose the question.

**Rationalization to refuse explicitly:** «maintainer said pick → §2 step 4 is satisfied, I pick» is the `#strategy-decided-by-reviewer` anti-pattern in disguise (see [reviewer-discipline.md §3](../../../rules/reviewer-discipline.md)). Naming §2 step 4 while violating its spirit does not make the violation OK.
