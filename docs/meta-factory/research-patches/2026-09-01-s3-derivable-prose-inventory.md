<!-- scope:beta-ai-docs-agnosticism-s3-d1-inventory -->

# D1 population inventory — derivable prose in the repo's own docs (S3, spec C5)

> **Type:** research-patch (D1 deliverable of `.claude/orchestrator-prompts/beta-ai-docs-agnosticism/kickoff-s3.md` §2; enumeration BEFORE migration — T5/T10 held: zero migration edits were made while this file was being written).
> **Owner:** the S3 session that authored it, 2026-09-01 (branch `feature/beta-ai-docs-agnosticism-fc864f` @ `4ba2679ba5`).
> **Feeds:** S3 Task 3/4 migrations (rows verdicted `MIGRATE-now`), Task 5 (auditor), Task 6 (owner proposals), the PR body `## Parked questions` (rows marked PARK).
> **Evidence discipline:** T3 — every verdict carries file:line + the line's actual content or a quoted measurement. All measurements live as of 2026-09-01 @ `4ba2679ba5` (worktree, staging base).

## §0 Entry re-verification report (Task 1 — every check as command + one-line result)

| Check (2026-09-01 @ `4ba2679ba5`) | Result |
|---|---|
| `npm_config_cache=/tmp/npmcache-fc864f NODE_ENV=development npm install --include=dev` | exit 0 — devDeps present; `node_modules/.bin/vitest` exists → **no P-ENV park** (memory-forecast of missing devDeps did not fire today; auth state re-probed per memory discipline) |
| `npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts` | 37/37 passed |
| `sed -n '60,90p' .claude/rules/zcode-parity-doctrine.md` | §2 rollup + §3 table + D3-park wording intact (`:69`) — kickoff §1 row 1 premise HOLDS |
| `ls packages/core/composition/fence.ts scripts/render-rule-index.mjs` | both exist; `grep -c getff:begin AGENTS.md INSTALL-FOR-AI.md` → `3` / `2` (2 = prose mentions, 0 live fences in INSTALL-FOR-AI) — row 2 HOLDS |
| `ls agents/claims-conformance-auditor.md` | absent; `ls agents/*.md \| wc -l` → `19` — row 3 HOLDS |
| `PORTABLE_TOOLS` re-read (`21-agnosticism-conformance.test.ts:119-122`) | `Read, Glob, Grep, Bash, Write, Edit, WebFetch, WebSearch` — input to Task 5's `tools:` line |
| S1 merged diff (`git show 744bb06e35 --stat` + `git show 501af27ea5`) | S1 landed `merge_fenced` + AGENTS.md layer + AI-USAGE-GUIDE; **zero live fences in INSTALL-FOR-AI.md** → no `DONE-BY-S1` roster rows |
| `git branch -a --list '*beta-c-s3*'` | empty; `gh pr list` → `gh auth login` prompt (unauthenticated in-container) → probe verdict **PROBE-INCOMPLETE** (recorded verbatim, never a clean answer) |
| D5(i): `sed -n '272,282p' AI-USAGE-GUIDE.md` + `ls .claude/skills/pipeline/{references/presets,helpers}` | stale row present; presets + helpers shipped → MIGRATE-now confirmed |
| D5(ii): `agents/living-docs-auditor.md:110/:173` + `getff SKILL.md:128-130` | contradiction intact → PROPOSE-to-owner confirmed |
| D5(iii): `grep -rln 'aif-version'` (tree, worktrees excluded) | 6 files (4 predicted + kickoff-s3 + multistack kickoff + night-v3 design) → drift vs kickoff's «4» confirmed; **P-2 park stands** |
| `wc -l INSTALL-FOR-AI.md` / `grep -rl AI-USAGE-GUIDE tests/install-sh/baselines/ \| wc -l` | 594/600 · 11 baselines — §9 line-gate headroom and D5(i) hazard confirmed |

## §1 Method + population enumeration (T10)

Sweep surfaces (class-level, whole-repo for live docs; specs/retros/patches swept as a class, not row-by-row):

1. Status-table grep: `^\|.*(Status|state|State).*\|$` over `docs/meta-factory/` → 134 files scanned, status-table hits triaged.
2. Roster/count grep: count-claim patterns (`N agents|hooks|skills|rules`, `ls agents/`, `ls .claude`) over root docs + `agents/*.md` + kickoff corpus.
3. Byte/line-count claims: surfaced by the T7 counter-prompt sweep over `docs/superpowers/specs/` + `docs/audits/`.
4. Live getff-fence census: `grep getff:begin` → `AGENTS.md` (3 live fences), `INSTALL-FOR-AI.md` (0 — prose mentions only, lines 83/335).
5. Cold adversarial counter-prompt (T7) — §3 below.

**Population:** 19 rows across 5 classes (§4). **Verdict tally:** `MIGRATE-now` = 3 · `PROPOSE-to-owner` = 4 · `STAYS-PROSE` (owner+trigger recorded) = 8 · already-gated controls = 3 · PARK = 1. **Coverage honesty (T14/T6):** first run of this methodology; depth was bounded to live load-bearing surfaces (root docs, `.claude/rules/*`, `agents/`, top-level `docs/meta-factory/`) plus class-level sweeps of frozen corpora (specs/retros/patches). Frozen-corpus rows are verdicted as a class; individual frozen docs were NOT row-enumerated — residual population exists there and is declared, not hidden. Expect false-negative rate to drop on a second run; this run's claims are calibrated to «live surface, mechanically verified», not «exhaustive».

## §2 Row schema + classes (spec:376-379)

Every row: **source-of-truth · current-home file:line · ownership class · verdict · evidence.** Classes: (A) status tables ← git/PR facts; (B) rosters/counts ← filesystem or installer manifest; (C) coverage matrices ← probe output; (D) already-generated controls (machinery exists, gate live); (E) parks.

## §3 T7 adversarial counter-prompt — RUN and quoted

**Run 1 prompt (verbatim, dispatched cold to an Explore agent that did not see the authoring narrative):** «We are inventorying every place in THIS repo's own docs where the prose content is a mechanical function of a source of truth (git history, PR numbers, filesystem listings, counts, probe/script output, file sizes/hashes). We already have these rows: [A1-A4, B1-B4, C-none listed]. What derivable-prose class or specific surface did we MISS?»

**Run 1 result (verbatim, abridged to findings):** surfaced 7 missed surface groups — (1) per-profile payload matrix (`2026-07-25-beta-a-s1-inventory.md` §2 ~:145-244; `INSTALL-FOR-AI.md:134-137`; `setup.d/LAYERS.md` layer table); (2) agent/skill roster counts (`README.md:20` «8 shipped by default»; `INSTALL-FOR-AI.md:71,79-80,94,364`; `AUDIT-CHECKLIST.md:187-207`; `AUDIT-PROMPT.md:114`); (3) byte/line-count claims (6 spec/patch locations); (4) rule-count claims (`README.md:27,79,182`); (5) wiring counts (specs); (6) filesystem census tables (harmonization spec :22-24; bundle-for-opus :46-48); (7) already-generated inventory (AGENTS.md fences, 00-rule-index.md, install baselines, `.getff/rules-lock.*.json` sourceFingerprint, ESLint barrel). Run 1 was NON-EMPTY → per T7 no rephrase-run was forced; the findings are absorbed as rows B1/B4-B8, E2, D1-D3 below.

## §4 The population

### Class A — status tables ← git/PR facts

| # | Source-of-truth | Home (file:line) | Ownership | Verdict | Evidence (T3) |
|---|---|---|---|---|---|
| A1 | merged-PR set + per-wave research patches | `docs/meta-factory/wave-sequencing-plan.md` §0 (`:19-…`, snapshot «reconciled 2026-06-29») | planning sessions + maintainers (EXECUTION-PLAN family) | **STAYS-PROSE** — owner: maintainer-directed reconciliation session; trigger: `/meta-orchestrator` no-arg drift-detect loop (Direction B). Auto-write-back was **REJECTED** at R-phase: «Auto-editing §0 in place (Direction A) was REJECTED … (1) HIGH blast radius — a wrong-row write passes CI silently; (2) concurrent-session race» (`wave-sequencing-plan.md:10-12`, citing `2026-05-25-plan-memory-rphase.md:370`). Re-litigating a recorded verdict without new evidence = `#rigor-by-paraphrase` (effort-worthiness §3). | quoted rejection, above |
| A2 | zcode parity census (census.md) + merged Wave-B PRs | `.claude/rules/zcode-parity-doctrine.md` §2 Status col (`:35-66`), rollup (`:65` «Total = 21»), §3 Stage/Status/PR table (`:71-84`) | **`.claude/rules/*`** (maintainer-only) | **PROPOSE-to-owner** — generated-section conversion proposal, Task 6 P1 (the `00-rule-index.md` maintainer-landed precedent, `spec:172-176`). The parked renderer sync (`scripts/render-harness-config.mjs:256-268`, doctrine `:69` «deliberately parked») stays parked — noted, not absorbed. | doctrine `:69` verbatim in kickoff §1 row 1; re-verified live 2026-09-01 |
| A3 | shipped capability on staging (merged PRs) vs «not shipped» claims | `packages/core/templates/shared/AI-USAGE-GUIDE.md:274-282` honesty table | free (S1-landed, repo-side scope — kickoff §2 D5 boundary note) | **Presets row (`:278`) = MIGRATE-now** — its own trigger FIRED: presets shipped (`.claude/skills/pipeline/references/presets/{aif,economy,night,sdd}.json` + `helpers/{list,resolve}-preset.sh`, verified live). Other rows (park-routing, npm path, first-steps) = **STAYS-PROSE-by-design** — the table IS the owner+trigger mechanism («a capability that is not on disk gets an owner and a trigger here instead of a section pretending it exists», `:269-270`). Task 4. | `AI-USAGE-GUIDE.md:278` «not shipped … this guide gains a §Presets rendered from the shipped preset data»; presets dirs exist (ls output, Task 1 log) |
| A4 | `skills/getff/SKILL.md` gate definition (`:128`: `/aif-verify` not bundled, not a gate step) | `agents/living-docs-auditor.md:110` («`/aif-verify` blocked») + `:173` («Only FAIL blocks `/aif-verify`») | framework-maintainer-owned (CLAUDE.md Artifact Ownership Contract) | **PROPOSE-to-owner** — carry S1's replacement text from PR #1311 body `## Parked questions` into Task 6 P2; direct edit = contract violation. | both lines re-verified live 2026-09-01; `getff/SKILL.md` line read verbatim |
| A5 | phase closure events | `docs/meta-factory/roadmap.md` status lines | planning sessions | **STAYS-PROSE** — judgment-bearing (roadmap = intent, not fact); owner: planning sessions; trigger: phase-closure retros. | grep `Status` → 0 table-form status columns in the file; prose phases |

### Class B — rosters/counts ← filesystem or installer manifest

| # | Source-of-truth | Home (file:line) | Ownership | Verdict | Evidence (T3) |
|---|---|---|---|---|---|
| B1 | installer manifest: `setup.d/lib.sh:62` `GETFF_SKILLS_ENV="arch night-mode orchestrator pipeline reviewer"` + `setup.d/20-agents.sh` shipped-set + `skills/` core set | `INSTALL-FOR-AI.md:76-96` «This installs» roster (agents «10 files», skills «11 dirs at the default env depth») | free (kickoff §5 names INSTALL-FOR-AI rosters) | **MIGRATE-now** — generated section + drift gate; caveat prose (KEEP-AIF notes) preserved outside the fence (T17). Task 3. | manifest line quoted; claims re-checked against manifest 2026-09-01 — currently CONSISTENT (drift gate makes that mechanical) |
| B2 | same manifest as B1 | `INSTALL-FOR-AI.md:329-386` «What gets installed — file by file» tree (counts at `:364-374`: «10 files at every depth», «6 dirs at every depth») | free | **MIGRATE-now** — same renderer class as B1 (one renderer per source class, not per section). Task 3. | tree read verbatim; roster mirrors `setup.d/**` + `agents/` |
| B3 | shipped skill/agent sets | `INSTALL-FOR-AI.md:547-556` verification-checklist expectations (`:549` «Skills loaded \| `ls .claude/skills/` \| Lists `getff`, …»; `:550` sub-agents row) | free | **STAYS-PROSE** — owner: INSTALL-FOR-AI doc owners (via `/ai-doc`); trigger: any shipped-skill/agent set change. Fence migration inside a markdown table is structurally awkward (HTML-comment fences cannot span `\|` cells); when in doubt → STAYS-PROSE (§6), question parked in PR body as low-stakes. | rows quoted; in-table position verified |
| B4 | hook census: `ls .claude/hooks/*.sh \| wc -l` | `README.md:274` «deepest coverage (all 20 hooks)» | **maintainer-owned (README)** | **PROPOSE-to-owner** — **LIVE DRIFT CONFIRMED**: measured 2026-09-01 → `21`; doctrine rollup agrees (`.claude/rules/zcode-parity-doctrine.md:65` «Total = 21»). README count is stale. → folded into Task 6 P3 (README count-claims flagged patch). | `ls .claude/hooks/*.sh \| wc -l` → `21`; doctrine `:65` verbatim |
| B5 | shipped agent set (`setup.d/20-agents.sh` + `agents/`) | `README.md:20` «8 shipped by default: …» (names 8) | **maintainer-owned (README)** | **PROPOSE-to-owner** — conflicts with the installer's own current claim of **10** default agents (`INSTALL-FOR-AI.md:79` verbatim list incl. `fidelity-auditor`, `rule-test-author`). → Task 6 P3 (same README patch). | both lines quoted side-by-side; 10 vs 8 = arithmetic conflict between two live docs |
| B6 | shipped-set logic | `AUDIT-CHECKLIST.md:185-207` shipped-set section | free (root doc, not in ownership table) | **STAYS-PROSE** — already anti-drift by construction: «directory has since grown beyond the original three — check current contents rather than assuming a fixed count» (`:185-186`), `EXPECTED: no fixed count — grows over time` (`:203-204`). Owner: audit-checklist maintainers; trigger: shipped-set change. | quoted |
| B7 | shipped skills | `AUDIT-PROMPT.md:114` «three shipped agents»-era claims | free | **STAYS-PROSE** — same pattern as B6 (verification-instruction prose, not a frozen roster); owner: audit-prompt maintainers; trigger: shipped-set change. | counter-prompt finding; same construction |
| B8 | point-in-time measurements at authoring | spec/patch byte/line-count claims: `docs/superpowers/specs/2026-06-04-ai-doc-audit-design.md:9,121`; `2026-08-07-s-d-prime-subtraction-maps.md:197,337`; `agents/rule-researcher.md:268`; `docs/audits/2026-05-07-self-application-gap.md:71`; `2026-08-17-arch-prep-skill-stack-harmonization.md:22-24`; `2026-07-27-per-role-context-bundle-for-opus.md:46-48`; `2026-07-26-per-role-context-candidate-shapes.md:321` | specs = frozen/history-bearing; `agents/rule-researcher.md` = framework-maintainer-owned | **STAYS-PROSE** (class verdict) — value IS the point-in-time evidence (audits/specs are historical records; PROPOSAL.md-adjacent freeze discipline); owner: each artifact's owner; trigger: artifact revision. Exception noted: `rule-researcher.md:268` («358 lines») is a live-agent doc — low-stakes, recorded here rather than proposal-expanded; owner: framework maintainers; trigger: agent-doc revision. | locations + quotes from counter-prompt run; class-level sweep |

### Class C — coverage matrices ← probe output

| # | Source-of-truth | Home | Ownership | Verdict | Evidence |
|---|---|---|---|---|---|
| C1 | — (negative existence) | — | — | **No live doc section renders probe output as a matrix.** Nearest surfaces are probe-INSTRUCTIONS (`AUDIT-PROMPT.md:46-105` file-size/line checks) — instructions, not derived content → covered by B7-class verdict. | greps #1/#2 + counter-prompt run 1 (no matrix hit); honest-absence claim carries the §1 search evidence |

### Class D — already-generated controls (machinery exists; no migration)

| # | Surface | Evidence |
|---|---|---|
| D1 | `AGENTS.md` fences: rule-index (`:26-60`, plan=`scripts/render-rule-index.mjs`) + 2 docplan fixtures (`:78-94`, `:98-109`) | live fences read 2026-09-01 |
| D2 | `.claude/rules/00-rule-index.md` — rendered index, maintainer-landed precedent («generated, do not hand-edit», `:1-2`) | header quoted |
| D3 | `tests/install-sh/baselines/**.fingerprint` (11 fingerprint AI-USAGE-GUIDE) gated by `byte-identical.test.sh` + `snapshot.sh`; consumer `merge_fenced` (`setup.d/lib.sh:392-448`) + ESLint barrel «AUTO-GENERATED» | kickoff §2 D5 hazard table; counter-prompt run 1 |

### Class E — parks (§6: recorded, not resolved)

| # | Item | Options | Disposition |
|---|---|---|---|
| E1 | **`aif-version` permanently-empty schema field** — hook never reads it (`deps-hash-check.sh` grep count → 0, control `deps-hash` → 15); tracked occurrences TODAY = 6 files, not the kickoff's 4: `.claude/skills/tool-bootstrapping/references/decision-format.md`, `skills/tool-bootstrapping/references/decision-format.md` (twin), `skills/tool-bootstrapping/templates/tool-decisions.md.template`, `kickoff-s3.md`, `multistack-augment-first/kickoff.md`, `2026-08-09-autonomous-night-v3-design.md` (+ this plan file's notes) | **A:** keep (consumers commit a permanently-empty field) / **B:** remove (3 shipped + twin edits, hook untouched, installed files don't break) | **PARK P-2** — operator fork, not this session's to pick. Consequences recorded; no resolution attempted. |

## §5 Self-application (T15 — mandatory)

- **This inventory is itself a doc artefact.** It carries the folder-level authority of `docs/meta-factory/research-patches/` (append-only, owner = the session that discovered the gap) and the `<!-- scope:… -->` marker per doc-authority §5. Its file:line rows are point-in-time measurements — same STAYS-PROSE-as-frozen-record class as B8.
- **It lists itself:** this file is the only derivable-prose artefact this stage creates that contains row-shaped claims about other docs; its own rows are evidence-quoted, not generated — no self-fence (a fence whose source is a research narrative would be judgment-laundering, T-BAD-C adjacent).
- **The S3 plan file** (`.ai-factory/plans/feature-beta-ai-docs-agnosticism-fc864f.md`) is a session artefact, not repo doc — out of the shipped population; recorded here per T15.
- The new `agents/claims-conformance-auditor.md` (Task 5) will carry a principle-09 authority header; the presets section (Task 4) ships with its drift gate in the same commit — self-application checked against both.

## §6 T14 coverage statement (verbatim for the PR body)

Population = 19 rows (A:5, B:8, C:1, D:3, E:1 + self-application rows §5). Depth bounded to live load-bearing surfaces + class-level sweeps of frozen corpora. Tail NOT silently truncated: the frozen-corpus long tail (retros, closed-umbrella patches) is declared as residual population with a class verdict (B8/B8-pattern) rather than row enumeration. Coverage sufficient to conclude for: all live root docs, `.claude/rules/*`, `agents/*`, AI-USAGE-GUIDE, INSTALL-FOR-AI. Coverage insufficient to row-enumerate: frozen corpora (declared, not hidden).

## §7 Addendum (2026-09-01, at Task 3 implementation — B2 verdict revised MIGRATE-now → STAYS-PROSE)

Implementing the B1 renderer surfaced implementation facts B2's row did not carry:

1. **The B2 tree lives inside a ```text fenced code block** (`INSTALL-FOR-AI.md:330` opens the block; the tree body follows). A `getff:begin`/`getff:end` section is carried in HTML comments (`<!-- getff:begin section=… -->`); inside a ```text block those markers render **literally** — the fence cannot exist there without changing the doc's rendered appearance, i.e. migration is not shape-preserving.
2. **The tree is annotation-bearing, not purely derivable** — per-file comments carry judgment («factory-gated pair», layer caveats). Per the D7 falsifier («a doc class proves non-derivable → it stays prose with an owner and a review trigger»), annotation content is not a mechanical function of the manifest.

**Revised verdict: B2 = STAYS-PROSE** — owner: INSTALL-FOR-AI doc owners (via `/ai-doc`); trigger: any shipped-skill/agent set change, i.e. any edit to `setup.d/20-agents.sh`, `setup.d/10-skills.sh`, or `setup.d/lib.sh` skill constants. **Residual coverage note:** B1's new `install-roster` drift gate watches the same three manifests, so the highest-frequency drift vector for B2 (the shipped set changing) now has a live trip-wire one fence away even though B2's own body stays hand-maintained; the annotations remain the judgment residue (T17) the fence must not swallow. Verdict tally revised: `MIGRATE-now` = 2 · `STAYS-PROSE` = 9 (was 8).
