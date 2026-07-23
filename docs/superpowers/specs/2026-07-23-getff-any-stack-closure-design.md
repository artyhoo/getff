# getff any-stack closure — design

> **Status:** BINDING design — two /arch §2 cold-review rounds complete (2026-07-23).
> Round 1 (top-down Fable REVISE ×5 MAJOR; bottom-up Opus REVISE ×1 BLOCKER — re-grounded W1
> on the post-#1076 seam) folded in full. Round 2 (both seats Opus per the operator model
> ladder): top-down **GO** (3 MINORs folded: D8 third executable encoding, W5.7 Tier-2
> carve-out, D7 external-fact watch); bottom-up REVISE with two localized factual corrections
> (SQLAlchemy-Homepage misread; `validateWithResolved` alias naming) — both applied verbatim
> in this revision; FastAPI PyPI Documentation-URL live-verified by that reviewer. Authored 2026-07-23 in the `/arch` getff-idea-status session
> (worktree `session-6ab41c`), from three independent live measurements at `origin/staging` =
> `039790bbe`: (a) a repo-inventory sweep (11 chain links, vitest runs in a scratch clone),
> (b) a fresh FastAPI+SQLAlchemy consumer probe (full install + live research→rule attempt),
> (c) a refresh probe on the operator's real pnpm/Turborepo monorepo `timeliner` (6-week
> upgrade path). Load-bearing anchors were re-verified against `git show origin/staging:<path>`
> by the authoring session AND independently by the round-1 bottom-up reviewer (~20 anchors
> "verified clean"; its BLOCKER corrected the one stale wall).
> **Authoritative for:** the any-stack closure program design — measured walls (§1), binding
> operator decisions (§2), program done-criterion (§3), work blocks W1-W6 (§4-§9), umbrella
> decomposition + tier routing (§10), non-goals (§11), open forks (§12), risks (§13).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> Per-commit build-vs-reuse gate — [CLAUDE.md](../../../CLAUDE.md). The `rule-tests` skill
> surface — [2026-07-21-rule-tests-surface-design.md](2026-07-21-rule-tests-surface-design.md)
> (this spec extends its lane-honesty map; the ONE renegotiation it makes is D8, recorded
> explicitly). Adapter-factory conformance contract —
> [2026-07-22-adapter-jig-design.md](2026-07-22-adapter-jig-design.md). Trust-tier doctrine —
> [.claude/rules/research-source-trust.md](../../../.claude/rules/research-source-trust.md)
> (this spec WIRES the existing tiers; it does not redefine them).

## §1 Problem + measured evidence

The product thesis ("install getff into any project → the agent detects the stack, provisions
tools, researches the stack's LIVE docs, generates executable rules + firing tests, and keeps
them fresh") is **capability-complete but reachability-broken**. Three independent measurements
at `039790bbe`:

**The engine works** (proof, not narrative):

- The neutral IR + backends render and fire: 15 vitest suites / 0 fail in a scratch clone at
  `039790bbe`; adapter-jig conformance (22 arms) green
  (`packages/core/principles/33-adapter-jig-arm-registry.test.ts:50-51` asserts length 22).
- A Tier-0-provenance researched practice reaches a real consumer and fires:
  `getff-researched-no-yaml-load` rendered into the fresh FastAPI consumer via
  `rule-bootstrap-cli.ts --from-practice`, joined by `_py_join_researched_rules`
  (`setup.d/45-python.sh:161`), lock 4→5, `ast-grep scan` RED on `yaml.load` / GREEN on
  `yaml.safe_load` (probe, quoted tool output).
- The same pipeline renders a FastAPI/SQLAlchemy-class practice (`no legacy session.query`)
  when given a trusted host, firing RED on `db.query(User)` / GREEN on
  `db.execute(select(User))` (probe diagnostic).

**The walls (round-1 bottom-up reviewer verified every row; row 2 is its corrected form):**

| # | Wall | Evidence |
|---|---|---|
| 1 | Provenance is Tier-0-only at the GENERATION bridge | `packages/core/synthesizer/research-to-node.ts` header: "this bridge ships the Tier-0 path only"; `:44` imports the one-arg `validateProvenance` from `research/allowlist.ts`; `render-researched-astgrep.ts` threads no `ResolveCtx`. `allowlist.ts:21-42` has no `docs.sqlalchemy.org` / `fastapi.tiangolo.com`. Probe: `research-only (provenance-rejected): unknown allowlistKey: sqlalchemy.official` |
| 2 | Tier-1/2 machinery is wired at the VALIDATION layer but NOT at the generation bridge | PR #1076 (`6f1c6be02`, ancestor of `039790bbe`) wired `pipAdapter`+`cargoAdapter` into production `ResolveCtx`: `synthesizer/resolve-ctx.ts:58-59`, consumed by `synthesizer/cli.ts:70` + `synthesizer/file-clients.ts:48` (`validateResearchPlan(parsed, resolveCtxForRoot(...))`); `research/ecosystem-unwired-debt.test.ts:106` `BASELINE = 0`. The exported two-arg `validateProvenance(p, resolved, opts?)` exists (`allowlist-resolver.ts:375-377`; imported as the alias `validateWithResolved` at `allowlist.ts:16`). The GENERATION path (wall 1) never receives that ctx — that thin threading is the remaining gap |
| 3 | Python lane ships no agent surface | `install.sh:200-201` `do_python_lane`: "runs the pure-bash delivery ... and EXITS — it never enters the npm package.json precondition, stack pick, or the setup.d layer loop". Probe: no `.claude/`, no `.ai-factory/`, no hooks, no `.mcp.json`, no AGENTS.md on the FastAPI consumer |
| 4 | The documented research path is js-only | `agents/rule-researcher.md` mentions the python `--from-practice` / `.getff/rules-research/` path 0 times (grep-verified); it writes `.ai-factory/rules-research/` (the js path), which the python lane currently forbids (see D8) |
| 5 | Generation CLI needs framework node_modules | probe: `ERR_MODULE_NOT_FOUND: ajv` until `npm ci --prefix packages/core`; contradicts the python lane's "no Node dependency" promise (INSTALL-FOR-AI.md python segment) |
| 6 | Freshness is a nudge on npm lane, absent on python lane | `.claude/hooks/deps-hash-check.sh:13-14` "Non-blocking; always exits 0" (WARN piggybacks a `/rule-tests` pointer, `:284-297`, glob-scoped to `.ai-factory/synthesizer-output/rules-lock*.json`); python consumer: no hook at all, `rules-lock.python.json` `"version": null`, dep downgrade produced zero signal (probe) |
| 7 | Deceptive signals | (a) `packages/core/synthesizer/run-generated-rule-mutation.sh:175-178` skips a rule whose selector does not fire (WARN + `continue`), then `:227` prints `PASS — all generated rules ≥60% kill rate` when `OVERALL_FAIL==0` — PASS with 0 rules actually tested; (b) pre-push lychee section (`packages/core/hooks/pre-push.ts:1273`, owner `both`) blocks a consumer push on dangling framework-internal refs in SHIPPED files (timeliner probe: 19 errors, all framework-shipped paths); (c) BOTH shipped datetime rules — `packages/core/templates/python/.getff/astgrep-rules/getff-no-datetime-now.yml:9` (`datetime.now($$$ARGS)`) and its sibling `getff-no-datetime-datetime-now.yml:9` (`datetime.datetime.now($$$ARGS)`) — flag `datetime.now(timezone.utc)`, the exact idiom the sibling shipped ruff config recommends (`packages/core/templates/python/ruff.toml:9`); (d) python CI template `packages/core/templates/python/github-actions-ci.yml:14-19` triggers on `branches: [main]` only — a `master`-default consumer gets zero CI enforcement; (e) refresh leaves a skill-rename orphan (`.claude/skills/rules-as-tests/` + `.claude/skills/getff/` coexist) and does not surface the stale consumer `.lintstagedrc` (prettier-only; current shipped template `packages/core/templates/shared/.lintstagedrc.json` includes `eslint --fix --max-warnings=0`); (f) `inject-matching-rule` hook ships without any `.claude/rules/` corpus → permanent silent no-op (timeliner probe); (g) a pre-push run on the real monorepo copy scanned `.claude/worktrees/**` and `.stryker-tmp/**` (probe observation, 280 nested-scan lines; the responsible walker is NOT yet located in shipped hooks — investigate-class, see W5.7) |

**What works today and must not regress:** per-workspace stack detection (timeliner: 6/6
workspaces correct with provenance), edit-time ESLint RED per workspace, consumer pre-push
owner-split (first consumer push succeeded; the historical block-all regression is fixed),
python starter rules fire RED via ast-grep, install banners honest about what they claim,
`--refresh` preserves consumer-owned files.

## §2 Binding operator decisions (2026-07-23, this session)

Recorded per /arch §1 with falsifiers. Future sessions must not silently reopen these.

- **D1 — "One button" = one beat through the human's eyes.** The button is the instruction to
  the consumer's agent (INSTALL-FOR-AI.md is already AI-first). After install the agent MUST
  continue into research→rules in the same session without a second human prompt. NOT a literal
  single non-agent process. *Falsifier: operator later demands a no-agent `npx getff init`
  end-to-end — different architecture, new program.*
- **D2 — Scope = level 1 fully + a two-client seam for level 2.** Level 1 (rules + their tests,
  any stack) closes now. Level 2 (generating the stack's TOOLING — which MCP/skills a
  stack+version needs) is NOT designed in detail here, but (a) its umbrella kickoff STUB is
  authored in this program, and (b) the W4 ledger/staleness seam is designed two-client
  (rules-decisions + tool-decisions) so level 2 plugs in without rework. *Falsifier: the seam
  proves insufficient when level 2 unfolds — reopen W4 design, not level-1 scope.*
- **D3 — Trust derives from the project's declared stack (Tier-1).** Packages declared in
  `pyproject.toml`/`package.json`/`Cargo.toml` anchor trust; each package's official docs
  domain is derived from its own registry metadata, per the existing adapters. Tier-0 stays
  the built-in core; Tier-2 stays explicit consumer ack. Hand-growing Tier-0 per stack is
  REJECTED (the pre-baked-rot pattern this project exists to kill). *Falsifier: a real
  spoofing incident via registry metadata — tighten guard-rails (§4), do not revert to
  Tier-0-only.*
- **D4 — Ordering = approach C (hybrid).** Honest-signals hotfixes ship as their own cheap
  umbrella immediately ∥ the any-stack proof runs as a vertical python-lane trace (worst-case
  lane) → widening (js/rust parity + full freshness + level-2 seam) after the trace proves the
  thesis. *Falsifier: operator reprioritizes toward a js-first announce set.*
- **D5 — Probes persist as working projects.** `~/code/apiapp` (fresh FastAPI+SQLAlchemy
  consumer, branch `main`, python lane installed, researched yaml-load rule live) and the real
  `~/code/timeliner` (refreshed to `039790bbe`, 54 files, uncommitted pending operator review)
  are the standing live polygons for W6.
- **D6 — Execution model (operator model ladder).** Top tier designs (this session); mid tier
  verifies (BOTH /arch review seats = `model: opus`); factory executes (CLAUDE.md tier
  routing: Tier-1 umbrella whole-pipeline on the executor profile via `bridge-profile`
  marker; Tier-2 = factory top tier plans, executor implements/reviews). The operator
  dispatches via `/pipeline`. This session ends at authored kickoffs — NO push, NO dispatch.
- **D7 — pip adapter reads `Project-URL: Documentation` (2026-07-23, resolves round-1
  MAJOR-2; example corrected per round-2 bottom-up).** `research/ecosystem-python.ts:191-213`
  today reads only `Project-URL: Homepage` / `Home-page:`. Live-verified PyPI metadata
  (round-2 review, 2026-07-23): FastAPI — Homepage `github.com/fastapi/fastapi` (multi-tenant
  apex, correctly Tier-1-ineligible per `allowlist-resolver.ts` DN #6), Documentation
  `fastapi.tiangolo.com`; SQLAlchemy — Homepage `www.sqlalchemy.org`, Documentation
  `docs.sqlalchemy.org`. The resolver matches exact hosts + dot-suffix only (no `www.`
  stripping — DN #3, `allowlist-resolver.ts:15-18`), so `docs.sqlalchemy.org` does NOT match
  `www.sqlalchemy.org`: **today NEITHER reference package passes for docs-provenance** — the
  Homepage-only read authorizes the marketing apex, not the docs domain. W1 therefore EXTENDS
  the adapter to also read the Documentation project-URL (multi-tenant apex guard retained
  unchanged); D7 is what makes the §3 reference case reachable at all. *Falsifier:
  Documentation-URLs prove noisy/spoofable in practice — fall back to a recorded coverage
  boundary + revisit trigger.*
- **D8 — the python lane's `.ai-factory/` ban is LIFTED for the agent-surface subtree
  (2026-07-23, resolves round-1 MAJOR-3).** Two shipped contracts collide: the rule-tests spec
  fixes the cross-lane sidecar home at `.ai-factory/rule-tests/<backend>.json`
  (2026-07-21-rule-tests-surface-design.md:133) while the python lane forbids `.ai-factory/`
  (`setup.d/45-python.sh:517` "NEVER .ai-factory/"). Resolution: W2 brings the npm-style agent
  surface to the python lane, which dissolves the ban's premise ("that dir is the npm
  lane's") — the ban is lifted for agent artifacts (`.ai-factory/rules-research/`,
  `.ai-factory/rule-tests/`, `tool-decisions.md`, skill-context), while `.getff/` remains the
  home of python TOOLCHAIN artifacts (astgrep rules, sgconfig, ruff config, python lock).
  This is an explicit renegotiation recorded against BOTH specs (the rule-tests sidecar
  contract is thereby PRESERVED cross-lane, not broken). The ban's THIRD, executable encoding
  — `tests/install-sh/python-entry-lane.test.sh:51-52` asserts `.ai-factory` absent on the
  python lane — MUST be narrowed (drop `.ai-factory` from the assertion, keep
  `eslint.config.mjs`/`.husky`/`package.json`) in the SAME W2 stage that delivers the agent
  surface, else that test goes RED (round-2 review finding). *Falsifier: a consumer-facing
  reason emerges to keep python consumers `.ai-factory/`-free — reopen with both specs at the
  table.*

## §3 Program done-criterion (the operator's test question, made executable)

> Fresh project on an unfamiliar stack (the reference case: FastAPI + SQLAlchemy + Swagger,
> which has NO presets) → operator tells their agent "install getff" → by the end of that same
> agent session the project holds at least one stack-specific researched rule + its firing test
> (RED on planted violation / GREEN on clean code), wired into a channel that actually runs;
> and a later dependency bump produces a visible staleness signal naming the affected rules.

Two honest boundaries, stated up front:

1. **"Any stack" = any stack on a supported package ecosystem** (npm, pip, cargo out of the
   box — covering everything inside JS/TS, Python, Rust). A new ecosystem (Go, JVM) = one thin
   adapter by the existing pattern (`ecosystem-python.ts` precedent); the seam stays open, the
   work is out of this program.
2. **Level 2 executes after this program** (D2): its stub kickoff + seam land here; its
   umbrella unfolds when the seam is merged and measured.

Enforcement is split across two named mechanisms (round-1 MAJOR-5): the deterministic W6
conformance cell (§9.1) for every scriptable step, and the named **one-beat cold-run
protocol** (§9.3) for the semantic property a script cannot check ("cold agent, shipped docs
only, no second human prompt").

## §4 W1 — Trust threading (Tier-1/2 into the generation bridge)

**Intent:** a practice whose provenance host is the official docs domain of a package declared
in the consumer's manifest passes the GENERATION bridge; everything else stays research-only.
Post-#1076 reality (wall 2): the validation layer already resolves Tier-1
(`resolveCtxForRoot` → two-arg validate); the generation path still calls the one-arg
Tier-0 `validateProvenance`. Reuses: `resolve-ctx.ts` (`resolveCtxForRoot`),
`allowlist-resolver.ts` (exported two-arg `validateProvenance`), wired
`pipAdapter`/`cargoAdapter`, `research-source-trust.md` tier doctrine.

Design points (implementation planning is the trace umbrella's job):

1. Thread a manifest-derived `ResolveCtx` into the generation path: `research-to-node.ts` /
   `render-researched-astgrep.ts` / the `rule-bootstrap-cli.ts --from-practice` arm replace
   the one-arg `validateProvenance(p)` (from `allowlist.ts`) with the exported two-arg
   `validateProvenance(p, resolved)` of `allowlist-resolver.ts:375` (aliased
   `validateWithResolved` at `allowlist.ts:16`). Same threading for the clippy bridge
   (`research-to-clippy-node.ts`) and the js ESLint-direct path (`file-clients.ts` /
   `generate.ts`) — one trust semantics across all three lanes (js threading may land in
   widening if the trace stays python-scoped; the SEMANTICS are fixed here, the schedule is
   §10's).
2. Extend `pipAdapter` to read `Project-URL: Documentation` alongside Homepage (D7); the
   multi-tenant apex guard (`allowlist-resolver.ts` DN #6) stays unchanged — `github.com`
   remains ineligible.
3. Guard-rails (unchanged doctrine, restated as requirements): docs domain comes from registry
   metadata of the DECLARED package, never from the agent's prose; realpath-containment and
   `Name:`-field match stay; Tier-2 = explicit consumer ack recorded in a committed file;
   Tier-0 allowlist stays code-not-data.
4. **Paired acceptance = the honesty gate for this block** (round-1 BLOCKER remediation — the
   old BASELINE mechanic is moot at 0). BOTH accept cases are Documentation-URL-derived
   (post-D7; pre-D7 neither passes — see D7): (accept-D7·a) SQLAlchemy declared in
   `pyproject.toml` + provenance `docs.sqlalchemy.org` → rule lands; (accept-D7·b) FastAPI
   declared + provenance `fastapi.tiangolo.com` → rule lands; (reject) identical practice
   JSON with the dependency absent from the manifest → `research-only` refusal. All as
   committed fixtures; each accept fixture ASSERTS the admitting tier is Tier-1 (not a
   Tier-0 leak).

## §5 W2 — Agent surface on the python (and cargo) lane

**Intent:** a python consumer gets the same AI surface an npm consumer gets — skills
(`getff`, `rule-research`, `rule-tests`, `tool-bootstrapping`), agents (`rule-researcher`,
`rule-test-author`), hooks (`deps-hash-check` + `.claude/settings.json` wiring,
`inject-matching-rule` per W5.6 resolution), `.mcp.json` (context7), a starter `AGENTS.md`,
and the `.ai-factory/` agent-surface subtree per D8. All of this is file delivery — no Node
required at install time, so the lane's "no Node dependency" promise holds for INSTALL; the
generation step's Node need is F-A (§12).

Notes: `deps-hash-check.sh` already parses python/rust manifests (`:9-10`) — it needs
delivery + wiring. `do_python_lane` grows a delivery phase instead of exiting before the
skills layer; the npm-assuming steps stay skipped (the INERT-ON-NPM contract in
`setup.d/45-python.sh:42` inverts: python lane consumes a curated subset of the layer list).
Cargo lane mirrors whatever lands here (widening stage, §10).

## §6 W3 — One beat + per-stack research paths

1. **The continuation clause (D1):** INSTALL-FOR-AI.md and the delivered starter AGENTS.md
   instruct the agent to proceed from install directly into `/rule-research` in the same
   session — with an explicit stopping rule (research is skipped only on explicit operator
   opt-out), so "one button" is a property of the shipped instructions, not of luck.
2. **Per-stack paths documented where the agent actually is:** `agents/rule-researcher.md`
   gains the python arm (author `AstgrepResearchedPractice` JSON at
   `.getff/rules-research/<id>.practice.json` → `rule-bootstrap-cli.ts --from-practice` →
   `_py_join_researched_rules`) and the rust arm (clippy bridge), each with its verify step
   (`ast-grep scan` / `cargo clippy`) and honest lane limits (per the rule-tests spec lane
   map). Today's 0-mention state is wall #4.
3. **Node for the generation CLI — open fork F-A (§12),** resolved during trace planning.
4. **Routing after install:** the full author→render→join→lock loop must be reachable from
   the shipped instructions alone (the probe had to read framework sources — that is the
   defect), on both fresh install and `--refresh`.
5. **Done (binding):** the one-beat cold-run protocol (§9.3) passes on a fresh python
   consumer. This is exactly where the probe broke; it becomes the protocol's script.

## §7 W4 — Freshness loop + the level-2 seam

1. **Lock records reality:** `rules-lock.python.json` (and npm/cargo locks) record the
   consumer's actual dependency versions at generation time (today: `"version": null`) and the
   provenance+tier per rule — the substrate for "what went stale".
2. **Targeted staleness:** `deps-hash-check` WARN (already piggybacking `/rule-tests`)
   becomes addressable — lock-diff names WHICH rules cite the changed package. Requires
   widening the WARN's lock glob beyond `.ai-factory/synthesizer-output/rules-lock*.json`
   (`deps-hash-check.sh:284-297`) to the python lock home in `.getff/` — landing in ALL THREE
   hook copies (packages/core SSOT + `.claude` dogfood + plugin twin; byte-identity gate).
   Python lane included via W2.
3. **Ledger `.ai-factory/rules-decisions.md` (deferred Decision C — now lands):** per-rule
   journal: researched-when, from-what (provenance+version), revisit-trigger. **Two-client by
   design (D2):** the same schema+staleness contour serves `tool-decisions.md` (level 2) —
   this is the seam; level 2 must not need a new mechanism, only a new client.
4. **Polarity (open fork F-B, §12, default recorded):** staleness stays a session-time nudge
   by default, with an opt-in gate mode (config). Per `attention-is-not-a-mechanism.md` the
   nudge alone is NOT the load-bearing check — the load-bearing checks are the W6 cell + the
   deterministic lock-drift assertions.
5. **Done (binding):** downgrading SQLAlchemy in `apiapp` yields a signal naming the affected
   rule(s) and the re-research pointer; the lock diff is machine-readable.

## §8 W5 — Honest signals (hotfix umbrella; every fix lands with its paired fixture)

| # | Fix | Anchor | Done-fixture |
|---|---|---|---|
| 1 | Mutation runner: skipped ≠ green | `run-generated-rule-mutation.sh:175-178,223-227` | selector-not-firing fixture → verdict says `N skipped — NOT green`, `tested=0` cannot print PASS (polarity per neighboring `pre-push.ts:919-938` wording) |
| 2 | Consumer push not blocked by OUR dangling refs | lychee section `pre-push.ts:1273`; `transform_internal_refs` coverage | DECIDED here (two-part): (i) hotfix — lychee scoped to consumer-authored changed md (shipped-file paths excluded); (ii) class fix — delivery rewrites framework-internal refs completely (close the 248-file `README.md#why-this-exists` class). Fixture: consumer-clean diff + shipped file with dangling ref → push passes |
| 3 | `datetime.now(timezone.utc)` false positive — BOTH rules | `packages/core/templates/python/.getff/astgrep-rules/getff-no-datetime-now.yml:9` AND `getff-no-datetime-datetime-now.yml:9` vs `packages/core/templates/python/ruff.toml:9` | DECIDED here: narrow BOTH patterns to naive-only (zero-arg `now()`), keeping `datetime.now(timezone.utc)` GREEN, matching the shipped ruff message; fixtures both ways |
| 4 | CI template targets the consumer's real default branch | `packages/core/templates/python/github-actions-ci.yml:14-19` (+ any sibling templates with hardcoded `[main]`) | install on a `master`-default repo → delivered workflow triggers |
| 5 | Refresh reconciles renames + stale companion files | skills orphan (`rules-as-tests`+`getff`), stale consumer `.lintstagedrc` vs `packages/core/templates/shared/.lintstagedrc.json` | DECIDED here: refresh removes the superseded skill dir (framework-owned); for consumer-owned `.lintstagedrc` it PRINTS a migration offer (diff + instruction) and never overwrites |
| 6 | `inject-matching-rule` never silently no-ops forever | hook shipped without `.claude/rules/` corpus | DECIDED here (minimal honest fix): the hook reports corpus absence ONCE, loudly; shipping a consumer rule corpus is recorded as an explicit follow-up decision in the widening umbrella — not silently deferred |
| 7 | Foreign-dir scan — INVESTIGATE-class (not a mechanical fix) | wall 7(g): probe observed `.claude/worktrees/**` + `.stryker-tmp/**` scanned; walker not yet located (grep of `pre-push.ts` finds no walker — only `:1489` unrelated) | stage output = locate the responsible walker (shipped hooks/scripts) and fix with exclusion fixture, OR close as probe-environment artifact with evidence. May NOT be closed silently |

Items 1-6 are mechanical with pre-decided semantics — Tier 1 by the CLAUDE.md criteria. Item 7
is investigate-class (unknown root cause) — per the CLAUDE.md tie-breaker it CANNOT ride the
Tier-1 umbrella; it is carved out as its own micro-umbrella (§10 row
`getff-foreign-scan-triage`, Tier 2, no marker; round-2 review finding).

## §9 W6 — Acceptance: the thesis as standing mechanisms

1. **Cell v1 "unfamiliar-stack e2e"** (consumer-matrix precedent, `audit-self.yml:1319`
   `consumer-matrix-start-cell`), lands with the TRACE umbrella: scripted fresh python project
   (FastAPI-class, `master` default branch on purpose — regression-guards W5.4) →
   `install.sh python` → assert agent surface present (W2) → committed Tier-1-provenance
   practice fixture → generation → assert rule+test land → RED/GREEN firing + the §4.4 reject
   fixture. Runs on PR (ubuntu); the live polygons (`apiapp`, `timeliner`) stay operator-side.
2. **Cell full** — adds the dep-bump → targeted-staleness assertion; lands WITH the widening
   umbrella (it needs W4). The v1/full split is explicit so the trace implementer does not
   guess (round-1 bottom-up finding).
3. **One-beat cold-run protocol (named, resolves round-1 MAJOR-5):** a NAMED cold-agent
   protocol artifact (`agents/` class, session-read, $0-in-CI per
   `no-paid-llm-in-ci.md`) authored in the trace umbrella: a cold agent session in a fresh
   consumer, following ONLY shipped docs, must reach a firing stack-specific rule with no
   second human prompt and no framework-source reading. Run at trace closure and re-run at
   widening closure; its transcript verdict is quoted in the closing PR body.
4. **Committed-fixture debt closes (widening):** ruff/cargo firing moves from synthetic
   smokes to checked-in fixtures (the honest-pending state in `rule-test-author.md:65-69`).

## §10 Umbrella decomposition, tier routing, gates

| Umbrella | Scope | Tier | Gate |
|---|---|---|---|
| `getff-honest-signals` | W5.1-W5.6 | **Tier 1** — kickoff carries the `<!-- bridge-profile: ... -->` marker naming the CURRENT executor-tier profile (instantiation `glm-5.2` as of 2026-07-23 — NOT load-bearing; the dispatcher MUST verify the hint resolves against the live runtime profile list at dispatch prep; `AifHandoffBackend._resolveProfileId` errors loudly on no-match/ambiguity, so a stale name blocks instead of mis-routing) | dispatch after staging placement; parallel with trace — ordering rule: honest-signals stages touching python-lane files (W5.3/W5.4) land BEFORE any trace stage rewriting the same region; OWNER of this rule = the dispatching session at each dispatch, enforced via the pre-dispatch in-flight probe |
| `getff-foreign-scan-triage` | W5.7 only — locate the foreign-dir-scanning walker or close as probe-environment artifact, with evidence either way | **Tier 2** (unknown root cause; CLAUDE.md tie-breaker) | dispatch any time; no shared files with the other umbrellas expected — re-check at dispatch |
| `getff-any-stack-trace` | W1 + W2 + W3 + W6 cell v1 + the one-beat protocol artifact, python lane, done-criterion §3 on `apiapp`-class project | **Tier 2** (design decisions: bridge threading, F-A) | dispatch after staging placement; single-owner-per-stage; pre-dispatch in-flight probe MUST cover `getff-honest-signals` (shared: `45-python.sh`, hooks, python templates) + `ecosystem-wiring` and `rule-tests-surface` residues (`.getff/` paths, deps-hash copies); re-probe after any Phase -1 review |
| `getff-freshness-widening` | W4 full + js/rust parity of W1-W3 + W6 cell full + ruff/cargo committed fixtures + two-client seam + one-beat re-run | **Tier 2** | gated on `getff-any-stack-trace/done.md` |
| `stack-tooling-generation` | level 2 — STUB ONLY in this program | (classified when unfolded) | gated on `getff-freshness-widening/done.md`; unfold-before-dispatch per the U-stub convention |

Process (binding): kickoffs + this spec merge to `staging` before any dispatch
([kickoff-staging-placement.md](../../../.claude/rules/kickoff-staging-placement.md)); each
kickoff carries the principle-12 traps section; each stage = one PR onto staging; umbrella
closure writes `done.md` (CLAUDE.md convention). Dispatch is operator-run `/pipeline`. This
authoring session STOPS at written kickoffs — no push (D6).

## §11 Non-goals (this program)

- npm publish / `npx getff init` (U9/U10/U11 product track — separate program, unchanged).
- A literal no-agent single-process installer (D1 falsifier branch).
- js-convergence onto the shared bridge (FORK-2 follow-on — separate, already decided).
- New package ecosystems beyond npm/pip/cargo (seam only).
- Level-2 execution (stub + seam only, D2).
- Delivery-UX polish of the "button" (operator: worked separately, out of scope here).

## §12 Open forks (deliberately left to stage planning, with criteria)

- **F-A — generation CLI's Node dependency (W3.3):** bundle vs declare-honestly. Criteria:
  bundle wins if the bundling precedent (`synth-and-wire.bundle.mjs`) covers ajv/grammar-gate
  imports without exploding size; declare wins if bundle maintenance cost exceeds the honesty
  cost of "generation needs Node". Resolved by the trace umbrella's planner; either way the
  python-lane INSTALL stays Node-free.
- **F-B — staleness polarity (W4.4):** default recorded = nudge + opt-in gate. Stage planning
  only chooses the config surface, not the polarity.

(F-C was resolved as D8 after round-1 review established it is a contract renegotiation, not
a stage-planning fork.)

## §13 Risks + falsifiers

- **R1 — Tier-1 spoofing surface** (malicious package metadata pointing at a look-alike docs
  domain): mitigated by registry-metadata-only derivation + guard-rails (§4.3) + the retained
  multi-tenant apex guard; residual risk accepted for v1 (declared-dependency compromise
  implies the consumer already runs the attacker's code). Revisit trigger: any real incident
  (D3 falsifier). D7 widens the read surface to Documentation-URLs — same guard applies.
- **R2 — one-beat continuation makes install sessions long/expensive:** the continuation
  clause carries the explicit opt-out (§6.1); the one-beat protocol measures the seam's
  presence, not session length.
- **R3 — parallel umbrellas touch shared files (`45-python.sh`, hooks, python templates):**
  ordering rule + probe coverage per §10; collision fallback = merge-forward per
  [git-conflict-merge-forward.md](../../../.claude/rules/git-conflict-merge-forward.md).
- **R4 — spec claims drift vs staging as other work merges (paths AND lines):** every stage
  re-verifies its anchors live at stage time (T3 discipline); this spec pins its measurement
  to `039790bbe` and promises neither line nor path stability — the round-1 BLOCKER (a
  pre-#1076 wall surviving into the draft) is the standing example of why stage-time
  re-verification is mandatory.
- **R5 — the W6 cell rots into a happy-path smoke:** the cell plants BOTH polarity fixtures
  (accept + reject, §4.4) and the `master`-branch trap (§9.1) — the failure classes the
  probes actually caught; the one-beat protocol (§9.3) guards the semantic property scripts
  cannot see.
