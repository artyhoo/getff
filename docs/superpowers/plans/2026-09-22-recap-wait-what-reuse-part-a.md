# Recap × `/wait-what` reuse — Part A (glossary growth rule, before S4) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the half of the reuse spec that recap-v2 slice S4 does not touch: the
`CONTEXT.md` growth rule and entry fixes, a test that one spelling names one entry, one
`CLAUDE.md` routing line, and the register and spec notes that record revision 3.

**Architecture:** Text edits plus one vitest principle test beside principle 42. The test parses
`CONTEXT.md` the way its only runtime reader, `.claude/hooks/glossary-inject.sh`, does. It fails
when two entries claim one spelling, or when one entry carries two `_Operator says_:` lines.

**Tech Stack:** Markdown; TypeScript under strict `tsc`; vitest; the repo's Node gates and
`build-getff-dist.sh`.

**Spec:** [`2026-09-21-recap-wait-what-reuse-design.md`](../specs/2026-09-21-recap-wait-what-reuse-design.md)
revision 3 (squash `39cffe2e930`) — D7, D8, D9 channel (iii), D11. **Sibling:**
[Part B](2026-09-22-recap-wait-what-reuse-part-b.md) carries everything S4 edits.

## Global Constraints

- D7: a text-only slice — «The Stop hook's **code** is not edited». No settings change and no
  new dependency.
- Part A touches no file S4 edits: not `.claude/hooks/lang/*.sh`, `plugin/hooks/lang/*.sh`,
  `packages/core/hooks/end-of-turn-reminder.test.ts`, `gate-unarmed-goldens.json`,
  `.claude/skills/story/**` or `.claude/skills/arch/**`. S4 is aif task
  `6ae9ecab-efa4-4829-9113-2a45059f2191`; never redispatch it.
- Every sentence Part A adds is true on the day Part A merges. `/arch` does not invoke
  `domain-modeling` until Part B, so the D-H11 note and both `/arch` sentences wait for Part B.
- Never edit `.claude/settings.json` and never register `glossary-inject.sh` (D11 / R-16,
  operator 2026-09-22: «оставь выключеными»).
- Repo artifacts are English. Cyrillic appears only as operator words in `CONTEXT.md` and in
  test fixtures. Principle 22 scans shell machinery and SKILL.md bodies, not `.ts` tests, and
  `02-paired-negative-test.test.ts` already carries Cyrillic fixtures.
- A markdown file stays at 600 lines or fewer (`.husky/pre-commit`). The spec is at 596.
- New code carries no literal `CONTEXT.md:` followed by digits: since PR 1838 the citation gate
  reads that shape in code as a live pointer. Build it with `` `CONTEXT.md:${line}` ``.
- The PC is down: run npx, vitest, tsx and tsc with `PC_LOCAL=1`.
- `$SCRATCH` is the session's scratchpad directory: logs and throwaway scripts go there only.
- One PR to `staging` from `feat/recap-wait-what-reuse-part-a` (cut from `574adde27dc`), pushed
  with an explicit refspec and merged by the agent after green CI, never with `--delete-branch`.

## File map

| File | Change | Task |
| --- | --- | --- |
| `docs/superpowers/plans/2026-09-22-recap-wait-what-reuse-part-{a,b}.md` | create | A0 |
| `packages/core/principles/42-context-md-spelling-uniqueness.test.ts` | create | A1 |
| `docs/meta-factory/prior-art-evaluations.md` row 283 | dated note, `Last reviewed` | A1 |
| `docs/site/face-facts.json`, `packages/getff/MANIFEST.sha256` | regenerate | A1 |
| `CONTEXT.md` | header rewrite, Env tier entry, three spelling lines | A2 |
| `CLAUDE.md` «Skill routing bindings» | one bullet after line 128 | A3 |
| `docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md` | status, D7 steps 1-2, Prior-art pin, changelog | A4 |
| `docs/site/index.md`, `foundations.md`, `why.md`, `reference/B.md`, `reference/B/self-reflection.md` | `docs-refresh:` token | A5 |

---

### Task A0: Commit the two plans

- [ ] **Step 1: Line gate** — `wc -l docs/superpowers/plans/2026-09-22-recap-wait-what-reuse-part-*.md`
prints 600 or fewer for each file.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-09-22-recap-wait-what-reuse-part-a.md docs/superpowers/plans/2026-09-22-recap-wait-what-reuse-part-b.md
git commit -m "docs(plan): recap x /wait-what reuse — Part A and Part B implementation plans"
```

---

### Task A1: Spelling-uniqueness principle test (capability commit)

**Files:** Create `packages/core/principles/42-context-md-spelling-uniqueness.test.ts`. Modify
register row 283 in `docs/meta-factory/prior-art-evaluations.md`. Regenerate
`docs/site/face-facts.json` and `packages/getff/MANIFEST.sha256`.

**Interfaces:** Consumes the `CONTEXT.md` format (`## Term` heading, `_Operator says_: a, «b».`).
Produces nothing importable. Task A2's header links the test by path, so the path is fixed.

- [ ] **Step 1: Build-vs-reuse consult (before any code)**

A new file over 80 lines directly in `packages/core/principles/` is a capability commit
(`CLAUDE.md` «What is a capability commit?»). Run context7 `resolve-library-id` with three
phrasings — `glossary alias uniqueness linter`, `markdown glossary duplicate synonym detection`,
`terminology list one term per alias check` — then WebSearch
`lint glossary file duplicate aliases across terms`. Record every candidate. Vale substitution
rules and textlint terminology check prose against a list, not one alias per entry, and revision
1 already rejected them here. If a result checks alias uniqueness inside one glossary file, stop
and evaluate it as an SSOT candidate before writing code.

- [ ] **Step 2: Stub** — create the file with the Step 4 content, except `parseSpellings`
returns `{ spellings: [], repeatedSaysLines: [], gluedSaysLines: [] }` and `crossEntryDuplicates` returns `[]`.

- [ ] **Step 3: Watch it fail** — run
`PC_LOCAL=1 npx vitest run packages/core/principles/42-context-md-spelling-uniqueness.test.ts`.
Expected: FAIL in the sentinel and in the six «flags» / «compares» / «strips» / «treats» arms.
The real-tree arm and the «passes» / «ignores» arms pass on the stub.

- [ ] **Step 4: Implement.** The final content is the shipped file
`packages/core/principles/42-context-md-spelling-uniqueness.test.ts`. This plan used to
carry a copy of it, and the 2026-09-23 cold review found the copy had drifted from the file
twice, so the file is now the only copy. It has twelve tests. It flags three things:
- a spelling claimed by two entries, with the heading counted as a spelling;
- a second says-line in one entry;
- a says-line with no blank line between it and the `**Term**:` paragraph. The hook reads
  such a line as part of the definition, so its words are lost.

- [ ] **Step 5: Run it** — the Step 3 command. Expected: PASS, 12 tests. Then
`PC_LOCAL=1 npx tsc --noEmit -p packages/core`. Expected: exit 0. ESLint does not apply:
`packages/core` has no `eslint.config.*`, so `npx eslint` exits 2 there for every file.

- [ ] **Step 6: Prove the real-tree arm can fail** — with Edit, change line 93 of `CONTEXT.md`
to `_Operator says_: handoff, «хендофф», «хэндофф», «харвест».` and rerun. Expected: FAIL in the
real-tree arm, naming `'харвест'`, `'Harvest'` and `'Handoff'`. Revert the line with Edit and
rerun. Expected: PASS, and `git status --short CONTEXT.md` prints nothing.

- [ ] **Step 7: Dated note on register row 283**

In row 283 (`grep -n '^| 283 ' docs/meta-factory/prior-art-evaluations.md`), change the dates
cell `| 2026-09-14 | 2026-09-14 | BUILD |` to `| 2026-09-14 | 2026-09-22 | BUILD |`. Append
before the row's final ` |`:

```text
 **Note (2026-09-22, [reuse spec](../superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md) D11/R-16):** the counters are unused by design since the spec's revision 2 and stay unregistered by the operator's choice; the BUILD verdict is not reversed. The `_Operator says_` data they read gained a guard — one spelling belongs to one entry (`packages/core/principles/42-context-md-spelling-uniqueness.test.ts`). Consult for that guard: context7 × 3 phrasings plus one WebSearch, as run in the Part A plan, Task A1; no tool checks alias uniqueness inside one glossary.
```

If Step 1 named a candidate, the last sentence names it and its verdict instead.

- [ ] **Step 8: Regenerate the two derived files**

```bash
git add packages/core/principles/42-context-md-spelling-uniqueness.test.ts
PC_LOCAL=1 npx tsx scripts/render-face-facts.mjs --write
bash scripts/build-getff-dist.sh
PC_LOCAL=1 npx tsx scripts/render-face-facts.mjs --check
bash scripts/build-getff-dist.sh --check
```

Expected: the principles count in `face-facts.json` grows by one, the manifest gains one line,
and both `--check` runs pass. The manifest is built from `git ls-files`, so `git add` comes first.

- [ ] **Step 9: Commit**

```bash
git add docs/meta-factory/prior-art-evaluations.md docs/site/face-facts.json packages/getff/MANIFEST.sha256
git commit -F - <<'MSG'
test(principles): one CONTEXT.md spelling names one entry (reuse spec D8)

The glossary now grows from the operator's questions, and a new spelling is
mapped without asking. The one-line report of that edit is not a detection
layer. This sibling of principle 42 fails when two entries claim one
spelling, or one entry carries two _Operator says_ lines, with a parser kept
in parity with glossary-inject.sh.

Prior-art: prior-art-evaluations.md#283 (glossary spellings the #283 hook reads; uniqueness guard, no upstream linter found)
MSG
```

---

### Task A2: `CONTEXT.md` — growth rule, Env tier, spellings

**Files:** Modify `CONTEXT.md` (86 lines on `574adde27dc`): header lines 3-15, the Env tier
entry at lines 27-33, the Vendor line 41, the Harvest line 70. **Interfaces:** the header links
the Task A1 test; principle 42 checks that every link resolves, anchor included.

- [ ] **Step 1: Replace the header blockquote (lines 3-15) with**

```markdown
> **Authoritative for:** the project term list — what each term means, the operator's raw
> words for it (`_Operator says_:`), and which owner doc a term points at. How it grows:
> when the operator asks what a word means, the agent explains it and, in the same turn,
> adds or extends the entry here. A new spelling of a known term is appended to that
> entry's `_Operator says_:` line without asking and reported in one line; a word that
> seems to mean something else is asked about. One spelling belongs to one entry
> ([spelling-uniqueness test](packages/core/principles/42-context-md-spelling-uniqueness.test.ts)),
> and an entry has one `_Operator says_:` line. The agent never tells the operator to stop
> using their own word. Consumers: the `/wait-what` skill (operator-invoked). The glossary
> hooks and their learning counters are dormant: `glossary-inject.sh` is registered
> nowhere, and arming it is the operator's call (`bash scripts/register-glossary-hook.sh`).
> **NOT authoritative for:** role and dispatch-channel definitions (Orchestrator / Worker /
> Reviewer, Mode A / Mode B) — the owner doc
> [glossary.md](.claude/skills/orchestrator/references/glossary.md) owns those, so this file
> carries only a gist + link for them; the Tier 0/1/2 routing criteria — those live in
> [tier-home.md](packages/core/templates/shared/tier-home.md) and are not the Env tier below;
> the design of these rules — [reuse spec D8](docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md#d8-the-glossary-grows-from-the-operators-questions-spellings-are-mapped-silently).
```

- [ ] **Step 2: Replace the Env tier entry (lines 27-33) with**

```markdown
## Env tier

**Env tier**: the middle install depth of getff — `--profile env`, the default: core plus
the operator working contour, without the aif runtime; `factory` is the depth above it. The
depths are listed in [Install depth profiles](INSTALL-FOR-AI.md#install-depth-profiles---profile-core--env--factory).
Not the Tier 0/1/2 task routing.

_Operator says_: «энв-тир», «энв тир».
```

Evidence, as D8 asks: on 2026-08-17 the operator asked «что значит вендерить и энв тир», and
the answer explained install tiers. `env` is the default depth at `INSTALL-FOR-AI.md:135` and
`:140`. Re-read both lines first; if either moved, cite the moved line in the PR body.

- [ ] **Step 3: Extend two spelling lines**

- Vendor: `_Operator says_: «вендорить», «вендерить», «ведерить».`
- Harvest: `_Operator says_: harvest, «харвест», «хервест», «хеверст», «херверс».`

Evidence over 952 transcripts (2026-09-22): «хервест» in 14 operator messages from 2026-08-08;
«хеверст» 4 and «херверс» 2 on 2026-09-21; «вендерить» 1 on 2026-08-17; «ведерить» 1 on
2026-09-21; «энв тир» 2, on 2026-08-17 and 2026-09-21. The PR body carries the script and output.

- [ ] **Step 4: Run both `CONTEXT.md` principles and the glossary hook tests**

```bash
PC_LOCAL=1 npx vitest run packages/core/principles/42-context-md-pointer-rule.test.ts packages/core/principles/42-context-md-spelling-uniqueness.test.ts packages/core/principles/09-doc-authority-hierarchy.test.ts packages/core/hooks/glossary-counters.test.ts
```

Expected: PASS. A pointer-rule failure means a link or anchor in the new header does not
resolve: fix the link, never the test.

- [ ] **Step 5: Commit**

```bash
git add CONTEXT.md
git commit -m "docs(context): glossary growth rule; Env tier names the install depth; operator spellings (reuse spec D8)"
```

---

### Task A3: `CLAUDE.md` routing line

**Files:** Modify `CLAUDE.md`: one bullet after line 128 (the «Merge conflicts» binding), before
the blank line 129. **Why now:** upstream `domain-modeling` is model-invocable, and its trigger is
«writing or editing a `CONTEXT.md`». Task A2's growth rule makes every session do that, so the
limit ships with the rule. A prohibition stays true before `/arch` gains its binding in Part B.

- [ ] **Step 1: Invoke `self-reflection`.** `CLAUDE.md`, a principle and the register change
recorded discipline here; the skill fixes the PR body's §1.7 Forward-check and Backward-check.

- [ ] **Step 2: Baseline the citation gate**

Run: `node scripts/check-line-citations.mjs --check --corpus --affected-by=CLAUDE.md > "$SCRATCH/cite-claude-before.log" 2>&1; echo "EXIT=$?"`
Expected: `EXIT=0`. The only live-corpus citation of a `CLAUDE.md` line is
`packages/core/hooks/checks/prior-art.test.ts:254` (line 30, above the insertion).

- [ ] **Step 3: Insert the bullet**

```markdown
- **Domain vocabulary:** never invoke `mattpocock-skills:domain-modeling` outside a `/arch` idea session. A question about what a word means follows the growth rule in [CONTEXT.md](CONTEXT.md) — explain the word, record it with the operator's spelling — and no ADR is offered ([reuse spec D8/D9](docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md)).
```

- [ ] **Step 4: Re-run the gate** into `cite-claude-after.log`. Expected: `EXIT=0`. On a drift
finding, repair the citation by meaning, never with a blind `--write`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): domain-modeling stays inside /arch idea sessions (reuse spec D9 channel iii)"
```

---

### Task A4: Spec amendments (four lines at most)

**Files:** Modify `docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md` (596 lines).

- [ ] **Step 1: Status line 3** — `revision 2 (2026-09-22)` becomes `revision 3 (2026-09-22)`.

- [ ] **Step 2: D7 step 1 (from line 408)** — its opening `1. Implementation starts **only after
recap-v2 slice S4 lands**` becomes `1. **Part B** of the implementation starts only after
recap-v2 slice S4 lands`. After the step's last sentence («…so there is no ordering against
S5.») append:

```markdown
   Part A — `CONTEXT.md`, the spelling-uniqueness test, the `CLAUDE.md` line and the #283
   note, none of which S4 touches — lands first. Plans: [Part A](../plans/2026-09-22-recap-wait-what-reuse-part-a.md), [Part B](../plans/2026-09-22-recap-wait-what-reuse-part-b.md).
```

- [ ] **Step 3: D7 step 2 (line 414)** — `2. One PR to `staging`. Hand-edited files:` becomes
`2. Two PRs to `staging`, Part A then Part B. Hand-edited files:`.

- [ ] **Step 4: Prior-art pin (lines 533-535)** — revision 3 vendors whole files, so the
per-section hashes of revision 2 go. Replace

```text
marketplace commit the cache records, and the implementing slice pins that SHA plus section hashes
(`wait-what/SKILL.md`, `domain-modeling/SKILL.md`, `CONTEXT-FORMAT.md`, `productivity/README.md`,
and every `SKILL.md` naming `domain-modeling`). Problem-class check (T16): upstream = a glossary
```

with

```text
marketplace commit the cache records, and the implementing slice pins that SHA plus one sha256
per vendored file, per D9 (`domain-modeling/SKILL.md` without its frontmatter,
`CONTEXT-FORMAT.md`, `ADR-FORMAT.md`). Problem-class check (T16): upstream = a glossary
```

- [ ] **Step 5: Changelog** — append after the last entry:

```markdown
- 2026-09-22 — implementation split into Part A (before S4) and Part B (after S4); D7 steps
  1-2 and the Prior-art pin follow revision 3.
```

- [ ] **Step 6: Check and commit** — `wc -l` on the spec prints 600 or fewer.

```bash
git add docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md
git commit -m "docs(spec): recap-wait-what reuse — revision 3 status; the Part A/B split; pin per vendored file"
```

---

### Task A5: Docs-refresh tokens, then the full gate sweep

**Files:** the frontmatter of the five `docs/site/` pages whose `sources:` cite `CLAUDE.md` or
the register.

- [ ] **Step 1: Let the gate name the pages** — `node scripts/check-docs-refresh.mjs origin/staging..HEAD; echo "EXIT=$?"`.
Expected: exit 1 naming exactly `docs/site/index.md`, which cites `CLAUDE.md`. The other four
already carry a token and pass. If the gate names other pages, handle those instead.

- [ ] **Step 2: Re-verify each page against the change** — for all five pages run
`grep -n -i -E 'domain-modeling|routing binding|glossary|CONTEXT\.md|\bADR|#283|283' <page>`.
A page whose prose describes what changed gets a real refresh, not a token.

- [ ] **Step 3: Write the tokens**

On `docs/site/index.md`, add as the last frontmatter key before the closing `---`, the
placement `foundations.md` uses:

```yaml
docs-refresh: deferred — re-verified 2026-09-22, CLAUDE.md only gained one skill-routing line for domain-modeling, which nothing on this page describes; clears at the next gold refresh of this page
```

On `foundations.md`, `why.md`, `reference/B.md` and `reference/B/self-reflection.md`, the
existing reason says the register «only gained rows 284-286», which stops being true. Replace
the whole line with:

```yaml
docs-refresh: deferred — re-verified 2026-09-22, the cited register gained rows 284-287 and a dated note on row 283, and CLAUDE.md gained one skill-routing line for domain-modeling; counts are renderer-owned and no prose here depends on either; clears at the next gold refresh of this page
```

- [ ] **Step 4: Gate sweep**

```bash
node scripts/check-docs-refresh.mjs origin/staging..HEAD; echo "EXIT=$?"
node scripts/check-line-citations.mjs --check --corpus; echo "EXIT=$?"
PC_LOCAL=1 npx vitest run packages/core/principles
PC_LOCAL=1 npx tsc --noEmit -p packages/core
PC_LOCAL=1 npx tsx scripts/render-face-facts.mjs --check
bash scripts/build-getff-dist.sh --check
PC_LOCAL=1 bash scripts/run-local-ci-sweep.sh > "$SCRATCH/sweep.log" 2>&1; echo "EXIT=$?" >> "$SCRATCH/sweep.log"
```

Expected: every command exits 0. The docs-refresh gate warns once live deferrals reach 10, and
30 pages already carry one on `574adde27dc`, so the warning is expected. It is not a failure,
and the PR body states the count it prints. `face-facts.json` is exempt from this gate as a
renderer-owned file. A red principle is proven against pristine `origin/staging` before it is
blamed on this diff.

- [ ] **Step 5: Commit**

```bash
git add docs/site/index.md docs/site/foundations.md docs/site/why.md docs/site/reference/B.md docs/site/reference/B/self-reflection.md
git commit -m "docs(site): refresh tokens for the CLAUDE.md routing line and the #283 note"
```

---

### Task A6: Cold review, PR, merge

- [ ] **Step 1: Own cold review (T19)** — dispatch `getff:review-sidecar` on
`git diff origin/staging...HEAD`, given file paths only. Fix each MAJOR finding in a new commit,
or record why it does not apply.

- [ ] **Step 2: Push and open the PR** — `git push -u origin feat/recap-wait-what-reuse-part-a`.
PR body sections: Summary; Changes; Prior-art consult checklist (Task A1 Step 1 results); Test
plan (the Task A5 Step 4 commands with results, the Task A1 Step 6 red proof, the
spelling-evidence command with output); `## Provenance`: `n/a`; Review findings: `n/a` or the
sidecar's findings; `## Fidelity verdict`: `FIDELITY: skipped — not a stage PR; the slice
follows a merged spec`; Parked questions: `n/a`; §1.7 Forward-check and Backward-check with
`path.ext:NN` evidence.

- [ ] **Step 3: §1.7 substance check** — dispatch `getff:compliance-verifier` on the PR body.
Fix what it finds by editing the body, which fires a fresh event; never rerun an old check.

- [ ] **Step 4: Wait for CI and verify it on the head SHA**

```bash
~/.claude/scripts/ci-wait.sh <PR> --repo <owner>/<repo>
gh pr view <PR> --json mergeable,mergeStateStatus,autoMergeRequest,headRefOid
gh api repos/<owner>/<repo>/commits/<headRefOid>/check-runs --jq '.check_runs[] | [.name,.conclusion] | @tsv'
```

Expected: `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`, no auto-merge request, and the
repo's own CI jobs green on that exact SHA.

- [ ] **Step 5: Merge** — `gh pr merge <PR> --squash`. Then update the handoff file and the
project memory: Part A merged, Part B waits for S4.

## Self-review

- **Spec coverage.** D8's growth rule, silent spelling mapping, the uniqueness test and the Env
  tier check land in A1-A2. D9 channel (iii) lands in A3, D11 in A1 Step 7, and D7's split and
  the revision-3 pin in A4. Everything else in D7's list is Part B.
- **Truth at merge.** No Part A sentence claims `/arch` invokes `domain-modeling`.
- **Placeholders.** None. The register note's last sentence depends on the Task A1 Step 1
  consult, and the step states what to write in either outcome.
- **Names.** The test path is identical in A1, A2's header and A4's D7 text.
