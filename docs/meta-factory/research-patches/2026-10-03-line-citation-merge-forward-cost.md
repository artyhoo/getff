<!-- scope:line-citation-merge-forward-cost -->
# The merge-forward citation re-point cost — measured, with the mechanical fix that already exists

> Scope: the recurring manual cost of keeping gated `path:NN` citations pointed at moved lines, and the design space for removing it. Measured at `c6038b77fb` (= origin/staging, 2026-10-03). READ-ONLY investigation: this patch proposes; nothing is landed (`.claude/rules/*` and `.husky/**` are maintainer-owned per the CLAUDE.md Artifact Ownership Contract).

## Problem

Every merge-forward on a busy day must re-point stale `path:NN` citations by hand: parallel branches shift line numbers in the same hot files, so each side's citations are valid in its own tree and invalid in the merge. The 2026-10-03 merge train made it visible again: PR #2005 needed 6 citations re-pointed, PR #1985 carried ~13 files with citation-only conflicts (`audit-self.yml:1284,:1653` vs `:1262,:1619`; `end-of-turn-reminder.sh:629-688` vs `:665-724`; `.husky/pre-commit:237` vs `:236`). The checker (`scripts/check-line-citations.mjs`, SSOT #274) has a `--write` mode that renumbers mechanically — yet the merge-forward recipe ([.claude/rules/git-conflict-merge-forward.md §2](../../.claude/rules/git-conflict-merge-forward.md)) has no citation step at all, so the re-pointing stays a judgment-shaped manual act even when it is mechanical.

## §population-enumeration — what can drift (T10 before sampling)

Corpus definition: `LIVE_AUTHORITY_MD` ([check-line-citations.mjs:425-433](../../scripts/check-line-citations.mjs)) + every tracked code file minus generated/excluded trees ([check-line-citations.mjs:459-463](../../scripts/check-line-citations.mjs)). Measured at `c6038b77fb`:

- The gate's own summary, `node scripts/check-line-citations.mjs --check --corpus` (full log `/tmp/cite-corpus-sweep.log`, exit 0):

  > `check-line-citations: resolved 1055 / skipped 298 citation(s). (56 deferred to generator regions) (33 not drift-checked — no blame baseline: 33 target-absent-at-baseline)`

- An independent census copying `CITATION_RE` ([check-line-citations.mjs:184-185](../../scripts/check-line-citations.mjs)) over the corpus: **1270 `path:NN` matches (md 281, code 989) in 1263 corpus files**. The two totals differ by construction: the checker additionally judges bare backrefs (`` `:NN` ``), code-comment backrefs, the explicit prose form, and comma-list members as separate instances.
- Top cited targets (census; churn = first-parent commits touching the file 2026-07-05 → 2026-10-03):

  | target | citations | share | commits/90d | exposure (cites × churn) |
  |---|---|---|---|---|
  | `install.sh` | 94 | 7.4% | 77 | 7238 |
  | `setup.d/lib.sh` | 65 | 5.1% | 94 | 6110 |
  | `setup.d/10-skills.sh` | 39 | 3.1% | 45 | 1755 |
  | `.claude/settings.json` | 26 | 2.0% | 14 | 364 |
  | `setup.d/45-python.sh` | 15 | 1.2% | 60 | 900 |
  | `.claude/hooks/*` (group) | 77 | 6.1% | — | — |
  | `packages/core/hooks/pre-push.ts` | 10 | 0.8% | 73 | 730 |
  | `.github/workflows/audit-self.yml` | 7 | 0.6% | **141** | 987 |
  | `.husky/pre-commit` | 7 | 0.6% | 19 | 133 |

- **Corrective finding against the framing premise:** the operator-named hot trio (audit-self.yml + `.husky/*` + `packages/core/hooks/**`) holds 65 of 1270 citations (5.1%). The mass sits in the **install area** — `install.sh` (94), `setup.d/*` (177, 13.9%) — and `.claude/hooks/*` (77, 6.1%). `audit-self.yml` is the churn champion (141 commits/90d) but carries only 7 citations; `setup.d/lib.sh` out-churns `.husky/pre-commit` 5:1 and out-citeds it 9:1. Any fix scoped to the named trio would miss ~95% of the population.

## §mechanical-cost — what drift actually charges (last ~15 merged PRs)

**Method.** Squash-merge hides re-points: a merge-forward re-point sets the citation to the value staging already has, so the squash diff vs staging shows nothing. The cost is visible only in the merge commits themselves — diff `first-parent..merge` on the (post-hoc fetched) PR branch and pair `path:NN` tokens per file by order. In such a diff every citation-number change is re-point work the merge had to do. Coverage: every merged PR of 2026-10-02/03 (15 PRs), every "Merge … origin/staging" commit in each (26). Calibration: NONE — first run of this method; a wholesale-rewrite merge can fold unrelated number changes into the count (the two #2011 outliers below carry that caveat).

| PR | staging-merges | re-points (corpus) |
|---|---|---|
| #2011 (design record) | 2 | **390** (129 + 261; wholesale doc re-sync caveat) |
| #2005 (seat inputs) | 4 | **32** (1 + 20 + 11 + 0) |
| #2008 (protected paths) | 7 | 28 |
| #2012 | 1 | 20 |
| #1985 (one-button union) | 2 | 20 (9 + 11) |
| #2015 | 3 | 13 |
| #2006 | 3 | 10 |
| #2004 | 1 | 7 |
| #2014, #2017 | 1 + 1 | 1 + 1 |
| #2009 | 1 | 0 |
| #2016, #2013, #2007, #2003 | 0 | 0 (no merge-forward at all) |
| **total** | **26** | **~522** |

Typical merge-forward = 3-10 re-points (median over the 26 merges: 3; mean excluding the two #2011 outliers: 132/24 ≈ 5.5); the tail reaches hundreds.

- **#2005 detail, md corpus:** 7 instances across 6 files — `reviewer-discipline.md` (`arch/SKILL.md:118→:138`), `dispatcher/SKILL.md` (`recommendation-laziness-discipline.md:5→:6`), `arch/SKILL.md` (`tier-home.md:81→:90`), `ci-tool-pinning.md` (`audit-self.yml:2168→:2172`, ×2), and two `docs/site/reference/D/*.md` pages (`end-of-turn-reminder.sh:423→:435`, `warn-subagent-report.sh:74→:98`). The operator counted 6; the remaining 25 re-points of #2005 are in code comments and generated `reference/*.json`.
- **#1985's operator-reported conflict examples appear verbatim in the merges:** `audit-self.yml:1258→:1262`, `:1280→:1284` (merge `3ffeec5f80`), `end-of-turn-reminder.sh:628→:665`, `:709→:746`, `.husky/pre-commit:219→:236` (merge `8b3b88c996`).
- **Hand re-pointing is a standing commit class**, not a one-off: `82694b54432` «docs(citations): re-point audit-self.yml line citations after the merge-forward insert»; `2a51520e037` «chore(manifest): regenerate MANIFEST.sha256 after the citation re-point» (a re-point cascades into a payload regen); `b0cad7aef5c` «re-point the §3.1 SSOT citation (#300 -> #305)»; `451fa6295aa` «its id changed occupant in the 2026-10-03 renumbering» — even SSOT row IDs renumbered on the measured day.
- **Where it fires:** the push of the merge commit is the moment — pre-push §9 runs the checker scoped to the push's paths (`packages/core/hooks/pre-push.ts:1946-1949` passes `--affected-by=<changed>`), goes RED on drifted citations, and the session re-points before the push can land. `citation-fullsweep` ([audit-self.yml:2567](../../.github/workflows/audit-self.yml)) is the unscoped backstop. A missed re-point therefore costs a whole red CI round (~1h queue, per [git-conflict-merge-forward.md §10](../../.claude/rules/git-conflict-merge-forward.md) measurements), not just the edit.
- **The conflict shape is structural:** ARM 1 compares a citation against its own tree, so BOTH sides stay green until the merge — then either the numbers conflict textually (same prose line, two numbers) or one side's numbers are stale-silent. [git-conflict-merge-forward.md §4](../../.claude/rules/git-conflict-merge-forward.md) currently routes any non-generated conflict to «STOP, park, operator» (:60-62) — citation-only conflicts pay full human escalation even when the resolution is «take either side, renumber».

## §design-space — options, each with a build-vs-reuse verdict

SSOT consult: #19 (lychee, link existence), #274 (the checker itself, BUILD; D34 ratified `path:line` as the emitted shape), #277 (reverse-index `--affected-by` scoping), #276 (markdownlint per-document contract). Fresh search 2026-10-03 (T12): context7 — (1) `/lycheeverse/lychee` «line number fragment validation for local file links»: `include_fragments` supports anchor/text fragments only, no line numbers; (2) `/davidanson/markdownlint` «custom rule accessing other repository files»: rule params are per-document (`file`, `lines`, `tokens`), no repo context; (3) `resolve-library-id` «generate a markdown reference table from source files and verify up to date»: generic markdown transforms only (remark and friends), no citation-sync tool. WebSearch (2 phrasings): only SHA-pinned GitHub permalinks (immutable — wrong for live authority, which must point at CURRENT lines) and custom-anchor advice; nothing packaged.

### (a) Symbolic anchors instead of line numbers — **REJECT for now**

- Already adjudicated: SSOT #274 records that a FORMAT change (heading anchors) was «considered and rejected: umbrella row D34 has ratified `path:line` as the shape framework generators emit, with permalinks resolved at the landing build». Re-opening needs D34 superseded first.
- Blast radius: every grammar gate would change together — `FILE_LINE_RE = /[^\s]+\.[a-z]+:[0-9]+/` ([s17.ts:42](../../packages/core/hooks/checks/s17.ts), consumed by pr-body-fidelity per its :63 comment), the checker's `CITATION_RE` (:184-185), discipline-self-check's `file.ext:line` requirement — and `MANIFEST.sha256:1` already does NOT match the grammar, so any anchor scheme that is not literally `path.ext:NN` breaks §1.7 evidence by construction.
- Anchor substrate exists only where the premise assumed it: audit-self.yml has 37 unique job ids (step `name:` lines are NOT unique — `Install workspace deps (hoists tsx to root)` ×6), `.husky/pre-commit` has 15 unique `# ── title ──` headers — but the citation mass (`install.sh` 94, `setup.d/lib.sh` 65) has no anchor system at all. Anchors would cover the 5% and not the 95%.

### (b) Generated citation tables (regen step rewrites one citations file) — **KEEP NARROW, defer**

- The in-repo precedent is real: the generator-region frame `<!-- getff:begin … plan=<generator> -->` ([check-line-citations.mjs:151-159](../../scripts/check-line-citations.mjs)) already lets ARM 1 defer to a generator's byte-identity gate, and `render-reference.mjs` / `render-face-facts.mjs` are the working models. Append-only registers hold line numbers stable by construction — that is why the SSOT itself is increments-only ([prior-art-evaluations.md §3](../prior-art-evaluations.md)).
- But the migration is the whole corpus: prose must re-route up to 1270 citations through a table for a benefit option (c) delivers mechanically at ~15 LOC. And the register itself is not churn-free: SSOT rows renumbered on the measured day (`451fa6295aa`).
- Trigger to revisit: measured `--write` coverage of merge-forward re-points < 80% over a 10-PR window (i.e. automation stops covering most of the measured cost).

### (c) Make re-pointing a standard merge-forward step — **REUSE the shipped checker + ~15 LOC BUILD. RECOMMENDED.**

- The capability exists: `--write` renumbers unambiguous drifts positionally ([check-line-citations.mjs:965-1007](../../scripts/check-line-citations.mjs)), and the checker's own RED output prints the fix command (:1196-1198: `Fix: npx tsx scripts/check-line-citations.mjs --write <files>`). Only the wiring is missing — [git-conflict-merge-forward.md §2](../../.claude/rules/git-conflict-merge-forward.md) steps 4-8 regenerate baselines and twins but never the corpus numbers, and `scripts/merge-forward-round.sh`'s GENERATED SET (:17-29) lists six generators, none of them the checker.
- Proposed wiring (two slices, by ownership):
  1. **Script arm (agent-ownable):** after §2's regeneration + verification, run `node scripts/check-line-citations.mjs --check --corpus --affected-by=<paths the merge changed>`; on drifted findings, run `--write` on the named files and include them in the merge commit. Ambiguous-move and content-gone findings keep the script's existing exit-1 → those genuinely need judgment and join the exit-4 semantic list.
  2. **Rule amendment (maintainer-owned — proposed text, not landed):** a §2 step («re-point the corpus: --check --corpus --affected-by + --write») and a §4 third class between generated and semantic — «citation-only conflicts: both sides' numbers valid in their own trees; take either side and regenerate numbers via the checker» — so the #1985 class stops paying full operator escalation.
- Effect on the measured population: #2005's 32 (incl. all 7 md instances) and #2012's 1 are unique-move re-points — exactly the shape `--write` exists for. Residual manual = ambiguous moves, dead content, and textually conflicting lines.
- Cost: one corpus `--check` per merge-forward (parse + ARM 2 ≈ 0.12s; ARM 1 blames only on affected paths, 72% of pushes run zero per SSOT #277); no grammar change anywhere — `path.ext:NN` stays the single emitted shape, so s17.ts:42 / pr-body-fidelity / discipline-self-check are untouched.

### (d) Upstream tool for line-stable references in prose — **REJECT** (re-confirmed 2026-10-03)

SSOT #274's 2026-09-13 negative existence (context7 + 3 WebSearch phrasings) stands; the fresh sweep above (3 context7 phrasings + 2 WebSearch phrasings) surfaced no new packaged candidate. Nearest external practice (SHA-pinned `blob/<sha>/file#L42` permalinks) solves reader rot for EXTERNAL readers, not live-authority checking — the landing build already stamps permalinks from `path:line` (D34).

## Recommendation

Adopt (c): wire the existing `--check`/`--write` pair into `merge-forward-round.sh` as a standard arm, and propose the maintainer-owned §2 step + §4 citation-conflict class in [git-conflict-merge-forward.md](../../.claude/rules/git-conflict-merge-forward.md). ~15 LOC + one gate call per merge-forward; removes the measured 3-10-typical/500-per-16-PR manual residue and the red-CI-round amplifier; zero format change (D34 respected).

**What would falsify it:**

1. If `--check` at merge time mostly returns ambiguous/no-move findings (not unique moves), `--write` covers little — measure on the next 10-PR window (count `--write`-applied vs residual findings); coverage < 80% re-opens (b).
2. If the dominant cost proves to be textual conflicts (the #1985 class) rather than silent drift, the §4 third class + scripted either-side+regenerate matters more than the `--write` arm — they are independent slices; keep both.
3. If pre-push §9 / `citation-fullsweep` stop firing on merge commits (gate re-scoped), the cost moves post-merge and the wiring point changes.

**Tags**

`#measured-not-guessed` `#citation-drift` `#merge-forward` `#reuse-over-build` `#process-automation` `#corrective-premise-share`

## §1.7 self-review

- **Forward-check:** [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — the proposal reuses a deterministic checker; zero LLM calls. [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — every option carries a verdict grounded in SSOT rows (#19, #274, #276, #277) + dated fresh context7/WebSearch; recommendation is REUSE of a shipped capability plus a ~15-LOC arm, under the cheap-side of the cost gate. [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) — this file is a research-patch (folder-level authority per §5; no per-file header required); `.claude/rules/` and `.husky/**` are read-only for this session, so the rule-side changes are PROPOSED text, not edits. 600-line markdown gate: this file is ~150 lines.
- **Backward-check** — class of this change = «automation for a manual step in the merge-forward pipeline». Surfaces where the class occurs: (1) [git-conflict-merge-forward.md §2/§4](../../../.claude/rules/git-conflict-merge-forward.md) — the recipe (maintainer-owned; proposal above); (2) `scripts/merge-forward-round.sh` :17-29 GENERATED SET — the script twin of the recipe, the natural arm site (agent-ownable); (3) [.claude/skills/harvest/SKILL.md §4](../../../.claude/skills/harvest/SKILL.md) — points at the merge-forward rule, inherits any §2 extension with no edit (SWEPT-CLEAN: pointer, not a copy); (4) [CLAUDE.md](../../../CLAUDE.md) `Harness gates` merge-forward bullet — pointer, unchanged (SWEPT-CLEAN); (5) `.claude/skills/dispatcher/helpers/probe-inflight.sh` — collision probing, not conflict resolution: out of class (SWEPT-CLEAN). GAP-FOUND: none outside the two maintainer-owned surfaces named in the proposal. The recipe lives in exactly two places (rule §2 + the script header's «ONE ROUND (§2)»), both enumerated — no third copy exists (`grep -l "merge-forward" scripts/*.sh` → `merge-forward-round.sh` only).
- **Self-application:** this patch's own `path:NN` citations are snapshots in `research-patches/`, deliberately OUTSIDE the gated corpus ([check-line-citations.mjs:376-383](../../scripts/check-line-citations.mjs) — closed historical artifact), so they are exempt from the gate this patch discusses; that exemption is the corpus definition working as designed, not a coverage gap. The measurement scripts live in `/tmp` (not committed): reproducing the census requires re-copying `CITATION_RE` per the header note — acceptable for a one-shot measurement, and the merge-commit method is fully specified above.
