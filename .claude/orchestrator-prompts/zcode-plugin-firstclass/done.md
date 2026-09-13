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

## Stage 4 — CC non-regression requirements (OWNER-SCHEDULED; partially executed 2026-09-13 night queue — headless legs green, session legs BLOCKED on CC auth)

Owner dispatches a later CC-side pass with these requirements. **Partial live record (2026-09-13, operator queue item Q3, CC 2.1.233, host machine):**

1. **CC install still works after this PR — headless half VERIFIED:** `claude plugin marketplace add artyhoo/getff` → success (clone of default branch `staging`); `claude plugin install getff@getff` → success (scope user); `claude plugin list` → `getff@getff Version: 0.3.0`; `installed_plugins.json` records `gitCommitSha 915c30412e9d9727aaa83f1fe75106197b843524`; payload complete at `~/.claude/plugins/cache/getff/getff/0.3.0/` — 8 skills incl. the CORE four (`ai-doc`, `rule-research`, `rule-tests`, `template-audit`), agents, commands, and `hooks/hooks.json` registering the row-3 twin `check-doc-authority-header` on `Edit|Write|MultiEdit` (a GAIN for CC consumers, as designed). **Session half BLOCKED:** the local CC client is logged out (`claude auth status` → `loggedIn: false`; OAuth session expired, refresh failed) — skills auto-trigger via bootstrap and the twin's live advisory/exit-2 fire need a live session, i.e. an operator `claude login` first.
2. **Dual-consumer shadowing — overlap set enumerated, resolution pending the same auth:** project `.claude/skills/` ∩ plugin skills = `ai-doc`, `rule-research`, `rule-tests`, `template-audit`, `tool-bootstrapping` (5). Plugin skills are namespaced `getff:<name>` in CC's listing, so coexistence is by construction; the which-wins-per-harness evidence needs a live session in the repo (post-login).
3. **CC marketplace cache version refresh — mechanism VERIFIED:** `claude plugin marketplace update getff` → success; the re-read manifest reports `getff 0.3.0` (the psg-bumped version, real top-level — the pitfall-9 discriminator, not 0.0.0). A live 0.3.0→0.3.1 bump transition was NOT fired (would require shipping a version bump not authorized in this queue).

The getff plugin is LEFT INSTALLED in CC (baseline had none) so the blocked session legs can run immediately after `claude login`; remove with `claude plugin uninstall getff@getff && claude plugin marketplace remove getff` if the baseline is preferred.

## Fork B leg (b) — zcode-plugins-official submission ASK (owner decision + credentials; NOT executed)

Documented ask per S1 Fork B: evaluate submitting `getff` to the `zcode-plugins-official` CDN marketplace (exists, 26 plugins — HOST fact 2026-09-11). Requires: owner credentials on the marketplace repo, distribution-policy call (self-serve GitHub vs curated CDN), and a maintenance commitment for the curated listing. Leg (a) — the documented GitHub path — is live and sufficient for consumers today.

## Tails / observations carried out of scope

- Root lockfile out of sync at staging tip (`npm ci` EUSAGE: gcp-metadata@7.0.1, js-yam@4.3.2 missing) — upstream task.
- check-skill-drift.sh + principle 14 RED at tip (27 broken refs — several targets never existed; 7 contract misses) — upstream task.
- Principle 37 make-target-claim RED at tip — upstream task.
- GAP-2 (check-hook-marker.sh stale scope comment + no plugin-channel matcher gate) — follow-up task recorded in #1727 §1.7 Backward-check; needs `SNAPSHOT_MODE=capture` on a provisioned machine.
- Fork A/B falsifiers stay armed post-merge (reversal = revert recording PR + kickoff §7 edit).
