# Stage gates — enforcement class + the merged-PR search gotcha

> **Binds:** [`SKILL.md`](../SKILL.md) §6 Steps 1-2.
> **Authoritative for:** the honest enforcement class of the stage gate, and the
> `gh pr list --search` recycled-branch gotcha (T-MOB-B).
> **NOT authoritative for:** the gate commands themselves — [`SKILL.md`](../SKILL.md) §6;
> the Step 3 claim protocol — [`claim-machinery.md`](claim-machinery.md);
> project goal — [README.md#why-this-exists](../../../../README.md#why-this-exists).

## §1 Class C compromise (honest)

§6 Steps 1-2 are **prose enforcement**. The `!shell` injection surfaces the PR merge state, but
the AI can technically ignore the injected data and dispatch Stage N+1 anyway. This is the same
cost-benefit compromise as
[parallel-subwave-isolation.md §4](../../../rules/parallel-subwave-isolation.md) (Class C
accepted; re-promotion trigger = ≥2 stage-gate-ignored incidents within 6 months). The `!shell`
data is surfaced so the AI has no excuse for ignorance; the discipline relies on session-bound AI
judgment.

Step 3's claim half is deliberately NOT in this class — a claim is an artefact in a queue that a
later probe reads mechanically, not a fact someone has to remember
([attention-is-not-a-mechanism.md §1](../../../rules/attention-is-not-a-mechanism.md)).

## §2 T-MOB-B anti-pattern (search gotcha)

`gh pr list --search 'is:merged head:<branch>'` returns ALL merged PRs ever with that head. The
`base:staging` filter in §6 Step 1 prevents false-positives from recycled branch names that landed
on a different base. If a branch name has been reused across umbrellas and a date scope is
genuinely needed, pass `created:>=<YYYY-MM-DD>` derived from the umbrella's kickoff timestamp —
never a hardcoded literal.
