<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: kickoff — session-start-token-audit umbrella. Operator-commissioned 2026-07-26 («session-start token audit», attribution-before-cutting). Cold-reviewed per /arch §2 (two-altitude, aif-dispatched seats). Tier 1 — all trim moves are PRE-DECIDED below (§1 S2 table); stages are expansion + measurement, not design. The marker above routes the whole pipeline (plan+implement+review) to the executor profile; fidelity-verdict-in-pr-body is a registered required check on staging (verified 2026-07-26 via gh api). -->

# session-start-token-audit — kickoff

> **Goal:** a fresh CC session in this repo starts with ~100k tokens consumed; our own injected
> file set measures ~140 KB ≈ 36-40k tokens. Attribute every injected artifact to its injecting
> channel (file:line), then trim by re-scoping channels — never by demoting a load-bearing
> always-on check ([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md)).
> Budget target: our injected set ≤20-25k tokens (operator-adjustable — surface a fork if
> evidence says otherwise).
>
> **What exists (verified 2026-07-26 at `origin/staging`=73e039674c; re-verify live — T3):**
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
> - **Measured bytes at 73e039674c** (`git show origin/staging:<f> | wc -c`): CLAUDE.md 26,517 ·
>   ai-laziness-traps.md 26,387 · zcode-parity-doctrine.md 22,177 ·
>   autonomous-loop-continuity.md 13,459 · build-first-reuse-default.md 12,667 ·
>   git-conflict-merge-forward.md 9,285 · 00-rule-index.md 4,095 ·
>   attention-is-not-a-mechanism.md 2,629; plus operator-local: `~/.claude/CLAUDE.md` 3,593 ·
>   `MEMORY.md` 19,407 (Russian → ~2× token cost/byte vs English). Sum = 140,216 bytes.
> - **Precedents for both trim levers:** 15 rules already use `paths:` frontmatter (edit-time
>   conditional); the 4 `claudeMdExcludes` entries are exactly the rules whose declared channel
>   is hook/agent/skill-embed/digest — the same lever S2 extends.
> - **Ownership handoff (Artifact Ownership Contract):** `.claude/rules/*` and CLAUDE.md are
>   maintainer-owned; this umbrella is the operator's explicit 2026-07-26 commission to edit
>   them for channel re-scoping ONLY (no rule-content rewrites) — that commission is the
>   required explicit handoff.

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement:** this kickoff MUST be on `origin/staging` before dispatch
  ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)).
- **Profile marker:** dispatcher verifies the marker name resolves against the live
  `/runtime-profiles` list (resolver errors loudly on ambiguity; fix via small staging PR).
- **In-flight probe:** before each stage dispatch run the CLAUDE.md pre-dispatch probe. Known
  neighbors: task «Fix recurring worktree node_modules provisioning gap» (do NOT touch
  worktree-provisioning surfaces); any PR touching `.claude/rules/**` or `CLAUDE.md` merged
  after 73e039674c → re-measure before trimming (the repo moves fast).
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
  section instead of pretending file-trims solve the 100k.
- **S2 — channel re-scoping (all moves PRE-DECIDED; execute, don't re-design).**
  | artifact | move | mechanism |
  |---|---|---|
  | zcode-parity-doctrine.md | add `paths:` frontmatter mirroring its `<!-- globs: -->` line 8 verbatim | CC-native conditional load; @dual-pair keep-identical convention |
  | autonomous-loop-continuity.md | add to `claudeMdExcludes` (channel: hook — the Stop-hook arm stays untouched and is the load-bearing half) | settings.json proposal (see delivery note) |
  | git-conflict-merge-forward.md | add to `claudeMdExcludes` (channel: claude-md — the CLAUDE.md Harness-gates pointer bullet + operator-global git-safety hook stay) | settings.json proposal |
  | CLAUDE.md | hot/cold split: move «Promote staging→main mechanics», «Umbrella closure convention», «Never move a branch ref…» bullet bodies, and «Meta-orchestrator self-review obligation» to `docs/meta-factory/operational-conventions.md`; each replaced by a one-line pointer bullet keeping its trigger phrase | plain edit + new doc with doc-authority header |
  | MEMORY.md index | English-compressed rewrite of index LINES only (content files stay RU) delivered as `proposals/MEMORY.en.md` under this umbrella dir + application instruction in PR body | operator-applied (outside repo) |
  | ai-laziness-traps.md, attention-is-not-a-mechanism.md, build-first-reuse-default.md, 00-rule-index.md | **STAY** (declared always-on core) — do NOT demote | — |
  Delivery note: `.claude/settings.json` is agent-uncommittable (deny-listed) — ship the
  `claudeMdExcludes` change as a ready-to-apply diff file
  `proposals/settings-claudeMdExcludes.diff` under this umbrella dir, referenced in the PR
  body for the maintainer to land manually. Regenerate `00-rule-index.md`
  (`npx tsx scripts/render-rule-index.mjs --write`) and keep `--check` green. Every pointer
  left behind MUST name the moved content's trigger («when X, read Y») — no silent removal.
  Descopes (BINDING): no rule-content rewrites; no new gates/hooks; no edits to
  harness-internal overhead (tool schemas etc.); no demotion of any always-on check without an
  operator fork.
- **S3 — paired proof + closure.** Re-run `scripts/measure-session-start-tokens.sh` post-trim;
  append before/after table to the S1 research patch (same conversion method both sides).
  Budget check: our set ≤25k estimated tokens → GREEN; miss → surface fork to operator (e.g.
  splitting ai-laziness-traps §2 catalogue) — do NOT trim further autonomously. Write
  `done.md` per CLAUDE.md umbrella-closure convention in this final PR.

## §2 «Works» per stage (explicit + testable)

- S1: script runs on host, exit 0, output lists every file the live session start actually
  contains (cross-checked against one live session-start observation quoted in the patch);
  attribution table has zero rows without file:line mechanism evidence.
- S2: fresh measurement shows zcode-parity-doctrine + autonomous-loop-continuity +
  git-conflict-merge-forward absent from the CC-native always-on set (script recomputes the
  NO-paths-minus-excludes set from the edited files; the settings.json half asserted against
  the proposal diff applied in a temp copy); `render-rule-index.mjs --check` green; principle
  tests green; CLAUDE.md pointers resolve (lychee-clean).
- S3: before/after table committed; both numbers produced by the same committed script.

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
