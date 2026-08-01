# S-A acceptance — Opus seat at harvest (ADR-5 / ADR-7)

**Branch:** `feature/arch-v2-context-pipeline-s-a-003b06` (c1fb91458 + 306eb77a4)
**Base:** `staging`. **Files changed:** 3 (`.claude/skills/arch/SKILL.md`,
`.claude/skills/night-mode/SKILL.md`, `packages/core/skills/upstream-skill-reference.test.ts`).
**Seat scope:** WHAT-conformance + test quality + differential + park contract + wrapper universality.
Read-only: no repo file was edited or written by this seat.

**Line references** below are into the BRANCH content (snapshots in `scratchpad/sa/`,
sha256-verified identical to `git show` from the container — see checks run).

---

## VERDICT

**REWORK** — two items, both one-file and low-risk, plus three PR-body obligations at harvest.

Required before merge:

1. **M1** — `.claude/skills/night-mode/SKILL.md:15`: drift (b) is half-repaired. Rewrite the
   tier-assignment clause so it stops naming a two-reviewer roster SDD does not have.
2. **M2** — `packages/core/skills/upstream-skill-reference.test.ts:120-135`: the SKIPPED path
   cannot distinguish «no upstream installed» from «upstream installed but broken». Make a
   present-but-unshaped install FAIL (or at minimum emit a distinct, loud, non-SKIPPED verdict),
   and print the searched paths in the SKIPPED line as the kickoff mandated.

PR-body obligations (acceptance §2 items 1, 3, 7 are PR-body-scoped and no PR exists yet):

3. The verbatim park line `upstream absent in this environment — W4 upstream claims taken as
   given from the kickoff table` (kickoff §W4 environment note). It is present nowhere in the
   delivered artefacts today.
4. The host-side upstream-present GREEN run + host re-verification of the W4 upstream facts —
   **both are supplied by this report** (see checks run) and can be quoted directly.
5. A `Prior-art:` line in the **PR body**, not only the commit trailer (squash-trailer-loss gate,
   PR #1098). The commit's escape hatch is acceptable in substance; it must be restated in the body.

Everything else is ACCEPT-quality. §1.5/§2/§3 read as a coherent contour, the wrapper stays thin,
the file is 124 lines, and the executor's one environment-scoped claim (container principle-14
failure is pre-existing) is **independently confirmed true** — see F-INFO-1. Credit where due:
the executor did **not** fabricate a single upstream-side quote.

---

## A. Per work item

| Item | Status | Evidence |
|---|---|---|
| **W1** — §1.5 research contour | **DELIVERED** | `arch/SKILL.md:40-74`. All five parts present: trigger+explicit skip `:42`/`:46`; research-spec template with REQUIRED pre-mortem + acceptance-criteria `:50-54`; execution + freshness bar `:58-60`; distillation + `GO \| rework \| kill` + «current as of `<date>`» + SSOT landing for kills `:64`; seats-as-relative-tiers pointing at night-mode rather than restating `:44`. Frontmatter triggers added (`research contour`, `research-spec`, `distillate`, `исследовательский контур`) at `:3`; description = **1214** chars < 1536. |
| **W2** — membrane + K-pass + drill-down (ADR-4) | **DELIVERED** | `arch/SKILL.md:66-74`. (1) default consumption rule with «**default with bounded recourse, not epistemic isolation**» stated explicitly `:68`; (2) K-pass on each distillate before consumption, the two-non-reproducing-quotes evidence clause, rework + «2+ consecutive rework rounds → surface to the operator» `:70`; (3) drill-down symmetric, ask-the-producer first, cap is the **number ≤3**, recording mandatory, named consumer = the next verification look, `#warning-nobody-reads` cited `:72`; (4) scope cited-sources-only, browsing blocked `:74`. Maps 1:1 onto ADR-4's three numbered parts. |
| **W3** — cold definition + kill channels | **PARTIAL** | Definition present and stated once: `arch/SKILL.md:78` — «a seat is cold when it **did not author the artifact AND did not receive the authoring context**». Kill channels enumerated with cost ordering at `:86` and tied to the README thesis. **Gap (m3 below):** the definition *claims* to be «referenced, not re-stated per section», but neither §1.5's K-pass (`:70`) nor §3's exit (`:86-88`) contains any pointer back to it; and the definition sits at `:78`, *after* its first consumer at `:60-74`. The reference half of W3 is asserted, not implemented. |
| **W4(a)** — arch negative-existence claim | **DELIVERED** | `arch/SKILL.md:119`. Version pin and «no design-review skill exists there» both gone; replaced with «Upstream's capability: … Our delta: …», which is the T16 format the kickoff required. Host-verified true across all three cached versions (see checks run). One nit at m4. |
| **W4(b)** — night-mode roster | **PARTIAL — see M1** | `night-mode/SKILL.md:15`. First clause repaired correctly and accurately: «SDD's per-task reviewer(s) + final whole-branch code reviewer» + «SDD owns the implement→review→rework loop and its reviewer roster». **But the same sentence, one clause later, still reads** «next tier → executor + **top-down (spec/architecture) reviewer**» and «cheaper tier → **bottom-up code-quality reviewer**». Those are the removed roster's two roles under different punctuation. |
| **W4(c)** — night-mode line-number citation | **DELIVERED** | `night-mode/SKILL.md:29` — «SDD lines 114–120» replaced by «SDD's BLOCKED handler, which re-dispatches with a more capable model on the increment's own signal». Behaviour-only, no line range, no version. Landed by the rework commit 306eb77a4 (the executor correctly diagnosed that the fix existed in the working tree but not in `git diff origin/staging...HEAD` — an honest catch). |
| **W5** — upstream-reference smoke | **DELIVERED-WITH-DEFECT — see M2** | `packages/core/skills/upstream-skill-reference.test.ts`, 294 lines. Assertion is correctly scoped; the non-coverage note for (a)/(b)/(c) is explicit and honest at `:12-26` and names `#discipline-theatre`. Paired-negative is genuine. Defect: the environment gate. |
| **W6** — unique-filenames convention | **DELIVERED** | `arch/SKILL.md:83`, inside §2's dispatch contract: unique output filename per parallel subagent, «assigned by the dispatching session, never chosen by the subagent». Nit at m6. |

---

## B. §2 acceptance criteria

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | W1-W6 present, verification outputs quoted in **PR body** | **NOT-MET (yet)** | Work items present (A above). No PR exists; commit bodies carry most outputs but not the mandated park line. Obligation 3-4. |
| 2 | version/line-number grep empty at (a)+(c); `spec-reviewer\|code-quality-reviewer` grep empty | **MET (letter) — see M1 (substance)** | Both greps rc=1 (empty) on branch content — run by me, output below. The second grep is empty **only because of hyphenation**: the surviving text is `code-quality reviewer`, not `code-quality-reviewer`. Criterion met; drift (b) not fully gone. |
| 3 | smoke exists, RED observed on paired negative, SKIPPED exercised, host GREEN quoted by orchestrator | **MET** | Host run with real upstream: `Test Files 1 passed (1) / Tests 6 passed (6)`. SKIPPED line captured verbatim. RED path independently reproduced by me (probe 3 → 1 failed / 5 passed). |
| 4 | `/arch` still a thin wrapper, no re-description of upstream loops | **MET** | See §F. |
| 5 | `wc -l .claude/skills/arch/SKILL.md` < 600 | **MET** | **124**. night-mode = 54. |
| 6 | principle tests green; `render-rule-index --check` green | **MET (host)** | 09+12 = 44/44 passed; 14 = 2/2 passed; `✓ rule-index up-to-date`. The container's principle-14 failure is environment-only — confirmed at F-INFO-1. |
| 7 | PR body carries §1.7 forward+backward + `Prior-art:` | **NOT-MET (yet)** | No PR. Obligation 5. |
| 8 | zero edits under `.claude/rules/`, `CLAUDE.md`, `.husky/`, `.claude/settings.json` | **MET** | `git diff --name-only staging...<branch>` = exactly the 3 files listed at the top. |

---

## C. Test quality (ADR-7 seat assignment)

**What makes it go red.** Two independent paths, both real:

- *Unit:* `checkReferences(refs, roots)` — for each root, `readdirSync` collects the direct child
  directory names into a set; any `Ref.name` not in the set becomes a failure string and the
  status flips to `FAIL` (`:76-114`). The RED case at `:220-228` builds a real temp dir containing
  a `brainstorming/` subdir and asks for `brainstorming` + `does-not-exist`; it asserts
  `status === 'FAIL'`, `failures.length === 1`, and that the message names `does-not-exist`.
- *Integration:* `:262-292` — extracts every `superpowers:<name>` token from every tracked
  `.claude/skills/*/SKILL.md`, discovers upstream roots, and asserts `failures` is empty.

**Is the paired negative genuine or tautological? Genuine.** It is not an inverted assertion over
the same call — it changes the *input* (adds an unresolvable name), keeps a resolvable name in the
same call so a blanket-fail would be caught, and asserts the failure *count* and *content*, not
just the status. I reproduced the integration-level red independently: with an upstream root that
exists but is empty, the integration test failed with `- 0 / + 7` unresolved refs at `:291`. So the
check does go red for the right reason, on real repo content.

**Does the SKIPPED path distinguish «no upstream» from «upstream broken»? NO — this is M2.**
Three probes, same test file, only `HOME` varied:

| Probe | `HOME` contains | Result |
|---|---|---|
| 1 | nothing | **6 passed** — SKIPPED, correct |
| 2 | `…/superpowers/9.9.9/` with **no `skills/` subdir** (installed but broken) | **6 passed** — SKIPPED, **indistinguishable from probe 1** |
| 3 | `…/superpowers/9.9.9/skills/` present but empty | **1 failed / 5 passed** — correct |

`discoverUpstreamRoots` (`:120-135`) returns `[]` whenever the version dir has no `skills/` child,
whenever `readdirSync` throws (`catch { return [] }` at `:132`), and whenever `HOME` is unset —
and an empty roots array is the *skip* signal. So a corrupted, relocated, or permission-denied
install reads as «not installed» and the load-bearing check passes silently. That is exactly the
`#warning-nobody-reads` shape W5's own environment note was written to forbid.

Compounding it: `:124` hard-codes `.claude/plugins/cache/**superpowers-dev**/superpowers`. The
kickoff said «discover the upstream root **by glob**»; the executor globbed the *version* segment
(correct — no version pin) but froze the *marketplace* segment. Install superpowers from any other
marketplace directory and the smoke goes permanently, silently vacuous.

**Is it vacuous in every reachable environment? No** — it is meaningful on the operator host (6/6
with three real roots discovered), and honestly disclosed as SKIPPED on CI/container. That is why
this is MAJOR and not BLOCKER.

Two smaller test findings:

- **m1 (MINOR, false comment):** `:95-96` — «the empty-set case is covered by the roots-length-zero
  branch above when ALL roots are unreadable». It is not: with all roots unreadable,
  `upstreamRoots.length !== 0`, so that branch never fires; `available` stays empty and every ref
  fails → `FAIL`. The *behaviour* is fail-closed and right; the comment describes a control flow
  the file does not have, inside a file whose entire premise is honest scope. Fix: replace with
  «all-unreadable roots ⇒ empty `available` ⇒ FAIL, deliberately fail-closed».
- **m2 (MINOR, tautology):** `:289` — `expect(res.status).toBe('SKIPPED')` sits inside
  `if (res.status === 'SKIPPED')` at `:287`. Zero assertion value. Either drop it or assert the
  emitted message shape instead.
- **m5 (MINOR, mandated string diverged):** the kickoff mandated
  `SKIPPED — no upstream install discovered at <globs searched>`. Actual output (`:283`, captured
  verbatim): `[upstream-skill-reference] SKIPPED — no upstream install discovered (HOME=/…)`.
  The globs are the one piece of information that would let an operator tell M2's two cases apart;
  printing `HOME` does not. Fix alongside M2.

---

## D. Differential / unintended behaviour change

**Clean.** `night-mode/SKILL.md` received exactly **two** hunks, at `:15` and `:29` — the two
mandated drift sites, nothing else; the surrounding paragraphs (harness-portability block, delta
items 4-6, item 8 standing authorization) are byte-identical to staging.

`arch/SKILL.md` changes are all in-scope: description, Authoritative-for line, the thin-wrapper
paragraph, new §1.5, the §2 cold definition + unique-filenames paragraph, the §3 kill-channels
paragraph, the See-also (a) rewrite. One cosmetic artefact: the markdown table separator row at
`:96` in the diff was reflowed (shortened dashes) with no content change — harmless, no finding.

No new dependency, no hook, no workflow, no `.claude/settings.json`, no `.claude/rules/**`,
no `CLAUDE.md`. §4 descopes all respected; no S-B..S-F content leaked in.

**Capability-commit note (informational, not a finding):** `packages/core/skills/` already exists
on staging (`git ls-tree origin/staging` returns 10+ files), so the «new subdirectory» clause does
not fire; but the file is 294 LOC, so the «≥80 LOC anywhere under `packages/`» clause does. The
commit used the escape hatch `Prior-art: skipped — test reusing principle-15 paired-negative
pattern (SSOT #55), no new engine` — ≥20 chars, cites an SSOT ID, and «test additions for existing
capabilities» is a listed non-capability class. Defensible. It must be **restated in the PR body**
(obligation 5).

---

## E. §4a park contract

**Honest — no fabrication. Verbatim line missing.**

- **No fabricated upstream output.** `git log --format='%B' staging..<branch>` grepped for
  `plugins/cache|superpowers/[0-9]|ls ~|sed -n` → **empty**. Nothing in the delivered artefacts
  claims to have run an upstream-side command from the container. This is the half that matters,
  and the executor got it right.
- **The mandated verbatim line is absent from every executor artefact.** `git grep 'upstream
  absent in this environment' <branch>` returns exactly **one** hit — `kickoff.md:165`, i.e. the
  instruction itself, not a report of compliance. The commit bodies quote only in-repo
  verifications (correctly scoped: greps, `wc -l`, description length, principle results). So the
  boundary was respected in behaviour but not recorded in the mandated form. → obligation 3.
- The executor's in-repo T3 discipline is good: every quoted verification in both commit bodies is
  reproducible, and I reproduced all of them (see checks run). Its one *environment* claim —
  «principle 14: 1 pre-existing failure … NOT touched by this PR» — is **true**, and I established
  *why* it is true rather than taking it on trust (F-INFO-1).

**F-INFO-1.** Principle 14 (`14-skill-drift-detection.test.ts`) sweeps every `SKILL.md` under
`.claude/skills/`. The aif container carries **26** installed `aif-*` consumer skill directories
(`aif`, `aif-architecture`, … `aif-verify`); the host worktree carries **one** (`aif-doctor`).
Those extra dirs are untracked dogfood artefacts, and they are what the drift script trips on.
On the host, principle 14 is **2/2 green**. Verdict: the executor's claim is accurate and the
failure is not attributable to this branch.

---

## F. Wrapper universality (spec decision 6 / acceptance item 4)

**MET.** The rewrite adds a research contour that has **no upstream counterpart** — it is /arch's
own delta, so describing it is not creep. The three upstream-touching sentences all sit in the
delegated-capability + delta form:

- `:30` — «phase 1 is `superpowers:brainstorming` verbatim; this skill owns only … If you catch
  yourself re-describing the brainstorm loop, the reviewer protocol, **or SDD** here, stop» (SDD
  newly added to the self-check list — an improvement).
- `:119` — «Upstream's capability: … Our delta: …».
- `night-mode:15` — the edit **removes** upstream internals rather than adding them.

I found no passage restating brainstorming's or SDD's mechanics. The closest thing to an offending
passage is **m4 (MINOR)**: `arch/SKILL.md:119` names the upstream file
`` `spec-document-reviewer-prompt.md` ``. Decision 6 says a wrapper states capability + interface +
delta, «never upstream internals»; a filename is a weaker version pin — accurate today (host-verified
present in 5.1.0, 6.1.1 **and** 6.2.0), re-armed by any upstream rename. The sentence loses nothing
if the backticked filename is dropped. Not blocking.

---

## Findings, graded

### MAJOR

**M1 — drift (b) is half-repaired; the mechanical check passes on a hyphen.**
`.claude/skills/night-mode/SKILL.md:15`.
After the repaired opening clause, the same sentence still reads: «**next tier → executor +
top-down (spec/architecture) reviewer** … **cheaper tier → bottom-up code-quality reviewer +
mechanical increments**». Host-verified upstream reality
(`superpowers/6.2.0/skills/subagent-driven-development/SKILL.md:8`): «a task review (**spec
compliance + code quality**) after each, and a **broad** whole-branch review at the end» — i.e.
**one** task reviewer covering both axes, plus one broad final reviewer. There is no
top-down/bottom-up reviewer split upstream to assign tiers to. The paragraph is now internally
inconsistent: sentence 1 says SDD owns the roster, sentence 3 assigns tiers to the roster sentence 1
just retired. The §2 grep returns empty only because the survivor is spelled `code-quality reviewer`
(one hyphen) while the check looks for `code-quality-reviewer` (two). This is the kickoff's own
**T-SA-B** predicted failure — criterion satisfied, drift alive.
*Fix:* re-cast the tier assignment onto SDD's real roles or onto tier-only language, e.g.
«**next tier → executor + SDD's per-task review seat** … **cheaper tier → the final whole-branch
review + mechanical increments**». One sentence.

**M2 — the smoke's SKIPPED path cannot tell «no upstream» from «broken upstream».**
`packages/core/skills/upstream-skill-reference.test.ts:120-135` (`discoverUpstreamRoots`).
Probe evidence in §C: a `superpowers/<ver>/` directory present but missing its `skills/` child
yields a silent pass byte-identical to a machine with no upstream at all. `catch { return [] }` at
`:132` does the same for a permission error. `:124` additionally freezes the marketplace segment
`superpowers-dev` instead of globbing it, so a differently-sourced install is permanently and
silently skipped. W5's own environment note names this failure mode by name
(«a silently-skipping load-bearing check is `#warning-nobody-reads`»), so the defect is against the
work item's stated intent, not merely against taste.
*Fix:* (i) if the cache **base** exists but yields zero roots, return a distinct
`BROKEN`/`FAIL` verdict, not `SKIPPED`; (ii) surface the `catch` as a failure rather than an empty
array; (iii) glob the marketplace segment; (iv) print the searched paths in the SKIPPED line
(closes m5 at the same time).

### MINOR

- **m1** — `…test.ts:95-96`: comment describes a control flow the code does not have (all-roots-unreadable goes to FAIL, not to the roots-length-zero branch). Rewrite the comment to state the actual fail-closed behaviour.
- **m2** — `…test.ts:289`: `expect(res.status).toBe('SKIPPED')` inside `if (res.status === 'SKIPPED')` — tautological. Assert the emitted message shape, or drop it.
- **m3** — `arch/SKILL.md:78` claims the cold definition «gates §1.5's K-pass and §3's exit … referenced, not re-stated per section», but `:70` and `:86` contain no reference to it, and the definition is declared *after* its first consumer. Add «(cold as defined in §2)» at `:70` and `:86`, or hoist the definition above §1.5.
- **m4** — `arch/SKILL.md:119` names the upstream internal file `spec-document-reviewer-prompt.md`. True today across 5.1.0/6.1.1/6.2.0, but a filename is a soft version pin under decision 6. Drop the backticked filename; the capability sentence stands without it.
- **m5** — `…test.ts:283` prints `(HOME=…)` where the kickoff mandated `at <globs searched>`. Fold into M2's fix.
- **m6** — `arch/SKILL.md:83` ends «The two §2 seats' prompts each carry a distinct filename» — an assertion about prompts the skill does not contain, so it is unverifiable inside the artefact. Either state the rule only, or give the two seats concrete example filenames.
- **m7** — `arch/SKILL.md:42` and `:46` state the trigger-and-explicit-skip rule twice, in consecutive paragraphs, in a document whose §2 rule is «stated once and referenced». Drop one.

### Not findings (checked, clean)

- Description cap: 1214 < 1536. File length: 124 < 600. night-mode: 54.
- Ownership: no maintainer-owned artefact touched.
- Descopes: no S-B..S-F content, no version pin anywhere in the diff.
- No fabricated upstream-side command output anywhere in the delivered artefacts.
- Wrapper thinness preserved; SDD added to the skill's own creep self-check.

---

## Checks run (commands actually executed by this seat)

Snapshot integrity first:

```text
docker exec aif-handoff-agent-1 git -C /home/www/rules-as-tests-aif show \
  feature/…-s-a-003b06:packages/core/skills/upstream-skill-reference.test.ts | shasum -a 256
  → 3dc5b2ae4437e6741484c0142c38a6d648a43bde7f00af00e6e0f05ce6c2a0f6
shasum -a 256 scratchpad/mat/…/upstream-skill-reference.test.ts
  → 3dc5b2ae4437e6741484c0142c38a6d648a43bde7f00af00e6e0f05ce6c2a0f6   (IDENTICAL)
```

Intent + diff:

```text
git show staging:.claude/orchestrator-prompts/arch-v2-context-pipeline-s-a/kickoff.md      (read in full)
git show staging:docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md      (§0-§3 read)
docker exec … git diff staging...feature/arch-v2-context-pipeline-s-a-003b06               (read in full, 431 lines)
docker exec … git log --format='%H%n%s%n%b' staging..feature/…                             (both commit bodies)
docker exec … git diff --name-only staging...feature/…
  → .claude/skills/arch/SKILL.md
    .claude/skills/night-mode/SKILL.md
    packages/core/skills/upstream-skill-reference.test.ts        (criterion 8 MET)
```

Criterion 2 + 5 + W1/W2/W3/W6 greps, on BRANCH content:

```text
wc -l  arch snapshot          → 124        (criterion 5 MET)
wc -l  night-mode snapshot    → 54
awk '/^description: /{print length($0)-13}' arch  → 1214            (< 1536 MET)

grep -nE 'v[0-9]+\.[0-9]+\.[0-9]+|SDD lines|through v' <arch> <night-mode>   → rc=1 (EMPTY)
grep -n  'spec-reviewer\|code-quality-reviewer' <night-mode>                 → rc=1 (EMPTY)
grep -nE 'code-quality reviewer|top-down .spec' <night-mode>                 → HIT at :15  ← M1

grep -cE '§1\.5|pre-mortem|acceptance-criteria|current as of' <arch>         → 9
grep -nE 'drill-down|K-pass|≤3|rework' <arch>                                → :64 :66 :70 :72
grep -nE 'cold[ -]by[ -]construction|did not author|kill channel' <arch>     → :78 :85
grep -n  'unique' <arch>                                                     → :23 :83
grep -n  'cold' <arch>                                                       → :78 only definition; :70/:86 no back-ref  ← m3
```

Upstream re-verification (HOST — the half the container could not do):

```text
ls -d ~/.claude/plugins/cache/*/superpowers/*/skills
  → …/superpowers-dev/superpowers/{5.1.0,6.1.1,6.2.0}/skills
ls ~/.claude/plugins/cache/superpowers-dev/superpowers/{5.1.0,6.1.1,6.2.0}/skills/brainstorming/
  → SKILL.md  scripts  spec-document-reviewer-prompt.md  visual-companion.md   (all three versions)
     ⇒ W4(a): the retired «no design-review skill exists there» claim WAS wrong; the replacement IS true.
grep -nE 'reviewer|review' …/6.2.0/skills/subagent-driven-development/SKILL.md
  → :8  "a task review (spec compliance + code quality) after each, and a broad whole-branch review at the end"
  → :74 "Dispatch final code reviewer (../requesting-code-review/code-reviewer.md)"
  → :258 "Per-task reviews are task-scoped gates. The broad review happens once…"
     ⇒ W4(b): the NEW clause is accurate; the SURVIVING tier clause is not.  ← M1
ls ~/.claude/plugins/cache/  → ast-grep-marketplace  superpowers-dev          (marketplace segment is real, but frozen at test:124)  ← M2
```

Test execution — **materialised in the scratchpad, not in the repo** (`scratchpad/mat/` with
`.claude` and `node_modules` symlinked to the worktree; the branch file is not on staging, and this
seat is read-only, so nothing was written under the repo):

```text
npx vitest run scratchpad/mat/packages/core/skills/upstream-skill-reference.test.ts --root scratchpad/mat
  → Test Files 1 passed (1) / Tests 6 passed (6)          ← HOST GREEN with real upstream (criterion 3)

HOME=<empty temp> …                    → 6 passed   (SKIPPED, correct)
  stdout: [upstream-skill-reference] SKIPPED — no upstream install discovered (HOME=/private/tmp/…/fakehome-empty)
HOME=<…/superpowers/9.9.9/not-skills>  → 6 passed   (SKIPPED — WRONG, install present but broken)  ← M2
HOME=<…/superpowers/9.9.9/skills/ (empty)> → 1 failed | 5 passed
  AssertionError at :291  - 0  + 7      ← integration RED reproduced independently
```

Repo-side gates (host):

```text
npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts \
               packages/core/principles/12-ai-laziness-traps.test.ts
  → Test Files 2 passed (2) / Tests 44 passed (44)
npx vitest run packages/core/principles/14-skill-drift-detection.test.ts
  → Test Files 1 passed (1) / Tests 2 passed (2)          ← container failure is environment-only
npx tsx scripts/render-rule-index.mjs --check
  → ✓ rule-index up-to-date (00-rule-index.md + AGENTS.md region)
ls .claude/skills | grep -i aif                      → aif-doctor                      (host: 1)
docker exec … ls /home/www/rules-as-tests-aif/.claude/skills | grep -i aif → 26 dirs   (container)
git ls-tree -r --name-only origin/staging -- packages/core/skills  → 10+ files (dir pre-exists)
```

Park-contract probes:

```text
docker exec … git grep -n 'upstream absent in this environment' <branch>
  → kickoff.md:165 ONLY (the instruction, no executor-side compliance record)   ← obligation 3
docker exec … git log --format='%B' staging..<branch> | grep -niE 'plugins/cache|superpowers/[0-9]|ls ~|sed -n'
  → EMPTY   ⇒ no fabricated upstream output
```

**Note on what this seat could NOT run:** principle tests 09/12/14 were executed against *staging*
content, not branch content — overlaying the branch's two SKILL.md files would require writing into
the repo, which this seat is forbidden to do. Risk assessed as low: 09 checks header presence and the
branch retains and extends the Authoritative-for header (`arch:23`); 12 scans kickoffs, and the
branch adds none; 14 is a link/frontmatter sweep and the branch adds no new cross-file links beyond
`docs/meta-factory/prior-art-evaluations.md` (`arch:64`) and `.claude/rules/attention-is-not-a-mechanism.md`
(`arch:72`), both of which exist. The container reported 09 = 37/37 green. This should be re-run on
the host once the branch is harvested to a local worktree.
