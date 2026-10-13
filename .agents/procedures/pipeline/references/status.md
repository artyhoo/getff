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

<!-- prettier-ignore -->
| Section                     | Source                                                    | Degradation when brick unavailable                          |
| --------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| In-factory                  | bridge REST (`/health`, task list)                        | "(bridge unreachable at <url>)"                             |
| Parked questions            | `tsx packages/runtime-bridge/src/cli/questions.ts --json` | "(parked question status unknown — probe unavailable)"      |
| Ready-to-harvest + PR state | `gh pr list`                                              | "(PR status unknown — GitHub probe unavailable or invalid)" |

Ends with **suggested-next-command lines** (1-3 paste-able shell strings).
Only a successful, validated empty array establishes an empty population. Nonzero
CLI exit status or invalid JSON stays unknown, even if stdout contains stale rows.
The fallback parked-question filter covers only a subset of the canonical CLI.

In-factory output separates `done`/`verified` history from current attention
rows and prints exact task/project IDs when supplied by the source. Unknown statuses
remain visible. `blocked_external` is retained for attention, not counted as a
running worker; its terminal meaning in bridge waits does not resolve its issue. Current rows and parked signals are capped at 20 with explicit omitted
counts; multiline titles and blocked reasons are excerpted, and review bodies are not
printed. A task status does not establish an owner/session binding or readiness.

Fallback parked signals prompt inspection of the canonical question and owner receipt,
not an answer action. PR mergeability prompts check inspection and does not establish
CI/review acceptance or merge permission.

Each section degrades independently — exit 0 unless the renderer itself crashes (defensive: an unreachable brick is a designed success path, §3 spec).

---
