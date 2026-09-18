#!/usr/bin/env bash
# run-local-ci-sweep.sh — local CI-equivalent gate sweep for harvest pre-push.
#
# Default: diff-aware (vs merge-base), cheapest-first, fail-fast, fail-safe to full.
# `--full` runs the complete set regardless of the diff.
#
# It gates COMMITTED work: gate SELECTION comes from `git diff <merge-base>...HEAD`, because
# that is what CI will see. Uncommitted edits are therefore invisible to the selection layer,
# and the sweep refuses (rc 3) rather than answering rc 0 when that leaves it with no gates at
# all on a dirty tree. See the `dirty-tree-zero-gates` block at the tail for why the refusal is
# scoped to that case and not to every dirty tree.
#
# The sweep aggregates the gates the GitHub-CI jobs run (audit-self.yml). It exists so a
# harvested aif branch is checked against the real gate set locally before push — the
# recurring "pushed, CI reddened on a gate I didn't re-run" failure (PR #724).
#
# Spec: docs/superpowers/specs/2026-06-26-harvest-skill-design.md
# bash 3.2 compatible (no globstar / associative arrays).
#
# --- COVERAGE vs the required CI contexts (audited 2026-08-09; list re-derived 2026-08-10) -
# The contexts whose fail-closed property rests on being REQUIRED on staging. DERIVED, NOT
# AUTHORED: each entry is declared at its own job by a `# required-context: yes` marker in
# .github/workflows/*.yml, and packages/core/principles/37-required-context-completeness.test.ts
# asserts this block equals that declared set exactly (and that workflow-integrity.yml's
# `required_contexts=` does too). Do not hand-edit one of the three without the others.
#
# REQUIRED_CONTEXTS:
#   Template render probes — P1/P4/P6 (deterministic)
#   capability PR carries Prior-art line in PR body (squash-survival)
#   ci-success
#   fidelity-verdict-in-pr-body
#   stale-revert-in-pr-diff
#   §1.7 forward+backward sections present in PR description
#
# REGISTRATION STATE (2026-08-10, `gh api …/branches/staging/protection` with an admin token):
# registered = `ci-success`, `fidelity-verdict-in-pr-body`, `stale-revert-in-pr-diff`.
# Declared-required but NOT yet registered = `Template render probes — P1/P4/P6 (deterministic)`,
# `capability PR carries Prior-art line in PR body (squash-survival)`, and — newly registrable as
# of the §1.7 trigger unfiltering — `§1.7 forward+backward sections present in PR description`.
# Those three can go red today and the PR still merges; an operator action closes that, and CI
# cannot verify it (workflow-integrity.yml:32-42, GITHUB_TOKEN cannot read protection).
# Named, not positional, deliberately: this line previously said «the last three» / «the first
# two», which silently became wrong the moment a sixth entry was appended above.
#
# `ci-success` is the audit-self.yml aggregator that `needs:` every other job in that file
# (asserted by principle 36). There is no ci.yml. A green sweep predicts a green CI only for the
# jobs listed as COVERED below.
#
# This table below is prose and drifts like any prose. The MECHANISM that keeps the gate table
# itself honest is scripts/run-local-ci-sweep-coverage.test.sh: every single-line atomic command
# audit-self.yml runs must be reachable from gate_table() or carry an explicit UNREACHABLE
# rationale there. It covers the single-line layer only — jobs whose gate logic is inline
# `run: |` / `run: >-` YAML stay invisible to it (see the UNREACHABLE entries below).
#
# COVERED — every `ci-success` need except those named UNREACHABLE:
#   actionlint · typecheck · install-sh-a/b/c (the *.test.sh battery, byte-identical,
#   agnosticism, meta-all-wired, every scripts/*.test.sh self-test the workflow wires (derived,
#   not listed — see gate_table), harvest-via-api, the
#   setup.d lint step) · principles-meta-tests (test:principles/hooks/render/ir/composition/
#   backends/synthesizer/units/skills/spec-validation, the two drift gates, the
#   tests/hooks/*.test.sh battery) ·
#   manifest-render-check · probe-tests · alwayson-budget · phase-8-canonical-regen-acceptance ·
#   scripts/measure/measure.test.sh (the recap-v2 measurement-script oracle; it kept its OWN
#   row from when the derived `script-selftests` row could only see `scripts/<name>.test.sh`.
#   Since 2026-09-14 that derivation also reaches one directory deeper — it had to, or
#   `scripts/lib/claude-md-excludes.test.sh` would have been wired in CI and invisible to the
#   sweep — so this row is now belt-and-braces rather than the only coverage) ·
#   tests/plugin/twin-generation.test.sh (plugin twin generator acceptance — the
#   `plugin-twin-tests` row). Named literally, not as a `tests/plugin/*` loop, so that a future
#   test added to that dir but wired to NO CI step stays out of the sweep — same reasoning as
#   the derived `script-selftests` row: the sweep predicts CI, it does not invent gates. Its
#   `agents/` trigger is load-bearing beyond CI prediction: the suite RUNS the generator, so a
#   sweep after an agents/*.md edit re-syncs the plugin/agents twins that .husky/pre-commit
#   does not yet regenerate ·
#   f17-node-compat (host Node only) · shipped-prettier (its `npm run format:check` is the
#   sweep's format-check row; it became a `ci-success` need in #1362) ·
#   `Template render probes — P1/P4/P6` (framework-self-template-render.yml — a required context
#   in its own right, not a `ci-success` need; the `template-render` row below runs the same
#   `test:template-render` suite, hermetic into tmpdirs, ~5s).
#
# UNREACHABLE — a green sweep says NOTHING about these; verify on CI:
#   mechanical            whole-tree `find` scanners (packages/core/audit-self/md-line-gate.sh
#                         and its peers); locally they also read gitignored files CI's clean
#                         checkout never has → false red (see the NOTE below).
#   zizmor                needs `pip install zizmor==1.26.1` (network + python env).
#   framework-self-install-ts-server / -react-next, framework-fresh-install-validate (×4 stacks),
#   framework-fresh-install-validate-multistack, consumer-matrix-start-cell
#   (tests/consumer-matrix/pnpm-monorepo-cell.sh), consumer-matrix-python-unfamiliar-stack-cell,
#   consumer-matrix-npm-tarball-cell, consumer-matrix-getff-dist-cell
#                         each runs a real `install.sh … --full` (or an `npm pack` + `npm i` of
#                         the getff tarball) into a tmp consumer and installs its dependency
#                         tree — network, minutes, non-hermetic.
#                         (consumer-matrix-npm-tarball-cell shipped after this list was written
#                         and went unlisted; consumer-matrix-getff-dist-cell then repeated the
#                         drift — the coverage metatest gates its OWN allowlist array, not this
#                         prose, so this list stayed a second ungated copy. The `unreachable-list-
#                         parity` arm in run-local-ci-sweep-coverage.test.sh now gates it.)
#                         PARTIALLY RECOVERED: the getff-dist cell's step (1),
#                         `build-getff-dist.sh --check`, is hermetic and ~12s — it is the
#                         `getff-dist-manifest` row below, so manifest drift is now a LOCAL red.
#                         The cell's remaining steps stay CI-only.
#   pr-commit-trailers    needs the PR base ref + the real PR commit range; the local channel
#                         for it is the pre-push hook, not this sweep.
#   fidelity-verdict-in-pr-body, stale-revert-in-pr-diff
#                         both read the PR body / PR diff off the GitHub API — no PR, no gate.
#   rule-to-probe, enforce-husky-presence, framework-self-detect / -research / -synth /
#   -validate / -install-validated, framework-provenance-anti-hand-edit, the synth-bundle
#   functional smoke, the J3 go-lane live-fire
#                         gate logic is inline bash in the workflow YAML, not a committed
#                         script. Transcribing it here would create a second copy that drifts
#                         from the workflow it claims to predict
#                         (.claude/rules/dual-implementation-discipline.md). Extracting each to
#                         a script — then adding a row that calls it — is the real fix.
#   f17-node-compat (Node 20 arm), the lychee-shipped-md-offline arm
#                         need a second Node version / a pinned downloaded binary; the sweep
#                         runs the host Node, and the lychee test self-SKIPs without it.
# ------------------------------------------------------------------------------------------
#
# Test seams (used by run-local-ci-sweep.test.sh, never in real runs):
#   SWEEP_GATES_FILE   path to a gate table overriding the built-in one
#   SWEEP_DIFF_OVERRIDE  space/newline list of changed paths overriding `git diff`
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1
TAB="$(printf '\t')"

MODE="diff"
BASE_REF=""
LIST_GATES=0
# Every gate that runs writes its combined output to a file in a per-run log directory (see
# `ensure_log_dir`). Unconditional, not flag-gated: the diagnostic is only worth anything on the
# run that happens to catch a rare red, and no operator can know in advance which run that is —
# a flag would have to be guessed BEFORE the failure (PR #1749: one red `vitest-hooks` in ~11
# runs on one commit, undiagnosable because its output was discarded).
# `SWEEP_LOG_DIR` pins the location; unset, each run gets a fresh `mktemp -d`.
SWEEP_LOG_DIR="${SWEEP_LOG_DIR:-}"
LOG_DIR_READY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --full) MODE="full" ;;
    --base) shift; BASE_REF="${1:-}" ;;
    --list-gates) LIST_GATES=1 ;;
    -h | --help)
      echo "usage: run-local-ci-sweep.sh [--full] [--base <ref>] [--list-gates]"
      echo "env:   SWEEP_LOG_DIR=<dir>   per-gate output logs land here (default: a fresh mktemp -d)"
      echo "exit:  0 gates passed (or nothing to do on a clean tree) · 1 a gate failed"
      echo "       2 bad usage · 3 refused: dirty tree, committed diff selected no gates"
      exit 0 ;;
    *) echo "[sweep] unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

# --- derived TRIGGERS (not just derived commands) ---------------------------------------------
# One row below derives its TRIGGER from the artifact it gates, for the reason the
# `script-selftests` note gives for deriving a command: a trigger hand-written beside a list that
# already exists in the repo is a second copy, and it drifts silently. Measured 2026-09-14, the
# `getff-dist-manifest` trigger had already drifted WIDER than the payload it restates — `.claude/`
# for three named subdirectories, `packages/` for five named packages, `scripts/` for six named
# files — so a one-line `.claude/rules/*.md` edit selected a 547s gate whose input set that file is
# not in. Deriving means the trigger follows the payload for free, in both directions.
#
# The helper falls back to ALWAYS when its source stops parsing. That direction is deliberate:
# a shrunken trigger is the one failure this file must not have — a gate nobody selects is a gate
# nobody has (.claude/rules/attention-is-not-a-mechanism.md §2).
#
# WHY THE `vitest-*` ROWS ARE NOT DERIVED THE SAME WAY (measured 2026-09-14, negative result).
# Each `test:<suite>` script in packages/core/package.json names the directory its test FILES live
# in, so the suite's own directory is derivable — but what a suite READS is not the same set, and
# only the read-set is a safe trigger. Two facts kill the narrowing:
#   (a) the dependency closure has to be transitive — `ir`'s tests reach `research/`, which reaches
#       `validator/` — and a change three hops out still reds the suite;
#   (b) every closure measured terminates in a directory that resolves a repo-root path
#       (`REPO_ROOT`, `process.cwd()`), i.e. reads something outside packages/core/ that no grep
#       can bound. `ir` and `composition` were the only two suites confined at depth 1; both escape
#       at depth 2 (via `research`/`validator`). `hooks` — 644s, the single most expensive gate —
#       is the worst case: 68 of its 76 test files compute REPO_ROOT and five run the real hook
#       with `cwd: REPO_ROOT`, so it genuinely reads the live tree.
# So every `vitest-*` row keeps the broad `packages/core/` trigger. That is over-selection by
# choice, per this file's own header: a sweep that MISSES a gate CI runs is strictly worse than a
# slow one. `run-local-ci-sweep-coverage.test.sh` enforces this as a rule rather than leaving it
# as a comment — a `vitest-*` row narrowed below `packages/core/` REDs unless its suite's closure
# is proven confined.

# Fallback when the payload stops parsing. `ALWAYS`, not the pre-derivation literal: restating
# that literal here would be the same second copy this row just stopped being, and it would go
# stale the moment the payload grew a root the literal does not name — under-selection, the one
# direction this file must not fail in. ALWAYS runs the gate on every diff instead: loud, slow,
# and safe, while arm 8b of run-local-ci-sweep-coverage.test.sh REDs at the same moment and says
# the derivation broke.
GETFF_PAYLOAD_FALLBACK="ALWAYS"

# getff_payload_trigger — the exact input set of `bash scripts/build-getff-dist.sh --check`.
# That script's PAYLOAD= line IS the set of paths whose bytes the committed manifest hashes, so a
# path outside it cannot move the manifest and cannot red this gate. Directory entries become
# prefix triggers and file entries stay literals; which is which is read off the working tree
# rather than restated here.
# shellcheck disable=SC2329  # invoked from the gate-table rows at table-construction time
getff_payload_trigger() {
  local src="scripts/build-getff-dist.sh" line entry out="" n=0
  [ -f "$src" ] || { printf '%s' "$GETFF_PAYLOAD_FALLBACK"; return; }
  line="$(grep -E '^PAYLOAD="' "$src" | head -1)"
  line="${line#PAYLOAD=\"}"; line="${line%\"}"
  for entry in $line; do
    # Anything not a plain literal path (a variable, a substitution) is unresolvable here; the
    # entry-count floor below turns a payload built that way into the broad fallback.
    case "$entry" in '' | *'$'* | *'`'* | *'*'*) continue ;; esac
    if [ -d "$entry" ]; then out="$out,$entry/"; n=$((n + 1))
    elif [ -e "$entry" ]; then out="$out,$entry"; n=$((n + 1))
    fi
  done
  [ "$n" -ge 10 ] || { printf '%s' "$GETFF_PAYLOAD_FALLBACK"; return; }
  printf '%s' "${out#,}"
}

# --- gate table: rank<TAB>name<TAB>trigger<TAB>command (cheapest rank first) ---
# trigger: ALWAYS | SHIPPED | a path prefix (ends with /) | a suffix (starts with .) | a literal.
gate_table() {
  if [ -n "${SWEEP_GATES_FILE:-}" ]; then cat "$SWEEP_GATES_FILE"; return; fi
  # NOTE: the whole-tree `mechanical`-job scanners (md-line-gate, .md→.md dead-links,
  # stale-path, bash-syntax-of-all, json-validity) are deliberately EXCLUDED: they `find`
  # the working tree and so scan gitignored files (e.g. .claude/orchestrator-prompts/*.md)
  # that CI's clean checkout never has → false reds locally. They stay CI-only (peer of the
  # framework-self matrix). A `.md` diff gets an honest advisory gate instead.
  #
  # Two rows DERIVE their content from .github/workflows/audit-self.yml rather than restating
  # it: `script-selftests` greps the workflow for the scripts/**/*.test.sh steps it actually runs,
  # and `toolchain_pins_ok` reads the ast-grep/ruff/rustc pins out of their install steps. A
  # hand-maintained list of either goes stale silently — the first version of this row named
  # four self-tests and was already one short (`host-verify-coverage.test.sh`, added to CI in
  # #1339) before it ever merged. Deriving means a new CI step joins the sweep for free, and a
  # test present in scripts/ but wired to NO CI step (probe-channels.test.sh at time of
  # writing) correctly stays out — the sweep predicts CI, it does not invent gates.
  #
  # `citation-fullsweep` is triggered ALWAYS rather than by a path list, and that is the whole
  # point of the row: a `path:NN` citation goes stale when the CITED file moves, and any tracked
  # file can be a cited file (the 2026-09-14 case was `setup.d/10-skills.sh`). A prefix list here
  # would rebuild the exact hole the gate was built to close. It runs UNSCOPED — pre-push scopes
  # the blame arm to the push via `--affected-by`, but this row predicts the CI job, and the CI
  # job is the unscoped backstop. ~6.4s over the 103-file corpus, measured 2026-09-14.
  #
  # `install-sh-suite` delegates to scripts/run-install-sh-suite.sh (bounded parallel fan-out with
  # one quarantined test — see that file's header). THIS file is delivered into consumer projects
  # (setup.d/10-skills.sh:172, install.sh:1156) and the runner is NOT, which is deliberate: a
  # consumer has no tests/install-sh/ at all, so the row is never selected in diff mode, and under
  # --full it fails there exactly as it did before — measured 2026-09-14 in a bare directory, the
  # serial loop exited 1 on the unmatched glob and the runner call exits 127 on the missing file.
  # Shipping the runner would add an artefact to the install manifest for a battery consumers do
  # not have.
  #
  # `sweep-ci-coverage` is listed explicitly even though `script-selftests` would derive it: that
  # row's trigger is `scripts/` only, and a workflow-only diff — precisely the diff this metatest
  # exists to catch — would never select it. The duplicate run on a scripts/ diff is pure grep.
  # Its trigger also names `scripts/build-getff-dist.sh`, because that file is now the SOURCE of
  # the `getff-dist-manifest` trigger: a payload edit must re-check the derivation at the earliest
  # channel that can see it, not wait for CI.
  #
  # `claude-dir-ci-only` runs nothing. It exists so that narrowing `getff-dist-manifest` from
  # `.claude/` to the three shipped `.claude/` subdirectories does not leave `.claude/settings.json`
  # and `.claude/orchestrator-prompts/**` matching NO trigger — which the fail-safe below would
  # (correctly, but uselessly) turn into a full-sweep escalation on a log-file edit. Measured
  # 2026-09-14: without this row 17 tracked paths became newly unmapped; with it the unmapped set
  # is byte-identical to the pre-change one, at 64 paths. The row says out loud what actually
  # gates that payload, which is the honest answer the old `.claude/` mapping was hiding.
  #
  # Every other row reuses an already-committed script / npm-script VERBATIM. CI jobs whose
  # gate logic lives inline in the workflow YAML (rule-to-probe, enforce-husky-presence, the
  # six framework-self-* snapshot diffs, the synth-bundle functional smoke) are deliberately
  # NOT transcribed here: a second copy of that logic would drift from the workflow it claims
  # to predict (.claude/rules/dual-implementation-discipline.md). Closing those needs the
  # workflow's logic extracted to a script first — a separate change. The remaining uncovered
  # required jobs need a clean checkout, the network, or a toolchain the sweep must not
  # assume; see the coverage table in the header docs above.
  printf '%s\n' \
    "1${TAB}meta-all-wired${TAB}tests/install-sh/,.github/workflows/${TAB}bash tests/install-sh/meta-all-wired.test.sh" \
    "1${TAB}sweep-ci-coverage${TAB}.github/workflows/,scripts/run-local-ci-sweep.sh,scripts/build-getff-dist.sh${TAB}bash scripts/run-local-ci-sweep-coverage.test.sh" \
    "1${TAB}md-ci-only${TAB}.md${TAB}echo '[sweep] WARN: markdown line/dead-link gates run in CI only (local scan hits gitignored files) — verify on CI'" \
    "1${TAB}claude-dir-ci-only${TAB}.claude/${TAB}echo '[sweep] WARN: .claude/ is gated per-subtree, not as a whole. hooks/ skills/ templates/ ship, so getff-dist-manifest covers them; rules/ has render-check + rule-index-check. settings.json and orchestrator-prompts/ have no row of their own — their readers (the hooks harness-config drift test; vitest-spec-validation) are selected by their own triggers, and the whole-tree json/bash scanners are CI-only — verify on CI'" \
    "1${TAB}actionlint${TAB}.github/workflows/${TAB}{ command -v actionlint >/dev/null 2>&1 && actionlint .github/workflows/*.yml; } || echo '[sweep] WARN-skip actionlint absent'" \
    "1${TAB}alwayson-budget${TAB}CLAUDE.md,.claude/rules/,scripts/measure-always-on.sh,scripts/check-alwayson-budget.sh${TAB}bash scripts/measure-always-on.test.sh && bash scripts/check-alwayson-budget.test.sh && bash scripts/check-alwayson-budget.sh" \
    "2${TAB}format-check${TAB}SHIPPED${TAB}npm run format:check" \
    "2${TAB}render-check${TAB}.claude/rules/${TAB}npx tsx packages/core/render/render-rules.ts --check" \
    "2${TAB}rule-index-check${TAB}.claude/rules/,AGENTS.md,scripts/render-rule-index.mjs${TAB}npx tsx scripts/render-rule-index.mjs --check" \
    "2${TAB}install-roster-check${TAB}INSTALL-FOR-AI.md,setup.d/,agents/,scripts/render-install-roster.mjs${TAB}npx tsx scripts/render-install-roster.mjs --check" \
    "2${TAB}presets-check${TAB}packages/core/templates/shared/AI-USAGE-GUIDE.md,.claude/skills/pipeline/references/presets/,scripts/render-presets.mjs${TAB}npx tsx scripts/render-presets.mjs --check" \
    "2${TAB}reference-check${TAB}setup.d/,skills/,agents/,.claude/,plugin/,packages/core/templates/,packages/core/manifest/,packages/runtime-bridge/src/cli/,scripts/,package.json,docs/site/reference/${TAB}npx tsx scripts/render-reference.mjs --check" \
    "2${TAB}face-facts-check${TAB}packages/core/manifest/,packages/core/templates/shared/,packages/core/composition/demo/,packages/core/principles/,packages/core/package.json,setup,install.sh,README.md,docs/,skills/getff/references/,scripts/render-face-facts.mjs,docs/site/face-facts.json${TAB}npx tsx scripts/render-face-facts.mjs --check" \
    "2${TAB}terms-style-check${TAB}docs/site/terms.md,docs/site-quality/vale/styles/getff/,scripts/render-terms-style.mjs${TAB}node scripts/render-terms-style.mjs --check" \
    "2${TAB}docs-quality-strict${TAB}docs/site/,docs/site-quality/,.claude/skills/docs-author/,agents/docs-form-auditor.md,scripts/docs-check.mjs,tests/docs-check/${TAB}if command -v vale >/dev/null 2>&1 && command -v lychee >/dev/null 2>&1; then node scripts/docs-check.mjs --strict && node scripts/docs-check.mjs --strict --profile prose; else echo '[sweep] WARN-skip docs-quality-strict: vale/lychee absent on host (CI installs them version+sha256-pinned)'; fi" \
    "2${TAB}script-selftests${TAB}scripts/${TAB}ts=\$(grep -oE 'scripts/([a-zA-Z0-9._-]+/)*[a-zA-Z0-9._-]+\\.test\\.sh' .github/workflows/audit-self.yml | sort -u); [ -n \"\$ts\" ] || { echo 'no scripts/*.test.sh steps found in audit-self.yml — derivation broke'; exit 1; }; for t in \$ts; do bash \"\$t\" || exit 1; done" \
    "3${TAB}citation-fullsweep${TAB}ALWAYS${TAB}node scripts/check-line-citations.mjs --check --corpus" \
    "3${TAB}typecheck${TAB}packages/${TAB}npm run typecheck" \
    "3${TAB}shipped-rules-drift${TAB}packages/${TAB}bash scripts/build-shipped-eslint-rules.sh --check" \
    "3${TAB}getff-dist-manifest${TAB}$(getff_payload_trigger)${TAB}bash scripts/build-getff-dist.sh --check" \
    "3${TAB}shellcheck${TAB}setup.d/,install.sh,scripts/${TAB}{ command -v shellcheck >/dev/null 2>&1 && shellcheck -x -P SCRIPTDIR --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh scripts/*.sh scripts/lib/*.sh; } || echo '[sweep] WARN-skip shellcheck absent'" \
    "4${TAB}byte-identical${TAB}SHIPPED${TAB}SNAPSHOT_MODE=compare bash tests/install-sh/byte-identical.test.sh" \
    "4${TAB}synth-bundle-drift${TAB}packages/core/,package.json,package-lock.json${TAB}NODE_ENV=development bash scripts/build-synth-bundle.sh --check" \
    "5${TAB}install-sh-suite${TAB}tests/install-sh/${TAB}bash scripts/run-install-sh-suite.sh tests/install-sh/" \
    "5${TAB}agnosticism${TAB}packages/core/${TAB}bash tests/agnosticism/harness-self.test.sh" \
    "5${TAB}premerge-carrier-selftest${TAB}packages/core/audit-self/${TAB}bash packages/core/audit-self/pre-merge-local.test.sh" \
    "5${TAB}mutation-runner-selftest${TAB}packages/core/synthesizer/${TAB}bash packages/core/synthesizer/run-generated-rule-mutation.test.sh && bash packages/core/synthesizer/run-rule-tests-firing.test.sh" \
    "5${TAB}hook-tests${TAB}packages/core/hooks/,tests/hooks/,.husky/${TAB}for t in tests/hooks/*.test.sh; do bash \"\$t\" || exit 1; done" \
    "5${TAB}dispatcher-tests${TAB}.claude/skills/dispatcher/,tests/dispatcher/${TAB}for t in tests/dispatcher/*.test.sh; do bash \"\$t\" || exit 1; done" \
    "5${TAB}measure-scripts${TAB}scripts/measure/${TAB}bash scripts/measure/measure.test.sh" \
    "5${TAB}plugin-aifdoctor-selftests${TAB}scripts/generate-plugin-twins.sh,agents/,.claude/hooks/,plugin/,tests/plugin/,tests/aif-doctor/,scripts/aif-doctor${TAB}ts=\$(grep -vE '^[[:space:]]*#' .github/workflows/audit-self.yml | grep -oE '(tests/plugin|tests/aif-doctor)/[a-zA-Z0-9._-]+\\.test\\.sh' | sort -u); [ -n \"\$ts\" ] || { echo 'no tests/plugin or tests/aif-doctor steps found in audit-self.yml — derivation broke'; exit 1; }; for t in \$ts; do bash \"\$t\" || exit 1; done" \
    "6${TAB}vitest-principles${TAB}packages/core/${TAB}npm --prefix packages/core run test:principles" \
    "6${TAB}vitest-hooks${TAB}packages/core/${TAB}npm --prefix packages/core run test:hooks" \
    "6${TAB}vitest-render${TAB}packages/core/${TAB}npm --prefix packages/core run test:render" \
    "6${TAB}vitest-ir${TAB}packages/core/${TAB}npm --prefix packages/core run test:ir" \
    "6${TAB}vitest-composition${TAB}packages/core/${TAB}npm --prefix packages/core run test:composition" \
    "6${TAB}vitest-backends${TAB}packages/core/${TAB}if toolchain_pins_ok; then npm --prefix packages/core run test:backends; else echo '[sweep] WARN-skip vitest-backends: host toolchain != CI pins'; fi" \
    "6${TAB}vitest-synthesizer${TAB}packages/core/${TAB}if toolchain_pins_ok; then npm --prefix packages/core run test:synthesizer; else echo '[sweep] WARN-skip vitest-synthesizer: host toolchain != CI pins'; fi" \
    "6${TAB}vitest-units${TAB}packages/core/${TAB}npm --prefix packages/core run test:units" \
    "6${TAB}vitest-skills${TAB}packages/core/${TAB}npm --prefix packages/core run test:skills" \
    "6${TAB}vitest-spec-validation${TAB}packages/core/${TAB}{ command -v gh >/dev/null 2>&1 && npm --prefix packages/core run test:spec-validation; } || echo '[sweep] WARN-skip vitest-spec-validation: gh absent (suite resolves action SHAs via the GitHub API)'" \
    "6${TAB}vitest-install-wire${TAB}packages/core/${TAB}npx --prefix packages/core vitest run --reporter=default packages/core/install/wire-live-snippet.test.ts packages/core/install/wire-synth-rules.test.ts" \
    "6${TAB}audit-ai-docs${TAB}packages/core/,docs/,skills/,agents/${TAB}npx --prefix packages/core vitest run --reporter=default packages/core/audit-self/audit-ai-docs.test.ts" \
    "6${TAB}canonical-regen${TAB}packages/${TAB}npm --prefix packages/core test --silent -- tests/acceptance/canonical-regen" \
    "6${TAB}first-steps-parity${TAB}packages/core/templates/shared/,packages/core/audit-self/${TAB}npx --prefix packages/core vitest run --reporter=default packages/core/audit-self/first-steps-parity.test.ts" \
    "6${TAB}template-render${TAB}packages/core/,install.sh,skills/${TAB}npm --prefix packages/core run test:template-render"
}

# `--list-gates` prints the table and exits. It exists so scripts/run-local-ci-sweep-coverage.test.sh
# reads the REAL gate_table() through the REAL argument parser, instead of scraping this file's
# printf block with a regex — a scrape is itself a second copy that drifts from what runs.
if [ "$LIST_GATES" -eq 1 ]; then gate_table; exit 0; fi

# --- toolchain_pins_ok ---
# rc 0 when every pinned toolchain binary that is PRESENT on PATH matches the version
# .github/workflows/audit-self.yml installs for it. An ABSENT binary is fine: the suites carry
# their own `it.skipIf(deriveToolVersion(...) === undefined)` and loud-skip. A PRESENT-but-
# DIFFERENT one is the problem — the capability-matrix toolchain-freshness gates assert the
# committed evidence version equals the version that actually resolves, so a host carrying
# ast-grep 0.45 reds locally while CI (pinned install step) stays green. That is a false red of
# exactly the class the `mechanical` scanners are excluded for, so the two toolchain-dependent
# vitest rows WARN-skip on a mismatch instead of failing the sweep.
#
# The pins are read OUT of the workflow, never restated here: a pin bump in audit-self.yml moves
# this guard with it, and a restated literal would be the drift this repo exists to prevent.
# shellcheck disable=SC2329  # invoked indirectly, from the gate-table rows via eval
toolchain_pins_ok() {
  local wf=".github/workflows/audit-self.yml" rc=0 pin live
  [ -f "$wf" ] || return 0

  pin="$(grep -oE '@ast-grep/cli@[0-9][0-9.]*' "$wf" | head -1 | sed 's/.*@//')"
  live="$(ast-grep --version 2>/dev/null | awk '{print $2}')"
  if [ -n "$live" ] && [ -n "$pin" ] && [ "$live" != "$pin" ]; then
    echo "[sweep] toolchain mismatch: ast-grep $live != audit-self.yml pin $pin"; rc=1
  fi

  pin="$(grep -oE 'ruff==[0-9][0-9.]*' "$wf" | head -1 | sed 's/.*==//')"
  live="$(ruff --version 2>/dev/null | awk '{print $2}')"
  if [ -n "$live" ] && [ -n "$pin" ] && [ "$live" != "$pin" ]; then
    echo "[sweep] toolchain mismatch: ruff $live != audit-self.yml pin $pin"; rc=1
  fi

  pin="$(grep -oE 'rustup toolchain install [0-9][0-9.]*' "$wf" | head -1 | awk '{print $4}')"
  live="$(rustc --version 2>/dev/null | awk '{print $2}')"
  if [ -n "$live" ] && [ -n "$pin" ] && [ "$live" != "$pin" ]; then
    echo "[sweep] toolchain mismatch: rustc $live != audit-self.yml pin $pin"; rc=1
  fi

  return "$rc"
}

# --- changed paths (vs merge-base) ---
changed_paths() {
  # shellcheck disable=SC2086  # SWEEP_DIFF_OVERRIDE is a deliberate word-split list of paths
  if [ -n "${SWEEP_DIFF_OVERRIDE:-}" ]; then printf '%s\n' $SWEEP_DIFF_OVERRIDE; return; fi
  local base="${BASE_REF:-$(git merge-base origin/staging HEAD 2>/dev/null || echo HEAD~1)}"
  git diff --name-only "${base}...HEAD"
}

# --- working-tree changes the committed diff above cannot see ---
# Raw `git status --porcelain` lines, status letters kept: `M` vs `??` is the operator's first
# question when the refusal below fires, and re-deriving it costs a second command. Gitignored
# files are absent by construction (no `--ignored`), which is right — CI never sees them either.
# Outside a repo (or with git absent) this yields nothing and the refusal cannot fire; the
# sweep degrades to its previous behaviour rather than blocking on a condition it cannot read.
dirty_paths() {
  git status --porcelain 2>/dev/null
}

# --- trigger_matches <trigger-list> <path> ---
# trigger-list is one or more triggers joined by commas; matches if ANY matches.
# Each trigger: ALWAYS | SHIPPED | a prefix (ends with /) | a suffix (starts with .) | a literal.
trigger_matches() {
  local triglist="$1" p="$2" trig
  local IFS=,
  for trig in $triglist; do
    case "$trig" in
      ALWAYS) return 0 ;;
      SHIPPED)
        case "$p" in
          skills/* | agents/* | packages/core/templates/* | packages/preset-*/* | .claude/rules/* | .claude/skills/*) return 0 ;;
        esac ;;
      */) case "$p" in "$trig"*) return 0 ;; esac ;;   # prefix (before suffix: .github/workflows/ is both .*-prefixed and /-suffixed)
      .*) case "$p" in *"$trig") return 0 ;; esac ;;   # suffix
      *) case "$p" in "$trig") return 0 ;; esac ;;       # literal/glob
    esac
  done
  return 1
}

CHANGED="$(changed_paths)"

# --- fail-safe: any changed path matching NO gate trigger → escalate to --full ---
# An ALWAYS row is deliberately NOT counted as coverage for a path. ALWAYS means
# "unconditional", not "matches every path": counting it would make every path look mapped and
# silently retire this whole fail-safe the moment the first ALWAYS row landed. Measured
# 2026-09-14 while adding `citation-fullsweep`: with the ALWAYS row counted,
# SWEEP_DIFF_OVERRIDE=weird/unmapped.bin went from "escalating to --full" (every gate) to
# "1 gate(s) passed" — a false green of exactly the shape this script exists to prevent.
if [ "$MODE" = "diff" ] && [ -n "$CHANGED" ]; then
  GATES_SNAPSHOT="$(gate_table)"
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    matched=0
    while IFS="$TAB" read -r _ n trig _; do
      [ -z "${n:-}" ] && continue
      case ",$trig," in *,ALWAYS,*) continue ;; esac
      if trigger_matches "$trig" "$p"; then matched=1; break; fi
    done <<EOF
$GATES_SNAPSHOT
EOF
    if [ "$matched" -eq 0 ]; then
      echo "[sweep] unmapped path '$p' → escalating to --full"
      MODE="full"
      break
    fi
  done <<EOF
$CHANGED
EOF
fi

# --- gate_selected <trigger> ---
# Sets GATE_SELECTED_BY on every match: "diff" when a CHANGED PATH matched the trigger,
# "always" for an ALWAYS row, "full" in --full mode. The dirty-tree refusal at the tail keys
# on the "diff" count, never on the raw run count: an ALWAYS row runs whatever the diff says,
# so counting it as coverage would silently retire that refusal the moment the first ALWAYS
# row landed. Measured 2026-09-14 on the merge that first put the two together — this file's
# own `citation-fullsweep` row (#1772) against the refusal (#1780): `ran` was never 0 again,
# and the refusal's two mechanism arms went red. Same shape as the coverage exclusion above.
GATE_SELECTED_BY=""
gate_selected() {
  GATE_SELECTED_BY=""
  [ "$MODE" = "full" ] && { GATE_SELECTED_BY="full"; return 0; }
  local trig="$1" p
  # ALWAYS means always — including an EMPTY diff. The loop below is driven by $CHANGED, so
  # without this short-circuit an ALWAYS row selects nothing when the diff is empty and the
  # sweep prints "no gates selected" — the `#hope-as-gate` shape
  # (.claude/rules/attention-is-not-a-mechanism.md §2). Observed 2026-09-14 on the first run
  # of the `citation-fullsweep` row, against a tree whose changes were all uncommitted.
  case ",$trig," in *,ALWAYS,*) GATE_SELECTED_BY="always"; return 0 ;; esac
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    if trigger_matches "$trig" "$p"; then GATE_SELECTED_BY="diff"; return 0; fi
  done <<EOF
$CHANGED
EOF
  return 1
}

# --- run selected gates, cheapest-first, fail-fast ---
# eval runs in a SUBSHELL: a gate command carrying its own `exit 1` (install-sh-suite's
# per-test loop) must fail THAT gate, not kill the sweep mid-loop. Without the subshell the
# sweep self-truncated: rc=1 with no `[sweep] FAIL` / `SWEEP: stopped at` lines and the
# rank-6 gates silently never ran (handoff item 3, 2026-07-25).
#
# `</dev/null` is the second half of the same defence, and it is load-bearing. The loop is
# driven by a heredoc on STDIN, and the gate subshell inherits that STDIN — so any gate whose
# command reads stdin EATS the remaining gate lines. The sweep then prints a plausible
# all-PASS tail and exits 0 having silently skipped every gate below it. Observed 2026-08-09
# the moment the tests/hooks/*.test.sh battery was added: `--full` reported "16 gate(s)
# passed" while install-sh-suite and all eleven rank-6 gates never ran (the pre-push
# stdin-detection tests feed the hook on stdin). A truncated sweep that exits 0 is worse than
# no sweep — it is the exact false-green this script exists to prevent.
# Created lazily, on the first gate that actually runs: `--list-gates` and a diff that selects
# nothing must not litter a directory. A location that cannot be created degrades to "no log
# files" — the FAIL tail below still prints, so a read-only TMPDIR loses the archive, never the
# diagnostic itself.
LOG_DIR_FAILED=0
ensure_log_dir() {
  if [ "$LOG_DIR_READY" -eq 1 ] || [ "$LOG_DIR_FAILED" -eq 1 ]; then
    return "$LOG_DIR_FAILED"
  fi
  if [ -n "$SWEEP_LOG_DIR" ]; then
    if ! mkdir -p "$SWEEP_LOG_DIR" 2>/dev/null; then LOG_DIR_FAILED=1; return 1; fi
  else
    SWEEP_LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/run-local-ci-sweep.XXXXXX" 2>/dev/null)" || SWEEP_LOG_DIR=""
    if [ -z "$SWEEP_LOG_DIR" ]; then LOG_DIR_FAILED=1; return 1; fi
  fi
  LOG_DIR_READY=1
  return 0
}

# ── fd 3: the live progress channel ────────────────────────────────────────────────────────────
# Gate output is CAPTURED (see the eval line below), so a long-running gate is silent for its whole
# duration: while `install-sh-suite` ran its 114-file battery the sweep printed nothing for ~30
# minutes and a working run was indistinguishable from a hung one — proving liveness meant walking
# the process tree with `pgrep -P` by hand, three times in one session on 2026-09-14. A mechanism
# whose state is recovered by human attention is the shape
# .claude/rules/attention-is-not-a-mechanism.md §1 forbids.
#
# fd 3 is the escape hatch: it is NOT touched by the `2>&1` capture, so anything a gate writes
# there reaches the operator live. Gates that emit progress must write to fd 3 and must tolerate
# it being closed (they run standalone in CI too) — see scripts/run-install-sh-suite.sh
# `progress()`. Nothing is FORCED onto fd 3: a gate that ignores it behaves exactly as before.
exec 3>&2

ran=0
diff_selected=0
SORTED="$(gate_table | sort -t"$TAB" -k1,1n)"
while IFS="$TAB" read -r _ name trigger cmd; do
  [ -z "${name:-}" ] && continue
  gate_selected "$trigger" || continue
  ran=$((ran + 1))
  [ "$GATE_SELECTED_BY" = "diff" ] && diff_selected=$((diff_selected + 1))
  # Output is CAPTURED, not discarded, for two reasons. (1) Several rows degrade to a WARN-skip
  # instead of failing (actionlint/shellcheck absent, host toolchain != CI pins, the CI-only
  # markdown scanners). Piping their stdout to /dev/null made every one of those print a plain
  # `PASS`, indistinguishable from a real run — a warning whose only consumer is a log nobody
  # can read (.claude/rules/attention-is-not-a-mechanism.md §2 `#warning-nobody-reads`). A
  # degraded gate now says so on its own line; rc is unchanged either way.
  # (2) The captured text is then WRITTEN OUT, pass or fail. It used to be read for the WARN
  # classification and then dropped on the floor — so a FAIL printed a bare gate name and the
  # evidence was gone, which is the same `#warning-nobody-reads` shape one branch lower: the
  # only consumer of a failing gate's output was a variable nobody could read.
  out="$( (eval "$cmd") 2>&1 </dev/null )"; rc=$?
  log_path=""
  if ensure_log_dir; then
    # Gate names come from gate_table()/$SWEEP_GATES_FILE, not from user input, but sanitise
    # anyway: one `/` in a name would otherwise write outside the log dir (or just fail).
    safe_name="${name//[^A-Za-z0-9._-]/_}"
    log_path="$SWEEP_LOG_DIR/$(printf '%02d' "$ran")-${safe_name}.log"
    printf '%s\n' "$out" >"$log_path" 2>/dev/null || log_path=""
  fi
  if [ "$rc" -eq 0 ]; then
    case "$out" in
      # `[sweep] WARN`-prefixed only: every degrade row in the table emits that exact prefix,
      # while several install-sh tests legitimately print bare "WARN" during a real run
      # (nvmrc-ci-drift, r2-glob-reach) — matching those would mislabel a genuine pass.
      *'[sweep] WARN'*) echo "[sweep] WARN-SKIP $name — degraded, NOT a real run" ;;
      *) echo "[sweep] PASS $name" ;;
    esac
  else
    if [ -n "$log_path" ]; then
      echo "[sweep] FAIL $name — output: $log_path"
    else
      echo "[sweep] FAIL $name — output: (log dir unavailable, tail below only)"
    fi
    # The path alone would still make the operator run a second command to see anything, and in
    # a remote/agent session the file may not be reachable at all. Print a bounded tail so the
    # common case needs no follow-up; the file holds the untruncated text.
    echo "----- $name: last 40 lines of output -----"
    printf '%s\n' "$out" | tail -40
    echo "----- end $name output -----"
    echo "SWEEP: stopped at $name (mode=$MODE)"
    [ -n "$log_path" ] && echo "SWEEP: gate logs in $SWEEP_LOG_DIR"
    exit 1
  fi
done <<EOF
$SORTED
EOF

if [ "$diff_selected" -eq 0 ] && [ "$MODE" != "full" ]; then
  # No gate was selected BY THE DIFF. `changed_paths` reads the COMMITTED diff, so this is an honest answer only
  # when the working tree is also clean. On a dirty tree it is the false-green this script's
  # `</dev/null` note above already names as worse than no sweep: an operator who runs the sweep
  # mid-work to check their edits gets rc 0 about changes no gate ever looked at. Measured
  # 2026-09-14 (worktree cool-swanson-d3f4b6): two modified-but-uncommitted files produced
  # exactly `SWEEP: no gates selected for this diff (mode=diff)` and EXIT=0.
  #
  # The refusal is the EXIT CODE, not this text — a warning line whose only consumer is someone
  # reading the log is `#warning-nobody-reads`
  # (.claude/rules/attention-is-not-a-mechanism.md §2), which is what the defect already was.
  #
  # Scoped to the zero-gates case deliberately. Refusing on ANY dirty tree would break the
  # script's own stated purpose (line 2: harvest pre-push): .claude/skills/harvest/SKILL.md §1
  # harvests a COMMITTED branch out of a deliberately polluted worktree, and the harvest base
  # clone measured 12 dirty entries (5 tracked-modified) on 2026-09-14. A harvested branch is
  # ≥1 commit ahead by construction, so its committed diff always selects a gate and this
  # branch is unreachable there — pinned by the third new arm in run-local-ci-sweep.test.sh.
  DIRTY="$(dirty_paths)"
  if [ -n "$DIRTY" ]; then
    echo "[sweep] FAIL dirty-tree-zero-gates — the committed diff selected no gates, and these"
    echo "        working-tree changes were examined by nothing:"
    printf '%s\n' "$DIRTY" | sed 's/^/          /'
    echo "SWEEP: REFUSED (mode=$MODE) — the sweep gates COMMITTED work; commit the paths above"
    echo "SWEEP: and re-run, or pass --base <ref> to scope it against a different committed base"
    exit 3
  fi
fi
if [ "$ran" -eq 0 ]; then
  echo "SWEEP: no gates selected for this diff (mode=$MODE)"
else
  echo "SWEEP: $ran gate(s) passed (mode=$MODE)"
  [ "$LOG_DIR_READY" -eq 1 ] && echo "SWEEP: gate logs in $SWEEP_LOG_DIR"
fi
exit 0
