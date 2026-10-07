# getff-ai-site S1 RUN — F1b: rules batch 2/2

> **Umbrella:** [kickoff.md](kickoff.md). **Stage contract:** [kickoff-s1.md](kickoff-s1.md).
> **Class:** stage batch prompt. **Base branch:** staging. **Channel:** aif on project profiles.
> **Rigor label:** research-grade — consumer-facing pages with source-backed enforcement claims.
> **Authoritative for:** F1b's sixteen-page selection, boundaries and exit checks.
> **NOT authoritative for:** project goal ([README](../../../README.md#why-this-exists)),
> the stage contract, page-kind registry or other families.

**Inputs-ref:** `41cc5642f3a625be89dc3dd3abf1f7e4ec91ae96` (origin/staging, 2026-10-07).
All scope sources were read at this ref; inventory §3 is refreshed from those JSONs in this PR.
The operator approved two sequential 16-page tasks on 2026-10-07: a scoped exception to D19's
one-family/one-task shape that retains the <=30-page review budget and all 32 F1 pages.
D19 remains unchanged for every other family; this prompt cannot amend it generally.

## §0 Admission and order

S1 BUILD framework #1827, landing artyhoo/getff-landing#16 and RUN D #1850 are merged.
Batch-0 D17c is 0.0 (task `441880ad-f27a-4706-9527-5e6adcc33a03`, reviewIterationCount 0,
27 pages; recorded in #1850). The >2.1 falsifier did not fire; GLM conveyor continues.
F1a → actual staging merge → F1b → actual staging merge → F2. No parallel F1 tasks.
Both kickoff files and the updated inventory MUST merge to staging before execution.

Before dispatch, derive F1a's actual head from its task record/PR, then run:
`gh pr list --search "is:merged head:<actual-F1a-head> base:staging" --json number,mergedAt,headRefName`.
Empty or unavailable result → HALT. Do not treat the planning PR for this kickoff as F1a completion.
In Phase 0, confirm all fifteen F1a sheets and `docs/site/reference/F1.md` exist at base.

## §1 Page set — generated from inventory §3 in F1.json member order

| Page path                                                      | Public slug                                              | Kind              | Provenance                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| `docs/site/reference/F1/git-conflict-merge-forward.md`         | `/docs/reference/F1/git-conflict-merge-forward/`         | `reference-sheet` | inventory §3 / F1.json member `git-conflict-merge-forward`         |
| `docs/site/reference/F1/kickoff-staging-placement.md`          | `/docs/reference/F1/kickoff-staging-placement/`          | `reference-sheet` | inventory §3 / F1.json member `kickoff-staging-placement`          |
| `docs/site/reference/F1/language-discipline.md`                | `/docs/reference/F1/language-discipline/`                | `reference-sheet` | inventory §3 / F1.json member `language-discipline`                |
| `docs/site/reference/F1/memory-codification.md`                | `/docs/reference/F1/memory-codification/`                | `reference-sheet` | inventory §3 / F1.json member `memory-codification`                |
| `docs/site/reference/F1/no-paid-llm-in-ci.md`                  | `/docs/reference/F1/no-paid-llm-in-ci/`                  | `reference-sheet` | inventory §3 / F1.json member `no-paid-llm-in-ci`                  |
| `docs/site/reference/F1/parallel-subwave-isolation.md`         | `/docs/reference/F1/parallel-subwave-isolation/`         | `reference-sheet` | inventory §3 / F1.json member `parallel-subwave-isolation`         |
| `docs/site/reference/F1/phase-research-coverage.md`            | `/docs/reference/F1/phase-research-coverage/`            | `reference-sheet` | inventory §3 / F1.json member `phase-research-coverage`            |
| `docs/site/reference/F1/recommendation-laziness-discipline.md` | `/docs/reference/F1/recommendation-laziness-discipline/` | `reference-sheet` | inventory §3 / F1.json member `recommendation-laziness-discipline` |
| `docs/site/reference/F1/research-source-trust.md`              | `/docs/reference/F1/research-source-trust/`              | `reference-sheet` | inventory §3 / F1.json member `research-source-trust`              |
| `docs/site/reference/F1/reviewer-discipline.md`                | `/docs/reference/F1/reviewer-discipline/`                | `reference-sheet` | inventory §3 / F1.json member `reviewer-discipline`                |
| `docs/site/reference/F1/rule-enforcement-channel-selection.md` | `/docs/reference/F1/rule-enforcement-channel-selection/` | `reference-sheet` | inventory §3 / F1.json member `rule-enforcement-channel-selection` |
| `docs/site/reference/F1/seat-lifecycle.md`                     | `/docs/reference/F1/seat-lifecycle/`                     | `reference-sheet` | inventory §3 / F1.json member `seat-lifecycle`                     |
| `docs/site/reference/F1/skill-description-quality.md`          | `/docs/reference/F1/skill-description-quality/`          | `reference-sheet` | inventory §3 / F1.json member `skill-description-quality`          |
| `docs/site/reference/F1/source-before-shape.md`                | `/docs/reference/F1/source-before-shape/`                | `reference-sheet` | inventory §3 / F1.json member `source-before-shape`                |
| `docs/site/reference/F1/zcode-parity-doctrine.md`              | `/docs/reference/F1/zcode-parity-doctrine/`              | `reference-sheet` | inventory §3 / F1.json member `zcode-parity-doctrine`              |
| `docs/site/guides/check-your-framework-rules.md`               | `/docs/guides/check-your-framework-rules/`               | `guide`           | inventory §4 `<family-F1>` / D19                                   |

Exactly 16 pages. The two selections are disjoint and their union is all 30 F1 sheets + overview + guide.
The only permitted non-page edit is replacing inventory §4's literal `<family-F1>` token
with `check-your-framework-rules` in the SAME commit that writes the guide. Never alter other rows.
The guide helps framework contributors locate a rule, read class/channel evidence and run an
existing applicable check; it does not promise a consumer installation of framework rules.

## §2 Writing contract and boundaries

Use `docs-author` in this worker, with its kind registry, criteria card, craft contract and
per-page done-checklist. Read the gold `reference-sheet` pages `docs/site/reference/B/dispatcher.md`
and `docs/site/reference/B/harvest.md`, the overview `docs/site/reference/B.md`, and the guide
`docs/site/guides/add-design-and-review-skills.md` before writing.
Read each rule's actual `.claude/rules/<name>.md`, its index row and the named enforcement
code/tests at your base. Explain framework-only delivery honestly: F1 members currently
carry `shipsTo.tier: framework`; do not promise installation into consumer projects.
Class C remains prose-only unless the actual source proves a mechanism. Never invent a gate.

Band A cards must be generated from the F1 registry using the EXISTING exported
`renderCardFence` in `scripts/render-reference.mjs`: in a scratch directory write one
`<entry>/member.json` per selected member with `{...member, family: 'F1'}`, then call
`renderCardFence(scratchDir, entry)`. Insert those returned bytes, never author card fields.
This is a transient adapter, not a new shipped generator. Compare every selected page's
`F1-card-<name>` fence byte-for-byte with that export before commit and in the report.
The main CLI `--check` does NOT verify sheet-card fences (measured at the input SHA);
quote both the explicit card comparison and the main renderer check, not the latter alone.
For the overview use the existing `F1-table` region and `--write`, which fills existing
family overview pages. `sources:` must include the real source dependencies and evidence;
main `--write` does not derive sheet `sources:` at this input SHA. Record this known gap,
include every code/prose source actually cited, and check it through `docs-check`.

Write only the page paths enumerated in §1. No other family's pages, gold pages, glossary,
landing files, specs, hooks, settings, gate code, generator code or dependencies are in scope.
Reuse existing glossary terms. If a required new term or generator/source correction would
need an out-of-scope file, park it instead of widening the task. Renderer output outside
§1 must be inspected: report pre-existing drift; never commit unrelated regeneration.
No F2 or I work and no S2 cutover. English artifacts only.

## §3 Phase 0 — verify before production work

Record branch, HEAD and `git status --short`. Confirm an isolated task worktree on staging.
Read `kickoff-s1.md` §0, §2, §5, §7 and §11; its eleven non-negotiables remain binding.
Re-walk this prompt's inputs at the actual base (do not trust old line numbers).
Run `bash scripts/host-verify.sh <this-kickoff-path>` in PATH form and quote every result.
Reconcile §1 against `F1.json` and inventory rows; a missing/new member parks this task.
Run the renderer's `--check` baseline; record and separate pre-existing failures from
introduced failures. Enumerate findings with dispositions, never a bare self-check OK.
Run a scratch generation of one selected card through `renderCardFence` BEFORE writing.
Do not treat a green input-presence check as acceptance of pages that do not exist yet.

## §4 Exit criteria and last acts before each commit

1. Exactly all sixteen §1 pages exist with their registered kinds. No unlisted page is touched.
2. Every example is executed at this base and its real output captured. Scratch demonstrations
   show cleanup; preserve captured bytes even when style rules prefer different words.
3. Use `node scripts/docs-check.mjs <all-sixteen-page-paths>`; show a non-vacuous 16-page run,
   with no ERROR. Missing external binaries are reported, not represented as strict PASS.
4. Generate the selected cards through `renderCardFence`, compare their fence bytes, and quote
   selected/compared counts = 15/15. Review `sources:` against each evidence anchor.
5. Run `node scripts/render-reference.mjs --write` as the last content-generation act, then
   `--check`. Repeat `--write`; the second run must introduce no further diff.
6. Quote `bash scripts/check-ask-files.sh`, the host-verify PATH run, the applicable repo gates
   and the literal `Docs-card:` trailer for C1–C13 per docs-author. Use the approved skip only
   with its real reason. Do not bypass hooks or silently relax a gate.
7. Report per-page REVISE events, total rounds and mean REVISE rounds per page (denominator 16).
   This is follow-on evidence, not a replacement for batch-0's recorded 0.0 / threshold 2.1.
8. Before harvest, the host runs `bash scripts/run-local-ci-sweep.sh` on the final diff and
   repeats the page/card/render checks. Cold `docs-form-auditor` and
   `claims-conformance-auditor` inspect at least five sheets spread across the selected set
   and ALL available overview/guide pages in this batch. Record inputs-ref and findings.
9. The final REPORT must name DONE|PARTIAL|BLOCKED, page paths/counts, commits, all gate
   outputs, per-page measurement, initial findings/dispositions and any parked question.
   Cold fidelity and actual staging merge remain mandatory before advancing the next batch.

## §4c Park-don't-guess

On any genuine scope/design ambiguity, do NOT pick. Park it as a question with
`manualReviewRequired` / `blocked_external`, stating Option A → consequence X / Option B →
consequence Y, and stop that task. Report the park in the payload and PR Parked questions;
no new park-record file is allowed. Work only on unambiguous scope until the stop is recorded.
Keep runtime profile/model overrides unset; use the project's configured executor.

## §5 Host-verify inputs

```bash host-verify
test -f .claude/orchestrator-prompts/getff-ai-site/kickoff-s1.md
test -f .claude/orchestrator-prompts/getff-ai-site/kickoff-s1.inventory.md
test -f docs/site/reference/F1.json
test -f docs/site/reference/B/dispatcher.md
test -f docs/site/reference/B/harvest.md
test -f docs/site/reference/B.md
test -f docs/site/guides/add-design-and-review-skills.md
test -f .claude/skills/docs-author/SKILL.md
test -f .claude/skills/docs-author/references/page-kinds.md
test -f agents/docs-form-auditor.md
test -f agents/claims-conformance-auditor.md
test -f agents/fidelity-auditor.md
test -f scripts/render-reference.mjs
test -f scripts/docs-check.mjs
test -f scripts/run-local-ci-sweep.sh
node --input-type=module -e "import {readFileSync} from 'node:fs'; const d=JSON.parse(readFileSync('docs/site/reference/F1.json')); if(d.members.length!==30) process.exit(1);"
bash scripts/check-ask-files.sh
```

## §6 AI traps and self-application

See [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md).
Active traps: **T1**, **T2**, **T3**, **T8**, **T10**, **T14**, **T15**, **T19**, **T21**.
T1/T10: enumerate all sixteen pages before sampling; cold-review at least five sheets.
T2/T3: run checks and examples, quote counts/output, verify claims against actual sources.
T8: read the binding stage contract before asking. T14: incomplete coverage is not clean.
T15: audit this prompt's own population, source claims and commands before following it.
T19: cold review of the final diff precedes harvest. T21: the backward sweep covers sibling
channels named by each documented rule, not just the pages changed here.

**T-F1-A — class mistaken for enforcement:** a Class C rule's prose does not become a
mechanical gate because the page calls it enforced; state the class and real channel.
**T-F1-B — generator check mistaken for card check:** the main `--check` verifies JSONs and
family tables, not per-sheet cards; compare against `renderCardFence` explicitly.
**T-F1-C — partial family mistaken for complete:** F1a is only half the family; do not link
from its overview to absent F1b sheets or claim F1 complete before both PRs merge.
