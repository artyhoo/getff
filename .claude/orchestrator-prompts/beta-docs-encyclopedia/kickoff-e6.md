<!-- scope: stage kickoff — beta-docs-encyclopedia E6 (cold claims audit + closure). Dispatch input for ONE task in `artyhoo/getff-landing` through aif project `361685f1-6fe0-407d-a492-ebcfa259407f`. Umbrella plan: ../beta-docs-encyclopedia/kickoff.md §1 (E6 row), §2 (page contract — your fixes inherit its floors), §3 (floors + the dynamic-docs FUTURE rule this stage records, never builds); this file adds only stage facts. Audit protocol SSOT: `agents/claims-conformance-auditor.md` in the framework clone — its claim taxonomy and VERIFIED/GAP/UNVERIFIABLE grammar are binding verbatim; this stage instantiates them over the E2-E5 surface. No runtime-profile marker, on purpose (project mode tiers resolve; do not pass a preset). -->

# beta-docs-encyclopedia E6 — cold claims audit + ledger consolidation + closure (all families)

> **Type:** cold-audit task, single aif task, autonomous, runs SOLO (E2-E5 all harvested and merged; no sibling isolation constraints). **Deliverables: `CLAIMS-LEDGER.md` (consolidated, verdicted), sentence-level drift fixes in audited pages, `E6-REPORT.md` (incl. the done.md proposal) — all on the task branch of the landing repo.** The umbrella's `done.md` itself is HOST work after GO; you propose its content, you never write to the framework repo.
> **Scope SSOT: the four stage ledgers** `ENCYCLOPEDIA-LEDGER-E2/E3/E4/E5.md` at the landing repo root (E1's `ENCYCLOPEDIA-CENSUS.md` stays the page-scope SSOT — it is CLOSED: no new pages this stage). Recorded verdicts: E2 716 rows / E3 66 / E4 65 / E5 78 — recount at entry; the recount IS your audit universe. If any ledger or the census is absent from your branch: **STOP — BLOCKER**.
> **Rigor label (effort-worthiness L0):** `research-grade` — this audit is the GO authority for consumer-shipped claims on the live public site; a wrong GO certifies false claims into `llms.txt` and caches, the exact unretractable class the umbrella flagged at spawn.

<!-- host-verify: none — stage kickoff: it authors no executable deliverable in this repo. Its acceptance commands (§3) run in the aif container's landing worktree (anchor sweeps, npm build, git diff shape); the artifacts are Markdown (ledger, fixes, report) harvested by the host. -->

## §0 Goal

Every claim the E2-E5 surface makes about the framework is re-verified **cold** — against a FRESH pin, by a seat that authored none of it — using the shipped [`agents/claims-conformance-auditor.md`](../../../agents/claims-conformance-auditor.md) protocol (cold by construction: given ONLY the doc surface, never the authoring narrative). False or drifted claims get minimal sentence-level fixes; the four stage ledgers consolidate into ONE verdicted `CLAIMS-LEDGER.md`; the report proposes the umbrella's `done.md` including the dynamic-docs FUTURE rule (umbrella §3 — recorded as the operator's proposed next step, NOT built, gated, or prototyped here). Green here closes the umbrella.

## §1 Do this FIRST — entry re-verification

Facts measured **2026-09-12 from the host**. Snapshots: **re-verify, act on what you find**, quote command + output for each (T3).

| # | Fact at authoring | How to re-verify |
| --- | --- | --- |
| 1 | Your task worktree branches from landing `origin/main` @ merge `5c4d333` (E5 in via PR #14; E2-E4 via #13/#12/#11) which CONTAINS at root: `ENCYCLOPEDIA-CENSUS.md` + all four `ENCYCLOPEDIA-LEDGER-E*.md` + `E2-REPORT.md`..`E5-REPORT.md` | `ls` each; row-count each ledger (`grep -c '^|' <file>` minus header lines); absent → **BLOCKER, STOP** |
| 2 | **Re-pin before auditing** (the E-stage precedent, now load-bearing): `git -C /home/www/rules-as-tests-aif fetch https://github.com/artyhoo/getff.git staging` → `FETCH_HEAD` is **your audit pin**; `git merge-base --is-ancestor b069c59328 FETCH_HEAD && echo PIN-OK` (b069c593 = the E2-E5 authoring pin — you audit the DELTA it drifted through, never wave it). The clone's `origin` is a FORK — read-only, never re-point | the commands; fetch impossible → standing clone HEAD + shortfall finding |
| 3 | **Known drift zone (priority surface):** `git -C /home/www/rules-as-tests-aif diff --name-only b069c59328..FETCH_HEAD` measured 44 files host-side, intersecting E5's I-family and G-surface: `plugin/skills/{ai-doc,rule-research,rule-tests,template-audit}/SKILL.md`, `plugin/skills/ai-doc/anthropic-and-aif-residue.md`, `plugin/install/fetch-and-wire.sh`, `plugin/.claude-plugin/plugin.json` (version `0.2.0`→`0.3.0`), `plugin/README.md`, plus UN-CENSUSED new artifacts `scripts/generate-plugin-skills.sh` + `tests/plugin/skills-generation.test.sh` (plugin-skills-generator umbrella, closed 2026-09-12 in `ef00241c`) | re-run the diff; intersect against every ledger-row anchor path; every intersecting row re-verified LINE-BY-LINE (content, not just file mtime); literal version strings (`0.2.0`) swept across the surface |
| 4 | The audit surface: 180 `content/docs/reference/*.md` pages + every PARTIAL fill the ledgers row in EXISTING pages (E4: daily-cycle-rules/faq/quickstart-python/quickstart-ts; E5: daily-cycle-factory/daily-cycle-rules/degradations/executable-agents-md/faq/first-steps-core/quickstart-python; E2/E3 fills: read their ledger fill rows — the ledgers are the inventory, this list is not) | `ls content/docs/reference/*.md \| wc -l` → 180; extract fill-target pages from each ledger |
| 5 | Auditor protocol on the clone at your pin: `agents/claims-conformance-auditor.md` — read it end-to-end FIRST; its claim taxonomy, per-claim verification method (command+output or file:line+quote), and VERIFIED/GAP/UNVERIFIABLE grammar are binding | `sed -n '1,120p'` or read whole; quote the output-grammar lines in your report |
| 6 | Egress to github.com WORKS; npm reachable; you NEVER push — the host harvests | `curl -m 6 -sS -o /dev/null -w '%{http_code}' https://github.com` |
| 7 | node v22 / npm 10; `npm ci` (fallback `npm install`) + `npm run build` IS part of this stage (your fixes touch live-tree pages) | `node -v; npm -v` |
| 8 | Production live at 180 reference pages (host snapshot 2026-09-12). Do NOT probe the public site | host-side fact; no container action |

## §2 Deliverables

### D1 — `CLAIMS-LEDGER.md` (consolidated, verdicted — the landing repo's live claims index)

Union of the four stage ledgers' rows (page rows + PARTIAL-fill rows), each row gaining: `| verdict (VERIFIED/GAP/UNVERIFIABLE @ <pin>) | action (none / anchor-fixed / sentence-fixed / finding-ref) |`. VERIFIED = anchor re-resolved AND its quoted content still matches at the pin (re-quote it); GAP = claim false or anchor unresolvable at the pin → D2 fix or a finding; UNVERIFIABLE = finding (with reason). The four `ENCYCLOPEDIA-LEDGER-E*.md` files stay FROZEN (authoring history) — verdicts and fixed anchors live only in `CLAIMS-LEDGER.md` and the pages.

### D2 — sentence-level drift fixes in pages

Only sentences backed by a GAP row: minimal correction of the false/drifted sentence (umbrella §2 rule 4), anchors re-anchored at your pin. Every `-`/`+` line in your diff must map to a CLAIMS-LEDGER row id listed in the report. These are the ONLY sanctioned deletions in this umbrella's post-authoring life — insertions elsewhere and any polish are violations (T-ENC-C).

### D3 — `E6-REPORT.md`

§1 rows with outputs (pin + the drift-zone intersection list) · audit-method summary (per-family tallies) · §3 gate table with outputs · T7 · findings · parked questions · the D4 proposal · the verdict line:
`E6: GREEN — <N>/<N> claims audited (<v> VERIFIED, <g> GAP→fixed, <u> UNVERIFIABLE→findings), ledger consolidated <N> rows, build green, wiring intact`
or `E6: FAIL — <which row, with output>`.

### D4 — done.md proposal (a section inside E6-REPORT.md — the host transplants it to framework staging after GO)

Umbrella closure summary (E1 census → E2-E5 180 pages → E6 audit tallies) · tails: un-censused artifacts (`scripts/generate-plugin-skills.sh`, `tests/plugin/skills-generation.test.sh`, carried E4 Finding 4 `scripts/probe-zcode-runtime.sh` + `packages/core/hooks/zcode-runtime-probe.test.ts`, E4 P1/P2 census amendments, the 7 framework defects stay operator-parked) · **the dynamic-docs FUTURE rule, verbatim intent from umbrella §3:** «change something → immediately update the docs» — recorded as the operator's proposed next step AFTER this umbrella, explicitly NOT built, gated, or prototyped by this stage.

## §3 The gate — run it, quote command + output (T2/T3)

| # | Check | How |
| --- | --- | --- |
| 1 | Diff shape: ONLY `CLAIMS-LEDGER.md` (new), `E6-REPORT.md` (new), pages carrying recorded GAP fixes; the four stage ledgers and the census byte-untouched; deletions ONLY inside GAP-fixed sentences | `git status --porcelain`; `git diff --numstat origin/main`; stage-ledger `git diff` → empty |
| 2 | Claim coverage: every row of all four ledgers has a verdict in `CLAIMS-LEDGER.md`; consolidated count == sum of stage counts, zero dropped | recount both sides; quote the tallies |
| 3 | Fresh-pin discipline: verdicts resolved at FETCH_HEAD (the §1 row 2 pin), quoted; the drift-zone rows (§1 row 3) re-verified line-by-line with quotes | spot-read 10 verdict rows across families incl. ≥3 I-family |
| 4 | Fix shape: every diff `-`/`+` line maps to a GAP row id in the report; no deletions anywhere else; no insertions in non-fixed files | read-back the full diff against the report's fix list |
| 5 | Post-fix anchor sweep: every touched page still ≥2 `file:line`, ≥1 quoted, resolvable at the pin | mechanical sweep over touched pages only |
| 6 | Un-censused artifacts recorded as findings/tails, NOT drafted as pages (census closed) | report Findings section names them; `git status` shows no new `content/docs/reference/` pages |
| 7 | Wiring intact: build green AND the 180 slugs still in nav/twins/`llms.txt`/`llms-full.txt`/search — your fixes lost nothing | `npm run build`; grep built artifacts for 3 fixed-page slugs + count `docs/reference/` in `llms.txt` → 180 |
| 8 | Build green | `npm ci \|\| npm install` then `npm run build` — quote the tail |
| 9 | No styling/restyle/announce touch | `git diff --name-only origin/main \| grep -E '\.(css\|tsx)\|announcement'` → empty |
| 10 | T7 + T19 ran and are reported | the report's T7/T19 sections |

**On any FAIL:** report it with the output and **STOP**. No fix-forward past the gate.

## §4 Out of scope — and the floors

- **No framework-repo writes** (read at your pin; defects and un-censused artifacts are findings/tails — the vendored-render parity mechanism stays an OPERATOR decision).
- **No new pages, no census re-litigation** (E1's census is closed; amendment is the operator's parked P1/P2).
- **No polish** (T-ENC-C). **No pushes/PRs**; the host harvests (§6). **No prod probing.**
- **`done.md` is host work** — you propose its content (D4), you do not write the framework repo.
- **The dynamic-docs rule is NOT built here** — recorded in the proposal only (umbrella §3 is explicit).
- Operator forks → **park** (aif park/answer) and continue park-independent work, or exit clean.

## §5 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

Active traps: **T2, T3, T7, T10, T12, T14, T19** + umbrella **T-ENC-A/C** + the cold-audit trap.

- **T2** — every §3 row is run. **T3** — command + output or `file:line` + quoted content.
- **T7** — adversarial counter-prompt before green: «what would make this audit look performed when it was not?» Actually check: verdicts batch-copied from the stage ledgers without re-resolution at the fresh pin (the batch-fill trap — spot-verify your own sweep really re-quoted); the drift zone waved through because the pages are "new" (E5's I-pages were authored against a pin the plugin-skills-generator umbrella then moved); a GAP "fix" that rewrites prose beyond the false sentence; the consolidated ledger silently dropping rows; anchors verified against the authoring pin instead of yours.
- **T10** — every ledger row verdicted, recounted, zero dropped. **T12** — every fact at YOUR pin, never memory. **T14** — 10/10 rows or not green. **T19** — cold self-pass over the consolidated ledger and every touched page.
- **T-ENC-A** — sentences + anchors, not titles. **T-ENC-C** — polish creep leaves the stage.

## §6 Dispatch + runtime facts (for the dispatching session, not the worker)

- **Project:** `361685f1-6fe0-407d-a492-ebcfa259407f` (`getff-landing`); dispatch payload pins `projectId` explicitly (operator shell may export `RUNTIME_BRIDGE_AIF_PROJECT_ID` for the FRAMEWORK project — the BS2 lesson).
- **Branch naming:** `feature/beta-docs-encyclopedia-e6-<taskid>`.
- **Harvest:** host harvests → PR to landing `main` (merge-commit convention) → Pages deploy green → then the host commits `done.md` to FRAMEWORK staging and closes the umbrella.
- **Pre-dispatch satisfied:** E1-E5 ALL harvested+merged (PRs #11-#14); main carries census + four ledgers; prod at 180 reference pages. **No preset, no profile override.**

## §7 Report format

`E6-REPORT.md` at the branch root: §1 rows with outputs (your pin + the drift-zone intersection) · audit-method + per-family tallies · §3 gate table with actual outputs · T7 · findings · parked questions · the done.md proposal (D4) · the verdict line.
