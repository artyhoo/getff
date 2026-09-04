# beta-delivery-ux S4 — owner forks logged by the unattended run of 2026-08-09

Per `.claude/skills/night-mode/SKILL.md` delta item 1: technical forks are resolved autonomously
with a recorded rationale; **genuine owner forks are logged here, not decided, and do not block**.
Both entries below blocked S4 from closing complete. Neither was decided by the session.

> **BOTH FORKS RESOLVED by the operator, 2026-08-09: spend authorised.** Step D is built and
> `GLM_PROVISION: DONE` now means the vendor accepted the key, so Fork 2 dissolved rather than
> being decided — `DONE` became true instead of needing a new token. The entries below are kept
> as the record of what was asked and why. What the authorised spend actually bought, and the
> one thing it did **not**, is in `## What the verification found` at the end.

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

## What the verification found (2026-08-09, after the spend was authorised)

Three billed calls were spent. They bought one correction that matters more than the delivery.

**The single-call form was wrong.** Step D was first written as one `POST /chat` carrying
`runtimeProfileId`. `chatRequestSchema` accepts that field, so it looked right, and it *appeared*
to pass — the echoed `runtime.profileId` matched. It matched by coincidence: the pinned profile
happened to be the project's default. Fired against a **freshly created** profile, the completion
ran on the project default instead and echoed that one back. `chat.ts:1336` is the reason —
`POST /chat` resolves the profile from the chat SESSION (`existingSession?.runtimeProfileId ?? null`)
and never reads the field from the chat body when opening a new conversation.

So the delivered form is two calls: `POST /chat/sessions` pins the profile, `POST /chat` sends the
completion to that session. Without the cold-profile probe this would have shipped as a proof that
silently validated whatever the project already defaulted to — the exact class of false green this
stage keeps producing.

**What is still UNEXERCISED, and it is not a formality.** The full chain against a profile the
helper itself created could not be run on the verifying host: that aif deployment has `ZAI_API_KEY`
in its process env and **no** `ANTHROPIC_AUTH_TOKEN` (measured — names only, never values), so a
helper-created profile returns `CHAT_AUTH_ERROR` there no matter how correct the code is. The
working profile on that host uses `ZAI_API_KEY` + `transport: sdk`; the helper creates
`ANTHROPIC_AUTH_TOKEN` + `transport: api`. On a consumer machine the §7b wiring is what puts
`ANTHROPIC_AUTH_TOKEN` into the aif env, so the helper's choice is right for the flow it targets —
but the first real consumer run is still the first time that chain executes end to end. A
`FAILED step-D` on that run means the wiring did not land, not that the proof is broken.

This is recorded rather than smoothed over because §7a #4(i)'s own falsifier — "if the live schema
names a different expected var, PARK with the schema quoted" — is adjacent to what was observed,
and a reader deciding whether S4 is closed should see it.

## Fork 3 — recurring per-consumer spend (OPEN; raised by the round-6 audit, not decided)

**The mismatch.** §7a #3 binds «one **1-token-scale** minimal model call». The only reachable
completion route injects project context, so the measured call was **39058 input tokens /
`costUsd:0.117219`** for a one-word prompt. Step D runs on **every** `provision`, so this is a
recurring charge on each consumer's z.ai plan, not a one-off verification cost.

**Why it is not a technical fork.** Nothing in the code decides it. The kickoff wrote «1-token-scale»
when no such route exists, and whether ~$0.12 per provision is acceptable for the one-button
promise is a product call about other people's money.

| | consequence |
|---|---|
| Accept as-is | `DONE` keeps meaning «the vendor accepted the key», the strongest available proof. Every consumer pays ~$0.12 per provision run, and repeated runs (a retry after fixing wiring) each bill again. |
| Amend §7a #3 to accept a cheaper proof | e.g. accept step C's resolution proof plus a first-real-task check. Cheaper, but a wrong key then surfaces on the consumer's first real task instead of at install. |
| Make step D opt-out | `provision --skip-model-proof` for cost-sensitive consumers. Honest, but an opt-out on a binding objective re-opens the false-green question the whole stage exists to close. |

`INSTALL-FOR-AI.md` now states the measured cost to the consumer regardless of which way this
goes, so nobody is billed by surprise while it is open.

---

## OPERATOR RESOLUTIONS (2026-08-09) — both open questions CLOSED

### §4 item 1 (live end-to-end on a clean machine) — ACCEPTED AS MET

**Decision: «считай готовой».** Stage acceptance rests on the block-level evidence, without a
live end-to-end run.

What that evidence is, stated plainly so a later reader can judge the decision rather than inherit
it: profile creation, per-mode defaults, the key-reachability gate, the chat-session pin and the
completion call were each measured live against a running aif; step D's four failure modes each
carry a paired negative that was observed RED before GREEN; the suite is 62/62 on the host. What
was NOT observed is those steps executing **in sequence, against a profile the helper itself
created, on a machine where the §7b wiring supplied the key**.

**The accepted risk, named:** the first consumer run is the first execution of the full chain. A
`FAILED step-D` there is most likely the §7b wiring not landing, not a defect in the proof. The
distinguishing signal is `CHAT_AUTH_ERROR` from `POST /chat` — the helper prints that hint.

**What would reopen this:** any consumer report of `FAILED step-D` on a first run. That is the
falsifier; it does not require re-litigating the decision, only reading the reported line.

### §7a #3 recurring per-consumer spend — ACCEPTED AS-IS

**Decision: «оставить как есть».** Step D fires on every `provision` and bills the consumer's z.ai
plan. Measured: **39058 input tokens, `costUsd:0.117219`** for a three-word prompt, because aif
prepends project context on the only reachable completion route (`buildContextAppend` is
unconditional on that path). A retry after fixing wiring bills again.

The kickoff's «1-token-scale» wording in §7a #3 is therefore **inaccurate as shipped** and is left
standing rather than quietly amended — the measured figure is what governs, and it is stated to the
consumer at `INSTALL-FOR-AI.md:184` before they run the step.

**Rejected alternatives, recorded so the choice is legible:** dropping to a resolution-only proof
(cheaper, but a wrong key surfaces on the consumer's first real task instead of at install); an
opt-out flag (re-opens the false-green question this stage exists to close). Neither was chosen.

### Stage vs umbrella — why there is still no `done.md`

Both questions above are closed, so **S4 as a stage is closed**. `done.md` is nonetheless NOT
written, for an unrelated reason: per
[operational-conventions.md §1](../../../docs/meta-factory/operational-conventions.md), `done.md`
marks the **umbrella** complete and is written at the **last stage's** merge only. `beta-delivery-ux`
still has R1 in flight (aif task `7a12c5bc`) and S2's follow-up unharvested (`a8337963`), among 8
`done`-but-unharvested tasks. Writing it now would make `priority-score.sh` Layer C3 score the
umbrella `status=DONE` and stop dispatching that remaining work.
