<!-- scope: kickoff — getff-freshness-widening STAGE S0 (kickoff hardening). Parent: .claude/orchestrator-prompts/getff-freshness-widening-meta-launch/kickoff.md §1 (D1-D7) + §4 S0. Design base (BINDING): docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §7/§9/§10/§12. Tier 1 (mechanical: apply seven named corrections to ONE file). Doc-only, no code. -->

# getff-freshness-widening S0 — kickoff hardening

> **Goal:** the umbrella kickoff `.claude/orchestrator-prompts/getff-freshness-widening/kickoff.md`
> was authored **before** the upstream `getff-any-stack-trace` umbrella finished. Its §0 «re-plan
> rule» obliges the planner to fold the trace umbrella's landed diffs + `done.md` residuals before
> S1 dispatch. This stage does exactly that, and only that: **seven named corrections to one file.**
> No code. No spec edits. No new stages beyond the one D2 names.
> **Why this stage exists at all:** two of the seven are **fail-closed** — `scripts/host-verify.sh`
> rejects the umbrella today, and the missing §4c park contract blocks autonomous dispatch of
> S1–S4b. S1 cannot start until they land.

## §1 The seven corrections (each carries its verification, T3 — do NOT restate, re-verify)

Every item below was verified live at `0e9e058fbf`. **Re-verify each anchor before editing** —
if an anchor has moved or an item is already closed, say so in the REPORT with evidence and skip
it. Do not "fix" something that is already correct.

- **D1 — the go lane is missing from S4.** `getff-any-stack-trace/done.md` «Descoped / routed
  onward» routes **cargo + go** rung parity into this umbrella; the umbrella's S4 says only
  «js/rust parity». The go lane is live: `setup.d/47-go.sh`, `packages/core/backends/golangci/`,
  PR #1236. **Edit:** S4 names the go lane explicitly, using `done.md`'s own «cargo + go» phrasing.
- **D2 — the `--refresh` framework-reconciliation gap has no home.** `done.md` routed it to
  widening («untouched here»); no umbrella stage names it. **Edit:** insert it as **its own stage
  `S4b`**, after S4, before S5. This placement is **DECIDED, not open** — (a) the upstream routed
  it *into* this umbrella, so descoping needs a reason and keeping needs none; (b) umbrella §1
  binds «each = one PR onto staging; do NOT collapse», and S4 already carries three lanes + the
  fixture debt at `L` volume, so folding `--refresh` in would collapse two concerns into one PR.
  **Falsifier — the one case that reverses this:** if a landed trace-umbrella diff already closes
  `--refresh`, record the file:line evidence and descope it explicitly instead.
- **D3 — the cargo rung-5 delivery cascade is under-named.** `done.md` routes it as a distinct
  item; the umbrella folds it into «mirror the agent-surface delivery on the cargo lane».
  **Edit:** name it as its own S4 deliverable.
- **D4 — S5 says «RE-RUN» a protocol that has never run, and it is host-only.** `done.md`:
  «One-beat cold-run protocol RUN — **PARKED** … The AUTHORING stands; the RUN defers to the host».
  **Edit:** S5 reads «**run** (first run — the trace umbrella parked it)» **and** «**on the host**,
  never from inside a container», citing `done.md`'s parking rationale (cold-start conditions #2
  and #3 are unsatisfiable for a dispatched container worker).
- **D5 — «byte-identity gate across ALL THREE hook copies» is not the mechanism that exists.**
  Verified: `packages/core/hooks/deps-hash-check.test.ts:515-527` compares **two** files;
  `grep -n plugin packages/core/hooks/deps-hash-check.test.ts` → **0 hits**. The two `.sh` copies
  share md5 `dac36e32e6fb44c72e3fe6a62f8d9ea9`; `plugin/hooks/deps-hash-check` is md5
  `fa7910b4646c6a8bed8140c5b200e000` — a different artefact. The hook header at
  `.claude/hooks/deps-hash-check.sh:2-6` nevertheless claims a «3-way guard».
  **Before editing, establish which mechanism actually covers the plugin twin** — CLAUDE.md states
  `plugin/hooks` twins regenerate via pre-commit; **confirm that against the real pre-commit
  wiring, do not take it from CLAUDE.md prose** (this is the single least-confident item in the
  whole stage). **Edit:** S2 instructs the executor to edit the **source** copy, notes that the
  dogfood copy is held identical by the named test, and states the twin's real mechanism.
  **If the hook header's «3-way guard» claim turns out to be false, that is a SEPARATE finding —
  report it, do not fix it here** (it is not this stage's file).
- **D6 — no `host-verify` contract (fail-closed).** `bash scripts/host-verify.sh
  getff-freshness-widening` → «declares no `host-verify` contract block». **Edit:** add a fenced
  block whose info-string is `bash host-verify`, naming the commands that decide acceptance **on
  the host** (grammar: `destination-environment-verification.md §1`; this stage's own §3 block is
  a working example to copy the shape from).
  Choose them from the umbrella's own §2 «works» criteria — do not invent a plausible-looking
  command that nobody runs (`#optout-as-reflex`'s sibling). Do **not** take the `host-verify: none`
  opt-out: this umbrella has executable deliverables.
- **D7 — no §4c park-don't-guess contract.** `grep -qi 'park it as a question'` on the umbrella
  kickoff → ABSENT, so autonomous aif dispatch of S1–S4b is blocked
  (`#autonomous-dispatch-without-park`). **Edit:** add the §4c contract with the Lever-2 text
  verbatim. Copy it from `.claude/skills/pipeline/SKILL.md §4c` / the meta-launch kickoff §4c —
  do not paraphrase; the pre-dispatch gate greps for the literal phrase.

## §2 Permitted files

- `.claude/orchestrator-prompts/getff-freshness-widening/kickoff.md` — the only file this stage edits.

Nothing else. Not the spec, not an ADR, not `done.md`, not any hook or test. **Recording a fired
PARK is not a file write** (see `/pipeline §5` park-record contract): it lands in the park payload
+ the PR's `## Parked questions`, and its correction lands as a separate owner commit — so this
allowlist deliberately names no park-record artefact.

## §3 «Works» (explicit + testable)

1. `bash scripts/host-verify.sh getff-freshness-widening` exits **0** (was: «declares no
   `host-verify` contract block»). Quote the before/after output.
2. `grep -qi 'park it as a question' .claude/orchestrator-prompts/getff-freshness-widening/kickoff.md`
   succeeds. Quote the added block.
3. `npx vitest run packages/core/hooks/check-kickoff-traps.test.ts` green (both arms).
4. `npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts` green (the umbrella
   kickoff keeps its §3 T-enumeration through the edit).
5. The diff touches **exactly one** file. `git diff --name-only origin/staging...HEAD` returns one path.
6. Every one of D1–D7 is either **applied** (quote the resulting lines) or **explicitly skipped
   with evidence** (quote the command/file:line proving it was already correct). Silence on any
   item is a stage failure.

```bash host-verify
bash scripts/host-verify.sh getff-freshness-widening
npx vitest run packages/core/hooks/check-kickoff-traps.test.ts
npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts
```

## §4 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T3, T7, T8, T13, T14, T19.**

- **T3** — every «already correct, skipped» claim carries the command output or file:line that
  proves it. Prose-only skips are not accepted.
- **T7** — the seven items are a checklist, which is exactly what invites tick-box compliance.
  Applying an edit that *mentions* go / `--refresh` / the host without changing what the stage
  actually instructs is the failure mode. Each edit must change what a downstream executor DOES.
- **T8** — the answers to «which lanes», «where does `--refresh` go», «is S5 host-only» are all
  in §1 above with their rationale. Do not ask; only a genuine new fork gets parked.
- **T13** — the trace umbrella's `done.md` is an ADOPTED input, not trusted ground. D5 is the
  live proof: the umbrella kickoff asserted a gate that the test does not implement.
- **T14** — «I could not find the plugin-twin regen wiring» ≠ «the twin is unguarded». Report
  coverage honestly and park the question rather than asserting either direction.
- **T19** — cold-QA your own diff before handoff; a green CI is form, not substance.

**Domain-specific traps (S0-specific, NOT in the canonical catalogue):**

- **T-S0-A — «correcting» the kickoff into a re-plan.** This stage has one file and seven named
  edits. The temptation, once inside a kickoff that is provably stale, is to keep improving it —
  restructure stages, tighten §2, refresh anchors nobody asked about. That is scope creep into the
  planning session's territory and it destroys the reviewability of the diff. Counter: §2 permits
  one file; §3 item 6 demands D1–D7 accounted for **and nothing else narrated as a change**.
- **T-S0-B — writing the `host-verify` block to satisfy the exit code rather than to decide
  acceptance.** `host-verify.sh` exits 0 on any block whose commands pass, so a trivially-green
  command (`echo ok`, a test that touches nothing this umbrella builds) buys the exit code and
  destroys the mechanism — the whole point is that these commands decide whether the umbrella's
  work is real **on the host**. Counter: every declared command must trace to an umbrella §2
  «works» criterion; state which one, per command, in the REPORT.

## §5 Anti-scope

- No code. No test edits. No hook edits. No spec or ADR edits.
- Do not create the S4b stage's *content* — D2 asks only that the umbrella kickoff **names** the
  stage; the stage itself is authored later.
- Do not open additional PRs for anything noticed in passing (CLAUDE.md `PR strategy`) — surface
  it in the REPORT as an observation.
- Do not edit `~/.claude/skills/orchestrator/` (agent-uncommittable).

## §6 aif agent — fork discipline (non-negotiable)

On ANY genuine fork or ambiguity (two defensible edits, an undecided design choice, a missing
detail that changes what a downstream executor does) — **do NOT pick.** Park it as a question
(set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A →
consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the
unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists to
prevent.

The known candidate for a legitimate park is **D5** — if the plugin-twin's real guarding
mechanism cannot be established from the repo, park it rather than asserting one.

## See also

- Parent: [getff-freshness-widening-meta-launch/kickoff.md](../getff-freshness-widening-meta-launch/kickoff.md) §1 (D1–D7) + §4.
- Target: [getff-freshness-widening/kickoff.md](../getff-freshness-widening/kickoff.md) — the file this stage edits.
- Upstream: [getff-any-stack-trace/done.md](../getff-any-stack-trace/done.md) — the routed-onward list D1–D4 come from.
- Spec (BINDING): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) §7, §9, §10, §12.
- [destination-environment-verification.md §1](../../rules/destination-environment-verification.md) — the contract D6 adds.
