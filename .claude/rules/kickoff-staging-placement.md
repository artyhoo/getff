---
description: Kickoff staging-placement — dispatch-input merge-timing discipline
paths:
  - ".claude/orchestrator-prompts/**"
---

# Kickoff staging-placement — dispatch-input discipline

<!-- globs: .claude/orchestrator-prompts/** -->
<!-- inject: Kickoffs are read from `staging` by /pipeline + aif. Author → MERGE the kickoff to staging → only THEN hand out `/pipeline <umbrella>` or an aif dispatch. A worktree-branch-only kickoff is invisible to dispatch sessions (coordination CANON syncs only gitignored files, not tracked kickoffs). -->

> **Class:** A — companion principle test shipped at [packages/core/principles/44-kickoff-authoring-traps.test.ts](../../packages/core/principles/44-kickoff-authoring-traps.test.ts) (2026-09-02), plus two earlier-channel gates for the §5.2/§5.3 anti-patterns: the `.husky/pre-commit` CANON-symlink section and [`check-kickoff-traps.sh`](../hooks/check-kickoff-traps.sh) arm 3. **§1 itself stays ungated** — merge *timing* (author-on-branch → merge-to-staging → dispatch) is not assertable at any branch-scoped channel, and its own §4 promotion criterion has not fired; the Class letter reflects the rule's shipped enforcement surface, not a claim that every section is gated. The Class-B compensating mechanism (edit-time reminder injected by [`inject-matching-rule.sh`](../hooks/inject-matching-rule.sh) via the `globs:` marker above) remains live. Promotion record in §4.
> **Fires:** editing/creating any file under `.claude/orchestrator-prompts/<umbrella>/`.
> **Authoritative for:** where dispatch-input kickoffs must live before a `/pipeline` or aif dispatch is initiated, and why; the edit-time reminder mechanism; **the kickoff-authoring failure modes that render as success on this surface** (§5) — an authoring mistake under `.claude/orchestrator-prompts/**` that produces no warning at any channel.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Kickoff §3 authoring obligations (T-enumeration) — see [ai-laziness-traps.md §3](ai-laziness-traps.md). Coordination symlink sync — see [`scripts/link-coordination.sh`](../../scripts/link-coordination.sh). What a kickoff filename IS (the stage/sidecar/unrecognised classification) — see [`packages/core/principles/kickoff-population.ts`](../../packages/core/principles/kickoff-population.ts), the SSOT §5.3's gates resolve against.

> **Origin:** 2026-06-16, recurring incident (2×). Kickoffs were authored + committed on a feature worktree branch, then `/pipeline <umbrella>` / aif dispatch sessions — which run on `staging` — could not see them. The first time, a `/pipeline pipeline-i18n-fix` run on staging resolved to a stale same-named plan and fixed the wrong thing (PR #578 ≠ the intended output-directive). Codified at maintainer request: «нужен тест или хук на тригер — когда пишем кикоф, чтобы напоминал куда сохранять».

## §1 The rule

Kickoffs under `.claude/orchestrator-prompts/<umbrella>/kickoff.md` are **tracked** files, read from the **`staging`** branch by every dispatch consumer:

- `/pipeline <umbrella>` scans `.claude/orchestrator-prompts/*/kickoff.md` on the branch its session runs on (normally `staging`).
- aif-handoff autonomous workers run against a `staging`-synced container base.

A kickoff that exists **only on a feature worktree branch is invisible** to them. The coordination CANON (`~/.claude-coordination/`) does **not** rescue this: [`link-coordination.sh`](../../scripts/link-coordination.sh) symlinks only *gitignored* content files; tracked kickoffs travel via git, i.e. via `staging`.

**Sequence (binding):** author the kickoff → **merge it to `staging`** (PR, squash) → **only then** hand out `/pipeline <umbrella>` or initiate an aif dispatch. Telling anyone to dispatch before the kickoff is on `staging` is the violation.

## §2 Trigger

Editing or creating any file under `.claude/orchestrator-prompts/<umbrella>/` (kickoff.md, done.md, dispatch inputs) — the `globs:` marker above scopes the edit-time reminder to exactly this surface.

## §3 Mechanism (edit-time reminder — earliest reachable channel)

The `<!-- globs: -->` + `<!-- inject: -->` markers at the top wire the convention into [`inject-matching-rule.sh`](../hooks/inject-matching-rule.sh): on any Edit/Write under `.claude/orchestrator-prompts/**`, the injector delivers the one-line reminder as PostToolUse `additionalContext`, once per session. This is the earliest reachable channel — there is no pre-push/CI gate for «is this kickoff on staging yet?», because at author time the answer is legitimately «not yet»; the discipline is about not *dispatching* until it is.

## §4 Promotion / retirement

- **Promotion to a `/pipeline` preflight gate (§1 — NOT yet fired):** if a further «kickoff-not-on-staging caused a misdispatch» incident fires after this rule lands, add a check in the `/pipeline` skill §1 preflight that, for the named umbrella, asserts `git ls-tree origin/staging` contains the kickoff before dispatching — fail loudly otherwise. Zero such incidents since 2026-06-16; §1 remains prose + edit-time injection.
- **Promotion RECORD (§5.2 + §5.3 — landed 2026-09-02, Class B → A).** Both anti-patterns below were measured live on 2026-09-02 while authoring the `beta-docs-showcase` BS0 stage kickoff; each shipped a gate at its own earliest reachable channel, with a durable backstop for commits no local hook runs (aif-container work):

  | Anti-pattern | Earliest reachable channel | Gate shipped | Durable backstop |
  |---|---|---|---|
  | `#canon-symlink-swallows-commit` (§5.2) | pre-commit — edit-time cannot see a symlink that does not exist yet | `.husky/pre-commit` CANON-symlink section (error, `fail=1`) | [principle 44](../../packages/core/principles/44-kickoff-authoring-traps.test.ts) arm A (`git ls-files -s` mode `120000`) |
  | `#kickoff-name-near-miss` (§5.3) | edit-time — the only channel that fires BEFORE dispatch, which can precede any push | [`check-kickoff-traps.sh`](../hooks/check-kickoff-traps.sh) arm 3 | [principle 44](../../packages/core/principles/44-kickoff-authoring-traps.test.ts) arm B (on-disk population) |

  Both are **errors, not warnings** — [attention-is-not-a-mechanism.md §1](attention-is-not-a-mechanism.md)'s corollary rejects a load-bearing warning whose only consumer is «somebody reads the log», and in both cases the correct action is unambiguous (re-add in one step; rename to one of two named forms).
- **Retirement:** 12 consecutive months with zero misdispatch-from-missing-kickoff incidents → archive to prose in [CLAUDE.md](../../CLAUDE.md). Matches peer-rule retirement criteria ([reviewer-discipline.md §4](reviewer-discipline.md)).

## §5 Anti-patterns

All three share one shape: **an authoring mistake on this surface that renders as success.** `git status`, the linters and the existing gates all report normal; the cost lands later, on somebody else.

### §5.1 `#dispatch-before-staging`

Instructing `/pipeline <umbrella>` or an aif dispatch while the kickoff lives only on a feature branch. The dispatch session (on `staging`) silently can't find it and either no-ops or resolves to a stale same-named artifact. Counter: §1 sequence — merge first, dispatch second.

### §5.2 `#canon-symlink-swallows-commit`

Writing a new file under `.claude/orchestrator-prompts/<umbrella>/` and running `git add` in a **later, separate step**, so the commit takes a **symlink** instead of the content.

This surface is gitignored (`.gitignore:16`) with per-umbrella `!` exceptions, and [`link-coordination.sh`](../../scripts/link-coordination.sh) adopts every **untracked** file here into `$CANON`, leaving a symlink behind. A brand-new stage kickoff looks like coordination content to the helper until its `.gitignore` exception lands — so between the write and the `git add` there is a window in which the real file becomes an 84-byte link.

**Measured 2026-09-02:** commit `9e046c6d55` carried `120000 blob 2d02772193b2b6c1ba2301edf3cc00a3e2902640` while the 232-line kickoff existed only in `$CANON` (`git ls-tree <sha> <path>` is the check). Nothing surfaced it — `git status` showed a normal path, `wc -l` read through the link, markdownlint reported `0 error(s)` on the linked target, and the pre-commit orchestrator-prompts validator passed. The damage is **deferred**: the commit is worthless as a copy, so a later `$CANON` cleanup destroys the only one.

**Counter:** write the file and `git add` it in **one step**. Gates: §4 promotion record.

**Blast radius (swept 2026-09-02):** this class is confined to `.claude/orchestrator-prompts/**`. `link-coordination.sh` walks only `$WT_DIR/.claude/orchestrator-prompts` (`scripts/link-coordination.sh:75`), and it is the only CANON-symlinking mechanism in the repo. The other gitignored-with-exceptions blocks in `.gitignore` (`/.ai-factory/*` + 4 negations, `/.opencode/*`, `/.claude/skills/aif-*/`, `node_modules/`) are never symlink-managed, so the same shape cannot arise there. Re-run the sweep if a second CANON-sync consumer ships.

### §5.3 `#kickoff-name-near-miss`

Naming a stage kickoff so that it **just misses** the stage-kickoff family, making every gate treat it as a deliberate sidecar and report green having examined nothing.

`kickoff-bs0.md` fails `STAGE_KICKOFF_RE` ([`kickoff-population.ts:34`](../../packages/core/principles/kickoff-population.ts)) because `[a-z]` consumes `b` and then `\d` meets `s`. It therefore landed in the same bucket as `kickoff-amendments.md`, and principle 12's T-enumeration/citation gate never examined it. **Verified 2026-09-02:** `npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts` passed with the malformed file present. `kickoff-b0.md` — umbrella letter plus stage digit — matches, and is gated.

The regex is not wrong; its `<letter><digit>` core deliberately keeps dotted sidecars out. The defect is that **a near-miss was indistinguishable from a deliberate sidecar**, and the feedback was a false green.

**Counter:** a `kickoff-*` name must resolve to one of exactly two things — the stage form `kickoff-<letter><digit>[alnum].md`, or a named sidecar (`kickoff[-<stage>].<kind>.md`, or the exact-name allowlist). Anything else is a loud error naming both alternatives, never a silent reclassification. The classification is a single SSOT (`classifyKickoffName` in [`kickoff-population.ts`](../../packages/core/principles/kickoff-population.ts)); no gate re-implements the regex ([`dual-implementation-discipline.md §8`](dual-implementation-discipline.md) `#sync-by-copy-paste`). Gates: §4 promotion record.

## §6 §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (mechanism is an edit-time bash injector, zero API calls), [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (carries Class + Authoritative-for header), and [build-first-reuse-default.md](build-first-reuse-default.md) (REUSE — no new hook; the existing `inject-matching-rule.sh` globs mechanism delivers it, zero new code).
- **Backward-check:** codifies the 2026-06-16 recurring incident; supersedes nothing. Self-applies — this very rule is delivered through the mechanism it documents.
- **Forward-check (2026-09-02, §5.2 + §5.3):** complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (all three gates are `git`/`readdir`/regex — zero API calls); [attention-is-not-a-mechanism.md §1](attention-is-not-a-mechanism.md) (both gates are deterministic, both are errors — the corollary against load-bearing warnings is the reason neither is a warning); [rule-enforcement-channel-selection.md §3](rule-enforcement-channel-selection.md) (mechanically detectable → gate at the narrowest earliest channel, §4 table); [dual-implementation-discipline.md §7-§8](dual-implementation-discipline.md) (one SSOT — `classifyKickoffName`; the bash twin's stage test was converted from an unbounded `case` glob to a regex mirroring `kickoff-population.ts:34`, closing a latent `#sync-by-copy-paste` divergence rather than adding one); [ai-laziness-traps.md §2](ai-laziness-traps.md) T3 (every claim here carries a command or a `file:line`), T15 (this note), T19 (both gates live-fired against real violations before shipping, not only against synthetic strings). Build-vs-reuse consult recorded as [SSOT #265](../../docs/meta-factory/prior-art-evaluations.md) (`pre-commit-hooks` symlink family → ADAPT: right surface, inverted predicate) and [#266](../../docs/meta-factory/prior-art-evaluations.md) (`ls-lint` → REJECT: adopting it would add a fourth hand-kept copy of the very regex the gate exists to agree with).
- **Backward-check (2026-09-02, §5.2 + §5.3):** *Class of the change = «a gitignored-with-exceptions directory whose untracked files are symlink-adopted into a shared store, so a staged path can be a link rather than content».* Surfaces where the class can occur = every `!` negation block in `.gitignore` (`grep -n '^!' .gitignore` → 23 entries) intersected with the CANON-symlinking population. **SWEPT:** `scripts/link-coordination.sh:75` walks only `$WT_DIR/.claude/orchestrator-prompts`, and it is the sole CANON-symlinking mechanism (`grep -rln 'claude-coordination' --include='*.sh' --include='*.ts'` → `link-coordination.sh` symlinks; `check-ask-files.sh:72` only *reads* `$CANON/session-bus/asks`; `adopt-orchestrator-prompts` is the same dir). **SWEPT-CLEAN:** the `/.ai-factory/*` block (4 negations), `/.opencode/*`, `/.claude/skills/aif-*/`, `node_modules/` — none symlink-managed, class cannot arise. **GAP-FOUND → fixed here:** `.claude/orchestrator-prompts/**`. Sibling naming sweep: the on-disk `kickoff-*` population (37 files, measured 2026-09-02 via `classifyKickoffName` over the whole dir) classifies as 29 stage / 6 dotted-sidecar / 1 exact-sidecar / **1 pre-existing near-miss** — `defer-reflex-detection/kickoff-stage-2-and-3.md`, a genuine dispatch input under a name no channel ever recognised, grandfathered with rationale at [`kickoff-population.ts`](../../packages/core/principles/kickoff-population.ts) `GRANDFATHERED_KICKOFF_NAMES` (untracked, so it never reached `staging`; its umbrella is closed). **Exemption mechanism + its own test:** the grandfather list is an explicit allowlist (principle 12 `EXEMPT_LIST` precedent), asserted by name in [`44-kickoff-authoring-traps.test.ts`](../../packages/core/principles/44-kickoff-authoring-traps.test.ts) so a stale entry is visible, and re-asserted at the hook channel in [`check-kickoff-traps.test.ts`](../../packages/core/hooks/check-kickoff-traps.test.ts) arm-3 paired-positives.

## See also

- [`inject-matching-rule.sh`](../hooks/inject-matching-rule.sh) — the injector that delivers this rule's reminder at edit-time.
- [ai-laziness-traps.md §3](ai-laziness-traps.md) — the sibling kickoff-authoring obligation (T-enumeration), enforced at edit-time by `check-kickoff-traps.sh`.
- [CLAUDE.md `Operational conventions`](../../CLAUDE.md) — sibling dispatch conventions (pre-dispatch in-flight probe, parallel-session dispatch).
- [`scripts/link-coordination.sh`](../../scripts/link-coordination.sh) — coordination symlink sync (gitignored-only; why CANON does not cover tracked kickoffs, and the §5.2 adoption window).
- [`packages/core/principles/kickoff-population.ts`](../../packages/core/principles/kickoff-population.ts) — SSOT for the kickoff family + `classifyKickoffName` (§5.3); shared by principles 12/40/43/44 and mirrored by the `check-kickoff-traps.sh` bash twin.
- [`packages/core/principles/44-kickoff-authoring-traps.test.ts`](../../packages/core/principles/44-kickoff-authoring-traps.test.ts) — the §4 Class-A companion, durable backstop for both §5.2 and §5.3.
- [attention-is-not-a-mechanism.md §1](attention-is-not-a-mechanism.md) — why §5.2/§5.3 ship as errors, not warnings.
