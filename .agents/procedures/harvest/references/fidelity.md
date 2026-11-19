# Harvest cold review and fidelity

> **Authoritative for:** the scoped harvest cold review and fidelity detail routed from [the skill card](../SKILL.md).
> **NOT authoritative for:** skill activation, shared gates, or project goal; those remain with the card and its declared owners.

1. **Own cold-QA before handoff** (T19) — CI checks form, not design. Invoke `superpowers:requesting-code-review` on the 3-dot diff (`git diff origin/staging...HEAD`).
2. **Fidelity verdict (design altitude — spec D2).** Dispatch
   [`agents/fidelity-auditor.md`](../../../../agents/fidelity-auditor.md) as a cold read-only
   subagent **with an explicit `name`** (keeps the resume exception of
   [cold-seat-economy.md §3](../../../rules/cold-seat-economy.md) reachable; the follow-up default
   is a fresh narrow seat): inputs = the
   stage kickoff/spec path + the same 3-dot diff, current HEAD sha,
   round number — nothing else (no chat, no logs).
   **Default format: inputs-inlined** (spec P7, [cold-seat-economy.md §3](../../../rules/cold-seat-economy.md) row 4): inline the kickoff scope sections + diff into the dispatch prompt (~85k tokens / 0 tool calls vs ~177k tokens / 7 tool calls for file-reading — row 4 vs row 3). File-reading is the **fallback** when content size prohibits inlining. **Promotion trigger** (cross-stage boundary): 3 incidents of >100k-token file-reading seats → a mechanical check in **S-B's station** (S-B owns the bottom-seat check station; not implemented here).
   Either format, the seat prompt carries the ref every input was taken at; in the file-reading fallback the paths are snapshots from `scripts/snapshot-for-seat.sh`, never live worktree paths ([cold-seat-economy.md §7](../../../rules/cold-seat-economy.md)):

   ```text
   Inputs-ref: <HEAD sha the diff and every file path in this prompt are taken at>
   ```

   `REVISE`/`STOP` → do NOT open the PR;
   factory task → route the findings per [/dispatcher §2.4 rework loop](../../dispatcher/SKILL.md),
   in-session work → fix and re-audit (Round 2); cap 2 rounds → escalate to the operator.
   `KICKOFF-AMBIGUOUS` → escalate to `/arch` §4 office hours without burning a round.
   `GO` → the verdict block (Basis/Round/Audited-SHA = current HEAD/Evidence) goes into the
   PR body `## Fidelity verdict` section — the `pr-body-fidelity` CI gate blocks merge without it.
   <!-- seat-economy embed (spec-of: .claude/rules/cold-seat-economy.md) -->

   **Seat economy** ([cold-seat-economy.md](../../../rules/cold-seat-economy.md)): dispatch this
   WHAT-audit only once the diff is FINAL (step 1's code-review first — its fixes invalidate a
   parallel fidelity verdict), and at round 1 have the seat leave a compact **watch-list**
   (why each criterion exists, where defects lived) in the PR body / task comment. If a later
   commit moves the SHA but none of what the seat judges (deliverables / permitted files /
   descopes — confirm via `git diff --name-only <audited>..HEAD` against the kickoff),
   re-establish with a narrow cold delta check: a **fresh** cold agent handed only the
   incremental diff + scope sections + that watch-list (resume the same auditor by name only
   when the watch-list cannot carry the substance) — never a full re-audit, never a
   self-issued verdict.
   <!-- re-write-trigger embed (spec-of: .claude/rules/cold-seat-economy.md §3) -->

   **Re-write-trigger economy** ([cold-seat-economy.md §3](../../../rules/cold-seat-economy.md)): when
   the seat has reached its natural end, the cached-prefix cost discipline applies —
   - prefer **artifact handoff** to a fresh seat over `/compact` — a fresh seat billed at read
     price on a narrow input is cheaper than re-billing the cached prefix at write price;
   - do **not** stretch a seat across the 1-hour TTL idle gap — the cached prefix expires; the
     next turn re-bills the whole prefix at write price;
   - avoid mid-session **model / effort switches** and **MCP toggles** on a fat context — each
     invalidates the cached prefix and re-bills it at write price (pending S-H P3d verification
     of the config-change class — rev 4 moved P3d there; same handoff rule applies until
     verified otherwise).
