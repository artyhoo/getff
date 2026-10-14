# getff-ai-site S1 RUN — F2: generated rules (one task)

> **Umbrella:** [kickoff.md](kickoff.md). **Stage contract:** [kickoff-s1.md](kickoff-s1.md).
> **Class:** stage batch prompt. **Base branch:** staging. **Channel:** aif on project profiles.
> **Rigor label (L0):** research-grade — consumer-facing pages with source-backed enforcement claims.
> **Authoritative for:** F2's twenty-eight-page selection, boundaries and exit checks.
> **NOT authoritative for:** project goal ([README](../../../README.md#why-this-exists)),
> the stage contract, page-kind registry or other families.

**Inputs-ref:** `9868fe507910d4905cfae59cdac9cfea8ea716c2` (staging input, verified 2026-10-14).
All scope sources were read at this ref; inventory §3 is re-measured to the live 244-member
registry in the planning PR that carries this file. D19's one-family/one-task shape is INTACT
for F2: 26 sheets + 1 overview + 1 guide = 28 pages, inside the <=30-page budget. No operator
exception is invoked; the F1 two-batch split does not transfer.

## §0 Admission and order

S1 BUILD framework #1827, landing artyhoo/getff-landing#16 and RUN D #1850 are merged.
Batch-0 D17c is 0.0 (task `441880ad-f27a-4706-9527-5e6adcc33a03`, reviewIterationCount 0,
27 pages; recorded in #1850). F1 is fully delivered: F1a #2095, the #2096 source-canonicalization
refresh, F1b #2100 (squash `54c9e4c7fcbb`) and the all-30 overview #2101 (squash
`640a347efe34`). F1's family measurement is 32/16 = 2.0 < 2.1; the falsifier did not fire.
F1 → actual staging merge → F2. No parallel F2 tasks.

Before dispatch, derive F1b's and the overview's actual heads from their PRs, then run:
`gh pr list --search "is:merged head:<actual-head> base:staging" --json number,mergedAt,headRefName`
for each. Empty or unavailable result → HALT. Do not treat the planning PR for this kickoff
as F1 completion. In Phase 0, confirm all 30 F1 sheets, `docs/site/reference/F1.md` and
`docs/site/guides/check-your-framework-rules.md` exist at base.
Both this kickoff and the updated inventory MUST merge to staging before execution.

## §1 Page set — generated from inventory §3 in F2.json member order

| Page path                                     | Public slug                         | Kind              | Provenance                                           |
| --------------------------------------------- | ----------------------------------- | ----------------- | ---------------------------------------------------- |
| `docs/site/reference/F2.md`                   | `/docs/reference/F2/`               | `family-overview` | inventory §3 / F2.json family                        |
| `docs/site/reference/F2/ir1.md`               | `/docs/reference/F2/ir1/`           | `reference-sheet` | inventory §3 / F2.json member `IR1`                  |
| `docs/site/reference/F2/ir2.md`               | `/docs/reference/F2/ir2/`           | `reference-sheet` | inventory §3 / F2.json member `IR2`                  |
| `docs/site/reference/F2/ir3.md`               | `/docs/reference/F2/ir3/`           | `reference-sheet` | inventory §3 / F2.json member `IR3`                  |
| `docs/site/reference/F2/ir4.md`               | `/docs/reference/F2/ir4/`           | `reference-sheet` | inventory §3 / F2.json member `IR4`                  |
| `docs/site/reference/F2/ir5.md`               | `/docs/reference/F2/ir5/`           | `reference-sheet` | inventory §3 / F2.json member `IR5`                  |
| `docs/site/reference/F2/ir6.md`               | `/docs/reference/F2/ir6/`           | `reference-sheet` | inventory §3 / F2.json member `IR6`                  |
| `docs/site/reference/F2/r1.md`                | `/docs/reference/F2/r1/`            | `reference-sheet` | inventory §3 / F2.json member `R1`                   |
| `docs/site/reference/F2/r10.md`               | `/docs/reference/F2/r10/`           | `reference-sheet` | inventory §3 / F2.json member `R10`                  |
| `docs/site/reference/F2/r11.md`               | `/docs/reference/F2/r11/`           | `reference-sheet` | inventory §3 / F2.json member `R11`                  |
| `docs/site/reference/F2/r12.md`               | `/docs/reference/F2/r12/`           | `reference-sheet` | inventory §3 / F2.json member `R12`                  |
| `docs/site/reference/F2/r13.md`               | `/docs/reference/F2/r13/`           | `reference-sheet` | inventory §3 / F2.json member `R13`                  |
| `docs/site/reference/F2/r14.md`               | `/docs/reference/F2/r14/`           | `reference-sheet` | inventory §3 / F2.json member `R14`                  |
| `docs/site/reference/F2/r15.md`               | `/docs/reference/F2/r15/`           | `reference-sheet` | inventory §3 / F2.json member `R15`                  |
| `docs/site/reference/F2/r16.md`               | `/docs/reference/F2/r16/`           | `reference-sheet` | inventory §3 / F2.json member `R16`                  |
| `docs/site/reference/F2/r17.md`               | `/docs/reference/F2/r17/`           | `reference-sheet` | inventory §3 / F2.json member `R17`                  |
| `docs/site/reference/F2/r18.md`               | `/docs/reference/F2/r18/`           | `reference-sheet` | inventory §3 / F2.json member `R18`                  |
| `docs/site/reference/F2/r19.md`               | `/docs/reference/F2/r19/`           | `reference-sheet` | inventory §3 / F2.json member `R19`                  |
| `docs/site/reference/F2/r2.md`                | `/docs/reference/F2/r2/`            | `reference-sheet` | inventory §3 / F2.json member `R2`                   |
| `docs/site/reference/F2/r20.md`               | `/docs/reference/F2/r20/`           | `reference-sheet` | inventory §3 / F2.json member `R20`                  |
| `docs/site/reference/F2/r3.md`                | `/docs/reference/F2/r3/`            | `reference-sheet` | inventory §3 / F2.json member `R3`                   |
| `docs/site/reference/F2/r4.md`                | `/docs/reference/F2/r4/`            | `reference-sheet` | inventory §3 / F2.json member `R4`                   |
| `docs/site/reference/F2/r5.md`                | `/docs/reference/F2/r5/`            | `reference-sheet` | inventory §3 / F2.json member `R5`                   |
| `docs/site/reference/F2/r6.md`                | `/docs/reference/F2/r6/`            | `reference-sheet` | inventory §3 / F2.json member `R6`                   |
| `docs/site/reference/F2/r7.md`                | `/docs/reference/F2/r7/`            | `reference-sheet` | inventory §3 / F2.json member `R7`                   |
| `docs/site/reference/F2/r8.md`                | `/docs/reference/F2/r8/`            | `reference-sheet` | inventory §3 / F2.json member `R8`                   |
| `docs/site/reference/F2/r9.md`                | `/docs/reference/F2/r9/`            | `reference-sheet` | inventory §3 / F2.json member `R9`                   |
| `docs/site/guides/check-a-generated-rule.md`  | `/docs/guides/check-a-generated-rule/` | `guide`        | inventory §4 `<family-F2>` / D19                    |

Exactly 28 pages: the overview, all 26 sheets, and the guide — the complete F2 family.
The only permitted non-page edit is replacing inventory §4's literal `<family-F2>` token
with `check-a-generated-rule` in the SAME commit that writes the guide. Never alter other rows.
The guide is admitted on measured evidence (all commands observed at the Inputs-ref):
`npm --prefix packages/core run render-rules:check` exits 0 ("rules-table region is
up-to-date"; the same invocation re-validates the manifest against its JSON schema first),
`npm --prefix packages/core run test:synthesizer` passes 24 files / 201 tests, and every
manifest entry is readable via `node -e` with `check.type` of `eslint` (13 entries, a named
rule id), `command` (8), `script` (3) or `manual` (2: IR5, IR6 — the honest no-runnable-check
case). The guide walks one entry from manifest read to check-type-specific verification
inside the framework clone. It MUST NOT instruct running
`packages/core/synthesizer/run-generated-rule-mutation.sh` (it consumes a consumer-emitted
`.ai-factory/synthesizer-output/rules-manifest-additions.json` whose entries carry
`check.selector`; the core manifest's 26 entries carry `check.{rule,command,script}` — zero
selectors — so the run degrades to skip), `packages/core/audit-self/check-generated-rule-mutation.sh`
(install-time self-verify, consumer root), or any `getff` CLI subcommand (the CLI surface is
init/--version/--help only). Those live on sheets only as named consumer-side checks with
paths, never as runnable steps in this repo. No invented command.

## §2 Writing contract and boundaries

Use `docs-author` in this worker, with its kind registry, criteria card, craft contract and
per-page done-checklist. Read the gold `reference-sheet` pages `docs/site/reference/B/dispatcher.md`
and `docs/site/reference/B/harvest.md`, the overview `docs/site/reference/B.md`, and the guide
`docs/site/guides/add-design-and-review-skills.md` before writing. The merged F1 pages are the
closest same-kind siblings: read `docs/site/reference/F1.md`, at least three F1 sheets
(including one manual-adjacent Class-C-honest page, e.g. `F1/effort-worthiness.md`), and the
F1 guide `docs/site/guides/check-your-framework-rules.md` as the guide exemplar.
Read each member's actual manifest entry — `packages/core/manifest/rules-manifest.json` at the
member's `source.line`: `title`, `stack`, `check` (type + rule/command/script/manual), `examples`
(bad/good), `policy`, and where present `negative-test` / `fixture.setup-script` (R1, R4, R17,
R19 only). State the check channel honestly per `check.type`: an `eslint` entry names its rule
id and where it is placed (preset configs / consumer install); a `command` entry names where
the command runs (CI job / consumer lane); a `script` entry names its script path; a `manual`
entry says plainly that no runnable check exists and what would build one. Explain
framework-only delivery honestly: F2 members carry `shipsTo.tier: framework`; do not promise
installation into consumer projects. Never invent a gate.

Band A cards must be generated from the F2 registry using the EXISTING exported
`renderCardFence` in `scripts/render-reference.mjs`: in a scratch directory write one
`<entry>/member.json` per selected member with `{...member, family: 'F2'}`, then call
`renderCardFence(scratchDir, entry)`. Insert those returned bytes, never author card fields.
This is a transient adapter, not a new shipped generator. Compare every selected page's
`F2-card-<name>` fence byte-for-byte with that export before commit and in the report.
The main CLI `--check` does NOT verify sheet-card fences (measured at the input SHA);
quote both the explicit card comparison and the main renderer check, not the latter alone.
For the overview use the existing `F2-table` region and `--write`, which fills existing
family overview pages. `sources:` must include the real source dependencies and evidence;
main `--write` does not derive sheet `sources:` at this input SHA. Record this known gap,
include every code/prose source actually cited (the manifest entry and its line anchor are
the primary source of every sheet), and check it through `docs-check`.

Write only the page paths enumerated in §1. No other family's pages, gold pages, glossary,
landing files, specs, hooks, settings, gate code, generator code or dependencies are in scope.
Reuse existing glossary terms. If a required new term or generator/source correction would
need an out-of-scope file, park it instead of widening the task. Renderer output outside
§1 must be inspected: report pre-existing drift; never commit unrelated regeneration.
No I, A, C, E, F3, G or H work and no S2 cutover. English artifacts only.

## §3 Phase 0 — verify before production work

Record branch, HEAD and `git status --short`. Confirm an isolated task worktree on staging.
Read `kickoff-s1.md` §0, §2, §5, §7 and §11; its eleven non-negotiables remain binding.
Re-walk this prompt's inputs at the actual base (do not trust old line numbers).
Run `bash scripts/host-verify.sh <this-kickoff-path>` in PATH form and quote every result.
Reconcile §1 against `F2.json` (26 members, order IR1-IR6, R1, R10-R19, R2, R20, R3-R9) and
inventory rows; a missing/new member parks this task. Confirm every §1 manifest `source.line`
resolves to its member's entry in `packages/core/manifest/rules-manifest.json` (26/26);
a stale line anchor is a finding to fix in the page, never in the manifest or registry.
Run the renderer's `--check` baseline; record and separate pre-existing failures from
introduced failures. Enumerate findings with dispositions, never a bare self-check OK.
Run a scratch generation of one selected card through `renderCardFence` BEFORE writing.
Do not treat a green input-presence check as acceptance of pages that do not exist yet.

## §4 Exit criteria and last acts before each commit

1. Exactly all twenty-eight §1 pages exist with their registered kinds. No unlisted page is touched.
2. Every example is executed at this base and its real output captured. Scratch demonstrations
   show cleanup; preserve captured bytes even when style rules prefer different words.
3. Use `node scripts/docs-check.mjs <all-twenty-eight-page-paths>`; show a non-vacuous 28-page run,
   with no ERROR. Missing external binaries are reported, not represented as strict PASS.
4. Generate the selected cards through `renderCardFence`, compare their fence bytes, and quote
   selected/compared counts = 26/26. Review `sources:` against each evidence anchor.
5. Run `node scripts/render-reference.mjs --write` as the last content-generation act, then
   `--check`. Repeat `--write`; the second run must introduce no further diff.
6. Quote `bash scripts/check-ask-files.sh`, the host-verify PATH run, the applicable repo gates
   and the literal `Docs-card:` trailer for C1–C13 per docs-author. Use the approved skip only
   with its real reason. Do not bypass hooks or silently relax a gate.
7. Report per-page REVISE events, total rounds and mean REVISE rounds per page (denominator 28).
   This is follow-on evidence, not a replacement for batch-0's recorded 0.0 / threshold 2.1.
8. Before harvest, the host runs `bash scripts/run-local-ci-sweep.sh` on the final diff and
   repeats the page/card/render checks. Cold `docs-form-auditor` and
   `claims-conformance-auditor` inspect at least five sheets spread across the selected set
   and ALL available overview/guide pages in this batch. Record inputs-ref and findings.
9. The final REPORT must name DONE|PARTIAL|BLOCKED, page paths/counts, commits, all gate
   outputs, per-page measurement, initial findings/dispositions and any parked question.
   Cold fidelity and actual staging merge remain mandatory before advancing the next family.

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
test -f docs/site/reference/F2.json
test -f packages/core/manifest/rules-manifest.json
test -f docs/site/reference/B/dispatcher.md
test -f docs/site/reference/B/harvest.md
test -f docs/site/reference/B.md
test -f docs/site/guides/add-design-and-review-skills.md
test -f docs/site/guides/check-your-framework-rules.md
test -f docs/site/reference/F1.md
test -f .claude/skills/docs-author/SKILL.md
test -f .claude/skills/docs-author/references/page-kinds.md
test -f agents/docs-form-auditor.md
test -f agents/claims-conformance-auditor.md
test -f agents/fidelity-auditor.md
test -f scripts/render-reference.mjs
test -f scripts/docs-check.mjs
test -f scripts/run-local-ci-sweep.sh
node --input-type=module -e "import {readFileSync} from 'node:fs'; const d=JSON.parse(readFileSync('docs/site/reference/F2.json')); if(d.members.length!==26) process.exit(1);"
bash scripts/check-ask-files.sh
```

## §6 AI traps and self-application

See [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md).
Active traps: **T1**, **T2**, **T3**, **T8**, **T10**, **T14**, **T15**, **T19**, **T21**.
T1/T10: enumerate all twenty-eight pages before sampling; cold-review at least five sheets.
T2/T3: run checks and examples, quote counts/output, verify claims against actual sources.
T8: read the binding stage contract before asking. T14: incomplete coverage is not clean.
T15: audit this prompt's own population, source claims and commands before following it.
T19: cold review of the final diff precedes harvest. T21: the backward sweep covers sibling
channels named by each documented rule, not just the pages changed here.

**T-F2-A — mutation-script misapplied as a repo-side demo:** `run-generated-rule-mutation.sh`
probes `check.selector` and defaults to a consumer-emitted manifest that does not exist in
this clone; a green/skip run against the core manifest proves nothing. The guide and sheets
never present it as runnable here.
**T-F2-B — check-type misread as enforcement:** an `eslint`-type entry's rule fires in the
preset/consumer install, not by existing in the manifest; a `manual` entry (IR5, IR6) is the
Class-C analog — state the channel, never claim a gate the tree does not carry.
**T-F2-C — registry line anchors trusted blindly:** a sheet citing `rules-manifest.json:<line>`
without resolving it at base can drift silently; Phase 0's 26/26 anchor check is the counter.
