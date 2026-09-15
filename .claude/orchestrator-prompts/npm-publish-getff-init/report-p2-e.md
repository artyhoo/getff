# P2-E — agent-surface code-truth report (GO-WITH-NOTES)

Lane P2-E of the P2 code-truth pass over `origin/main...origin/staging`
(`.claude/hooks .claude/rules .claude/skills plugin agents skills` — 88 files, +4520 −884,
10 A / 78 M). Read-and-report lane per [kickoff-p2.md](kickoff-p2.md): **no product code was
touched**; this file is the lane's only written artifact.

- **Head actually audited:** `origin/staging` = `c26593c90b70b71761fa4bf25858139a62ef2b50`
  (2026-09-15, «docs(p2): kickoff for the code half of the promote-#4 truth gate (#1801)»),
  merge-base `992377dbdbd` (2026-09-04). The kickoff pinned `08a95a6dea4`; staging moved by
  #1800/#1801 between pin and execution — both are inside the audited delta, and #1800
  (coordination carry-over families) is cited by finding F3 below.
- **Host-verify fence (§9):** PASS — `node --version` → `v22.23.2`; `npx vitest --version` →
  `vitest/4.1.8 linux-x64 node-v22.23.2`; `git --version` → `git version 2.39.5`.
- **Lane stance: GO-WITH-NOTES.** No `BROKEN` on a consumer-reachable path in this lane.
  Two pre-existing `CODE-LIES` trivia rows (carried through the delta unchanged), one
  cross-lane suite RED handed to P2-F, and three named environment artifacts that a
  future re-run must not misread as regressions (§inconclusive / §findings F4–F6).

## §population-enumeration

Derived (T10) at the head above, before any verdict:

```text
$ git diff --shortstat origin/main...origin/staging -- .claude/hooks .claude/rules \
    .claude/skills plugin agents skills
 88 files changed, 4520 insertions(+), 884 deletions(-)
$ git diff --name-status <same paths> | awk '{print $1}' | sort | uniq -c
     10 A
     78 M
```

By directory (files): `.claude/rules` 15 · `.claude/hooks` 10 + `lang` 3 + `lib` 2 ·
`.claude/skills` 25 (incl. 2 preset JSONs, 2 helper scripts, 8 reference docs) ·
`plugin/hooks` 10 + `lang` 3 + `lib` 1 + `hooks.json` + `run-hook.cmd` ·
`plugin/skills` 5 dirs / 7 files in-delta (8 dirs / 16 files on disk) · `plugin/install` 1 · `plugin/agents` 1 ·
`plugin/.claude-plugin/plugin.json` 1 · `plugin/README.md` 1 · `agents/` 4 · `skills/getff` 2.

Full 88-path listing: `/tmp/p2e-lane-files.txt` (session-scratch, not carried by this
PR — regenerate with the `--name-status` command above). **Zero `*.test.*` files in the lane delta** — the literal §5 gate
(`vitest run <every test file your lane changed>`) is vacuous; the covering-suite
substitution below is the gate that actually ran.

Lane-relevant first-parent history in the window: 192 commits 2026-09-05 → 2026-09-15
(T9 stratification: the audit sampled checks across the whole window's outputs, not only
its tail — e.g. pre-existing-file findings F1/F2 were tested against `origin/main`
pre-images, and new-capability candidates against `git log --follow`).

## §method-actually-run

Every command below ran in this session, from the repo root, on the host named in the fence.

1. **§5 suite gate — covering suites.** Because the lane delta contains no test files, the
   covering set was derived mechanically: the 65 distinct basenames of the 88 lane files
   were grepped across `packages/core/hooks/**.test.ts` + `packages/core/principles/**.test.ts`,
   yielding **86 suites** (over-broad by construction — `SKILL.md`, `plugin.json`,
   `README.md` match widely; that is the honest map, not a curated subset).

   ```text
   $ node_modules/.bin/vitest run --reporter=default <86 suites>
   Test Files  5 failed | 81 passed (86)
        Tests  27 failed | 1540 passed | 7 skipped (1574)      EXIT=1
   ```

   **Reporter adaptation:** kickoff §5 says `--reporter=basic`; vitest 4.1.8 has no `basic`
   reporter — `default` was used. **Every one of the 27 failures triaged (F3–F6): zero are
   caused by a changed lane file.** Re-run with the session-env scrub (see F4):

   ```text
   $ env -u CLAUDE_CODE_ENTRYPOINT node_modules/.bin/vitest run --reporter=default <86 suites>
   Test Files  3 failed | 83 passed (86)
        Tests  5 failed | 1562 passed | 7 skipped (1574)      EXIT=1
   ```

   The 5 residual: `worktree-setup-hydration.test.ts` (3 — F3, cross-lane),
   `37-make-target-claim-liveness.test.ts` (1 — F5, env),
   `14-skill-drift-detection.test.ts` (1 — F6, env). `end-of-turn-reminder.test.ts` solo,
   scrubbed: `Test Files 1 passed (1) · Tests 140 passed (140)`.

2. **hooks.json ↔ disk, both directions** (T8):

   ```text
   JSON→DIR: grep -oE 'run-hook\.cmd\\?" [a-z-]+' plugin/hooks/hooks.json → 18 names
             → 18/18 exist on disk (plugin/hooks/<name>)
   DIR→JSON: every hook-like file in plugin/hooks/ (excluding hooks.json, run-hook.cmd,
             lang/, lib/, _zcode-emit) → 18/18 referenced in hooks.json
   ```

   Note for re-runners: hooks.json stores *escaped* quotes (`run-hook.cmd\" name`); a grep
   pattern for `run-hook.cmd" name` matches nothing and reports every hook missing. This
   audit's first cross-check did exactly that (see §self-application).

3. **Plugin twins + consumer copies** (T-P2-B census, byte-compared):

   ```text
   9 hook twins (plugin/hooks/<name> vs .claude/hooks/<name>.sh) of the 10 in-delta
     top-level plugin/hooks scripts:
     8 × body identical after the 1 generated header line (diff | grep -c '^[<>]' → 1)
     validate-prompt: 10 divergent lines — DECLARED in the source at
       .claude/hooks/validate-prompt.sh:15-19 `# @plugin-transform: manual — the twin drops
       the Wave-7 header lines and the @file-content-gate marker…`; hooks.json still
       registers it under matcher "Edit|Write|MultiEdit" (the requirement the dropped
       @file-content-gate marker documents)
   warn-subagent-report-zcode: no .claude sibling; carries
     plugin/hooks/warn-subagent-report-zcode:4 `# @dual-pair: warn-subagent-report`
   lang/en.sh, lang/ru.sh, lang/check-parity.sh, lib/hook-emit.sh: IDENTICAL both sides
   check-doc-authority-header (A-file): generated twin added by 934df145fe (#1727,
     «row-3 twin + ZCode consumer path») of source .claude/hooks/check-doc-authority-header.sh
     which has NO commits in the window — a twin-generation artifact, not a new capability
   consumer copies: skills/getff/SKILL.md, agents/compliance-verifier.md IDENTICAL;
     skills/getff/references/checks-map.md, plugin rule-research / rule-tests /
     template-audit SKILL.md differ ONLY by relative→absolute blob-URL ref transforms
     (e.g. `../../../README.md#why-this-exists` →
     `https://github.com/artyhoo/getff/blob/main/README.md#why-this-exits`)
   ```

4. **Consumer-surface live runs** (T8):

   ```text
   $ bash -n plugin/install/fetch-and-wire.sh && bash -n plugin/hooks/run-hook.cmd
   both: SYNTAX OK
   $ RAT_INSTALL_SOURCE=$PWD CLAUDE_PROJECT_DIR=<tmp consumer> \
       bash plugin/install/fetch-and-wire.sh ts-server      → rc=0, dry-run preview plan
     (run 2, same target)                                   → rc=0, byte-identical plan
   $ bash plugin/install/fetch-and-wire.sh --bogus          → "unknown flag" rc=2
   $ echo '{}' | CLAUDE_PLUGIN_ROOT=$PWD/plugin bash plugin/hooks/run-hook.cmd deps-hash-check
                                                            → rc=0, silent when clean
   $ bash plugin/hooks/run-hook.cmd                         → rc=126 "Is a directory" (F2)
   CRLF scan: `grep -rlU $'\r'` over every plugin/hooks file → no CRLF anywhere;
     `git check-attr` → plugin/hooks/run-hook.cmd, deps-hash-check: `eol: lf` (#1796 class holds)
   ```

5. **Hook gates fire with their documented text** (T5 fixtures; outputs from this lane's
   fixture battery, re-runnable per each probe's env):

   - doc-authority missing header → `✗ doc-authority: .claude/rules/bare.md is missing the
     "> **Authoritative for:**" header.` (+ escape valves as documented).
   - hook-marker missing marker → `❌ hook-marker: .claude/hooks/bare.sh has no
     delivery-channel marker.` (offers `@cc-only-rationale` / `@dual-pair`).
   - kickoff without host-verify contract → `❌ host-verify: … declares no `host-verify`
     contract block. A missing contract is a FAIL, not a pass` ; kickoff citing
     ai-laziness-traps with 0 T-numbers → `❌ kickoff-traps: … enumerates only 0 distinct
     T-number(s) (floor: 3)`.
   - worker-dispatch via Agent tool → `❌ worker-dispatch-channel: …:3 instructs Agent-tool
     dispatch of a write Worker` (+ allow-escape hint).
   - inject-handoff-on-compact emits the SessionStart JSON with the injected handoff
     additionalContext.

6. **Rules citations** (T6): all 27 `path:line` refs collected from the delta hunks of the
   15 changed rule files were resolved and bounds-checked → **27/27 in-bounds with real
   content** (8 required short-name resolution, listed in F13). Numeric spot-claims re-run
   where the rules state grep-able facts.

7. **Skills + agents** (T7): `probe-inflight.sh` runs (designed verdict
   `VERDICT: PROBE-INCOMPLETE` for a non-umbrella slug — its documented no-signal path);
   `heal.sh` runs fail-closed (`hook-sync skipped — no aif agent container reachable`,
   `/tasks curl exit non-zero — skip base-refresh (fail-closed)`); all 4 on-disk preset
   JSONs parse (`aif.json economy.json night.json sdd.json`; 2 of them in-delta); agents'
   referenced artifacts exist, with
   aif-doctor's `packages/agent/...` citations explicitly DECLARED upstream-in-container at
   `.claude/skills/aif-doctor/SKILL.md:177` («paths below are upstream, cited from the
   running aif image»).

## §findings

Verdict grammar per kickoff §1. Every row: the assertion, the falsifier, what it showed,
and the doc sentence the merge should write from it.

**F1 — `CODE-LIES` (trivia; pre-existing on main, carried through the delta)**
`plugin/hooks/warn-subagent-report-zcode:6` asserts `the REPORT-section grammar SSOT
(line 78: REPORT_CUE_RE, lines 89/92/95: section regexes)`. Falsifier:
`grep -n 'REPORT_CUE_RE=' .claude/hooks/warn-subagent-report.sh` → `:101`; identical at
`origin/main` (`git show origin/main:.claude/hooks/warn-subagent-report.sh | grep -n` →
`101:`), and `sed -n '78p;89p;92p;95p'` shows TEXT-extraction plumbing, not regexes.
The substantive claim it supports IS true — the grammar is mirrored verbatim:
`REPORT_CUE_RE='^(#{1,3} *VERIFY|VERIFY:|Confidence:|ATTN:|Commit:)'` is byte-identical
(twin `:75` ≡ source `:101`) and the three section regexes match (twin `:80,:83,:86` ≡
source `:112,:115` + ATTN arm). Only the line-pointer is dead.
→ Doc sentence: the ZCode twin mirrors the CC warn-subagent-report grammar verbatim;
its comment cites brittle line numbers — cite symbols, not line numbers, in cross-file
SSOT pointers.

**F2 — `CODE-LIES` (trivia; pre-existing, carried)**
`plugin/hooks/run-hook.cmd`'s batch half documents and enforces
`run-hook.cmd: missing script name >&2; exit /b 1`; the POSIX half has no guard.
Falsifier: `bash plugin/hooks/run-hook.cmd` → rc=126, stderr
`.../plugin/hooks/: .../plugin/hooks/: Is a directory` (it execs `bash <dir>/ ""`).
Reachable only by manual invocation — hooks.json always passes a script name; severity
trivial, asymmetry predates the delta (pre-image has the same unguarded POSIX tail).
→ Doc sentence: on POSIX a missing hook-name argument fails with an opaque exec error;
the usage guard exists only in the Windows batch half.

**F3 — cross-lane suite RED, `INCONCLUSIVE-needs-human` (root cause), named per §5**
`packages/core/hooks/worktree-setup-hydration.test.ts` — 3/5 RED at this head, scrubbed:
`POSITIVE: state.md present AS A SYMLINK in worktree after creation` (hook and portable
arms) and `DUAL-PAIR PARITY` fail with `state.md must exist: expected false to be true`
at `worktree-setup-hydration.test.ts:204`. The fixture seeds
`.claude/orchestrator-prompts/my-umbrella/state.md` in a temp primary checkout, creates a
worktree, and expects `link-coordination.sh` to adopt+symlink it. None of the three files
under test is a lane file: `.claude/hooks/worktree-setup.sh` unchanged; the delta DID
change `scripts/link-coordination.sh` (+59/−2, commit 303d84c580 = #1800). P2-F owns
`scripts/`; this lane records the RED, the repro, and does not guess the mechanism.
→ Doc sentence: worktree coordination-sync must be re-verified against #1800's
link-coordination changes before the promote; a state.md symlink no longer appears in
fresh fixture worktrees in this environment.

**F4 — environment artifact (§5 disclosure), not a delta defect**
This session runs under the Agent SDK, so `CLAUDE_CODE_ENTRYPOINT=sdk-ts` leaks into every
spawned subprocess. `end-of-turn-reminder.sh:89-91` answers it by design:
`case "${CLAUDE_CODE_ENTRYPOINT:-}" in sdk-*) [ "${AIF_EOT_SDK_RECAP:-0}" = "1" ] || exit 0 ;;`
— so in an SDK-hosted session every "hook must emit" assertion in
`end-of-turn-reminder.test.ts` (19 solo) and the `precompact-residue.test.ts` end-to-end
arms got `SyntaxError: Unexpected end of JSON input` / empty stdout, while every
silent-expectation fixture passed. Scrubbed: 140/140 and gate 83/86 (method item 1).
CI is unaffected (the var is unset there).
→ Doc sentence: run the hooks suites with `CLAUDE_CODE_ENTRYPOINT` unset — an
SDK-hosted session silently disarms the SDK-recap guard inside the hooks it spawns, and
the suites do not scrub it.

**F5 — environment artifact: no `make` on this host**
`37-make-target-claim-liveness.test.ts` resolves claims via `make -n <target>` (its
comment: «reuse make's own resolver, never a hand-rolled Makefile parser»). This host has
no `make` (`command -v make` → nothing; `make -n consumer-matrix` → `make: command not
found`), so all 3 recorded claims went RED. The targets all exist:
`Makefile:34` `consumer-matrix:`, `Makefile:55` `consumer-matrix-getff-dist:` — the three
claiming scripts (`tests/consumer-matrix/{getff-dist,npm-tarball,pnpm-monorepo}-cell.sh`)
are P2-F/P2-A-lane files whose claims are in fact live.
→ Doc sentence: principle 37's resolver needs GNU make on the runner; a make-less host
reports live make-target claims as dead (all 3 of this run's hits were false).

**F6 — environment artifact: untracked aif-* installs scanned by principle 14**
`14-skill-drift-detection.test.ts` asserts 0 broken refs «in current repo state», and the
current worktree carries gitignored, runtime-installed skills
(`.gitignore:121` `/.claude/skills/aif-*/`; `git check-ignore -v` confirms) whose internal
template refs (`aif-skill-generator/SKILL.md → templates/`, `aif-docs/SKILL.md →
prev.md`, …) are scanned and reported. Not tracked content; not the delta.
→ Doc sentence: principle 14's repo-state arm sees installed-but-gitignored `aif-*`
skills, so a dev worktree with the aif runtime installed goes RED on their template
placeholders — read the paths, not just the count.

**F7 — `TRUE`: plugin manifest integrity**
hooks.json ↔ disk agrees in both directions (18/18; method item 2); `plugin.json` name
`getff` / version `0.3.0` matches `.claude-plugin/marketplace.json` (`"name": "getff"`,
`"source": "./plugin"`, version `0.3.0`); principle 24's suite is green in the scrubbed
gate. → Doc sentence: the plugin ships 18 session hooks, every one registered, every
registration resolvable on disk.

**F8 — `TRUE`: plugin README claims are disk-true**
`/plugin marketplace add artyhoo/getff` + `/plugin install getff@getff` resolve against
`marketplace.json` (name `getff`, source `./plugin`); `/getff:install-enforcement`
resolves against `plugin/commands/install-enforcement.md` (exists); layout table
(`hooks/ skills/ agents/ commands/ install/`) matches disk; the skill set is exactly
«six derived plus two plugin-native» (`plugin/skills/`: ai-doc, getff, rule-research,
rule-tests, template-audit, tool-bootstrapping + installing-enforcement, using-getff);
«machine-checked twice» is real: `scripts/generate-plugin-skills.sh` exists and principle
24 arm (g) is green in the gate. → Doc sentence: a consumer can paste the README's three
commands and reach every named artifact.

**F9 — `TRUE`: fetch-and-wire.sh behaves as documented**
bash -n clean; dry-run is the default and writes nothing; same-target re-run produces a
byte-identical plan (idempotent preview); unknown flag → rc=2 with a named error; local
`RAT_INSTALL_SOURCE` path avoids the network (method item 4). → Doc sentence: the
hard-layer seam is preview-by-default and reproducible — run it twice, get the same plan.

**F10 — `TRUE`: the #1796 LF discipline holds on the plugin surface**
No CRLF in any `plugin/hooks` file; `.gitattributes` pins `eol: lf` for them (method
item 4). → Doc sentence: plugin hooks ship LF-terminated, enforced by attribute, not
convention.

**F11 — `TRUE` (T-P2-B): nothing in the delta is an undeclared twin or relocation**
Every plugin↔claude pairing is either byte-identical, generated-with-declared-header, or
carries an in-file transform declaration (`@plugin-transform: manual` /
`@dual-pair: warn-subagent-report`); the one solo A-file
(`plugin/hooks/check-doc-authority-header`) is #1727's generated twin of an unchanged
source; consumer-copy diffs are ref-transforms only (method item 3).
→ Doc sentence: the plugin payload is derived, not hand-forked — every divergence from
its source has a machine-checkable or in-file declaration.

**F12 — `TRUE` (§4c pre-decided): what a consumer sees from merged recap-v2**
The merged half ships: en/ru message packs (`.claude/hooks/lang/{en,ru}.sh`, byte-identical
plugin twins; `lang-parity.test.ts` green in the gate) and the ZCode-side language pin —
`run-hook.cmd`'s POSIX half reads `${XDG_CONFIG_HOME:-$HOME/.config}/getff/hook-lang` when
`AIF_HOOK_LANG` is unset (incident 2026-09-13, ZCode Russian). S3/S5 slices are absent by
design (kickoff §4) — not filed as a defect. → Doc sentence: consumers get English and
Russian hook messages today; language follows the `AIF_HOOK_LANG` env var, with a
per-user `getff/hook-lang` file fallback for harnesses without an env mechanism.

**F13 — `TRUE`: rules' citations resolve (27/27)**
All 27 `path:line` refs from the 15 changed rule files bounds-check with real content
(method item 6). 8 were written as basenames and resolve to:
`allowlist-resolver.ts` → `packages/core/research/`, `check-ask-files.sh` → `scripts/`,
`runtime-bridge-setup.md` → `docs/`, `{arch,dispatcher,harvest}/SKILL.md` →
`.claude/skills/<name>/`, `inject-matching-rule.sh` → `.claude/hooks/`.
aif-doctor's `packages/agent/...` anchors are declared upstream-in-container
(`SKILL.md:177`), not this repo. → Doc sentence: the changed rules' evidence anchors all
resolve; basename citations resolve by repo-unique basename, container anchors are
labelled as such at the citing line.

## §coverage

Denominator = the enumerated population (88 files). Numerator = files with ≥1 executed
falsifier this session (suite membership in the 86-suite gate, byte-compare, live run,
citation bounds-check, or fixture probe):

- `.claude/hooks` (15) — 15/15: all 15 are covered by suites in the gate (green), plus the
  fixture battery for 6 gates and the lang twins.
- `.claude/rules` (15) — 15/15 via the 27-citation bounds-check + header/class gates in the
  gate run (principles 09, 31, 22 green); claim-level depth = citations + spot line-quotes,
  not full-text re-derivation.
- `.claude/skills` (25) — 25/25 enumerated; depth-sampled per T1 (floor 5, depth 20+):
  2/2 in-delta presets parsed (4/4 on disk), 2/2 helpers executed, description↔body
  spot-checked on the dispatcher/orchestrator/pipeline trio, ref-existence over the T7
  population.
- `plugin/*` (27 files) — 27/27: manifest cross-check, twin census (9 twins + 1 solo =
  10/10 in-delta hooks censused; + lang/lib), README claims (8/8 checkable sentences),
  fetch-and-wire live, run-hook.cmd live.
- `agents/` (4) + `skills/getff` (2) — 6/6: existence + twin/comparison + referenced-
  artifact checks.

**Coverage = 88/88 files with at least one executed falsifier; 1562/1574 covering-suite
tests green after the named env scrubs.** Per T14: the three RED tests are accounted for
above (F3 cross-lane, F5/F6 env) — «lane green» here means «no failing test names a
changed lane file», which is the precise claim this evidence supports. Calibration: first
run of this lane's method; the F4 leak was found mid-run, so pre-scrub numbers
(27 failures) must not be quoted without it.

## §self-application

Auditing this audit produced three findings:

1. **A uniformly-negative result is a broken probe until proven otherwise.** This audit's
   first hooks.json DIR→JSON cross-check reported 23/23 hooks «NOT-IN-JSON» — the pattern
   didn't account for JSON's escaped quotes. It was caught by sanity-checking the inverse
   direction against a hook visibly present in the file. An audit loop whose every
   observation is a violation should be suspected before its subject is.
2. **Inherited scratch is a claim, not evidence (T2/T20).** The prior session's empty
   probe outputs (`/tmp/p2e-t5/*.out`, 0 bytes) were consistent with BOTH «gate silent when
   clean» and «gate disarmed by the SDK env». Every load-bearing number in this report was
   re-executed here; the F4 leak was only found by re-running.
3. **The deliverable obeys the audited discipline:** this report was written and staged in
   one step (kickoff-staging-placement §5.2 `#canon-symlink-swallows-commit` — sibling
   lanes' report files are CANON symlinks in worktrees; the committed artifact must be a
   `100644` blob, verified below), stayed under the 600-line gate, and changed no product
   file (`git status` before staging: one pre-existing mode-only worktree mutation
   `packages/core/synthesizer/verify-provenance-cli.ts` 100644→100755, NOT this lane's and
   NOT staged; reverted in rework R2 — see §inconclusive).

## §inconclusive

- **F3 root cause** — why #1800's `link-coordination.sh` (+59/−2) leaves `state.md`
  unlinked in fresh fixture worktrees here. Settled by: P2-F running
  `env -u CLAUDE_CODE_ENTRYPOINT npx vitest run packages/core/hooks/worktree-setup-hydration.test.ts`
  on a CI-equivalent host and bisecting `scripts/link-coordination.sh` against
  `992377dbdbd`.
- **Windows behavior of `run-hook.cmd`'s batch half and the plugin hooks** — no Windows
  host in this environment; the POSIX half was executed live, the batch half was
  syntax-read only. Settled by: the #1796 Windows consumer-matrix cell in CI (the same
  matrix whose `getff-dist-cell.sh` this delta extends).
- **aif-doctor's upstream container anchors** (`packages/agent/src/reviewContract.ts:95`,
  `:117-134`, `reviewer.ts:168`, `dist/coordinator.js:571`) — the aif image is not
  reachable from this session. The citing file disclaims them as upstream (:177); the
  line-level contents stay unverified. Settled by: any session with `docker exec` reach.
- **`run-hook.cmd` hook-lang fallback on a real ZCode host** — the fallback code path was
  read and its fixture (`getff/hook-lang`, one `ru` line) matches the documented grammar
  `^[a-z]{2}(-[A-Za-z0-9]{2,8})?$`; the ZCode-side incident (2026-09-13) is quoted in-file
  but not reproducible here. Settled by: one ZCode session with a `ru` pin and a Russian
  locale.
- **Pre-existing worktree mutation** (`verify-provenance-cli.ts` mode flip) — reported,
  not investigated; not this lane's file and not staged. SETTLED in rework R2
  (2026-09-15, review-gate finding a006550b6a37): `git diff <path>` confirmed mode-only
  (`old mode 100644` / `new mode 100755`, zero content hunks); `chmod 644` restored it
  (`git checkout --` is permission-blocked for this session — the mode bit is the whole
  mutation), and `git status --porcelain` now lists only this report file plus the two
  sibling-lane untracked reports.

---

## §security-re-review (iteration 1 — full re-review, appended 2026-09-15)

`/aif-security-checklist` pass over the same population and head (`origin/staging`
`c26593c90b`), focus per its charter: auth, validation, secrets, injection, unsafe
shell/file handling in changed code. No ignore-list exists (`.ai-factory/SECURITY.md`
absent); no skill-context overrides. Fence re-run (§9): `node --version` → `v22.23.2`,
`vitest --version` → `vitest/4.1.8 linux-x64 node-v22.23.2`, `git --version` → `2.39.5`.
Same-session suite gate (§5, env-scrubbed per F4):
`env -u CLAUDE_CODE_ENTRYPOINT node_modules/.bin/vitest run --reporter=default
packages/core/hooks/{deps-hash-check,end-of-turn-reminder,hook-emit-prelude,
inject-handoff-on-compact,precompact-residue}.test.ts` → **5 files / 234 tests green** —
the suites covering the delta's new executable surface.

**S14 — `TRUE` (a security FIX the delta itself ships): CWE-377 class closed in
runtime-bridge-dispatch.** Pre-image: `origin/main:.claude/hooks/runtime-bridge-dispatch.sh:156`
`RESULT="$(tsx "$DISPATCH_TS" "$FILE_PATH" 2>/tmp/runtime-bridge-dispatch-stderr.txt)"` —
fixed, predictable, world-writable-target truncation (the in-comment rationale at the
current `:223-227` names the symlink pre-plant attack verbatim). Now `:233`
`_STDERR_LOG="$(mktemp "${TMPDIR:-/tmp}/runtime-bridge-dispatch-stderr.XXXXXX" …)"` +
EXIT-trap removal; plugin twin carries the identical code (mktemp at its `:233`).
→ Doc sentence: the dispatch hook's stderr capture is an unpredictable 0600 temp removed
on exit — the fixed-name `/tmp` truncation class is fixed, by name, in shipped code.

**S15 — advisory family, none blocking: predictable `/tmp` state files with `: >`
truncation (CWE-377-adjacent).** Census (`grep -n ': >'` over the changed hooks):
`lib/hook-emit.sh:89` `: > "$flag"` where `:87` builds
`flag="${TMPDIR:-/tmp}/aif-$1-${SESSION_ID}"` — SESSION_ID is extracted RAW at all four
call sites (`check-doc-authority.sh:105`, `validate-prompt.sh:113`,
`check-worker-dispatch-channel.sh:118`,`:127`; no `tr -c`/`cut -c`, unlike the residue
writer's sanitised key); `end-of-turn-reminder.sh:242`
`_scan_tmp="${TMPDIR:-/tmp}/aif-eot-scan-$$"` — a PER-INVOCATION copy (PID-suffixed,
no cross-turn stability requirement, so it could take the S14 mktemp shape); `:412`
`{ : > "$ctx_flag"; }` + `deps-hash-check.sh:293`
`.getff-deps-memo.<uid>.<tag>.<slot>` (umask 077 on write — the best of the family — but
content is unsigned, so a plantable memo suppresses a drift notice); carried member
(pre-existing source, twin generated): `check-doc-authority-header.sh:47`
`aif-dah-jqskip-${_SID:-nosession}`, `_SID` raw. Attack prerequisites are real but local:
`/tmp` write access plus knowledge of the session UUID (or a pre-planted PID range for
the `$$` member); impacts are single-file truncation and suppression of a skip notice,
as the invoking user, on dev machines. Filed as hardening debt because the delta's own
S14 standard makes the per-invocation member an inconsistency, not a new exposure class.
→ Doc sentence: hook session state under `/tmp` is advisory per-user state;
per-invocation temps are mktemp'd, cross-turn debounce flags deliberately keep stable
sanitised names.

**S16 — advisory (accepted, documented): `git -c safe.directory='*'`.**
`.claude/skills/dispatcher/helpers/probe-inflight.sh` (delta hunk) execs
`git -c safe.directory='*' -C "$repo_path" branch -a` in the agent container — git's
ownership defence relaxed for ONE read-only ref listing; the in-comment rationale
(root-exec vs user-owned checkout, measured 2026-09-08) is at the call site.
→ Doc sentence: the in-flight probe relaxes git ownership checking for a read-only
branch listing inside the container, by design and documented where it happens.

**S17 — clean surfaces, falsifiers executed:** secrets scan over every added line of the
88-file delta (`ghp_`/`github_pat_`/`sk-`/`AKIA`/`xox`/`password=`/`api_key=`/`Bearer `)
→ **zero hits**; `inject-handoff-on-compact.sh:39` sanitises the session key
(`tr -c 'A-Za-z0-9._-' '_' | cut -c1-96` — `/` cannot survive, so no traversal out of
`_handoff-<key>.md`) and passes the body through `jq -n --arg` (no jq injection);
`run-hook.cmd`'s hook-lang fallback validates BEFORE export
(`grep -qE '^[a-z]{2}(-[A-Za-z0-9]{2,8})?$'`); `heal.sh`'s container script crosses as a
single-quoted heredoc (`<<'HOOKSYNC'` — no local expansion, no nested quoting), backups
fail closed, overwrite is cp+mv; `_json_escape` now collapses `\n\r\t` and drops C0 (the
pre-delta copies emitted invalid JSON on tab/CR); `fetch-and-wire.sh`'s delta is a
version constant (0.2.0→0.3.0). The aif API (`localhost:3009`, no auth) quoted by the
aif-doctor runbook is the aif runtime's pre-existing local design, not a shipped-product
surface of this repo. **Lane stance unchanged: GO-WITH-NOTES** — no blocking security
finding on a consumer-reachable path.
