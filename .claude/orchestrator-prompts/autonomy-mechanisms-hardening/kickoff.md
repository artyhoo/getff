# autonomy-mechanisms-hardening — kickoff (Stage 1: the two mechanisms that do not fire)

<!-- bridge-profile: Z.AI GLM-5.2 SDK -->

> **Type:** I-phase — repair two shipped gates that a cold audit proved inert or bypassable.
> **Origin:** the 2026-07-24/25 cold audit of PR #1137 (four independent auditors + operator verification), then a 2026-07-25 pre-dispatch cold review (four more auditors) that corrected this kickoff's own errors — every number below has been re-measured on `staging` = `6d91ad34a`.
> **Deliverable:** a committed branch in your worktree — the fixes, their paired tests, and a mutation check per fix. You do NOT push and do NOT open the PR (§0.1).
> **Base branch:** staging.
> **Plan completeness:** the WHAT and the acceptance are fully specified. Implementation choices inside each item are yours, but every acceptance line below is mechanical — do not renegotiate it.

## §0 Cold-start context — read only this

Two mechanisms shipped on 2026-07-24 to make unattended (autonomous) runs safe:

1. **The F10 Stop arm** in `.claude/hooks/end-of-turn-reminder.sh` — when `AIF_AUTONOMOUS=1` and aif tasks are still running, the Stop hook emits `decision:block` so an unattended turn cannot end on a report while work is in flight.
2. **The destination-environment contract** — `scripts/host-verify.sh` runs the commands a kickoff declares in a fenced ```` ```bash host-verify ```` block; `.claude/hooks/check-kickoff-traps.sh` arm 1 asserts at edit time that such a contract exists, or that the kickoff explicitly opted out via `<!-- host-verify: none — <rationale ≥20 chars> -->`.

The audit found **mechanism 1 silent in its own motivating scenario** and **mechanism 2 bypassable by the most natural authoring mistakes**. Both suites were green throughout — that is the point.

## §0.1 Your environment — verified 2026-07-25, do not re-derive

You run inside the aif container. These facts were measured there, not inferred:

- **The supplied patch is at a CONTAINER path.** Use exactly:
  `/home/node/.claude-coordination/rules-as-tests-aif/aif-parity-fixes/wip-f10-fix-not-merged.patch`
  (`git apply --check` on it returns 0 against this base). The host path that appears in older notes does **not** resolve here.
- **You have no `github.com` egress.** `curl https://github.com` → `000`, `git ls-remote origin` → killed by timeout. **Do not attempt to push, and do not open a PR** — the host orchestrator harvests your branch and authors the PR body (including the `## Fidelity verdict` and `## Provenance` sections, which are its job, not yours). Commit everything; report your branch and final commit SHA (§6).
- **`origin/staging` is already fetched** — `git show origin/staging:<path>` works with no network.
- **`en_US.UTF-8` does not exist here.** `LC_ALL=en_US.UTF-8` warns to stderr and silently falls back to C, so it reproduces the *buggy* byte-counting state, not the fixed one. The UTF-8-aware locale available here is **`C.utf8`**. Measured on the current unfixed gate with a 10-character Cyrillic rationale: `LC_ALL=C` → rc=0, `LC_ALL=en_US.UTF-8` → rc=0, `LC_ALL=C.utf8` → rc=2. Use `C.utf8` wherever a UTF-8-aware positive control is needed.
- **The plugin twins regenerate themselves.** `.husky/pre-commit:156-165` runs `scripts/generate-plugin-twins.sh` and `git add plugin/hooks/` whenever a staged path matches `.claude/hooks/*.sh`. Never hand-edit a twin. The twins carry an injected `# AUTO-GENERATED` line as line 2 by design (`scripts/generate-plugin-twins.sh:29-38`), so a bare `diff hook twin` is **expected to be non-zero** — compare with `diff <(sed '2d' plugin/hooks/<name>) .claude/hooks/<name>.sh` instead (verified rc=0 for both twins today).
- **`.claude/hooks/end-of-turn-reminder.sh` is hashed into 8 of the 13 install fingerprints** (`grep -rl end-of-turn-reminder tests/install-sh/baselines/ | wc -l` → 8). Editing it moves those baselines — see §4. `scripts/host-verify.sh` and `check-kickoff-traps.sh` are in **0** baselines.
- **`timeout` and `jq` are present**; `cargo`/`rustc` are absent (only relevant to the cargo arm of the snapshot suite, which degrades gracefully).

## §1 Work item A — the F10 arm was shadowed by early returns

### The defect (reproduced, not theorised)

The arm sat at the BOTTOM of the hook (its code begins at line 281). The file contains **11** `exit 0` statements; **9** of them execute before the arm and shadow it:

| line | guard |
|---|---|
| 14 | `jq` absent |
| 37 | `stop_hook_active` |
| 42 | transcript missing/empty |
| 71 | `last_line` empty (no assistant line) |
| 90 | tool-only turn |
| 127 | ZCode thin-recap branch (emits, then exits, dropping the directive) |
| 160 | already-recapped (`AIF_RECAP_MARKER`, at `:159-161`) |
| 165 | story already told |
| 245 | idle-suppress |

The worst is the already-recapped guard: it exits whenever the turn carries `$AIF_RECAP_MARKER` — and an orchestrator that "ends its turn on a report" is emitting exactly that, using the marker this hook's own Branch A/B/C payloads instruct it to begin with. The operator's live setting is `AIF_HOOK_LANG=ru`, so the proven-silent cell is the live one.

Two further defects in the same arm:

- **The in-flight predicate was a strict subset of the real status vocabulary.** `:288-292` lists `planning|implementing|review|blocked_external`; `packages/runtime-bridge/src/types.ts:56` documents `backlog` and `plan_ready` too. `backlog` is the sharp miss — at coordinator cap, dispatched tasks queue there, so the arm went quiet with work about to run.
- **Fail-closed covered malformed bytes only.** Well-formed JSON of the wrong shape (`{"tasks":[…]}`, or an array of non-objects) makes `.[]? | select(type == "object")` yield a legitimate-looking `0` — a permanent silent all-clear, with no `PARSE_FAIL` and no degraded message.

### What to do

**A ready, verified patch exists — start from it, do not reinvent it.** Path in §0.1.

Apply it to `.claude/hooks/end-of-turn-reminder.sh`, `packages/core/hooks/end-of-turn-reminder.test.ts` and `packages/core/hooks/inject-session-bootstrap.test.ts`. It hoists the arm to immediately after the `stop_hook_active` guard, routes **6** of the 9 shadowing returns through a shared `_autonomy_exit` helper, fixes the **7th** (the ZCode branch) differently by embedding `autonomy_line` into its own `reason`, and correctly leaves **2** untouched (`jq` absent — no probe is possible; `stop_hook_active` — the arm now sits after it). It also inverts the predicate to exclude terminal statuses only, adds a shape guard, and adds **11 net-new `it()` blocks plus one strengthened pre-existing test**.

**You are not asked to trust it. You are asked to verify it**, and to say so in your report:

1. **Re-run the mutation checks.** The patch's own claim lives at `wip-f10-fix-not-merged.patch:296-301` and names exactly **four** mutations: invert the in-flight comparison; delete the `paused` filter; drop one status from the predicate; mute the in-flight branch outright. Re-run those four plus one row per behaviour you change. **There is no persisted eight-item mutation table anywhere** — if you see the figure "eight" in an older note, it is unsourced; do not invent rows to match it. If a claimed kill does not reproduce, that is a finding — report it, do not paper over it.
2. **Regenerate the plugin twin** — the patch does NOT include it. Per §0.1 the pre-commit hook does this for you; verify with the `sed '2d'` comparison, not a bare `diff`.
3. **Confirm off-by-default:** with `AIF_AUTONOMOUS` unset, output must be byte-identical to the pre-patch hook across every fixture. Compare against `git show origin/staging:.claude/hooks/end-of-turn-reminder.sh` **placed inside `.claude/hooks/`** — running the reference copy from elsewhere makes it fail to source its `lang/` pack and produces a false diff. (Safe: the installer copies hooks by name, not by wildcard — `install.sh:498-499`.)

**How to reproduce §1's defects — do not rebuild the ad-hoc harness.** The original measurement used a hand-built `t_plain`/`t_recap` transcript pair that was never persisted. Your reproduction is the patch's own tests: run `npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts` against the `git show origin/staging:` version of the hook (expect the new in-flight cases RED) and again after applying the patch (expect GREEN). Paste both. You are **not** asked to reconstruct the original harness.

### One open design question — decide it and say why

The patch counts `blocked_external` as in-flight (it excludes only `done`/`verified`). `.claude/skills/aif-doctor/helpers/heal.sh:63-66` counts `planning|implementing|review` plus un-paused `plan_ready`, and does NOT count `blocked_external`. The two predicates answer different questions ("is any dispatched work outstanding?" vs "is it safe to mutate the base?"), so they need not be identical.

Pick one and record the reasoning in your report:
- **(i)** keep exclude-terminal (any future upstream status counts by default — fail-closed); or
- **(ii)** align with `heal.sh` exactly.

Either way you MUST update the two stale rule passages named in §4 — the rule currently asserts a consistency that does not hold in either direction.

## §2 Work item B — the host-verify contract is bypassable

Each row below was reproduced twice (audit + pre-dispatch re-verification). `runner` = `bash scripts/host-verify.sh --list <kickoff>`; `gate` = the hook fed `{"tool_name":"Write","tool_input":{"file_path":"<abs>"}}` on stdin. `gate rc=0` means the violating kickoff passed.

| # | bypass | observed |
|---|---|---|
| B1 | the opt-out comment merely **quoted** inside a ```` ```text ```` fence, or in an inline code span | runner rc=2 "no contract", **gate rc=0** |
| B2 | `<!-- host-verify: none - no --> <!-- TODO: fill in later -->` — greedy `.*` runs to the LAST `-->`, so a 2-char rationale measures 48 | **gate rc=0** |
| B3 | a contract whose only line is `:;` (also `true;`, `exit 00`, `{ :; }`, `cd .`, `echo`) | runner prints **"✅ 1/1 passed"**, rc=0 |
| B4 | a `host-verify` block quoted inside a `~~~` wrapper, or indented 4 spaces (a CommonMark indented code block) | runner rc=0, extracts the quoted example as a live contract |
| B5 | a `host-verify` block inside `<!-- … -->` — machine-visible, invisible to every human reader | runner rc=0 |
| B6 | `${#HV_OPTOUT}` counts BYTES without a UTF-8 locale, so a 10-character Russian rationale passes a floor of 20 | gate rc=0 under `LC_ALL=C` and under unset locale; rc=2 under `C.utf8` (see §0.1 — **not** `en_US.UTF-8` in this container) |
| B7 | a validly opted-out kickoff | gate rc=0 (accepted) but runner rc=2 ("declares no contract") — they disagree |
| B8 | a **tab-indented** fence — `host-verify.sh:101` matches `^[ \t]*` + backticks, and a tab is not "≥4 spaces" | runner rc=0, extracts `\tnpx vitest run nothing` (verified 2026-07-25) |

B1 is the one that matters most: any kickoff that documents the convention for its own worker — exactly what a conscientious author writes — silently disarms arm 1. The gate's own violation message and `.claude/rules/destination-environment-verification.md` §1 both embed the literal token, so pasting the error you were just shown turns the gate off.

**Already fail-closed — use as the known-good control, do NOT "fix" it:** a fence inside a **blockquote** (`> ```bash host-verify`) → runner rc=2 (verified 2026-07-25).

### What to do — the decisions, already made

1. **Move opt-out recognition INTO `scripts/host-verify.sh`.** The gate must stop re-implementing it and call the runner, exactly as it already does for contract recognition (`check-kickoff-traps.sh:135`). This is what closes B1, B2, B6 and B7 in one place instead of four. A valid opt-out becomes a runner exit **0** with the rationale printed; a too-short one stays a failure with a message naming the measured length. *(An alternative — a distinct exit 3 for "validly opted out", preserving "rc=0 ⇒ verification actually ran" — was considered and is logged for the operator. Implement exit 0 as specified; do not re-litigate it.)*
   **The gate must surface the runner's stderr verbatim** in its violation text. Today `check-kickoff-traps.sh:135` discards it (`>/dev/null 2>&1`) and emits the generic "declares no host-verification contract" — keeping that discard is a message regression, and the exit-code table alone cannot tell the two implementations apart.
   **Sequencing:** today the opt-out branch (`:127`) precedes the runner-missing check (`:132`), so a valid opt-out is accepted even when the runner is absent. Once recognition moves into the runner, "runner missing + opt-out present" MUST become the LOUD "DID NOT RUN" skip (`:133`), never an acceptance.
2. **Make the opt-out scan fence-aware and code-span-aware** — reuse the same pass that finds contracts, so a quoted token can never open one. Capture non-greedily: take the FIRST `-->` after each `<!--`, never a run to the last one on the line.
3. **Measure the rationale in characters, locale-independently.** `printf '%s' "$s" | LC_ALL=C tr -d '\200-\277' | LC_ALL=C wc -c` counts one per UTF-8 character regardless of ambient `LANG` (verified in-container: yields 10 for a 10-character Cyrillic string even with `LC_ALL=en_US.UTF-8` set). Use the same value in the comparison and in the message.
4. **Teach the fence parser tilde fences, the 4-space rule, and tabs.** Track the fence CHARACTER alongside the run length; close only on the same character. Treat a fence whose indentation is **≥4 columns** as an indented code block — and **count a tab as 4 columns** (B8 is live today).
5. **Skip fences opened inside an HTML comment region.** Track `<!-- … -->` across lines.
6. **Strip a trailing `\r`** at the top of the parser — a CRLF kickoff currently reports "UNTERMINATED fence" and sends the author hunting a typo that does not exist.
7. **Broaden the no-op guard, and say in the comment that it is a floor against reflex, not a completeness claim.** Split each command line on `;`, `&&`, `||`, `|`, strip `{}()`, and treat the line as non-substantive when every command word is in `{: true false exit echo printf cd pwd test [}`. At least one substantive line must remain. The current guard's comment claims it "closes the one bypass that is cheaper than the documented opt-out" — false while `:;` costs two characters; fix the comment along with the code. **Guard the false positive:** `test` and `[` are in that set, so a legitimate one-line contract like `test -f package.json` must still pass — cover it with a positive fixture (below).
8. **Reject an umbrella argument containing `/` or `..`** before the umbrella-path branch — `host-verify.sh 'a/../b'` currently runs another umbrella's contract while printing a path that reads as the first.

### Acceptance for item B — mechanical, non-negotiable

Build a fixture corpus in a temp dir. **Each fixture's path MUST end with `.claude/orchestrator-prompts/<name>/kickoff.md`** — the gate's scope matcher is the suffix `*/.claude/orchestrator-prompts/*/kickoff.md` (`check-kickoff-traps.sh:72-75`), so a bare `/tmp/x/kickoff.md` is out of scope by design and exits 0. A temp dir carrying that suffix works (verified 2026-07-25). **Broadening that matcher to make a fixture fire is a gate weakening and is forbidden (§4).**

**One fixture per VARIANT named in each row**, not one per row: B1 has two (`text` fence and inline code span), B3 six (`:;`, `true;`, `exit 00`, `{ :; }`, `cd .`, `echo`), B4 two (`~~~` wrapper and 4-space indent). Plus the four already-closed bypasses as regression guards (4-backtick wrapper, unterminated fence, bare `:`, a 17-char ASCII opt-out) and the blockquote control.

Required outcomes:

- **B1–B6, B8, and every regression guard:** gate exit **2** and runner exit **2**.
- **B7:** both exit **0**. Label it `PAIRED-POSITIVE:` — it is not a negative case.
- **Exit code is not enough.** `check-kickoff-traps.sh:85,164-166` accumulates arm-1 and arm-2 violations into a single exit 2; the repo's own test file says so at `packages/core/hooks/check-kickoff-traps.test.ts:83`. So each case MUST **also assert the arm-1 stderr text** (`grep 'kickoff host-verify:'`), and each fixture MUST be arm-2-clean (either no `ai-laziness-traps` mention, or ≥3 T-numbers). Otherwise a fixture that trips arm 2 satisfies every "gate must exit 2" row while arm 1 stays inert — the identical "green suite, dead mechanism" failure this PR exists to repair.
- **B6 must be asserted twice** — once with `LC_ALL=C` and once with `LC_ALL=C.utf8` in the spawn env — and both must exit 2 after the fix. Without the two legs, a harness that inherits a UTF-8 locale makes B6 pass before the fix, so its "teeth" check proves nothing.
- **Two rows the earlier draft omitted entirely** (fixes 6 and 8 had no acceptance at all):
  - a **CRLF** kickoff carrying a valid contract → runner **0** and gate **0** (today: "UNTERMINATED", rc=2);
  - `bash scripts/host-verify.sh 'a/../b'` → non-zero with a usage message, asserted in the new test file (§3 criterion 3).
- **One positive fixture** for fix 7's false-positive risk: a contract whose only line is `test -f package.json` → runner **0**.

Add each as a case in `packages/core/hooks/check-kickoff-traps.test.ts`, marked `PAIRED-NEGATIVE:` (or `PAIRED-POSITIVE:` for B7 and the two positive rows). Reuse the existing `writeKickoff` helper (`check-kickoff-traps.test.ts:53`) rather than inventing a fixture writer.

**Then prove the corpus has teeth:** revert your fix, confirm the corpus goes RED, restore it. Report that table.

## §3 Acceptance criteria

1. **Every reproduction in §1 and §2 flips.** Paste before/after for each, verbatim. For §1 the reproduction is the patch's own test file run before/after, per §1 — not a rebuilt harness.
2. **Mutation check per fix.** For each behaviour you fix, seed the regression and show the suite goes RED, then revert. A test that stays green with the mechanism disabled is worthless and is itself a finding. Table: mutation → RED/GREEN → which test caught it. Include the four named at `wip-f10-fix-not-merged.patch:296-301`.
3. **`scripts/host-verify.sh` gains its own test file** (`packages/core/hooks/host-verify.test.ts`, following the `create-worktree.test.ts` / `unpinned-tool-install.test.ts` precedent of spawning the script). It has none today, and is reached only via `--list`, so its entire run path is untested. Four behaviours were mutated to no-ops with the suite staying green: the per-command exit accounting, the `-o pipefail` in the child shell, the `timeout` wrapper, and the final `exit 1`. Cover at minimum:
   - a declared command that fails → runner exits 1;
   - a declared `(exit 7) | cat` pipeline → exits 1 (i.e. the pipeline's failing status, not `cat`'s 0);
   - `HOST_VERIFY_TIMEOUT=2` with a `sleep 30` contract → non-zero within ~5s wall-clock. **Guard it:** `host-verify.sh:159-166` explicitly contemplates a missing `timeout`/`gtimeout` and then runs **unbounded**, so gate this case behind `it.skipIf(<no timeout binary>)` and report the skip rather than asserting a wall-clock bound the script does not promise;
   - the `a/../b` umbrella-argument rejection from §2.
4. **The env-plumbing bug in the test harnesses.** `runHook` in `packages/core/hooks/check-kickoff-traps.test.ts:66-73` builds its env from `process.env` and propagates only `ZCODE_PROJECT_DIR`, silently discarding its `env` argument. The test `a kickoff OUTSIDE the resolved repo root is still gated` (`:389-397`) therefore never set `CLAUDE_PROJECT_DIR` and is functionally identical to the plain no-contract test — it has never once exercised a root mismatch. Fix the harness (spread `env`, keep the ZCODE scrub as a special case), make that test actually pass a foreign `CLAUDE_PROJECT_DIR`, and add an `env-plumbing sanity` case asserting a non-ZCODE variable reaches the hook, so it cannot rot again. The same bug exists at `packages/core/hooks/inject-session-bootstrap.test.ts:44-50` — the supplied patch already fixes that one; verify it.
5. **Suite green:** `npx vitest run packages/core/hooks/` — report the pass count you observe (do not assume a figure from an older note). **Plus the install fingerprints:** because the hook is hashed into 8 of 13 baselines, run `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`, commit the moved `tests/install-sh/baselines/*/*.fingerprint` files, then prove it with `SNAPSHOT_MODE=compare bash tests/install-sh/byte-identical.test.sh` (the command CI's required `ci-success` aggregates) → all pass.
6. **No claim you cannot re-run.** For every number you write into a code comment or the report, name the command that produces it and the conditions under which it holds.

## §4 Constraints (binding)

- **Base `staging`. One concern.** Items A and B are one concern: *shipped autonomy gates that do not fire*.
- **You do not push and do not open the PR** (§0.1 — no egress). Commit; the host orchestrator harvests, runs the destination-environment contract at the bottom of this file, and authors the PR body (§1.7 sections, `## Provenance`, `## Fidelity verdict`). Do not write a PR body.
- **Commit trailer — use the positive form, not the escape hatch.** The new test file from criterion 3 is a new file ≥80 LOC under `packages/`, which makes this a **capability commit** by `packages/core/hooks/checks/prior-art.ts:129-136`; on a capability commit a `Prior-art: skipped` payload is rejected with code 2 (`prior-art.ts:186-200`). **Which gate that blocks at:** NOT pre-push — its substance arm reads `PA_SUBSTANCE_WARN_ONLY ?? 'true'` (`pre-push.ts:301`), i.e. warn-only by default, so locally you would only see a warning. The blocking channel is server-side: `.github/workflows/pr-body-prior-art.yml` re-runs the same check against the **PR body** (a squash drops branch-commit trailers, so the PR body is what survives). Contrast the sibling arm, which IS enforcing locally: `S17_SUBSTANCE_WARN_ONLY ?? 'false'` (`pre-push.ts:376`) — do not infer symmetry from the naming. Either way the escape hatch fails the PR after all the work is done. Use:
  `Prior-art: prior-art-evaluations.md#229 (ADAPT — this PR repairs the runner + edit-time gate shipped under that entry; no new capability area). Companion for item A: #107.`
- **Doc-claim corrections are Stage 2 and out of scope — with exactly three named exceptions that THIS PR's own changes make false, which you MUST therefore update in the same commit:**
  - `.claude/rules/autonomous-loop-continuity.md:23-27` — the status enumeration "`planning` / `implementing` / `review` / `blocked_external`", stale under the inverted predicate;
  - `.claude/rules/autonomous-loop-continuity.md:131-133` — the "`heal.sh` … consistent, nothing superseded" claim, false in both directions (see §1's open question);
  - `.claude/rules/destination-environment-verification.md:42-45` — the exit-code contract ("0 = every declared command passed … 2 = no contract found"), stale once a valid opt-out exits 0; and extend `:47-49` to say that opt-out recognition is now delegated to the runner too.

  Touch nothing else under `.claude/rules/`. **Note the gate consequence:** `.claude/rules/**` is a trigger path in `.github/workflows/discipline-self-check.yml:14-15`, so touching these files makes that job run — the §1.7 obligation below is then mechanically enforced, not self-imposed.
- **No `--no-verify`, no gate bypass.** If a pre-commit or pre-push gate rejects you, fix what it names.
- **Do not weaken a gate to make a test pass.** Any reduction in what is checked is out of scope and must be reported instead. The one intended semantic change is fix 1's opt-out exit code, which is explicitly scoped above; broadening the gate's path matcher, or relaxing the no-op guard to admit `:;`, is a weakening.
- **§1.7 material:** the PR body is the host's job, but your **commit message body** must carry the material it will cite — a `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied` pair, each ≥40 non-whitespace characters and each citing a real `file.ext:line` whose content says what you claim. The backward-check must enumerate the sibling surfaces of this change-class — **other PostToolUse gates that resolve a helper by path, and other hooks with early returns before a load-bearing arm** — with a verdict per surface. Both populations are mechanically enumerable: `grep -ln '_cand\|for _t in\|/scripts/' .claude/hooks/*.sh` and `grep -c 'exit 0' .claude/hooks/*.sh`. Naming only the files this PR touches is a non-conformant backward-check.
- **Park, don't guess.** If a fix proves unreachable, stop and report the case with its command output.

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md` §2 and §3)

**Active canonical traps: T2, T3, T14, T19, T20, T21.**

- **T2 — designing ≠ running.** "The parser now handles tilde fences" is not a deliverable. Run each fixture, paste the exit codes.
- **T3 — no prose-only findings.** Every claim carries a command + its output, or a `file:line` with the line's actual content.
- **T14 — clean ≠ covered.** If your corpus passes on the first try, suspect the corpus before believing the fix. §3 criterion 2 is the falsifier.
- **T19 — own cold-QA before handoff.** Operationalised as a required report row (§6 item 7) — a green suite is not a design review. This whole kickoff exists because a green suite hid two dead mechanisms. *(The rule's primary counter, a cold `agents/backward-sweep-auditor.md` run, needs a sub-agent channel you may not have in the container; if you cannot dispatch one, say so — a named limit is honest, a silent omission is not.)*
- **T20 — no verdict without evidence** in your report.
- **T21 — the backward-check sweeps siblings, it does not restate the PR.** See §4 for the two enumerable populations.

**T-AutonomyHardening-A — «fixing the reported bypass, not the class».** Each row in §2 is one *instance* of a class: markup the parser does not model. Closing exactly the listed rows and stopping leaves the next one live, and the next audit finds it. B8 (tab-indented fence) is precisely this trap having already fired once — it was missed by the first audit and found by the second. After your corpus is green, spend one pass asking «what other CommonMark construct renders this literally?» and either cover it or record it as a known limit in the script's header comment. Candidates worth checking: a BOM before a fence, a setext-adjacent case, a fence inside a list item, `\r\n` interacting with the indent count. **The blockquote case is already fail-closed — use it as the control, not as a candidate.** A limit you name is honest; a limit you did not look for is the same defect again.

**T-AutonomyHardening-B — «trusting the supplied patch because it looks verified».** §1 hands you a patch written by the same session that wrote the first draft of this kickoff, so it carries that session's blind spots — that draft's own «nine `exit 0` / six shadowing» and «eight mutations» figures were both wrong (real: 11 / 9, and four named mutations). §3 criterion 2 requires you to re-run the four claimed mutations yourself. If you report them as passing without having run them, that is exactly the `#discipline-theatre` shape this repo exists to prevent — and it is detectable, because the mutation table you paste will not match what the code does.

## §6 Report — what to hand back

1. **Your branch name and final commit SHA** (not a PR number — you do not open the PR).
2. The §3 acceptance table: criterion → command → verbatim output → PASS/FAIL, all six rows. For criterion 6, list every number you wrote into a comment with the command that produces it.
3. The before/after table for every reproduction in §1 and §2 (including B8 and the new CRLF / path-traversal / `test -f` rows).
4. The mutation table (mutation → RED/GREEN → catching test), including the four claimed at `wip-f10-fix-not-merged.patch:296-301`.
5. Your decision on the §1 open question (i or ii) with the reasoning, plus confirmation that the three §4 rule passages were updated.
6. The T-AutonomyHardening-A pass: what other constructs you checked, and what you chose to record as a known limit.
7. **Your own adversarial self-review (T19):** the three things you would attack in this diff if you had not written it, each with the command you ran to check it.
8. Anything you could not verify, named as such — including any step blocked by the container environment.

```bash host-verify
npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts
npx vitest run packages/core/hooks/check-kickoff-traps.test.ts
npx vitest run packages/core/hooks/inject-session-bootstrap.test.ts
npx vitest run packages/core/hooks/host-verify.test.ts
npx vitest run packages/core/hooks/
diff <(sed '2d' plugin/hooks/end-of-turn-reminder) .claude/hooks/end-of-turn-reminder.sh
diff <(sed '2d' plugin/hooks/check-kickoff-traps) .claude/hooks/check-kickoff-traps.sh
SNAPSHOT_MODE=compare bash tests/install-sh/byte-identical.test.sh
```
