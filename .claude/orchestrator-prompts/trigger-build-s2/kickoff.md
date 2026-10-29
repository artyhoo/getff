# trigger build, slice 2 — the native-rule-load arm of the measurement script

> **Class:** stage kickoff (dispatch input), single stage. **Base branch:** `staging`.
> **Branch:** `feat/trigger-build-s2-native-load-arm`. **PR title:**
> `trigger build S2: native-rule-load arm in measure-turn-attribution.sh`.
> **Channel:** one aif task, own worktree, one PR to `staging`, harvested from the host (never
> pushed from the container). The lead session of the trigger build verifies the proof on the host.
> **Rigor label (L0):** `build-and-verify` — extends the repo's single source for per-turn numbers;
> the slice-2 before/after proof reads its output.
> **Authoritative for:** this stage's contract — the arm's selection and output keys, the
> population mode, the fixture test, exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the trigger-build design and spec — they live in the operator's coordination store, not in the
> repo; the rows this stage needs are quoted verbatim in §0 below.

**Measurement SHA for every `path:line` below:** `53633ffb2f9` (`staging` after the slice-1
landing). Re-locate by content (`grep -n`) if yours differ.

## §0 Spec rows this stage carries (verbatim, by pointer)

Source: `_spec-2026-09-29-trigger-build.md` §3 «Slice 2 — getff on itself», item 3 and «Proof»
(coordination store, revision r2e; not readable from the container, hence quoted):

> 3. A native-rule-load arm in `scripts/measure-turn-attribution.sh` — the repo's single source for
>    per-turn numbers (its header, `:4-12`); it already reports session-root and subagent records apart
>    (`:14-18`). The arm counts `attachment.type == "nested_memory"` records under `.claude/rules/`, in
>    characters, both populations. [...] The script today reads only hook-invocation attachments
>    (`attachment.command != null`, `measure-turn-attribution.sh:149`), so the arm is new code. No
>    `InstructionsLoaded` hook is needed.
>
> **Proof.** (a) Characters of native rule loads per replay, before and after, from the extended script.

The same spec routes this item to the factory («item 3 (the measurement arm, bash + fixture)»,
§3 «Who builds what»). The replay that feeds proof (a), the adherence set, the settings switch and
every change inside `.claude/rules/` are NOT this stage (§6).

## §1 The record, as measured on the host (2026-09-30)

The container has no host transcripts (the script's own header, `measure-turn-attribution.sh:32-35`),
so the record shape is given here. A native rule load is one JSONL line:

- top level: `"type": "attachment"`, plus `version`, `sessionId`, `isSidechain`, `timestamp` …
- `.attachment.type == "nested_memory"`, `.attachment.path` = absolute path of the loaded file;
- **two shapes of `.attachment.content`, both real:**
  - Claude Code 2.1.281 (measured today, 86 records in one lead-session transcript): an OBJECT with
    keys `content` (the rule text), `contentDiffersFromDisk`, `globs`, `path`, `rawContent`, `type`;
  - Claude Code 2.1.270 (the r7 headless probe, recorded in the spec): a STRING, the rule text.

The rule text is therefore `(.attachment.content | if type == "string" then . else (.content // "") end)`.
A `nested_memory` record whose path is NOT under `/.claude/rules/` (a nested `CLAUDE.md`) is a
native load too, but not a rule load: it must not enter the rule totals.

## §2 Deliverables

1. **Section `§10 NATIVE RULE LOADS`** in `scripts/measure-turn-attribution.sh`, printed before
   `=== END OF RUN ===` (`:513`). Extend the one tagged stream pass (`emit_stream`, from `:118`)
   with a new tag rather than a second corpus pass. Per population (`session`, `subagent`):
   - rule-load records, distinct rule paths, total CHARACTERS of rule text (jq `length`, codepoints —
     the spec's unit; say so in a comment, because the §8/§9 arms use bytes, `:156-160`);
   - the same three figures for non-rule `nested_memory` records, on one separate line;
   - the top 10 rule files by characters (path relative to the repo when it contains
     `/.claude/rules/`, i.e. print from `.claude/rules/` on);
   - a split by top-level `version` (records and characters per Claude Code version).
   Print one grep-stable key line per population so a later script can read it without parsing
   tables: `NATIVE-RULE-LOADS pop=<session|subagent> records=<n> paths=<n> chars=<n>`.
   The arm takes only the LENGTH of the rule text and prints paths and counts, never text. The
   header says the script reads «never message content» (`:32-35`); reword that line so it states
   exactly this (rule-file text is measured for length, never printed).
2. **A population mode for single-session corpora.** The replay that will consume this arm runs a
   headless session that may spawn no subagent, and today such a corpus exits 3 (`:102-110`: a zero
   population, or two equal ones, is fatal). Add `MEASURE_SECTIONS=native-load`: it prints §0 and
   §10 only, and in that mode both guards at `:102-110` are replaced by one: the corpus must hold at
   least one transcript. A zero population is reported as 0, and EQUAL populations are legal (a
   replay with one session and one subagent has 1 and 1, which the default guard rejects); a corpus
   with zero transcripts in BOTH populations still exits non-zero. The default run
   (variable unset) keeps every current guard and output, plus the new §10. In `native-load` mode
   skip the COMPUTATION of §1-§9, not only their printing: §10 reads only the shared stream built
   before §1, so nothing it needs is lost, and a replay run stays cheap. Document the variable
   in the ENV OVERRIDES header block (`:42-45`) and the EXIT STATUS block (`:37-40`).
3. **A fixture test** `scripts/measure-turn-attribution.test.sh`, building its corpus in
   `mktemp -d` (no host corpus, no network), with EXACT-value asserts:
   - one session transcript and one subagent transcript (path `*/subagents/*`), with the assistant
     and tool records the default run needs;
   - rule loads in both content shapes (object on one line, string on another), whose texts have
     known character counts including at least one non-ASCII character (so characters ≠ bytes is
     tested); one rule loaded twice (records 2, paths 1);
   - one `nested_memory` record for a nested `CLAUDE.md` — absent from the rule totals, present in
     the non-rule line;
   - one hook attachment (`.attachment.command` set) — it must not enter §10, and §8 must still see it;
   - `MEASURE_SECTIONS=native-load` over a session-only corpus → exit 0 and `pop=subagent records=0`;
     over a subagent-only corpus → exit 0 and `pop=session records=0`; over one session plus one
     subagent → exit 0 (equal populations);
   - `MEASURE_SECTIONS=native-load` over an empty corpus → non-zero exit;
   - the default mode over the two-population fixture still prints the §0-§9 headers.
4. **Wire the test into CI** — principle 41 (`packages/core/principles/41-shell-test-ci-coverage.test.ts`)
   makes a new tracked `*.test.sh` red until a workflow runs it. Add a step next to the
   measurement-script acceptance step (`.github/workflows/audit-self.yml:662`), with a comment in
   the same style as its neighbours.

## §3 Prior-art consult (run by the lead 2026-09-30; re-check, do not re-derive)

- SSOT: `prior-art-evaluations.md` row **#122** (session-report plugin, usage analytics over
  tokens/cache — whole-session totals, no per-rule-file load count) and row **#103** (the
  `claudeMdExcludes` config surface). No row measures native rule loads.
- context7 `/anthropics/claude-code`, three phrasings (loaded rule characters per session;
  `claudeMdExcludes` and `settings.local.json`; session usage analytics per memory file):
  candidates `InstructionsLoaded` hook input (`load_reason: path_glob_match`, `file_path`, `globs`)
  and `SessionContextUsage` (whole-context token figure). The hook would need a new registration
  and gives a path, not the loaded text; the context figure is not per file. Verdict: extend the
  repo's own SSOT script (REUSE own stack).
- This stage is not a capability commit (an edit to an existing script plus test material, per
  CLAUDE.md «What is a capability commit?»). If the pre-push hook asks anyway, the trailer is
  `Prior-art: prior-art-evaluations.md#122 (whole-session analytics, no per-rule load count; the arm extends this repo's own measurement SSOT)`.

## §4 Proof — RED first

- Run the new test against the UNMODIFIED script first and paste the failing run (no §10, no key
  lines; the session-only corpus exits 3) into the PR body. Then GREEN.
- Every number the test asserts is derived in the test from the fixture text it wrote (e.g.
  `jq -rn --arg t "$text" '$t | length'`), not typed by hand. Do NOT use `wc -m`: it follows the
  locale, and under `C`/`POSIX` it counts bytes (measured on the host: 80 for a 70-codepoint pair
  of loader lines).
- The host half of the proof is the lead's: it runs the extended script over the real host corpus
  and one fixed replay. Do not claim host numbers.

## §5 Exit gates

```bash host-verify
bash scripts/measure-turn-attribution.test.sh
bash scripts/measure/measure.test.sh
shellcheck scripts/measure-turn-attribution.sh scripts/measure-turn-attribution.test.sh
npx vitest run packages/core/principles/41-shell-test-ci-coverage.test.ts
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

The docs-refresh gate decides whether any `docs/site/` page cites this script in `sources:`; take
the page list from its output. Refresh a named page or add `docs-refresh: deferred — <reason>`
(a comma inside the reason, never `: `).

## §6 Out of scope

- The fixed replay script and its runs, the adherence set, the settings switch (host items of
  slice 2) — do not write them.
- Any file under `.claude/rules/` or `.claude/settings.json` — no agent and no factory run commits
  there in this build.
- Cards under `.claude/hooks/getff-cards/` — slice 2 needs none for this item.
- Changing what §1-§9 report or their units.

## §7 Falsifiers to write into the PR body

- The object-shape record (2.1.281) counts 0 characters or its key count → the arm reads the
  wrong field.
- The string-shape record (2.1.270) is dropped → the arm fails on the older transcripts in the corpus.
- The nested `CLAUDE.md` record enters the rule totals → the proof over-counts rule loads.
- A session-only corpus exits non-zero in `native-load` mode → the replay cannot use the arm.
- An empty corpus exits 0 in `native-load` mode → an unasked question reads as a clean answer.
- A byte count stands where characters were asked → a unit drift the fixture's non-ASCII rule catches.
- The default run loses a §0-§9 header or a guard → an unrelated consumer of the script broke.

## §8 Report

`Stat` / `Verify` (each §5 gate, the RED-then-GREEN runs) / `DECISIONS` (the stream tag, how the
population mode relaxes the guards, the top-10 path trimming) / `ATTN` / `Confidence`. The PR body
carries `## Fidelity verdict` (the lead adds it after the cold fidelity round on the host) and the
§1.7 Forward-check / Backward-check sections.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2** run the test, do not describe what it would print · **T3**
command-or-`file:line` for every claim · **T6** confidence as predicates, not «high» · **T14** a
green run over a fixture that lacks one content shape is not coverage · **T19** own cold review of
the diff before handoff · **T21** cold `agents/backward-sweep-auditor.md` on the class «a
transcript-reading script that selects `attachment` records by one field and silently ignores a
record type Claude Code added later» — the other `scripts/measure/*` readers are the candidates.

**T-TB2-A (domain):** the field named `content` is not the content in the current shape — it is an
object whose own `content` key holds the text. A jq `.attachment.content | length` returns 6 (the
object's key count) on every 2.1.281 record and produces a plausible-looking, wrong total. Assert
characters against the fixture text, never against a count you read off the output.
