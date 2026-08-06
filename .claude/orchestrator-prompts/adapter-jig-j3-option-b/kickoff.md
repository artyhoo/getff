<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: dispatch-kickoff — adapter-jig J3 Option B (backends/golangci/ E3 parity), split out of the
     J3 red-CI fix. Operator decision 2026-08-01: ship Option B (structural parity with all 4 existing
     backends) rather than Option A (lane-only). Packaging decision 2026-08-06: Option B ships as its
     OWN PR off staging, NOT on the PR #1171 branch — #1171's own scope (the go lane through the
     conformance jig) is finished and green, and holding it open through a bulky parity build invites a
     second merge-forward (it already went CONFLICTING once when staging moved 34 commits ahead).
     Tier 1 — the «how» is one sentence: mirror the cargo/ruff backend shape for golangci-lint. The
     design judgment was spent in §2 below; nothing here is open. Base branch: staging. -->

# adapter-jig J3 Option B — `backends/golangci/` E3 parity — dispatch kickoff

> **Goal:** golangci-lint stops being the one backend without an asserted toolchain-freshness gate. Ship
> the `packages/core/backends/golangci/` structure the other four backends (npm / ruff / astgrep / cargo)
> already carry, so the E3 arm («committed firing evidence records the producing tool version; a freshness
> gate REDs on drift between evidence and the live/pinned tool») holds for go too.
> **Tier:** 1 — mechanical mirror of an existing, four-times-repeated structure. The shape decisions are
> made in §2; a fork that §2 does not answer is a PARK (§4c), never a guess.
> **Predecessor, already MERGED or GREEN — do NOT redo any of it:** PR #1171 carries the go lane itself
> (`setup.d/47-go.sh`, `packages/core/templates/go/*`, the audit-self go arm). Its red CI is closed: the
> fabricated `actions/setup-go` SHA is fixed, the `install.sh` conflict is merge-forwarded, the synth
> bundle is regenerated, and the delivered golangci config's OVER-BROAD defect is fixed and proven live.

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement:** this kickoff MUST be on `origin/staging` before aif dispatch
  ([kickoff-staging-placement.md §1](../../../.claude/rules/kickoff-staging-placement.md)). The
  dispatching session commits it before invoking the bridge.
- **Pre-dispatch in-flight probe** (re-run at dispatch — T3; do not trust this document's snapshot):
  1. `gh pr list --search "is:open base:staging" --json number,title,headRefName` — confirm no OTHER open
     PR touches `packages/core/backends/`. If one exists → SERIALIZE per
     [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md); do NOT race.
  2. `gh pr view 1171 --json state,mergeable` — if #1171 is still OPEN, that is fine and expected: this
     work does not touch its files. But if it has been CLOSED without merging, STOP and surface — the
     lane artefacts this backend describes would not exist on staging.
  3. `git log origin/staging --oneline -1` — record the base SHA the worker branches from.
- **§4c park-don't-guess contract** is present in this kickoff (§4c) — the aif pre-dispatch gate
  (`grep -qi 'park it as a question' <this-kickoff>` AND `AGENT_MAX_REVIEW_ITERATIONS` set) MUST pass
  before invoking `tsx packages/runtime-bridge/src/cli/dispatch.ts`.

## §1 Branch strategy + what already exists

**Branch strategy (procedural, unambiguous):**

```bash
# In the aif container, on the repo checkout:
git fetch origin
git checkout -b feature/adapter-jig-golangci-backend origin/staging   # fresh branch off CURRENT staging
# ALL commits land here. This branch opens a NEW PR (base: staging). It does NOT touch PR #1171.
git push -u origin feature/adapter-jig-golangci-backend
```

Do NOT check out or push to `feature/adapter-jig-j3-d4db43` (PR #1171). That branch is owned by the
dispatching session and is being merged separately — a push from here is a cross-owner write.

**What already exists on the lane (read it, do not rebuild it):**

| Surface | State | Why it matters here |
|---|---|---|
| `packages/core/templates/go/.golangci.yml` | shipped on #1171 | The delivered ban surface your fixtures must fire against: forbidigo, one pattern `os\.Getenv`. |
| `setup.d/47-go.sh` | shipped on #1171 | Names the delivered artefacts (`.golangci.yml` fresh-dir, `getff-golangci.yml` in the REFUSE cell). Your naming must not diverge from these. |
| `.github/workflows/audit-self.yml` go arm | green | Installs the pinned `golangci-lint@v1.55.2`. Re-derive the pin's exact line at dispatch — line numbers shift. |
| `packages/core/backends/{npm,ruff,astgrep,cargo}/` | on staging | The four precedents. `cargo/` is the closest shape; `ruff/` is the closest firing-test shape. |

**The config key is load-bearing and counter-intuitive — do not "fix" it.** The shipped config declares
its ban as `- p: 'os\.Getenv'`. The key is `p`, NOT `pattern`: forbidigo's own struct tags that field
`yaml:"p"`, and golangci-lint v1.x vendors the struct verbatim (only the v2 schema renamed it). Under the
pinned v1.55.2, `pattern:` is an unknown key, silently dropped, leaving an EMPTY regex that matches every
identifier — a config that bans the language itself. That was a real defect, caught 2026-08-06 by the
lane's paired clean control, and fixed. If any fixture or contract of yours seems to want `pattern:`,
you are reading a v2 doc against a v1 pin — park it, do not switch the key.

## §2 What to build — mirror the existing `backends/cargo/` shape (verified file-by-file)

1. **`packages/core/backends/golangci/capability-matrix.json`** — mirror
   `packages/core/backends/cargo/capability-matrix.json` shape:
   - `backend`: `"golangci-forbidigo"` (or a better name — the frozen F5 idiom does not name backend
     files, so the directory name is free, but it MUST be consistent with the lane's existing
     `getff-golangci.yml` / `getff-go.yml` naming. Do NOT invent a name that diverges from it).
   - `contract`: points at `firing-contract.json` (same dir).
   - `cells`: at minimum a `syntax` cell (forbidigo is a syntax/textual ban, not type-aware) carrying
     `evidence.kind: "live-fired"`, `evidence.date`, `evidence.toolchain: "golangci-lint v1.55.2"` (MUST
     match the live pin in `.github/workflows/audit-self.yml` — re-derive it, do not copy this string
     blind), and `evidence.capturedDiagnostic`.
   - **`capturedDiagnostic` anti-fabrication rule (T-AJ-A — the load-bearing constraint):**
     `validateMatrix` (`shared/capability-matrix.ts`) REJECTS an empty `capturedDiagnostic` on a
     `status: "partial"` cell. So if golangci-lint is ABSENT in the aif container (likely — it is not a
     container dependency), you CANNOT ship a `partial` syntax cell with an empty diagnostic (fails the
     matrix self-test) and you MUST NOT fabricate a plausible-looking JSON blob (that is the theatre this
     rule exists to stop). Your resolution: ship the `syntax` cell as `status: "no"` with
     `refusedCode: "PENDING-RUNNER-CAPTURE"` (a deliberate non-FF marker meaning «evidence owed, not
     refused-on-merits») and NO `evidence` field (a "no" cell requires none → validateMatrix passes). The
     dispatching session UPGRADES the cell to `status: "partial"` + real evidence in §6 step 7, after
     capturing it from the runner. DO NOT copy cargo's `capturedDiagnostic` JSON as a template.
   - Record the `type-aware` and `dep-graph` cells as `status: "no", refusedCode: "FF7001"` (forbidigo
     cannot express type-aware or dep-graph bans — parity with ruff/cargo, which refuse these).
2. **`packages/core/backends/golangci/firing-contract.json`** — mirror
   `packages/core/backends/ruff/firing-contract.json` minimal shape: `{ "command": "golangci-lint run
   --out-format=json --enable forbidigo", "jsonPath": "$.<field>", "expectedCodes": [...] }`. The
   `jsonPath` + `expectedCodes` MUST be derived from the ACTUAL golangci-lint JSON output shape — park if
   you cannot capture one (fork #2), do NOT guess a field name from the cargo precedent.
3. **`packages/core/backends/golangci/firing-runner.ts`** — mirror
   `packages/core/backends/cargo/firing-runner.ts`, exporting EXACTLY: `parseCodesFromStdout` (pure),
   `fireContract` (spawns the contract command), `parseGolangciVersion` (semver out of
   `golangci-lint --version`), `deriveGolangciVersion` (runs it; returns undefined when absent →
   loud-skip). **Do NOT put `checkToolchainFreshness` here** — in all four precedents it lives in
   `capability-matrix.test.ts`. `firing-runner.ts` exports only parse/fire/version.
4. **`packages/core/backends/golangci/capability-matrix.test.ts`** — mirror
   `packages/core/backends/cargo/capability-matrix.test.ts`: exports `checkToolchainFreshness` (compares
   the evidence `toolchain` against `deriveGolangciVersion()`) + `validateMatrix` paired-negatives (a
   partial cell without evidence is a violation; mismatched identity is a violation; a "no" cell is
   clean) + `checkToolchainFreshness` paired-negatives (fabricated drift `v1.55.2` vs `v1.54.0` → a
   non-empty violations array — the RED-capable negative the E3 arm demands) + a committed-file test that
   the shipped `capability-matrix.json` passes. The live freshness test uses
   `it.skipIf(resolvedVersion === undefined)` with a loud `console.warn` when the tool is absent — NEVER
   a silent pass.
5. **`packages/core/backends/golangci/firing.test.ts`** — mirror
   `packages/core/backends/ruff/firing.test.ts`: live RED (invalid fixture → expected code present) +
   live GREEN (valid fixture → code absent) + a PURE self-application block that runs always-on
   (fixture-drift protection independent of tool presence).
6. **`packages/core/backends/golangci/fixtures/firing/`** — three minimal go modules: `invalid/` (a
   `main.go` calling `os.Getenv("HOME")` — the ban target), `valid/` (the same need served without the
   banned call — prefer a refactor to an injected accessor; a forbidigo `//permit:` directive is only
   acceptable if you VERIFY it exists in v1.55.2, else park it as fork #3), `valid-clean/` (conforming,
   no violation). Each with a `go.mod` (module path `example.com/getff-golangci-firing-<label>`). Keep
   them MINIMAL — they exist to prove firing, not to model real go projects.

**Do NOT build (explicit complete out-of-scope list — do not "discover" more):**

- `render-golangci.ts` / `render-golangci.test.ts` — `.golangci.yml` is already templated at
  `packages/core/templates/go/.golangci.yml`; cargo/ruff carry render-\*.ts only because they synthesize
  their config from ConventionNode IR. Go does not.
- `write-golangci.ts` / `write-golangci.test.ts` — the lane `setup.d/47-go.sh` already writes the file.
- **`test-fixtures.ts` — CRITICAL: do NOT build this.** cargo/ruff carry one that imports
  `ConventionNode` from `packages/core/ir/types.ts` — the frozen D2/IR STOP-line (§5). A faithful
  "mirror cargo" reading would build it and cross that line. The golangci fixtures are written DIRECTLY
  as plain go files, never synthesized from a `ConventionNode`.
- `demo/` directory — cargo's demo crate serves a different surface.
- ANY edit under `setup.d/`, `packages/core/templates/go/`, or `.github/workflows/` — the lane is
  finished and owned by PR #1171. This work is additive: one new directory plus its tests.

## §3 "Works" per stage (acceptance — quote in the REPORT)

- `packages/core/backends/golangci/` carries the 6 artefacts of §2 and nothing else.
- The shipped `capability-matrix.json` passes `validateMatrix`, with the syntax cell as `status: "no"` +
  `refusedCode: "PENDING-RUNNER-CAPTURE"` (evidence owed to §6 step 7, by design at worker-done time).
- The `checkToolchainFreshness` paired-negative is RED-capable — quote the actual failing assertion
  output in the REPORT, not the intent (T2/T20).
- `npx --prefix packages/core tsc --noEmit -p packages/core` → exit 0.
- `npx --prefix packages/core vitest run packages/core/backends/` → green (skips on the live-fire arms
  are EXPECTED where golangci-lint is absent; a skip must be loud, never silent).
- `SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh` → 15 pass / 0 fail (the new fixtures live
  under `packages/core/`, not `tests/install-sh/baselines/`, so nothing should move — verify, don't
  assume).
- ZERO frozen-row edits (F1-F11): confirm with `git diff --name-only $(git merge-base origin/staging
  HEAD)..HEAD` that none of `allowlist-resolver.ts`, `ecosystem-name.ts`, `ecosystem-go.ts`,
  `installer/types.ts`, `ir/types.ts` appear.

## §4 AI-laziness traps active (per [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

**Active: T2, T3, T13, T14, T15, T19, T20, T21.** (T11 does not fire — Option B introduces no new
SSOT-class capability; it extends an existing structure that SSOT #226 already covers.)

- **T2 / T20** — the E3 freshness paired-negative MUST be RUN and its RED output quoted. «The test would
  fire» is a design claim, not a result.
- **T3** — every file:line and line-number reference in this kickoff is design-time. Re-derive at
  dispatch; do not cite a line you have not opened.
- **T13** — mirroring four existing backends does NOT make this externally validated. The precedents are
  ours, not upstream; audit the shape you copy rather than assuming it is right.
- **T14** — honest evidence: if golangci-lint cannot be fired in the container, the `capturedDiagnostic`
  is INSUFFICIENT and the cell ships as `"no"` + `PENDING-RUNNER-CAPTURE`. Never fabricate.
- **T15** — the backends/golangci/ suite's own arms must survive the E3 RED-provability rule; the
  freshness gate is the jig auditing itself.
- **T19** — the dispatching session runs its own cold review before merge; a green CI is not a design
  review.
- **T21** — backward-checks enumerate sibling surfaces (all four existing backends as the comparison
  set), never restate the diff.

**Domain-specific traps:**

- **T-AJ-A — «arm passes because it tests the fixture, not the lane»:** the E3 evidence's
  `capturedDiagnostic` MUST come from a real `golangci-lint run` against the committed
  `fixtures/firing/invalid/`, never hand-written JSON.
- **T-AJ-B — «drift probe eyeballed»:** the version-drift negative is asserted via
  `checkToolchainFreshness(freshCell('v1.54.0'), 'v1.55.2')` returning a non-empty violations array —
  MEASURED, not «looks like it would fire».
- **T-AJ-D — «v2 documentation against a v1 pin»:** golangci-lint's current docs describe the v2 config
  schema, while this repo pins v1.55.2. Any config-shape fact taken from docs (key names, `--out-format`
  vs `--output.json.path`, JSON field names) MUST be checked against v1.55.2 behaviour or a captured run.
  This trap already produced one shipped defect on this lane (`pattern:` vs `p:`, §1).

## §4c Autonomous aif-handoff dispatch — park-don't-guess contract

**Lever 1 — conservative aif config (the dispatching session exports these BEFORE dispatch):**

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
> the unambiguous parts. For this Option-B work specifically, the forks to PARK, never guess:
> 1. The `backends/golangci/` directory or `backend:` name, if it is ambiguous against the lane's existing
>    artefact naming (park the name — do not silently invent one).
> 2. The golangci-lint JSON `jsonPath` / `expectedCodes`, if no live output can be captured in the
>    container (park — do NOT guess a field name from the cargo or ruff precedent).
> 3. The `valid/` fixture's mechanism, if you cannot verify that a forbidigo `//permit:` directive exists
>    in v1.55.2 (park — or use a plain refactor, which needs no directive at all).
> 4. Any case where touching a frozen row (F1-F11) appears necessary to satisfy E3 (STOP — the jig design
>    failed; spec revision comes first).

**Egress gate (mandatory after `status=done`):** the dispatching session runs
`npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging` (harvest pushes the branch
from aif's container, opens the PR from the host, arms auto-merge). This avoids
`#autonomous-done-no-harvest` — work that stays in the container forever.

## §5 STOP lines (binding)

- NO edits to `.claude/skills/rule-tests/`, `agents/rule-test-author.md`, `packages/core/ir/` (D2/IR
  freeze).
- NO edits to frozen rows F1-F11.
- NO edits to `setup.d/`, `packages/core/templates/go/`, or `.github/workflows/` — PR #1171 owns them.
- NO push to `feature/adapter-jig-j3-d4db43`, and no new commits on PR #1171.
- NO new test runner — the backends/golangci/ tests run in the EXISTING vitest suite.
- NO paid LLM in CI.
- NO fabrication of golangci-lint evidence — if the tool cannot be fired, park for the runner.

## §6 Host-verify (acceptance runs on the HOST, not the aif container)

A green suite inside the aif container is not evidence about the host. Before the dispatching session
accepts the REPORT, it MUST run these. This block satisfies
[destination-environment-verification.md §1](../../../.claude/rules/destination-environment-verification.md).

```bash host-verify
npm ci --prefix packages/core --silent
npx --prefix packages/core tsc --noEmit -p packages/core
npx --prefix packages/core vitest run packages/core/backends/
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

Steps the runner carries, which the host Mac CANNOT (golangci-lint is absent here — verified
2026-08-06, `command -v golangci-lint` → not found):

- **Step 6 — live E3 proof:** after harvest pushes the branch, confirm a green CI run exists for the head
  SHA AND that the job carrying the backends suite concluded SUCCESS (job-level, not run-level — a
  run-level green with a skipped job proves nothing).
- **Step 7 — runner-side cell upgrade (closes the T-AJ-A loop):** capture the REAL golangci-lint JSON for
  `fixtures/firing/invalid/` from the runner, then upgrade `capability-matrix.json`'s syntax cell from
  `status:"no"` + `refusedCode:"PENDING-RUNNER-CAPTURE"` to `status:"partial"` + `evidence`
  (`kind:"live-fired"`, date, `toolchain:"golangci-lint v1.55.2"`, `capturedDiagnostic`). The matrix
  self-test must then pass WITH the real evidence. **Owned by the dispatching session, not aif** — aif is
  already done by then.

If any host-verify step fails, the dispatching session does NOT accept the REPORT: it requests a rework
round or parks, and says which.

## §7 See also

- `.claude/orchestrator-prompts/adapter-jig/kickoff.md` — the BINDING umbrella kickoff (§1 J3, §5 STOP).
- `.claude/orchestrator-prompts/adapter-jig-j3-redfix-meta-launch/kickoff.md` — the predecessor dispatch
  kickoff (red-CI fix + Option B). Its §1 is CLOSED; §2 is the ancestor of this kickoff's §2.
- `docs/superpowers/specs/2026-07-22-adapter-jig-design.md` — BINDING design (§2 F1-F11, §3 arms incl.
  E3, §9 J3 DoD).
- `docs/superpowers/specs/2026-07-22-adapter-jig-contract.md` — the F1-F11 frozen-contract checklist.
- `packages/core/backends/cargo/` + `packages/core/backends/ruff/` — the two shapes to mirror.
- `agents/adapter-jig-reviewer.md` — the cold 8-group review protocol.
- `agents/fidelity-auditor.md` — the cold WHAT-conformance auditor for this PR's acceptance.
