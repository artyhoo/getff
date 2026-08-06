<!-- scope: dispatch-kickoff — adapter-jig J3 RED-CI fix + Option B (backends/golangci/ E3 parity).
     Operator decision 2026-08-01: dispatch the fix work to aif-handoff (autonomous). Option B chosen
     over Option A (lane-only) for E3 structural parity with all 4 existing backends (npm/ruff/astgrep/cargo).
     DOUBLE cold review of THIS kickoff is mandatory before dispatch (operator instruction: «очень тщательное»).
     Tier 1 — executor carries §2.1 design judgment; cold-review is owned by dispatching session, not aif.
     Base branch: staging. aif works DIRECTLY ON feature/adapter-jig-j3-d4db43 (the existing PR #1171
     branch) — does NOT create a new branch. See §1 branch strategy (procedural, unambiguous). -->

# adapter-jig J3 RED-CI fix + Option B (backends/golangci/) — dispatch kickoff

> **SUPERSEDED 2026-08-06 — do NOT dispatch this file.** It was never dispatched, and its §1 is now
> closed: the fabricated `actions/setup-go` SHA, the `install.sh` conflict and the stale synth bundle
> are all fixed on PR #1171, and the OVER-BROAD golangci config §1 never knew about was found and fixed
> (`packages/core/templates/go/.golangci.yml` — the forbid key is `p`, not `pattern`). Dispatching this
> as written would send a worker at finished work. The surviving scope — §2 Option B — was re-baselined
> into its own kickoff off current staging:
> [`adapter-jig-j3-option-b/kickoff.md`](../adapter-jig-j3-option-b/kickoff.md). Read this file only as
> the design-history record of §2.

> **Goal:** close the 3 remaining RED-CI failures on PR #1171 (`feature/adapter-jig-j3-d4db43`, base
> `staging`), resolve its `install.sh` merge conflict with staging, AND ship the Option-B
> `backends/golangci/` E3 parity structure the operator chose — so J3 reaches a mergeable state: green
> CI + clean merge-forward + a real-lane firing proof + the committed freshness gate every other backend carries.
> **What exists (re-verify live per T3 at dispatch):** PR #1171 is OPEN, `mergeable=CONFLICTING`,
> `mergeStateStatus=DIRTY` (verified 2026-08-01 — staging moved 34 commits ahead since the branch base
> `a6a5eb46`; `install.sh` has an additive content conflict: PR-side added the go-lane detection block,
> staging-side added the profile-resolution block — BOTH are wanted, resolve by keeping both in
> logical order; see §1 merge-forward step). 3 RED-CI checks remain (see §1). tsc + prior-art already
> fixed on current head `acaf2b880a` — do NOT re-fix those. Conformance suite (J2, #1094) + frozen
> contract (J1, #1087) merged; 22-arm registry at `packages/core/principles/33-adapter-jig-arm-registry.ts`.
> and frozen contract (J1, #1087) are merged; the 22-arm registry is at
> `packages/core/principles/33-adapter-jig-arm-registry.ts`.
> **Tier:** 1 (executor carries §2.1 design judgment — the go Tier-1 host-derivation + the E3
> capability-matrix shape). Cold-review of every handoff is owned by THIS dispatching session, never
> delegated to aif's internal review (§7).

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement:** this kickoff MUST be on `origin/staging` before aif dispatch
  ([kickoff-staging-placement.md §1](../../../.claude/rules/kickoff-staging-placement.md)). The
  dispatching session commits it before invoking the bridge.
- **Pre-dispatch in-flight probe** MUST explicitly cover (re-run at dispatch, T3 — staging moved 34
  commits since the J3 branch base `a6a5eb46`):
  1. `gh pr list --search "is:open base:staging" --json number,title,headRefName` — confirm no OTHER
     open PR touches `.github/workflows/audit-self.yml`, `packages/core/backends/`, or
     `setup.d/47-go.sh`. If one exists → SERIALIZE per parallel-subwave-isolation.md §1; do NOT race.
  2. `gh pr view 1171 --json headRefOid,state,mergeable,mergeStateStatus` — confirm PR is still OPEN,
     record the live head SHA (re-baseline §1 against the new SHA if it moved since `acaf2b880a`), AND
     re-check `mergeable`/`mergeStateStatus`. If the conflict surface changed (e.g. now MERGEABLE, or
     new conflict files beyond install.sh + audit-self.yml) → re-baseline §1's branch-strategy before
     dispatch. Do NOT rely on the design-time `CONFLICTING` snapshot — staging may have moved again.
- **§4c park-don't-guess contract** is present in this kickoff (§5 below) — the aif pre-dispatch gate
  (`grep -qi 'park it as a question' <this-kickoff>` AND `AGENT_MAX_REVIEW_ITERATIONS` set) MUST pass
  before invoking `tsx packages/runtime-bridge/src/cli/dispatch.ts`.

## §1 The 3 RED-CI failures + the install.sh conflict + branch strategy

**Branch strategy (LOAD-BEARING — procedural, unambiguous; per git-conflict-merge-forward.md §2):**

aif works **DIRECTLY ON** `feature/adapter-jig-j3-d4db43` (the existing PR #1171 branch). It does NOT
create `feature/adapter-jig-j3-redfix` or any other new branch. Procedural steps the worker MUST follow
exactly:

```bash
# In the aif container, on the repo checkout:
git fetch origin
git checkout feature/adapter-jig-j3-d4db43          # the existing PR #1171 branch
git pull --ff-only origin feature/adapter-jig-j3-d4db43 2>/dev/null || true  # pick up any push since dispatch
git merge origin/staging --no-edit                   # merge-forward: resolves the install.sh conflict
# ↑ if this hits conflicts BEYOND install.sh + audit-self.yml (auto-merged) → PARK (§4c fork #4)
# resolve the install.sh conflict: BOTH the go-lane block (PR-side, ~line 401) AND the profile-resolution
# block (staging-side, ~line 428) are WANTED — keep both, in the order: profile-resolution THEN go-lane
# detection (profile is earlier-layer install-depth resolution; go-lane is stack detection). Commit the merge.
# ALL fix commits (B1 + Option B) land ON feature/adapter-jig-j3-d4db43, on top of the merge commit.
git push origin feature/adapter-jig-j3-d4db43        # updates PR #1171 in place (NO force-push needed — fast-forward)
```

**Why direct-on-branch, not fork:** re-opening PR #1171 on a new branch loses the review history + the
existing 4-commit J3 base + the harvest addendum. The PR must update in place.

**Falsifier / PARK trigger (§4c fork #4):** if `git checkout feature/adapter-jig-j3-d4db43` fails (branch
absent/deleted) OR the merge produces conflicts beyond `install.sh` + `audit-self.yml` (the two known
additive surfaces) → STOP, park the task as a question, surface to operator. Do NOT silently create a
fresh branch and do NOT force-push.

**The 3 RED-CI failures (verified against CI run 30711498515 on head `acaf2b880a`, 2026-08-01T17:59Z; re-verify at dispatch — the head SHA may shift):**

| # | Failing check | Root cause (file:line evidence) | Fix |
|---|---|---|---|
| B1 | `Principles as meta-tests (Phase 2)` (run 30711498515, 3s fail) | `actions/setup-go@41dfa10bad2d2ebc6f5a188428eb60db4a9232c5 # v5.4.0` — SHA does NOT resolve. GitHub API: `GET /repos/actions/setup-go/git/commits/41dfa10…` → 404. Confirmed in BOTH surfaces: `.github/workflows/audit-self.yml:290` (framework CI arm) AND `packages/core/templates/go/github-actions-ci.yml:46` (consumer template). Real v5.4.0 tag → `0aaccfd150d50ccaeb58ebd88d36e91967a5f35b` (verified via `GET /repos/actions/setup-go/git/refs/tags/v5.4.0`). | Replace `41dfa10bad2d2ebc6f5a188428eb60db4a9232c5` → `0aaccfd150d50ccaeb58ebd88d36e91967a5f35b` in BOTH files. F10 two-surface parity: both MUST move together. The `# v5.4.0` comment stays. |
| B2 | `fidelity-verdict-in-pr-body` (run 30711504791) | PR body has NO `## Fidelity verdict` section. | Run fidelity Round 2 (cold, dispatching session — NOT aif) over diff `a6a5eb46..HEAD`; paste the resulting `## Fidelity verdict` block into the PR body. See §7. **Sequencing (load-bearing):** fidelity Round 2 MUST run AFTER §6 host-verify step 9 (the cell upgrade) — otherwise the fidelity auditor false-REDs on the honestly-deferred `status:"no"` + `PENDING-RUNNER-CAPTURE` cell (the §3 E3 closure criterion is unmet at worker-done time BY DESIGN; the upgrade in step 9 closes it). **aif does NOT author the fidelity verdict** (`agents/fidelity-auditor.md` «you report; the dispatching session pastes»). |
| (agg) | `ci-success` (run 30711498515) | Aggregate gate — derivative of B1 (+ B2's gate). | Resolves when B1 (and B2's body edit) land. |

**The install.sh conflict (merge-forward, part of branch strategy above):** PR #1171 is
`mergeable=CONFLICTING` because staging added a profile-resolution block and the PR added a go-lane
detection block at the same site (~`install.sh:401`). Both are wanted; resolve by keeping both in the
stated order. This is an ADDITIVE conflict (two features in one function), NOT a semantic disagreement
— so it does NOT trigger the git-conflict-merge-forward §2 step 4 "STOP, park, operator" path (that
path is for conflicts where the two sides genuinely disagree on behaviour).

**Already fixed on current head (do NOT re-touch):** tsc TS2345 at `ecosystem-go.test.ts:170` (commit
`e5b08c1e64`); prior-art trailer (capability gate now PASS).

**DoD after B1 + merge-forward:** the framework go CI arm (`.github/workflows/audit-self.yml` go arm)
MUST actually run green on the runner — the dispatching session captures the green workflow run URL
(§6 host-verify step 8) as the E1 real-lane firing proof (T-EW-C posture). The worker does NOT link the
URL (it cannot reach GitHub Actions from the container); the dispatching session does, after harvest.

## §2 Option B — `backends/golangci/` E3 parity structure (the operator's chosen scope)

E3 arm (`toolchain-freshness-vs-evidence`, design spec §3.5:172) requires: «Committed firing evidence
records the producing tool version; a freshness gate REDs on drift between evidence and the live/pinned
tool.» Today all 4 existing backends ship this; golangci-lint is the lone exception (pin lives only in
cache-key + `@tag`, no asserted gate). Operator chose Option B: ship the structure.

**What to build — mirror the EXISTING backends/cargo/ shape (verified file-by-file):**

1. **`packages/core/backends/golangci/capability-matrix.json`** — mirror
   `packages/core/backends/cargo/capability-matrix.json` shape:
   - `backend`: `"golangci-forbidigo"` (or the executor's better name; the frozen F5 idiom does not name
     backend files, so the directory name is free — but it MUST be consistent with `setup.d/47-go.sh`'s
     delivered artefact names. DO NOT invent a name that diverges from the lane's existing
     `getff-golangci.yml` / `getff-go.yml` naming).
   - `contract`: points at `firing-contract.json` (same dir).
   - `cells`: at minimum a `syntax` cell with `status: "partial"` (forbidigo is a syntax/textual ban,
     not type-aware) carrying `evidence.kind: "live-fired"`, `evidence.date`, `evidence.toolchain:
     "golangci-lint v1.55.2"` (MUST match the pin in `.github/workflows/audit-self.yml:306`), and
     `evidence.capturedDiagnostic`.
   - **`capturedDiagnostic` anti-fabrication rule (T-AJ-A — the load-bearing constraint):**
     `validateMatrix` (shared/capability-matrix.ts:61-62) REJECTS an empty `capturedDiagnostic` on a
     `status: "partial"` cell. So if golangci-lint is ABSENT in the aif container (likely — it is not a
     container dependency), the worker CANNOT ship a `partial` syntax cell with an empty diagnostic
     (that fails the matrix self-test) AND MUST NOT fabricate a plausible-looking JSON blob (that is
     T-AJ-A theatre). The worker's resolution: ship the `syntax` cell as `status: "no"` with
     `refusedCode: "PENDING-RUNNER-CAPTURE"` (a deliberate non-FF marker signalling "evidence owed, not
     refused-on-merits") and NO `evidence` field (a "no" cell requires none → validateMatrix passes).
     The dispatching session then UPGRADES the cell to `status: "partial"` + real `evidence` (live
     `capturedDiagnostic` + date + toolchain) in §6 host-verify step 9, after capturing it from the
     runner. DO NOT copy cargo's `capturedDiagnostic` JSON as a template — that is the exact theatre.
   - Record the `type-aware` and `dep-graph` cells as `status: "no", refusedCode: "FF7001"` (forbidigo
     cannot express type-aware or dep-graph bans — parity with ruff/cargo which refuse these).
2. **`packages/core/backends/golangci/firing-contract.json`** — mirror
   `packages/core/backends/ruff/firing-contract.json` minimal shape: `{ "command": "golangci-lint run
   --out-format=json --enable forbidigo", "jsonPath": "$.<field>", "expectedCodes": [...] }`. The
   `jsonPath` + `expectedCodes` MUST be derived from the ACTUAL captured golangci-lint JSON output shape
   (golangci-lint v1.55.2 emits `[{ "Rule": {...}, "Text": ..., "Pos": {...} }]` — verify the real shape
   from a live run; do NOT guess the path).
3. **`packages/core/backends/golangci/firing-runner.ts`** — mirror
   `packages/core/backends/cargo/firing-runner.ts` exports EXACTLY: `parseCodesFromStdout` (pure,
   NDJSON or JSON-array parse — adapt to golangci-lint's actual stdout shape), `fireContract` (spawns the
   contract command), `parseGolangciVersion` (extracts semver from `golangci-lint --version`), and
   `deriveGolangciVersion` (runs `golangci-lint --version`, returns undefined when absent → loud-skip).
   **Do NOT put `checkToolchainFreshness` here** — in all 4 precedents (cargo/ruff/npm/astgrep) it lives
   in `capability-matrix.test.ts`, never in `firing-runner.ts`. `firing-runner.ts` exports only the
   parse/fire/version functions; the freshness gate is a test-file concern.
4. **`packages/core/backends/golangci/capability-matrix.test.ts`** — mirror
   `packages/core/backends/cargo/capability-matrix.test.ts`: exports `checkToolchainFreshness` (analog of
   cargo's, comparing the evidence `toolchain` version against `deriveGolangciVersion()`) +
   `validateMatrix` paired-negatives (a partial cell without evidence is a violation; mismatched identity
   is a violation; "no" cell is clean) + `checkToolchainFreshness` paired-negatives (fabricated version
   drift `v1.55.2` vs `v1.54.0` → violation — the RED-capable negative the E3 arm demands) + a
   committed-file test that the shipped `capability-matrix.json` passes. The freshness live test uses
   `it.skipIf(resolvedVersion === undefined)` with a loud `console.warn` when golangci-lint is absent
   (mirror cargo/ruff posture — NEVER a silent pass).
5. **`packages/core/backends/golangci/firing.test.ts`** — mirror
   `packages/core/backends/ruff/firing.test.ts`: live RED (invalid fixture → expected code present) +
   live GREEN (valid fixture → code absent) + a PURE self-application block that runs always-on
   (fixture-drift protection independent of tool presence).
6. **`packages/core/backends/golangci/fixtures/firing/`** — three minimal go modules: `invalid/` (a
   `main.go` calling `os.Getenv("HOME")` — the forbidigo ban target), `valid/` (same with a
   `//permit:text` or refactor), `valid-clean/` (conforming, no violation). Each with a `go.mod` (module
   path `example.com/getff-golangci-firing-<label>`). Keep fixtures MINIMAL — they exist to prove firing,
   not to model real go projects.

**Do NOT build (out of scope — explicit complete list, do not "discover" more):**
- `render-golangci.ts` / `render-golangci.test.ts` — the `.golangci.yml` is already templated at
  `packages/core/templates/go/.golangci.yml`; cargo/ruff carry render-*.ts only because they synthesize
  their config from ConventionNode IR — go does not.
- `write-golangci.ts` / `write-golangci.test.ts` — the lane `setup.d/47-go.sh` already writes the file.
- **`test-fixtures.ts` — CRITICAL: do NOT build this.** cargo/ruff carry a `test-fixtures.ts` that
  imports `ConventionNode` from `packages/core/ir/types.ts` (the frozen D2/IR STOP-line, §5). A faithful
  "mirror cargo" reading would build one and cross the STOP-line. The golangci fixtures
  (`fixtures/firing/*/main.go`) are written DIRECTLY as plain go files, NOT synthesized from a
  `ConventionNode` — so no `test-fixtures.ts` and no `ir/types.ts` import is needed or permitted.
- `demo/` directory — cargo's demo crate is for a different surface; golangci needs none.

The 6 artefacts above are the COMPLETE golangci set. If a 7th appears necessary to satisfy an
acceptance criterion, PARK it (§4c) — do not silently widen scope.

**E3 closure criterion:** `checkToolchainFreshness` with a fabricated-drift paired-negative goes RED
(proven in `capability-matrix.test.ts`), AND the committed `capability-matrix.json`'s evidence toolchain
string matches the resolving `golangci-lint --version` on the runner (the live test, gated on tool
presence).

## §3 "Works" per stage (acceptance — quote in the REPORT)

- B1 fixed: `actions/setup-go@0aaccfd150…` resolves; the go CI arm runs; one green workflow run URL is
  linked in the PR body §2 (E1 evidence, T-EW-C).
- Option B shipped: `packages/core/backends/golangci/` carries the 6 artefacts above; the shipped
  `capability-matrix.json` passes `validateMatrix` (worker's commit: syntax cell ships as `status:"no"`
  + `refusedCode:"PENDING-RUNNER-CAPTURE"` because golangci-lint is absent in the container — the
  dispatching session UPGRADES it to `status:"partial"` + real evidence in §6 step 9); the
  `checkToolchainFreshness` paired-negative is RED-capable (quoted in the REPORT).
- F10 parity intact: BOTH `.github/workflows/audit-self.yml` and
  `packages/core/templates/go/github-actions-ci.yml` carry the corrected `setup-go@0aaccfd150…` SHA.
- tsc clean (`npx --prefix packages/core tsc --noEmit` exit 0); vitest green on the new
  `backends/golangci/` tests; `bash tests/install-sh/snapshot.sh` green (no baseline drift from the new
  fixtures — they live under `packages/core/`, NOT `tests/install-sh/baselines/`, so snapshot is
  unaffected; verify with a compare run).
- ZERO frozen-row edits (F1-F11): the Option-B work touches `packages/core/backends/golangci/` (new) +
  the 2 workflow SHA fixes + the install.sh merge-resolution. It does NOT touch `allowlist-resolver.ts`
  (F1/F2/F3), `ecosystem-name.ts` (F4 — already extended by J3), `ecosystem-go.ts` (F5 idiom — already
  shipped by J3), `installer/types.ts` (F11), `ir/types.ts` (D2/IR freeze). Verify with
  `git diff --name-only <merge-base>..HEAD` and confirm none of the frozen homes appear (§6 step 7).

## §4 AI-laziness traps active (per .claude/rules/ai-laziness-traps.md §2)

Inherited verbatim from umbrella kickoff §4. **Active: T2, T3, T14, T15, T19, T20, T21.** (T11 does not
fire — Option B introduces no new SSOT-class capability; it extends an existing structure. J1's SSOT #226
already covers the conformance-kit class.)

- **T2/T20** — the E3 `checkToolchainFreshness` paired-negative MUST actually fire RED on fabricated drift
  (quoted in the REPORT), not merely exist. A green-only freshness gate is REFUSED by design.
- **T3** — every file:line citation above is design-time (@ `acaf2b880a`, 2026-08-01). Re-verify live at
  dispatch: staging moved 34 commits; the PR head may have moved; the setup-go line numbers in §1 are
  against the current head and may shift.
- **T14** — the golangci-lint evidence MUST be honest: if a live run cannot be captured (tool absent
  locally), the `capturedDiagnostic` is INSUFFICIENT (park, do NOT fabricate from a template). The
  dispatching session captures the runner-side evidence after B1 lands.
- **T15** — the backends/golangci/ test suite's own arms must survive the E3 RED-provability rule; the
  freshness gate is the jig auditing itself.
- **T19** — own adversarial cold-review (the dispatching session runs fidelity Round 2 + the
  adapter-jig-reviewer 8-group walk) before EVERY handoff/merge — never accept «CI green» as design review.
- **T21** — backward-checks enumerate sibling surfaces (all 4 existing backends as the comparison set;
  both setup-go pin surfaces; both delivery lanes' `.golangci.yml` + `getff-golangci.yml`), never restate
  the diff.

**Domain-specific traps (inherited):**

- **T-AJ-A — «arm passes because it tests the fixture, not the lane»:** the E3 freshness evidence's
  `capturedDiagnostic` MUST come from a real `golangci-lint run` against the committed
  `fixtures/firing/invalid/`, not a hand-written JSON.
- **T-AJ-B — «drift probe eyeballed»:** the version-drift paired-negative is asserted via
  `checkToolchainFreshness(freshCell('v1.54.0'), 'v1.55.2')` returning a non-empty violations array —
  MEASURED, not «looks like it would fire».
- **T-AJ-C — «go leaks ahead of its stage»:** N/A here — this work is entirely within the J3 PR #1171;
  no cross-stage leak risk.

## §4c Autonomous aif-handoff dispatch — park-don't-guess contract

**Lever 1 — conservative aif config (BEFORE dispatch — the dispatching session exports these):**

```bash
export AGENT_MAX_REVIEW_ITERATIONS=1
export AGENT_AUTO_REVIEW_STRATEGY=closure_first
export AGENT_SKIP_REVIEW=false
```

**Lever 2 — park-don't-guess instruction (addressed to the aif agent):**

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
> implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT
> pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork
> stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on
> the unambiguous parts. For this J3-redfix specifically, the forks to PARK, never guess:
> 1. The `backends/golangci/` directory name if it is ambiguous against the lane's existing artefact
>    naming (park the name choice — do not silently invent one).
> 2. The golangci-lint JSON `jsonPath` if the live output shape diverges from the cargo/ruff precedent
>    (park — do NOT guess a field name).
> 3. Any case where touching a frozen row (F1-F11) appears necessary to satisfy E3 (STOP — spec revision
>    first; the jig design failed).
> 4. The branch strategy if `feature/adapter-jig-j3-d4db43` is not in the expected state (park — do not
>    silently create a fresh branch and lose the PR history).

**Pre-dispatch gate:** `grep -qi 'park it as a question' <this-kickoff>` (present — §4c) AND
`AGENT_MAX_REVIEW_ITERATIONS` non-empty (the dispatching session sets it). Either missing → STOP.

**Egress gate (mandatory after `status=done`):** the dispatching session runs
`npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging` (harvest pushes the branch
from aif's container via `docker exec`, opens/updates PR #1171 from the host, arms auto-merge). The
anti-pattern `#autonomous-done-no-harvest` (work stays in container forever) is avoided by this step.

## §5 STOP lines (binding — inherited from umbrella §5 + Option-B additions)

- NO edits to `.claude/skills/rule-tests/`, `agents/rule-test-author.md`, `packages/core/ir/`
  (inherited D2/IR freeze).
- NO new test runner — backends/golangci/ tests run in the EXISTING vitest suite.
- NO edits to frozen rows F1-F11 (see §3 closure criterion; STOP → spec revision if any appears needed).
- NO paid LLM in CI (generation/review are session-bound; the backends/ tests are deterministic).
- NO fabrication of golangci-lint evidence — if the tool cannot be fired locally, park for the runner.
- NO silent branch recreation — extend `feature/adapter-jig-j3-d4db43`, never fork it silently.

## §6 Host-verify (acceptance runs on the HOST, not the aif container)

A green suite inside the aif container is NOT evidence about the host — and the load-bearing E1 proof
(golangci-lint actually firing on the runner) CANNOT run on the host Mac (golangci-lint absent). Before
the dispatching session accepts the worker's REPORT, it MUST run these host-side commands. This block
satisfies `.claude/rules/destination-environment-verification.md §4`. The merge-forward already happened
in the worker's branch (§1 branch strategy) — host-verify runs on the post-merge-forward HEAD.

```bash host-verify
# 1. Fetch the worker's branch (already merge-forwarded in §1) — verify the merge commit is present
cd /Users/art/code/rules-as-tests-aif
git fetch origin feature/adapter-jig-j3-d4db43 staging
git worktree add -f /tmp/j3-redfix-verify origin/feature/adapter-jig-j3-d4db43
cd /tmp/j3-redfix-verify
# confirm install.sh no longer carries conflict markers + carries BOTH the profile + go-lane blocks
grep -c "<<<<<<<" install.sh  # 0 (no conflict markers)
grep -c "PROFILE=" install.sh  # >=1 (staging-side profile-resolution block kept)
grep -c "do_go_lane" install.sh  # >=1 (PR-side go-lane block kept)

# 2. tsc clean (the B1 fix + Option-B TS must not regress the earlier tsc fix)
npm ci --prefix packages/core --silent
npx --prefix packages/core tsc --noEmit -p packages/core  # exit 0

# 3. The new backends/golangci/ tests green (the E3 parity). NOTE: the live-fire + freshness tests
#    use it.skipIf(golangci absent) → they SKIP on this Mac. The skipped set is EXPECTED here; the
#    runner (step 8) fires them for real. The always-on validateMatrix + paired-negative tests run.
npx --prefix packages/core vitest run packages/core/backends/golangci/  # non-skipped all pass

# 4. The existing J3 tests still green (no regression from Option-B)
npx --prefix packages/core vitest run packages/core/research/ecosystem-go.test.ts \
  packages/core/research/ecosystem-unwired-debt.test.ts \
  packages/core/research/ecosystem-adapter-precondition.test.ts

# 5. snapshot unchanged (Option-B fixtures live under packages/core/, not tests/install-sh/baselines/)
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh  # 15 pass / 0 fail

# 6. The 2 setup-go SHAs now resolve (the B1 fix) — grep confirms both surfaces moved together
grep -c "actions/setup-go@0aaccfd150d50ccaeb58ebd88d36e91967a5f35b" .github/workflows/audit-self.yml  # 1
grep -c "actions/setup-go@0aaccfd150d50ccaeb58ebd88d36e91967a5f35b" packages/core/templates/go/github-actions-ci.yml  # 1
grep -c "41dfa10bad2d2ebc6f5a188428eb60db4a9232c5" .github/workflows/audit-self.yml packages/core/templates/go/github-actions-ci.yml  # 0,0 (bogus SHA gone)

# 7. ZERO frozen-row edits (F1-F11 homes untouched by this work — list matches §3)
MB=$(git merge-base origin/staging HEAD)
git diff --name-only $MB..HEAD -- packages/core/research/allowlist-resolver.ts \
  packages/core/research/ecosystem-name.ts packages/core/research/ecosystem-go.ts \
  packages/core/installer/types.ts packages/core/ir/types.ts  # empty (5 frozen homes)

# 8. RUNNER-SIDE E1 + E3 PROOF (the load-bearing step — cannot run on host). After harvest pushes the
#    branch, wait for the audit-self.yml go arm to go green, then confirm BOTH (a) a green run exists
#    for THIS head SHA AND (b) the "Principles as meta-tests (Phase 2)" JOB specifically went SUCCESS
#    (job-level, not just run-level — the go steps live inside that job at audit-self.yml:289-353; a
#    run-level green with a skipped/failed Principles job would NOT prove E1). This is the T-EW-C evidence.
EXPECTED_SHA=$(git rev-parse HEAD)
GREEN_RUN=$(gh run list --branch feature/adapter-jig-j3-d4db43 --workflow audit-self.yml --limit 10 \
  --json conclusion,headSha,databaseId,url | \
  jq -r --arg sha "$EXPECTED_SHA" 'map(select(.conclusion=="SUCCESS" and .headSha==$sha)) | .[0].databaseId // empty')
[ -n "$GREEN_RUN" ] || { echo "❌ no green audit-self.yml run for $EXPECTED_SHA"; exit 1; }
# job-level check: the Principles job (which carries the go arm steps) must be SUCCESS
gh run view "$GREEN_RUN" --json jobs --jq '.jobs[] | select(.name|test("Principles as meta-tests")) | .conclusion' | grep -q "^SUCCESS$" \
  || { echo "❌ green run exists but Principles job (go arm) did not succeed"; exit 1; }
echo "✓ E1 proven: $GREEN_RUN — capture $(gh run view "$GREEN_RUN" --json url --jq .url) → PR body §2"

# 9. RUNNER-SIDE cell upgrade (closes the T-AJ-A anti-fabrication loop). The worker shipped the syntax
#    cell as status:"no" + refusedCode:"PENDING-RUNNER-CAPTURE" (golangci-lint absent in the container).
#    From the green run's logs (or a local docker run with golangci-lint installed), extract the REAL
#    golangci-lint JSON output for the invalid fixture. UPGRADE the cell in
#    packages/core/backends/golangci/capability-matrix.json: status "no" → "partial", remove
#    refusedCode, ADD evidence {kind:"live-fired", date:<today>, toolchain:"golangci-lint v1.55.2",
#    capturedDiagnostic:<the real JSON blob>}. Re-commit on feature/adapter-jig-j3-d4db43. The matrix
#    self-test (step 3) must now pass WITH the real evidence (validateMatrix accepts the partial cell
#    because capturedDiagnostic parses + identity matches). This second commit is owned by the
#    DISPATCHING SESSION (same ownership as B2 fidelity), NOT aif — aif already marked done.
```

If ANY host-verify step fails, the dispatching session does NOT accept the REPORT — it surfaces the
failure to the operator and either requests a rework round or parks. The container's self-reported green
is necessary but not sufficient. **Steps 8-9 are the load-bearing E1/E3 proof** — they run on the runner
(after push), NOT on the host Mac; until they pass, E1 is INSUFFICIENT (T-EW-C posture, §1 DoD).

## §7 See also

- `.claude/orchestrator-prompts/adapter-jig/kickoff.md` — the BINDING umbrella kickoff (§1 J3, §5 STOP).
- `.claude/orchestrator-prompts/adapter-jig-meta-launch/kickoff.md` — the J3 meta-launch (§4 Stage 2 J3
  scope, §4c park-don't-guess, §7 Phase -1 reviewer).
- `docs/superpowers/specs/2026-07-22-adapter-jig-design.md` — BINDING design (§2 F1-F11, §3 arms incl.
  E3:172, §9 J3 DoD).
- `docs/superpowers/specs/2026-07-22-adapter-jig-contract.md` — the F1-F11 frozen-contract checklist.
- `packages/core/backends/cargo/` + `packages/core/backends/ruff/` — the two Option-B models to mirror.
- `agents/adapter-jig-reviewer.md` — the cold 8-group review protocol (§7 Phase -1).
- `agents/fidelity-auditor.md` — the cold WHAT-conformance auditor (§7 Round 2).
