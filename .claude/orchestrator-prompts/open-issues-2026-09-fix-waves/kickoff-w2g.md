# open-issues fix waves — W2-G: consumer ZCode skill-mirror check

> **Umbrella:** [kickoff.md](kickoff.md) — §0 binding execution rules, §1 D3 and §2 file-lock
> matrix are binding; this file restates only what the executor needs, and where it deviates from
> or widens the umbrella it says so (header «Deviations» list below).
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Branch:**
> `feat/consumer-zcode-mirror-check` (umbrella §2/§3 name; it wins over the generic `fix/<id>-<slug>`
> of umbrella §0.1). **PR title:** `W2-G: consumer ZCode skill-mirror check`.
> **Channel:** one aif task, own worktree, one PR to `staging` (harvested from the host — never
> pushed from the container).
> **Rigor label (L0):** `build-and-verify` — a new check shipped to consumers and wired into
> their commit hook; this is the umbrella's only capability commit (umbrella §0.6).
> **Authoritative for:** the W2-G contract — anchors measured at the SHA below, the check's
> behaviour table, the delivery channels, the prior-art consult, exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> D3 itself — owned by [kickoff.md §1](kickoff.md).

**Measurement SHA for every `path:line` below:** `35139b0f2ae` (`staging` after W2-E #1858,
W2-F #1859 and #1860). Re-locate by content (`grep -n`) if yours differ. This file was
cold-reviewed before dispatch (round 1 REVISE, 3 BLOCKER + 2 MAJOR, all folded in below).

**Deviations from the umbrella (declared):**

1. The umbrella §2/§3 asks for «a dedicated section in `INSTALL-FOR-AI.md`». That file is at 599
   lines against a 600-line gate, so the full text goes on a docs page and `INSTALL-FOR-AI.md`
   carries at most a one-line pointer (§1 item 4).
2. The umbrella §2 file-lock row widens by `install.sh` (the `--refresh` delivery list, §1 item 2),
   `setup.d/45-python.sh` (python-lane delivery, §1 item 3), and every `docs/site/` page the
   docs-refresh gate names (§3).

**Dependencies:** W1-A merged (#1821) and W2-E merged (#1858) — both satisfied. Nothing else in
wave 2 is open, so no file-lock partner runs in parallel.

**Closes (in the PR BODY):** #1502. Read it WITH comments
(`gh issue view 1502 --repo artyhoo/getff --comments`): the second comment corrects the first
(this repo's `.zcode/skills` is ONE top-level symlink, not real directories). The closure comment
restates the recorded `Failure-scenario:` (timeliner, 2026-08-20: six `.claude/skills` entries
with no `.zcode/skills` counterpart, one dangling `rules-as-tests` link) → the fix → the verify
evidence.

## §1 Deliverables (D3)

1. **The check** — a POSIX-portable bash script, source under `packages/core/audit-self/`
   (e.g. `check-zcode-mirror.sh`), delivered to consumer `scripts/`. Behaviour, all of it binding:

   | Consumer state                                                                              | Output                                                 | Exit     |
   | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------- |
   | no `.zcode/` at PROJECT_ROOT (CC-only consumer)                                             | one info line on **stderr** (see DECISIONS note below) | 0        |
   | `.zcode/skills` is ONE symlink resolving to `.claude/skills` (this repo's shape)            | one OK line — complete by construction                 | 0        |
   | every `.claude/skills/<dir>` has `.zcode/skills/<dir>` (symlink OR real dir), none dangling | one OK line                                            | 0        |
   | a `.claude/skills/<dir>` with no `.zcode/skills/<dir>` and no exemption                     | one line PER offender, by name                         | non-zero |
   | a dangling symlink under `.zcode/skills/`                                                   | one line per link, by name + its target                | non-zero |
   | an exemption entry whose skill no longer exists in `.claude/skills/` (stale)                | one line per stale entry                               | non-zero |
   | an exemption entry with no reason or a reason under 20 chars                                | one line per entry                                     | non-zero |
   | `.zcode/` exists but `.zcode/skills` does not                                               | every skill is an offender (report them)               | non-zero |
   - **Exemption file:** `.ai-factory/zcode-mirror-exemptions.txt`, one `<name> <reason>` per
     line, `#` comments and blank lines allowed; reason ≥20 chars (escape-token discipline of
     [ci-tool-pinning.md §3](../../rules/ci-tool-pinning.md)). The installer does NOT create it.
   - **Compare by NAME.** A dangling link does not «cover» a skill with a different name: in the
     timeliner state the dangling `rules-as-tests` link and the missing `rule-tests` entry are TWO
     offenders.
   - **Do NOT model the check on this repo's shape** (D3; #1502 comment 2): here
     `.zcode/skills → ../.claude/skills` is one link, `/.zcode/` is gitignored (`.gitignore:116`),
     and a maintainer-only gate already covers it (`scripts/render-harness-config.mjs:238-243`,
     `packages/core/hooks/harness-config-drift.test.ts:132`).
   - Mirror CREATION stays manual and consumer-side; the check never creates, fixes or deletes a
     link. Its offender message says what to run (`ln -s ../../.claude/skills/<name> .zcode/skills/<name>`,
     or add an exemption line).
   - Read the file system, not git: `.zcode/` is usually gitignored in consumers too.
   - Fast: it runs on every commit (pre-commit budget «<5 seconds»,
     `packages/core/templates/shared/husky-pre-commit.sh:2`). No `node`, no network.
   - **DECISIONS note (umbrella §0.11, CC behaviour unchanged):** the CC-only line fires on every
     commit of every consumer without `.zcode/`. Put it on stderr, one line, and record in
     DECISIONS why that does not change CC behaviour (or choose silence and justify it against
     D3's «one info line»).

2. **npm lane — delivery AND wiring, on BOTH install paths.** There are two separate channels;
   the new script and the new hook line must travel through both:

   | Path         | Script delivery                                                                                                                                                                | Hook-line delivery                                                                                                                                                                                                 |
   | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | full install | `setup.d/40-configs.sh` `copy_safe` + `chmod_safe +x` (precedent `check-shields-up.sh`, `setup.d/40-configs.sh:57-58`)                                                         | `.husky/pre-commit` via `setup.d/50-hooks.sh:26` `copy_safe`; re-asserted by `reassert_husky_shields` (`setup.d/lib.sh:2867-2898`), which runs ONLY from `setup.d/99-finalize.sh:297-298` under `DEPS_INSTALLED=1` |
   | `--refresh`  | add the pair to the explicit do_refresh scripts list at `install.sh:1098-1113` (`"packages/core/audit-self/check-shields-up.sh:scripts/check-shields-up.sh"` is the precedent) | `install.sh:1327` `refresh_safe …husky-pre-commit.sh → .husky/pre-commit`                                                                                                                                          |
   - **Missing `install.sh` delivery is a commit-blocking bug:** a refreshed consumer would get a
     pre-commit that calls an absent `scripts/check-zcode-mirror.sh`. `tests/install-sh/refresh-covers-full-delivery.test.sh`
     guards this class — run it by name (§5).
   - **Hook line when the script is absent** (e.g. a `--force`/no-deps install, or a kept,
     diverged refresh): pick ONE behaviour and put it in the PR body's DECISIONS — a loud one-line
     WARN naming the missing script with exit 0, or a hard fail with the fix command. Never a
     silent `[ -x … ] &&` skip.
   - Keep the `@aif-shield: pre-commit` marker (`husky-pre-commit.sh:4`); `scripts/check-shields-up.sh`
     gates on it and on `lint-staged` (`check-shields-up.sh:133-136`).
   - **Consumer-owned hooks:** a kept `.husky/pre-commit` is never touched (`setup.d/lib.sh:2878`).
     The «NOT wired» advice for kept hooks builds its command at `setup.d/50-hooks.sh:21`
     (`pre-commit) _ch_cmd="npx lint-staged" ;;`) — extend `_ch_cmd` itself so the advice names
     the new check command, not only a comment.
   - Install/refresh output may ECHO the check's result; that echo is not the enforcement channel.

3. **Toolchain lanes (python / cargo / go).** These lanes EXIT before the layer loop
   (`install.sh:385`), so `40-configs.sh`, `50-hooks.sh` and `99-finalize.sh` never run for them —
   and `note_not_wired` (`setup.d/lib.sh:2723-2725`) only appends to `NOT_WIRED`, which is printed
   by `99-finalize.sh` alone. A «not wired» note recorded from a toolchain lane is therefore NEVER
   printed. The problem class still applies: the python lane delivers `.claude/skills`
   (`setup.d/45-python.sh:119`, `_py_skill_copy_or_refresh`).
   - **python:** deliver the script from the lane itself and either call it from the delivered
     `.getff/hooks/pre-push.sh` (`packages/core/templates/python/hooks/pre-push.sh`) / the
     pre-commit.com fragment, or print a loud not-wired line DIRECTLY in the lane's own output
     (plain `echo`, not `note_not_wired`) naming the command to run by hand.
   - **cargo / go:** no hook delivery at all (`setup.d/46-cargo.sh`, `setup.d/47-go.sh`). Check
     whether these lanes deliver `.claude/skills`; if they do, same rule as python; if they do
     not, record «no skills delivered → no mirror to check» with the grep that proves it.

4. **Consumer docs — the 600-line budget.** `INSTALL-FOR-AI.md` is at **599** lines; the
   pre-commit gate blocks any markdown file past 600. Put the full text (what the check does, the
   exemption file format, how to fix an offender) on an EXISTING `docs/site/` reference page where
   it fits (a new page brings the docs-author kind rules and `sources:` bookkeeping — choose it only
   with a reason), and give `INSTALL-FOR-AI.md` at most ONE pointer line. Any commit touching
   `docs/site/` needs a `Docs-card:` trailer — values `PASS|FAIL|N/A` per C1-C13, or
   `Docs-card: skipped — <≥20-char reason>`. Free-text trailers fail the pre-push gate.

## §2 Prior-art consult — REQUIRED before writing any code

This is a capability commit (a new ≥80-LOC shipped file is likely). Before the first line:

- Read [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — at
  least row **#200** (AI-agent-config-sync family: `intellectronica/ruler` ships a failing drift
  gate and manages per-agent symlinks) and the harness-config renderer it produced.
- context7 with ≥3 phrasings (e.g. «dangling symlink checker», «skills directory sync across AI
  coding agents», «verify symlink mirror completeness»), plus one WebSearch on the problem term
  (T11/T12). Name each candidate you found.
- Record the verdict as a `Prior-art:` trailer naming a resolvable referent (CLAUDE.md
  «`Prior-art:` trailer syntax»). If no SSOT row fits, add one — `Verdict`, `Rationale`,
  `Trigger to revisit` — in the SAME commit as the check.

## §3 Regeneration and the docs-refresh gate

- **Payload (umbrella §0.3):** `scripts/build-getff-dist.sh`, then
  `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`. Measure the drift before each
  capture. Expected derived set: `packages/getff/MANIFEST.sha256` and the install-sh stack
  fingerprints (new delivered `scripts/` file, changed `.husky/pre-commit`, python-lane files if
  §1 item 3 delivers there). A path outside that set is a STOP.
- **D26 docs-refresh gate** (`scripts/check-docs-refresh.mjs`): take the page list from the
  gate's OUTPUT over your range, not from any example here. `install.sh`, `setup.d/lib.sh` and the
  pre-commit template are all cited in `sources:`. `docs/site/learn/stop-a-bad-commit.md` sources
  both the template and `setup.d/lib.sh` and records `executed:` commit outcomes — if the hook now
  prints a line on every commit, re-run those examples instead of deferring. Otherwise refresh or
  add `docs-refresh: deferred — <reason>` (comma, never `: ` inside the token). List every page in
  the PR body (file-lock widening).

## §4 Proof — a deterministic test, RED first

- An install-sh test next to its siblings (precedent:
  `tests/install-sh/check-shields-up-paired-negative.test.sh`) that builds throwaway consumer
  trees in `mktemp -d` and runs the delivered check against each row of the §1 table — positive
  AND paired negative (the same tree with the defect removed passes).
- **The timeliner fixture, field for field:** `.claude/skills/` holds `arch`,
  `building-native-ui`, `getff`, `orchestrator`, `pr-template-multi-phase`, `rule-tests` (plus at
  least one correctly linked skill); `.zcode/skills/` holds only the correct link(s) and a
  dangling `rules-as-tests → ../../.claude/skills/rules-as-tests`. The check names exactly SEVEN
  offenders — six missing + one dangling. Assert the exact set, not a count floor.
- One fixture is this repo's shape (one top-level `.zcode/skills` link) and must pass.
- Show the timeliner fixture going RED before the check exists, and paste that run into the PR body.
- **Live consumer probe (umbrella §0.3, behaviour-accepting stage):** a fresh throwaway npm-lane
  install; link EVERY delivered skill into `.zcode/skills/` except one → `git commit` is BLOCKED
  and names exactly that one; add its link → the commit passes. Then `--refresh` an install made
  from `origin/staging` BEFORE this change and show the script arrives and the hook calls it.
  Record both transcripts.
- **Python lane probe:** run a python-lane install on a throwaway tree and grep its output for the
  §1 item 3 line (or show the hook calls the check).

## §5 Exit gates

```bash host-verify
bash tests/install-sh/<your-new-test>.test.sh
bash tests/install-sh/check-shields-up-paired-negative.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
bash tests/install-sh/gh-975-husky-reassert.test.sh
bash tests/install-sh/consumer-upgrade-path.test.sh
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
scripts/build-getff-dist.sh --check
wc -l INSTALL-FOR-AI.md
make self-audit
bash scripts/run-local-ci-sweep.sh
```

## §6 Falsifiers to write into the PR body

- The timeliner fixture passes, or names any set other than the seven → the check misses the
  incident it exists for.
- This repo's one-link shape fails → the check misreads a complete layout (D3 _Reopen-if_).
- A CC-only consumer (no `.zcode/`) exits non-zero or prints more than one line → CC behaviour
  changed (umbrella §0.11).
- A stale exemption entry, or one with a missing/short reason, passes silently → the escape hatch
  is unguarded.
- A fresh npm-lane install commits with a missing mirror → the check is not wired.
- A `--refresh`ed pre-change install lacks `scripts/check-zcode-mirror.sh` while its hook calls
  it → every consumer commit breaks.
- The hook line with the script absent is silent → the gate can vanish unnoticed.
- A python-lane install neither runs the check nor prints its not-wired line → silent narrowing.
- `INSTALL-FOR-AI.md` is over 600 lines → the budget broke.

## §7 Out of scope

- Creating or repairing links (manual by design, D3).
- Harnesses other than ZCode (`.cursor/`, `.codex/` …) — record as a follow-up if the check's
  shape generalises.
- This repo's own `.zcode/` (maintainer-only gate already exists, §1 item 1).
- The CC half of #1703 (operator-owned).

## §8 Report (umbrella §5 template, strict)

`Stat` / `Verify` (each §5 gate, the §4 RED-then-GREEN runs, both live probe transcripts, the
python-lane probe) / `DECISIONS` (CC-only line channel; absent-script behaviour; per-lane wiring;
where the docs text lives; the prior-art verdict) / `ATTN` / `Confidence`. PR body carries
`## Fidelity verdict` and the §1.7 Forward-check / Backward-check sections (umbrella §0.6).

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T2** run the check against the fixtures, do not describe what it would print · **T3**
command-or-`file:line` for every claim · **T11/T12** external search before proposing the check's
shape (§2) · **T16** ruler's problem class (generate per-agent configs) vs ours (verify a
consumer-made mirror) — state the match explicitly · **T19** own cold review before handoff ·
**T21** cold `agents/backward-sweep-auditor.md` on the class «a harness-specific copy or link of
a shared asset that nothing verifies against its source» — other `.zcode/` surfaces, `plugin/`
twins and agent copies are the candidates to sweep; and on the class «a file delivered by the
full-install path but not by `--refresh`» for anything this stage adds.
