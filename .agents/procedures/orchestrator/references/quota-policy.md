# orchestrator — quota policy

> **Authoritative for:** the selected orchestrator procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## Quota monitoring (cross-cutting rule, active from Phase 3)

The senior tracks quota spend in real time and switches mode when thresholds are crossed. Without this you can hit a 429 mid-batch and lose progress.

### What to track

- **After every Agent call** the tool result carries a `<usage>total_tokens: N tool_uses: M duration_ms: T</usage>` block. **Remember N for each call.**
- **Cumulative Opus** = the sum of total_tokens across all inline Agent calls + an estimate of my own actions (~500-1500 tokens per substantial message, +500-2000 for reading a large file).
- **Cumulative Sonnet** = not directly observable from this session: Mode B runs in separate windows. Rely on the user's signal («Sonnet ~200k», «sonnet is yellow») or ask for `/status` from their sessions.

### Zones and response

| Zone        | Sonnet cumul | Opus cumul (mine) | Action                                                                                                                                                                                                                            |
| ----------- | ------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 Green    | <150k        | <30k              | **Mode A — the default for everything** (execution + research). Continue.                                                                                                                                                         |
| 🟡 Yellow-S | 150–350k     | <30k              | Sonnet pool running out — not critical, Mode A on the Opus pool runs freely. If Mode B was used in parallel, consolidate windows.                                                                                                 |
| 🟡 Yellow-O | <150k        | 30–80k            | **Opus pool under load — THIS is when Mode B is justified:** move bulk execution to Mode B (file-prompt → Sonnet windows) to relieve Opus. Mode B here is a pressure-release valve, not the default. Minimise your own Read/Bash. |
| 🔴 Red      | >350k        | >80k              | **Pause.** Report the state and offer: (a) `/clear` and continue, (b) break until reset, (c) make sure remaining batches go through Mode B.                                                                                       |
| ⛔ Critical | 429          | same              | Stop. Log what is committed and what sits in the working tree, wait for reset.                                                                                                                                                    |

### Reset windows

Anthropic Max plan: quotas reset on a rolling 5-hour window. Exact figures come from `/status` (when it works) or claude.ai/usage. Rough limits: Opus ~200k/5h, Sonnet ~1M/5h. **The numbers are imprecise** — this is grey area. Use them for threshold estimation only.

> **Fable (the top tier) is deliberately NOT wired into the zones above** — its pool size and reset window are unknown, and inventing thresholds would be fabrication. Since Fable is the most capable and probably the scarcest model, spend it **deliberately and selectively** (only the «hardest tasks» from the «Model rule»), keep your own manual count of Fable calls, and cross-check against `/status`. Wiring Fable into the traffic light is a follow-up for when real limit figures exist.

**Quota-message format for the user + Burn mode (an explicit «burn Opus» on signal): [references/quota-and-burn.md](quota-and-burn.md).** In short: on a zone change — one line at the start of the next report; per-batch with no zone change — silence; burn mode only on an explicit user trigger, never autonomously.

### Quota-monitoring anti-patterns

- ❌ Ignoring `<usage>` in the tool result.
- ❌ Silently pushing into the Red zone «it'll probably hold».
- ❌ Recounting from scratch each round. Keep a cumulative total from session start.
- ❌ Spending Opus on quota tracking. This is an in-head operation.
- ❌ Reporting quota per batch when the zone has not changed — that is spam.

---
