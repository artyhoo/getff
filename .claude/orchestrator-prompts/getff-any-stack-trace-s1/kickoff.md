<!-- scope: stage S1 of the getff-any-stack-trace umbrella. Thin dispatch adapter — semantics are BINDING in the sources below, NOT restated here. Tier 2 (no bridge-profile marker): the umbrella carries an open design fork, so project defaults apply — top tier plans, executor implements. -->

# getff-any-stack-trace-s1 — trust threading into the generation path + D7

> **Stage 1 of 4.** One stage = one PR onto `staging`. Do NOT do any other stage's work.
> **Binding sources (read all three, in order):**
> 1. `.claude/orchestrator-prompts/getff-any-stack-trace-meta-launch/kickoff.md` §4 «S1» + §5 AI-traps.
> 2. `.claude/orchestrator-prompts/getff-any-stack-trace/kickoff.md` §1 «S1».
> 3. `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` §4 (incl. §4.3 guard-rails, §4.4 fixtures) — **BINDING for semantics**.
>
> **Branch:** `feat/getff-any-stack-trace-s1`. **Base:** `staging`.

## §1 The gap (code-grounded — re-verify every line live before relying on it, T3)

The validation layer is already Tier-1-capable; the **generation** path never uses it.

| Anchor | State at `264109608` | Consequence |
|---|---|---|
| `packages/core/synthesizer/resolve-ctx.ts` | `resolveCtxForRoot` returns `pipAdapter` for python, `cargoAdapter` for cargo | manifest-derived ctx EXISTS |
| `packages/core/research/allowlist-resolver.ts:375` | `export function validateProvenance(p, resolved, opts?)` — two-arg, resolved-aware | the Tier-1 validator EXISTS |
| `packages/core/synthesizer/research-to-node.ts:44` | imports the **one-arg** `validateProvenance` from `../research/allowlist.ts` | generation is stuck at Tier-0 |
| `packages/core/synthesizer/research-to-node.ts:194` | `const v = validateProvenance(p);` — one arg, no ctx | ditto |
| `packages/core/synthesizer/render-researched-astgrep.ts` | zero occurrences of `ResolveCtx` / `resolveCtx` | threads no ctx to pass down |
| `packages/core/install/rule-bootstrap-cli.ts:81` | `--from-practice` arm parses the flag; the arm receives no ctx | the python consumer lane never gets Tier-1 |
| `packages/core/research/ecosystem-python.ts` | `readHomepageFromMetadata` reads `Project-URL: Homepage` + deprecated `Home-page` only — **zero** `Documentation` handling | D7 gap: FastAPI's real docs host is unreachable |

**Why D7 matters concretely (live-verified 2026-07-23, re-verify at entry):** FastAPI's PyPI
metadata carries `Documentation = fastapi.tiangolo.com` while `Homepage` is a `github.com`
apex — which the multi-tenant apex guard correctly refuses. Reading only Homepage therefore
yields *no eligible host* for exactly the framework this umbrella exists to serve.

## §2 What to build

1. **Thread `ResolveCtx` into the generation path.** `research-to-node.ts` /
   `render-researched-astgrep.ts` / `rule-bootstrap-cli.ts --from-practice` carry the
   manifest-derived ctx down, and the one-arg `validateProvenance` call becomes the exported
   two-arg `validateProvenance(p, resolved, opts?)` form. Do not fork or re-implement the
   validator — the two-arg function already exists and is the SSOT.
2. **Extend `pipAdapter` for D7.** `ecosystem-python.ts` additionally reads
   `Project-URL: Documentation, <url>` (same RFC-822 line-folding discipline the existing
   Homepage reader applies — folded values are rejected, not silently accepted).
   **The multi-tenant apex guard is UNCHANGED: `github.com` stays ineligible.** Widening the
   guard is out of scope and would void the umbrella's trust story.
3. **Clippy-bridge threading** (`research-to-clippy-node.ts`): include if it is a cheap
   mechanical mirror of item 1; otherwise **explicitly defer it to `getff-freshness-widening`
   in the PR body** — a silent omission is not a deferral.

## §3 «Works» — the three committed fixtures (binding, spec §4.4)

| Fixture | Input | Required verdict |
|---|---|---|
| accept-D7·a | SQLAlchemy → `docs.sqlalchemy.org` | admitted, **and the admitting tier asserted as Tier-1** |
| accept-D7·b | FastAPI → `fastapi.tiangolo.com` | admitted, **and the admitting tier asserted as Tier-1** |
| reject | the dependency is absent from the manifest | `research-only` |

The PR body quotes the **actual validator verdicts** from a real run, including the tier
assertion. Prose-only claims are rejected at review (T3/T20).

**Paired-negative discipline:** each accept fixture must be observed RED before the threading
lands (Tier-0 path cannot admit these hosts) and GREEN after. A fixture that is green both
before and after proves nothing.

## §4 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) —
**do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
`blocked_external` with the fork stated as «Option A → consequence X / Option B →
consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork
to "keep moving" is the failure this whole loop exists to prevent.

**Stage-specific park triggers (do NOT guess these):**

- **The ctx-threading signature** — if threading `ResolveCtx` through
  `render-researched-astgrep.ts` requires changing a signature that has callers outside this
  stage's scope, park with the caller list rather than silently widening the blast radius.
- **Documentation-vs-Homepage precedence** — if both keys are present and disagree, and the
  spec §4 does not settle which wins, park with both candidate hosts stated. Do not invent a
  precedence rule.
- **Clippy-bridge cost** — if item 2.3 turns out non-mechanical, park or defer *explicitly*;
  never half-thread it.
- **A guard-rail conflict** — if satisfying D7 appears to require relaxing the multi-tenant
  apex guard, STOP and park. That is a trust-model change, not an implementation detail.

## §5 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) for the full
catalogue. **Active traps for this stage: T1, T3, T7, T11, T15, T19, T20, T21.**

- **T1** — three fixtures is the floor, not a menu. Two greens are a sampling artifact.
- **T3 / T20** — every line number in §1 re-verified live before you rely on it; quoted tool
  output on every «works» claim.
- **T7** — do not tick this stage's list; reason against it. The tier assertion in §3 is the
  substance, not the fixture count.
- **T11** — the D7 extension is a near-capability surface: BFR consult before building, and if
  a capability detector trips, the `Prior-art:` trailer's verdict must match what the diff
  actually does (SSOT #183/#223 are the existing anchors). A correct-sounding trailer over a
  re-implementing body is `#consult-as-trailer-not-input`.
- **T15** — run the threaded path against the framework's own python fixtures and report what
  it says, including anything newly refused.
- **T19** — own adversarial cold-review of the diff before handoff; green CI ≠ design review.
- **T21** — if a §1.7 backward-check applies, the sibling surfaces are the **other lanes**
  (`npmAdapter` in the same resolve-ctx switch; `cargoAdapter` / the clippy bridge) — name each
  SWEPT-CLEAN or GAP-FOUND. A surface list equal to your own diff is non-conformant.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-AST-A (umbrella, binding here)** — **a Tier-0 leak masquerading as Tier-1 success.** An
  accept fixture can go green merely because its host happens to be Tier-0-listed, proving
  nothing about the threading this stage exists to build. Counter: the fixtures assert the
  ADMITTING TIER, and use hosts absent from `packages/core/research/allowlist.ts`.
  **Verified 2026-07-25: `grep -cE 'tiangolo|sqlalchemy' packages/core/research/allowlist.ts`
  → 0. Re-run that grep at entry, and keep it 0** — adding either host to the Tier-0 list
  would void the honesty gate.
- **T-S1-A (this stage)** — **threading the ctx but never asserting it arrived.** Passing a
  `ResolveCtx` parameter that the downstream call ignores type-checks, runs, and proves
  nothing. Counter: the tier assertion in §3 is on the *admitting tier reported by the
  validator*, not on the presence of a parameter in a signature.

## §6 Anti-scope

- Do NOT touch any other stage's surface: no `do_python_lane` delivery phase (S2), no
  `INSTALL-FOR-AI.md` / `agents/rule-researcher.md` (S3), no `audit-self.yml` cell (S4).
- Do NOT narrow `tests/install-sh/python-entry-lane.test.sh` or edit `setup.d/45-python.sh` —
  the D8 contract change is S2's, and it lifts both encodings together.
- Do NOT relax the multi-tenant apex guard (§4 park trigger).
- Do NOT resolve fork F-A (that is S3's).
- Do NOT write `done.md` — umbrella closure belongs to S4.
- Do NOT add npm deps.

## §7 Host-verify contract + PR body

The work runs in a container; it is accepted on the **host**
([destination-environment-verification.md §1](../../rules/destination-environment-verification.md)).
A green container run is not evidence about the host.

```bash host-verify
npx vitest run packages/core/research
npx vitest run packages/core/synthesizer
```

Run via `bash scripts/host-verify.sh getff-any-stack-trace-s1` before accepting; quote the
host output in the PR body.

**§1.7 sections are REQUIRED for this stage.** The diff lands in
`packages/core/synthesizer/**`, which **is** a trigger path of
[`.github/workflows/discipline-self-check.yml`](../../../.github/workflows/discipline-self-check.yml)
(`:24`) — the `§1.7 forward+backward sections present in PR description` job fires and goes RED
without them. Use the exact shape + pre-flight grep in the meta-launch kickoff §4b.

> **Trap (this stage almost shipped it):** the operator-local `~/.claude/hooks/git-safety.sh`
> mirror carries an older path list that omits `packages/core/synthesizer/**`, so a local
> `gh pr create` passes while CI fails. Read the trigger paths from the **workflow file**, never
> from the hook or from a transcribed copy.

**T21 note for the Backward-check:** your sibling surfaces are the other lanes —
`npmAdapter` in the same `resolve-ctx.ts` switch, `cargoAdapter`, and the clippy bridge. Name
each SWEPT-CLEAN or GAP-FOUND with evidence. A surface list equal to your own diff is
non-conformant by format.

`staging` additionally requires the `fidelity-verdict-in-pr-body` check — the PR carries its
`## Fidelity verdict` block.

Quote: the three fixture verdicts (with admitting tier), the RED-before/GREEN-after pair, the
T15 self-application run, and the clippy-bridge include-or-defer decision.
