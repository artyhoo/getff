<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage-scoped dispatch input — S-E of the arch-v2-context-pipeline umbrella. Marker carried per /arch §3 D1 exception: this kickoff is produced by the 2026-08-06 /arch contour and is plan-complete (decomposition + descopes encoded below); the dispatcher MUST re-verify the fidelity-verdict-in-pr-body precondition at dispatch time per the umbrella §0. -->

# arch-v2-context-pipeline S-E — budget gate + config-assertion asserts + attribution

> **Stage goal:** make session context a gated convention (ADR-3) and give context config a
> failure signal. **Design SSOTs (read both, in full):**
> [`2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
> — ADR-3 (gate at pre-push/CI, measurement-vs-gate split, the FIRED falsifier note);
> [`2026-08-06-pipeline-token-economy-design.md`](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
> — §2 (asserts + backstop), §3 rows P2/P3/P11/P14, §0.5/§0.6 (priority + agnosticism).
> Umbrella context (sequencing only): [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md).
>
> **This stage is S-E only.** S-D′ (subtraction maps) and S-G (trim/small-fixes) are OUT OF
> SCOPE — do not implement, do not pre-wire. A systemic issue noticed mid-stage is surfaced as
> a PR-body observation, never an extra PR ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

**Base:** `origin/staging`. **Mode:** implementation, one PR onto staging.

## §1 Deliverables (decomposition — all decisions already taken, none re-open)

1. **P2a — committed-list liveness principle test** (next free slot under
   `packages/core/principles/`): every `claudeMdExcludes` entry in `.claude/settings.json`
   evaluated with `picomatch` (absolute paths, `{dot:true}`) against the repo file tree; any
   entry matching 0 files FAILS with the entry named. Behavioural — no prefix-form check
   (`**/` works via picomatch semantics, NOT the normaliser; spec §2). `picomatch` becomes an
   explicit **pinned** devDependency → this is a **capability commit**: `Prior-art:` trailer
   (verdict ADOPT verbatim — picomatch is the matcher the shipped client bundles) + SSOT entry
   in the same commit. Register the new test file in any principle-test allowlists (probe per
   umbrella §0 Phase -1).
2. **P2b — local-shadow pre-push section** (+ `worktree-doctor.sh` arm): if
   `.claude/settings.local.json` defines `claudeMdExcludes`, its picomatch match-set must be a
   superset of the project list's match-set — else error-with-escape-token (rationale ≥20
   chars, `ci-tool-pinning.md §3` precedent). Host-only channel: CI cannot see the file.
3. **P3a — wire the EXISTING `scripts/check-alwayson-budget.sh`** (ceiling 101,000 B, `:8`)
   into `.husky/pre-push` + CI mirror, with **per-environment ceilings** (N2 label required —
   the gate refuses an unlabelled ceiling) + escape token. REUSE — do not write a new gate.
4. **P3b — fix `scripts/measure-always-on.sh` blindness:** it must apply the effective
   `claudeMdExcludes` (project ∪ local override semantics) so its output can serve as the §2
   item-3 fallback outcome channel.
5. **P3c — `InstructionsLoaded` verification task** (ADR-3): can a hook on it OBSERVE the full
   loaded set, and can it BLOCK? Primary-docs verification, verdict recorded either way with
   citations. Doubles as the measurement-extension probe (ADR-3 falsifier note).
6. **P3d — N2 attribution extension** to the stage-A aggregator: per-turn re-write trigger
   classes (TTL expiry / `/compact` / resume) sized against WRITE [W]; arrival-position
   distribution of tool output; edit-time-injection firing rates.
7. **P11 — subagent probe:** one measured host session each for `Explore` and `Plan` — do they
   load `.claude/rules/` at all? Result recorded as a research-patch note; S-D′ consumes it.
8. **P14 — harness-remainder price list:** per-block token cost of the non-repo resident load
   (MCP tool schemas + server instructions, plugin SessionStart injects, skills/agents
   listings, memory index) via the P3c channel + `/context`; deliverable = a
   settings-recommendations doc with per-item cost. Recommendations only — settings stay
   operator-applied (agent-uncommittable).

**Descopes (encoded, binding):** no CLAUDE.md/traps trim (S-G owns); no subtraction maps
(S-D′ owns); no Bash-output economy (L1 dropped on the RTK measurement, SSOT #233); no
re-derivation of any §2/§4 prep-doc fact.

## §2 Permitted files

`packages/core/principles/*` (new test + allowlist), `packages/core/hooks/pre-push.ts` /
`.husky/pre-push`, `scripts/check-alwayson-budget.sh`, `scripts/measure-always-on.sh`,
`scripts/worktree-doctor.sh`, `package.json` + lockfile (picomatch pin),
`docs/meta-factory/research-patches/*` (P3c/P3d/P11/P14 outputs),
`docs/meta-factory/prior-art-evaluations.md` (P2a SSOT entry), `.github/workflows/*` (CI
mirror only). NOT permitted: `.claude/settings.json` (operator-only), `.claude/rules/*`,
`CLAUDE.md`.

## §3 Acceptance

```bash host-verify
npx vitest run packages/core/principles
bash scripts/check-alwayson-budget.sh
bash scripts/measure-always-on.sh
```

Plus review-time: the P2a test FAILS on the current staging `settings.json` (7 relative
entries) and PASSES after the operator's P1 fix — both runs quoted in the PR body; the escape
token tested (<20-char rationale fails); every ceiling carries an environment label; P3c/P11
verdicts carry primary-source citations whichever way they land.

## §4 AI-traps

See [`ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md) (cited per §3 of that rule).
**Active traps for this stage: T2, T3, T6, T14, T16, T20.** T2 — P3c/P11 must be RUN, not
designed («would verify» = failure); T3 — every measurement row carries command + output;
T6/T14 — a probe that cannot observe reports «coverage insufficient», never «clean»; T16 —
picomatch-in-tree (2 majors) is not picomatch-pinned: verify the pinned major matches the
client's, not just the name; T20 — no verdict without quoted evidence.
**T-SE-A — gate-green-on-broken-config:** the tempting test asserts the glob FORM (passes
forever, catches nothing — the round-1 reviewer's form-proxy finding). Counter: assert
match-COUNT against the real tree; the acceptance run against the broken staging config MUST
fail (§3).
**T-SE-B — pricing-by-assumption:** P14 tempted to price harness blocks from byte-size
estimates. Counter: every price row names its measurement channel; unmeasurable rows say
`UNMEASURED — channel absent`, never an estimate dressed as a measurement.
