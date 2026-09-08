# consumer-truth-audit V3 — harness-semantic verification (hooks, MCP, skills; CC + zcode)

> **Umbrella:** [kickoff.md](kickoff.md) — §4 is the reason this lane exists as its own stage.
> **Rigor label (effort-worthiness L0):** `research-grade`.
> **Bench:** live harness sessions ONLY. This lane is **not dispatchable to an aif container** —
> the questions it asks cannot be answered where no harness loads the artefacts.

## §0 Goal

Decide whether the artefacts that only mean something inside an AI harness actually fire in a
consumer project: hooks, MCP servers, skills, and the settings registration that wires them.

Delivery is V0's question. This lane asks the next one: **delivered AND registered AND fires**.
The three come apart, and the known instance proves it — `inject-matching-rule.sh` is delivered
and registered at `/Users/art/code/timeliner` and can never fire there, because the corpus it
reads is not shipped.

## §1 Two arms, deliberately

**Arm A — Claude Code.** A live CC session opened on a fresh consumer install (not on this
repo). Verify per artefact: does the event fire, does the hook produce its contracted output,
does a `/<command>` route to the shipped skill, does each MCP server in the delivered config
load.

**Arm B — zcode.** The same checklist under the second harness. This is not redundancy: it is
the only channel that catches «assumes Claude Code» assumptions baked into shipped artefacts.
The parity contract is [`zcode-parity-doctrine.md`](../../rules/zcode-parity-doctrine.md);
`/Users/art/code/zcode-probe` is the existing probe surface. Arm B may be harvested separately
by the operator and merged into this lane's report — in that case the report states which arm
produced which row.

A row measured on only one arm is reported as such. Do not generalise arm A to arm B.

## §2 Population (T10 — enumerate before deciding)

For the consumer install under test, enumerate:
- every file in `.claude/hooks/`;
- every hook registration in `.claude/settings.json`, with its event and matcher;
- every directory in `.claude/skills/` and the command name each claims;
- every server in the delivered MCP config;
- every agent in `.claude/agents/`.

Then for each: **fire it**. Registration without firing is the defect class.

## §3 Method — binding

1. **Fresh consumer, not this repo.** A hook that resolves `$CLAUDE_PROJECT_DIR` correctly on
   the factory tells you nothing.
2. **Trigger the real event**, do not invoke the script by hand. A `PostToolUse` hook is proven
   by editing a file in a live session and observing the injected context — not by running the
   `.sh` in a terminal. Running it by hand is the T2 failure for this lane, and it is the easy
   thing to do; do not do it.
3. **Record the observable**, not the intent: what the session actually received.
4. **Degradation is a result.** A hook designed to no-op gracefully when a dependency is absent
   must be tested with that dependency absent AND present, and the report says which state a
   real consumer is in. A permanent no-op is a finding even when it is a *graceful* one.
5. **MCP:** load the delivered config in a live session and record which servers came up.
   A server that fails to load silently is the same defect class as a hook that no-ops.

## §4 The gate — run it, quote command + output (T2/T3)

| # | Gate |
|---|---|
| 1 | population enumerated per §2 before any verdict |
| 2 | every hook has a real-event trigger result, never a hand-run result |
| 3 | every skill has a routing result from a live `/<command>` attempt |
| 4 | every MCP server has a load result |
| 5 | each row labelled with the arm that produced it (CC / zcode / both) |
| 6 | permanent no-ops named as findings, graceful or not |
| 7 | anything unreachable reported `PROBE-INCOMPLETE` with the reason, never guessed |
| 8 | self-falsification section present and non-trivial |

## §5 Out of scope

Fixing anything; the docs surface; delivery questions already owned by V0. If this lane finds
an artefact that is *not delivered*, that is V0's row — hand it over, do not duplicate the census.

## AI traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T2**, **T3**, **T7**, **T14**, **T15**.

- **T2** — the single biggest risk in this lane. Running a hook script by hand and calling it
  verified is exactly «designing ≠ auditing». Fire the event.
- **T3** — the evidence is the session's observable output, quoted.
- **T7** — write and run the adversarial counter-prompt: «which shipped artefact silently does
  nothing, and how would I even notice?» If it surfaces nothing, rephrase and run it again.
- **T14** — three hooks verified out of fifteen is 20% coverage, not a clean harness.
- **T15** — this framework's thesis is that enforcement must fire at the earliest reachable
  channel. Report what channel would have caught each finding earlier than this audit did.
