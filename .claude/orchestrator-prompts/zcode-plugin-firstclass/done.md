# done.md — zcode-plugin-firstclass

**Status:** DONE (2026-09-13 — Stage 2+3 merged in #1727 with HOST evidence recorded in the PR body before merge).
**Stages:** 0 ✅ #1724 · 1 ✅ #1726 · 2 ✅ #1727 · 3 ✅ #1727 (HOST evidence in the PR body) · 4 ✅ documented here (external, owner-scheduled).

## What the umbrella delivered

- ZCode consumer install path VERIFIED + DOCUMENTED (README «As a ZCode plugin» block, finalized to the live-verified Discover-tab flow; claims map with verbatim evidence in the #1727 body; merge was held until the evidence was posted — Fork D).
- Doctrine row-3 `plugin-gap` CLOSED: `plugin/hooks/check-doc-authority-header` twin (generated identity-mode) + `PLUGIN_INTERNAL_HOOKS` registration + `POST_MUTATION_GATES` 4→5 + full doctrine count/citation sync — the plugin-gap class is now empty (Fork C; falsifiers stayed armed, none fired: all six sync-point gates green, byte-identity proven).
- Manifest slot: STAY single-source `plugin/.claude-plugin/plugin.json` (Fork A; flips only on live Stage-3 degradation evidence — none observed in the 2026-09-13 HOST run; falsifier not fired).
- Compatibility staleness cluster fixed (README counts → census pointers; Wave B line → merged status citing doctrine §3).

## Stage 3 — HOST live acceptance record (ZCode 3.11.2, 2026-09-13)

All checklist items green — verbatim outputs in the #1727 body («Stage 3 — HOST live acceptance record»):
marketplace add via Discover `+` (`artyhoo/getff`) ✅ · install/update 0.2.0→0.3.0 ✅ (pitfall-9 discriminator: real top-level version, not 0.0.0) · skills 8/8 incl. CORE four ✅ · `/install-enforcement` command listed ✅ · agents recorded-not-executed ✅ · PostToolUse advisory contract live-fired (doc-authority twin `additionalContext` arm) ✅ · `probe-zcode-runtime.sh` 17/17 ✅ · dev snapshot restored post-run ✅.
**Live findings:** (1) ZCode has NO plugin CLI/slash surface (probe 2026-09-13: `/Applications/ZCode.app/Contents/MacOS/ZCode --help` starts the Electron GUI, no CLI subcommands; plugin lifecycle is Settings → Plugin Management only — corroborated by the bundled zcode-guide SKILL.md «Managing plugins in the client») — the README command block was rewritten to the verified UI flow before merge (commit `d3beff0afd0`); (2) DECISION-NEEDED parked in #1727: a GitHub `artyhoo/getff` marketplace add silently REPLACES a same-id local dev registration (marketplaces keyed by marketplace.json `name`) — the two cannot coexist as-is.

## Stage 4 — CC non-regression requirements (OWNER-SCHEDULED; documented, not executed)

Owner dispatches a later CC-side pass with these requirements:

1. **CC install still works after this PR:** `/plugin marketplace add artyhoo/getff` + `/plugin install getff@getff` on Claude Code; plugin listed; skills auto-trigger via SessionStart bootstrap. The row-3 twin and README changes must not alter the CC payload path (the twin ADDS a plugin hook; CC plugin consumers gain the header gate — verify it fires advisory/exit-2 per CC schema, not a regression).
2. **No skill shadowing on a dual consumer:** a machine with BOTH installer-copied `.claude/skills/<name>` (via `./setup`) and plugin `getff:<name>` skills must not get duplicate/conflicting skill identities — enumerate the overlap set and record which wins per harness resolution order.
3. **CC marketplace cache version refresh:** after the sibling `plugin-skills-generator`'s bumped `plugin.json`/`marketplace.json` on staging, CC's marketplace update path picks the new version (CC analog of pitfall 9).

## Fork B leg (b) — zcode-plugins-official submission ASK (owner decision + credentials; NOT executed)

Documented ask per S1 Fork B: evaluate submitting `getff` to the `zcode-plugins-official` CDN marketplace (exists, 26 plugins — HOST fact 2026-09-11). Requires: owner credentials on the marketplace repo, distribution-policy call (self-serve GitHub vs curated CDN), and a maintenance commitment for the curated listing. Leg (a) — the documented GitHub path — is live and sufficient for consumers today.

## Tails / observations carried out of scope

- Root lockfile out of sync at staging tip (`npm ci` EUSAGE: gcp-metadata@7.0.1, js-yam@4.3.2 missing) — upstream task.
- check-skill-drift.sh + principle 14 RED at tip (27 broken refs — several targets never existed; 7 contract misses) — upstream task.
- Principle 37 make-target-claim RED at tip — upstream task.
- GAP-2 (check-hook-marker.sh stale scope comment + no plugin-channel matcher gate) — follow-up task recorded in #1727 §1.7 Backward-check; needs `SNAPSHOT_MODE=capture` on a provisioned machine.
- Fork A/B falsifiers stay armed post-merge (reversal = revert recording PR + kickoff §7 edit).
