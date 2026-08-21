# Kickoff — Wave N8 A-phase, item C4: dual-pair / cc-only marker completeness gate

> Scope: implement the C4 deterministic gate from the N8 findings. I-phase (build a check), not an R-phase audit.
> Authoritative content sources (read first): [findings §1 C4](../../../docs/meta-factory/research-patches/2026-05-22-n8-rphase-findings.md) · [dual-implementation-discipline.md §5/§6/§9](../../../.claude/rules/dual-implementation-discipline.md) · [wave-sequencing-plan §5.3 D3](../../../docs/meta-factory/wave-sequencing-plan.md).

## 0. Context — where this sits

C1 (SSOT-existence on `Prior-art:` trailers, PR #170) and C2 (kickoff T-enumeration gate, PR #174) are **MERGED to `staging`**. C4 is next by correctness-ROI per findings §7 D3 (order C1→C2→C4→C3→C5). Follow the **C1/C2 precedent exactly**: pure/testable logic + paired-negative tests + a clean single-concern PR into `staging`.

## 1. The goal (what to build)

[`dual-implementation-discipline.md §6`](../../../.claude/rules/dual-implementation-discipline.md) requires: every CC-native hook under `.claude/hooks/*.sh` must carry **either** `# @dual-pair: <anchor>` (it has a portable counterpart) **or** `# @cc-only-rationale: <reason>` (CC-only, with a stated reason). Today this is a **prose / reviewer-time** check (§6 has a runnable grep sketch but it is not wired). A new hook can ship with no marker and nothing blocks it — the silent-CC-lock-in audit trail (§1b) is lost.

**C4 = wire that marker-presence check as a mechanical gate.** A hook author cannot land a `.claude/hooks/*.sh` without declaring its delivery-channel intent.

## 2. The load-bearing constraint — forward-going (do NOT break it)

`dual-implementation-discipline §9` is explicit: the annotation protocol is **forward-going**. As of now, **4 legacy hooks are intentionally unmarked** and that is the *expected starting state, NOT a violation*:

```
check-doc-authority.sh   deps-hash-check.sh   inject-session-bootstrap.sh   validate-prompt.sh
```

(The other 4 — `ask-question-reminder.sh`, `end-of-turn-reminder.sh`, `inject-matching-rule.sh`, `check-kickoff-traps.sh` — already carry markers.)

A naive repo-wide gate would fail the 4 legacy hooks → wrong. The gate **must** fire only on hooks the push **adds or modifies** ("at next touch", §9), not on untouched legacy files.

## 3. Channel decision + the one real fork

- **Detectable?** Yes (grep for `^# @(dual-pair|cc-only-rationale):`) → **gate**.
- `.claude/hooks/*.sh` are **tracked** (unlike kickoffs), so pre-push / CI / principle-test are all reachable.
- **Recommended channel = pre-push, range-scoped** (reuse `getChangedFiles(upstreamRef)` from [`packages/core/hooks/utils/git.ts`](../../../packages/core/hooks/utils/git.ts)). Range-scoping to `origin/staging..HEAD` maps *exactly* to "at next touch" with **no allowlist to maintain** — the cleanest forward-going fit, and the same pattern C1/s17 already use.

**FORK (surface to maintainer, recommend, let them decide):**
- **Option A (recommended): pre-push range-scoped grep.** Fires on added/modified `.claude/hooks/*.sh` in the push range; no legacy-allowlist needed. Wrong if: the maintainer wants CI-wide enforcement independent of the push range.
- **Option B: principle test** `packages/core/principles/<N>-dual-implementation.test.ts` with a shrinking `BASELINE_EXEMPT` allowlist of the 4 legacy hooks (parallel to principle 08/12). Repo-wide + CI, but needs allowlist upkeep, and §9's promotion threshold ("3 violations OR 5th dual-channel artefact") has **not** fired yet — so a full principle test may be premature. Wrong if: §9 threshold is judged already met.

Lead with Option A unless the maintainer asks otherwise.

## 4. Build steps (mirror C1/C2)

1. **Pure logic** in a testable module (e.g. extend `packages/core/hooks/checks/` or add `dual-pair.ts`): `hasChannelMarker(content: string): boolean` (matches `^# @(dual-pair|cc-only-rationale):`), and `runDualPairCheck(changedHookPaths, readFile)` returning findings. Keep git I/O injected (GitProvider / a readFile fn) — pure + Stryker-mutatable, like `prior-art.ts`.
2. **Wire into `pre-push.ts`** a new section: list changed `.claude/hooks/*.sh` in range (`getChangedFiles`), assert each carries a marker, `process.exit(1)` with a fix-hint listing the offending file(s). Match the existing section style.
3. **Paired-negative test** `packages/core/hooks/checks/dual-pair.test.ts`: ❌ a marker-less hook in range → finding; ✅ `@dual-pair`-marked → pass; ✅ `@cc-only-rationale`-marked → pass; ✅ untouched legacy hook (not in range) → never flagged; boundary: marker not on its own `^#` line / mid-prose backtick must NOT count (anchor like inject-matching-rule's own-line guard).
4. **shellcheck-clean** if any bash is added; `tsc` clean; run `test:principles`.

## 5. Scope boundaries (do NOT do)

- Do **NOT** retroactively add markers to the 4 legacy hooks in this PR (that is a *separate* maintainer-batched commit per §9; surface as an observation).
- Do **NOT** build the §5 *drift check* (verifying a `@dual-pair` anchor has a matching counterpart) — that is a heavier, separate item; C4 is **marker presence only**. Note it as a possible follow-up.
- Single-concern PR into `staging`. Capability commit (new ≥80 LOC test) → carries a `Prior-art:` trailer (cite SSOT #20 CC-hooks-API, or #43 RuntimeAdapter for the channel-abstraction vocabulary — verify the row exists, C1's own gate now checks this).

## 6. AI-laziness traps — `ai-laziness-traps.md §2` (kickoff obligation §3)

See [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md). **Active traps for this item: T3, T5, T11, T15, T16.**
- **T3** (no prose-only findings): assert marker presence with an actual grep/test + file:line, not "looks fine".
- **T5** (no implementation bundled into research): this is I-phase; if you notice an unrelated fix, surface it, don't bundle.
- **T11** (prior-art before building): the mechanism is an ADAPT of the existing `prior-art.ts`/`s17.ts` range-scoped pattern + dual-impl §6 sketch — cite it, don't reinvent.
- **T15** (self-application): the new check is itself shipped code — does it need its own marker / does it apply to itself? Note the answer.
- **T16** (pattern-matching-on-name): grepping the literal `@dual-pair:` is fine, but verify it means "marker present", not "the string appears somewhere in prose documenting the marker" — hence the own-line `^#` anchor.
- **Domain trap T-N8C4-A:** *"4 legacy hooks are unmarked → tempted to 'fix' them in this PR to make the gate green."* That is the forward-going violation §2 forbids. Counter: range-scope the gate so legacy hooks are never in scope; never batch-annotate here.

## 7. ⚠ Working-dir / isolation warning (this session's incident)

A **parallel session shared this working directory** during C2 and switched the branch between `checkout -b` and `commit`, landing the C2 commit on the wrong branch + the wrong PR (#173). **Run C4 in a dedicated `git worktree`** ([parallel-subwave-isolation.md](../../../.claude/rules/parallel-subwave-isolation.md)) with a `node_modules` symlink, and **verify `git branch --show-current` + `git log origin/staging..HEAD` immediately before every commit and push**. Branch FROM `staging` (the trunk), auto-merge INTO `staging`.

## 8. Done = 

PR into `staging`: pure-logic module + pre-push wiring + paired-negative tests green; `tsc`/`shellcheck`/`test:principles` clean; Prior-art trailer validated by C1's arm; the FORK (§3) surfaced in the PR body with your recommendation; legacy-hook batch-annotation surfaced as an observation (not done). Then update memory `project_deterministic_offload_autonomy_economy` (C4 SHIPPED, next = C3).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
