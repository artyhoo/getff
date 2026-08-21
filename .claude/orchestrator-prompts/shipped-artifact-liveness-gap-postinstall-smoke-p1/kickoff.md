# Kickoff — Phase 1: framework-side post-install liveness smoke (live-signal harness extension)

> **Type:** I-phase (execution-build). Self-contained for autonomous aif dispatch. Base: `staging`.
> **Binding spec — READ FIRST:** [docs/superpowers/specs/2026-06-17-post-install-liveness-smoke-design.md](../../../docs/superpowers/specs/2026-06-17-post-install-liveness-smoke-design.md). This kickoff scopes **Phase 1 of §8 only**.
> **Predecessor R-phase:** [docs/meta-factory/research-patches/2026-06-16-shipped-artifact-liveness.md](../../../docs/meta-factory/research-patches/2026-06-16-shipped-artifact-liveness.md) (M1 form-gate + M2 prober already shipped).
> **Umbrella:** `shipped-artifact-liveness-gap` (#550). **Related:** #548, #549, #551.

## The gap (point to design §1)

The framework ships capabilities into consumer projects (sub-agents, skills, hooks, a mutation gate, custom lint rules, scripts). Today nothing proves a shipped capability actually **runs** after install — only that the file is present / config exists. `npm run validate` stays green while a capability is silently dead. Two real incidents on the `timeliner` consumer prove the class:

- **#549** — Stryker installed but produced **0 mutants** on pnpm (checker plugins not discovered). Silently dead; `validate` green. The existing `tests/install-sh/f13-stryker-pm.test.sh` only `grep`s for `"packageManager": "pnpm"` — it checks **config presence**, not that Stryker generates ≥1 mutant. This is the exact form-vs-behaviour gap.
- **#548** — `deps-hash-check` hook false-warned on every prompt on a fresh install. A misfire misleads as badly as silence.

## Goal (Phase 1 scope — framework-side, deterministic)

Extend the existing `tests/install-sh` harness (which already runs in `.github/workflows/audit-self.yml`, already installs onto a tmp consumer, and already runs some capabilities live) so each shipped capability class is asserted by an **observable runtime signal**, not presence/config. Catches **both** motivating incidents **before release**, inside the **one gate where install-correctness is already asserted** — this is **NOT a new CI surface** (design §2). No paid LLM.

## Scope decision — Phase 1 ONLY (DECIDED per design §8, do not re-open)

- Framework-side, deterministic, on the reference fixtures `{npm, pnpm, monorepo}` the harness already builds.
- **NOT** the consumer-side `aif doctor` command (that is Phase 2). **NOT** behavioural `--probe` / M2 prober wiring / skill-liveness (Phase 3).
- The phase order (framework-first → consumer-last) is **maintainer-resolved** (design §8 «Resolved 2026-06-17»). Do not propose a different ordering.

## Design rule (T-smoke-A — binding)

Every assertion MUST name an **observable runtime signal** — a thing the capability emits when actually run — never «present / configured». A check that greps for a config key (the `f13` gap) does NOT qualify.

## Deliverable — four live-signal assertions in `tests/install-sh` (each paired-negative)

For EACH check: (1) assert the live signal on the reference fixture; (2) **paired-negative arm** — inject the defect → the check MUST go RED; remove it → GREEN. A check that cannot go RED on a planted defect is `#discipline-theatre` and is not acceptable. Paste both runs.

### Check 1 — deps-hash hook: no false-warn on fresh install (#548 class) → FAIL
Run `deps-hash-check` on a freshly-installed reference consumer; assert **no WARN emitted** + correct exit code. Home: extend `tests/install-sh/c1-wiring.test.sh` (already runs `deps-hash-check`) or a new sibling test. Signal: hook output carries no warn line on a clean fresh install. Disposition: **Fail** (a misfire misleads as badly as silence — design §4).

### Check 2 — Stryker mutation gate: ≥1 mutant generated (#549 class) → FAIL
Run `stryker run` on a tiny reference fixture across **npm + pnpm**; assert **mutants ≥ 1** (NOT config presence — that is the `f13-stryker-pm.test.sh` gap). Signal: the Stryker report's mutant count ≥ 1. Disposition: **Fail** framework-side (the reference fixture is controlled — 0 mutants there is a real defect, not an env quirk).
- **Fixture + env (specify, do not assume):** decide and document where the tiny mutation fixture lives (e.g. a minimal package the harness installs Stryker into — `@stryker-mutator/core` is currently a dep only of `packages/core`); the worker must ensure Stryker is installed in the tmp consumer. The **pnpm arm requires real pnpm/corepack on PATH** in the CI job that runs this test — if absent, add `corepack enable` (or a pnpm setup step) in that job, OR explicitly `skip` the pnpm arm with a logged reason (never silently pass it).
- **Paired-negative must reproduce the actual #549 condition** (pnpm checker-plugin not discovered → 0 mutants), not a synthetic empty fixture that trivially yields 0.

### Check 3 — custom lint rules R2/R7/R8 (+ react-next preset) actually fire → FAIL
**Two distinct signals — the cited reuse scripts cover only the first:**
- **Arm (i) — rule active in resolved config (REUSE):** assert each rule ∈ `eslint --print-config` on a boundary file (it binds, not merely loaded — the #535 lesson). REUSE `packages/core/audit-self/check-rule-enforced.sh` (+ `check-rule-globs.sh` for glob-reach); harness homes `tests/install-sh/gh-535-rule-enforced.test.sh` + `f3-f7-rule-globs.test.sh`.
- **Arm (ii) — planted violation is actually FLAGGED (NET-NEW, not covered by the reuse scripts):** the cited scripts assert config-resolution + glob-reach only — they do **not** run `eslint` against a violating file. `f3-f7-rule-globs.test.sh`'s own SCOPE NOTE says runtime-flagging is covered by the rule's RuleTester unit test and "a full `eslint .` run needs the consumer toolchain". So Arm (ii) is net-new: plant a violation in a fixture file → run `eslint` on it (consumer toolchain) → assert the rule's error code appears in output. Signal: a planted violation produces a lint error from that rule.

Disposition: **Fail** (both arms). The live-signal that matters is Arm (ii); Arm (i) alone is the form-check half (T16/T-smoke-A).

### Check 4 — shipped scripts exit-0 with meaningful output → FAIL (crash) / WARN (empty-but-clean)
Run the shipped scripts on the reference consumer; assert **exit 0 + non-empty meaningful output** (not crash, not silent no-op). Home: `tests/install-sh/f8-agents-scripts-shipped.test.sh` (already enumerates the shipped script set — use its enumeration as authoritative; do not hard-code a script list from memory). Signal: exit 0 + non-empty stdout. Disposition: **Fail** on crash; **Warn** only for a genuinely empty-but-clean run.

**Fail-vs-warn model (design §4):** **Fail** for deterministic low-false-positive signals (Checks 1–3, plus crash in Check 4). **Warn** ONLY for genuinely env-variant signals where 0 may be legitimate on a consumer's env. **Never warn on a healthy fresh install** — that *was* #548; a warn must always be real and actionable.

**MANDATORY CI wiring (required plumbing, NOT a new CI surface):** the harness gate `tests/install-sh/meta-all-wired.test.sh` fails unless **every** `tests/install-sh/*.test.sh` appears as a `run: bash tests/install-sh/<name>` step in `.github/workflows/audit-self.yml`. Therefore: **prefer extending the named existing test files** (Checks 1/3 have existing homes); **if you create any NEW `tests/install-sh/*.test.sh`, you MUST add its matching `run:` step to the `principles-meta-tests` job in `audit-self.yml`** — this is the only edit to the workflow you may make, and it is mandatory plumbing, not a new CI workflow.

## NOT in scope (defer / do not build)

- Phase 2 consumer `aif doctor` command, output contract, `--json` / `--explain`. Do NOT build.
- Phase 3 behavioural `--probe`, M2 prober wiring, skill-behavioural-liveness. Do NOT build.
- A new `.claude/rules/*.md` rule — the design doc is the spec; do not add a rule file in this task.
- Editing the design doc, README/CLAUDE.md, agent prose, or any file outside `tests/install-sh/`, the reference fixtures the harness builds, and the **single** `audit-self.yml` wiring edit mandated above.
- A NEW CI workflow / GitHub Action. Phase 1 deepens the EXISTING `audit-self.yml` harness only (design §2 — CI-last-resort honored). The one permitted workflow edit is adding `run:` steps for new test files (see MANDATORY CI wiring above) — nothing else.
- **One PR, atomic umbrella scope** (per [CLAUDE.md](../../../CLAUDE.md) «PR strategy»): if you notice a separate systemic issue mid-task, note it in your task notes — do NOT autonomously open a second PR / branch.

## Capability-commit + SSOT obligations (orchestrator handles at harvest)

- Phase 1 extends bash test files under `tests/` — likely **NOT** a capability commit by the [CLAUDE.md](../../../CLAUDE.md) definition (no new explicit dependency; tests live under `tests/`, not ≥80 LOC under `packages/`). If a reusable live-signal helper ≥80 LOC lands under `packages/`, it **is** a capability commit → it carries the `Prior-art:` trailer + SSOT **#131** (design §9.1; #131 confirmed free — current SSOT max = 130).
- The `Prior-art:` commit trailer + the §1.7 Forward/Backward **PR-body** sections are handled by the ORCHESTRATOR at harvest time. You (aif) focus on the four checks + paired-negative proofs + the recursive-self-application proof below. Do NOT block on trailer / PR-body formatting.

## Recursive self-application (T15 — MANDATORY, design §10)

Prove the smoke would have caught the two motivating incidents:

- **#549:** Check 2 on the pnpm reference fixture goes **RED** at 0 mutants (the existing `f13` config-grep would stay GREEN). Paste the RED run.
- **#548:** Check 1 goes **RED** when `deps-hash-check` false-warns on a fresh install. Paste the RED run.

Record both RED + GREEN runs in the task notes. This is the proof the gate is real, not theatre.

## §AI-traps active (per [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

Active: **T2** (build + RUN the checks — actually invoke `stryker` / `deps-hash-check` / `eslint`; designing ≠ running), **T3** (every claim = pasted command output: the RED and GREEN run per check), **T5** (stay in Phase-1 scope — no Phase 2/3 drive-by), **T14** (a clean run at low coverage ≠ «covered»; state coverage honestly), **T15** (the recursive-self-application proof above is mandatory), **T16** (pattern-matching-on-name — a check named «test stryker» that only greps a config key is the exact `f13` gap; assert the RUNTIME SIGNAL, not the name).

Domain-specific:
- **T-smoke-A** — «asserting presence/config instead of an observable runtime signal». Grepping `"packageManager": "pnpm"` (the `f13` gap) in place of asserting `stryker run` emits ≥1 mutant. The defect this whole umbrella exists to kill.
- **T-smoke-B** — «a check that cannot go RED». Shipping the GREEN arm only and declaring liveness «solved». Every check MUST have a paired-negative arm proven to fail on a planted defect (principle-02 paired-negative discipline).

## References

- Binding spec: [design doc §2/§3/§4/§8/§10](../../../docs/superpowers/specs/2026-06-17-post-install-liveness-smoke-design.md).
- [docs/meta-factory/research-patches/2026-06-16-shipped-artifact-liveness.md](../../../docs/meta-factory/research-patches/2026-06-16-shipped-artifact-liveness.md) — R-phase (M1/M2, gate-vs-probe rationale).
- Harness: `tests/install-sh/` (runs in `.github/workflows/audit-self.yml`). Reuse: `packages/core/audit-self/check-rule-globs.sh` + `check-rule-enforced.sh`.
- M2 prober (Phase 3, NOT this task): [agents/shipped-agent-liveness-prober.md](../../../agents/shipped-agent-liveness-prober.md).
- #550 (umbrella tracker), #548, #549, #551.

```bash host-verify
# Retro-marked 2026-08-21: the four §Deliverable checks name these harness homes (Check 1 → c1-wiring; Check 2 → f13; Check 3 arm (i) → gh-535 + f3-f7)
bash tests/install-sh/c1-wiring.test.sh
bash tests/install-sh/f13-stryker-pm.test.sh
bash tests/install-sh/gh-535-rule-enforced.test.sh
bash tests/install-sh/f3-f7-rule-globs.test.sh
```
