# pipeline — status

> **Authoritative for:** the selected pipeline procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §2.6 `status` verb — read-only status render (A5)

> Three-section status against LIVE bricks (in-factory / parked questions /
> ready-to-harvest + PR state). NOT a dashboard — no persistent state, no
> refresh loop, no TUI. One-shot read + print.

**Step 1 — invoke renderer:**

```bash
bash ".agents/procedures/pipeline/helpers/render-status.sh"
```

**Section sources + degradation:**

| Section                     | Source                                                    | Degradation when brick unavailable    |
| --------------------------- | --------------------------------------------------------- | ------------------------------------- |
| In-factory                  | bridge REST (`/health`, task list)                        | "(bridge unreachable at <url>)"       |
| Parked questions            | `tsx packages/runtime-bridge/src/cli/questions.ts --json` | "(parked question status unknown — probe unavailable)"               |
| Ready-to-harvest + PR state | `gh pr list`                                              | "(PR status unknown — GitHub probe unavailable or invalid)" |

Ends with **suggested-next-command lines** (1-3 paste-able shell strings).
Only a successful, validated empty array establishes an empty population. Nonzero
CLI exit status or invalid JSON stays unknown, even if stdout contains stale rows.
The fallback parked-question filter covers only a subset of the canonical CLI.

Each section degrades independently — exit 0 unless the renderer itself crashes (defensive: an unreachable brick is a designed success path, §3 spec).

---
