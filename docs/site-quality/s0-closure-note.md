# S0 closure note — getff-ai-site S0b (gold set)

> **Authoritative for:** the measured record of stage S0b: review rounds and REVISE counts,
> the host-verify output, Phase-0 and in-flight findings with their dispositions, and the
> conventions this stage chose.
> **NOT authoritative for:** project goal — see [README.md](../../README.md#why-this-exists).
> The quality contract — see [calibration.md](calibration.md) and the docs-author skill.

Stage contract: `.claude/orchestrator-prompts/getff-ai-site/kickoff-s0b.md`. Written
2026-09-21. S0q merged 2026-09-18 (#1807), so the S0q to S0b interval is three days.

## 1. What shipped

34 pages under `docs/site/`: 5 trial pages, 11 face pages, 17 further skill sheets
(family B has 18 sheets plus its overview; one sheet and the overview are trial pages),
and the glossary. Also `nav.json`, `llms-head.txt`, `hero-copy.json`, five frozen gold
copies under `.claude/skills/docs-author/references/gold/`, and 37 vocabulary entries in
the Vale accept list.

## 2. The three numbers (kickoff §6)

The session compacted five times (2026-09-20 20:49, 21:19, 21:38, 21:56 UTC, and once
more on 2026-09-21). **Every page was written after the first compaction.**

1. Pages written before the first compaction: **0**. REVISE among them: 0. The rate is
   **undefined** (zero denominator). It is not zero and must not be read as zero.
2. Pages written after it: **34**. Pages that went through an Opus review: **22** (the 5
   trial pages and the 17 further sheets). Pages among those 22 that took at least one
   REVISE: **22**. The other 12 (11 face pages, glossary) had no Opus round in this
   stage, except `quickstart-go.md`, which joined D22 round 3 after it was re-executed.
3. Post-compaction page-level REVISE rate: **22 of 22 = 100%**. Ratio to the
   pre-compaction rate: **undefined**.

Because the page-level rate saturates, S1's falsifier ("RUN REVISE rate exceeds the gold
pass's by more than 2x") cannot fire against it. Use the **per-round** figures instead:

| Review | Pages | Round 1 | Round 2 | Round 3 |
|---|---|---|---|---|
| Trial gate | 5 | REVISE, 4 of 5 pages | REVISE, 1 of 5 (`reference/B.md`) | GO |
| D22 family B | 19 | REVISE, 19 of 19 (1 BLOCKER, 3 MAJOR; two findings were systemic) | REVISE, 1 of 19 (`reference/B.md`, 2 MAJOR, both regressions from round-1 fixes) | GO (MINOR only) |

Rounds to GO per page, trial gate: `B/getff.md` 0 REVISE, guide 1, tutorial 1,
understand 1, `B.md` 2. Recommended S1 denominator: **mean REVISE rounds per page**. The
gold pass measured 5 over 5 trial pages (1.0) and 20 over 19 family pages (1.05).

Split by author: the 17 further sheets were written by three fresh-context sub-agents of
the same model. Everything else was written in the main session after compaction. Both
groups were flagged 100% in D22 round 1, so this stage shows no difference between a
compacted main context and a fresh one. For the D41 fallback cut, that supports one
session across families with fresh sub-agent writers. It is one data point.

## 3. Falsifier D39(c): fired

The trial pages failed the Opus gold review twice before GO. Per the contract this means
the writing skill and the quality contract need work, **not** the seat. S0b did not move
to aif. Work items, each seen in at least one REVISE finding:

- A per-block elision formula. "Output shortened" was stated per page and the reviewer
  could not tell which block was cut.
- A criterion for "a generated region contradicts the prose next to it". The card for
  `aif-doctor` says `slash-only`; the skill file says it auto-fires.
- A named prerequisite must be linked or explained at first mention.
- An expiry marker for temporary disclosures, so a "known defect" note cannot outlive
  its fix. `reference/B.md` carries a `TEMPORARY(2026-09-21)` comment as a stopgap.
- Which heading a block sits under is judge-only. The skeleton gate
  (`scripts/docs-check.mjs:245`, `checkSkeleton`) checks that the required headings are
  present and in order. A snippet block that drifts under an extra heading passes it
  (D22 round 2).
- A legend for card fields must cover absence tokens, not only the common value.

## 4. Host-verify (kickoff §7.1), run by path on the host, 2026-09-21

The run prints a `▶` line, the command's own output, and a verdict line per check. This
block is that output filtered to the header, the verdict lines and the result line:

```text
── host-verify: .claude/orchestrator-prompts/getff-ai-site/kickoff-s0b.md
✅ [1] PASS — test -f scripts/docs-check.mjs
✅ [2] PASS — test -f scripts/render-terms-style.mjs
✅ [3] PASS — test -f docs/site/terms.md
✅ [4] PASS — test -d docs/site-quality
✅ [5] PASS — test -f .claude/skills/docs-author/SKILL.md
✅ [6] PASS — test -f agents/docs-form-auditor.md
✅ [7] PASS — test -e packages/core/hooks/checks/docs-card.ts
✅ [8] PASS — test -f agents/claims-conformance-auditor.md
✅ [9] PASS — test -n "$(find "$HOME/.claude/plugins/cache" -type d -name diataxis -print -quit)"
✅ [10] PASS — test -n "$(find "$HOME/.claude/plugins/cache" -type f -name SKILL.md -path '*superpowers*/verification-before-completion/*' -print -quit)"
✅ [11] PASS — test -f scripts/render-reference.mjs
✅ [12] PASS — npx vitest run packages/core/eslint-rules/no-unsafe-zod-parse.test.ts
✅ [13] PASS — FENCES_FIRE_STRICT=1 bash packages/core/audit-self/check-fences-fire.sh
── host-verify result: 13/13 passed on Darwin
```

Check 13 passed **without proving anything**. Its full output, contiguous and as printed:

```text
▶ [13] FENCES_FIRE_STRICT=1 bash packages/core/audit-self/check-fences-fire.sh
  · check-fences-fire SKIP — eslint-rules-local/index.mjs not found (run install.sh first to generate the barrel)

PASS=0 FAIL=0 SKIP=1
  fixture arm  (fence FIRING proof):   manifests=0 proved=0 failed=0 skipped=0
  load-probe arm (config IMPORTABLE):  ok=0 failed=0 skipped=0
✅ [13] PASS — FENCES_FIRE_STRICT=1 bash packages/core/audit-self/check-fences-fire.sh
```

The source repo has no generated barrel, so the check skips. For that case the wrapper
requires a quote from `bash tests/install-sh/check-fences-fire-full-barrel.test.sh`,
which does fire the fences: `PASS=4 FAIL=0 SKIP=0`.

Other gates at close: `docs-check.mjs` with Vale 3.21.0 (the CI pin): PASS, 0 errors on 34
pages. `render-reference.mjs --check`: up to date. The 18 cards are byte-identical to the
generator's output. `check-ask-files.sh`: 8 ask files valid. The kickoff's own citations:
10 resolved, 0 drifted, 4 skipped because they use the abbreviation `site-design.md`.

## 5. Conventions this stage chose

- **Face fences.** Generated regions on face pages use
  `<!-- getff:begin section=face-<name> plan=scripts/render-face-facts.mjs -->`, with
  values copied from `docs/site/face-facts.json`. The renderer exists and its `--check`
  proves that JSON file. It does not yet check the fence regions on the pages, so those
  are hand-copied and ungated until S1.
- **Card legend** lives once, on `reference/B.md`, and every sheet links it.
- **Gold copies are link-normalised.** A frozen copy sits at another depth, so its
  relative links are rewritten. The copies ship with the skill, so the pre-commit format
  gate also made them Prettier-clean (table padding, list markers). Compare copies to
  live pages modulo links and that formatting.
- **Three agent prompts on `ai-agents.md` ran against local files**, not a published site.
- **Go page.** Go 1.22.0, golangci-lint 1.55.2 and Vale 3.21.0 were installed in WSL on
  the operator's PC with permission, at the CI pins, sha256-verified. Both steps of
  `quickstart-go.md` were then executed. The tool-absent output on that page is from the
  earlier run on the Mac.

## 6. Findings and dispositions

Disposition **SURFACED** means out of scope per kickoff §8 and left unedited.

### Generator batch (`scripts/render-reference.mjs`, S0a) — SURFACED, one follow-up task

1. An absence token renders as raw JSON. A gold fixture for arm A is held out of the repo.
2. Arm A doubles the path.
3. A multi-line `description: |` renders as a bare `|`, and the row gains a cell.
4. Line 328 reads `slash-only` when the `disable-model-invocation` key is present,
   whatever its value. `aif-doctor` sets `false`.
5. `factory` skills read "not installed on any lane", because ships-to is measured from a
   default install.
6. The `Tier` header and the `framework` value use older names than the glossary.
7. The table does not link skill names to their sheets.
8. `--write` does not derive `sources:`.

`reference/B.md` discloses items 3 to 6 to the reader until the fix lands.

### Installer and shipped skills — SURFACED

- `mattpocock-skills` is invoked by `arch` (`SKILL.md:50`) and is absent from
  `setup.d/companions.manifest`. Follow-up task opened by the operator's request.
- `harvest/SKILL.md:54` tells the agent to `git rebase`, against the merge-forward rule.
- `aif-doctor` promises operator consent (line 41); its Tier 1 (line 210 on) changes
  things without it. Its probes cite `packages/runtime-bridge/`, absent at consumers.
- `pipeline/SKILL.md:159` links `../dispatcher/SKILL.md`, which dangles at `env`.
- `setup.d/10-skills.sh:82-84` holds a stale comment; line 324 claims `.claude/rules/*`
  is installed, and neither fixture has that folder.
- `template-audit` step 1 cannot run at a consumer.
- `./setup --full` is named by the rule-research skill, an agent and
  `80-rule-bootstrap.sh:53`, but `setup` is not installed into the project.
- `decision-format.md:16` describes one `deps-hash` field; the template has three.
- `install.sh:21,111` list the core set without `rule-tests`.
- `setup.d/45-python.sh:1199-1203,1219` carry stale line citations.
- The installer never mentions `docs-author`. The story helper has a stale comment. The
  glm skill mixes two model versions. Three shipped references are in Russian.
- `night-mode/SKILL.md:35` grants push and squash-merge by invocation.
- With `-y`, `setup` installs companions without asking, user-scope and global. Running
  the Go quick start on the PC installed superpowers, ast-grep and `@ast-grep/cli` there.
- "deepwiki install failed" prints when deepwiki is already present.
- The Go maturity caveat leaks "(operator, 2026-09-09)" to readers.
- The first-steps SSOT says plain `cargo clippy` goes RED. `RULES.md` lists 3 R2 paths;
  the eslint config has 5.
- `check-rule-enforced` can report a false GREEN. The operator started a separate task.

### Contract and process — SURFACED

- `executed:` records have no field for the install depth. No gate reads `executed:` at
  all: a page can claim a step ran and show no output for it (form audit, card gap 2).
- Two texts outside this stage's reach still describe the gold set as not landed. The
  docs-author `SKILL.md` lists `references/gold/` as "empty until then". Principle 46
  (`packages/core/principles/46-reference-generator-arms.test.ts:217`) reports "arm A
  dormant — fixtures/reference-gold/ empty until S0b"; the fixture is held out of the
  repo (see the generator batch above), so the arm stays dormant after S0b.
- Four face pages each invented the same gloss for internal wording in pasted output.
  The convention has no home in the docs-author skill's `references/craft.md`, so a
  fifth page missed it (form audit, pattern 1).
- The `ts-demo` fixture holds 15 `_handoff-*.md` files under
  `.claude/orchestrator-prompts/`. A consumer project should hold none.
- 3 of 9 lineage sources are uncited; the content brief is absent; no re-review GO is
  recorded after #1785.
- `nav.json` has no consumer yet, so its shape for sheets is this stage's guess.
- **The calibration record was initialised in this stage; three parts of it stay open.**
  The quality spec (D-Q14) gives the act to the stage that lands the gold copies, so the
  band (FRE 84.1 to 91.3, FK at most 4.7), the sentence threshold (35 words) and the
  per-page numbers are now in `calibration.md`, under "Gold record". A first reading of
  kickoff §8 took the record for the quality contract; the contract is the spec file, and
  the record is this stage's output. Still open, and not done here:
  - **The ERROR promotion of `Microsoft.SentenceLength` is not switched on.** At 35 words
    the 34 gold-set pages hold 5 sentences over the threshold (15 over 30, 2 over 40, the
    longest is 45). The flip would turn those pages red. It belongs to the owner of the
    Vale profile.
  - **The face pages' second dated entry** is not written. It follows their own gold
    review and may only widen the band.
  - **The per-kind notes on what good looks like** are not written. The five frozen copies
    are the baseline until they are.

### Phase 0 (kickoff §3) — FIXED in session or none

Host-verify ran 13/13 before the first page. All four declared names resolved. No
citation in the kickoff had drifted. Local tool gaps found then (no Vale, Go,
golangci-lint; `make` blocked by an unaccepted Xcode license) were closed for the first
three on the PC. The Xcode license is operator-only and did not block this stage.

## 7. Self-application

This note was checked against kickoff §6 and §7.2: all three numbers are present, one as
"undefined" with the reason. The stage's own falsifier fired and is reported as fired.
Coverage limit: 12 of 34 pages had no Opus gold review. The author ran one cold QA pass
over those 12 and this note (verdict REVISE: 2 BLOCKER, 7 MAJOR). Most findings were
output blocks with undeclared cuts, one of them in this note. All were fixed, and the
fixes had no second cold pass. So "gold" for those pages rests on the deterministic
gates, one cold pass and the author's card.

After the first fidelity round (REVISE), the two named auditors then ran cold over the same
12 pages, per T-S0B-B:

- `agents/claims-conformance-auditor.md`: **REVISE, 5 gaps.** It confirmed that all 18
  output blocks are real log bytes and that all 15 glossary anchors resolve. The gaps
  were undeclared cuts on `quickstart-ts.md` and `installation.md`, a link on
  `foundations.md` that stopped one hop short, and a skill count on `ai-agents.md` that
  named four of eight. All fixed.
- `agents/docs-form-auditor.md`: **REVISE, 4 FAIL rows** (one already fixed by the item
  above). Internal wording in pasted output on `quickstart-go.md` had no gloss (C4). The
  optional second RED with `AIF_STRICT_RUNTIME=1` was named but not shown on
  `quickstart-ts.md` (C12); it was then run and pasted. The glossary said a retired name
  lives "in history documents only" while `installation.md` shows it in installer output
  (C10). All fixed.

The form auditor scored C11 as N/A, not PASS: its gate lives in the landing build and
cannot be reached from this repo. The author's card said PASS; read it as unmeasured.
It also noted that six pages changed while it read them, because it was handed live
paths and not a snapshot. Its report is against the pinned commit. These fixes had no
second named-auditor pass.
