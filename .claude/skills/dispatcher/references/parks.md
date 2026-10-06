# dispatcher — parks

> **Authoritative for:** the selected dispatcher procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §3 Q&A — three park types

When §2.2 detects a parked signal, identify the park type from the taxonomy table, then apply the resolution path.

### Park-type taxonomy

| Park mechanism                                       | Detected via                     | Resolved via                                             | `answer.ts --decision`         |
| ---------------------------------------------------- | -------------------------------- | -------------------------------------------------------- | ------------------------------ |
| `blockedReason` non-empty                            | `questions.ts` `isParked()`      | see fork-type below                                      | `request_changes` or `retry`   |
| `status=blocked_external`                            | `questions.ts` `isParked()`      | `answer.ts`                                              | `retry`                        |
| `manualReviewRequired:true`                          | `questions.ts` `isParked()`      | `answer.ts`                                              | `approve` or `request_changes` |
| A-park: `paused:true + OPEN_QUESTION_ANCHOR` in plan | `questions.ts` conjunction check | `answer.ts --decision resume` (PUT, bypasses events API) | `resume`                       |

Sources: `questions.ts:85-93` (detection), `answer.ts:207-212` (A-park resume).

### Routing seats (who answers which class — spec D5)

<!-- prettier-ignore -->
| Question class                                                     | Day                                                                                                                                                                                                | Night (unattended)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| technical / in-scope (implementation choice within kickoff bounds) | this dispatcher session resolves autonomously (brainstorm → `answer.ts`); decision recorded in the task comment + PR `## Parked questions`                                                         | same — autonomous                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| intent / goal / design (changes WHAT to build)                     | file an ask + `ASK` when the advisor is reachable ([advisor-pattern-design §2/§5.1](../../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md); ask-file format — see below the table); else `/arch` §4 office hours, top seat | file an ask + `ASK` when the advisor is reachable (same ref + the same format note; non-blocking — defer the item, keep working); else: a live top-tier seat exists and is sweeping → it may decide the park per the night envelope ([session-bus v2 §4](../../../../docs/superpowers/specs/2026-08-09-session-bus-v2.md) + [night v3 §6 object cut](../../../../docs/superpowers/specs/2026-08-09-autonomous-night-v3-design.md)); else **stay parked — never guess**; morning batch sweep (`questions.ts --project`) |
| environment (container/tooling broken)                             | `/aif-doctor`                                                                                                                                                                                      | `/aif-doctor` non-destructive arm; else stay parked                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Filing the ask — do not hand-write the format.** `bash scripts/check-ask-files.sh --print-template [consult|materiality-dispute] [role]` emits a fileable skeleton; `--help` prints the mailbox path resolved on this machine plus the filename convention and the atomic write-temp+rename recipe; the same script with no arguments validates the result and is the pre-push section `ask-file-schema`. Emitter and validator are deliberately one file, so a skeleton that stops passing is a red test rather than a stale doc. A **materiality dispute** additionally carries the reviewer's finding copied verbatim, never paraphrased ([reviewer-discipline.md §6](../../../rules/reviewer-discipline.md)) — `--print-template materiality-dispute` lays out both extra sections. _Operator-repo surface at v1_: the mailbox default is `rules-as-tests-aif`-scoped and the script is not shipped by `setup.d/`, so on a consumer install this row degrades to its `else` branch (`/arch` office hours by day, stay-parked by night) — consumer delivery is a later stage, never a silent copy ([advisor-pattern-design §1](../../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md)).

<!-- effort-worthiness embed (spec-of: .claude/rules/effort-worthiness.md) -->

**Effort-worthiness** ([effort-worthiness.md](../../../rules/effort-worthiness.md)): before demanding a probe/extra round on any park resolution, run the four-test card — practice-first on reversible surfaces; a round-budget breach escalates via ASK, never a guillotine and never a silent push-through.

### Type 1 — Technical fork (HOW to implement; no taste involved)

**Detected:** parked reason describes an implementation choice where either path is technically valid and does not affect project scope or direction (e.g. "which API variant", "which data structure", "retry or fail-fast on 429").

**Resolution (CC-present path):**

1. Read the parked question via `tsx packages/runtime-bridge/src/cli/questions.ts`
2. Invoke `superpowers:brainstorming` autonomously with the question as input → generates a reasoned recommendation with evidence
3. Apply via `answer.ts --task <id> --answer "<recommendation>" --decision request_changes` (B-park) OR `--decision resume` (A-park)
4. Report what was decided and why — operator sees the outcome, not a question

**Discrimination discipline (baked into this skill prose because `ask-question-reminder.sh` fires only a generic pre-question fork-challenge nudge and carries no TECHNICAL/STRATEGIC split of its own — and it is no longer operator-internal either: it ships to consumer CC projects, `ask-question-reminder.sh:6`):** a fork is TECHNICAL when the parked reason is about mechanics, implementation detail, or tradeoff within a single subsystem. A fork is STRATEGIC when it involves scope, architecture decisions, project direction, or "whether" to do something at all. When in doubt, surface to operator (Type 2 path).

### Type 2 — Strategic fork (WHAT/WHETHER; maintainer decides)

**Detected:** parked reason involves scope, architecture, project-wide policy, or project direction — the operator must decide.

**Resolution:**

1. `tsx packages/runtime-bridge/src/cli/questions.ts` → surface parked task to operator
2. **Park-chip (ADR D3/D4, stage S3)** — emit one, per the contract below, so the decision stops depending on this session staying alive
3. Operator reviews, optionally invokes `superpowers:brainstorming` for deliberation
4. Operator provides answer; `/dispatcher` applies: `tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --answer "<decision>" --decision request_changes` (B-park) OR `--decision resume` (A-park)
5. Loop resumes

Step 2 composes with the routing-seats table above, it does not replace it: when the advisor is reachable, the ask + `ASK` stays the first move, and the chip is what materialises a decision venue when no live seat holds the question — at night it simply waits, unclicked and inert, until morning.

**Park-chip contract (pointer-only — the emitter is `/dispatcher`; dispatch chips are a different animal, contract in [pipeline `references/output-format.md` §9](../../pipeline/references/output-format.md)).** Capability-gated exactly like the dispatch chips: emit only when `spawn_task` is invocable in this session (runtime roster probe — never a version-sniff, never an `allowed-tools` entry). Probe fails → today's behaviour verbatim, no apology line.

| Field    | Content                                                                                                                                                                                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`  | `Decide: <one-line question> [<umbrella>]`. One chip MAY batch a burst — `Decide 6 parked questions [<umbrella>]` — because bursts are the observed shape, not the exception                                                                                                       |
| `tldr`   | the recommended **seat class** plus the umbrella — `spawn_task` cannot name a model, so the operator's model pick at click IS the seat control (`intent/goal fork — open in a top-tier session`, per [arch/SKILL.md §4](../../arch/SKILL.md))                                      |
| `prompt` | **pointers only**: parked task-id(s), kickoff path, and the routing-seat context above. **Never the park payload body** — an inlined hint is untrusted by construction, since the chip outlives the state it was minted from (`REPORT supplementary, mechanical state wins`, §2.2) |

**Decision-session protocol — what a click authorizes.** The chip prompt instructs the spawned session to:

1. **Re-verify at click time, never trust the chip:** re-fetch the park from aif (`questions.ts`, read-only) using the task-id. No matching parked task, or the park is already answered → **report and stop**; the chip was stale (`dismiss_task` is best-effort, never a guarantee).
2. **Assemble a decision package** — question · evidence · a reasoned recommendation with its falsifier (H1 discipline) · options with consequences — and present it. Apply the class split internally per [arch/SKILL.md §4](../../arch/SKILL.md): in-scope architecture is answerable at the senior seat, intent/goal belongs to the operator.
3. **Apply from that session, with the owning CLI:** `tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --answer "<decision>" --decision <request_changes|resume>`. A fresh session has full tools — nothing is relayed back through the emitting `/dispatcher`.
4. **Record durably:** the aif task comment + the PR `## Parked questions` section. The chip is ephemeral by design — a restart loses the chip, never the park, and the morning sweep (`questions.ts --project`) stays the mechanical backstop.

**Coverage honesty.** A park raised while no `/dispatcher` session is alive produces no chip at all and falls back to that sweep. Worker-emitted park-chips are out of scope (ADR F7 — factory containers configure no ccd server). **Falsifier:** if parks keep getting answered through some other path while chips rot unclicked, the edge costs nothing standing and retires by deleting this block.

### Type 3 — Terminal (no Q&A needed)

**Detected:** `status=done` or `status=verified` without a parked signal. Proceed directly to §2.4 harvest.

### CC-absent degradation (portable fallback)

**Capability-check (not brand-name detection per `dual-implementation-discipline.md §4`):** probe whether the `superpowers:brainstorming` Skill-tool is reachable in the current harness (attempt invocation with a sentinel probe, or check `CLAUDE_SKILL_DIR` environment + skill discovery). Do NOT branch on harness name strings like `"claude"` or `"cc"`.

If the brainstorming companion is unreachable (Cursor / Aider / Codex / no Superpowers installed): **technical forks degrade to Type 2 behaviour** — surface to operator rather than resolving autonomously. The portable markdown of this skill provides the same discrimination discipline; the autonomous resolution step is skipped. This is the CC-absent path by necessity, not a stub.

**Park-chips degrade the same way, and by the same probe:** no invocable `spawn_task` in the roster → skip step 2 of Type 2 silently and surface the park as before. Nothing downstream depends on a chip existing — the decision package, `answer.ts` application, and the morning sweep are all chip-independent, so the degraded path loses latency, never coverage.

---
