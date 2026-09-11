<!-- scope: stage kickoff — beta-docs-encyclopedia E4 (rules corpus + rule tooling raw reference). Dispatch input for ONE task in `artyhoo/getff-landing` through aif project `361685f1-6fe0-407d-a492-ebcfa259407f`. Umbrella plan: ../beta-docs-encyclopedia/kickoff.md §2 (page schema, binding verbatim) + §3 (floors); this file adds only family facts. Census letters are authoritative (umbrella parked Q1 resolved 2026-09-11): this stage covers census family F (rules corpus + generated-rule tooling + shipped audit scripts) = umbrella-semantic "Rules & test generation" + "Scripts" + the corpus side of "Enforcement backends". No runtime-profile marker, on purpose (project mode tiers resolve; do not pass a preset). -->

# beta-docs-encyclopedia E4 — raw reference drafts: rules corpus + rule tooling (census F)

> **Type:** page-authoring task, single aif task, autonomous, parallelizable (siblings E2/E3/E5 may run concurrently — disjoint file sets by design). **Deliverables: raw reference pages under `content/docs/reference/`, ONE stage ledger `ENCYCLOPEDIA-LEDGER-E4.md`, ONE `E4-REPORT.md` — all on the task branch of the landing repo.** PARTIAL fills touch the named EXISTING pages, sentence-level additions only.
> **Scope SSOT: `ENCYCLOPEDIA-CENSUS.md` at the landing repo root.** Your id set: census family **F** — every `MISSING` id (45: the 26 rules F1-F19/F21-F25/F27-F30; the eslint-rules barrel F31-F35; the render scripts F37-F41; the shipped scripts F44, F46-F48, F51, F53, F56) and every `PARTIAL` id (F20, F26, F42, F52). If the census file is absent from your branch: **STOP — BLOCKER**.
> **Rigor label (effort-worthiness L0):** `build-and-verify` — pages land on the live site's tree and the build + wiring gates prove them; the census is research-grade input you re-anchor at your pin, not re-litigate.

<!-- host-verify: none — stage kickoff: it authors no executable deliverable in this repo. Its acceptance commands (§3) run in the aif container's landing worktree (build, grep, git diff); the artifacts are Markdown pages harvested by the host. -->

## §0 Goal

Every census F row the site does not document gets a **raw reference page** on the live site's tree, enumerated from the implementation at a recorded pin. This family IS the product's namesake — rules as tests — so the pages must show, per rule: what it bans, a Never(fires)/Always(clean) pair, which channels enforce it, and the honest FF-routing vocabulary the framework itself prints (FF7001 not-expressible → deferred backend; FF7002 params-contract). Raw-first (umbrella §0): factual, anchored, plain; polish is the operator's LATER pass (T-ENC-C).

## §1 Do this FIRST — entry re-verification

Facts measured **2026-09-11 from the host**. Snapshots: **re-verify, act on what you find**, quote command + output for each (T3).

| # | Fact at authoring | How to re-verify |
| --- | --- | --- |
| 1 | Your task worktree branches from landing `origin/main` which CONTAINS `ENCYCLOPEDIA-CENSUS.md` at root (census pin `a1337cb301`, 252 rows) | `ls ENCYCLOPEDIA-CENSUS.md`; `head -5 ENCYCLOPEDIA-CENSUS.md`; absent → **BLOCKER, STOP** |
| 2 | **Re-pin before drafting** (E1 F-4 + parked Q3, resolved): `git -C /home/www/rules-as-tests-aif fetch https://github.com/artyhoo/getff.git staging` → `FETCH_HEAD` is **your working pin**; `git merge-base --is-ancestor a1337cb301 FETCH_HEAD && echo PIN-OK`. The clone's `origin` is a FORK (E1 F-3) — never re-point/checkout/reset it; read-only | the commands; fetch impossible → standing clone HEAD + shortfall finding (E1 precedent) |
| 3 | **Delta re-check (W2 transfer discipline):** `git -C /home/www/rules-as-tests-aif diff --name-only a1337cb301..FETCH_HEAD` ∩ your F rows' anchors (rule files, render scripts, shipped scripts) → fresh probe per intersecting row before drafting its page | intersection list + per-row re-probes in the report |
| 4 | Landing registries a new page joins (mirror `factory-overview`/`daily-cycle-factory`): `content/docs/meta.json` (a `---Reference---` section exists; a `reference/` subfolder may carry its own `meta.json` — read `lib/source.ts`), the `.md` twin `app/docs/<path>.md/route.ts`, `llms.txt`/`llms-full.txt` (tree-generated — prove inclusion), search | `cat content/docs/meta.json`; `ls app/docs/`; read one twin route end-to-end |
| 5 | Egress to github.com WORKS (E1 F-3); npm reachable; you NEVER push — the host harvests | `curl -m 6 -sS -o /dev/null -w '%{http_code}' https://github.com` |
| 6 | node v22 / npm 10; `npm ci` (fallback `npm install`) + `npm run build` IS part of this stage | `node -v; npm -v` |
| 7 | Production live and green (host snapshot 2026-09-11). Do NOT probe the public site | host-side fact; no container action |

## §2 Deliverables

### D1 — raw reference pages (45 total: F MISSING)

Under `content/docs/reference/`, one page per census id, **schema verbatim from the umbrella kickoff §2**. Per-row shape guidance, from the census: **rule pages** (the 26) each carry the rule's id/class/fires-when (the rule-index row), its Never(fires)/Always(clean) snippets quoted from the rule file or its test material, and its enforcement channels with the honest per-backend status — the `Enforced:` lines with FF7001/FF7002 routing notes where they apply (the framework's own vocabulary, never a softened paraphrase); **barrel pages** (F31-F35) document the generated eslint-rules surface and how it relates to the declarative configs; **script pages** (F37-F41 render scripts; F44/F46-F48/F51/F53/F56 shipped scripts) each carry invocation, exit codes, and what they probe — same grammar as E1's census probes. The corpus is clone-only (census note): pages say WHERE each artifact lives and which lane/tier receives it.

### D2 — PARTIAL fills in EXISTING pages (F20, F26, F42, F52)

Sentence-level additions of the missing detail the census row names (each names an unnamed rule file / shared CLI / script) — additive lines only, no rewording (T-ENC-C).

### D3 — `ENCYCLOPEDIA-LEDGER-E4.md` (the stage's D7 ledger)

One row per capability sentence: `| page | sentence (short) | evidence anchor(s) at pin |` or an explicit `experimental`/`planned`/`deferred-backend` label on the page. Per-stage file ON PURPOSE (siblings write their own; E6 consolidates): never touch `CLAIMS-LEDGER.md` or sibling stages' files.

### D4 — `E4-REPORT.md`

§1 rows with outputs · §3 gate table with outputs · T7 · findings · parks · the verdict line:
`E4: GREEN — 45/45 pages drafted (F MISSING), 4/4 PARTIAL filled, <n> ledger rows, build green, wiring proven`
or `E4: FAIL — <which row, with output>`.

## §3 The gate — run it, quote command + output (T2/T3)

| # | Check | How |
| --- | --- | --- |
| 1 | Diff shape: only `content/docs/reference/**` (new), the ≤4 named PARTIAL pages (additive), `ENCYCLOPEDIA-LEDGER-E4.md`, `E4-REPORT.md` | `git status --porcelain`; `git diff --stat origin/main` |
| 2 | Census coverage complete: every F MISSING id has a page or a recorded finding; every PARTIAL id filled or finding | id-by-id read-back against the census family TABLES (tables beat roll-up lists) |
| 3 | Page schema conformance: frontmatter + provenance (your pin) + Status/Ships-to/Fires-at + the four sections | sweep all 45; quote the count that passed |
| 4 | Anchors: every page ≥2 `file:line`, ≥1 quoted, resolvable at YOUR pin | mechanical sweep + spot-quotes |
| 5 | Rule pages carry Never/Always + channels + honest FF status; script pages carry invocation + exit codes | read-back sweep; quote three exemplars (one rule, one barrel, one script) |
| 6 | Ledger: every capability sentence rowed or explicitly labeled | capability-sentence count vs ledger rows; quote the tally |
| 7 | Wiring: each new slug in the nav registry, twin route present, present in built `llms.txt`/`llms-full.txt`/search | grep registries + built artifacts; quote one slug end-to-end |
| 8 | Build green | `npm ci \|\| npm install` then `npm run build` — quote the tail |
| 9 | No styling/restyle/announce-touch | `git diff --name-only origin/main \| grep -E '\.(css|tsx)\|announcement'` → expect only your twin routes |
| 10 | T7 + T19 ran and are reported | the report's T7/T19 sections |

**On any FAIL:** report it with the output and **STOP**. No fix-forward past the gate.

## §4 Out of scope — and the floors

- **No framework-repo writes** (read at your pin; defects are findings — E1's 7 + F-1 stay parked for the operator's fix dispatch).
- **No new scope:** only census F ids; an un-censused rule/script is a FINDING, not a page.
- **No polish** (T-ENC-C). **No pushes/PRs**; the host harvests (§6).
- **Sibling isolation:** E2/E3/E5 run concurrently — never enter their worktrees; keep your file set disjoint.
- Operator forks → **park** (aif park/answer) and continue park-independent work, or exit clean.

## §5 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

Active traps: **T2, T3, T7, T10, T12, T14, T19** + umbrella **T-ENC-A/C**.

- **T2** — every §3 row is run. **T3** — command + output or `file:line` + quoted content.
- **T7** — adversarial counter-prompt before green: «what would make this corpus look documented when it is not?» Actually check: rule pages whose Never/Always pair is invented rather than quoted from the rule file/test material; FF statuses softened («supported» where the framework prints FF7001/deferred); a batch of near-identical rule pages drifting into one generic template that names no rule; slugs wired into nav but missing from twin/llms/search.
- **T10** — all 45 ids accounted for. **T12** — every fact at YOUR pin, never memory — rules and their enforcement lines move commit-to-commit. **T14** — 10/10 rows or not green. **T19** — cold self-pass over every page.
- **T-ENC-A** — sentences + anchors, not titles. **T-ENC-C** — polish creep leaves the stage.

## §6 Dispatch + runtime facts (for the dispatching session, not the worker)

- **Project:** `361685f1-6fe0-407d-a492-ebcfa259407f` (`getff-landing`); dispatch payload pins `projectId` explicitly (operator shell may export `RUNTIME_BRIDGE_AIF_PROJECT_ID` for the FRAMEWORK project — the BS2 lesson).
- **Branch naming:** `feature/beta-docs-encyclopedia-<taskid>`.
- **Harvest:** host harvests → PR to landing `main` (merge-commit, PRs #5-#9 convention) → Pages deploy green. Sibling PRs (E2-E5) merge sequentially; file sets disjoint.
- **No preset, no profile override.** **Pre-dispatch:** E1 harvested+merged (census on `main`) BEFORE unpausing.

## §7 Report format

`E4-REPORT.md` at the branch root: §1 rows with outputs (your pin + the W2 delta list) · §3 gate table with actual outputs · T7 · findings · parked questions · the verdict line.
