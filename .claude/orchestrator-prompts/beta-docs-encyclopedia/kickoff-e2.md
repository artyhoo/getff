<!-- scope: stage kickoff — beta-docs-encyclopedia E2 (skills + sub-agents raw reference). Dispatch input for ONE task in `artyhoo/getff-landing` through aif project `361685f1-6fe0-407d-a492-ebcfa259407f`. The umbrella plan lives in ../beta-docs-encyclopedia/kickoff.md §2 (page schema, binding verbatim) and §3 (floors); this file adds only family facts. Lettering note: the census re-derived its own A-I boundaries (umbrella parked question 1, answered by the dispatching session 2026-09-11) — the CENSUS letters are authoritative for E2-E5; this stage covers census families B (skills suite) + C (sub-agents + skill-context) = umbrella-semantic "Skills" + the agent half of "Harness agnosticity". No runtime-profile marker, on purpose (project mode tiers resolve; do not pass a preset). -->

# beta-docs-encyclopedia E2 — raw reference drafts: skills + sub-agents (census B+C)

> **Type:** page-authoring task, single aif task, autonomous, parallelizable (siblings E3/E4/E5 may run concurrently — disjoint file sets by design). **Deliverables: raw reference pages under `content/docs/reference/`, ONE stage ledger `ENCYCLOPEDIA-LEDGER-E2.md`, ONE `E2-REPORT.md` — all on the task branch of the landing repo.** PARTIAL fills touch the named EXISTING pages, sentence-level additions only.
> **Scope SSOT: `ENCYCLOPEDIA-CENSUS.md` at the landing repo root** (merged by the E1 harvest PR). Your id set: census families **B and C** — every `MISSING` id (55) PLUS the three shared skill-context rows **E15-E17** (same files as C21-C23; E2 drafts those three pages once, satisfying both row sets) and every `PARTIAL` id of B+C (B4, B6, B11, B15, C12). If the census file is absent from your branch: **STOP — BLOCKER** (E1 not merged; report, do not improvise).
> **Rigor label (effort-worthiness L0):** `build-and-verify` — pages land on the live site's tree and the build + wiring gates prove them; the census is research-grade input you do not re-litigate, only re-anchor at your pin.

<!-- host-verify: none — stage kickoff: it authors no executable deliverable in this repo. Its acceptance commands (§3) run in the aif container's landing worktree (build, grep, git diff); the artifacts are Markdown pages harvested by the host. -->

## §0 Goal

Every census B/C row that the site does not document gets a **raw reference page** on the live site's tree, enumerated from the implementation at a recorded pin — plus the three shared E15-E17 pages. Raw-first is the umbrella's contract with the operator (§0 there): factual, anchored, plain is fine; polish/UX/sellability is the operator's LATER pass. A page blocked on prettiness is a violated stage (T-ENC-C).

## §1 Do this FIRST — entry re-verification

Facts measured **2026-09-11 from the host**. Snapshots: **re-verify, act on what you find**, quote command + output for each (T3).

| # | Fact at authoring | How to re-verify |
| --- | --- | --- |
| 1 | Your task worktree branches from landing `origin/main` which CONTAINS `ENCYCLOPEDIA-CENSUS.md` at root (E1 artifacts merged via reviewed PR; census pin stamped inside = `a1337cb301`, 252 rows) | `ls ENCYCLOPEDIA-CENSUS.md`; `head -5 ENCYCLOPEDIA-CENSUS.md`; absent → **BLOCKER, STOP** |
| 2 | **Re-pin before drafting** (E1 finding F-4 + parked Q3, resolved): fetch the canonical framework staging by URL — `git -C /home/www/rules-as-tests-aif fetch https://github.com/artyhoo/getff.git staging` — then `git -C /home/www/rules-as-tests-aif rev-parse FETCH_HEAD` is **your working pin**. Verify ancestry: `git merge-base --is-ancestor a1337cb301 FETCH_HEAD && echo PIN-OK`. The clone's own `origin` is a FORK (E1 F-3) — do not re-point it, do not checkout/reset, read-only | the commands; if the fetch is impossible, fall back to the standing clone HEAD + record the shortfall as a finding (E1 precedent) |
| 3 | **Delta re-check (W2 transfer discipline, from E1 D2.0):** `git -C /home/www/rules-as-tests-aif diff --name-only a1337cb301..FETCH_HEAD` ∩ the anchors of YOUR census rows → every intersecting B/C/E15-E17 row gets a fresh probe at the new pin before you draft its page; non-intersecting rows transfer | the intersection list + per-row re-probe outputs in the report |
| 4 | Landing registries a new page must join (mirror `factory-overview` / `daily-cycle-factory`, the most recently wired pages): nav registry `content/docs/meta.json` (a `---Reference---` section exists; a `reference/` subfolder may carry its own `meta.json` — read `lib/source.ts` for how the tree resolves), the raw-md twin `app/docs/<path>.md/route.ts`, `llms.txt`/`llms-full.txt` (tree-generated — prove inclusion, don't assume), search (`app/api/search`) | `cat content/docs/meta.json`; `ls app/docs/`; read one existing twin route end-to-end |
| 5 | Egress to github.com WORKS again in the container (E1 F-3); npm registry reachable; you NEVER push — the host harvests | `curl -m 6 -sS -o /dev/null -w '%{http_code}' https://github.com` |
| 6 | Toolchain node v22 / npm 10; a full `npm ci` (fallback: `npm install`) + `npm run build` IS part of this stage (unlike E1) | `node -v; npm -v` |
| 7 | Production is live and green (host snapshot 2026-09-11). Do NOT probe the public site | host-side fact; no container action |

## §2 Deliverables

### D1 — raw reference pages (58 total: B+C MISSING 55 + E15-E17 trio)

Under `content/docs/reference/`, one page per census id, **schema verbatim from the umbrella kickoff §2** (frontmatter title/description → provenance comment with YOUR pin + date → `# Item` → Status/Ships-to/Fires-at line → What it is → How it works → Satellites & companions (USES/ADAPTS/ADDS) → Anchors with quoted lines). The census row IS the page's fact base: its `what`, `ships-to`, `anchors`, `satellites` columns seed the sections; you verify each anchor at YOUR pin (§1 row 3) and expand from the implementation — never from another page, never from memory (T12). B17-B41 (the 25 clone-only aif-operator skills) are short per-skill pages — raw and terse is correct; one worked example early, then hold the shape.

### D2 — PARTIAL fills in EXISTING pages (B4, B6, B11, B15, C12)

Sentence-level additions of the missing detail the census row names — nothing else on that page changes. No rewording of existing sentences (T-ENC-C); the diff for each touched page must read as additive lines only.

### D3 — `ENCYCLOPEDIA-LEDGER-E2.md` (the stage's D7 ledger)

One row per capability sentence across your new pages: `| page | sentence (short) | evidence anchor(s) at pin |` — or an explicit `experimental`/`planned` label carried on the page. Per-stage file ON PURPOSE (parallel siblings E3-E5 write their own; E6 consolidates into `CLAIMS-LEDGER.md`): do not touch `CLAIMS-LEDGER.md`, do not touch sibling stages' files.

### D4 — `E2-REPORT.md`

§1 rows with outputs · §3 gate table with outputs · T7 · findings · parks · the verdict line:
`E2: GREEN — 58/58 pages drafted (55 B+C MISSING + E15-E17 trio), 5/5 PARTIAL filled, <n> ledger rows, build green, wiring proven`
or `E2: FAIL — <which row, with output>`.

## §3 The gate — run it, quote command + output (T2/T3)

| # | Check | How |
| --- | --- | --- |
| 1 | Diff shape: only `content/docs/reference/**` (new), the ≤5 named PARTIAL pages (additive), `ENCYCLOPEDIA-LEDGER-E2.md`, `E2-REPORT.md` | `git status --porcelain`; `git diff --stat origin/main` |
| 2 | Census coverage complete: every B/C MISSING id + E15-E17 has a page or a recorded finding; every B/C PARTIAL id filled or finding | id-by-id read-back against the census roll-up in the report |
| 3 | Page schema conformance: frontmatter + provenance (your pin) + Status/Ships-to/Fires-at + the four sections | sweep all 58; quote the count that passed |
| 4 | Anchors: every page ≥2 `file:line`, ≥1 with the line quoted, resolvable at YOUR pin | mechanical sweep + spot-quotes; anchor paths exist (`test -f`) |
| 5 | Ledger: every capability sentence rowed or explicitly labeled | count pages' capability sentences vs ledger rows; quote the tally |
| 6 | Wiring: each new slug appears in the nav registry, has its `.md` twin route, and shows up in the build's `llms.txt`/`llms-full.txt`/search output | grep each registry + the built artifacts; quote one slug's proof end-to-end |
| 7 | Build green | `npm ci \|\| npm install` then `npm run build` — quote the tail |
| 8 | No styling/restyle/announce-touch: zero edits to css/components/layouts; the announcement frontmatter untouched | `git diff --name-only origin/main \| grep -E '\.(css|tsx)\|announcement'` → expect only the twin routes you added |
| 9 | T7 counter-prompt ran and is reported | the report's T7 section |
| 10 | T19 cold pass over all pages before done | the report's T19 note |

**On any FAIL:** report it with the output and **STOP**. No fix-forward past the gate.

## §4 Out of scope — and the floors

- **No framework-repo writes.** Read `/home/www/rules-as-tests-aif` at your pin; its defects are findings (E1's 7 + F-1 stay parked for the operator's fix dispatch).
- **No new scope.** Only census ids listed in §Scope; a capability you discover un-censused is a FINDING, not a page.
- **No polish.** No restyling, no rewording existing prose, no information architecture work (T-ENC-C).
- **No pushes/PRs**; commit on the task branch, the host harvests (§6).
- **Sibling isolation:** E3/E4/E5 may run concurrently on the same container base. Never enter their worktrees; your file set is disjoint by design — keep it that way.
- Operator forks → **park** (aif park/answer) and continue park-independent work, or exit clean.

## §5 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

Active traps: **T2, T3, T7, T10, T12, T14, T19** + umbrella **T-ENC-A/C**.

- **T2** — every §3 row is run, not described. **T3** — command + output or `file:line` with quoted content, never prose-only.
- **T7** — adversarial counter-prompt before green: «what would make these pages look documented when they are not?» Actually check: pages whose Anchors quote the CENSUS instead of the implementation; a slug wired into nav but missing from the twin/llms/search; capability sentences smuggled without ledger rows; the 25-clone-only-skills batch degrading into one summary page.
- **T10** — enumerate before claiming: all 58 ids accounted for, not "the important ones".
- **T12** — every framework fact from the clone at YOUR pin (§1 row 2), never memory — the census itself is 12+ commits stale by now, which is exactly why row 3 exists.
- **T14** — coverage bounds the verdict: 10/10 gate rows. **T19** — cold self-pass over every page before reporting done.
- **T-ENC-A** — a page documents its item with sentences + anchors, not a title and vibes. **T-ENC-C** — polish creep: the moment you reword an existing sentence for flow, you have left the stage.

## §6 Dispatch + runtime facts (for the dispatching session, not the worker)

- **Project:** `361685f1-6fe0-407d-a492-ebcfa259407f` (`getff-landing`). The operator shell may export `RUNTIME_BRIDGE_AIF_PROJECT_ID` pointing at the FRAMEWORK project — the dispatch payload pins `projectId` explicitly (the BS2 lesson).
- **Branch naming:** aif names the worker's branch `feature/beta-docs-encyclopedia-<taskid>`.
- **Harvest:** host harvests the branch and opens a PR to landing `main` (merge-commit, PRs #5-#9 convention); merge fires Pages deploy — check it green. Four sibling PRs (E2-E5) merge sequentially; file sets are disjoint so each merge is clean.
- **No preset, no profile override** — the project's mode tiers resolve to the executor profile.
- **Pre-dispatch:** E1 must be harvested+merged (census on `main`) BEFORE unpausing this task.

## §7 Report format

`E2-REPORT.md` at the branch root: §1 re-verification rows with outputs (incl. your pin + the W2 delta list) · §3 gate table with actual outputs · T7 counter-prompt · findings (uncensused capabilities, framework defects seen, wiring surprises) · parked questions · the verdict line.
