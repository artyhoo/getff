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

1. **P2a — committed-list liveness principle test** — slot **34**, PRE-ASSIGNED, do NOT
   re-derive «next free» (S-G concurrently takes slot **35**; both stages would otherwise
   resolve «next free» to 34 independently — verified 2026-08-06, highest existing slot is
   `33-adapter-jig-arm-registry.test.ts` — and git would merge two different `34-*` files
   cleanly into broken numbering): every `claudeMdExcludes` entry in `.claude/settings.json`
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
   **Declared coverage — state it, do not inherit it silently (umbrella §3 gate 2).**
   token-audit S1's falsifier FIRED: the repo-authored injected set this gate can see measures
   **29,589 tok (aif-container) / 39,021 tok (host-cc) against a ~100k session-start total →
   29-39%** ([`2026-07-26-session-start-token-attribution.md:214-218`](../../../docs/meta-factory/research-patches/2026-07-26-session-start-token-attribution.md)).
   The gate therefore governs a **minority share**, and the remaining 60-71% is harness-resident
   and unreachable by any file-trim — it is addressed by P14 as operator recommendations, never
   by this gate. Carry that as a **comment in the gate itself** (next to the ceiling) and as a
   sentence in the PR body. Transplanting the old ceilings while implying whole-session coverage
   is `#hope-as-gate` ([attention-is-not-a-mechanism.md §2](../../rules/attention-is-not-a-mechanism.md));
   the ceiling numbers themselves are re-derived from S1's per-channel table, not copied.
4. **P3b — fix `scripts/measure-always-on.sh` blindness:** it must apply the effective
   `claudeMdExcludes` (project ∪ local override semantics) so its output can serve as the §2
   item-3 fallback outcome channel.
5. **P3c — `InstructionsLoaded` verification task** (ADR-3): can a hook on it OBSERVE the full
   loaded set, and can it BLOCK? Primary-docs verification, verdict recorded either way with
   citations. Doubles as the measurement-extension probe (ADR-3 falsifier note).
6. **P3d — N2 attribution extension** to the stage-A aggregator: per-turn re-write trigger
   classes sized against WRITE [W] — TTL expiry / `/compact` / resume, PLUS the
   config-change class (mid-session model or effort-level switch, MCP server toggle, CC
   update — each invalidates the prompt-cache prefix; added 2026-08-06 from external
   practitioner evidence, to be verified against primary docs before pricing);
   arrival-position distribution of tool output; edit-time-injection firing rates.
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

Plus review-time:

- **P2a discrimination, demonstrated without waiting on the operator.** The test MUST be shown
  to discriminate on BOTH configurations, and neither run may depend on an operator action:
  (i) against the committed list as it stands on staging (7 **relative** entries — verified
  still present 2026-08-06, `jq -r '.claudeMdExcludes' .claude/settings.json`) → **FAILS**,
  naming every inert entry; (ii) against the same list rewritten to `**/` glob form in a
  **fixture / temp copy** the test reads → **PASSES**. Both runs quoted in the PR body.
  Rationale: P1 (rewriting the committed list) is operator-only — `.claude/settings.json` is
  outside §2's permitted set and agent-uncommittable — so an acceptance criterion that waits
  for it is a criterion this stage cannot satisfy. If P1 *has* landed by acceptance time,
  quote the live post-fix run **in addition**, never instead of the fixture pair.
- The escape token tested (<20-char rationale fails); every ceiling carries an environment
  label; the P3a declared-coverage sentence is present in both the gate comment and the PR body
  with the 29-39% figure and its citation; P3c/P11 verdicts carry primary-source citations
  whichever way they land.

## §3a Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
defensible implementations, an undecided design choice, a missing spec detail that changes
behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
`blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
Y») and **stop that task.** Proceed only on the unambiguous parts.

Expected to fire here on: **(a)** the per-environment ceiling numbers, if S1's table does not
resolve one environment cleanly — park with the two candidate ceilings and their consequences
rather than picking the safer-looking one; **(b)** P3c, if `InstructionsLoaded` turns out to
observe but not block — that changes ADR-3's channel choice, so record the verdict with its
citation and park the «promote the gate earlier?» decision; **(c)** P14, when a harness block
has no measurement channel — the answer is `UNMEASURED — channel absent`, never an estimate
(T-SE-B), and if a whole class is unmeasurable, park rather than ship a partial price list as
if complete. Never manufacture a quoted command output for anything outside your environment.

## §3b Parallel stage (S-G) — one shared surface

S-G runs **concurrently** on a disjoint scope (`CLAUDE.md`, `.claude/rules/*`, skills — all of
which §2 lists as NOT permitted here). The single overlap is `packages/core/principles/*`:
S-G adds its own test + allowlist entry there. Work in an isolated worktree
([parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md)); if S-G merges
first, resolve by **merging staging into this branch** — never `git rebase` a published branch
([git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md)). Do not touch any
S-G file to «avoid the conflict»; that is scope creep, not conflict avoidance.

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
