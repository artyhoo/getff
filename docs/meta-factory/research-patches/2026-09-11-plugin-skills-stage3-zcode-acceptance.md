<!-- scope:plugin-skills-generator -->

# Stage 3 ZCode acceptance — executor-side evidence record + host checklist (plan Task 6)

> **Type:** stage-deliverable evidence patch (executor portion of plan Task 6, kickoff Stage 3) — same format deviation as the Stage 0 patch: verdict matrix per the stage, not a ≤100-LOC gap-accumulator entry.
> **Owner:** Task 6 executor session, 2026-09-11 (branch `feature/plugin-skills-generator-466290`, HEAD `1b31f10f1e`).
> **Method:** destination-environment-verification — every container-reachable probe re-run FRESH this session with output quoted (T3, no cached claims); every host-bound item labelled INCONCLUSIVE-needs-host with its exact command; a probe SKIP is recorded as a SKIP, never as pass evidence.
> **Merge gate:** PR 3 (Stage 2 content, commit `1b31f10f1e`) merges ONLY after §2's host outputs land in its body. Nothing in this patch constitutes Stage 3 acceptance.

## §1 Container execution record (2026-09-11, this session)

### §1.1 ZCode runtime reachability — ABSENT (re-probed fresh)

- `printenv | grep -i zcode` → no output (zero zcode env vars).
- `ls ~/.zcode` → `ls: cannot access '/home/node/.zcode': No such file or directory`.
- `bash scripts/probe-zcode-runtime.sh` →
  `SKIP: /Applications/ZCode.app/Contents/Resources/glm/zcode.cjs not present — runtime probe is maintainer-machine only.` rc=0 — skip-by-design: `scripts/probe-zcode-runtime.sh:27-31` asserts nothing without the bundle.

⇒ All five Stage 3 oracles (kickoff §2 Stage 3) are **INCONCLUSIVE-needs-host**. §2 is the no-re-derivation runlist (operationalizes Stage 0 §4 F4; hypothesis dispositions carried forward, not re-argued).

### §1.2 Repo-side readiness — container-verified GREEN (the state the host run starts from)

| Check | Command | Output (verbatim) |
|---|---|---|
| Version chain at the 3 locked sites | `grep -n '"version"' plugin/.claude-plugin/plugin.json .claude-plugin/marketplace.json` | `plugin/.claude-plugin/plugin.json:4:  "version": "0.3.0",` · `.claude-plugin/marketplace.json:6:    "version": "0.3.0"` · `.claude-plugin/marketplace.json:13:      "version": "0.3.0",` |
| Installer version pin | `grep -n 'RAT_PLUGIN_VERSION' plugin/install/fetch-and-wire.sh` | `32:RAT_PLUGIN_VERSION="0.3.0"` |
| CORE four present in payload | `ls plugin/skills/` | 8 entries: `ai-doc getff installing-enforcement rule-research rule-tests template-audit tool-bootstrapping using-getff` |
| CORE-tier parity (installer vs plugin set) | `grep -n 'GETFF_SKILLS_CORE=' setup.d/lib.sh` | `61:GETFF_SKILLS_CORE="template-audit ai-doc rule-research rule-tests"` |
| Regen no-op on clean tree, re-proven post-Task-5 | `bash scripts/generate-plugin-skills.sh` | `generated 0 (written), 6 already in sync, 0 manual-skipped`, rc=0; `git status --short` afterwards → empty (plugin-native `installing-enforcement` / `using-getff` logged untouched) |

## §2 Host execution checklist (maintainer machine — each row INCONCLUSIVE until its output exists)

| # | Command / action | Expected observable | Disposition on mismatch |
|---|---|---|---|
| H1 | `find ~/.zcode/cli/plugins/cache/getff -maxdepth 2 -name plugin.json -exec grep -H '"version"' {} +` — after running whatever marketplace/plugin update flow the operator normally uses (the flow itself is part of what H1 confirms) | a plugin.json reporting `0.3.0` | **Confirm-or-falsify the refresh-key hypothesis** (Stage 0 §4 F4): `0.3.0` after update ⇒ CONFIRMED; an older version persisting ⇒ record the actual refresh mechanism here + in the PR 3 body BEFORE merge |
| H2 | Live ZCode session → inspect the skill list | `ai-doc`, `rule-research`, `rule-tests`, `template-audit` all listed (plugin `skills/` is a recognized ZCode skill channel — survey #1699 §5) | any entry missing ⇒ STOP, do not merge; triage against the §1.2 payload listing |
| H3 | Live ZCode session → invoke `/ai-doc` | Skill-tool resolution fires (mechanism: survey #1699 §11.1, live-corroborated) | resolution failure ⇒ capture the transcript; surface as DECISION-NEEDED, never fix silently |
| H4 | `bash scripts/probe-zcode-runtime.sh` | `probe-zcode-runtime: all assertions green.` (17/17) | any `DRIFT` line ⇒ the binary moved under the parity SSOT; probe + doctrine update in lockstep precedes this merge (the script's own drift message names the procedure) |
| H5 | Paste H1–H4 outputs (commands + verbatim observables) into the PR 3 body | PR body carries Fidelity + §1.7 + the Stage 3 evidence per the plan's Commit Plan | PR 3 stays unmerged until H5 exists |

## §3 §1.7 self-review

### Forward-check applied

- **doc-authority-hierarchy:** research-patches folder format (folder-scoped authority; `<!-- scope: -->` marker present); stage-deliverable deviation declared in the header, mirroring the Stage 0 patch's format note; no goal-bearing artefact touched.
- **destination-environment-verification:** this patch IS that discipline applied — SKIP recorded as SKIP (§1.1), host rows carry exact commands + falsification paths (§2), zero acceptance claimed from container evidence.
- **language-discipline:** internal artefact → English throughout (§1 category 1).
- **effort-worthiness L1:** the container-reachable subset was executed live (five §1.2 probes, outputs quoted); no extra rounds invented; the host arm is irreducible — only the operator machine can run it (test 4: material and not cheaper to fake).

### Backward-check applied

Class of this change = «acceptance-evidence / host-handoff records for the plugin skills channel».

Surfaces where this class occurs or could contradict, enumerated:

1. Stage 0 patch §4 F4 — the same host command list at planning time; this patch operationalizes it (H1–H4 = F4's list + dispositions). No new or contradicting claim — SWEPT-CLEAN (`2026-09-11-plugin-skills-generator-stage0-reverif.md:55`).
2. `2026-09-10-zcode-live-smoke.md` — its skills surface is `.zcode/skills` workspace resolution (`:104-110`), NOT the plugin skills channel; no collision with any claim here — SWEPT-CLEAN (grep for `skills` in that patch → workspace rows only).
3. `2026-09-10-zcode-compaction-hook-verification.md` — hooks-surface verification record; mentions skills only re the zcode-guide bundle (`:65`) — SWEPT-CLEAN.
4. Kickoff §2 Stage 3 + §4 acceptance checklist — the requirements source; H1–H5 map 1:1 (cache@0.3.0, skill listing, slash-invocation, probe 17/17, evidence-in-body) — SWEPT-CLEAN (`.claude/orchestrator-prompts/plugin-skills-generator/kickoff.md`).
5. Plan Task 6 line (`.ai-factory/plans/feature-plugin-skills-generator-466290.md:89`) — annotated in this same change; checkbox deliberately stays unchecked (host arm open) — SWEPT-CLEAN by the companion commit.
6. `scripts/probe-zcode-runtime.sh` — SKIP semantics quoted from `:27-31`, DRIFT procedure from `:50`; behaviour verified live this session (§1.1) — SWEPT-CLEAN.

Cold-sweep note (T21): the umbrella's Stage 0 cold backward-sweep already enumerated 35 surfaces for the plugin-skills change class; this patch adds no mechanism, and its sibling set above is a subset of that sweep's territory, re-verdicted here with live evidence. No second cold agent dispatched (effort-worthiness L1 — nothing left for it to catch that the per-surface verdicts above don't).

## Tags

`#destination-environment-verification` — the patch exists to keep a host-bound stage from shipping on container-side SKIPs; the rule's six-incident family is the standing hazard this record guards.
