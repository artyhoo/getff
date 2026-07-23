<!-- scope: kickoff — getff-any-stack-trace umbrella. Design base (BINDING): docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §3-§6 + §9.1/§9.3 + §10. Cold-reviewed GO r2 (/arch §2 two-altitude, 2026-07-23). Tier 2 (no bridge-profile marker; factory top tier plans, executor implements). The program's PROOF umbrella: the operator's test question becomes executable on the python lane. -->

# getff-any-stack-trace — kickoff

> **Goal:** make the §3 done-criterion real on the worst-case lane (python): fresh
> FastAPI+SQLAlchemy-class project → agent install → SAME session ends with a stack-specific
> researched rule + firing test, wired into a live channel — no framework-source reading, no
> second human prompt. Spec is BINDING for all semantics (D1, D7, D8, walls 1-5); this
> kickoff is dispatch input, not a design restatement.
> **What exists (verified at `origin/staging`=039790bbe + round-2 cold review; re-verify live
> per T3):** validation layer already Tier-1-capable — `synthesizer/resolve-ctx.ts:58-59`
> (`pipAdapter`/`cargoAdapter`), consumed at `synthesizer/cli.ts:70` +
> `synthesizer/file-clients.ts:48`; exported two-arg `validateProvenance(p, resolved, opts?)`
> (`research/allowlist-resolver.ts:375-377`, aliased `validateWithResolved` at
> `allowlist.ts:16`); generation path still one-arg Tier-0 (`research-to-node.ts:44`, called
> `:194`; `render-researched-astgrep.ts` threads no ctx; `rule-bootstrap-cli.ts:92`
> `--from-practice` arm receives no ctx). `ecosystem-python.ts:191-213` reads only
> Homepage/Home-page (D7 extends to `Project-URL: Documentation`; FastAPI PyPI live-verified:
> Documentation=fastapi.tiangolo.com, Homepage=github.com apex). Python lane exits before the
> agent-surface layers (`install.sh:200-201`); ban encodings: `setup.d/45-python.sh:517` +
> `tests/install-sh/python-entry-lane.test.sh:51-52` (D8 lifts BOTH in the same stage).
> `agents/rule-researcher.md`: 0 mentions of the python path. Live polygon: `~/code/apiapp`
> (operator-side; NOT a CI fixture).

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement** first ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)).
- **Pre-dispatch in-flight probe** (CLAUDE.md operational conventions) MUST cover:
  `getff-honest-signals` (shared: `setup.d/45-python.sh`, python templates, hook copies —
  its S3/S4 land BEFORE any stage here that rewrites the same region; ordering owner = the
  dispatching session), `ecosystem-wiring` residues (`.getff/` paths, deps-hash copies),
  `rule-tests-surface` residues (sidecar contract — D8 PRESERVES `.ai-factory/rule-tests/`).
  Re-probe immediately after any Phase -1 review.
- **D7 external-fact check at S1 entry:** re-verify FastAPI/SQLAlchemy PyPI metadata still
  carry the Documentation project-URLs (verified live 2026-07-23; registry metadata can move).

## §1 Stages (each = one PR onto staging; do NOT collapse)

- **S1 — trust threading + D7 (spec §4).** Thread manifest-derived `ResolveCtx` into the
  generation path (`research-to-node.ts` / `render-researched-astgrep.ts` /
  `rule-bootstrap-cli.ts --from-practice`): one-arg `validateProvenance` → exported two-arg
  form. Extend `pipAdapter` to read `Project-URL: Documentation` (multi-tenant apex guard
  UNCHANGED — github.com stays ineligible). Honesty gate = the three committed fixtures
  (spec §4.4): accept-D7·a (SQLAlchemy/docs.sqlalchemy.org), accept-D7·b
  (FastAPI/fastapi.tiangolo.com), reject (dependency absent → `research-only`). Each accept
  fixture ASSERTS the admitting tier is Tier-1. Clippy-bridge threading
  (`research-to-clippy-node.ts`) included if cheap, else explicitly deferred to widening in
  the PR body (semantics fixed by spec; schedule is §10's). Capability check: this is wiring
  of existing capability — BFR consult + `Prior-art:` trailer per CLAUDE.md if any detector
  trips (SSOT #183/#223 are the existing anchors).
- **S2 — agent surface on the python lane (spec §5 + D8).** `do_python_lane` grows a
  delivery phase: skills (`getff`, `rule-research`, `rule-tests`, `tool-bootstrapping`),
  agents (`rule-researcher`, `rule-test-author`), hooks (`deps-hash-check` +
  `.claude/settings.json` wiring; `inject-matching-rule` per honest-signals S6 semantics),
  `.mcp.json`, starter `AGENTS.md`, `.ai-factory/` agent-surface subtree. SAME stage: narrow
  `tests/install-sh/python-entry-lane.test.sh:51-52` (drop `.ai-factory`, keep
  `eslint.config.mjs`/`.husky`/`package.json`) and update `45-python.sh:517` prose. Install
  stays Node-free (file delivery only). Fresh-install smoke + byte-identical baselines regen.
- **S3 — one beat + per-stack paths (spec §6).** Continuation clause in INSTALL-FOR-AI.md +
  delivered starter AGENTS.md (agent proceeds install → `/rule-research` same session;
  explicit opt-out rule). `agents/rule-researcher.md` gains the python arm
  (`.getff/rules-research/<id>.practice.json` → `--from-practice` →
  `_py_join_researched_rules`, verify via `ast-grep scan`) and the rust arm pointer, with
  honest lane limits per the rule-tests spec lane map. Resolve fork F-A (Node for the
  generation CLI: bundle per `synth-and-wire.bundle.mjs` precedent vs declare-honestly —
  criteria in spec §12; planner decides, records rationale). Full loop reachable from shipped
  docs on install AND `--refresh`.
- **S4 — acceptance mechanisms + closure (spec §9.1 + §9.3).** W6 cell v1 in
  `audit-self.yml` (consumer-matrix precedent `:1319`): scripted fresh python project,
  `master` default branch, install → agent-surface asserts → committed Tier-1 fixture →
  generation → RED/GREEN firing + reject-fixture. AUTHOR the named **one-beat cold-run
  protocol** (`agents/` class, session-read, $0-in-CI per
  [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)): cold agent, fresh consumer,
  shipped docs ONLY, no second prompt, no framework-source reading → firing stack-specific
  rule; RUN it at closure, quote its verdict in the PR body. New shipped agent → principle-09
  net registration + baselines regen. Umbrella `done.md`.

## §2 «Works» per stage (explicit + testable)

S1: three fixtures green with quoted validator verdicts (incl. tier assertion). S2: fresh
python install shows the agent surface; narrowed lane test green; smokes green. S3: a cold
read of ONLY the shipped docs yields the full author→render→join→lock command sequence
(quoted); F-A decision recorded. S4: cell v1 green in CI; one-beat protocol run quoted RED→
GREEN end state. No «works» claim without tool output (T3/T20).

## §3 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this umbrella: T1, T3, T7, T11, T15, T19, T20, T21.**

- **T3/T20** — every anchor re-verified live at stage entry; quoted tool output on every
  «works» claim.
- **T11** — S1 D7 extension + S4 protocol are near-capability surfaces: BFR consult before
  building; the trailer's verdict must match the diff.
- **T15** — S4's protocol is the recursive self-application: the framework's own docs are the
  system under test.
- **T21** — backward-check via enumeration format; sibling surfaces here are the OTHER lanes
  (js/rust) — name them as SWEPT or GAP, do not restate the diff.
- **T-AST-A (domain)** — Tier-0 leak masquerading as Tier-1 success: an accept fixture can
  pass because the host happens to be Tier-0-listed, proving nothing about threading.
  Counter: accept fixtures assert the ADMITTING TIER, and use hosts absent from
  `allowlist.ts` (fastapi.tiangolo.com / docs.sqlalchemy.org are absent — keep it so).
- **T-AST-B (domain)** — running the one-beat protocol WARM (framework sources or this
  kickoff in context) and calling it cold. Counter: the protocol agent receives ONLY the
  consumer project path; its prompt is part of the shipped artifact and says so.

## See also

- Spec (BINDING): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md).
- Downstream: `getff-freshness-widening` (gated on this umbrella's `done.md`).
- Live polygon: `~/code/apiapp` (operator-side; do not script against it in CI).
