# getff.ai docs quality contract — reader-comfort card, narrow gates, cold form audit

> **Rigor label (L0, effort-worthiness §2):** `research-grade` for every number in this spec
> (each is measured on the 196 landing drafts, explicitly calibrated on the gold pages, or
> labelled `uncalibrated` — umbrella D30 falsifier); `build-and-verify` for the mechanics (a Vale
> profile, two scripts, one skill, one agent — all reversible, none consumer-shipped until cutover).
> **Status:** REVIEW CAP SPENT after round 2 (round 1: both seats `REVISE` + umbrella D35;
> round 2: top-down narrow `REVISE`, bottom-up `GO` conditional on one clause — both said «land
> it, no third round»). Every round-2 clause is landed HERE, not deferred to the build commit.
> Next owner: the Opus plan (P-R); anything further is the operator's fork, not a review round.
> **Carve-out:** umbrella register row D30 / premise P-Z. Sibling carve-outs are CONSUMED, not
> redesigned: face pages (D28), reference generator (D29), rollout and cutover (D31/D34). Roles
> (P-R) and venue (D27) are binding; anything re-opening them is routed `ESCALATED`.

## Context

The getff.ai documentation site is written in two hands (umbrella D41): one clean Fable
session writes the gold set only; every remaining page is produced by the S1 conveyor RUN on
aif/GLM (serial by family, examples executed at write time). It is maintained afterwards by
whoever changes the code, on any seat, under a merge gate (D26). No human writes or approves a
page (P-B). The umbrella left ONE slot for this design: a quality contract with a deterministic
form layer at pre-commit/pre-push/CI, a criteria card that the three Opus review points (gold
pages → ONE checkpoint after family 1 → final whole-site check, D22) and the D26 refresh executor
all work against, and thresholds calibrated on the gold pages, never invented (D30).

Content home (umbrella D14a, D20, D34, ruled again in D35 after round 1): authored prose, gold
pages, `terms.md` and every generated artifact live in the framework repo under `docs/site/`;
the landing build reads the whole of `docs/site/` at a pin and owns only landing CODE. Every
channel decision below descends from that.

This session's operator answers reshaped the north star (premise register, Q-1..Q-3 below):
**the measure is reader comfort and ease of use, not «does it read as AI-written»**, and
**no page has ever been human-approved**, so the only baseline that will ever exist is the
gold pages after an Opus `GO`.

### Verified facts (measured 2026-09-14 unless noted; all re-derived by the round-1 seats)

| # | Fact | Evidence |
|---|---|---|
| F1 | Raw material: 196 draft pages on landing `main` c091883, 101,251 words; 16 top-level (9,548 w) + 180 under `content/docs/reference/` (91,703 w). All 196 are `.md`; 135 already carry HTML comments (`<!-- provenance: … -->`). | `find`/`wc`/`grep -rl` |
| F2 | Vale 3.21.0 with Microsoft + Readability + ai-tells, all rules on: **16,375 alerts = 160 per 1,000 words** (error 10,722 / warning 1,706 / suggestion 3,947). | `vale --output=JSON` → `full.json` |
| F3 | The alert mass is house style and vocabulary, not defects: em-dash 2,990 (+2,741 duplicate from `Microsoft.Dashes`), spelling 1,482 (`repo`, `getff`, `npm`, `config`, `vendored`, `ESLint`), acronyms 1,288 (`NOT`, `USES`, `ADDS`, `SSOT` — uppercase emphasis and template labels), `ShipOveruse` 624 (the `**Ships to:**` field), `Terms` 266 (`agent` → «personal digital assistant»). | 6 sampled hits × 26 rules, `samples.txt` |
| F4 | Real reader-comfort signal survives in few rules: `Microsoft.SentenceLength` 687 (5/6 sampled hits genuinely long), `Microsoft.Passive` 329 (4/6), a handful of ai-tells rules (4–5/6). Verdicts are judgment reads of the sample, not counts. | same sample |
| F5 | Readability metrics flag almost every file: `FleschReadingEase < 70` on 194/196 (median 60.5 top-level, 54.4 reference); `FleschKincaid > 8` on 165/196 (median grade 9.6 / 10.2). The five other metrics add exactly one page (`b32-aif-plan.md`) FRE/FK do not flag. | `full.json` parse; round-1 bottom-up re-count |
| F6 | Tuned profile (`tuned.ini`: **22** rules off, 6 demoted, vocabulary of **90** terms with ≥3 hits; `Microsoft.Semicolon` was NOT off in that run): **5,525 alerts = 55 per 1,000 words**, error 1,317. Stratified 20-page sample (seed 7, 9,517 words, list in §Calibration): 174 → 60 per 1,000 words. | `tuned.json`; corrected per F-M2/M1 |
| F6a | **Gate-only profile** (`gate.ini`: `Vale.Spelling` + vocabulary, `Vale.Terms = NO`, nothing else): **323 errors on 118/196 pages**, dominated by plurals and derived forms of accepted terms (`CLIs` 16, `deps` 14, `args` 12, `configs` 11, `worktrees` 5). The vocabulary is not converged; the gate is FP-free only after convergence. | `gate.json` |
| F6b | `Vale.Terms` (built-in, distinct from `Microsoft.Terms`) enforces the vocabulary's own casing: with `eslint` and `ESLint` both accepted it fires 417 errors on 142 pages (`Use 'claude' instead of 'Claude'`). It must be OFF. | `tuned.json`; round-1 M1 |
| F7 | **No human baseline exists.** The 16 top-level pages were assumed human-reviewed; the operator states they approved nothing (Q-1). Top-level vs reference remains a fact about drafts only. | operator |
| F8 | Term drift (files/hits): `getff` 81/318 vs `the framework` 65/92 vs `rules-as-tests` 20/54 vs `AI Factory` 9/24; `sub-agent` 22/47 vs `subagent` 14/68; `Claude Code` 51 files vs `CC` 31/96; `artefact` 16/25 vs `artifact` 39/69. `the framework` is generic in 44/92 lexical forms («the framework repo», «the framework's»); `rules-as-tests` is also the npm scope `@rules-as-tests/core` and an ESLint plugin prefix. `CC` 8/8 and `AI Factory`/`sub-agent`/`artefact` are product-name uses in every sampled context. | `grep` counts; round-1 samples |
| F9 | Landing repo has NO hooks and NO markdown CI (no `.husky`, no `prepare` script, `deploy.yml` only). Under D35 it receives none. | `ls`, `jq`; D31 `:15` |
| F10 | Framework precedents to reuse: markdownlint-cli2 at `.husky/pre-commit:100-113` with `.markdownlint.json` (SSOT #17 ADOPT); six `scripts/render-*.mjs --write/--check` over `packages/core/composition/fence.ts`; `render-rule-index.mjs --check` at pre-push and `audit-self.yml:247`; lychee offline at pre-push §8 (warn-and-skip when absent, `pre-push.ts:1865`) and PINNED by sha256 at `.github/workflows/audit-self.yml:748-749`; escape-token same-line grammar `ci-tool-pinning.md §3`; ≥20-char rationale floor `packages/core/hooks/checks/pr-body-fidelity.ts:217`; commit-trailer gate shape `packages/core/hooks/checks/prior-art.ts`. | file reads |
| F11 | SSOT #18 (Vale) is DEFER: «project mixes Russian + English prose; English-style preset FP ≥30% on Russian corpus». Revisit triggers, both arms: «2nd documented doc-prose-drift incident that markdownlint-cli2 cannot catch; OR Vale ships a Russian/mixed-corpus profile with FP <10%». The site corpus is EN-only and generated; the row is re-evaluated for it, not re-litigated. | `prior-art-evaluations.md:90` |
| F12 | Upstream writer skill: `pfeff/claude-skills` `diataxis`, MIT, HEAD `657c61c5ca8c` (2026-09-12), `claude plugin install pfeff/claude-skills`; quadrants + scaffold/write/audit + templates/anti-patterns; NO style guide inside. | `gh api` |
| F13 | Vale mechanics: `substitution` rules carry a forbidden→preferred map; `Vocab =` accept lists; per-rule levels and `= NO`. **Escape directives, measured on a 3-paragraph fixture (9 misspellings):** no directive 9; `<!-- vale off -->` 6; `<!-- vale off: reason -->` **9 (inert, silently)**; `<!-- vale off -->` + sibling `<!-- vale-reason: … -->` 6. In `.mdx` the same holds for `{/* vale off */}`; HTML comments are a hard MDX build error. | this seat + round-1 B1/item 1 |
| F14 | D29 generator spec (worktree `funny-yalow-98cabe`) exposes per-family JSON with `members[].name`, validated by `docs/site/reference/schema/<family>.schema.json`, injected through the same `fence.ts` markers. No forbidden-synonym field. D31 rollout spec (`dreamy-mayer-44288c`) owns the `.md`/`.mdx` decision (`:116`, fallback = `.mdx`). | round-1 item 3; D34 |

### Drill-downs

- **Why a generic «Vale clean» gate is impossible (F2, F5, F7):** at 160 alerts per 1,000 words
  every page fails; after tuning 55 remain, mostly unmeasured long-tail rules. A gate needs a
  measured false-positive rate against a *reader-comfort* verdict, and the only surface that can
  produce one is the gold pages. Hence gates are the small set that is false-positive-free
  **after vocabulary convergence** (F6a): typos against a vocabulary, four unambiguous forbidden
  names, broken links, markdown structure, frontmatter and kind skeleton. Everything else is a
  metric handed to the judgment layer.
- **Why ai-tells is dropped rather than tuned (F3, F7, Q-2):** its two loudest rules are
  punctuation the operator declared irrelevant; the rest is a long tail of ≤6-hit rules that
  cannot be calibrated on 20 pages; the umbrella's own D17b falsifier is met by construction
  since no approved page exists. The three rules with real signal (F4) return only through the
  promotion seam (D-Q11) if the auditor documents incidents.
- **Why the glossary is the site's own page (D20 + P-D):** one file `docs/site/terms.md` is
  simultaneously the reader-facing glossary, the writer's source of names, and the input the
  Vale substitution style is rendered from. Two places for one term is the D12 failure.
- **Why two scripts, not one (D34/D35):** `scripts/check-docs-refresh.mjs` is the D26 refresh
  gate (changed files ∩ `sources:` → affected pages, deferred token; pre-push + `audit-self.yml`;
  owned by D31/D34). `scripts/docs-check.mjs` is this spec's form gate. Neither performs the
  other's check (D35 falsifier b).

## Decision

Three layers, one interface:

1. **Deterministic form layer** (free, framework channels): markdownlint, Vale profile `getff`,
   lychee offline, frontmatter schema, per-kind section skeleton, `vale off` reason check — one
   entry `scripts/docs-check.mjs`. Gate = error-with-escape; everything else is a metric.
2. **Cold judgment layer:** the existing `claims-conformance-auditor` (facts) + a NEW
   `docs-form-auditor` (reader comfort, form, structure) — session-read agents with structured
   output, `GO | REVISE | STOP`, never in CI (`no-paid-llm-in-ci.md`).
3. **The reader-comfort criteria card**, per page kind — the single interface the writer skill
   follows, the form auditor fills, the three Opus review points apply (face pages included, D35
   E1), and the D26 refresh executor re-runs on the pages it touches.

### Live decision register

| Decision | Status | Resolution | Falsifier |
|---|---|---|---|
| D-Q1 The card's axis is reader comfort | decided (Q-2) | Five reader questions organise every criterion: FIND, UNDERSTAND, DO, TRUST, SAME WORDS. The umbrella's 10 draft criteria map onto C1–C13 (§Criteria card); «reader path per kind» is C12, «AI twin clean» is C11 consumed from D28. | An Opus review needs a criterion the card lacks → the card is the gap; add the reader question with a `Failure-scenario:`. |
| D-Q2 Gate set (what fails a commit) | decided (F2–F6b) | ERROR: markdownlint (`.markdownlint.json`, SSOT #17); `Vale.Spelling` against `styles/config/vocabularies/getff/accept.txt`; `getff.Names` (generated substitution, name-class entries only, D-Q7); lychee offline on changed `.md` (binary pinned by sha256 as at `.github/workflows/audit-self.yml:748-749`; **absent binary = ERROR**, not the pre-push warn-and-skip); frontmatter schema (C13); per-kind section skeleton (C12); a `vale off` without its reason comment. SUGGESTION (reported, never blocking): `Microsoft.SentenceLength`, `Microsoft.Passive`, `Microsoft.Contractions`, `Microsoft.Headings`, `Readability.FleschReadingEase`, `Readability.FleschKincaid`. OFF: `Vale.Terms` (F6b), the ai-tells package, the five other Readability metrics, `Microsoft.Acronyms/Terms/Vocab/Avoid/Adverbs/Dashes/Semicolon/Quotes/Auto/Foreign/We/GeneralURL/Plurals/Negative/DateOrder/HeadingColons` (the last four unmeasured, promotable via D-Q11). The shipped `.vale.ini` is the calibration artifact, re-measured before the gold pages (§Calibration row 3). | Any ERROR rule shows ≥1 false positive on the gold pages that is not a vocabulary miss → demote to suggestion before family 1; a suggestion rule fires on 0 gold pages AND is never cited by the auditor in family 1 → drop it. |
| D-Q3 Punctuation and ai-tells | decided (Q-2, F7) | Em-dash, semicolon, colon and every ai-tells rule are OFF and absent from the skill as rules. The skill carries one craft sentence: «punctuation serves the reader; when a sentence needs a dash to hold together, split it». No count, no ban. | The gold-page Opus review marks ≥3 pages «hard to read» with sentences a split would fix → `SentenceLength` is promoted per D-Q5, still not a punctuation rule. |
| D-Q4 Readability metrics | decided (F5) | FRE and FK grade recorded per page in the auditor's report. Target band initialised from the gold pages after Opus `GO` (min/max FRE, max FK) and stored in `docs/site-quality/calibration.md`; outside the band = MINOR note, never a gate. | A page inside the band is REVISEd for readability twice in family 1 (`uncalibrated` trigger) → keep the metric as information only. |
| D-Q5 Sentence length | decided (F4) | v1 = suggestion at Vale's Microsoft default. Promotion rule: after the gold `GO`, threshold := the longest gold sentence rounded up to the next 5 words (the rounding unit is `corpus-derived, uncalibrated`); from family 1 on, ERROR at that threshold with the D-Q12 escape. | Escapes exceed 1 per page on family 1 (`uncalibrated`) → the threshold moves to the next 5. |
| D-Q6 Channel and home of the deterministic layer | decided (D14a, D20, D34, **D35**) | Pages, gold pages and `terms.md` live in framework `docs/site/`; the landing build reads the whole of `docs/site/` at the pin and owns only landing code (stubs, `redirects.json`, `markdownUrl`, permalink resolver, Zod backstop). `scripts/docs-check.mjs`, Vale (`.vale.ini` + `docs/site-quality/vale/`), `render-terms-style.mjs` live in the framework and run from EXISTING channels: `.husky/pre-commit` next to the markdownlint-cli2 section (`--changed`) and `audit-self.yml` (full). Edit-time: the skill's done-checklist runs the same script. Vale binary pinned by version + sha256 (`ci-tool-pinning.md`). The landing repo gains NO pre-commit and NO workflow. Named dependency: D31 S1 decides `.md` vs `.mdx`; an `.mdx` flip changes the escape comment form AND breaks the 135 provenance comments (F1) — `docs-check.mjs` greps both comment forms from day one. | A landing build needs a file that is neither in `docs/site/` nor landing code → the home split is wrong; record where it lives, never a third home (D35 a). |
| D-Q7 Glossary contract | decided (D20, F8, F14) | `docs/site/terms.md` IS the site glossary page. Region (a), hand-written: concept terms — one-sentence definition, owner page, `Do not use:` list (definitions are claims → `claims-conformance-auditor`). Region (b), generated fence: artifact names from the D29 `members[].name` registry — names only; the generator feeds no synonym. Renderer boundary: `render-reference.mjs --check` asserts region (b), `render-terms-style.mjs --check` asserts `docs/site-quality/vale/getff/Names.yml`. **Only entries marked `Do not use (name):` render into the Vale substitution** (level error); plain `Do not use:` entries are JUDGE C10. Name-class entries decided now, each measured (F8): `AI Factory`, `sub-agent`, `CC` (word-bounded), `artefact` → `getff`, `subagent`, `Claude Code`, `artifact`. NOT name-class, JUDGE only: `the framework` (44/92 generic), `rules-as-tests` (npm scope), and every D28 §8 entry (`hook`, `tier`, `toolchain` — 11/11 legitimate technical uses in the corpus). | Two spellings of one term survive a sweep → add the pair (D20 falsifier); a name-class entry fires on a legitimate use in family 1 → it moves to JUDGE in the same commit, the substitution is never widened. |
| D-Q8 `docs-author` skill shape | decided (D17, F12) | Thin project skill wrapping the installed `pfeff/claude-skills` `diataxis` plugin BY POINTER, pinned to `657c61c5ca8c`. Residue only (§Skill outline): the `page-kinds.md` registry — seven registered `kind:` values: six templates (five from umbrella §2 + face page by pointer to D28 §5) plus `glossary` (C13 only, no skeleton; umbrella D51) —, the card, the craft contract, `terms.md` duty, D13 «execute the example at write time», the done-checklist, a `refresh` mode for the D26 executor, `references/gold/`. Same skill on every seat. | Upstream unreachable or reshaped → vendor the pinned tree under `references/upstream/` (MIT); the skill restates Diátaxis → `#parallel-evolution-creep`, cut back to residue. |
| D-Q9 `docs-form-auditor` protocol | decided (D14c) | Shape of `agents/claims-conformance-auditor.md`: frontmatter `name/description/tools: Read, Glob, Grep, Bash`, Class B header, cold by construction (inputs = page paths + kinds + the card path; never the writer's dialogue). Method: enumerate the population (T10), read every gold page, otherwise stratify by kind at floor 5 per kind (T1/T9), RUN `scripts/docs-check.mjs` and quote its numbers, fill the card per page with `PASS | FAIL | N/A` and `file:line` (T3), report clean-vs-low-coverage (T14). Header non-goal: **never judges whether a statement about the product is true**. | Nothing found across 3 sweeps → retire into the claims auditor's checklist (D14c falsifier); it asserts facts → strip `Bash`, add the fact ban to its examples. |
| D-Q10 Severity contract | decided (reviewer-discipline §6) | `REVISE` only on a `FAIL` carrying a `Failure-scenario:` naming the reader harm; every other observation is a MINOR note. Gold pages: all read, any scenario-bearing FAIL → REVISE. Checkpoint/final: floor 5 per kind; a FAIL repeating on ≥2 pages of one kind is SYSTEMIC (skill/terms fix + regenerate), otherwise LOCAL. Budget: 2 REVISE rounds per review point, then an ASK routed `ESCALATED` to the umbrella seat itself (register row D31: «this seat = main design seat answering escalations» — the umbrella session, not the D31 rollout carve-out). This is `reviewer-discipline.md §6.2`'s own budget shape — a breach forces an ask, never a stop — so it does not contradict P-J «rounds have no cap»; the 2 is the `/arch` convergence cap (`arch/SKILL.md:106`, re-measured at `4dd54b5b01b`; `:103` is blank — F2 MINOR), which §6.2 says its cumulative-3 budget «does not replace» (`:117`) and lets a contour set for itself (`:119`); the review brief carries the same 2. | A REVISE without a scenario → `#findings-as-KPI`, discarded; a scenario-bearing FAIL ignored → next D-Q11 incident. |
| D-Q11 Judgment → gate promotion seam | decided | Promotion after **3 documented incidents in 6 months** (`attention-is-not-a-mechanism.md §3`), each a research patch under `docs/meta-factory/research-patches/`. Reverse seam, hit-count-scoped: a gate rule with ≥10 hits on a 20-page sample and FP >10 % among them demotes to suggestion in the commit that records the measurement; a rule with <10 hits is judged per hit in the same commit. Both numbers `corpus-derived, uncalibrated` (T1 depth 20; SSOT #18's 10 % is a revisit trigger, not a constant). | Promotion without three patches → reverted. |
| D-Q12 Escape mechanism | decided (F13) | Two-comment form: a bare `<!-- vale off -->` (the only form Vale 3.21.0 parses) immediately followed by `<!-- vale-reason: <≥20 chars> -->`, closed by `<!-- vale on -->`; in `.mdx` the `{/* … */}` twins. `docs-check.mjs` errors on a `vale off` whose next line is not a reason comment (≥20-char floor per `pr-body-fidelity.ts:217`). Vocabulary route: `accept.txt` edits are allowed **in the page's own commit** (F6a: plurals of accepted terms would otherwise serialise family 1 behind ~30 PRs). `docs-refresh: deferred` stays D26's token. | Escapes exceed 1 per page on family 1 (`uncalibrated`) → the escaped rule is wrong, demote it; a `vale off` is found without a matching `vale on` → the check gains the pairing test. |
| D-Q13 Self-application | decided (invariant #2) | Skill at `.claude/skills/docs-author/` and agent at `agents/docs-form-auditor.md`, both written FOLLOWING the existing `ai-doc` skill's discipline (`.claude/skills/ai-doc/SKILL.md`: doc-authority header, `@harness-posture`) — `ai-doc` is reused machinery, not the home. Both run through the `docs-check.mjs` PROSE profile (D-Q17: markdownlint, Vale spelling and `getff.Names`, escape-reason check — never the page gates C12/C13/lychee) in `audit-self.yml` (same repo now, D35); the Opus spec review applies the card's UNDERSTAND question to the skill itself. | The skill fails its own gate → fix the skill, never widen the profile. |
| D-Q14 Gold pages and calibration record | decided (D17c, D22, D35) | One gold page per bulk kind (five: reference sheet, family overview and Guide from family 1 = B skills per D19; one Learn tutorial; one Understand page); the face-page kind's gold = the eleven face pages (the pinned seven + the four `/docs/quickstart-<stack>/` stack pages; umbrella D48 (a)) after the Opus gold review of the clean Fable pass. After `GO`: readability band, sentence threshold and per-kind «what good looks like» notes go to `docs/site-quality/calibration.md`; the pages are copied to the skill's `references/gold/` (frozen baseline; the live page moves). Wherever D-Q2, D-Q4, D-Q5 and the seams say «the gold pages», they mean the five bulk gold pages at measurement time; the eleven face pages join the calibration record as a second, dated entry after their own gold review, may only widen the readability band, and never gate before it. | A kind without gold → its band is uninitialised; the auditor reports `N/A`, never `PASS`. |
| D-Q15 SSOT rows at build time | decided (build-vs-reuse) | Two new rows: «Vale on the EN-only generated docs corpus — ADAPT, tuned profile, measured 2026-09-14», citing #17/#18 and leaving #18 DEFER for the mixed framework corpus; «pfeff/claude-skills diataxis — ADAPT by pointer, pinned». **No gate reaches these rows**: every artifact here is `.md` or lives outside `packages/`, so `prior-art.ts` never fires (round-1 M5). The rows are author discipline, listed as an explicit item in the Opus plan and checked by the plan's reviewer. | The build lands without the rows → the next Vale evaluation re-litigates #18; the plan checklist is the only detector, stated as such. |
| D-Q16 Writer's self-filled card has a channel | decided (round-1 MAJOR-6) | The done-checklist's card lands as a commit trailer `Docs-card: C1 PASS, C2 PASS, … C13 N/A` on every commit touching `docs/site/**/*.md` prose, checked at pre-push AND in `audit-self.yml` over the PR's commit range (both arms of `prior-art.ts`; the CI arm is the D29a umbrella requirement — aif container seats never run pre-push). Checks: trailer present, all C-ids listed, escape `Docs-card: skipped — <≥20-char reason>`. The auditor diffs its verdict against the trailer (T15 seam). | Trailers are all-PASS on ≥90 % (`uncalibrated`) of family-1 commits while the auditor FAILs ≥1 criterion per page → the self-fill is theatre; drop the trailer, keep the auditor. |
| D-Q17 File scope of `docs-check.mjs` | decided (round-2 R2-1) | Two profiles, declared in the script, never inferred from the channel. **Pages profile** (all gates: C12 skeleton, C13 frontmatter, lychee, Vale, escape-reason): `docs/site/**/*.md` (plus `.mdx` if D31 S1 flips), with NO exclusion list: every file there without a `kind:` key is an ERROR, permanently (umbrella round 1 MAJOR-3). No generated artifact lives under the framework's `docs/site/`: D28 twins and `llms.txt` are landing build-time projections (D28 `:370`), the D31 manifest is JSON (D31 `:145`), D29 cards are fence regions inside author-created pages that carry `kind:` (D38/P-AG) — so nothing passes by omission and no sibling spec owes a glob. `terms.md` carries `kind: glossary` (C13 applies, C12 has no skeleton for it). **Prose profile** (markdownlint, Vale spelling + `getff.Names`, escape-reason; no page gate): `.claude/skills/docs-author/**/*.md` minus `references/gold/**` (frozen copies, exempt from everything), `agents/docs-form-auditor.md`, `docs/site-quality/calibration.md`. Pre-commit `--changed` and `audit-self.yml` pick the profile by path; a path in neither list is skipped and reported. | A generated artifact appears under the framework's `docs/site/**/*.md` → a sibling's output path leaked into the content home; fix that path, never add an exclusion glob or widen `kind:`; the prose profile fires a page gate → scope leak, the seam test below catches it. |
| D-Q18 `sources:` provenance | decided (umbrella D43) | `sources:` is DERIVED, not authored: the D29 renderer `--write` fills it as body anchors ∪ card sources; `docs-check.mjs --check` fails on drift (anchors ⊄ sources). Authors may ADD entries, never remove a derived one. The residual — a source the page depends on but neither anchors nor cites in a card — is a band-C evidence defect under the claims auditor (**D-Q9**, `agents/claims-conformance-auditor.md` — the row at `:105`; the earlier «D-Q3» pointed at the punctuation row, corrected F2 2026-09-14), a known limit, not a gate. | A page fails `--check` after a clean `--write` → the two tools disagree on the anchor grammar; fix the seam, never hand-edit `sources:` to green. |

## The reader-comfort criteria card

Check types: `GATE(<check>)` deterministic, fails the commit; `JUDGE` the form auditor and the
Opus points; `CLAIMS` the claims auditor; `D2x` delegated to a sibling. The umbrella's draft
criterion each absorbs is in brackets.

| # | Reader question | Criterion | Check | Kinds |
|---|---|---|---|---|
| C1 | FIND | The page sits where the IA says its kind lives; its title states the reader's goal or the artifact's name [IA fit] | JUDGE | all |
| C2 | FIND | Sibling pages are linked from a fixed place and every link resolves at the pin [IA fit] | GATE(lychee) + JUDGE | all |
| C3 | UNDERSTAND | The first paragraph says what the reader gets and why it matters, before any mechanism [why before how] | JUDGE | all |
| C4 | UNDERSTAND | Plain friendly English: second person, short sentences, no unexplained acronym on first use; FRE/FK reported against the gold band | GATE(spelling) + metric + JUDGE | all |
| C5 | UNDERSTAND | Progressive disclosure: common case first, edge cases and internals after, callouts only for warnings | JUDGE | all |
| C6 | DO | Every example is copy-ready, executed at the pin, and shows its real output [copy-ready, D13] | CLAIMS + JUDGE | reference, Learn, Guide, face |
| C7 | DO | An example lives once; other pages link, never paste [one source, D12] | JUDGE at v1 (today's corpus has 7 fenced blocks, 0 duplicates — no population to measure a hash gate on; re-evaluate after family 1) | all |
| C8 | TRUST | Every statement about behaviour is true at the pin [truth at pin]; anchors resolve at the pin | CLAIMS + D26/D34 (`check-docs-refresh.mjs`, landing permalink resolver) | all |
| C9 | TRUST | Limits and non-goals are stated where the reader would otherwise assume more [honest limits] | JUDGE | reference, Guide, Understand, face |
| C10 | SAME WORDS | Terms used as defined in `terms.md`, first mention linked; no forbidden synonym [glossary terms] | GATE(`getff.Names`, name-class) + JUDGE (context-dependent synonyms, first-mention link) | all |
| C11 | (AI twin) | The `.md` twin / `llms.txt` contract holds | GATE(D28 S6 face twin schema + D28 S5 `llms.txt` shape; D31 manifest for bulk twins) | all |
| C12 | FIND/DO | The page follows its kind's skeleton in order [reader path per kind] | GATE(required sections by `kind:` frontmatter, `docs-check.mjs`) for the five bulk kinds + JUDGE (order, first-step placement); face page: JUDGE only, against D28 §5.1–§5.7's own per-page skeleton (never encoded here, D35 c) | all |
| C13 | TRUST | Frontmatter complete: `title`, `description`, `kind` (one of the seven values registered in `page-kinds.md`, D-Q8), `sources:` (the D26 mapping input; derived per D-Q18, authors add but never remove) | GATE(frontmatter schema, `docs-check.mjs`; D31 R18 Zod backstop at the landing build) | all |

Delegated deterministic checks the umbrella §5 list named, with their owner: generated fences
`--check` → D29 `render-reference.mjs`; anchors at pin and permalinks → D34 boundary 1 (landing
build); affected-page refresh → D26/D34 `check-docs-refresh.mjs`; twins/manifest → D28 S6 / D31.

Per-kind specifics (the skeleton is what C12's gate checks; the JUDGE items are the kind's own):

- **Reference sheet** — bands in order: A fact card (generated fence, D29), B explanation (C3
  applies to band B's first paragraph), C evidence (paths + test names at the pin). No selling
  language; JUDGE: «would a reader who already chose this artifact find anything they do not need?».
- **Family overview** — one generated table → one row per sheet, one «common cases» block of
  ready snippets (D13) that duplicates no sheet's example (C7), one paragraph on when NOT to
  reach for this family (C9).
- **Learn tutorial** — numbered steps; the first runnable step appears before any concept
  explanation; every step shows the real output (C6); ends with «what you built» and one link.
- **Guide (how-to)** — goal in the title, prerequisites list, steps, a verification step the
  reader can run, then variations. JUDGE: no concept teaching inside steps.
- **Understand (explanation)** — pain → mechanism → proof (link to the test or measurement) →
  honest limit, in that order; no steps, no snippets other than illustration. This clause
  belongs to Understand ONLY (D35).
- **Face page (eleven pages, D28 — the pinned seven + the four stack pages, umbrella D48 (a))** — per-kind rule is a POINTER to
  `2026-09-14-getff-ai-face-pages-design.md §5` (pain → mechanism → proof → honest limit in the
  page's own proportion), never a copy; D28 stays authoritative for the rule's content (D35 E1;
  falsifier c: a face page fails the card on a clause §5 does not carry → the pointer became a
  paraphrase). Its C12 check is JUDGE only — the seven pinned pages have seven per-page skeletons (§5.1–§5.7) and the four stack pages share one (§5.2), none of them gated deterministically, so
  a shared section gate would assert nothing (`#hope-as-gate`) or copy §5.

## `docs-author` skill outline

```text
.claude/skills/docs-author/
  SKILL.md              # ≤150 lines: pointer to pfeff diataxis @657c61c5ca8c, when to use,
                        # the five reader questions, the craft contract, done-checklist,
                        # `refresh` mode (D26 executor: re-run the card on touched pages only)
  references/
    page-kinds.md       # the REGISTRY of `kind:` values — a closed set of SEVEN (C13 enum
                        # source): six templates with required sections (= C12 skeleton), band
                        # order, example/diagram slot; face page = pointer to D28 §5; plus
                        # `glossary` (C13 only, no C12 skeleton — `terms.md`, D-Q17; umbrella D51)
    criteria-card.md    # the table above, verbatim (single source; the agent links here)
    craft.md            # openers, why-before-how, second person, progressive disclosure,
                        # callouts, one punctuation sentence (D-Q3); examples from gold pages
    terms.md            # POINTER to docs/site/terms.md (never a copy — P-D)
    gold/               # gold pages after Opus GO (frozen copies, D-Q14)
```

Done-checklist (edit-time channel): example executed and output pasted → `terms.md`
first-mention links present → `node scripts/docs-check.mjs <page>` clean → `Docs-card:` trailer
in the commit body (D-Q16). The checklist is prose for the writer; its detection lives in the
hooks (D-Q6, D-Q16).

## `docs-form-auditor` outline

Frontmatter `name: docs-form-auditor`, `description` (triggers: gold-page review, family
checkpoint, final site check, D26 refresh on ≥5 pages), `tools: Read, Glob, Grep, Bash`.
Header: Class B; «reads pages cold, receives paths + kinds + the card path, never the writer's
dialogue; runs `docs-check.mjs` for numbers; **does not judge facts**». Method sections mirror
`agents/claims-conformance-auditor.md`; output grammar:

```text
## Population   <N pages, per kind (seven registered, D-Q8)>
## Sample       <paths, stratification, seed>
## Numbers      <docs-check.mjs summary: errors 0, suggestions n, FRE/FK per page vs band>
## Cards        one table per page: C1..C13 → PASS | FAIL (+ Failure-scenario:) | N/A, file:line
## Trailer diff <writer's Docs-card vs this verdict, per criterion>
## Patterns     SYSTEMIC (≥2 pages of one kind) vs LOCAL
## Card gaps    reader harms seen that no criterion names
## Overall      GO | REVISE | STOP   (REVISE requires ≥1 scenario-bearing FAIL)
```

## Vale calibration record (2026-09-14, landing `main` c091883)

| Profile | Alerts | Per 1,000 w | Error | Note |
|---|---|---|---|---|
| Default (Microsoft + Readability + ai-tells) | 16,375 | 160 | 10,722 | unusable as a gate on any page |
| Tuned (`tuned.ini`: 22 off, 6 demoted, 90-term vocabulary; Semicolon still on, `Vale.Terms` still on) | 5,525 | 55 | 1,317 | residue = `Vale.Terms` casing 417 + spelling 323 + long-tail ai-tells |
| Gate-only (`gate.ini`: `Vale.Spelling` + vocabulary, `Vale.Terms = NO`) | 323 | 3.2 | 323 | 118/196 pages; plurals/derived forms of accepted terms → vocabulary convergence, not defects |
| Shipped D-Q2 profile on the gold pages | after `GO` | — | — | the only number that will ever gate; recorded in `docs/site-quality/calibration.md` |

Per-rule verdicts (6 sampled hits each): false-positive-dominated → `Acronyms`, `Terms`,
`Vocab`, `Avoid`, `Headings`, `ShipOveruse`, `FormalRegister`, `EnforcementMetaphors`,
`Spelling` (vocabulary); house style, irrelevant under Q-2 → `EmDashUsage`, `Dashes`,
`Semicolon`, `SemicolonUsage`, `ColonUsage`; friendly-tone helper kept as suggestion →
`Contractions`; real signal → `SentenceLength`, `Passive`, `LabelAndExplain`,
`AnthropomorphicJustification`, `CataphoricForecasting`.
Stratified 20-page sample (seed 7): `index.md`, `daily-cycle-rules.md`, `faq.md`,
`what-is-getff.md`, `beta.md`, `b16-tool-bootstrapping.md`, `b18-aif-architecture.md`,
`rule-dual-implementation-discipline.md`, `rule-memory-codification.md`, `c10-review-sidecar.md`,
`c4-capability-reuse-auditor.md`, `bridge-backend-contract.md`, `bridge-aif-http.md`,
`e11-hooks-package-json.md`, `e3-prettierignore.md`, `a20-finalize.md`,
`a11-subagents-delivery.md`, `script-check-shields-up.md`, `script-check-arch-boundaries.md`,
`g6-preset-react-spa.md`. Human-approved baseline: **none** (F7). Working files (`tuned.ini`,
`gate.ini`, `accept.txt`, `full.json`, `tuned.json`, `gate.json`, `calibration-note.md`) in the
authoring session's scratchpad. The build commit copies ONLY `tuned.ini` (as `.vale.ini`) and
`accept.txt` into `docs/site-quality/vale/`; the alert dumps (~9.8 MB of JSON) stay out of the
tree — their numbers live in this table and in `docs/site-quality/calibration.md`. Nothing of
this lands under `docs/site/`, which the landing build reads whole at the pin (D35).

## Testing seams

- **Profile fixture:** `tests/docs-check/fixtures/` holds one page per kind with seeded defects
  (one typo, one name-class synonym, one broken link, one `vale off` without a reason comment,
  one missing `sources:`, one missing required section) and one **bootstrap-clean** page written
  for the fixture (the gold pages do not exist yet); `docs-check.mjs` must report exactly the
  seeded errors **and no other error-level alert**, and zero on the clean page. Snapshot the JSON.
- **Terms render drift:** `render-terms-style.mjs --check` against a `terms.md` with an added
  `Do not use (name):` entry must fail; after `--write` must pass; a plain `Do not use:` entry
  must render nothing (`regionsMatch` precedent).
- **Escape reason:** `vale off` + reason of 19 chars fails, 20 passes; `vale off` with no
  following reason comment fails; same in the `{/* */}` form.
- **Gate-set FP on gold:** the D-Q2 falsifier is a test: run the ERROR rules on the gold pages
  after `GO`; any hit that is not a vocabulary miss is a failing assertion recorded in
  `docs/site-quality/calibration.md`.
- **Auditor self-run (T15):** first invocation on the gold pages with the `Docs-card:` trailers
  beside it; a disagreement on any criterion is the calibration finding, not a page defect.
- **Trailer gate:** a commit touching `docs/site/x.md` without `Docs-card:` is blocked at
  pre-push; with the `skipped —` escape it passes (prior-art.ts fixture shape).
- **Skill under its own gate (D-Q13, D-Q17):** the prose profile over `.claude/skills/docs-author/**`
  and `agents/docs-form-auditor.md` runs in `audit-self.yml`; a scope test asserts the pages
  profile reports zero files there (a `title`/`kind`/`sources:` error on a skill file = leak).
- **Trailer CI arm (D-Q16):** a fixture PR range with one prose commit lacking `Docs-card:` fails
  the `audit-self.yml` arm; the same range with the `skipped —` escape passes.
- **Two scripts stay disjoint (D35 b):** a fixture commit that changes a cited source path but no
  prose must fail ONLY `check-docs-refresh.mjs`; a commit with a typo must fail ONLY `docs-check.mjs`.

## Consequences

- The Fable content session gets a fixed interface before writing: card, six templates, terms,
  and a script that says «clean» in seconds, all in the repo it writes in.
- Opus reviews are cheap and comparable: the same card at all three points, face pages
  included, numbers from the same script, REVISE only with a scenario.
- Cost of being wrong is bounded: every gate rule has a demotion path, every judgment criterion
  a promotion path counted in incidents, every uncalibrated number is labelled.
- NOT done: no ai-tells, no punctuation rules, no readability gate, no LLM in any hook or
  workflow, no second glossary, no vendored Diátaxis, nothing in the landing repo.
- Build items for the Opus plan (P-R) — stage by pointer: umbrella D50 **S0q — quality-layer build** (between S0a and S0b; Opus writes P-R while S0a runs, aif/GLM builds after S0a merges; the S0b chip's `host-verify` carries one `test -e` per S0q artefact = the D40 (2) channel; the `diataxis` install is a host hand): `scripts/docs-check.mjs` + pre-commit section + Vale and
  lychee pins + `audit-self.yml` job; `render-terms-style.mjs`; `docs/site/terms.md` skeleton
  with the fence; `Docs-card:` pre-push section + `audit-self.yml` arm; `docs/site-quality/` (vale profile, vocabulary, calibration record); install of the `pfeff/claude-skills` `diataxis` plugin pinned at `657c61c5ca8c` (`claude plugin install pfeff/claude-skills`; ABSENT on this machine — umbrella D44 census row 16; prerequisite of the `docs-author` build below, not of the kickoff); skill under `docs-author/` + agent, both per the `ai-doc` discipline; the two SSOT rows
  (author discipline, D-Q15); fixtures above.

## Prior art (pass 2026-09-14)

- SSOT #17 markdownlint-cli2 (ADOPT) — config reused; SSOT #18 Vale (DEFER, mixed corpus) —
  re-evaluated for the EN-only corpus, row stays for the framework.
- Vale packages Microsoft / Readability / ai-tells — fetched and RUN (F2–F6b, F13).
- `pfeff/claude-skills` `diataxis` (MIT) — fetched; no style guide inside (D17 probe).
- Framework precedents: `claims-conformance-auditor.md`, `template-audit` P2/P3/P5,
  `render-*.mjs` + `fence.ts`, `ci-tool-pinning.md §3` (same-line token), `pr-body-fidelity.ts:217`
  and `destination-environment-verification.md:47` (≥20-char rationale), `prior-art.ts`
  (trailer gate), `.github/workflows/audit-self.yml:748-749` (binary pin by sha256), `reviewer-discipline.md §6/§6.2`,
  `attention-is-not-a-mechanism.md §3`, `ai-doc`.
- Honest absence: no existing framework glossary of product terms (only the orchestrator's
  internal roles glossary, `.claude/skills/orchestrator/references/glossary.md`).

## Operator premise register (verbatim-faithful)

From the umbrella register (`_decision-register-getff-ai-site.md`, copied, not reconstructed):

- **P-A** — Dynamic docs are wanted NOW, not at the end: parts of the framework are reworked
  constantly, docs go stale; docs must always be current; this also serves the AI developing
  the project — it looks into its own docs first.
- **P-B** — A human writes nothing. All text is generated: high-quality, comfortable and useful
  for a human reader as one rendering, informative and useful for AI as another; both maximally
  easy to use for humans and current for AI.
- **P-D** — One criterion of truth for everything: the project, the docs, the AI — everywhere.
  This is a top quality criterion.
- **P-J** — Rounds have NO cap. The operator judges a Strunk & White strictness skill the wrong
  fit: what we need is popular, simple, FRIENDLY English — the craft of modern documentation.
- **P-R** — «the factory must control ITSELF; Opus only checks the FINAL work; Fable = advisor /
  creator / inventor, owns the DESIGN; the PLAN is written by Opus, and when something is
  unclear Opus asks Fable.»
- **P-Z** — «go — let section 5 also be designed better in a separate Fable session.»

From this session (2026-09-14, Russian verbatim, then the meaning carried):

- **Q-1** — «я ничего не одобрял» — no page has been human-approved; the gold pages after Opus
  `GO` are the first baseline (F7, D-Q14).
- **Q-2** — «это не важно главное комфортность и удобство пользования документацией» — on
  dashes and semicolons: irrelevant; what matters is the comfort and ease of use of the
  documentation (D-Q1, D-Q3).
- **Q-3** — «Остальное да задача для тебя продумать как сделать лучше» — the remaining design
  forks are delegated to this seat; grilling closed after round 1.

## Changelog

### Round 1 — two cold seats (separate Opus session, 2026-09-14) + umbrella ruling D35

Both seats returned `REVISE` on commit `51f16a4528e`. The review files
(`…review-top-down.md`, `…review-bottom-up.md`) are working artifacts of the review session,
not committed (precedent: the dynamic-context-window spec folded both rounds into its
changelog; the bottom-up file is 781 lines, past the 600-line gate). Every finding is
restated here. Every number the seats re-derived reproduced exactly except the two descriptors
in F-M2. Dispositions:

| Finding | Disposition | Where |
|---|---|---|
| TD BLOCKER-1 = BU B2 — content home in landing contradicts D14a/D20/D34 | **ESCALATED → FIXED** by umbrella D35 (E2: framework `docs/site/`, existing channels, landing gets nothing) | D-Q6, D-Q7, Context, C-table, build items |
| BU B1 — `<!-- vale off: reason -->` is inert in Vale 3.21.0 | **FIXED** — two-comment form, re-measured by this seat (9/6/9/6) | F13, D-Q12, seams |
| TD MAJOR-2 — «reader path per kind» has no card row | **FIXED** — C12 GATE(kind skeleton) + JUDGE | card |
| TD MAJOR-3 — `getff.Terms` unmeasured; `the framework` cannot be a substitution | **FIXED** — name-class filter; `the framework` and `rules-as-tests` (npm scope, found by this seat) moved to JUDGE; four remaining names measured | D-Q7, F8 |
| TD MAJOR-4 — anchors, fences, frontmatter absent | **FIXED** — C13 frontmatter gate; delegation table under the card | card |
| TD MAJOR-5 = BU F-M9 — no kind for the seven face pages | **ESCALATED → FIXED** by D35 (E1 option a: sixth kind by pointer to D28 §5) | card, D-Q8, D-Q14 |
| TD MAJOR-6 — writer's self-filled card has no channel | **FIXED** — D-Q16 `Docs-card:` trailer gate at pre-push | D-Q16, seams |
| TD MINOR-7 — pre-push missing from the channel list | **ACCEPTED** — D35 names pre-commit + `audit-self.yml` for `docs-check.mjs`; pre-push now carries the D-Q16 trailer gate and D34's refresh gate | D-Q6 |
| TD MINOR-8 — P-R parenthetical misattributed | **FIXED** | D-Q10 |
| TD MINOR-9 — C11 has no check owner | **FIXED** — GATE(D28 S6) | card |
| BU M1 — `Vale.Terms` and four Microsoft rules unclassified; Semicolon not off in the run | **FIXED** — classified; F6 corrected; gate-only re-measured (F6a) | D-Q2, F6, F6b |
| BU M2 — spelling not FP-free by construction | **FIXED** — «after vocabulary convergence», residual 323/118 measured, same-commit `accept.txt` route | F6a, drill-down, D-Q12 |
| BU M3 — D28's synonyms would fire ~880 FPs | **FIXED** — only `Do not use (name):` entries render; D28 §8 entries are JUDGE | D-Q7 |
| BU M4 — script lives in one repo, runs in another | **DISSOLVED** by D35 (one repo) | D-Q6 |
| BU M5 — `prior-art.ts` cannot fire on these artifacts | **ACCEPTED** — stated plainly; rows are author discipline on the Opus plan checklist | D-Q15 |
| BU M6 — lychee warn-and-skip, unpinned | **FIXED** — pinned per `.github/workflows/audit-self.yml:748-749`; absent binary = ERROR | D-Q2, F10 |
| BU F-M1 — D-Q2/D-Q4 disagree on Readability | **FIXED** — FRE + FK suggestion, five OFF; F5 re-count carried | D-Q2, F5 |
| BU F-M2 — 21/99 vs 22/90 | **FIXED** in spec and `calibration-note.md` | F6, calibration |
| BU F-M3 — four thresholds unlabelled; FP trigger unmeasurable on ≤6-hit rules | **FIXED** — `uncalibrated` labels; hit-count-scoped reverse seam | D-Q4, D-Q5, D-Q11, D-Q12 |
| BU F-M4 — ≥20-char floor misattributed | **FIXED** — `pr-body-fidelity.ts:217` | F10, prior art |
| BU F-M5 — cap 2 vs P-J no cap | **FIXED** — §6.2 reconciliation sentence | D-Q10 |
| BU F-M6 — #18 revisit arm elided | **FIXED** | F11 |
| BU F-M7 — fixture seam ordering + «exactly five» | **FIXED** — bootstrap-clean page; «no other error-level alert» | seams |
| BU F-M8 — C7 hash gate unmeasured | **FIXED** — C7 is JUDGE at v1, population noted | card |
| BU UNVERIFIED 1 — `.md`/`.mdx` | **FIXED** — D31 S1 named as dependency; both comment forms grepped; 135 provenance comments noted | D-Q6, F1, F13 |
| BU UNVERIFIED 2 — husky in landing | **DISSOLVED** by D35 | — |
| BU UNVERIFIED 3 — D29 name registry | **FIXED** — consumed; names only; renderer boundary stated | D-Q7, F14 |

Not a ruling but recorded: the umbrella's own D28a wording («GENERATED content only») invited
the landing reading and was corrected in the register; this spec cites D14a/D20/D34/D35 directly.

### Round 2 — same two seats (2026-09-14); review cap spent

Top-down: narrow `REVISE`; bottom-up: `GO` conditional on one clause. Both audited round 1 as
28 rows / 0 NOT-DONE / 0 MISREAD; both asked that the clauses land in the build commit rather
than a third round (`#findings-as-KPI` on a reversible surface). They land here instead, so the
spec stays the single source. Files `…review-round2-*.md` untracked, same precedent.

| Finding | Disposition | Where |
|---|---|---|
| BU R2-1 (MAJOR) — `docs-check.mjs` has no file scope; round 1 widened D-Q13 from «profile» to the bare script, so page gates would run on skill/agent frontmatter | **FIXED** — D-Q17 two declared profiles; D-Q13 names the prose profile; scope seam test | D-Q13, D-Q17, seams |
| TD MAJOR-1 (a) = BU R2-2 — C12's section gate is vacuous for the sixth kind | **FIXED** — gate scoped to the five bulk kinds; face page JUDGE against D28 §5.n | C12, face bullet |
| TD MAJOR-1 (b) — «the gold pages» unqualified after the gold set split 5 + 7 | **FIXED** — D-Q14 qualifier: bulk five at measurement, face seven as a dated second entry that can only widen | D-Q14 |
| BU R2-3 (MINOR) — ~9.8 MB of alert JSON into the content tree | **FIXED** — Vale home and calibration record moved to `docs/site-quality/`; only `tuned.ini` + `accept.txt` copied; dumps stay out | Calibration, D-Q6, D-Q7 |
| TD MINOR-2 — trailer gate pre-push only; containers never run pre-push (D29a) | **FIXED** — `audit-self.yml` arm over the PR range | D-Q16, seams |
| TD Note 3 — «uncited elsewhere» is false; seat suggested 3 | **FIXED** wording, **number kept at 2** — it is the `/arch` convergence cap (`arch/SKILL.md:106`, re-measured at `4dd54b5b01b`; `:103` is blank — F2 MINOR) that §6.2 explicitly does not replace (`:117`, `:119`); the reviewing session itself overruled its seat on this | D-Q10 |
| TD Note 4 — C11 owner named only the face half | **FIXED** — S6 face twins + S5 `llms.txt` + D31 manifest | C11 |
| TD Note 5 — «≥90 %» unlabelled | **FIXED** — `uncalibrated` | D-Q16 |
| TD/BU number re-derivation — `getff` 81/318 vs 83/321 | **ACCEPTED** — pre-existing count drift, no decision turns on it; left as measured on 2026-09-14 | F8 |
| Umbrella decision D38/P-AG — «D29 cards» in the D-Q17 MINUS list would let an implementer drop all reference pages out of the pages profile | **FIXED** — struck; cards are fence regions in `kind:`-bearing pages (D29 TD2-6/BU2-6) | D-Q17 |
| Umbrella acceptance note (D38) — «the Fable design seat, D31» in D-Q10 read as the rollout carve-out | **FIXED** — wording: the umbrella seat itself, per register row D31's title | D-Q10 |
| Post-cap note from the reviewing session — D-Q13 and the build items named the skill's home as `ai-doc/` (existing, reused) while D-Q8/§Skill outline/D-Q17 say `docs-author/` (the one designed here); after D-Q17 the literal reading would leave the skill in neither profile | **FIXED** — `ai-doc` is the discipline followed, `docs-author/` is the home; unchanged since `51f16a4528e`, missed by all four seat runs and by this seat | D-Q13, build items |

### Umbrella round 1 (2026-09-14) — routed by pointer, review cap spent

Two fixes from the umbrella's own cold pass (D39) arrived by pointer; umbrella rows bind, no
seat round was opened. Applied on PR #1746's branch.

| Finding | Disposition | Where |
|---|---|---|
| Umbrella MAJOR-3 — D-Q17's MINUS list and «until they land» clause excluded artifacts that never exist under the framework's `docs/site/` (D28 twins/`llms.txt` are landing build-time projections, D28 `:370`; D31 manifest is JSON, D31 `:145`; D29 cards are fence regions) | **FIXED** — list and clause struck; every `docs/site/**/*.md` without `kind:` is an ERROR permanently; falsifier now points at the sibling's output path | D-Q17 |
| Umbrella D43 — `sources:` provenance undefined (authored vs derived) | **FIXED** — D-Q18: derived by the D29 renderer `--write` (anchors ∪ card sources), `docs-check.mjs --check` fails on drift, authors add but never remove, residual = band-C evidence defect | D-Q18, C13 |
| Umbrella round 3 BU MAJOR-2 (umbrella `e30221d1e79`) — D-Q8 presumes the `diataxis` plugin is installed, but the build-items list carried no install and the plugin is absent on this machine | **FIXED** — own build item: `claude plugin install pfeff/claude-skills` pinned at `657c61c5ca8c`, prerequisite of the `docs-author` build (D44 census row 16) | Build items |

### Umbrella final pass F (2026-09-14, umbrella `4d1d2c7bfb8`) — batch 1, routed by pointer

| Finding | Disposition | Where |
|---|---|---|
| Umbrella D51 (2) = final-pass TD MAJOR-4 — `glossary` was a `kind:` value only in D-Q17's prose, so a C13 enum built from `page-kinds.md` would be a closed set of six | **FIXED** — `page-kinds.md` is the registry of seven values (six templates + `glossary`, C13 only, no C12 skeleton); D-Q8, C13, auditor Population line say so | Skill outline, D-Q8, C13, auditor |
| TD MINOR-7 — Context opened with the withdrawn one-session / ~125-page model | **FIXED** — restated to D41: Fable writes the gold set only, every remaining page is the S1 conveyor on aif/GLM | Context |
| BU MINOR-2 — lychee pin cited at `audit-self.yml:720-721` | **FIXED** — `.github/workflows/audit-self.yml:748-749` (measured: `sha256sum -c` at `:749`), all four citations | F10, D-Q2, Prior art, round-1 row |
| TD MAJOR-3 = BU MAJOR-3 — build items owned but at no stage | **FIXED** by pointer — umbrella D50 S0q quality-layer build, S0b `host-verify` `test -e` per artefact (D40 (2)) | Build items |
| TD BLOCKER-1 — «seven pages» (`§Face page`) presumes a writer for the four `/docs/quickstart-<stack>/` face pages that no package item names | **FIXED** — umbrella D48 answered (a) at `7e40b12869d` (gold set 7→11). Folded here: the card `:157`, its C12 rationale `:161`, and D-Q14's gold/calibration scope `:110`. C12 stays JUDGE-only; no stack sub-kind skeleton was added. | Face page bullet |
