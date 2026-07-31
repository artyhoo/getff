<!-- scope: stage-scoped dispatch input — S-A ROUND 2 (rework) of the arch-v2-context-pipeline umbrella. Round 1 (aif task 003b0678) delivered on branch feature/arch-v2-context-pipeline-s-a-003b06 and was judged REWORK by the Opus acceptance seat (ADR-5). Self-contained: an executor holding ONLY this file can run it. NO bridge-profile marker — same rationale as round 1 §0. Authored 2026-07-31 by the orchestrating session from the acceptance report. -->

# S-A round 2 — rework from acceptance (arch-v2-context-pipeline)

> **DRAFT — NOT DISPATCH-READY. Do not dispatch this kickoff as it stands.**
> Two things are owed before it goes out, both flagged by the operator 2026-07-31:
>
> 1. **The cross-model edge is unaccounted for.** This input will be executed by a **GLM** worker
>    inside aif, not by Claude Code. GLM-5.2 has documented behavioural deltas (text-only I/O,
>    reasoning-effort modes, function-calling shape) and this repo owns a skill for exactly this
>    contract: [`claude-glm-executor-handoff`](../../skills/claude-glm-executor-handoff/SKILL.md).
>    Run it over this file and adapt the prompt before dispatch. Round 1's own failure mode is
>    suggestive: the M1 fix passed a grep on a **hyphen** — a literal-match reading of an
>    instruction, which is the class of divergence a cross-model contract exists to pre-empt.
> 2. **The gates have not been run on this file.** `check-kickoff-traps.sh` and
>    `scripts/host-verify.sh arch-v2-context-pipeline-s-a-r2 --list` were never executed
>    (the authoring session stopped first). Run both; fix what they flag.
>
> Everything below is drafted from the acceptance report
> ([`docs/superpowers/specs/2026-07-31-arch-v2-s-a-acceptance.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-s-a-acceptance.md))
> and is substantively complete — it needs the two passes above, not a rewrite.

## §0 Dispatch facts (binding)

**Your base is NOT a clean staging tree.** Round 1's work is already committed on
`feature/arch-v2-context-pipeline-s-a-003b06`, which exists in this repository. **Step 1, before
anything else:**

```bash
git merge --no-edit feature/arch-v2-context-pipeline-s-a-003b06
git diff --name-only origin/staging...HEAD   # must list exactly the 3 files in §1
```

If that merge does not produce those three files, **STOP and report** — do not re-implement round 1
from scratch. Round 1 was accepted as substantially correct; you are fixing two defects in it, not
redoing it.

**Round 1 verdict:** REWORK on 2 MAJOR + 7 MINOR. Everything else was accepted: the §1.5 research
contour, the membrane/K-pass/drill-down section, the kill channels, W4(a), W4(c), W6, the thin
wrapper, the file lengths, the descopes, and — explicitly credited — the fact that round 1
fabricated **no** upstream-side quote. Do not touch what was accepted.

**No `bridge-profile` marker** on this kickoff: deliberate, same reason as round 1.

## §1 Files you may touch (exactly these three, no others)

- `.claude/skills/night-mode/SKILL.md` — M1 only.
- `packages/core/skills/upstream-skill-reference.test.ts` — M2 + m1 + m2 + m5.
- `.claude/skills/arch/SKILL.md` — m3, m4, m6, m7 only.

Zero edits under `.claude/rules/`, `CLAUDE.md`, `.husky/`, `.claude/settings.json`,
`.github/`. No new files.

## §2 Upstream facts — HOST-VERIFIED, take these as given

Upstream lives at the operator's `~/.claude/plugins/**` and **does not exist in your environment**.
Do not attempt to verify these and do not fabricate a command output for them. They were verified on
the host by the acceptance seat on 2026-07-31:

- `superpowers/{5.1.0,6.1.1,6.2.0}/skills/brainstorming/` each contain
  `SKILL.md`, `scripts/`, `spec-document-reviewer-prompt.md`, `visual-companion.md`.
- `superpowers/6.2.0/skills/subagent-driven-development/SKILL.md:8` reads: «a task review (**spec
  compliance + code quality**) after each, and a **broad** whole-branch review at the end»; `:74`
  dispatches a final code reviewer; `:258` — «Per-task reviews are task-scoped gates. The broad
  review happens once…».
  **Therefore SDD has ONE task reviewer covering both axes, plus ONE broad final reviewer. There is
  no top-down/bottom-up reviewer split upstream.**
- `~/.claude/plugins/cache/` contains **two** marketplace directories (`ast-grep-marketplace`,
  `superpowers-dev`) — the marketplace segment is a real variable, not a constant.

When you report, write this line verbatim once:
`upstream absent in this environment — §2 upstream facts taken as given from the kickoff`.

## §3 M1 (MAJOR) — drift (b) is half-repaired

**Site:** `.claude/skills/night-mode/SKILL.md:15`.

Round 1 correctly rewrote the opening clause («SDD's per-task reviewer(s) + final whole-branch code
reviewer»; «SDD owns the implement→review→rework loop and its reviewer roster»). **But the same
sentence, one clause later, still assigns tiers to the roster it just retired:** «next tier →
executor + **top-down (spec/architecture) reviewer**» and «cheaper tier → **bottom-up code-quality
reviewer** + mechanical increments».

Per §2, that roster does not exist upstream. The paragraph is now internally inconsistent: sentence 1
says SDD owns the roster, sentence 3 assigns tiers to a roster SDD does not have.

**Why the round-1 grep missed it:** the survivor is spelled `code-quality reviewer` (one hyphen); the
acceptance grep looks for `code-quality-reviewer` (two). The criterion passed on punctuation while
the drift stayed alive — this is the predicted **T-SA-B** («repair a stale claim with a fresher
claim» / criterion-satisfied-drift-alive).

**Fix:** re-cast the tier assignment onto SDD's real roles, or onto tier-only language. Suggested,
not mandatory: «next tier → executor + SDD's per-task review seat … cheaper tier → the final
whole-branch review + mechanical increments». One sentence. Do not introduce any new claim about
upstream beyond §2.

**How to verify (run and quote both):**

```bash
grep -nE 'top-down|bottom-up|code-quality[ -]reviewer|spec-reviewer' .claude/skills/night-mode/SKILL.md
grep -nE 'v[0-9]+\.[0-9]+\.[0-9]+|SDD lines|through v' .claude/skills/arch/SKILL.md .claude/skills/night-mode/SKILL.md
```

Both must return **empty**. The first is deliberately wider than round 1's check — it is the fix for
the hyphen hole, so do not narrow it.

## §4 M2 (MAJOR) — the smoke cannot tell «no upstream» from «broken upstream»

**Site:** `packages/core/skills/upstream-skill-reference.test.ts:120-135` (`discoverUpstreamRoots`).

**Evidence (three probes the acceptance seat ran, varying only `HOME`):**

| `HOME` contains | Current result | Correct result |
|---|---|---|
| nothing | 6 passed — SKIPPED | SKIPPED ✓ |
| `…/superpowers/9.9.9/` with **no `skills/` child** | 6 passed — SKIPPED, **byte-identical to row 1** | must NOT read as «not installed» |
| `…/superpowers/9.9.9/skills/` present but empty | 1 failed / 5 passed | FAIL ✓ |

So a corrupted, relocated, or permission-denied install reads as «not installed» and the
load-bearing check passes silently. `catch { return [] }` at `:132` does the same for a permission
error. This is the exact `#warning-nobody-reads` shape **W5's own environment note was written to
forbid**, so the defect is against the work item's stated intent, not against taste.

**Required behaviour:**

1. If the plugins-cache **base** exists but yields **zero** roots → a distinct, loud, **non-SKIPPED**
   verdict (`BROKEN` or `FAIL`; your call, but it must not be the same signal as «absent»).
2. A `readdirSync` throw is surfaced as a failure, not swallowed into an empty array.
3. The **marketplace segment is globbed**, not frozen. `:124` hard-codes
   `.claude/plugins/cache/superpowers-dev/superpowers`; per §2 there are two marketplaces, so a
   differently-sourced install is permanently and silently skipped. Round 1 correctly globbed the
   *version* segment — do the same one level up.
4. The SKIPPED line prints **the globs searched**, as the round-1 kickoff mandated
   (`SKIPPED — no upstream install discovered at <globs searched>`). It currently prints `HOME=…`
   (`:283`), which is the one field that cannot distinguish the two cases. *(This closes m5.)*

**How to verify (run all four and quote them):**

```bash
npx vitest run packages/core/skills/upstream-skill-reference.test.ts
HOME=$(mktemp -d) npx vitest run packages/core/skills/upstream-skill-reference.test.ts
# and two probes with a synthetic cache under a temp HOME:
#   (a) <cache>/<market>/superpowers/9.9.9/            (no skills/ child)  -> must NOT be SKIPPED
#   (b) <cache>/<market>/superpowers/9.9.9/skills/     (empty)             -> must FAIL
```

Probe (a) is the regression this fix exists for: quote its verdict explicitly. All four are
reproducible in your environment — none needs real upstream.

## §5 MINORs (all small, all in the three files)

- **m1** — `…test.ts:95-96`: the comment claims «the empty-set case is covered by the
  roots-length-zero branch above when ALL roots are unreadable». False: with all roots unreadable
  `upstreamRoots.length !== 0`, so that branch never fires; `available` stays empty and every ref
  fails → FAIL. The *behaviour* is right and fail-closed; the comment describes control flow the
  file does not have. Rewrite it to state the actual behaviour.
- **m2** — `…test.ts:289`: `expect(res.status).toBe('SKIPPED')` sits inside
  `if (res.status === 'SKIPPED')`. Zero assertion value. Drop it, or assert the emitted message
  shape instead.
- **m3** — `arch/SKILL.md:78` claims the cold definition «gates §1.5's K-pass and §3's exit …
  referenced, not re-stated per section», but `:70` and `:86` carry no reference back, and the
  definition sits *after* its first consumer. Either add «(cold as defined in §2)» at both sites, or
  hoist the definition above §1.5. Pick one and say which.
- **m4** — `arch/SKILL.md:119` names the upstream internal file `spec-document-reviewer-prompt.md`.
  True today across all three versions (§2), but a filename is a soft version pin under the
  wrapper-universality decision. Drop the backticked filename; the capability sentence stands
  without it.
- **m6** — `arch/SKILL.md:83` ends «The two §2 seats' prompts each carry a distinct filename» — an
  assertion about prompts the skill does not contain, unverifiable inside the artefact. State the
  rule only, or give the two seats concrete example filenames.
- **m7** — `arch/SKILL.md:42` and `:46` state the trigger-and-explicit-skip rule twice in
  consecutive paragraphs, in a document whose own §2 rule is «stated once and referenced». Drop one.

## §6 Acceptance (all must hold)

1. The §3 and §4 verification commands are run and their **output quoted** in the PR body — command
   plus output, never prose (T3).
2. `grep -nE 'top-down|bottom-up|code-quality[ -]reviewer|spec-reviewer' .claude/skills/night-mode/SKILL.md`
   returns empty, **and** the version/line-number grep over both skills returns empty.
3. M2 probe (a) — cache base present, no `skills/` child — produces a **non-SKIPPED** verdict, quoted.
4. All seven MINORs addressed, each named in the PR body with the line it landed at.
5. `wc -l .claude/skills/arch/SKILL.md` < 600; `awk '/^description: /{print length($0)-13}'` < 1536.
6. `npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts packages/core/principles/12-ai-laziness-traps.test.ts` green;
   `npx tsx scripts/render-rule-index.mjs --check` green.
   *(Principle 14 has a **pre-existing, environment-only** failure in this container — 26 untracked
   `aif-*` skill dirs it sweeps that the host does not have. It is 2/2 green on the host. If you see
   it red, say so and move on; do not "fix" it.)*
7. `git diff --name-only origin/staging...HEAD` lists exactly the three §1 files.
8. PR body carries the §1.7 forward + backward self-check and a `Prior-art:` line **in the body**
   (not only the commit trailer — the squash-trailer-loss gate reads the body).

```bash host-verify
npx vitest run packages/core/skills/upstream-skill-reference.test.ts
npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts
npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts
npx tsx scripts/render-rule-index.mjs --check
```

## §7 Descopes (BINDING)

No S-B..S-F content. No new work items — this round fixes round 1's defects and nothing else. No
re-litigating what acceptance accepted (§0). No new claims about upstream beyond §2. No new
dependency, hook, workflow, or settings registration.

## §8 Park-don't-guess contract (non-negotiable)

If an instruction here is ambiguous, contradicts what you find in the tree, or names a fact you
cannot verify where you run — **park and report; never guess and never fabricate**. State the
instruction, what you found instead, and the readings you are choosing between.

Round 1 got this exactly right in behaviour (it fabricated nothing) but did not record the mandated
verbatim line. This round: record it (§2), once, in your report.

## §9 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this round: T2, T3, T7, T14, T16, T19, T21.**

- **T2** — M2 is not fixed because the code changed: run probe (a) and quote the verdict. A fix
  asserted without its probe is the same defect class round 1 shipped.
- **T3** — every in-repo claim carries its command and output. The upstream half is §2, taken as
  given, recorded with the verbatim line — never re-derived from recall.
- **T7** — §6 is not a checklist to tick: run each command, paste output.
- **T14** — «the grep is empty» ≠ «the drift is gone». M1 exists **because** an empty grep was
  reported as a clean result on a hyphen. When you report a grep as empty, also say what spelling
  variants it would miss.
- **T16** — do not restate SDD's roster from memory or from the old text; §2 is the only source.
- **T19** — your own adversarial read of the diff before you report; a green suite is not a review.
- **T21** — if you write a backward-check, enumerate sibling surfaces, not this round's own files.
- **T-SA-R2-A (domain) — «the acceptance report is the spec».** The report is evidence, not
  authority: it lists *findings*, and two of them (m3, m6) explicitly offer a choice. Choosing is
  yours; report which branch you took and why. Copying the report's suggested wording verbatim
  without deciding is not compliance.
- **T-SA-R2-B (domain) — «round 1 was wrong, so redo it».** The cheapest wrong move here is to
  rewrite accepted sections while «in there anyway». §0 lists what was accepted; touching it is a
  descope violation, and it destroys the acceptance evidence already gathered.

## See also

- [`.claude/orchestrator-prompts/arch-v2-context-pipeline-s-a/kickoff.md`](../arch-v2-context-pipeline-s-a/kickoff.md) — round 1's dispatch input (W1-W6 definitions, still the source of truth for what the stage is).
- [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md) — binding design (ADR-4 membrane, ADR-5 acceptance seat, ADR-7 review dimensions).
- [`.claude/skills/night-mode/SKILL.md`](../../skills/night-mode/SKILL.md) — M1 site; also the tier→model instantiation SSOT.
- [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) · [attention-is-not-a-mechanism.md](../../rules/attention-is-not-a-mechanism.md) · [destination-environment-verification.md](../../rules/destination-environment-verification.md).
