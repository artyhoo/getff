<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage S2 of the getff-honest-signals umbrella. Thin dispatch adapter — semantics are BINDING in the sources below, NOT restated here. -->

# getff-honest-signals-s2 — consumer push not blocked by framework dangling refs

> **Stage 2 of 6.** One stage = one PR onto `staging`. Do NOT do any other stage's work.
> **Binding sources (read both, in order):**
> 1. `.claude/orchestrator-prompts/getff-honest-signals-meta-launch/kickoff.md` §4 «Stage 2 / S2» + §5 AI-traps.
> 2. `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` §8.2 — BINDING for semantics.
>
> **Branch:** `fix/getff-honest-signals-s2`. **Base:** `staging`. **Precondition:** S1 merged.

## §1 The defect

A **consumer** whose own changed markdown is clean still gets their push blocked, because the lychee
link-check section walks **framework-shipped** files that carry framework-internal refs which do not
resolve in a consumer checkout. The consumer is punished for our shipped content.

**Live anchors (⚠ the umbrella kickoff's `pre-push.ts:1273` is STALE — DRIFT-2; re-verify all of these, T3):**

| What | Live location |
|---|---|
| lychee section function | `packages/core/hooks/pre-push.ts:1318` — `function lycheeSection(ctx: SectionCtx): void` |
| section registry entry | `packages/core/hooks/pre-push.ts:1438` — `{ id: 'lychee', owner: 'both', run: (c) => lycheeSection(c) }` |
| ref-rewriting helper | `setup.d/lib.sh:52` — `transform_internal_refs`, used by `10-skills.sh` / `20-agents.sh` |

`owner: 'both'` is what makes the section run in a consumer as well as in the framework repo.

## §2 What to build — two parts, both DECIDED (do not redesign)

1. **Scope the lychee section to consumer-authored changed markdown.** Framework-shipped paths are
   excluded from the walk. The consumer's own files are still checked — this narrows the blast radius,
   it does not disable the gate.
2. **Make delivery rewrite framework-internal refs completely** — extend `transform_internal_refs`
   coverage so shipped files stop carrying refs that only resolve inside this repo. The known scale is
   the **248-file `README.md#why-this-exists` class**; measure the live number yourself and report it.

Part 2 is the root-cause fix; part 1 is the guard that keeps a consumer unblocked while any residue exists.
Ship **both** — a PR with only part 1 hides the shipped-content defect behind a narrowed gate.

## §3 «Works» — the paired fixture (binding)

RED pre-fix, GREEN post-fix, **both runs quoted** in the PR body.

- **Shape:** a consumer-clean diff **plus** a shipped file carrying a dangling framework ref → **push passes**.
- **T-HS-A (binding):** assert the **EXIT CODE first**, wording second.
- Add coverage that the section still **fails** when the *consumer's own* changed markdown has a real
  dangling link — otherwise part 1 has silently disabled the gate, which is this umbrella's defect class
  wearing the opposite mask.

## §4 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists to prevent.

**Stage-specific park triggers (do NOT guess these):**

- The **definition of «framework-shipped»** for the exclusion, if no existing manifest/predicate in the repo
  already expresses it — park rather than inventing a new path convention.
- Whether extending `transform_internal_refs` would rewrite a ref that is **legitimately** framework-internal
  in a file that ships anyway — park with the concrete file.

## §5 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for this stage: T3, T7, T14, T15, T19, T21.**

- **T3** — `:1273` is already proven stale; assume the rest drifted too and re-verify before relying on any line.
- **T7 / T14** — the theme is skip-reported-as-green; a narrowed gate that no longer fails on anything is the same lie.
- **T15** — run the changed pre-push section against this repo itself and report what it says.
- **T19** — own cold-review before handoff.
- **T21** — the backward-check must enumerate sibling surfaces the diff did NOT touch (other `owner: 'both'` sections), never restate the PR.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-HS-A (umbrella)** — asserting on message TEXT instead of exit code.
- **T-S2-A (this stage)** — **narrowing the gate INSTEAD of fixing the shipped refs.** Part 1 alone makes the
  symptom disappear and the failing fixture go green, so it looks complete. The 248-file class is still shipped
  and still wrong. Counter: §2 requires both parts; the PR body reports the live count of remaining
  framework-internal refs in shipped files, before and after.

## §6 Anti-scope

- Do NOT touch any other stage's surface (mutation runner, datetime rules, CI templates, refresh, `inject-matching-rule`).
- Do NOT disable or delete the lychee section.
- Do NOT write `done.md` — closure belongs to S6.
- Do NOT add npm deps.

## §7 PR body

If your diff touches `packages/core/templates/**`, `.claude/rules/**`, `.claude/skills/**`, `agents/**`,
`packages/core/principles/**`, or `CLAUDE.md`, the **§1.7 Forward/Backward sections are REQUIRED** — see the
meta-launch kickoff §4b for the exact shape (H3 headings, the word «applied», ≥40 non-whitespace chars and
≥1 `path.ext:N` citation per section) and run its pre-flight grep before `gh pr create`.
