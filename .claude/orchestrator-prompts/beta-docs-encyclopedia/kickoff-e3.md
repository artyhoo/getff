<!-- scope: stage kickoff — beta-docs-encyclopedia E3 (hooks + runtime-bridge raw reference). Dispatch input for ONE task in `artyhoo/getff-landing` through aif project `361685f1-6fe0-407d-a492-ebcfa259407f`. Umbrella plan: ../beta-docs-encyclopedia/kickoff.md §2 (page schema, binding verbatim) + §3 (floors); this file adds only family facts. Census letters are authoritative (umbrella parked Q1 resolved 2026-09-11): this stage covers census families D (hooks: plugin enforcement wiring + consumer pre-push graph) + H (runtime-bridge / aif dispatch) = umbrella-semantic "Hooks" + the dispatch half of "Harness agnosticity". No runtime-profile marker, on purpose (project mode tiers resolve; do not pass a preset). -->

# beta-docs-encyclopedia E3 — raw reference drafts: hooks + runtime-bridge (census D+H)

> **Type:** page-authoring task, single aif task, autonomous, parallelizable (siblings E2/E4/E5 may run concurrently — disjoint file sets by design). **Deliverables: raw reference pages under `content/docs/reference/`, ONE stage ledger `ENCYCLOPEDIA-LEDGER-E3.md`, ONE `E3-REPORT.md` — all on the task branch of the landing repo.** PARTIAL fills touch the named EXISTING pages, sentence-level additions only.
> **Scope SSOT: `ENCYCLOPEDIA-CENSUS.md` at the landing repo root.** Your id set: census families **D and H** — every `MISSING` id (41: D2-D19, D23, D24, D24b, D25, D26; H3-H7, H9-H13, H16-H23) and every `PARTIAL` id (D1, D22, H1, H2, H14, H15, **H24**). **Host correction, binding: the census roll-up's MISSING *list* misfiles H24 — H24's own table row is PARTIAL; treat it as a PARTIAL fill, not a new page.** Where a roll-up list and a family table disagree, the TABLE is authoritative. If the census file is absent from your branch: **STOP — BLOCKER**.
> **Rigor label (effort-worthiness L0):** `build-and-verify` — pages land on the live site's tree and the build + wiring gates prove them; the census is research-grade input you re-anchor at your pin, not re-litigate.

<!-- host-verify: none — stage kickoff: it authors no executable deliverable in this repo. Its acceptance commands (§3) run in the aif container's landing worktree (build, grep, git diff); the artifacts are Markdown pages harvested by the host. -->

## §0 Goal

Every census D/H row the site does not document gets a **raw reference page** on the live site's tree, enumerated from the implementation at a recorded pin. Raw-first (umbrella §0): factual, anchored, plain; polish is the operator's LATER pass (T-ENC-C). These two families are the product's enforcement + dispatch machinery — the pages must say WHEN each hook fires and WHICH channel fails, and for the bridge CLIs what they invoke; a machinery page without its firing channel is a hollow page.

## §1 Do this FIRST — entry re-verification

Facts measured **2026-09-11 from the host**. Snapshots: **re-verify, act on what you find**, quote command + output for each (T3).

| # | Fact at authoring | How to re-verify |
| --- | --- | --- |
| 1 | Your task worktree branches from landing `origin/main` which CONTAINS `ENCYCLOPEDIA-CENSUS.md` at root (census pin `a1337cb301`, 252 rows) | `ls ENCYCLOPEDIA-CENSUS.md`; `head -5 ENCYCLOPEDIA-CENSUS.md`; absent → **BLOCKER, STOP** |
| 2 | **Re-pin before drafting** (E1 F-4 + parked Q3, resolved): `git -C /home/www/rules-as-tests-aif fetch https://github.com/artyhoo/getff.git staging` → `FETCH_HEAD` is **your working pin**; `git merge-base --is-ancestor a1337cb301 FETCH_HEAD && echo PIN-OK`. The clone's `origin` is a FORK (E1 F-3) — never re-point/checkout/reset it; read-only | the commands; fetch impossible → standing clone HEAD + shortfall finding (E1 precedent) |
| 3 | **Delta re-check (W2 transfer discipline):** `git -C /home/www/rules-as-tests-aif diff --name-only a1337cb301..FETCH_HEAD` ∩ your D/H rows' anchors → fresh probe at the new pin for every intersecting row before drafting its page. Expect hits here: the zcode-parity hook-twin commits (#1708-#1710) landed INSIDE the census-staleness window and touch D-family files | intersection list + per-row re-probes in the report |
| 4 | Landing registries a new page joins (mirror `factory-overview`/`daily-cycle-factory`): `content/docs/meta.json` (a `---Reference---` section exists; a `reference/` subfolder may carry its own `meta.json` — read `lib/source.ts`), the `.md` twin `app/docs/<path>.md/route.ts`, `llms.txt`/`llms-full.txt` (tree-generated — prove inclusion), search | `cat content/docs/meta.json`; `ls app/docs/`; read one twin route end-to-end |
| 5 | Egress to github.com WORKS (E1 F-3); npm reachable; you NEVER push — the host harvests | `curl -m 6 -sS -o /dev/null -w '%{http_code}' https://github.com` |
| 6 | node v22 / npm 10; `npm ci` (fallback `npm install`) + `npm run build` IS part of this stage | `node -v; npm -v` |
| 7 | Production live and green (host snapshot 2026-09-11). Do NOT probe the public site | host-side fact; no container action |

## §2 Deliverables

### D1 — raw reference pages (41 total: D+H MISSING)

Under `content/docs/reference/`, one page per census id, **schema verbatim from the umbrella kickoff §2** (frontmatter → provenance comment with YOUR pin + date → Status/Ships-to/Fires-at → What it is → How it works → Satellites & companions → Anchors with quoted lines). Per-family shape guidance, from the census rows: plugin-hook pages (D2-D19) each carry their registration site, matcher, fail mode and the twin/parity note where one exists (zcode-parity); bridge-CLI pages (H3-H13, H16-H24 subset) each carry the exact invocation (args, env vars, exit codes) and clone-vs-vendor availability — the census `ships-to` column says which; `_zcode-emit` (D25) is shipped-but-inert at the census pin: its page must SAY that (Status: experimental/inert, no adopters at pin).

### D2 — PARTIAL fills in EXISTING pages (D1, D22, H1, H2, H14, H15, H24)

Sentence-level additions of the missing detail the census row names — nothing else changes; diffs read as additive lines only. H24's fill names the FRAMEWORK's own staging home (`.claude/orchestrator-prompts/`), the consumer path is already documented.

### D3 — `ENCYCLOPEDIA-LEDGER-E3.md` (the stage's D7 ledger)

One row per capability sentence: `| page | sentence (short) | evidence anchor(s) at pin |` or an explicit `experimental`/`planned` label on the page. Per-stage file ON PURPOSE (siblings write their own; E6 consolidates): never touch `CLAIMS-LEDGER.md` or sibling stages' files.

### D4 — `E3-REPORT.md`

§1 rows with outputs · §3 gate table with outputs · T7 · findings · parks · the verdict line:
`E3: GREEN — 41/41 pages drafted (D+H MISSING), 7/7 PARTIAL filled, <n> ledger rows, build green, wiring proven`
or `E3: FAIL — <which row, with output>`.

## §3 The gate — run it, quote command + output (T2/T3)

| # | Check | How |
| --- | --- | --- |
| 1 | Diff shape: only `content/docs/reference/**` (new), the ≤7 named PARTIAL pages (additive), `ENCYCLOPEDIA-LEDGER-E3.md`, `E3-REPORT.md` | `git status --porcelain`; `git diff --stat origin/main` |
| 2 | Census coverage complete: every D/H MISSING id has a page or a recorded finding; every PARTIAL id (incl. H24) filled or finding | id-by-id read-back against the census family TABLES (tables beat roll-up lists) |
| 3 | Page schema conformance: frontmatter + provenance (your pin) + Status/Ships-to/Fires-at + the four sections | sweep all 41; quote the count that passed |
| 4 | Anchors: every page ≥2 `file:line`, ≥1 quoted, resolvable at YOUR pin | mechanical sweep + spot-quotes |
| 5 | Firing channels stated: every hook page names WHEN it fires and WHICH channel fails; every bridge-CLI page names its invocation + availability | read-back sweep; quote three exemplars |
| 6 | Ledger: every capability sentence rowed or explicitly labeled | capability-sentence count vs ledger rows; quote the tally |
| 7 | Wiring: each new slug in the nav registry, twin route present, present in built `llms.txt`/`llms-full.txt`/search | grep registries + built artifacts; quote one slug end-to-end |
| 8 | Build green | `npm ci \|\| npm install` then `npm run build` — quote the tail |
| 9 | No styling/restyle/announce-touch | `git diff --name-only origin/main \| grep -E '\.(css|tsx)\|announcement'` → expect only your twin routes |
| 10 | T7 + T19 ran and are reported | the report's T7/T19 sections |

**On any FAIL:** report it with the output and **STOP**. No fix-forward past the gate.

## §4 Out of scope — and the floors

- **No framework-repo writes** (read at your pin; defects are findings — E1's 7 + F-1 stay parked).
- **No new scope:** only census D/H ids; an un-censused capability is a FINDING, not a page.
- **No polish** (T-ENC-C): no restyle, no rewording existing prose beyond the named PARTIAL additions.
- **No pushes/PRs**; the host harvests (§6). **Sibling isolation:** E2/E4/E5 run concurrently — never enter their worktrees; keep your file set disjoint.
- Operator forks → **park** (aif park/answer) and continue park-independent work, or exit clean.

## §5 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

Active traps: **T2, T3, T7, T10, T12, T14, T19** + umbrella **T-ENC-A/C**.

- **T2** — every §3 row is run. **T3** — command + output or `file:line` + quoted content.
- **T7** — adversarial counter-prompt before green: «what would make these machinery pages look documented when they are not?» Actually check: a hook page that never says which channel fails; anchors quoting the census instead of the implementation at YOUR pin (row 3's delta makes this the likeliest failure — the parity commits are recent); H-CLIs described from their names, not their `parseArgs` contracts; a slug in nav but missing from twin/llms/search.
- **T10** — all 41 ids accounted for, not "the important ones". **T12** — every fact at YOUR pin, never memory. **T14** — 10/10 rows or not green. **T19** — cold self-pass over every page.
- **T-ENC-A** — sentences + anchors, not titles. **T-ENC-C** — polish creep leaves the stage.

## §6 Dispatch + runtime facts (for the dispatching session, not the worker)

- **Project:** `361685f1-6fe0-407d-a492-ebcfa259407f` (`getff-landing`); dispatch payload pins `projectId` explicitly (operator shell may export `RUNTIME_BRIDGE_AIF_PROJECT_ID` for the FRAMEWORK project — the BS2 lesson).
- **Branch naming:** `feature/beta-docs-encyclopedia-<taskid>`.
- **Harvest:** host harvests → PR to landing `main` (merge-commit, PRs #5-#9 convention) → Pages deploy green. Sibling PRs (E2-E5) merge sequentially; file sets disjoint.
- **No preset, no profile override.** **Pre-dispatch:** E1 harvested+merged (census on `main`) BEFORE unpausing.

## §7 Report format

`E3-REPORT.md` at the branch root: §1 rows with outputs (your pin + W2 delta list — name every D-row whose file moved in the parity commits) · §3 gate table with actual outputs · T7 · findings · parked questions · the verdict line.
