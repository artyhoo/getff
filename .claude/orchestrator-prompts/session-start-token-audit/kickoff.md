<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: kickoff — session-start-token-audit umbrella. Operator-commissioned 2026-07-26 («session-start token audit», attribution-before-cutting). Cold-reviewed per /arch §2 (two-altitude, aif-dispatched seats). Tier 1 — all trim moves are PRE-DECIDED below (§1 S2 table); stages are expansion + measurement, not design. The marker above routes the whole pipeline (plan+implement+review) to the executor profile; fidelity-verdict-in-pr-body is a registered required check on staging (re-verified 2026-07-31; the gh-api command and its output are quoted in §0, and §0 requires re-running it at dispatch time). -->

# session-start-token-audit — kickoff

> **Goal:** a fresh CC session in this repo starts with ~100k tokens consumed; our own injected
> file set measures ~140 KB ≈ 36-40k tokens. Attribute every injected artifact to its injecting
> channel (file:line), then trim by re-scoping channels — never by demoting a load-bearing
> always-on check ([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md)).
> Budget target: our injected set ≤20-25k tokens (operator-adjustable — surface a fork if
> evidence says otherwise).
>
> **What exists (verified 2026-07-26 at `origin/staging`=73e039674c; re-verified 2026-07-31 at
> `3172cc5653` — `git diff --stat 73e039674c origin/staging -- CLAUDE.md '.claude/rules/*.md'
> '.claude/settings.json'` returns EMPTY, so every byte figure below still holds; re-verify
> live — T3):**
>
> - **Injection mechanism (the signal-1 mismatch, resolved):** Claude Code natively loads at
>   session start: user `~/.claude/CLAUDE.md`, project `CLAUDE.md`, and **every
>   `.claude/rules/*.md` that has no `paths:` YAML frontmatter**, minus files listed in
>   `claudeMdExcludes` (`.claude/settings.json:214-219` — currently exactly 4 rules:
>   egress-no-api-bypass, memory-codification, recommendation-laziness-discipline,
>   reviewer-discipline; empirically confirmed absent from a live session start while all other
>   NO-paths rules were present). The repo's own `<!-- globs: -->`/`<!-- channel: -->` markers
>   (consumed by `.claude/hooks/inject-matching-rule.sh` + `scripts/render-rule-index.mjs`) do
>   NOT restrict the CC-native loader — a rule with a globs marker but no `paths:` frontmatter
>   is injected in full every session regardless of its declared channel. That is the whole
>   mismatch: `zcode-parity-doctrine.md` declares edit-time inject via globs marker (`:8`) but
>   carries no `paths:` frontmatter → full 22 KB at every session start.
> - **Live session-start observation (2026-07-31, host CC — the T-TOK-B evidence S1 must
>   reproduce, not re-derive from docs):** computing `no-paths:-key MINUS claudeMdExcludes` over
>   `origin/staging` yields exactly **7** rules — 00-rule-index, ai-laziness-traps,
>   attention-is-not-a-mechanism, autonomous-loop-continuity, build-first-reuse-default,
>   git-conflict-merge-forward, zcode-parity-doctrine — and exactly those 7 were present in a
>   live host-CC session's injected context, the 15 `paths:`-carrying rules being absent except
>   those whose globs matched the path that session was editing. **The discriminator is the
>   `paths:` KEY, not the presence of a frontmatter block:** `autonomous-loop-continuity.md:1-3`
>   HAS frontmatter (`description:` only) and is still always-on. S1's script must test for the
>   key, not for `---`.
> - **Measured bytes at 73e039674c** (`git show origin/staging:<f> | wc -c`): CLAUDE.md 26,517 ·
>   ai-laziness-traps.md 26,387 · zcode-parity-doctrine.md 22,177 ·
>   autonomous-loop-continuity.md 13,459 · build-first-reuse-default.md 12,667 ·
>   git-conflict-merge-forward.md 9,285 · 00-rule-index.md 4,095 ·
>   attention-is-not-a-mechanism.md 2,629; plus operator-local: `~/.claude/CLAUDE.md` 3,593 ·
>   `MEMORY.md` 19,407 (Russian → ~2× token cost/byte vs English). Sum = 140,216 bytes.
> - **Precedents for both trim levers:** 15 rules already use `paths:` frontmatter (edit-time
>   conditional); the 4 `claudeMdExcludes` entries are a SUBSET of the 5 rules whose declared
>   channel is hook/agent/skill-embed/digest — `autonomous-loop-continuity.md` (channel: hook)
>   is the one gap in the existing pattern, which S2 row 2 closes (cold-review r1 finding).
> - **Byte-measurement provenance:** the repo-file numbers are `git show origin/staging`
>   measurements (any environment can reproduce); the two operator-local numbers
>   (`~/.claude/CLAUDE.md` 3,593 · `MEMORY.md` 19,407) are host-cc-only measurements
>   (2026-07-26) — NOT reproducible from the container (its own MEMORY.md is a different,
>   1,158-byte file). S1's environment column carries this split.
> - **Ownership handoff (Artifact Ownership Contract):** `.claude/rules/*` and CLAUDE.md are
>   maintainer-owned; this umbrella is the operator's explicit 2026-07-26 commission to edit
>   them for channel re-scoping ONLY (no rule-content rewrites) — that commission is the
>   required explicit handoff.

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement:** this kickoff MUST be on `origin/staging` before dispatch
  ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)).
- **Profile marker:** dispatcher verifies the marker name resolves against the live
  `/runtime-profiles` list (resolver errors loudly on ambiguity; fix via small staging PR).
- **Tier-1 marker precondition (re-verify at dispatch time):** the always-marker exception is
  active ONLY while `fidelity-verdict-in-pr-body` is a required check on staging. Authoring-time
  evidence (re-run 2026-07-31, output verbatim):
  `gh api repos/:owner/:repo/branches/staging/protection/required_status_checks`
  → `{"strict":false,"contexts":["ci-success","fidelity-verdict-in-pr-body"],…}`. The dispatcher MUST re-run that
  command; if the check is no longer registered, dispatch WITHOUT the marker (Tier-2 routing:
  top tier plans) — do not edit this file's marker silently, surface it.
- **In-flight probe:** before each stage dispatch run the CLAUDE.md pre-dispatch probe. Known
  neighbors: task «Fix recurring worktree node_modules provisioning gap» (do NOT touch
  worktree-provisioning surfaces); any PR touching `.claude/rules/**` or `CLAUDE.md` merged
  after 73e039674c → re-measure before trimming (the repo moves fast).
- **Named collision risk — the `per-role-context` track (BINDING, added 2026-07-31):** an active
  research track on staging (`docs/superpowers/specs/2026-07-26-per-role-context-*.md` +
  `docs/meta-factory/research-patches/2026-07-2{6,7}-per-role-context-*.md`, merged #1176-#1180)
  is evaluating per-role digest shaping, and **its candidate options edit
  `.claude/hooks/inject-session-bootstrap.sh` / `inject-subagent-digest.sh` — the same file S2
  note B touches.** That track has itself already identified this umbrella as «the natural host
  for any role-context-budget work». Before S2: re-read that track's current state, and if a
  digest-shaping change is in flight, coordinate rather than land conflicting edits — the
  note-B addition is one line inside the `AIF_AUTONOMOUS` block and must not be folded into,
  or clobbered by, a digest restructure.
- **Stages are sequential** (S2 consumes S1's table; S3 proves S2). One PR per stage onto
  staging; do not collapse.

## §1 Stages

- **S1 — measurement script + attribution table.** Deliverables: (i)
  `scripts/measure-session-start-tokens.sh` — deterministic, zero-LLM: enumerates the injected
  set (project CLAUDE.md; user `~/.claude/CLAUDE.md` if readable, else skip with a printed
  note; every `.claude/rules/*.md` lacking `paths:` frontmatter minus `claudeMdExcludes`
  entries parsed from `.claude/settings.json`; `MEMORY.md` path taken from `$HOME/.claude/projects/<slug>/memory/` if present), prints per-file bytes + estimated
  tokens + total. Token estimate MUST state its conversion in the output header (T-TOK-A):
  bytes/4 for ASCII-dominant files, bytes/2.2 when >30% of bytes are non-ASCII (measured, e.g.
  `LC_ALL=C grep -o '[^\x00-\x7F]' | wc -c` or equivalent) — a stated heuristic, not a claim of
  tokenizer truth. (ii) Attribution table committed as
  `docs/meta-factory/research-patches/2026-07-26-session-start-token-attribution.md`: one row
  per artifact → injecting channel (file:line of the mechanism — CC-native loader vs
  `claudeMdExcludes` vs `paths:`) → measured tokens → why-hot justification quoted from the
  rule's own Class/channel declaration, or «none found». (iii) **Falsifier branch (BINDING):**
  the ~60k harness remainder (tool schemas, skills/agents listings, MCP instructions,
  SessionStart hook payloads e.g. the superpowers full-skill inject) is enumerated
  qualitatively in the same patch with per-category controllability verdict
  (ours-to-trim / settings-recommendation / uncontrollable). If our injected set is <40% of
  the measured session-start total, the patch MUST say so and S2's scope shifts to: apply the
  rule-channel trims anyway (cheap, already decided) + emit a harness-settings recommendation
  section instead of pretending file-trims solve the 100k. (iv) **Per-environment attribution
  (operator input 2026-07-26, BINDING):** the aif-container executor runs a DIFFERENT harness
  environment — its session-start injection set is NOT the host CC set (no operator
  `~/.claude/CLAUDE.md` / MEMORY.md; and it is unverified whether that harness honors `paths:`
  frontmatter or `claudeMdExcludes` at all). The attribution table carries an environment
  column (`host-cc` / `aif-container`); container rows are attributed from a live probe inside
  the container (e.g. `docker exec` into `aif-handoff-agent-1` reading the harness's actual
  injected set or session log), never by assuming host semantics. If the container harness
  ignores a lever, the table says so — that changes which S2 moves pay off in which
  environment, and S2's works-criteria must be re-checked per environment.
  **Fallback if the container is unreachable at S1 run time (BINDING — the executor is never
  left without a valid action):** attempt `open -a Docker` plus one retry; if still unreachable,
  record every container row as `INCONCLUSIVE — container unreachable at S1 run (<date>)` and
  proceed with the host rows. A NAMED gap is permitted; silently extrapolating host semantics
  into the container column is T-TOK-C and is not. S2 MUST re-probe before relying on any
  container row, and any S2 move whose payoff rests on container behaviour stays blocked while
  its row reads INCONCLUSIVE.
  (v) **Injection-channel enumeration beyond the CC-native set.** Enumerate the hook
  registrations in `.claude/settings.json` — the `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
  `Stop`, `SubagentStart`, `SubagentStop`, `SessionStart` arms (`.claude/settings.json:61-213`) —
  one row per registered hook, recording each arm's emitted payload size where it can be
  captured side-effect-free (invoke the hook, count stdout bytes); mark the rest
  `unmeasured — not safely invocable` rather than dropping the row. This is what makes (iii)'s
  falsifier branch **attributable** instead of a catch-all bucket, and it is the only way S3 can
  re-discover a non-CC-native injection: the (i) script enumerates the CC-native auto-loaded set
  by construction and can never see a SessionStart hook payload.
- **S2 — channel re-scoping (all moves PRE-DECIDED; execute, don't re-design).**
  | artifact | move | mechanism |
  |---|---|---|
  | zcode-parity-doctrine.md | add `paths:` frontmatter converted from its `<!-- globs: -->` marker (line 8) — **see note A; do NOT paste the marker string verbatim** | CC-native conditional load; @dual-pair keep-identical convention |
  | autonomous-loop-continuity.md | add to `claudeMdExcludes` **paired with the compensating wait-rule line of note B — the pairing is BINDING; the exclusion alone is rejected** | settings.json proposal + one prose line in an already-shipping hook |
  | git-conflict-merge-forward.md | add to `claudeMdExcludes` (channel: claude-md — the CLAUDE.md Harness-gates pointer bullet + operator-global git-safety hook stay); accepted degradation recorded in note C | settings.json proposal |
  | CLAUDE.md | hot/cold split: move the `## Umbrella closure convention` **section** (`CLAUDE.md:134` — a section heading, not a bullet body) plus the bullet bodies «Promote staging→main mechanics», «Never move a branch ref…» and «Meta-orchestrator self-review obligation» to `docs/meta-factory/operational-conventions.md`; each replaced by a one-line pointer keeping its trigger phrase | plain edit + new doc with doc-authority header |
  | MEMORY.md index | English-compressed rewrite of index LINES only (content files stay RU) delivered as `proposals/MEMORY.en.md` under this umbrella dir + application instruction in PR body | operator-applied (outside repo) |
  | ai-laziness-traps.md, attention-is-not-a-mechanism.md, build-first-reuse-default.md, 00-rule-index.md | **STAY** (declared always-on core) — do NOT demote | — |
  **Note A — `paths:` format (the failure mode is SILENT).** `paths:` is a YAML **list**, one
  item per glob (precedent: `ci-tool-pinning.md:3-9`). Pasting the marker's comma-separated
  string as a scalar yields either «rule never loads» or «rule stays always-on» — both without
  any error, defeating the trim invisibly. zcode carries NO frontmatter block today (its line 1
  is the `#` title), so the block must be CREATED; contrast `autonomous-loop-continuity.md:1-3`,
  which already has a `description:`-only block. Frontmatter and the doc-authority header
  coexist fine — 15 rules already carry `paths:`, 11 of them registered in principle 09
  `REQUIRED_HEADER_DOCS` (`packages/core/principles/09-doc-authority-hierarchy.ts:28-55`), and
  zcode is one of them. Inserting the block SHIFTS every line number in the file: re-grep any
  `zcode-parity-doctrine.md:<line>` citation repo-wide afterwards and update it in the same PR.
  **Note B — why the exclusion is BINDING-paired (cold-review r1 MAJOR).** The rule's own Class
  header (`autonomous-loop-continuity.md:9`) already declares its channels as (a) the Stop-hook
  arm and (b) «the always-on autonomy block in `inject-session-bootstrap.sh` … prose delivered
  reliably» — always-on CLAUDE.md injection is **not** among them. But that block
  (`inject-session-bootstrap.sh:48-65`) carries only 3 items today, covering §1's stop rule and
  §3's `#invented-constraint`; **§2's wait rule is delivered by nothing except the always-on
  injection this move removes.** So S2 adds a 4th one-line item to the existing block carrying
  §2's operative prescription (a bounded waiter that always emits a terminal verdict; always
  pass `--timeout-ms`), delivering it to exactly the audience that needs it (`AIF_AUTONOMOUS=1`)
  rather than to every session. This CLOSES a declared-channel-vs-reality gap rather than
  opening one — the same defect class as the zcode row, which is why it belongs in this
  umbrella. Add the paired assertion to `packages/core/hooks/inject-session-bootstrap.test.ts`
  in the same PR: verified 2026-07-31 that the file has **zero** autonomy-block coverage
  (`grep -ci autonom` → 0 across its 222 lines), so this is a NEW assertion, not an update. If
  the executor judges the pairing unsound, do NOT proceed unpaired — surface the fork; the
  fallback is keeping the rule always-on and accepting its ~13.5 KB.
  **Note C — accepted degradation, recorded not silent (r1 MINOR).** Excluding
  `git-conflict-merge-forward.md` leaves an agent meeting a CONFLICTING PR without the §2
  merge-forward recipe pre-loaded: the muscle-memory `git rebase` is blocked by the
  operator-global `git-safety.sh` at execution time, and the CLAUDE.md Harness-gates pointer
  routes to the recipe — so the cost is one wasted first-attempt cycle, not a wrong outcome.
  That cost is ACCEPTED in exchange for 9,285 bytes at every session start. Falsifier: if the
  post-S2 window produces an agent that attempted rebase, was blocked, and still failed to reach
  the recipe, revert this row.
  Delivery note: `.claude/settings.json` is agent-uncommittable (deny-listed) — ship the
  `claudeMdExcludes` change as a ready-to-apply diff file
  `proposals/settings-claudeMdExcludes.diff` under this umbrella dir, referenced in the PR
  body for the maintainer to land manually. **Diff-content invariant (BINDING):** that diff adds
  exactly 2 lines — `.claude/rules/autonomous-loop-continuity.md` and
  `.claude/rules/git-conflict-merge-forward.md` — with ZERO deletions and ZERO other changes,
  taking `claudeMdExcludes` from 4 entries to 6 (`.claude/settings.json:214-219`). Any further
  line in that diff is a review-time reject: the file is maintainer-applied and
  agent-uncommittable, so a stray `+reviewer-discipline.md` would silently demote a load-bearing
  always-on rule at every future session start with no gate to catch it afterwards.
  Regenerate `00-rule-index.md`
  (`npx tsx scripts/render-rule-index.mjs --write`) and keep `--check` green. Every pointer
  left behind MUST name the moved content's trigger («when X, read Y») — no silent removal.
  Descopes (BINDING): no rule-content rewrites; no new gates/hooks; no edits to
  harness-internal overhead (tool schemas etc.); no demotion of any always-on check without an
  operator fork. **Single permitted exception:** note B's one-line prose addition to the
  EXISTING `AIF_AUTONOMOUS` block in `inject-session-bootstrap.sh` plus its paired test
  assertion — that is the prose payload of a hook that already ships, not a new gate or hook,
  and it is the compensation that makes the autonomous-loop-continuity row a re-scoping rather
  than a demotion.
- **S3 — paired proof + closure.** Re-run `scripts/measure-session-start-tokens.sh` post-trim;
  append before/after table to the S1 research patch (same conversion method both sides).
  Budget check: our set ≤25k estimated tokens → GREEN; miss → surface fork to operator (e.g.
  splitting ai-laziness-traps §2 catalogue) — do NOT trim further autonomously. Write
  `done.md` per CLAUDE.md umbrella-closure convention in this final PR.

## §2 «Works» per stage (explicit + testable)

- S1: script runs on host, exit 0, output lists every file the live session start actually
  contains (cross-checked against one live session-start observation quoted in the patch);
  attribution table has zero rows without file:line mechanism evidence; every container row is
  either probe-backed or explicitly INCONCLUSIVE; the (v) channel enumeration covers every hook
  registered in `.claude/settings.json` with a size or an `unmeasured` reason.
- S2: fresh measurement shows zcode-parity-doctrine + autonomous-loop-continuity +
  git-conflict-merge-forward absent from the CC-native always-on set (script recomputes the
  no-`paths:`-key-minus-excludes set from the edited files; the settings.json half asserted
  against the proposal diff applied in a temp copy); the proposal diff satisfies the
  diff-content invariant (exactly 2 added lines, 0 deletions); the note-B compensating line is
  present in `inject-session-bootstrap.sh`'s `AIF_AUTONOMOUS` block AND asserted by a new test
  in `inject-session-bootstrap.test.ts` that FAILS if the line is removed;
  `render-rule-index.mjs --check` green; principle tests green; CLAUDE.md pointers resolve
  (lychee-clean).
- S3: before/after table committed; both numbers produced by the same committed script; the (v)
  channel enumeration re-run, so any non-CC-native injection introduced between S1 and S3 is
  surfaced by name instead of being absorbed into the harness remainder.

## §3 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this umbrella: T3, T7, T10, T14, T15, T19.**

- **T3** — every attribution row carries the mechanism's file:line + a measured number; no
  prose-only rows.
- **T7/T10** — enumerate the injected population from the live mechanism (settings + frontmatter
  scan), not from the operator's seed list; the seed list above is evidence, not the population.
- **T14** — if the harness remainder can't be attributed, report «coverage insufficient», not
  «harness overhead» as a catch-all.
- **T15** — self-application: the audit measures its own artifacts too (this kickoff, the new
  research patch, `operational-conventions.md`) and states their session-start cost (they are
  cold files — expected 0; prove it via the script's set computation).
- **T19** — own cold-QA of each diff before handoff; CI green ≠ design review.
- **T-TOK-A (domain)** — reporting bytes as tokens without stating the conversion. Counter:
  the script prints its divisor rule in the output header; every table restates it.
- **T-TOK-B (domain)** — attributing an injection to a mechanism from doc claims instead of a
  live probe. The repo's own index declared zcode as edit-time-inject while reality injected it
  every session. Counter: at least one live session-start observation per channel claim.
- **T-TOK-C (domain)** — assuming the host-CC injection semantics hold in the aif container
  (different harness, different injected set, levers possibly ignored). Counter: S1 (iv)
  per-environment column with an in-container live probe; never extrapolate host → container.

```bash host-verify
bash scripts/measure-session-start-tokens.sh
npx tsx scripts/render-rule-index.mjs --check
```

## See also

- [.claude/rules/rule-enforcement-channel-selection.md](../../rules/rule-enforcement-channel-selection.md) — channel doctrine S2 must respect.
- [.claude/rules/attention-is-not-a-mechanism.md](../../rules/attention-is-not-a-mechanism.md) — the never-demote constraint.
- [.claude/rules/doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md) — header requirements for the new `operational-conventions.md`.
- `.claude/settings.json:214-219` (`claudeMdExcludes`) + `scripts/render-rule-index.mjs` — the two existing levers.
- Operator commission (2026-07-26) — attribution-before-cutting method, falsifier branch, budget 20-25k.
