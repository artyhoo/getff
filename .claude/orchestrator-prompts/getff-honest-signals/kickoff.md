<!-- bridge-profile: glm-5.2 -->
<!-- scope: kickoff — getff-honest-signals umbrella. Design base (BINDING): docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §8 (W5.1-W5.6) + §1 wall 7. Cold-reviewed GO r2 (/arch §2 two-altitude, 2026-07-23). Tier 1 — bridge-profile marker above: whole pipeline (plan+implement+review) on the executor profile. All six semantics are PRE-DECIDED in the spec; stages are expansion, not design. -->

# getff-honest-signals — kickoff

> **Goal:** kill the six measured deceptive-signal defects (spec §1 wall 7 a-f) — each fix
> lands WITH its paired red→green fixture, per the project goal (a signal that lies is worse
> than no signal; README.md#why-this-exists). This kickoff is dispatch input, NOT a design
> restatement — the spec above is BINDING for semantics; re-verify every anchor live at stage
> time (T3).
> **What exists (verified at design time at `origin/staging`=039790bbe; re-verify live):**
> mutation runner skip-as-green (`packages/core/synthesizer/run-generated-rule-mutation.sh:175-178`
> WARN+continue; `:227` PASS on `OVERALL_FAIL==0`); lychee section owner `both`
> (`packages/core/hooks/pre-push.ts:1273`); both datetime rules
> (`packages/core/templates/python/.getff/astgrep-rules/getff-no-datetime-now.yml:9`,
> `getff-no-datetime-datetime-now.yml:9`) vs `packages/core/templates/python/ruff.toml:9`;
> CI template `packages/core/templates/python/github-actions-ci.yml:15-18` `branches: [main]`;
> shipped `.lintstagedrc` template `packages/core/templates/shared/.lintstagedrc.json` (has
> `eslint --fix --max-warnings=0`); `transform_internal_refs` (`setup.d/lib.sh:52`, used by
> `10-skills.sh`/`20-agents.sh`); `inject-matching-rule` hook shipped without a
> `.claude/rules/` corpus.

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement:** this kickoff + the spec MUST be on `origin/staging` before dispatch
  ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)).
- **Profile marker:** the dispatcher MUST verify `glm-5.2` resolves against the live runtime
  profile list before dispatch (`AifHandoffBackend._resolveProfileId` errors loudly on
  no-match/ambiguity — a stale name BLOCKS, it cannot mis-route; fix the marker via a small
  staging PR if renamed).
- **Ordering rule (owner = the dispatching session, at every dispatch):** stages touching
  python-lane files (S3 datetime rules, S4 CI template) land BEFORE any
  `getff-any-stack-trace` stage rewriting the same region. Pre-dispatch in-flight probe
  (CLAUDE.md operational conventions) MUST cover `getff-any-stack-trace` (shared:
  `setup.d/45-python.sh`, python templates, hooks). Re-probe after any Phase -1 review.

## §1 Stages (each = one PR onto staging; do NOT collapse)

- **S1 — mutation runner: skipped ≠ green** (spec §8.1). `run-generated-rule-mutation.sh`:
  skipped rules counted + reported (`N skipped — NOT green`); `tested=0` with rules present
  can NOT print `PASS` (polarity per the neighboring `pre-push.ts:919-938` wording). Fixture:
  a rule whose selector does not fire on its negative input → runner output shows the skip
  verdict and non-PASS exit.
- **S2 — consumer push not blocked by framework dangling refs** (spec §8.2, two-part,
  DECIDED): (i) lychee section scoped to consumer-authored changed md (framework-shipped
  paths excluded); (ii) delivery rewrites framework-internal refs completely via
  `transform_internal_refs` coverage extension (close the 248-file `README.md#why-this-exists`
  class). Fixture: consumer-clean diff + a shipped file carrying a dangling framework ref →
  push passes.
- **S3 — datetime false positive, BOTH rules** (spec §8.3, DECIDED narrow-to-naive): zero-arg
  `now()` stays RED; `datetime.now(timezone.utc)` goes GREEN; message text stays consistent
  with `ruff.toml:9`. Fixtures both ways for BOTH rule files. NOTE: template edits shift
  install fingerprints — regenerate baselines (`SNAPSHOT_MODE=capture
  bash tests/install-sh/snapshot.sh`) in the same PR.
- **S4 — CI template targets the consumer's real default branch** (spec §8.4): delivery
  substitutes the consumer's actual default branch (+ sweep sibling templates for hardcoded
  `[main]`). Fixture: install on a `master`-default repo → the delivered workflow's triggers
  match `master`.
- **S5 — refresh reconciles renames + stale companions** (spec §8.5, DECIDED): refresh
  removes the superseded `.claude/skills/rules-as-tests/` dir (framework-owned) when
  `skills/getff/` is delivered; for consumer-owned `.lintstagedrc` it PRINTS a migration
  offer (diff + instruction) and never overwrites. Fixtures: pre-rename install → single
  skill dir after refresh; stale lintstagedrc → offer printed, file untouched.
- **S6 — `inject-matching-rule` honest no-op** (spec §8.6, DECIDED minimal): corpus absent →
  hook reports ONCE, loudly; never a permanent silent no-op. Fixture: consumer without
  `.claude/rules/` → single loud report, subsequent runs quiet. Hook edits land in ALL
  delivery copies (packages/core SSOT + `.claude` dogfood + plugin twin; byte-identity gate).
  Umbrella closure: write `done.md` (CLAUDE.md convention) in this final PR.

## §2 «Works» per stage (explicit + testable)

Every stage: the paired fixture runs RED on the pre-fix behavior and GREEN post-fix, and the
PR body quotes the actual tool output (no prose-only claims). S3/S4 additionally: fresh-install
smoke green (template deliveries).

## §3 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this umbrella: T3, T7, T14, T15, T19.**

- **T3** — every anchor above re-verified live at stage time; quoted tool output mandatory.
- **T7/T14** — the umbrella's THEME is skip-reported-as-green; do not reproduce it in your own
  fixtures (a fixture that "passes" because the check silently skipped = the defect itself).
- **T15** — S1's fixed runner must be run against the framework's own generated rules as the
  self-application check.
- **T19** — own cold-QA of each diff before handoff; CI green ≠ design review.
- **T-HS-A (domain)** — asserting on message TEXT instead of polarity/exit-code: a fixture
  that greps the new wording but not the exit code passes even if the gate still exits 0.
  Counter: every fixture asserts the EXIT CODE first, wording second.

## See also

- Spec (BINDING): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) §8, §10.
- [byte-identical baseline regen on template edit](../../rules/evidence-regeneration.md) + memory precedent: template edits → `SNAPSHOT_MODE=capture`.
- W5.7 (foreign-dir scan) is NOT here — carved out to `getff-foreign-scan-triage` (Tier 2).
