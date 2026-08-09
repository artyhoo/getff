# beta-delivery-ux S4 — owner forks logged by the unattended run of 2026-08-09

Per `.claude/skills/night-mode/SKILL.md` delta item 1: technical forks are resolved autonomously
with a recorded rationale; **genuine owner forks are logged here, not decided, and do not block**.
Both entries below blocked S4 from closing complete. Neither was decided by the session.

## Fork 1 — spend authorisation for the §7a #3 model proof (step D)

**State.** The completion route is measured and proven: `POST /chat/sessions` → 400 (exists),
`chat.ts:923-937` project-scope-validates `runtimeProfileId`, `chat.ts:1275` is the completion
endpoint, and one operator-authorised billed call returned a real completion
(`costUsd:0.117219`, `runtime.profileId:53eca24c-…`, `lastUsageAt` moved
`09:15:11.263Z` → `09:51:42.017Z`). §2 constraint 1 is untouched, because aif — not the helper —
makes the call and resolves the key from its own `process.env`.

**What is undone.** Step D itself: create a chat session pinned to the freshly created profile,
send one minimal message, read `usage` + `runtime.profileId` back. Building it is ordinary work.
Proving it works **on a cold install, immediately after the helper's own `POST /runtime-profiles`**
— which is exactly what kickoff §7f.2 assigns — needs at least one more real billed call.

**Why the session did not decide.** The operator authorised one call; it is spent. Spending more
of the operator's money is not a technical fork. Cost is **~$0.12 per verification run, not
token-scale**: aif injects project context, so `inputTokens` was 39058 for a one-word prompt.

**Options, with what each costs.**

| | consequence |
|---|---|
| Authorise the spend | Step D ships and verifies; S4 can close complete against §2 constraint 4. ~$0.12 per verification run, plus ~$0.12 per consumer provision thereafter, since §7a #3 requires a real call. |
| Decline | S4 closes partial. §2 constraint 4 («Phase 1 exits only with the automated one-key path proven end-to-end») is not satisfied, and that must be recorded as an unmet exit criterion rather than absorbed. |

## Fork 2 — the terminal-token contract when a binding objective is undelivered

**State.** §7e.3 says either half of the proof failing is an objective-3 MISS. The model proof is
undelivered, yet `do_provision` still ends in `GLM_PROVISION: DONE` while logging that the model
call was never made. `INSTALL-FOR-AI.md:184` instructs the consumer's agent to report that line
verbatim, so an unmet binding objective reaches the consumer as success. The round-5 cold audit
graded this MAJOR.

**Why the session did not decide.** The identical shape *was* fixed twelve lines above for step B
(`GLM_PROVISION: FAILED step-B per-mode-defaults`, non-zero, paired-negative N6). Applying the same
treatment here is not an implementation detail — it changes the consumer-facing terminal-token
contract that the shipped install instructions depend on.

**Options, with what each costs.**

| | consequence |
|---|---|
| `FAILED` until step D ships | Consistent with the step-B fix and with §2 constraint 4. Every consumer run reports failure while the profile and key demonstrably work — accurate, but harsh, and it makes the feature look broken. |
| A third token, `PARTIAL` | Honest without crying failure. Requires updating `INSTALL-FOR-AI.md:184` and every consumer agent's handling; a new token is a contract addition. |
| Ship step D (Fork 1 = authorise) | The question dissolves — `DONE` becomes true. Preferred if Fork 1 is authorised. |
| Leave `DONE` | The false green stays. Recorded here so it is a decision, not an oversight. |

## Not a fork — decided autonomously, rationale recorded

The round-4 audit's `KICKOFF-AMBIGUOUS` on §7e.3 and its `DECISION-NEEDED` (weaken §7a #3, or
weaken §2 constraint 1) were **not** escalated, because measurement dissolved the premise both
options rested on: §7f.2 had generalised a single `404` probe into «the only reachable form».
Neither invariant needed weakening. Corrected in #1340; the withdrawn conclusion is recorded there
rather than silently replaced.
