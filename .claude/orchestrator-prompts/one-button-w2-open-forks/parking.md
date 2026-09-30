# one-button second wave — open forks (parking, NOT a kickoff)

> **What this is:** the forks of the getff «one button» second wave that the operator has NOT decided.
> Nothing here is dispatchable: there is deliberately no `kickoff.md` in this directory, so `/pipeline`
> does not offer it. Each entry names the card it needs; a card is raised by the one-button top-level
> advisor, and a fork is decided only by the operator's explicit choice (the «skipped card =
> recommendation» rule was removed on 2026-09-29).
> **Authoritative for:** the list of undecided second-wave forks and the evidence each card must carry.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the operator's decisions — coordination store `_advisor-one-button-operator-log.md` (cited by entry).

Measured on `808e806c606` (head of `join/one-button-union`) and `origin/staging` `2855667cb34`,
2026-09-30. A decided fork leaves this file in the same commit that authors its kickoff (or records
«rejected»).

## F-1 — oxlint preset translation (SSOT #161)

- **The fork:** on an oxlint project, getff's own ESLint preset rules are not placed as ESLint config
  (entry 28: the project's linter wins); getff's plugin rules reach oxlint through `jsPlugins`
  (`setup.d/99-finalize.sh:1064-1073`). Should getff ALSO translate its preset's built-in rule settings
  into the project's `.oxlintrc.json` (a migration-style translation), or leave them «not wired»?
- **Status:** reopened, unanswered — entry 32's reading: «The other reopened items (oxlint preset
  translation, O1 site seam) got no answer in this message and stay OPEN.»
- **Prior art:** `docs/meta-factory/prior-art-evaluations.md` row 161 (`@oxlint/migrate`, Biome migrate) —
  REFERENCE: «emit only what's justified, never silently inflate» and «report rejected/un-convertible items
  with reason».
- **The card needs:** the count of preset rules that have an oxlint built-in equivalent vs none (measured
  on one preset, not estimated); what the translation writes into a file the project owns (entry 28:
  settings not changed — is ADDING a rule a change?); the undo; a falsifier.

## F-2 — O1: the passport step's manual wording in the shipped sequences (site seam)

- **The fork:** the shipped «fill-passport» step still tells the human to replace placeholders by hand in
  all three sequences — `packages/core/templates/shared/first-steps.source.json:47`, `:101`, `:143`
  («Replace every `<PLACEHOLDER>` in `.ai-factory/DESCRIPTION.md`»), rendered into
  `packages/core/templates/shared/AI-USAGE-GUIDE.md:65`, `:127`, `:163`; the road in the same file drafts
  the passport itself (entry 21 / entry 26 point 9). Two lists in one file disagree.
- **Why a card, not a kickoff:** the fix regenerates `docs/site/face-facts.json` (`scripts/render-face-facts.mjs`
  reads `first-steps.source.json`), which touches the docs site's seam; P1's plan records its gate as «the
  operator's yes — it touches the site seam» (`_p1-road-plan-2026-09-29.md` §9, O1). Entry 32: unanswered.
- **The card needs:** the exact files regenerated (source, rendered guide, face facts, install baselines,
  `packages/getff/MANIFEST.sha256`); whether the site seat must be told (the advisor does not message the
  site seat without an operator yes); a falsifier.

## F-3 — `AIF_GUIDED_INSTALL` as a fifth part of the one question

- **The fork:** should the road's one pre-launch question gain a part (e) that sets
  `AIF_GUIDED_INSTALL=1` (clone aif-handoff and start its containers), or stay at four parts with aif
  offered only through answer 3 of part (a)?
- **Code:** `setup.d/aif-handoff-guided-install.sh:49-53` (the consent variable), `:84-99` (a non-interactive
  run auto-declines without it: «the guided install clones a repository and starts containers, and a
  non-interactive run does that only with AIF_GUIDED_INSTALL=1»). The road's part (a) answer 3
  (`INSTALL-FOR-AI.md:67`) says it «does not install aif-handoff itself, clone anything or start containers».
- **Status:** P1 kept it out on the advisor's word — «`AIF_GUIDED_INSTALL` stays OUT of the question — it
  is the advisor's open fork for the operator; do NOT add a part (e) before the operator's word»
  (`_handoff-7f265b9b-2ac6-47f7-afc6-40046660c932.md`, the P1 session handoff). Entry 26 point 8 has «aif itself is offered as a separate "heavy" line
  only when docker is running, never under -y / --full» tagged `[adv, skipped card]` — an advisor detail,
  not an operator decision.
- **The card needs:** what the guided install does on the person's machine (clone path, containers, ports);
  the docker probe it gates on (`bridge_diagnose`, `setup.d/bridge-guided.sh:18-23`); the default; the undo.

## F-4 — F11 / K2: do presets ship config templates at all

- **The fork:** the npm presets ship a `vitest.config.ts` that sets `test.poolOptions`, removed in Vitest 4
  (`packages/preset-react-spa/templates/vitest.config.ts:95`,
  `packages/preset-next-15-canonical/templates/vitest.config.ts:98`, `templates/ts-server/vitest.config.ts:62`;
  known-rot matcher `tests/consumer-matrix/known-rot.sh:13-26`). P6 finding F11: «`npm test` still prints
  the Vitest 4 `poolOptions` removal notice (K2)».
- **Status:** Q4.4 of `_decisions-2026-09-28-one-button-q3-q4.md`: «Not hand-patched as a design answer
  … Whether presets should ship config templates at all goes to the design session (§2).» No later decision
  found; the one-button kickoff `one-button-w2-p6-open-findings` excludes F11 for this reason.
- **The card needs:** Option A — keep shipping config templates and fix the rot (then a gate that catches
  the next rot, since Q4.4 says the Q4.3 gate shows it) / Option B — stop shipping config templates, the
  project's own config wins (entry 28) and getff adds only its rules; the file list per preset; a falsifier.

## F-5 — who builds the docs single-source engine (prerequisite, no owner)

- **Not a design fork but an unowned prerequisite:** stage B of `one-button-w2-docs-handover-ho` (HO-1,
  HO-2, HO-9, part of HO-4) needs the docs engine of the approved design (renderer, fences, gates, lock file,
  relink). No build kickoff for it exists on `origin/staging`, and the hand-over says «Landing the design as
  a repo spec: on the operator's word only».
- **The card needs:** the operator's word to land the approved docs design as a repo spec and to author its
  build kickoffs (the docs design's lead owns them), and the order against the one-button second wave.

## Unexercised paths and observations — P6 re-check R5 (not forks)

Recorded on the one-button advisor's request, 2026-09-30, from R5 of
`_p6-cold-run-report-2026-09-30.md` (from its line 755), measured on join head `7a0b9634ef1`. Record only:
nothing here is decided or dispatched; each item names what would exercise or settle it.

- **U-1 — the local (npx) vendor MCP server path was never run.** `packages/core/install/mcp-source-check.ts:449-458`
  writes a `stdio`/`npx -y <pkg>` server, prints a `⚠` line and `claude mcp remove <key> -s project`. A
  remote server gets no `⚠` by design (`:444-448`). In 5 cold runs none of the 32 dependencies tried
  produced an npx server (R5.1 «that path is still not exercised»). **Needs:** a fixture dependency whose
  vendor's server has an npm package, two ownership signals and no required settings — or a stubbed
  registry answer — in the `one-button-w2-p6-open-findings` stage (or its successor).
- **U-2 — the «can take up to 90 s» wait line arrives late through a pipe.** `setup.d/35-stack-tools.sh:33`
  pipes the check through `sed 's/^/  /'`; BSD sed block-buffers when writing to a pipe, so an agent's Bash
  tool received the wait line together with the result (both at 19.89 s, `setup-y.log:99-102`); a terminal
  gets it in time. R5 files it as «Observation only, not a finding». **Needs:** a line-buffered indent
  (`sed -l` on BSD, `stdbuf`/`sed -u` on GNU) or printing the wait line outside the pipe — a small fix
  with a timing test; no owner yet.
- **U-3 — the aif-handoff version record is unexercised.** `setup.d/aif-handoff-guided-install.sh:70-71`
  records the checkout path `~`-relative via `companion_record_version`. Docker was down in every P6 run, so
  the guided install never reached it. **Needs:** one run with docker up and `AIF_GUIDED_INSTALL=1` (see F-3).

