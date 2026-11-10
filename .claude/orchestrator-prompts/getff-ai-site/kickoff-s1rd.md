# getff-ai-site S1 RUN — batch 0: family D (hooks)

> **Umbrella:** [kickoff.md](kickoff.md) — §2 non-negotiables and §3 name census are binding.
> **Stage contract:** [kickoff-s1.md](kickoff-s1.md) — §0 (BUILD/RUN split), §2 (inventory
> obligation), §5 (the render arm), §7 (last acts) are BINDING and deliberately not restated here.
> **Class:** stage batch prompt (dispatch input; stage-family name, `STAGE_KICKOFF_RE`).
> **Rigor label (effort-worthiness L0):** `research-grade` — this batch writes 27
> consumer-facing pages for getff.ai and is the D17c measurement batch whose number decides
> the executor of every remaining family; consumer-shipped and decision-bearing.
> **Base branch:** `staging`. **Channel:** aif on GLM (D19/P-P; umbrella non-negotiable 6).
> **Authoritative for:** the family-D batch's page set, few-shot anchors, the D17c batch-0
> measurement obligation, and this batch's exit criteria.
> **NOT authoritative for:** project goal — see
> [README.md#why-this-exists](../../../README.md#why-this-exists); the stage contract —
> [kickoff-s1.md](kickoff-s1.md); the `kind:` registry — D30's
> [page-kinds.md](../../skills/docs-author/references/page-kinds.md); the page population —
> [kickoff-s1.inventory.md](kickoff-s1.inventory.md).

**Measurement SHA for every `path:line` below:** `origin/staging` =
`c16c432edc1aa3ca9df620a4d804a7c68e6a7e5d` (#1848, 2026-09-25). The inventory's population-2
rows were REGENERATED at this SHA in the same commit that lands this file (the §7 drift
falsifier fired: `D.json` gained `glossary-inject` after `d266fdf01ea`); the page set below is
that regenerated list — 26 rows, not 25.

## §0 Why this batch, and why it is the measurement batch

BUILD is green: the framework gates merged (#1827) and the landing `pages-build` gate is green
against the production config (draft PR artyhoo/getff-landing#16 — draft by design, S2 merges
it). RUN is therefore unblocked (stage contract §0). D19's order is STRUCTURED families first —
B (gold, written in S0b) → **D (this batch)** → F1 → F2 → I; PARTIAL families stay gated on
their D14d source holes. This batch is **batch 0**: the D17c REVISE-rate measurement runs on it
(stage contract §6, denominator `mean REVISE rounds per page`, gold figure **1.05**; >2× — i.e.
>2.1 — sends this family and the next back to a Fable chip and becomes the exchange rate).

**One aif task, not several.** D19: «each = overview + sheets + its guide in ONE aif task
(~20 pages)». This batch is 26 inventory rows + the guide = 27 pages, under D19's >30-pages
falsifier ceiling. Do not split it; do not pull F1 pages into it.

## §1 The page set — 26 rows from the inventory §3 (regenerated at `c16c432edc1`)

`docs/site/reference/D.json` `familyName: hooks`, 25 members. Files live under
`docs/site/reference/D/`; every sheet carries `kind: reference-sheet` frontmatter, the overview
carries `kind: family-overview`.

1. `/docs/reference/D/` — `family-overview` (the family index page)
2. `/docs/reference/D/adopt-orchestrator-prompts/`
3. `/docs/reference/D/ask-question-reminder/`
4. `/docs/reference/D/check-doc-authority/`
5. `/docs/reference/D/check-doc-authority-header/`
6. `/docs/reference/D/check-hook-marker/`
7. `/docs/reference/D/check-kickoff-traps/`
8. `/docs/reference/D/check-worker-dispatch-channel/`
9. `/docs/reference/D/deps-hash-check/`
10. `/docs/reference/D/end-of-turn-reminder/`
11. `/docs/reference/D/glossary-inject/` (new member at `c16c432edc1` — its hook source is
    `.claude/hooks/glossary-inject.sh`; read the file, do not infer from the name)
12. `/docs/reference/D/inject-handoff-on-compact/`
13. `/docs/reference/D/inject-matching-rule/`
14. `/docs/reference/D/inject-memory-codification/`
15. `/docs/reference/D/inject-output-language/`
16. `/docs/reference/D/inject-project-digest/`
17. `/docs/reference/D/inject-session-bootstrap/`
18. `/docs/reference/D/inject-subagent-context/`
19. `/docs/reference/D/inject-subagent-digest/`
20. `/docs/reference/D/precompact-residue/`
21. `/docs/reference/D/runtime-bridge-dispatch/`
22. `/docs/reference/D/session-start/`
23. `/docs/reference/D/validate-prompt/`
24. `/docs/reference/D/warn-subagent-report/`
25. `/docs/reference/D/warn-subagent-report-zcode/`
26. `/docs/reference/D/worktree-setup/`

Plus the family guide — inventory §4 token row `/docs/guides/<family-D>/`, `kind: guide`. The
`<family-D>` token is replaced with the final slug **in the same commit that writes the page**
(stage contract §7 item 2). **No page outside this set.** A page merged from this batch that
matches no inventory row is the D49 (a) defect — fix the generation, never the page; here the
generation IS this list, so the defect cannot be discharged by editing pages.

## §2 How to write — binding pointers, not restatements

- **`docs-author` skill on this seat** (D-Q8 «same skill on every seat»; stage §11 names it in
  EVERY S1 RUN worker prompt — this is that mention). Its registry, reader-comfort card, craft
  contract and done-checklist are the writing interface; its deterministic gate is
  `scripts/docs-check.mjs`. `kind:` values come from D30's closed seven — a page that fits none
  escalates to D30, never a new word.
- **Few-shot (D24(3), «few-shot from the gold page of its kind»):** the family-B gold sheets —
  start from [`docs/site/reference/B/dispatcher.md`](../../../docs/site/reference/B/dispatcher.md)
  and [`docs/site/reference/B/harvest.md`](../../../docs/site/reference/B/harvest.md)
  (`reference-sheet` gold, S0b) and the gold guide
  [`docs/site/guides/add-design-and-review-skills.md`](../../../docs/site/guides/add-design-and-review-skills.md)
  (`guide` gold, the D17c trial page). Read them before writing; they are the shape.
- **Sheet content comes from the hook's real source**, read at your base: each member's
  mechanics, fires-on conditions, channels and settings live in `.claude/hooks/<name>.sh` (and
  its twin/tests where present) — cite what the code does, never what a doc claims it does
  (T3). The generator fences and `sources:` are DERIVED by the renderer (stage §5): author the
  page around them, never inside them.
- **The render arm is the last act of every commit** (stage §5/§7 item 1):
  `npx tsx scripts/render-reference.mjs --write` — nothing fills the fences anywhere else, and
  `--check` at pre-push/audit-self is the first channel that sees the drift.

## §3 Exit criteria for this batch (all required)

1. `scripts/docs-check.mjs` green over every page of this batch (the deterministic half of
   D17b).
2. `npx tsx scripts/render-reference.mjs --write` idempotent at HEAD — a second run produces a
   clean tree (stage §5).
3. Every row of §1 above exists as a page; the guide row's token replaced in the same commit;
   no other page touched.
4. The repo's own gates green on the diff (`bash scripts/run-local-ci-sweep.sh` on the harvest
   seat; the pre-push arm runs `docs-check` + referenceRender `--check`).
5. **The D17c batch-0 measurement recorded in the task report:** total review rounds this task
   took, per-page REVISE events, and the computed `mean REVISE rounds per page` — the number
   the >2.1 falsifier is evaluated against. Without this number the batch is not done, even if
   every page is.
6. aif's review loop passes (the control system BUILD shipped — stage §0). The stage-close
   content audit (floor 5 per kind, D22) is NOT this batch's exit; it runs at stage close.

## §4 Phase-0 self-check (umbrella non-negotiable 8; stage contract §4)

Before any production work: re-read this prompt against the files it cites (re-walk its own
citations — non-negotiable 11); run the §5 host-verify block below with the **path form** of
this file (the slug form resolves to the umbrella's `kickoff.md` and examines nothing here —
stage §7 item 6); probe the repo state (`git rev-parse --abbrev-ref HEAD`, `log -1`,
`status --short`) and record it. «Self-check: OK» with no enumeration is a skipped phase.

## §5 Host-verify contract

```bash host-verify
test -f .claude/orchestrator-prompts/getff-ai-site/kickoff-s1.md
test -f .claude/orchestrator-prompts/getff-ai-site/kickoff-s1.inventory.md
test -f docs/site/reference/D.json
test -f docs/site/reference/B/dispatcher.md
test -f docs/site/reference/B/harvest.md
test -f docs/site/guides/add-design-and-review-skills.md
test -f .claude/skills/docs-author/SKILL.md
test -f .claude/skills/docs-author/references/page-kinds.md
test -f scripts/render-reference.mjs
test -f scripts/docs-check.mjs
test -f scripts/run-local-ci-sweep.sh
bash scripts/check-ask-files.sh
```

All lines assert this batch's INPUTS and are green at `c16c432edc1` (measured 2026-09-25). A red
line means the base is wrong — STOP and surface, do not proceed against a base that lacks the
gold set or the generator.

## §6 Out of scope

Every other family (F1, F2, I first; PARTIAL families are D14d-gated and NOT yours); the hub
`/docs/` (gold, never conveyor); `/docs/faq/` (its row reads `ESCALATED to D30` — writing it is
a blocked act, stage §2); the landing repo (one task cannot write two repos — R23); the
cutover (S2); spec edits (a spec defect is a task-report finding). Family D's guide is IN
scope; other families' guides are not.

## §7 Traps

The stage's §9 list applies in full (T1, T2, T3, T9, T10, T14, T19, T21; T-S1-A/B/C). Batch-0
additions:

- **T-RUN-D-0 «green because nothing ran» (T-S1-C shape):** the render arm and `docs-check`
  must be shown RUNNING in the task report, with the RED of the paired negatives quoted where
  the stage contract demands it (§7 item 4 there) — a page set that «passed» with the gates
  unquoted is unaudited.
- **T-RUN-D-1 «the sheet that documents the doc»:** a hooks sheet written from another doc page
  instead of the hook source is a claim about a claim (T3). Every behavioural sentence in a
  sheet traces to `.claude/hooks/` (or twin/test) content at your base.
- **T-RUN-D-2 «the measurement that saturates»:** if every page of this batch takes a REVISE
  round, the rate saturates at 1.0-per-page-event and the >2.1 test still fires only on the
  MEAN — report the mean AND the saturation observation separately (stage §6 names saturation
  as the failure mode to watch; «nothing fired» is never «quality is fine»).
