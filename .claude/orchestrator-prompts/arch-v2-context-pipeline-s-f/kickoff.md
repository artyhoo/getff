<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage-scoped dispatch input — S-F of the arch-v2-context-pipeline umbrella (small-fixes queue, handoff decision 13). Tier 1 — each item's «how» is one determinable sentence below, and the judgment for every item was spent at authoring time against live evidence (see the `Evidence` line under each item). Marker: `Z.AI GLM-5.2 SDK`, verified unique against the live `/runtime-profiles` list at authoring time (3 profiles: `Claude Opus (plan+review)`, `Z.AI GLM-5.2 SDK`, `Qwen3.8-Max-Preview`) — re-verify at dispatch per the umbrella §0. Item 4 of the umbrella's S-F row is CONSUMED (see §1.4); the three items below are what remains. -->

# arch-v2-context-pipeline S-F — small-fixes queue

> **Stage goal:** close the three remaining small-fixes items of handoff decision 13, in ONE
> maintenance PR. Each item is a *channel-truth* fix: something claims an enforcement channel it
> does not actually have. Umbrella context:
> [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md) — the S-F row
> of the stage table and the `### S-F — small-fixes queue` prose section are the binding scope
> statement; this kickoff refines the three surviving items with the evidence gathered at
> authoring time, and does not widen them.
>
> **Independent of the S-E → S-D′ chain.** S-F rides token-audit S2 timing, which is met
> (`#1188` merged). It shares no file with S-E, S-H or S-D′ — see §2 for the permitted set.
>
> One PR, no scope beyond the three items below. A systemic issue noticed mid-stage is a PR-body
> observation, never an extra PR ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

**Base:** `origin/staging`. **Mode:** implementation, one PR onto staging.

---

## §1 Items (each «how» is one sentence — Tier-1 by construction)

### §1.1 — `autonomous-loop-continuity.md` declares one channel but has two

**The defect.** [`.claude/rules/autonomous-loop-continuity.md:7`](../../rules/autonomous-loop-continuity.md)
carries exactly one marker — `<!-- channel: hook .claude/hooks/end-of-turn-reminder.sh#F10 -->` —
while the rule's own Class-B header (same file, the `> **Class:**` block) names **two** delivery
mechanisms: the `#F10` Stop-hook arm *and* the always-on autonomy block in
`.claude/hooks/inject-session-bootstrap.sh`. The rendered rule index therefore under-reports the
rule's delivery surface, and the second channel is invisible to every consumer that reads channels
from markers rather than from prose.

**Evidence (verified at authoring time, re-verify before editing):**
- `.claude/rules/autonomous-loop-continuity.md:7` — the single marker.
- `.claude/hooks/inject-session-bootstrap.sh:48` — `# AUTONOMY BLOCK (opt-in, AIF_AUTONOMOUS=1) — F2/F10 of the autonomous-loop diagnostics.`, and `:64` — the block that is actually emitted into the digest. This is a live second channel, not a plan.
- Multi-marker precedent: `.claude/rules/cold-seat-economy.md:3-4` carries two `<!-- channel: -->` lines, and `scripts/render-rule-index.mjs:91` documents the aggregation explicitly («Aggregate repeated channel-marker mechanisms (e.g. cold-seat-economy has two»).
- Anchor-form precedent for this exact hook: `.claude/rules/recommendation-laziness-discipline.md:3` → `<!-- channel: digest .claude/hooks/inject-session-bootstrap.sh#H1 -->`, whose anchor is declared at `.claude/hooks/inject-session-bootstrap.sh:20-21`.

**How (one sentence).** Add a **second** `<!-- channel: digest .claude/hooks/inject-session-bootstrap.sh#F10AUTONOMY -->`-shaped marker line to the rule, and — because principle 31 branch (d) verifies the anchor is *live* — first declare that anchor in the hook with the same two-line comment form `#H1` already uses at `inject-session-bootstrap.sh:20-21`, immediately above the autonomy block.

> **Anchor-name freedom (bounded):** the anchor token is yours to pick, but it MUST (a) exist as a
> literal in `inject-session-bootstrap.sh`, (b) sit adjacent to the autonomy block it names, and
> (c) not collide with `#H1`. Do not reuse `#F10` verbatim if that would make the two markers
> indistinguishable in the rendered index — the point of the fix is that the two channels are
> *separately visible*.

**Then regenerate the index:** `npx tsx scripts/render-rule-index.mjs --write` (the index is
generated, never hand-edited — see its own header).

### §1.2 — the `#autonomous-dispatch-without-park` Lever-1 gate checks a value the loop never sees

**The defect.** The falsifier at
[`.claude/skills/pipeline/SKILL.md:337`](../../skills/pipeline/SKILL.md) and the identical
pre-dispatch gate at
[`.claude/skills/pipeline/templates/meta-kickoff.template.md:151`](../../skills/pipeline/templates/meta-kickoff.template.md)
instruct the dispatching session to confirm Lever-1 by testing a **host** environment variable
(`echo "$AGENT_MAX_REVIEW_ITERATIONS"` non-empty). That check passes on the operator's host while
the value never reaches the aif loop it claims to configure — i.e. it is a gate whose green means
nothing (`#hope-as-gate`, [attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md):
a check whose failure mode is «nobody looked» is not a mechanism).

**Evidence (verified at authoring time — RE-VERIFY all three before editing, and let the
re-verification, not this text, decide the wording you ship):**
- Host: `AGENT_MAX_REVIEW_ITERATIONS=1` (exported from the operator's `~/.zshenv`, whose own comment states the gate «checks AGENT_MAX_REVIEW_ITERATIONS is non-empty on the host»).
- Container: `docker exec aif-handoff-agent-1 sh -c 'echo "${AGENT_MAX_REVIEW_ITERATIONS:-UNSET}"'` → `UNSET`.
- No forwarding path found: `grep -rn 'AGENT_MAX_REVIEW\|AGENT_AUTO_REVIEW\|AGENT_SKIP_REVIEW' packages/runtime-bridge/src/` → **no hits**; the aif compose files carry no such key either.

**How (one sentence).** In BOTH files, replace the host-env leg of the gate with an honest
two-part statement: (i) the *only* verifiable Lever-1 probe is container-side — the exact command
form `docker exec <agent-container> sh -c 'echo "${AGENT_MAX_REVIEW_ITERATIONS:-UNSET}"'` — and
(ii) when that returns `UNSET` (or the container is unreachable), Lever-1 is **UNVERIFIED**, which
downgrades the dispatch to «park contract present, review-iteration ceiling unconfirmed» rather
than passing the gate; the kickoff-presence leg (`grep -qi 'park it as a question'`) is unchanged
and remains a real, blocking check.

> **Binding constraints on the wording you ship.** (a) Do **not** silently delete the Lever-1 leg —
> the honest limitation must be *stated*, not removed (T18: the reversible branch is keeping the
> content and naming its limit). (b) Do **not** invent a forwarding mechanism, an env plumb, or a
> compose edit — that is out of §2's permitted set and would be a new capability, not a small fix.
> (c) The two files must end up **consistent with each other**; a fix to one only is a REVISE.
> (d) If your re-verification contradicts the evidence above — e.g. you find a real forwarding
> path — then the premise of this item is wrong: do **not** ship a fix built on a false premise;
> record the contradiction in the PR body, leave both files untouched, and mark item §1.2
> `DEFERRED — premise falsified`, quoting the command and output that falsified it.

### §1.3 — the `.claude/worktrees/` ignore lives in a channel that does not ship

**The defect.** The aif container's base checkout reports permanent untracked drift —
`?? .claude/worktrees/` (8.9 MB at authoring time). The host does not, because the host ignores it
via `.git/info/exclude:12` (`**/.claude/worktrees/`), which is a **per-clone, untracked** file: it
does not travel with the repository, so every fresh clone — the container base included — sees the
directory as uncommitted work. That is the exact condition aif's branch-isolation dirty-worktree
guard is documented against in the repo's own `.gitignore` comment block (`.gitignore:52-58`,
`packages/shared/src/gitIsolation.ts → assertWorkingTreeClean`).

**Evidence (verified at authoring time, re-verify before editing):**
- `git check-ignore -v .claude/worktrees/` on the host → `/Users/art/code/rules-as-tests-aif/.git/info/exclude:12:**/.claude/worktrees/` — the ignore is local-only.
- `docker exec aif-handoff-agent-1 sh -c 'cd /home/www/rules-as-tests-aif && git status --short'` → `?? .claude/worktrees/`.
- `grep -n worktree .gitignore` → only comment lines; **no** ignore entry for `.claude/worktrees/`.

**How (one sentence).** Add a root-anchored `/.claude/worktrees/` entry to the tracked `.gitignore`,
placed inside the existing dirty-worktree-guard block (`.gitignore:52-58`) and carrying a one-line
comment naming *why* it is root-anchored (same rationale the block already states for
`/.ai-factory/*`: avoid touching the framework's own tracked `.claude/**` entries).

**Do NOT** delete anything from the container, and do NOT touch `.git/info/exclude` on any machine
— the container's existing untracked directory is expected to disappear on the next base refresh
once the tracked ignore lands, and verifying that is the acceptance leg in §3, not a manual
cleanup.

### §1.4 — item 4 is CONSUMED (no work)

The umbrella's fourth S-F item — the E-4 `claudeMdExcludes` absolute-glob hypothesis — was
**CONSUMED 2026-08-06** by the decision-layer spec (P1 operator fix + S-E's P2 assert). Per the
umbrella's own instruction, at S-F acceptance you **verify the S-E assert exists** instead of
re-deriving the hypothesis. If S-E has not merged by the time you run acceptance, record
`item 4: PENDING — S-E not yet merged, assert not verifiable` in the PR body; that is an accepted
outcome, not a blocker, and it is the ONLY item permitted to close as PENDING.

---

## §2 Permitted set (binding — anything outside is out of scope)

Exactly these files may be edited:

- `.claude/rules/autonomous-loop-continuity.md` (§1.1)
- `.claude/hooks/inject-session-bootstrap.sh` (§1.1 — the anchor comment ONLY; the emitted digest text is not yours to change)
- `.claude/rules/00-rule-index.md` (§1.1 — **generated**: produced by `npx tsx scripts/render-rule-index.mjs --write`, never hand-edited)
- `.claude/skills/pipeline/SKILL.md` (§1.2)
- `.claude/skills/pipeline/templates/meta-kickoff.template.md` (§1.2)
- `.gitignore` (§1.3)

**Explicitly NOT in the permitted set:** `~/.claude/**` (operator-owned), any `settings.json`, any
aif/compose file, `packages/**` source, and every file owned by stages S-E / S-H / S-D′. Touching
any of these is a REVISE at review even if it would "help".

---

## §3 Acceptance (each leg must be capable of FAILING — no leg is satisfied by merely doing the item)

1. **§1.1 channel liveness, mutation-shown.** `npx tsx scripts/render-rule-index.mjs --check` is
   green, AND the `autonomous-loop-continuity.md` row of the rendered index names **both**
   channels. Non-vacuity is demonstrated, not asserted: temporarily corrupt the new anchor
   reference (e.g. point the marker at an anchor token that does not exist in the hook), show that
   principle 31 / `--check` goes **RED**, restore, show GREEN. Paste both outputs in the PR body.
   A green-only run is NOT acceptance (T15: RED observed before GREEN).
2. **§1.2 consistency + honesty.** `grep -n 'AGENT_MAX_REVIEW_ITERATIONS' .claude/skills/pipeline/SKILL.md .claude/skills/pipeline/templates/meta-kickoff.template.md`
   shows the SAME gate semantics in both files, and neither file any longer instructs a
   host-side `echo "$AGENT_MAX_REVIEW_ITERATIONS"` as sufficient evidence. Quote the before/after
   lines. If item §1.2 closed as `DEFERRED — premise falsified`, this leg is replaced by the
   falsifying command + its output.
3. **§1.3 ships in the tracked channel.** `git check-ignore -v .claude/worktrees/` now resolves to
   `.gitignore` (**not** `.git/info/exclude`) — paste the output. Additionally show the negative
   direction: `git check-ignore -v .claude/skills` returns nothing (rc≠0), proving the new entry is
   root-anchored to `worktrees` and did not over-capture `.claude/**`.
4. **Full local gate sweep green** before `gh pr create`: the repo's principle suite and the
   pre-push checks that fire on the touched paths. Red anywhere → fix, do not push.
5. **PR body carries the §1.7 pair** (see §4) and, per item §1.4, one line recording whether the
   S-E assert was verified or `PENDING`.

**Vacuity self-check before you claim done:** for each of legs 1-3, state in one line *what a
lazy-but-plausible implementation would look like that still fails this leg*. If you cannot name
one, the leg is vacuous — say so in the PR body rather than pretending it passed.

### §3.1 Host verification (the container's green is not evidence about the host)

Every deliverable of this stage is a **host-side** artefact — the rule index the operator's
sessions render, the ignore the operator's clones resolve, the skill text the operator's
`/pipeline` reads. A container-side pass says nothing about any of them
([destination-environment-verification.md §1](../../rules/destination-environment-verification.md)).
Run on the HOST before accepting, via `bash scripts/host-verify.sh arch-v2-context-pipeline-s-f`:

```bash host-verify
npx vitest run packages/core/principles
npx tsx scripts/render-rule-index.mjs --check
git check-ignore -v .claude/worktrees/
grep -n 'AGENT_MAX_REVIEW_ITERATIONS' .claude/skills/pipeline/SKILL.md .claude/skills/pipeline/templates/meta-kickoff.template.md
```

Reading the results: the first two must exit green; the third must name `.gitignore` (a hit on
`.git/info/exclude` means §1.3 did not actually ship); the fourth must show the same gate
semantics on both sides (a host-side `echo "$AGENT_MAX_REVIEW_ITERATIONS"` surviving in either
file means §1.2 did not actually ship).

---

## §4 §1.7 PR-body mandate (this stage touches `.claude/rules/**` and `.claude/skills/**` — it applies)

The PR body MUST carry both sections, at heading depth **H3**, with the word **applied**, each
body ≥40 non-whitespace chars and each carrying ≥1 `path.ext:N` citation:

```markdown
### §1.7 Forward-check applied
### §1.7 Backward-check applied
```

Pre-flight before `gh pr create` (all four must pass):

```bash
echo "$PR_BODY" | grep -cE '^### §1\.7 (Forward|Backward)-check applied'
echo "$PR_BODY" | awk '/^### §1\.7 Forward-check applied/{c=1;next} /^###/{c=0} c' | tr -d '[:space:]' | wc -c
echo "$PR_BODY" | awk '/^### §1\.7 Backward-check applied/{c=1;next} /^###/{c=0} c' | tr -d '[:space:]' | wc -c
echo "$PR_BODY" | grep -cE '[^[:space:]]+\.[a-z]+:[0-9]+'
```

**Backward-check content that is actually expected here** (not boilerplate): all three items are
the same defect class — *a declared enforcement channel that does not deliver*. Sweep for siblings
of that class across the surfaces you touched and report GAP/CLEAN per surface: other rules whose
Class header names more mechanisms than their `<!-- channel: -->` markers declare; other gates in
the pipeline skill that probe a host-side value to certify container-side behaviour; other ignores
that live in `.git/info/exclude` rather than the tracked `.gitignore`. Finding none is a legitimate
result **only if you show the enumeration** — a clean sweep with no enumeration is «insufficient
coverage», not «clean».

**Commit trailer:** this stage adds no dependency, no new `packages/core/<new-dir>/` file ≥50 LOC,
and no ≥80 LOC file under `packages/` — it is not a capability commit. If the pre-push prior-art
hook fires anyway, use the escape hatch with a real rationale (≥20 chars, states *why*), e.g.
`Prior-art: skipped — channel-truth corrections to existing rules/skills, no new capability`.

---

## §5 AI-traps active (per [`ai-laziness-traps.md §3`](../../rules/ai-laziness-traps.md); full catalogue there, resident digest at [`ai-laziness-digest.md`](../../rules/ai-laziness-digest.md))

**Canonical traps, live for this stage:**

- **T3** — every finding needs command+output or file:line with the line's actual content. Every acceptance leg in §3 demands pasted output for exactly this reason. No prose-only claims.
- **T5** — this is an I-phase. Do not write a research document instead of the fix; do not open files outside §2.
- **T14** — a clean backward sweep with low coverage is «coverage insufficient to conclude», not «category clean». §4 makes the enumeration mandatory.
- **T15** — recursive self-application: acceptance leg 1 requires an observed **RED before GREEN**. A gate you never saw fail is a gate you have not tested.
- **T18** — the §1.2 fix keeps the content and names its limit; deleting the Lever-1 leg because it is inconvenient is the irreversible branch and is forbidden.
- **T19** — run your own adversarial cold review of the final diff before handoff. Green CI checks form, not substance.
- **T20** — before any verdict in your REPORT («item X is fixed», «the sweep is clean»), run an evidence-bearing command in the same turn and quote its output.

**Domain-specific traps (S-F-specific, NOT in the canonical catalogue):**

- **T-SF-A `#fix-the-symptom-not-the-channel`** — all three items are tempting to "fix" by editing the *visible artefact* while leaving the broken channel intact: hand-editing `00-rule-index.md` instead of declaring the anchor and regenerating; deleting the container's untracked directory instead of shipping the tracked ignore; rewording the falsifier's prose while keeping the host-env check as the operative test. Counter: each acceptance leg in §3 probes the **channel** (`--check` after regen, `git check-ignore` resolving to `.gitignore`, gate semantics matched across both files), never the artefact's appearance.
- **T-SF-B `#premise-inherited-not-re-verified`** — this kickoff hands you evidence gathered at authoring time on a machine whose state can drift before you run. Treating that evidence as fact is the trap; §1.2 makes the contradiction path explicit (`DEFERRED — premise falsified`) precisely so that "the kickoff said so" is never a reason to ship a fix whose premise is dead. Counter: re-run every `Evidence:` command yourself and let YOUR output, not this file, decide.

---

## §6 aif agent — fork discipline (non-negotiable, park-don't-guess)

On ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a
missing spec detail that changes behaviour) — **do NOT pick.** Park it as a question (set the task
to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X /
Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing
a fork to "keep moving" is the failure this whole loop exists to prevent.

**Known forks already resolved for you — do NOT re-open them:** the anchor-name choice in §1.1 (any
token satisfying the three bounded conditions is correct); the §1.2 wording (the two binding
constraints fix the shape); the §1.3 placement (inside the existing guard block). These are not
forks; they are bounded choices with the boundary stated.

**A genuine fork here would look like:** re-verification contradicting an `Evidence:` line
(§1.2 has its own path for this — follow it, do not generalise it to the other items); a
principle test going red for a reason this kickoff does not anticipate; or the §2 permitted set
being genuinely insufficient to close an item.

---

## §7 Stop conditions

- Any item requires editing a file outside §2 → STOP and park; do not widen the permitted set.
- `render-rule-index.mjs --check` red for a reason not caused by your own edit → STOP and park.
- A second reviewer REVISE on unchanged scope → STOP and hand back.
- The S-E stage's branch or files appear in your diff → STOP; that is cross-stage contamination.

## §8 Anti-scope

- Do NOT fix the aif container's state by hand (no `docker exec … rm`, no `.git/info/exclude` edits).
- Do NOT add an env-forwarding mechanism for `AGENT_MAX_REVIEW_ITERATIONS` (§1.2 constraint b).
- Do NOT hand-edit `.claude/rules/00-rule-index.md` (generated).
- Do NOT open a second PR for anything noticed mid-stage — PR-body observation only.
