# Handoff — skill-stack harmonization contour (continue in a fresh session)

> **Status:** HANDOFF 2026-08-18 — interview phase of the `/arch` contour is COMPLETE
> (frontier empty, all decisions ratified in the spec); the contour's remaining phases
> (§2 cold review → §3 exit routing) are NOT done. Delete or archive this file when the
> contour closes.
> **Authoritative for:** continuation state of THIS design contour only.
> **NOT authoritative for:** the design itself — see
> [2026-08-18-skill-stack-harmonization-design.md](2026-08-18-skill-stack-harmonization-design.md)
> (the spec, SSOT for all decisions); raw evidence — the
> [prep-doc](2026-08-17-arch-prep-skill-stack-harmonization.md).

## Session-start for the continuation session

1. Worktree isolation; branch `claude/keen-shannon-46577a`; re-run the in-flight probe
   immediately before any edit (a parallel actor committed to this branch mid-session on
   2026-08-17 — precedent).
2. Read order: the spec → this file → prep-doc §5/§6 (register + probes) → `/arch` §2-§3.
3. PR pause in force unless the operator lifts it.
4. This handoff was written WITHOUT the final in-flight probe (operator interrupted it to
   close the session) — the continuation session must fetch + probe before committing
   anything.

## What is done (do not redo)

- All D-H0…D-H16 decisions ratified — spec §4 is the register; do NOT re-open D-H2
  (TDD), D-H3 (debugging), D-H5 (claims), D-H11 (glossary), D-H15 (prune): each was
  argued to closure with the operator, falsifiers recorded.
- Probes P1, P2a-c, P6 executed; P6's `skillOverrides` workaround claim falsified by a
  direct skills.md fetch (spec §6). Do not re-run these.
- Operator-premise register captured (spec §2) — P-1 governs style: argue, don't yield.

## What remains (the contour's tail, in order)

1. **Commit the spec + this handoff** on `claude/keen-shannon-46577a` (probe first; the
   writing session did not commit — operator closed it before the probe).
2. **§2 cold two-altitude review** (`/arch` §2): two read-only mid-tier (Opus) subagents,
   handed ONLY artifact paths (spec + prep-doc), never chat context. Unique output files
   in the session scratchpad: `top-down-skill-harmonization.md`,
   `bottom-up-skill-harmonization.md`. Verdict grammar `VERDICT: GO | REVISE | STOP`;
   findings `BLOCKER | MAJOR | MINOR | ESCALATED` with file:line; round-triggering
   findings carry `Failure-scenario:`. Reports side by side, never merged/reranked. Cap 2
   REVISE rounds → surface to operator. Dispositions land in spec §9 changelog
   (`ACCEPTED | DISSOLVED | ESCALATED | FIXED`).
3. **§3 exit routing** after GO — the inventory is pre-sorted in spec §8: operator
   actions (P5, prune, setup, aif install), small in-session edits, two factory
   umbrellas («skill-harmonization-mechanisms», «orchestrator-rewrite»), SSOT rows.
   Emit dispatch chips per pipeline `references/output-format.md §9` where applicable.
4. **SSOT #253**: append the session's observations (P2 3/3 routing probe, prune
   doctrine) to the existing row's arms; add the new REJECT rows (spec §8 item 5).

## Traps for the continuation session

- The permission classifier blocks agent writes to `~/.claude/plugins/cache/**` — P5 and
  the prune run are OPERATOR actions; do not retry as agent.
- `docs/superpowers/specs/` files count toward the 600-line markdown gate; the spec is
  ~250 lines — safe, but check `wc -l` before growing it in review rounds.
- Two background-agent findings conflicted (P1 vs P6 on `skillOverrides`); the resolution
  rule that worked: fetch the primary doc and quote it — keep doing that for any new
  routing-mechanics claim.
- Matt's `research` skill must stay OUT of any prune list — wayfinder's research tickets
  invoke it by name (wayfinder/SKILL.md:77).
