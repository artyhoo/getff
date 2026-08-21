# consumer-findings-tail-verify — kickoff (verify + file the 4 un-tracked timeliner findings)

> **Type:** verification + (conditional) issue-filing. Fresh session, clean context.
> **Created:** 2026-06-16 (handoff from the closure-sweep session).
> **Goal:** for the 4 consumer findings (F6/F7/F8/F10) that the closure-sweep could NOT map to a dedicated GitHub issue, decide each: already-tracked / fixed-silently / genuinely-open → and file an issue ONLY when genuinely un-tracked AND still-reproducing.

## §1 Context (verified, do NOT re-discover)

The timeliner consumer-polygon audit (2026-06-13) logged 13 framework defects, preserved at **[docs/meta-factory/consumer-findings-timeliner.md](../../../docs/meta-factory/consumer-findings-timeliner.md)** (committed via PR #562). Most F1–F13 were since filed as issues #507–#552 (mostly CLOSED). A quick title-scan on 2026-06-16 could NOT find a dedicated issue for these **4**:

| Finding | Defect (read the doc's F-section for full detail) | Quick-scan issue status |
|---|---|---|
| **F6** (P2) | R4-probe calls `scripts/audit-r4.ts`, but `install.sh` does not copy `packages/core/probes/audit-r4.ts` → dangling reference in a consumer | **adjacent** to #552 (but #552 is a *different* prober — verify, likely separate) |
| **F7** (P2) | Preset enables R7/R8 by-default without the infra they need (Clock/Random/OTel) + no defer-guide | **none found** (maybe touched by #547 auto-wire — verify) |
| **F8** (P2) | `AGENTS.md.template` promises scripts/configs that ship in no template → living-docs drift out of the box | **adjacent** to #551 (but #551 is sub-agent tool-names, not the AGENTS template — verify, likely separate) |
| **F10** (P3) | `pre-push.fallback.sh` defaults base-ref to `origin/staging`, which a default-`main` consumer lacks | **none found** |

Repo (this framework): `Yhooi2/rules-as-tests-aif`. Consumer polygon (read-only reference): `Yhooi2/timeliner`. Umbrella issue tracking consumer acceptance: **#550**.

## §2 Procedure (per finding F6/F7/F8/F10)

1. **Read the F-section** in `docs/meta-factory/consumer-findings-timeliner.md` (full defect + `framework:`/`consumer:` path citations).
2. **Dedup against the tracker** — read the BODIES (not just titles) of open issues #547, #548, #549, #550, #551, #552, and search closed issues (`gh issue list --state closed --search "<keyword>"`). Decide: already-tracked (note issue#) / not-tracked.
3. **Re-verify the defect still reproduces** in the CURRENT source — the finding is dated 2026-06-13; some may have been fixed silently since (#507–#546 landed a lot). Check the cited `framework:` path in `install.sh` / the templates as they are NOW. If the defect no longer reproduces → mark fixed-silently, do NOT file.
4. **Classify:** `ALREADY-TRACKED #<n>` / `FIXED-SILENTLY (evidence)` / `FILE-NEW` (genuinely un-tracked AND still-reproduces).
5. **File** only the `FILE-NEW` ones: `gh issue create` against `Yhooi2/rules-as-tests-aif`, body quoting the F-section's `framework:` evidence; consider linking under umbrella #550.

## §3 Discipline

- **No duplicate issues** (T16 pattern-matching-on-name — #552/#551 *sound* related but are different bugs; confirm by reading bodies, not titles).
- **No stale issues** (T3 evidence — re-verify the defect reproduces in current source before filing; cite file:line).
- **No paid LLM / CI changes** — this is read + `gh issue create` only ([no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md)).
- **Issue-filing is outward-facing** — batch the `FILE-NEW` set and confirm with the maintainer before `gh issue create` (or proceed if the maintainer pre-authorized autonomous filing).

## §4 Deliverable

A short report: per F6/F7/F8/F10 → verdict (`ALREADY-TRACKED #n` / `FIXED-SILENTLY` / `FILED #n`) with file:line evidence. Net new issues: 0–4. Update the status-note in `docs/meta-factory/consumer-findings-timeliner.md` if any verdicts change its mapping.

## §5 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

Active traps for this task: **T3** (no prose-only verdict — quote file:line / issue-body / command output), **T11** (prior-art/dedup check before "FILE-NEW" — search the tracker first), **T13** (don't trust the 2026-06-13 finding as still-valid — re-verify against current source), **T16** (pattern-matching-on-name — #552/#551 only *look* like F6/F8; confirm by reading bodies).

Domain-specific trap — **T-CFTV-A:** «closed issue ≠ fixed defect». An issue may be CLOSED as wont-fix / superseded / duplicate while the defect still ships. For any `ALREADY-TRACKED` mapped to a CLOSED issue, confirm the fix actually landed in source — else re-classify `FILE-NEW` or reopen.

## §6 See also

- [docs/meta-factory/consumer-findings-timeliner.md](../../../docs/meta-factory/consumer-findings-timeliner.md) — the preserved F1–F13 backlog (this kickoff's input).
- GitHub issues #547–#552 (open) + #507–#546 (closed) — the dedup surface.
- Umbrella #550 — consumer functional-acceptance tracking.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
