# getff.ai docs quality contract — reader-comfort card, narrow gates, cold form audit

> **Rigor label (L0, effort-worthiness §2):** `research-grade` for every number in this spec
> (each is measured on the 196 landing drafts or explicitly calibrated on the 5 gold pages —
> umbrella D30 falsifier); `build-and-verify` for the mechanics (a Vale profile, one script,
> one skill, one agent — all reversible, none consumer-shipped until the site cuts over).
> **Status:** DRAFT — awaiting the two cold /arch §2 seats in a separate Opus session (D27).
> **Carve-out:** umbrella register row D30 / premise P-Z. Sibling carve-outs are CONSUMED, not
> redesigned: face pages (D28) and the reference generator (D29). Roles (P-R) and venue (D27)
> are binding inputs; anything that would re-open them is routed `ESCALATED` to the umbrella seat.

## Context

The getff.ai documentation site is written by one clean Fable session (umbrella D24b/D25:
~125 pages, serial by family, examples executed at write time) and maintained afterwards by
whoever changes the code, on any seat, under a merge gate (D26). No human writes or approves a
page (P-B). The umbrella left ONE slot for this design: a quality contract with a deterministic
form layer at pre-commit/pre-push/CI, a criteria card that the three Opus review points (5 gold
pages → ONE checkpoint after family 1 → final whole-site check, D22) and the D26 refresh executor
all work against, and thresholds calibrated on the 5 gold pages, never invented (D30).

This session's operator answers reshaped the north star (premise register, Q-1..Q-3 below):
**the measure is reader comfort and ease of use, not «does it read as AI-written»**, and
**no page has ever been human-approved**, so the only baseline that will ever exist is the 5
gold pages after an Opus `GO`. Every decision below follows from those two facts plus the
measurements.

### Verified facts (measured 2026-09-14 unless noted)

| # | Fact | Evidence |
|---|---|---|
| F1 | Raw material: 196 draft pages on landing `main` c091883, 101,251 words; 16 top-level (9,548 w) + 180 under `content/docs/reference/` (91,703 w). | `find`/`wc` over `/Users/art/code/getff-landing/content/docs` |
| F2 | Vale 3.21.0 with Microsoft + Readability + ai-tells, all rules on: **16,375 alerts = 160 per 1,000 words** (error 10,722 / warning 1,706 / suggestion 3,947). | `vale --output=JSON` over F1 → `full.json` |
| F3 | The alert mass is house style and vocabulary, not defects: em-dash 2,990 (+2,741 duplicate from `Microsoft.Dashes`), spelling 1,482 (top words `repo`, `getff`, `npm`, `config`, `vendored`, `ESLint`), acronyms 1,288 (`NOT`, `USES`, `ADDS`, `SSOT` — uppercase emphasis and template labels), `ShipOveruse` 624 (the `**Ships to:**` template field), `Terms` 266 (`agent` → «personal digital assistant»). | per-rule sample of 6 hits × 26 rules, `samples.txt` |
| F4 | Real reader-comfort signal survives in few rules: `Microsoft.SentenceLength` 687 (5/6 sampled hits are genuinely long sentences), `Microsoft.Passive` 329 (4/6), and a handful of ai-tells rules (`LabelAndExplain`, `AnthropomorphicJustification`, `CataphoricForecasting`, 4–5/6). | same sample |
| F5 | Readability metrics flag almost every file: `FleschReadingEase < 70` on 194/196 (median 60.5 top-level, 54.4 reference); `FleschKincaid > 8` on 165/196 (median grade 9.6 / 10.2). A fixed threshold is therefore not a gate but a per-page metric. | `full.json` message parse |
| F6 | Tuned profile (21 rules off, 6 demoted, vocabulary of 99 terms with ≥3 hits): **5,525 alerts = 55 per 1,000 words**. Stratified 20-page sample (5 top-level + 15 reference across 8 family prefixes, seed 7, 9,517 words): 174 → 60 per 1,000 words; of 149 remaining error-level alerts, 56 % are vocabulary/casing residue, the rest a long tail of ai-tells figurative rules each ≤6 hits — uncalibrated. | `tuned.ini`, `tuned.json` |
| F7 | **No human baseline exists.** The 16 top-level pages were assumed human-reviewed (BS3 rounds); the operator states they approved nothing. The top-level vs reference comparison stays valid only as a fact about drafts (ai-tells non-punctuation density 19.7 vs 16.1 per 1,000 w; em-dash 23.1 vs 30.2). | operator, this session |
| F8 | Term drift across the drafts (files/hits): product name `getff` 81/318 vs `the framework` 65/92 vs `rules-as-tests` 20/54 vs `AI Factory` 9/24; `sub-agent` 22/47 vs `subagent` 14/68; `Claude Code` 51 files vs `CC` 31/96; `artefact` 16 vs `artifact` 39; `SSOT` 38 files vs spelled out 4. | `grep -l`/`grep -o` counts |
| F9 | Landing repo has NO hooks and NO markdown CI: no `.husky`, one workflow `deploy.yml`, one script `scripts/verify-search.mjs`, no markdownlint/vale config. Drafts already carry HTML comments (`<!-- provenance: … -->`) and build. | `ls`, `jq` on `package.json` |
| F10 | Framework precedents to reuse: markdownlint-cli2 at `.husky/pre-commit:100-113` with `.markdownlint.json` (SSOT #17 ADOPT); six `scripts/render-*.mjs --write/--check` over `packages/core/composition/fence.ts` (`findRegions`/`injectRegion`/`regionsMatch`); `render-rule-index.mjs --check` wired at pre-push and `audit-self.yml`; lychee offline on changed md at pre-push §8; escape-token grammar `ci-tool-pinning.md §3` (same line, reason ≥20 chars). | file reads |
| F11 | SSOT #18 (Vale) is DEFER with rationale «project mixes Russian + English prose; English-style preset FP ≥30% on Russian corpus»; revisit trigger «Vale ships a mixed-corpus profile with FP <10%». The site corpus is EN-only and generated, so the rationale does not apply; the row is re-evaluated, not re-litigated. | `docs/meta-factory/prior-art-evaluations.md` #18 |
| F12 | Upstream writer skill: `pfeff/claude-skills` `diataxis`, MIT, HEAD `657c61c5ca8c` (pushed 2026-09-12), installable via `claude plugin install pfeff/claude-skills`; ships quadrants + scaffold/write/audit operations + templates/anti-patterns; NO style guide inside. | `gh api` |
| F13 | Vale mechanics verified: `substitution` rules (the `Microsoft.Terms` shape) carry a forbidden→preferred map; `Vocab = <name>` accept lists; per-rule level overrides and `= NO` in `.vale.ini`; inline `<!-- vale off -->` / `<!-- vale on -->`. | `styles/` read + tuned run |

### Drill-downs

- **Why a generic «Vale clean» gate is impossible (F2, F5, F7):** at 160 alerts per 1,000 words
  every page fails; after tuning 55 remain, mostly unmeasured long-tail rules. A gate needs a
  measured false-positive rate; the only surface where one can be measured against a
  *reader-comfort* verdict is the 5 gold pages. Hence: gates are the tiny set that is
  false-positive-free by construction (typos against a vocabulary, forbidden synonyms from a
  curated list, broken links, markdown structure), everything else is a metric handed to the
  judgment layer.
- **Why ai-tells is dropped rather than tuned (F3, F7, Q-2):** its two loudest rules are
  punctuation the operator declared irrelevant; its remaining signal is a long tail of ≤6-hit
  figurative rules that cannot be calibrated on 20 pages; the umbrella's own D17b falsifier
  («ai-tells flags >30 % of approved pages → drop») is met by construction since no approved
  page exists to be clean. The three rules with real signal (F4) return only through the
  promotion seam (D-Q11) if the auditor documents incidents.
- **Why the glossary is the site's own page (D20 + P-D):** one file `content/docs/terms.md` is
  simultaneously the reader-facing glossary, the writer's source of names, and the input the
  Vale substitution style is rendered from. Two places for one term is the D12 failure.

## Decision

Three layers, one interface:

1. **Deterministic form layer** (free, runs at every channel): markdownlint (framework config
   copied), Vale profile `getff` (spelling with a vocabulary, generated forbidden-synonym
   substitution, sentence-length suggestion, readability metrics reported), lychee offline on
   changed markdown, and the `vale off` reason check. Gate = error-with-escape; everything else
   is a metric.
2. **Cold judgment layer:** the existing `claims-conformance-auditor` (facts) + a NEW
   `docs-form-auditor` (reader comfort, form, structure) — session-read agents with structured
   output, `GO | REVISE | STOP`, never in CI (`no-paid-llm-in-ci.md`).
3. **The reader-comfort criteria card**, per page kind — the single interface the writer skill
   follows, the form auditor fills, the three Opus review points apply, and the D26 refresh
   executor re-runs on the pages it touches.

### Live decision register

| Decision | Status | Resolution | Falsifier |
|---|---|---|---|
| D-Q1 The card's axis is reader comfort | decided (Q-2) | Five reader questions organise every criterion: FIND (right page, right place), UNDERSTAND (why before how, plain friendly English, progressive disclosure), DO (copy-ready executed example with real output), TRUST (true at the pin, honest limits), SAME WORDS (terms as defined). The umbrella's 10 draft criteria map onto these (§Criteria card); none is dropped, «AI twin clean» is consumed from D28. | An Opus review at any of the three points needs a criterion the card lacks → the card, not the reviewer, is the gap; add the reader question with a `Failure-scenario:`. |
| D-Q2 Gate set (what fails a commit) | decided (F2–F6) | ERROR: markdownlint (`.markdownlint.json` copied from the framework, SSOT #17), `Vale.Spelling` against `styles/config/vocabularies/getff/accept.txt`, `getff.Terms` (generated substitution, D-Q7), lychee offline on changed `.md`, a `vale off` without a ≥20-char reason. SUGGESTION (reported, never blocking): `Microsoft.SentenceLength`, `Microsoft.Passive`, `Microsoft.Contractions`, `Microsoft.Headings`, seven Readability metrics. OFF: ai-tells package, `Microsoft.Acronyms/Terms/Vocab/Avoid/Adverbs/Dashes/Semicolon/Quotes/Auto/Foreign/We/GeneralURL`. | Any ERROR-level rule shows ≥1 false positive on the 5 gold pages that is not a vocabulary miss → demote it to suggestion before family 1; a suggestion-level rule fires on 0 of 5 gold pages AND the form auditor never cites it in family 1 → drop it (it costs attention for nothing). |
| D-Q3 Punctuation and ai-tells | decided (Q-2, F7) | Em-dash, semicolon, colon and every ai-tells rule are OFF in the profile and absent from the skill as rules. The skill carries one craft sentence: «punctuation serves the reader; when a sentence needs a dash to hold together, split it». No count, no ban. | The gold-page Opus review marks ≥3 of 5 pages «hard to read» with sentences that a split would fix → `SentenceLength` is promoted per D-Q5, still not a punctuation rule. |
| D-Q4 Readability metrics | decided (F5) | `FleschReadingEase` and `FleschKincaid` are recorded per page in the form auditor's report. The target band is **initialised from the 5 gold pages after Opus `GO`** (min/max FRE, max FK grade) and stored in `styles/getff/README.md`; a page outside the band is a MINOR note, never a gate. Five other metrics stay off (on the sample SMOG/LIX/ColemanLiau/GunningFog/ARI flagged subsets of the files FRE already flags, so they add no page the two do not name). | A page inside the band is REVISEd for readability twice in family 1 → the band is not the signal; keep the metric as information only and stop noting it. |
| D-Q5 Sentence length | decided (F4) | v1 = suggestion at Vale's Microsoft default. Promotion rule (calibrated, not invented): after the gold `GO`, threshold := the longest sentence on the 5 gold pages rounded up to the next 5 words; from family 1 on, `SentenceLength` at that threshold is ERROR with the D-Q12 escape. | Gold pages carry a legitimate sentence longer than the threshold (a command line, a quoted error) → the escape covers it; if escapes exceed 1 per page on family 1 the threshold moves to the next 5. |
| D-Q6 Channel and home of the deterministic layer | decided (F9, F10) | Content lives in the landing repo, so the layer lives there: `scripts/docs-check.mjs` (single entry: markdownlint + Vale + lychee + `vale off` reason grep; `--changed` for hooks, full for CI) invoked from a NEW `.husky/pre-commit` in landing and from a NEW `docs-check.yml` workflow on `content/docs/**` (CI = last resort). Edit-time channel: the `docs-author` skill's done-checklist runs the same script on the page just written. Vale binary pinned by version + sha256 in the script (`ci-tool-pinning.md`). No paid LLM anywhere in it. | The umbrella moves site content into the framework repo → the layer moves to `.husky/pre-commit:100-113` and `audit-self.yml`, script unchanged; the landing `pre-commit` proves unreachable for the Fable session (hooks not installed in its checkout) → the CI job is the only gate and the skill's checklist becomes mandatory-with-evidence (the report file is committed). |
| D-Q7 Glossary contract | decided (D20, F8, F13) | `content/docs/terms.md` in landing IS the site glossary page. Two regions: (a) hand-written concept terms (definition = one sentence, owner page, `Do not use:` list) — definitions are claims → `claims-conformance-auditor`; (b) a fenced generated region for artifact names, filled from the D29 generator's name registry (`fence.ts` markers). `scripts/render-terms-style.mjs --write` renders `styles/getff/Terms.yml` (Vale `substitution`, level error) from every `Do not use:` entry; `--check` fails on drift (pre-commit + CI). Naming decisions taken now from F8: `getff` (only product name; `the framework`/`rules-as-tests`/`AI Factory` forbidden as names), `subagent`, `Claude Code` spelled out (`CC` forbidden), `artifact`, `SSOT` spelled out at first mention on a page (judgment, not a rule). | Two spellings of one term survive a sweep → the `Do not use:` list is the gap, add the pair (D20 falsifier); a forbidden synonym is needed inside a quoted command or error → the D-Q12 escape, never an accept-list entry. |
| D-Q8 `docs-author` skill shape | decided (D17, F12) | Thin project skill wrapping the installed `pfeff/claude-skills` `diataxis` plugin BY POINTER, pinned to `657c61c5ca8c`. Residue only (§Skill outline): page-kind templates from umbrella §2 with band/section skeletons, the criteria card, the craft contract, `terms.md` duty, D13 «execute the example at write time», the done-checklist, a `refresh` mode for the D26 executor, and `references/gold/` holding the 5 gold pages once they pass. Same skill on every seat (Fable session, aif task, human's agent). | Upstream unreachable at build or its SKILL.md changes shape → vendor the pinned tree under `references/upstream/` (MIT permits) and switch the pointer; the skill starts restating Diátaxis → `#parallel-evolution-creep`, cut it back to residue. |
| D-Q9 `docs-form-auditor` protocol | decided (D14c) | Shape of `agents/claims-conformance-auditor.md`: frontmatter `name/description/tools: Read, Glob, Grep, Bash`, Class B header, cold by construction (inputs = page paths + page kind + the card; never the writer's dialogue). Method: enumerate the population (T10), read every gold page, otherwise stratify by kind and sample at floor 5 per kind (T1/T9), RUN `scripts/docs-check.mjs` itself and quote the numbers, fill the card per page with `PASS | FAIL | N/A` and `file:line` evidence (T3), report clean-vs-low-coverage separately (T14). Explicit non-goal in its header: **never judges whether a statement about the product is true** — those go to `claims-conformance-auditor`. Output: per-page card table + `Overall: GO | REVISE | STOP` + readability numbers + a «card gaps» section. | The auditor finds nothing across 3 sweeps → retire it into the claims auditor's checklist (D14c falsifier); it starts asserting facts → strip `Bash` and add the fact ban to its examples. |
| D-Q10 Severity contract | decided (reviewer-discipline §6) | `REVISE` only on a `FAIL` that carries a `Failure-scenario:` naming the reader harm («a reader following step 3 gets output that differs from the shown block»); every other observation is a MINOR note that does not trigger a round. Gold pages: all 5 read, any FAIL with scenario → REVISE. Checkpoint/final: sample at floor 5 per kind; a FAIL pattern repeating on ≥2 sampled pages of one kind is reported as SYSTEMIC (skill/terms fix + regenerate), a single one as LOCAL (edit the page). Cap 2 REVISE rounds per review point, then `ESCALATED` to the umbrella seat (P-R: the plan holder decides). | A REVISE without a scenario is issued → it is `#findings-as-KPI`; the umbrella seat discards it; a scenario-bearing FAIL is ignored → the next incident record (D-Q11) opens. |
| D-Q11 Judgment → gate promotion seam | decided | A judgment criterion becomes a deterministic rule after **3 documented incidents in 6 months** (`attention-is-not-a-mechanism.md §3`, reused verbatim), each recorded as a research patch under `docs/meta-factory/research-patches/` (append-only, one per gap). Reverse seam: a gate rule with measured FP >10 % on a 20-page sample (SSOT #18 trigger reused) demotes to suggestion in the same PR that records the measurement. | Promotions happen without a patch → the rule is unbacked; the profile change is reverted until three patches exist. |
| D-Q12 Escape mechanism | decided (ci-tool-pinning §3) | Inline `<!-- vale off: <reason ≥20 chars> -->` … `<!-- vale on -->` for a span; the reason is checked by `docs-check.mjs` (a `vale off` without it is an ERROR). Standard route for a new legitimate word is a PR adding it to `accept.txt`, never an inline escape. `docs-refresh: deferred — <reason>` stays D26's token and is not reused here. | Escapes exceed 1 per page on family 1 → the rule being escaped is wrong, demote it (D-Q11 reverse seam), do not widen the escape. |
| D-Q13 Self-application | decided (invariant #2) | The skill and the agent are AI-facing docs → written under `.claude/skills/ai-doc/SKILL.md` (doc-authority header, `@harness-posture`, thin over `superpowers:writing-skills`). Both run through the same `docs-check.mjs` profile (their prose is English), and the Opus spec review applies the card's UNDERSTAND question to the skill itself: can a fresh seat write one page from it without asking. | The skill fails its own gate → fix the skill, never widen the profile; a fresh seat needs a clarification the skill does not answer → that sentence is the skill's next edit. |
| D-Q14 Gold page selection and calibration record | decided (D17c, D22) | One gold page per page kind (5 kinds = 5 pages): reference sheet, family overview and Guide from family 1 (B skills, first STRUCTURED family per D19), one Learn tutorial, one Understand page. After Opus `GO`: readability band (D-Q4), sentence threshold (D-Q5), and the per-kind «what good looks like» notes are written to `styles/getff/README.md` as the calibration record and the pages are copied into the skill's `references/gold/`. | A kind has no gold page → its band is uninitialised; the auditor reports `N/A`, never `PASS`; a gold page is later edited by a refresh → the copy in `references/gold/` is the frozen baseline, the live page is the moving one. |
| D-Q15 SSOT rows at build time | decided (build-vs-reuse) | Two new rows in the capability commit: «Vale on the EN-only generated docs corpus — ADAPT, tuned profile, measured 2026-09-14 (F2–F6)», citing #17 and #18 and leaving #18 DEFER for the mixed framework corpus; «pfeff/claude-skills diataxis — ADAPT by pointer, pinned». `Prior-art:` trailers on the commits. | A capability commit lands without the rows → pre-push `prior-art.ts` blocks it, by design. |

## The reader-comfort criteria card

Every criterion has a check type: `GATE(<check>)` = deterministic, fails the commit;
`JUDGE` = the form auditor and the Opus points; `CLAIMS` = the claims auditor. The umbrella's
draft criterion it absorbs is in brackets.

| # | Reader question | Criterion | Check | Kinds |
|---|---|---|---|---|
| C1 | FIND | The page sits where the IA says its kind lives and its title states the reader's goal or the artifact's name, nothing else [IA fit] | JUDGE | all |
| C2 | FIND | Sibling pages are linked from a fixed place (family overview ↔ sheets; tutorial → guide) and every link resolves at the pin [IA fit] | GATE(lychee) + JUDGE | all |
| C3 | UNDERSTAND | The first paragraph says what the reader gets and why it matters, before any mechanism [why before how] | JUDGE | all |
| C4 | UNDERSTAND | Plain friendly English: second person, short sentences, no unexplained acronym on first use; readability numbers reported against the gold band | GATE(spelling) + metric + JUDGE | all |
| C5 | UNDERSTAND | Progressive disclosure: the common case first, edge cases and internals after, callouts only for warnings the reader must not miss | JUDGE | all |
| C6 | DO | Every example is copy-ready, was executed at the pin, and shows its real output next to it [copy-ready, D13] | CLAIMS + JUDGE | reference, Learn, Guide |
| C7 | DO | An example lives once; other pages link to it, never paste it [one source, D12] | GATE(fence-hash dup check in `docs-check.mjs`) | all |
| C8 | TRUST | Every statement about behaviour is true at the pin [truth at pin] | CLAIMS | all |
| C9 | TRUST | Limits and non-goals are stated where the reader would otherwise assume more [honest limits] | JUDGE | reference, Guide, Understand |
| C10 | SAME WORDS | Terms are used as defined in `terms.md`, first mention linked; no forbidden synonym [glossary terms] | GATE(`getff.Terms`) + JUDGE (first-mention link) | all |
| C11 | (AI twin) | The `.md` twin / `llms.txt` contract holds | consumed from D28 | all |

Per-kind specifics (the required-section skeleton comes from umbrella §2; the form auditor
checks presence, the skill's template produces it):

- **Reference sheet** — bands in order: A fact card (generated fence, D29), B explanation
  (C3 applies to band B's first paragraph), C evidence (paths + test names at the pin). No
  selling language; JUDGE item: «would a reader who already decided to use this artifact
  find anything here they do not need?».
- **Family overview** — one table (generated) → one row per sheet, one «common cases» block
  of ready snippets (D13) that does not duplicate any sheet's example (C7), one paragraph on
  when NOT to reach for this family (C9).
- **Learn tutorial** — numbered steps; the first runnable step appears before any concept
  explanation; every step shows the real output the reader will see (C6); ends with «what you
  built» and one link forward.
- **Guide (how-to)** — goal in the title, prerequisites as a list, steps, a verification step
  the reader can run, then variations. JUDGE item: no concept teaching inside steps.
- **Understand (explanation)** — pain → mechanism → proof (link to the test or measurement)
  → honest limit, in that order; no steps, no snippets other than illustration.

## `docs-author` skill outline

```text
.claude/skills/docs-author/
  SKILL.md              # ≤150 lines: pointer to pfeff diataxis @657c61c5ca8c, when to use,
                        # the five reader questions, the craft contract, done-checklist,
                        # `refresh` mode (D26 executor: re-run the card on touched pages only)
  references/
    page-kinds.md       # five templates: required sections, band order, slot for example/diagram
    criteria-card.md    # the table above, verbatim (single source; the agent links here)
    craft.md            # openers, why-before-how, second person, progressive disclosure,
                        # callouts, one punctuation sentence (D-Q3); examples from gold pages
    terms.md            # POINTER to landing content/docs/terms.md (never a copy — P-D)
    gold/               # the 5 gold pages after Opus GO (frozen copies, D-Q14)
```

Done-checklist (the edit-time channel): example executed and output pasted → `terms.md`
first-mention links present → `node scripts/docs-check.mjs <page>` clean → card self-filled
in the commit body (`Card: C1 PASS … C11 N/A`) so the auditor can diff its own verdict against
the writer's. The checklist is prose for the writer; its detection lives in the hooks (D-Q6).

## `docs-form-auditor` outline

Frontmatter `name: docs-form-auditor`, `description` (triggers: gold-page review, family
checkpoint, final site check, D26 refresh on ≥5 pages), `tools: Read, Glob, Grep, Bash`.
Header: Class B; «reads pages cold, receives paths + kinds + the card path, never the writer's
dialogue; runs `docs-check.mjs` for numbers; **does not judge facts**». Method sections mirror
`agents/claims-conformance-auditor.md`: population → sampling (floor 5 per kind; all gold pages)
→ per-page card → clean-vs-low-coverage → output grammar:

```text
## Population   <N pages, per kind>
## Sample       <paths, stratification, seed>
## Numbers      <docs-check.mjs summary: errors 0, suggestions n, FRE/FK per page vs band>
## Cards        one table per page: C1..C11 → PASS | FAIL (+ Failure-scenario:) | N/A, file:line
## Patterns     SYSTEMIC (≥2 pages of one kind) vs LOCAL
## Card gaps    reader harms seen that no criterion names
## Overall      GO | REVISE | STOP   (REVISE requires ≥1 scenario-bearing FAIL)
```

## Vale calibration record (2026-09-14, landing `main` c091883)

| Profile | Alerts | Per 1,000 w | Error | Note |
|---|---|---|---|---|
| Default (Microsoft + Readability + ai-tells) | 16,375 | 160 | 10,722 | unusable as a gate on any page |
| Tuned (this spec's OFF/suggestion sets + 99-term vocabulary) | 5,525 | 55 | 1,317 | residue = long-tail ai-tells, unmeasured |
| Gate set only (D-Q2 ERROR rules, vocabulary applied) | to be re-run on the 5 gold pages | — | — | the only number that will ever gate |

Per-rule verdicts (6 sampled hits each): false-positive-dominated → `Acronyms`, `Terms`,
`Vocab`, `Avoid`, `Headings`, `ShipOveruse`, `FormalRegister`, `EnforcementMetaphors`,
`Spelling` (vocabulary); house style, irrelevant under Q-2 → `EmDashUsage`, `Dashes`,
`Semicolon`, `SemicolonUsage`, `ColonUsage`; friendly-tone helper kept as suggestion → `Contractions`; real signal → `SentenceLength`,
`Passive`, `LabelAndExplain`, `AnthropomorphicJustification`, `CataphoricForecasting`.
Human-approved baseline: **none** (F7). Working files: `tuned.ini`, `accept.txt`, `full.json`,
`tuned.json`, `calibration-note.md` in this session's scratchpad; the build commit copies
`tuned.ini` → landing `.vale.ini` and `accept.txt` → the vocabulary.

## Testing seams

- **Profile fixture:** `tests/docs-check/fixtures/` in landing holds one page per page kind with
  seeded defects (one typo, one forbidden synonym, one broken link, one `vale off` without
  reason, one duplicated fence) and one clean gold copy; `docs-check.mjs` must report exactly
  those five errors and zero on the clean page. Snapshot the JSON.
- **Terms render drift:** `render-terms-style.mjs --check` against a `terms.md` with an added
  `Do not use:` entry must fail; after `--write` must pass (`regionsMatch` precedent).
- **Escape reason:** a `vale off` with a 19-char reason fails, 20 passes (same fixture family).
- **Gate-set FP on gold:** the D-Q2 falsifier is a test: run the ERROR rules on the 5 gold
  pages after `GO`; any hit that is not a vocabulary miss is a failing assertion recorded in
  `styles/getff/README.md`.
- **Auditor self-run (T15):** the form auditor's first invocation is on the 5 gold pages with
  the writer's self-filled cards beside it; a disagreement on any criterion is the calibration
  finding, not a page defect.
- **Skill under its own gate (D-Q13):** `docs-check.mjs` over `.claude/skills/docs-author/**`
  and `agents/docs-form-auditor.md` runs in the framework's `audit-self.yml`.

## Consequences

- The Fable content session gets a fixed interface before writing: card, templates, terms,
  and a script that says «clean» in seconds; no page is judged against a moving target.
- Opus reviews are cheap and comparable: the same card at all three points, numbers from the
  same script, REVISE only with a scenario.
- Cost of being wrong is bounded: every rule in the gate set has a demotion path measured on
  20 pages, every judgment criterion a promotion path counted in incidents.
- What is NOT done: no ai-tells, no punctuation rules, no readability gate, no LLM in any hook
  or workflow, no second glossary, no vendored Diátaxis (until the falsifier fires).
- Build items for the Opus plan (P-R): landing `docs-check.mjs` + husky + workflow + Vale pin;
  `render-terms-style.mjs`; `terms.md` skeleton with the fence; skill + agent under `ai-doc`;
  SSOT rows; fixtures above.

## Prior art (pass 2026-09-14)

- SSOT #17 markdownlint-cli2 (ADOPT) — config reused as is; SSOT #18 Vale (DEFER, mixed
  corpus) — re-evaluated for the EN-only corpus, row stays for the framework.
- Vale packages Microsoft / Readability / ai-tells — fetched and RUN (F2–F6), not read about.
- `pfeff/claude-skills` `diataxis` (MIT) — fetched; umbrella D17 probe confirmed no style guide.
- Framework precedents: `claims-conformance-auditor.md` (auditor shape), `template-audit`
  P2/P3/P5 (session-bound advisory with promotion trigger), `render-*.mjs` + `fence.ts`
  (generated regions), `ci-tool-pinning.md §3` (escape token), `reviewer-discipline.md §6`
  (severity), `attention-is-not-a-mechanism.md §3` (promotion count), `ai-doc` (self-application).
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

- **Q-1** — «я ничего не одобрял» — no page has been human-approved; there is no human
  baseline, the 5 gold pages after Opus `GO` are the first one (F7, D-Q14).
- **Q-2** — «это не важно главное комфортность и удобство пользования документацией» — on
  dashes and semicolons: irrelevant; what matters is the comfort and ease of use of the
  documentation (D-Q1, D-Q3).
- **Q-3** — «Остальное да задача для тебя продумать как сделать лучше» — the remaining
  design forks are delegated to this seat; grilling closed after round 1 (all D-Q rows carry
  the seat's resolution + falsifier so the Opus review can overturn any of them with evidence).

## Changelog

_Awaiting round 1 (two cold seats, separate Opus session per D27). Dispositions:
`ACCEPTED | DISSOLVED | ESCALATED | FIXED`; cap 2 REVISE rounds._

## Items flagged UNVERIFIED for the bottom-up seat

- Whether landing pages stay `.md` (HTML comments work, F9) or become `.mdx`, where Vale's
  escape must be `{/* vale off: … */}` and `docs-check.mjs` must grep both forms.
- Whether the Fable content session's checkout of landing will have husky installed (D-Q6
  second falsifier) — decides if the CI job is the only reachable hook for the first pass.
- Whether the D29 generator exposes an artifact-name registry the `terms.md` fence can consume,
  or the fence must be filled from the family tables instead (D-Q7 region b).
