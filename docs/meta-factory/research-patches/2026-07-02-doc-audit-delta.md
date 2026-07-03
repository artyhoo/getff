<!-- scope:doc-audit-delta-post-fqa -->

# 2026-07-02 — Doc-audit delta (post-FQA) + closure verification of June audits

> Session context: Cowork maintainer session, branch `plug-packaging`, working tree clean. Read-only audit — findings only, no fixes applied (maintainer GO required per reviewer-discipline). Method: 3 parallel read-only subagents (closure-verify / delta-sweep / goal-alignment) + orchestrator re-verification of every BLOCKER-class claim before recording (T19).

## §0 Verdict (one screen)

- **All 4 June audits verified CLOSED, zero regressions** — ai-doc-audit (#422), goal-drift-audit (#433), doc-audit-ship-boundary (#374), final-quality-audit (#470). Every fix ID re-checked with file:line evidence (§1).
- **Goal alignment: CLEAN.** README / CLAUDE.md / session-bootstrap / EXECUTION-PLAN §1 all defer goal to `README.md#why-this-exists`; `#operational-doc-redefines-goal` sweep found only guard-text and historical references. CLAUDE.md operational claims: 100% current (§3).
- **2 real findings** in the post-FQA delta, both in the same gap-class: new `.claude/skills/*/SKILL.md` land without Authoritative-for headers AND principle 09's static allowlist doesn't see them → the rule exists but its executable artifact silently doesn't cover the new surface (§2, F1/F2). This is the project's own thesis-violation shape.
- 2 of 3 subagent-reported BLOCKERs were false positives, downgraded on re-verification (§2, FP-log).

## §1 Prior-audit closure verification (no regressions)

| Fix ID (FQA S2 §2) | Status | Evidence |
|---|---|---|
| W1 eslint barrel | CLOSED | `install.sh:960-991` generates `eslint-rules-local/index.ts` |
| P1 tool-decisions seed | CLOSED | `install.sh:782-788`; paired-negative live `tests/install-sh/c1-wiring.test.sh:44-46` |
| W2 dep-cruiser copy | CLOSED | `install.sh:1003,1015` |
| W3 audit-r4.ts shipped | CLOSED | `install.sh:584,822` |
| W4/W5 npm scripts | CLOSED | `install.sh:1304-1312` (validate / arch:check / test:mutation) |
| P2 skill-context 3/3 | CLOSED | `install.sh:111-131` (aif-orchestrator-discipline at :122) |
| P3 tool-bootstrapping currency | CLOSED | `skills/tool-bootstrapping/SKILL.md:51-53` (context7 re-documented) |
| F1(D) principle-15 git-aware | CLOSED | `15-skill-paired-negative.test.ts:120-145` (`git ls-files` filter) |
| F2-FIX / F3(D) orphan deletion | CLOSED | `.claude/skills/meta-orchestrator/`, `probe-cc-perm/` absent (glob) |
| F1-F6(C) doc currency | CLOSED | README badges → staging (`README.md:4-6`); `apply-doc-fixes.test.ts:93-100` |
| ship-boundary DN-1/DN-2/G4 | CLOSED | "Activation pending" absent repo-wide; no mutation job in `.github/workflows/` |
| goal-drift #433 criteria 3&4 | CLOSED | `09-doc-authority-hierarchy.test.ts:57-66` (anti-tautology mutations) |

`tests/install-sh/c1-wiring.test.sh` present with 12+ assertions incl. P1-neg/P1-pos — the de-inertness chain is live, not prose.

## §2 Delta findings (2026-06-13 → 2026-07-02)

Population (T10): 358 md files touched since 2026-06-13 (git log --since, branch `plug-packaging` incl. staging merges). Checked: 18 PRIORITY-A (rules/root/SKILL.md/meta-factory ops) at 100%, 18/172 kickoffs sampled, 2/16 research-patches spot-checked. Not checked: §5.

### F1 — MAJOR `#missing-authority-header`: 2 of 8 project-internal skills lack Authoritative-for header

- `.claude/skills/story/SKILL.md` (landed #592, post-FQA) — YAML frontmatter only, no `> **Authoritative for:**` blockquote.
- `.claude/skills/ai-doc/SKILL.md` — same shape.
- The other 6 (`aif-doctor`, `dispatcher`, `pipeline`, `self-reflection`, `template-audit`, `tool-bootstrapping`) all carry headers (verified by grep loop over `.claude/skills/*/SKILL.md`).
- Rule basis: `doc-authority-hierarchy.md §2` requires headers for skill primary docs.

### F2 — MAJOR (systemic, the load-bearing finding): principle 09 static allowlist doesn't cover 7/8 internal skills → new skills bypass the gate silently

- `packages/core/principles/09-doc-authority-hierarchy.ts:84-86`: the `.claude/skills/` section of `REQUIRED_HEADER_DOCS` lists **only** `tool-bootstrapping` (SKILL.md + 1 reference). No dynamic enumeration exists (`:130-131` classifies a given path as listed-or-exempt; nothing sweeps the actual skills dir).
- Consequence observed in the wild: `/story` shipped 2026-06 headerless and principle 09 stayed green. Exactly the failure-class the project exists to prevent — rule present, executable artifact blind to the new surface.
- Proposal (I-phase, maintainer GO): make principle 09 enumerate `.claude/skills/*/SKILL.md` dynamically (readdir ∪ static list), mirroring the principle-15 `git ls-files` pattern (`15-skill-paired-negative.test.ts:120-145`) so installer-populated clones don't false-RED. Add headers to `story` + `ai-doc` in the same PR (paired: gate + conformance).

### F3 — MINOR (historical): `dispatcher-ux/kickoff.md` lacks the literal ai-laziness-traps.md citation

- `.claude/orchestrator-prompts/dispatcher-ux/kickoff.md:55-57` enumerates T3/T15/T16/T19/T20 + 2 domain traps (T-DUX-A/B) — the substance of `ai-laziness-traps.md §3` reqs 2-3 is present; only req 1 (explicit rule link) is absent. Umbrella closed 2026-06-03 (#407); file entered repo via back-catalog migration #523. Principle 12 green. Informational; fix optional at next touch.

### FP-log (downgraded on re-verification — recorded so future audits don't re-flag)

- **651-line kickoff ≠ violation:** `.claude/orchestrator-prompts/aif-handoff-runtime-bridge-iphase/kickoff.md:3` carries the explicit `transient artifact` 600-line-gate exemption marker (cross-session-kickoff-portability, SSOT #116); the pre-commit gate honors it (`.husky/pre-commit:55-70`).
- **dispatcher-ux "no traps cited" ≠ BLOCKER:** see F3 — subagent grepped for the literal string only; T-enumeration is present at `:55-57`.

## §3 Goal-alignment + CLAUDE.md currency (CLEAN)

- README `§Why this exists` = sole goal owner; methodology explicitly "quality signal, not the goal". CLAUDE.md (:14-16), `.claude/session-bootstrap.md` (:9-15), EXECUTION-PLAN.md §1 (pointer block) all subordinate correctly — quotes verified.
- Sweep `north star|central thesis|main goal|главная цель` over operational surfaces: hits only in CLAUDE.md:16 (preventive directive), CLAUDE.md:87 + EXECUTION-PLAN §1 (incident history), audit-fixes README:31 (methodology description). Research-patches/retros excluded as append-only history.
- CLAUDE.md operational claims spot-verified 12/12: referenced files exist; capability-commit thresholds (50/80 LOC) and package.json regex match `packages/core/hooks/checks/prior-art.ts:80,99-123`; Artifact Ownership Contract paths 10/10 exist.
- `.claude/rules/*.md`: all carry `> **Class:**` line; cross-links between rules resolve.

## §4 Self-application (T15)

This patch: research-patches folder-level authority (no per-file header needed, scope marker present); <600 lines; every finding carries file:line; clean-vs-not-checked distinguished per T14; all subagent BLOCKER claims independently re-verified before recording (T19) — 2/3 fell. Sampling caveat: kickoff back-catalog sampled at ~10% (18/172), so F3-class findings in unsampled kickoffs are *not excluded* — coverage-limited, not clean (T14).

## §5 Not checked

- 152 PRIORITY-D files (done.md markers, pipeline eval data, templates, fixtures) — out of doc-authority scope or derivative.
- Principle-test CI run (node_modules absent in audit sandbox; no `npm install` per economy).
- Global `~/.claude` skills (outside repo), consumer-side installed-header state (principle 09 M1 scope).
- 154/172 kickoffs (sampling floor met, not census).

## §6 Proposed next actions (superseded by §7 — fixes applied same-day)

1. ~~**F1+F2 paired PR**~~ → applied, see §7.
2. ~~F3 citation fix~~ → applied, see §7.
3. Re-run this delta-audit after the react-spa/react-native preset umbrellas (#655/#656) merge — they add consumer-facing doc surface (`packages/preset-*`), which is REQUIRED_HEADER_DOCS territory. **Still open.**

## §7 Applied closure (2026-07-02, same session, maintainer GO «закрой все гэпы»)

TDD sequence: dynamic gate extended FIRST → observed RED with exactly the predicted violation set → headers added → GREEN 30/30.

- **F2 (gate):** `packages/core/principles/09-doc-authority-hierarchy.ts` — added `REQUIRED_PATH_PATTERNS`, `matchesRequiredPattern`, `enumerateSkillPrimaryDocs` (git-aware via `git ls-files`, filesystem fallback, mirrors principle-15 F1(D) pattern); `selectRequiredPaths` now keeps dynamic skill docs → **edit-time channel** (PostToolUse shim) catches headerless skill docs, not just CI. Test: new describe block `dynamic skill-doc enumeration` (7 tests: full-set check, non-vacuity, static⊆dynamic consistency, pattern positive/negative arms, edit-time filter mutation, anchoring sentinel).
- **F1 (conformance) — wider than the audit's sample:** dynamic RED surfaced **6** headerless docs, not 2 (the audit's own agent checked SKILL.md only — references/*.md were also in-scope per rule §2). Headers added: `.claude/skills/story/SKILL.md`, `.claude/skills/ai-doc/SKILL.md`, `.claude/skills/pipeline/references/plain-language-tail.md`, `.claude/skills/self-reflection/references/{forward,backward}-checklist.md`, `.claude/skills/self-reflection/references/anti-patterns-with-examples.md` (the last three upgraded from the informal `> **Scope:**` marker to the §3 format the gate actually checks).
- **Staging reconcile (same day, later):** the audit ran on the `plug-packaging` worktree; `origin/staging` (17 ahead of local `main`, the actual default branch) had **independently** closed part of F1/F2 via DN-M1 (#820-#834 window): story/ai-doc headers + static REQUIRED_HEADER_DOCS expansion to all 10 skills + new rules/presets/agent entries (sentinel bumped to ≤84). Confirms F2's gap-class diagnosis — staging's fix is *still static*; the next new skill would rot the list again. This branch was therefore rebuilt on `origin/staging`: story/ai-doc headers dropped (staging's kept), the **dynamic** gate + 4 references headers + F3 carried over; principle 09/10/12 = 42/42 GREEN on the staging base. Residual headerless set on staging pre-this-branch = exactly the 4 references files (verified via `git show origin/staging:` sweep).
- **F3:** dispatcher-ux kickoff Traps line now cites `ai-laziness-traps.md §2` literally.
- **Rule↔test sync:** `doc-authority-hierarchy.md §2` got a dynamic-enforcement note (both skill roots, origin citation).
- **Recursive self-application, observed live:** principle 10 REJECTED this very patch's first-line scope annotation (free-text ≠ slug) — fixed to `<!-- scope:doc-audit-delta-post-fqa -->`. The framework caught its own auditor.
- **Verification:** principle 09 → 30/30 GREEN; principle 10 → 5/5; principle 11 → 8/8 (needs `--testTimeout` >15s on slow mounts — F1 scan took 10.4s in sandbox; not a code issue); principle 14 → check itself PASS (0 errors), exit-1 only from sandbox `rm` permission on mounted tmp files — environmental, re-verify on host.
- **Committed on `docs/doc-audit-delta-20260702`** (based on `origin/staging`); push from the audit sandbox blocked (ssh egress) — maintainer pushes + PRs to staging.

## §8 DeepWiki cross-check (external view, 2026-07-02)

Trigger: maintainer report «deepwiki.com/artyhoo/rules-as-tests-aif показывает много легаси». Diagnosis, evidence-first:

- **Not an index-staleness problem:** DeepWiki snapshot = `624cf390` (2026-06-29) = origin/staging−1 commit; staging IS the default branch (`origin/HEAD → staging`). The snapshot even includes the #825/#826 EXECUTION-PLAN status-audit («retire stale claims, add post-v1 block»).
- **Primary cause — design-docs synthesized as reality:** DeepWiki presents PROPOSAL/architecture L0-L5 as operational subsystems while `packages/meta-factory/src/*` = skeleton index.ts stubs (verified on staging). The repo docs DO carry FROZEN/authority markers (PROPOSAL.md:9 «**FROZEN** — …», architecture.md header) — the synthesis ignores blockquote authority headers. **Correction (§10 sweep, same day):** this bullet's first version also cited «setup.d/ = 3 files» as counter-evidence — that was the *lagging worktree*, not staging: staging carries the full numbered layer set `05-mcp.sh … 99-finalize.sh` + `LAYERS.md` (modular-install-fullpack S1; byte-identical invariant per `tests/install-sh/byte-identical.test.sh`). DeepWiki's setup.d-layers claim was substantially TRUE — the branch-baseline trap bit this audit itself a second time.
- **Two real repo-side irritants found:** (a) `PROPOSAL.md:3` top-line `Status: **DRAFT / RFC**` sits *above* the FROZEN header (:9) — exactly what an external synthesizer reads first. **DECISION-NEEDED (maintainer-only):** PROPOSAL is read-only for sessions (Ownership Contract) AND criterion-4 pins freeze-SHA `397840c` (`09-doc-authority-hierarchy.test.ts:300`) — the one-line Status fix must be a maintainer commit that bumps `PROPOSAL_FREEZE_SHA` to the new SHA in the same PR. Applied here would have gone CI-RED; reverted after a self-caught criterion-4 trip. (b) `architecture.md` header lacked an implementation-status pointer — **fixed on this branch** (target-design vs built, → EXECUTION-PLAN post-v1).
- **Subagent-claim QA (T19):** the comparison agent's «PROPOSAL never marked frozen» and «install.sh comment says ./setup wraps setup.sh -y» were **both false** on staging (PROPOSAL.md:9 has the FROZEN header; `install.sh:11` comment correctly describes `./setup` as install.sh+companions wrapper) — 2 of its 5 headline fixes rejected on evidence, 2 accepted (above), 1 already fixed upstream (#825/#826).
- **Verdict for the maintainer's question «документация врала?»:** ядро — нет (goal-docs выровнены, FROZEN-маркеры стоят); реальный дрейф был в EXECUTION-PLAN и закрыт #825/#826 ещё 2026-06-29; остаток «вранья» = синтез DeepWiki поверх дизайн-доков + два поправленных здесь маркера. DeepWiki refresh доступен через ~6 дней («recently refreshed» lock) — re-check after next index.

## §9 Full doc-vs-CODE truth sweep (2026-07-02, second pass, staging baseline)

Maintainer follow-up: «а сами доки против кода проверены?» — honest answer was *partially*; this pass closes it. Method: 3 parallel read-only agents over `git show origin/staging:` (≈140 checkable claims extracted from architecture.md, self-application.md, principles-as-tests.md, README.md, INSTALL.md, INSTALL-FOR-AI.md, EXECUTION-PLAN.md, roadmap.md, open-questions.md), every headline verdict re-verified by the orchestrator before any fix (T19).

**Confirmed-TRUE core (samples, agent-verified + spot-checked):** detector contract fields vs `packages/core/detector/types.ts`; research store (9 curated JSON) + synthesizer recipes (10 JSON) exist as v1-stance claims say; INSTALL-FOR-AI.md 19/19 claims; README counts (R1-R11/R12-R20/IR1-IR6, 5 layers, 8 lessons); open-questions.md 0 broken repo-paths; validator gates 1/2/4/6 per §2.6 v1-lock.

**Fixed on this branch (4, each evidence-verified):**
1. `INSTALL.md` — `--full` / `--wire-ci` flags existed in `install.sh:9-11` but were undocumented → documented.
2. `architecture.md:32` — L0 table claimed review-sidecar «with `model: opus` override»; no `model:` field exists in `agents/review-sidecar.md` — override is a v2 trigger per the doc's own §2.6 v1-stance → line now says so.
3. `principles-as-tests.md` header — catalog covers founding P1-P8 while the live roster = 31 test files; header now forbids inferring the roster from the catalog.
4. `EXECUTION-PLAN.md §3.1` — «.husky/ отсутствует, author не запускает» contradicted staging reality (`.husky/{pre-commit,pre-push,post-checkout}` tracked since Phase 1.A `fea6ea7c7`); the #825 status-audit had struck through the neighbouring bullet but missed this one → same-style ЗАКРЫТО annotation added.

**Agent false-alarms rejected on evidence (T19 log):** README «license badge stale» — agent diffed staging against the lagging worktree branch; staging README:3 badge + §License:318-327 + LICENSE.md are consistently FSL-1.1-ALv2. «self-application.md R1-R20 → 26 rules» — IR-rule enforcement surface unproven either way; NOT fixed (needs its own probe). «EXECUTION-PLAN factory/rules-manifest.json + setup.sh:82-97 stale paths» — those lines sit in a dated historical block («Что уже работает на main HEAD `35ab3f9`», 2026-05-07) — point-in-time snapshot, correct as history; retro-editing it would falsify the record.

**Honest residuals (not checked):** aif-comparison.md, failure-modes.md, risks.md, niche-stacks.md, versioning-and-locks.md, core-stability.md, migration-from-current.md substantive claims (low code-claim density, unswept); roadmap.md deep verification (agent sampled, details not independently re-verified); IR-rule enforcement question above. → §10 closed most of these.

## §10 100% living-doc truth-sweep (2026-07-02, third pass — maintainer demand «на 100%»)

Corpus (staging): 204 tracked living *.md(.template); excluded by the project's own filename-convention rule = `docs/superpowers/` dated design specs (46) + research-patches/retros/closed-questions/PROPOSAL (point-in-time artifacts). Swept ≈158 via 6 parallel agents (docs/meta-factory ×33 · .claude/rules ×17 · .claude/skills ×32 · packages+setup.d ×28 · root+agents ×16 · skills-root/plugin/misc); **every STALE verdict re-verified by the orchestrator before action** — mandatory after this session's false-alarm rate.

**Confirmed lies, fixed in commit 3:**
1. `.claude/skills/pipeline/SKILL.md:306,307,331` — cited `queue-mode.md §1 Triggers` as vocabulary SSOT; the file never shipped (`git ls-tree origin/staging` = none; `git log --follow` = never existed). Refs inlined / redirected to the §5 dispatch table.
2. `skills/rules-as-tests/SKILL.md:61-77` (**consumer-shipped**) — «Templates ready to copy» table pointed at `templates/…` and `factory/RULES*.md` relative paths dead since the packages/-monorepo migration (real homes: `packages/core/templates/…`, `packages/preset-next-15-canonical/RULES*.md`; install.sh performs no path rewrite — grep). Table repointed; intro now explains consumer-side placement.
3. `INSTALL-FOR-AI.md:63,75` — the copy-paste AI install prompt instructed `bash setup.sh --stack=<stack>` (legacy entry), contradicting the doc's own :24 preferred `bash setup -y <stack>`. Aligned.
4. §8 of this very patch — setup.d correction above (the audit's own report carried a branch-baseline lie).

**Agent false-alarms rejected this pass (T19 ledger):** «`.claude/rules/reviewer-discipline.md` missing on staging» (exists — agent path-resolution bug; a sibling agent simultaneously verified it CLEAN); «`skills/rules-as-tests/references/*` don't exist» (all 5 tracked on staging — agent's Glob usage broke, its own Read succeeded); «preset-react-spa / preset-react-native / lint-config README / setup.d/LAYERS.md absent» (all on staging — agent baselined the lagging worktree); EXECUTION-PLAN §2 path/line-count drift (dated snapshot block «на main HEAD `35ab3f9`» — history, not currency). Session total: **~8 agent false-alarms caught by orchestrator re-verification vs 7 real lies** — for this repo, subagent STALE verdicts require a mandatory second-source check before edit.

**Late addendum (same day, maintainer challenge «v2 уже реализован?»):** confirmed — the research leg of v2 went LIVE 2026-06-29 (rule-research live-adapter Phase 1 #805/#809; live-research as **default** delivery, augment-first #824/#828; port/adapter surface `packages/core/research/research-port.ts` + `research-adapter-anthropic.ts`), while `architecture.md §2.4` v1-stance still said «deferred as v2 trigger» — an **understating** lie (doc lags reality — the reverse direction of every other finding). Fixed in commit 4: live-adapter update note appended under the §2.4 v1-stance block. Method lesson: the sweep verified «claimed artifacts exist» but never asked «are claimed-DEFERRED things still deferred?» — deferred/negative claims need the same re-verification as positive ones.

**Sweep verdict for «документация врёт?»:** across ≈158 living docs — **8 real lies found in total** (commit 2: INSTALL flags, opus-override, principles-catalog scope, EP §3.1 husky; commit 3: queue-mode refs, shipped-skill template paths, AI-prompt setup.sh; commit 4: architecture.md §2.4 stale «deferred» on live-research) + 1 maintainer-gated (PROPOSAL Status line, §8 DN). Rules 17/17 mechanism-verified live, agents 8/8, templates/presets/install chain claim-checked clean, goal-docs aligned. Everything else is explicitly dated or deferred-by-marker (deferred-claims now spot-checked per the addendum lesson).

## §11 Landing note (2026-07-02, landing session)

- **Split landing:** §7's F1–F3 scope (dynamic principle-09 gate, 4 references headers, F3 kickoff citation, rule §2 note, the §0–§8 form of this patch) landed same-morning as **PR #835** (`fix/principle09-dynamic-skill-docs`, merged 08:26Z) — the «maintainer pushes + PRs» hand-off in §7 resolved as a lift-PR. The carrying PR of this note ships the remainder: the §9/§10 truth-sweep fixes (8 files), this patch's §8–§11 extension, and the §8(a) resolution below. Rebase onto post-#835 staging collapsed the F1–F3 hunks to zero — lift and branch content byte-identical, no divergence.
- **§8(a) DECISION-NEEDED resolved (maintainer-sanctioned):** `PROPOSAL.md:3` status line → `**FROZEN — historical design artifact** (original status at freeze: DRAFT / RFC)`, as a dedicated cross-owner commit (+ one MD040 fence-language repair the pre-commit markdown gate forces on any touch of the file — §4 carve-out class (b), zero rendered-content change). Criterion 4 re-anchored to a **content hash** (`PROPOSAL_FROZEN_SHA256`, sha256 of the file bytes) instead of the §8-anticipated freeze-SHA bump: under squash integration the freeze commit's SHA is unreachable in post-merge clones (`git cat-file -e` fails loud in CI — the same trip §8 recorded in-branch), so a SHA pin cannot survive its own landing; the byte hash pins the identical invariant history-independently (in-repo precedent: install-sh baseline fingerprints). Paired-negative arm reverts the status line to pre-freeze `DRAFT / RFC` and asserts hash divergence.
- **Shipped-file side-effect:** the §10 fix to consumer-shipped `skills/rules-as-tests/SKILL.md` and the queue-mode fix to `.claude/skills/pipeline/SKILL.md` shift one hash line each in every install baseline → all 8 fingerprints regenerated (`SNAPSHOT_MODE=capture`), diff verified to be exactly those two lines per baseline.
