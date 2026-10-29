# docs single source, slice 1 — the `./setup` flags fact from code, not README prose

> **Class:** stage kickoff (dispatch input), single stage. **Base branch:** `staging`.
> **Branch:** `feat/docs-ssot-s1-setup-flags`. **PR title:**
> `fix(face-facts): source the ./setup flags from the setup case arms, not README prose`.
> **Channel:** one aif task, own worktree, one PR to `staging`, harvested from the host (never
> pushed from the container). The lead session of the docs single-source design verifies on the host.
> **Rigor label (L0):** `build-and-verify` — changes the source of a fact family the site renders.
> **Authoritative for:** this stage's contract — the new flags source, the output shape, the test,
> exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the design — [2026-09-30-docs-single-source-design.md](../../../docs/superpowers/specs/2026-09-30-docs-single-source-design.md).

**Measurement SHA for every `path:line` below:** `b28716620fd` (`origin/staging`, 2026-10-01).
Re-locate by content (`grep -n`) if yours differ.

## §0 Spec rows this stage carries (verbatim)

From the spec (readable in the repo), decision register row S-Q0, falsifier column:

> the `./setup` flags are held today but from README prose, the wrong source

and the hand-over section, `:153-154`:

> **Fact-layer migration:** re-source `docs/site/face-facts.json:88` (`"flags": "README.md:147"`)
> from `setup`.

Picture statement 1: «A layer value never takes an entry doc or any other rendered output as its
source (no render loop)». README is an entry doc.

## §1 The record, as measured

- `scripts/render-face-facts.mjs:148-154` finds the line `Flags:` in README and collects the
  bullets `` - `--flag` `` after it; `:16` documents README as the flags source.
- `docs/site/face-facts.json:88` → `"flags": "README.md:147"`; `:113-126` → three entries
  (`--yes`, `--all`, `--dry-run`), each `{flag, line}`.
- `setup:54-71`, the argument `case`: `-y|--yes`, `--all`, `--global`, `--full`, `--dry-run`,
  `--with-aif-suite`, `--profile=*`, `--profile`. README lists 3 of these.
- The positionals of the same file are already parsed from its case arms
  (`render-face-facts.mjs:117-122`, regex on `STACK="$a"`) — the precedent to follow.

## §2 Deliverables

1. `scripts/render-face-facts.mjs`: the flags list comes from the flag arms of the argument
   `case` in `setup`. Keep the output shape `{flag, line}` (`line` = the line in `setup`), and
   `source.flags` becomes `setup:<line of the first flag arm>`. Rules: only `--long` names
   (a short alias like `-y` joins its long twin's entry, it is not a new entry); `--profile=*`
   and `--profile` are ONE entry `--profile`; order = order of first appearance in `setup`.
   Fail loud (throw, like `:154`) when zero flags parse. README is no longer read for flags;
   drop `readmeRel` from this function if nothing else in it needs README.
2. Update the header comment `:16` to name the new source.
3. Regenerate `docs/site/face-facts.json` with the renderer's own write mode; never hand-edit it.
4. Test: extend `scripts/render-face-facts.test.sh` (the existing seam) with a fixture `setup`
   whose case has a short alias, a `--x=*` / `--x` pair and one flag absent from any README;
   assert the parsed list and lines are derived from the fixture text.
5. A check that README does not claim a flag `setup` lacks: every `` - `--flag` `` bullet under
   README's `Flags:` line must be in the parsed set (subset check, in the renderer's `--check`
   path). README may list fewer flags — it is prose, not the source.

## §3 Prior-art consult

Not a capability commit (a bug fix to an existing renderer, no new file ≥80 LOC, no dependency).
If the hook asks, use `Prior-art: skipped — bug fix to an existing renderer, no new capability`.

## §4 Proof — RED first

Run the new fixture test against the UNMODIFIED renderer first and paste the failing output in
the PR body, then GREEN. Paste the `face-facts.json` diff of the `flags` part.

## §5 Exit gates

```bash host-verify
bash scripts/render-face-facts.test.sh
node scripts/render-face-facts.mjs --check
node scripts/check-line-citations.mjs
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

The docs-refresh gate decides whether any `docs/site/` page cites the renderer; refresh a named
page or add `docs-refresh: deferred — <reason>` (a comma inside the reason, never `: `).

## §6 Out of scope

- README's flags prose (PR #1993 edits README; do not touch README in this stage).
- `install.sh` flags, env vars, any other fact family.
- The landing site (other repo) and any `docs/site/` page content beyond the refresh gate's ask.
- `.claude/rules/`, `.claude/settings.json`, `docs/meta-factory/EXECUTION-PLAN.md`.

## §7 Falsifiers to write into the PR body

- `-y` appears as its own entry → aliases leak.
- `--profile` appears twice → the `=*` form was not folded.
- A flag added to `setup`'s case does not appear after regeneration → the parser reads a fixed list.
- README gains a bullet for a flag `setup` lacks and `--check` stays green → the subset check is dead.
- `source.flags` still names `README.md` → the render loop remains.

## §8 Report

`Stat` / `Verify` (each §5 gate, RED then GREEN) / `DECISIONS` / `ATTN` / `Confidence` as
predicates. The PR body carries `## Fidelity verdict` (added by the lead after the cold round) and
§1.7 Forward-check / Backward-check with `path.ext:NN` citations.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T2** run the test, do not describe it · **T3** command-or-`file:line` for every claim · **T6**
confidence as predicates · **T19** own cold review of the diff before handoff · **T21** cold
`agents/backward-sweep-auditor.md` on the class «a fact in the fact layer whose source is an entry
doc or other rendered prose, not code» — the other `source` fields of `face-facts.json` and the
other `scripts/render-*.mjs` are the candidates; report GAP/CLEAN, fix none outside §2.

**T-S1-A (domain):** the `case` in `setup` has arms that are not flags (the positional `*)` arm,
`STACK="$a"` arms). Select flag arms by a leading `-`, not by position in the case.
