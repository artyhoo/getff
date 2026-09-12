<!-- scope:zcode-plugin-firstclass -->
<!-- Stage 1 (decision pack) of the zcode-plugin-firstclass umbrella — kickoff #1721 §2 Stage 1.
     Research doc only: NO shared-file edits (README / doctrine / renderer / plugin payloads are
     Stage 2 surfaces). Each fork carries H1 form: evidence (file:line or probe), recommendation,
     falsifier («wrong if …»). Forks whose evidence contradicts the recommendation escalate as
     DECISION-NEEDED per kickoff §5 — none do at this time. -->

# zcode-plugin-firstclass Stage 1 — decision pack (forks A–D)

> **Authoritative for:** this umbrella's fork dispositions A–D — the record of evidence, recommendation, and falsifier each; consumed by Stage 2 implementation.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The evidence itself — the [Stage 0 patch](2026-09-12-zcode-plugin-firstclass-s0.md) (§-references below point there); hook-census classifications — [zcode-parity-doctrine.md §2](../../../.claude/rules/zcode-parity-doctrine.md).

Standing posture (kickoff §7, not re-litigated here): ZCode-first, CC deferred-but-documented; design-first (research before fixes); skills generation + version bumps + `M1_SET` belong to the sibling umbrella `plugin-skills-generator`; Stage 3 live acceptance is merge-blocking and HOST-side.

## Fork A — manifest slot: `.zcode-plugin/` twin or stay on the fallback?

**Evidence:** S0 §2 probe 0.1 — no `.zcode-plugin/` path exists anywhere in the tree; the plugin manifest ships only at `plugin/.claude-plugin/plugin.json` (fallback slot per zcode-guide's probe order, HOST quote 2026-09-11). That fallback slot demonstrably works: the machine-local dev snapshot installs and its skills load live through it. S0 §3 F5: the plugin channel is the only ZCode reach (installer has zero `.zcode` awareness). The manifest content is harness-neutral (probe 0.6: no CC-specific fields, no explicit arrays).

**Recommendation: STAY single-source on `.claude-plugin/plugin.json`.** Rationale: a `.zcode-plugin/` twin is a dual-implementation payload surface ([dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md) — a second manifest to keep in lockstep, a generator extension to never hand-copy it, and a gate to catch its drift) purchased to fix a degradation with zero demonstrations. BFR lens ([build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md)): the fallback is the upstream-native mechanism already in use; the twin is build-ahead-of-need (`#integration-overhead-overestimate`'s inverse — maintenance surface with no named gap).

**Falsifier («wrong if»):** HOST evidence that the fallback slot degrades — a Stage 3 consumer install where the plugin is only recognized via `.zcode-plugin/`, a live component-discovery difference vs the dev-snapshot behavior, or a zcode-guide re-quote (S0 §5 request 0.7) marking `.claude-plugin` deprecated/downgraded. Any of those flips this fork; the twin then lands via the twin-generator pattern (never hand-copied) in a follow-up scope change.

**Decision-holder:** executor may proceed on the recommendation; flip requires the falsifier to fire → DECISION-NEEDED to the owner (kickoff §5).

## Fork B — publication channel: GitHub marketplace, official CDN, or both?

**Evidence:** S0 §2 probe 0.1 — the repo ROOT already carries `.claude-plugin/marketplace.json` (marketplace `getff`, plugin source `./plugin`, `strict: true`) — the exact artifact a marketplace-add consumes; the same repo already serves CC consumers at README:142. S0 §2 probe 0.2 — nothing in README documents any ZCode consumer path. zcode-guide (HOST quote 2026-09-11): the Discover-tab `+` accepts «a GitHub repository, a Git URL, a local directory, or a file»; source kinds directory/github/git/url/git-subdir. S0 §3 F4-adjacent: `zcode-plugins-official` exists as a CDN marketplace (26 plugins, HOST fact 2026-09-11).

**Recommendation: leg (a) — verify + document the GitHub marketplace path `artyhoo/getff` as THE ZCode consumer path.** Zero new infrastructure; one artifact serves both harnesses; Stage 3 exists precisely to convert «mechanistically supported» into «verified» before the docs claim it (the README block lands in Stage 2 but merge waits on Stage 3 evidence). **Leg (b) — submission to `zcode-plugins-official`: document the ASK only** (what submission would require, that it needs owner credentials, that it is a distribution-policy decision); execution is a non-goal (kickoff §6). Leg (c) sequencing collapses into (a) + the documented ask — no third path is proposed.

**Falsifier («wrong if»):** Stage 3 HOST marketplace-add from GitHub fails, or resolves the manifest differently than the dev-snapshot install did (different discovery, different trust behavior). Then (a) is unverified and the fork reopens — with (b) potentially becoming the only working consumer path, which is an owner decision by construction.

**Decision-holder:** leg (a) = executor; leg (b) = owner (credentials + policy). The ask is documented in Stage 4/§closure notes, not executed.

## Fork C — doctrine row-3 twin: ship `check-doc-authority-header` into `plugin/hooks/`?

**Evidence:** S0 §2 probe 0.3 — the twin is absent (`grep check-doc-authority-header` on `git ls-tree origin/staging plugin/hooks/` → rc=1) while row 4's `check-doc-authority` twin IS present; the source hook exists at `.claude/hooks/check-doc-authority-header.sh` (consumer-safe by construction: pure bash + jq, degrades LOUDLY when jq is absent — its own header comment). Doctrine §4 row 3 (:109) itself anticipates the fix: «a Stage 6 follow-up would ship the missing twin to close it». S0 §3 F1 — the registration mechanics are pinned (PLUGIN_INTERNAL_HOOKS + renderer regen; the model-derived arm would wrongly enable the framework to run the consumer reimplementation on itself); F2 — the twin seeding must be the exact identity render (clobber guard); F8 — `POST_MUTATION_GATES` grows by one for the renderer's advisory-only note to stay truthful.

**Recommendation: GO** — close the doctrine's one retained `plugin-gap`: seed the twin (identity render, `+x`), register in `PLUGIN_INTERNAL_HOOKS` (`PostToolUse`, matcher `Edit|Write|MultiEdit` mirroring hooks.json:81), `node scripts/render-harness-config.mjs --write`, extend `POST_MUTATION_GATES` (F8), sync doctrine §2 row 3 + rollup + §4 row 3 + §5 recount (16→17) + the drifted `setup.d/10-skills.sh:246`→`:332-342` citation (F3) in the same commit. Gate-note: this is NOT a capability commit by the CLAUDE.md detector (no new dependency; file not under `packages/`; the S0 §7 SSOT consult found no matching prior-art row — nearest #84 is CC-channel).

**Falsifier («wrong if»):** any Stage 2 gate goes RED for a reason inherent to the twin (not environment noise — per memory, prove sweep/hook REDs are env noise before blaming the diff): principle 24 V6 (hooks.json target must exist as sibling — satisfied by construction), twin-generation byte-identity, harness-config-drift `--check`, or check-hook-marker rejecting the plugin registration shape. Also: if the sibling umbrella's in-flight `plugin.json`/`marketplace.json` version bump collides with any payload surface here → park, never parallel-edit (kickoff §6).

**Decision-holder:** executor (kickoff pre-recommends GO; §7 settles it). A live-ZCode surprise at Stage 3 (hook fires differently than CC) is a disposition note, not a fork flip — PostToolUse gates are ADVISORY-ONLY on ZCode by schema (`Uan`), already declared loudly by the renderer (S0 F8 context).

## Fork D — README shape: ZCode install block + Compatibility sync

**Evidence:** S0 §2 probe 0.2 — CC one-liner at README:142 with no ZCode counterpart; Compatibility block :269-285 carries no install path. S0 §3 F3 staleness cluster, all probed: README:274 «all 20 hooks» (live 22), README:275 «Three CC-only events» (doctrine: four, PreCompact added 2026-09-10), doctrine :117 «all 21 hooks» (live 22), doctrine :45 cites `setup.d/10-skills.sh:246` (actual :332-342), README:285 Wave B «implementation-pending» (all four stages merged via #1043/#1044/#1046/#1047 — verified in git log, S0 §2 probe 0.3).

**Recommendation:** (1) New «ZCode» consumer block beside the CC one-liner — marketplace-add + install one-liners, the soft/hard boundary restated for ZCode, the `/getff:install-enforcement` reachability marked per the Stage 3 probe outcome (verified-claims-only: nothing ships here that Stage 3 has not run); agents-channel disposition note (record-not-execute). (2) Compatibility sync: hook-count claims resolved against the doctrine census instead of rotting hard-coded numbers where feasible; three-events→four; Wave B line rewritten to merged-status citing doctrine §3. (3) Doctrine :45/:117 line-citation + count fixes ride Fork C's doctrine sync.

**Falsifier («wrong if»):** Stage 3 HOST evidence contradicting any documented claim (install syntax, discovery behavior, refresh path differing from pitfall-9). Mitigation is structural: Fork D edits land in Stage 2 but the PR does not merge before Stage 3 evidence posts (Task 5) — the docs and the live run cannot drift apart at merge time.

**Decision-holder:** executor within the above shape; any claim Stage 3 cannot verify stays OUT of README (surfaced instead) — that is the verified-claims-only rule, not an open fork.

## Cross-fork disposition (recorded, not decided here)

**Sibling hard gate (S0 F4):** `plugin-skills-generator` has no `done.md` on staging at Stage 1 time. Stage 2 re-checks mechanically at execution time (fresh fetch + `git ls-tree origin/staging .claude/orchestrator-prompts/plugin-skills-generator/done.md`); absent → park `blocked_external` per kickoff §2 Stage 2 — the dispatcher resolves via `answer.ts --decision retry` once the sibling merges. No Stage 2 edit of `plugin/skills/`, `plugin.json`, `marketplace.json`, or `M1_SET` under any circumstance (kickoff §1 goal 4).

## §1.7 self-review

**Forward-check applied:**
- H1 discipline (recommendation-laziness-discipline): every fork carries evidence (file:line / probe / dated HOST quote), recommendation, falsifier. ✓
- `phase-research-coverage.md §1.7` (T21): backward-check below is enumeration-format with per-surface verdicts. ✓
- Build-vs-reuse (T11/SSOT): consult executed in S0 §7 (no matching prior-art row; nearest #84 recorded); no capability commit proposed by this doc. ✓
- T20: no fork verdict issued without its S0 §2/§3 evidence pointer. ✓
- Scope guard (CLAUDE.md PR strategy): this doc edits no shared file; shared-file consequences are named as Stage 2 work items, not done here. ✓

**Backward-check applied** — Class = «fork-decision record for a ZCode consumer-path umbrella». Surfaces where fork-decision records for this umbrella could already exist or must later hold:

- `docs/meta-factory/zcode-parity-mega.decisions.md` — SWEPT-CLEAN (owns the 2026-07-18 parity forks; this umbrella's forks are new scope, recorded here; no contradicting row — S0 probe 0.3).
- `.claude/orchestrator-prompts/zcode-plugin-firstclass/kickoff.md` §2 Stage 1 — SWEPT-CLEAN (this pack implements exactly the four forks it names; no fork invented, none dropped).
- S0 patch §6 — SWEPT-CLEAN (forks surfaced there DECISION-NEEDED; this pack is the deciding record; §-refs resolve).
- `.ai-factory/plans/feature-zcode-plugin-firstclass-a92972.md` Task 2 — SWEPT-CLEAN (deliverable shape matches: «evidence + recommendation + wrong if», research-doc-only constraint honored).
- `docs/meta-factory/prior-art-evaluations.md` — SWEPT-CLEAN for this record (no new verdict row owed: no capability commit lands in Stage 0/1; Stage 2's commit carries the consult pointer in its body).
