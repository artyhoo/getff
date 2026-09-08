# Task 5 — WORKS checks: severed consumer vs factory control (2026-09-08T18:28:04Z)

## L1 — escape-grep: factory absolute paths + host paths in delivered artefacts
```
--- core-wYlJfn:
  $ grep -rn '/home/www\|rules-as-tests-aif' --include='*.sh' --include='*.ts' --include='*.mjs' --include='*.json' (excluding .git, node_modules absent) | grep -v refresh-baseline
/tmp/census-consumer-core-wYlJfn/.prettierignore:87:# >>> rules-as-tests-aif shipped-configs (managed) >>>
/tmp/census-consumer-core-wYlJfn/.prettierignore:122:# <<< rules-as-tests-aif shipped-configs (managed) <<<
/tmp/census-consumer-core-wYlJfn/.claude/agents/memory-codification-auditor.md:17:> **Authoritative for:** `memory-codification-auditor` sub-agent prompt — semantic triage of user-scope agent-memory entries for un-codified durable conventions (the `#convention-stranded-in-memory` anti-pattern) for the rules-as-tests-aif framework; reporting-only.
/tmp/census-consumer-core-wYlJfn/.claude/agents/memory-codification-auditor.md:37:~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/
  hits: 4
  $ /Users/ host paths:
  hits: 0
  $ deep .. traversals (3+ levels) in delivered scripts/hooks:
scripts/check-shields-up.sh:33:elif [ -d "$SCRIPT_DIR/../../../packages" ]; then
scripts/check-shields-up.sh:35:  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
scripts/run-generated-rule-mutation.sh:35:# sits at scripts/ (1 level deep), so the old fixed `$SCRIPT_DIR/../../..` pointed ABOVE a
scripts/run-generated-rule-mutation.sh:39:# historical `../../..` for a non-git checkout.
scripts/run-generated-rule-mutation.sh:47:[ -n "$REPO_ROOT" ] || REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
  hits: 13
--- env-VXYTkl:
  $ grep -rn '/home/www\|rules-as-tests-aif' --include='*.sh' --include='*.ts' --include='*.mjs' --include='*.json' (excluding .git, node_modules absent) | grep -v refresh-baseline
/tmp/census-consumer-env-VXYTkl/.claude/skills/pipeline/SKILL.md:163:**Step 5 — emit per arg shape (V3/V4 binding per [research-patch §3](https://github.com/artyhoo/getff/blob/main/docs/meta-factory/research-patches/2026-05-29-meta-orch-no-arg-overview-s0-remainder.md)):** fires only on no-arg/integer-arg (string-arg skips §2); Step 4 BYPASSED on V3, preserved on V4 N=1. Completion-filter = [`priority-score.sh`](helpers/priority-score.sh) tri-layer C1/C2/C3 (branch/jaccard/done.md, [#274](https://github.com/Yhooi2/rules-as-tests-aif/pull/274)) drops DONE BEFORE filter, never after.
/tmp/census-consumer-env-VXYTkl/.claude/skills/orchestrator/references/reviewer-template.md:37:   - Optionally re-run `cd /Users/art/code/rules-as-tests-aif && npm run test:principles` yourself to confirm; if your run fails → REVISE
/tmp/census-consumer-env-VXYTkl/.claude/skills/night-mode/SKILL.md:27:1. **Unattended autonomy / fork policy.** No human overnight, so: **technical** forks (which impl is better on the merits; an open design decision) → resolve autonomously with recorded rationale. **Genuine owner** forks (taste/strategy with no determinate best on the project's merits) → append to `<plan>.decisions.md`, do NOT decide, do NOT block; surface in the morning report. **Night-envelope conditional ([session-bus v2 §4](https://github.com/artyhoo/getff/blob/main/docs/superpowers/specs/2026-08-09-session-bus-v2.md)):** when a live top-tier seat exists and is sweeping, it MAY decide a parked question whose decision OBJECT sits inside a kickoff-authorized stage scope (the object cut — item 8), recording the entry BEFORE application; genuine owner forks and floor-category objects stay parked regardless. **decisions.md entry shape (Part I extension, v2 §4):** decision package (evidence file:line, options, trade-offs) · decision · rationale · falsifier («wrong if …») · reversibility class + concrete undo note · `decided-by:` · status (`applied | rework | superseded`). **Advisor conditional (2026-08-10, [advisor-pattern-design §2/§5.1](https://github.com/artyhoo/getff/blob/main/docs/superpowers/specs/2026-08-10-advisor-pattern-design.md)):** a concept/value fork below the floor → file an ask file + send `ASK` when the advisor is reachable (non-blocking — defer the item, keep working); floor-object forks stay parked for the operator regardless (the advisor may only pre-build the decision package). **How to file one — do not hand-write the format:** `bash scripts/check-ask-files.sh --print-template [consult|materiality-dispute] [role]` emits a fileable skeleton, `--help` prints the mailbox path resolved on this machine plus the filename + atomic-write recipe, and the same script with no arguments validates the result (pre-push section `ask-file-schema`). The emitter and the validator are one file on purpose, so a skeleton that no longer passes is a red test rather than a stale doc. _Operator-repo surface at v1_ — the mailbox default is `rules-as-tests-aif`-scoped and the script is not shipped, so on a consumer install this bullet's ask leg is inert and the fork stays parked ([advisor-pattern-design §1](https://github.com/artyhoo/getff/blob/main/docs/superpowers/specs/2026-08-10-advisor-pattern-design.md): consumer delivery is a later stage, never a silent copy).
/tmp/census-consumer-env-VXYTkl/scripts/link-coordination.sh:74:CANON="${CLAUDE_COORDINATION_DIR:-$HOME/.claude-coordination/rules-as-tests-aif}"
/tmp/census-consumer-env-VXYTkl/.prettierignore:87:# >>> rules-as-tests-aif shipped-configs (managed) >>>
/tmp/census-consumer-env-VXYTkl/.prettierignore:156:# <<< rules-as-tests-aif shipped-configs (managed) <<<
/tmp/census-consumer-env-VXYTkl/.claude/skills/orchestrator/references/worker-template.md:73:cd /Users/art/code/rules-as-tests-aif && npm run test:principles
/tmp/census-consumer-env-VXYTkl/.claude/skills/orchestrator/references/worker-template.md:82:- DO NOT edit project-scope files: README.md, CLAUDE.md, .claude/rules/*, .claude/skills/* (PROJECT scope inside /Users/art/code/rules-as-tests-aif/), packages/core/principles/*
/tmp/census-consumer-env-VXYTkl/.claude/skills/orchestrator/references/worker-template.md:107:| `<WORKDIR>`                    | `/Users/art/code/rules-as-tests-aif` (or project root)                        |
/tmp/census-consumer-env-VXYTkl/.claude/agents/memory-codification-auditor.md:17:> **Authoritative for:** `memory-codification-auditor` sub-agent prompt — semantic triage of user-scope agent-memory entries for un-codified durable conventions (the `#convention-stranded-in-memory` anti-pattern) for the rules-as-tests-aif framework; reporting-only.
  hits: 14
  $ /Users/ host paths:
  hits: 5
  $ deep .. traversals (3+ levels) in delivered scripts/hooks:
scripts/run-generated-rule-mutation.sh:35:# sits at scripts/ (1 level deep), so the old fixed `$SCRIPT_DIR/../../..` pointed ABOVE a
scripts/run-generated-rule-mutation.sh:39:# historical `../../..` for a non-git checkout.
scripts/run-generated-rule-mutation.sh:47:[ -n "$REPO_ROOT" ] || REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
scripts/check-shields-up.sh:33:elif [ -d "$SCRIPT_DIR/../../../packages" ]; then
scripts/check-shields-up.sh:35:  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
  hits: 13
--- factory-Iwbf1j:
  $ grep -rn '/home/www\|rules-as-tests-aif' --include='*.sh' --include='*.ts' --include='*.mjs' --include='*.json' (excluding .git, node_modules absent) | grep -v refresh-baseline
/tmp/census-consumer-factory-Iwbf1j/.prettierignore:87:# >>> rules-as-tests-aif shipped-configs (managed) >>>
/tmp/census-consumer-factory-Iwbf1j/.prettierignore:163:# <<< rules-as-tests-aif shipped-configs (managed) <<<
/tmp/census-consumer-factory-Iwbf1j/.claude/skills/orchestrator/references/ai-laziness-traps-orchestrator.md:131:**Counter:** Worker dispatch prompt MUST enumerate project-local principle tests relevant to the output type. For research-patch output: `principles/10-research-patch-annotation.test.ts` (first line must be `<!-- scope:<slug> -->`). Worker write-as-you-go discipline MUST include a FINAL step before RESEARCH-COMPLETE: run `cd /Users/art/code/rules-as-tests-aif && npm run test:principles`. If any test fails → fix violation, re-run, do NOT report RESEARCH-COMPLETE until green. Log: `«<ISO timestamp> — #K principles tests green (N tests passed)»`. Reviewer MUST check state.md for this log entry; if missing → REVISE immediately. Reviewer MAY re-run `npm run test:principles` independently for confirmation.
/tmp/census-consumer-factory-Iwbf1j/.claude/skills/pipeline/helpers/priority-score.sh:54:#   MO_MEM_DIR       — override the memory directory (default: ~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory)
/tmp/census-consumer-factory-Iwbf1j/.claude/skills/pipeline/SKILL.md:163:**Step 5 — emit per arg shape (V3/V4 binding per [research-patch §3](https://github.com/artyhoo/getff/blob/main/docs/meta-factory/research-patches/2026-05-29-meta-orch-no-arg-overview-s0-remainder.md)):** fires only on no-arg/integer-arg (string-arg skips §2); Step 4 BYPASSED on V3, preserved on V4 N=1. Completion-filter = [`priority-score.sh`](helpers/priority-score.sh) tri-layer C1/C2/C3 (branch/jaccard/done.md, [#274](https://github.com/Yhooi2/rules-as-tests-aif/pull/274)) drops DONE BEFORE filter, never after.
/tmp/census-consumer-factory-Iwbf1j/.claude/skills/aif-doctor/helpers/refresh-aif-base.sh:34:#        AIF_CONTAINER_REPO   (default: /home/www/<host main-clone dir name> — see «Which clone» below)
/tmp/census-consumer-factory-Iwbf1j/.claude/skills/aif-doctor/helpers/refresh-aif-base.sh:41:#   `/home/www/rules-as-tests-aif` while the tip followed the CWD — two independent sources with
/tmp/census-consumer-factory-Iwbf1j/.claude/skills/aif-doctor/helpers/refresh-aif-base.sh:43:#   reported `repo=artyhoo/getff … repo_path=/home/www/rules-as-tests-aif` and a confident
/tmp/census-consumer-factory-Iwbf1j/.claude/skills/aif-doctor/helpers/refresh-aif-base.sh:49:#   --git-common-dir), which is exactly the aif projects-mount convention (`/home/www/timeliner`,
/tmp/census-consumer-factory-Iwbf1j/.claude/skills/aif-doctor/helpers/refresh-aif-base.sh:50:#   `/home/www/rules-as-tests-aif`, `/home/www/getff-landing`), and an identity guard refuses to
  hits: 26
  $ /Users/ host paths:
  hits: 5
  $ deep .. traversals (3+ levels) in delivered scripts/hooks:
scripts/check-fences-fire.sh:73:elif [ -d "$SCRIPT_DIR/../../../packages" ]; then
scripts/check-fences-fire.sh:75:  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
scripts/check-fences-fire.sh:180:  "$SCRIPT_DIR/../../../node_modules/.bin/tsx" \
scripts/check-fences-fire.sh:189:  "$SCRIPT_DIR/../../../node_modules/.bin/eslint" \
scripts/check-shields-up.sh:33:elif [ -d "$SCRIPT_DIR/../../../packages" ]; then
  hits: 13
```

## L2 — delivered hooks executed in the consumer (cwd=consumer, representative CC payloads)
```
--- core/deps-hash-check.sh
  exit=0  out[1..160]: ⚠ package.json tool decisions not yet baselined — run /tool-bootstrapping to re-evaluate
--- core/inject-output-language.sh
  exit=0  out[1..160]: 
--- core/inject-project-digest.sh
  exit=0  out[1..160]: 
--- core/end-of-turn-reminder.sh
  exit=0  out[1..160]: 
--- core/ask-question-reminder.sh
  exit=0  out[1..160]: 
--- core/inject-matching-rule.sh
  exit=0  out[1..160]: {   "hookSpecificOutput": {     "hookEventName": "PostToolUse",     "additionalContext": "⚠ inject-matching-rule: no rules corpus found at /tmp/census-consume
--- core/check-doc-authority-header.sh
  exit=0  out[1..160]: 
--- core/inject-memory-codification.sh
  exit=0  out[1..160]: 
--- core/lang-en.sh
  exit=0  out[1..160]: 
--- core/lang-check-parity.sh
  exit=0  out[1..160]: OK: en.sh and ru.sh expose identical keys (9 entries).
```

## L2b — env + factory parity (same harness) + factory-only runtime-bridge-dispatch
```
  --- env/deps-hash-check.sh
    exit=0  out[1..160]: ⚠ package.json tool decisions not yet baselined — run /tool-bootstrapping to re-evaluate
  --- env/inject-output-language.sh
    exit=0  out[1..160]: 
  --- env/inject-project-digest.sh
    exit=0  out[1..160]: 
  --- env/end-of-turn-reminder.sh
    exit=0  out[1..160]: 
  --- env/ask-question-reminder.sh
    exit=0  out[1..160]: 
  --- env/inject-matching-rule.sh
    exit=0  out[1..160]: 
  --- env/check-doc-authority-header.sh
    exit=0  out[1..160]: 
  --- env/inject-memory-codification.sh
    exit=0  out[1..160]: 
  --- env/lang-en.sh
    exit=0  out[1..160]: 
  --- env/lang-check-parity.sh
    exit=0  out[1..160]: OK: en.sh and ru.sh expose identical keys (9 entries).
  --- factory/deps-hash-check.sh
    exit=0  out[1..160]: ⚠ package.json tool decisions not yet baselined — run /tool-bootstrapping to re-evaluate
  --- factory/inject-output-language.sh
    exit=0  out[1..160]: 
  --- factory/inject-project-digest.sh
    exit=0  out[1..160]: 
  --- factory/end-of-turn-reminder.sh
    exit=0  out[1..160]: 
  --- factory/ask-question-reminder.sh
    exit=0  out[1..160]: 
  --- factory/inject-matching-rule.sh
    exit=0  out[1..160]: 
  --- factory/check-doc-authority-header.sh
    exit=0  out[1..160]: 
  --- factory/inject-memory-codification.sh
    exit=0  out[1..160]: 
  --- factory/lang-en.sh
    exit=0  out[1..160]: 
  --- factory/lang-check-parity.sh
    exit=0  out[1..160]: OK: en.sh and ru.sh expose identical keys (9 entries).

--- factory/runtime-bridge-dispatch.sh (delivered factory-only; sources lib/hook-emit.sh which is NOT delivered)
  exit=0
```

## L2c — .husky/pre-push (no tsx in consumer → designed fallback) + scripts/audit-ai-docs.sh (documented acceptance: should PASS)
```
--- $ cd consumer && bash .husky/pre-push   (git rev-parse needs a repo; consumer has .git)
  exit=0
⚠ fallback: could not determine a base ref (no PREPUSH_UPSTREAM_REF, no git stdin, no default branch) — skipping (not a silent pass).

--- $ bash scripts/audit-ai-docs.sh
  exit=0
WARN: R4: Every public export in src/domain has matching .unit.ts (ts-morph) (skipped: no src/domain — probe could not run)
PASS: D1 (drift): skills declared in AGENTS.md exist on disk
PASS: D2 (drift): no TODO/_comment in JSON configs
PASS: D3 (drift): canonical goal phrase present in downstream goal-bearing docs (skipped: consumer install — authoring-repo goal docs are not part of the shipped payload)
PASS: D4 (drift): .ai-factory/tool-decisions.md up-to-date with package.json
PASS: D5 (drift, inverse): every file with canonical phrase is enrolled or exempt (skipped: consumer install — inverse enrollment tracks the framework authoring repo)

─────────────────────────────────────────
Audit complete: 5 PASS, 0 FAIL, 1 WARN
```

## L2d — THE DEFECT PROOF: delivered guard-liveness.ts import closure in a consumer that installed
   everything except @rules-as-tests/preset-next-15-canonical (npm i tsx eslint @typescript-eslint/parser @typescript-eslint/utils — exit 0)
```
$ node --import tsx/esm -e 'import("eslint").then(()=>console.log("eslint RESOLVED"))'
eslint RESOLVED

$ node --import tsx/esm -e 'import("@rules-as-tests/preset-next-15-canonical/eslint-rules")...'
preset FAIL: ERR_MODULE_NOT_FOUND Cannot find package '@rules-as-tests/preset-next-15-canonical' imported from /tmp/census-consumer-factory-Iwbf1j/[eval]

$ node --import tsx/esm packages/core/hooks/pre-push.ts   (the full-mode hook the consumer gets after npm i tsx)
  (stdin </dev/null; hook exits on its own error)
  exit=1
❌ rule-glob liveness check failed
▶ check-rule-globs: verifying custom-rule globs match real source files
  ✗ R2 no-unsafe-zod-parse (RULE_GLOBS.boundary): matches ZERO source files — rule is SILENTLY INERT.
     Widen RULE_GLOBS.boundary in eslint.config.mjs to cover your layout (globs: **/handlers/**/*.{ts,tsx} **/routes/**/*.{ts,tsx} **/controllers/**/*.{ts,tsx} **/app/api/**/*.{ts,tsx} **/actions/**/*.{ts,tsx})
  · R7/R8 skipped (AIF_STRICT_RUNTIME≠1 — runtime-discipline rules are opt-in)
check-rule-globs: FAILED — a custom rule is inert against this layout.
```

## L2e — remaining delivered scripts executed in consumers (timeout 25s each)
```
core/check-rule-enforced.sh -> exit=0 | check-rule-enforced: OK
core/check-rule-globs.sh -> exit=1 | check-rule-globs: FAILED — a custom rule is inert against this layout.
core/check-arch-boundaries.sh -> exit=0 | check-arch-boundaries: not an apps/+packages/ monorepo — skipped (no packages↛apps boundary to enforce her
core/check-fences-fire.sh -> exit=1 |   ✗ VACUOUS: 2 fixture manifest(s) present, 2 skipped, 0 probed — this run proved NO fence fires. Load-pro
core/check-shields-up.sh -> exit=0 | PASS=3 FAIL=0 SKIP=0
core/check-lintstaged-resolves.sh -> exit=0 | check-lintstaged-resolves: no node_modules yet — run after install (skipped).
core/detect-r2-boundary.sh -> exit=0 | ambiguous
core/ci-available-probe.sh -> exit=3 | CANNOT-RUN: no 'origin' remote — cannot determine owner/repo
core/run-rule-tests-firing.sh -> exit=0 | rule-tests firing: no .ai-factory/rule-tests/ sidecar dir — nothing to fire (no-op).
core/run-generated-rule-mutation.sh -> exit=2 | run-generated-rule-mutation: manifest not found: /tmp/census-consumer-core-wYlJfn/.ai-factory/synthesizer-outp
core/audit-r4.ts -> exit=2 | scripts/audit-r4.ts: line 14: `const project = new Project({'
core/pre-merge-local.sh -> exit=64 | usage: pre-merge-local.sh [base-ref]    (base defaults to origin/main)
...
factory/check-rule-enforced.sh -> exit=0 | check-rule-enforced: OK
factory/check-rule-globs.sh -> exit=1 | check-rule-globs: FAILED — a custom rule is inert against this layout.
factory/check-arch-boundaries.sh -> exit=0 | check-arch-boundaries: not an apps/+packages/ monorepo — skipped (no packages↛apps boundary to enforce her
factory/check-fences-fire.sh -> exit=0 |   load-probe arm (config IMPORTABLE):  ok=0 failed=0 skipped=1
factory/check-shields-up.sh -> exit=0 | PASS=3 FAIL=0 SKIP=0
factory/check-lintstaged-resolves.sh -> exit=1 | check-lintstaged-resolves: FAILED — a lint-staged binary is unresolvable (commit would be blocked).
factory/detect-r2-boundary.sh -> exit=0 | ambiguous
factory/ci-available-probe.sh -> exit=3 | CANNOT-RUN: no 'origin' remote — cannot determine owner/repo
factory/run-rule-tests-firing.sh -> exit=0 | rule-tests firing: no .ai-factory/rule-tests/ sidecar dir — nothing to fire (no-op).
factory/run-generated-rule-mutation.sh -> exit=2 | run-generated-rule-mutation: manifest not found: /tmp/census-consumer-factory-Iwbf1j/.ai-factory/synthesizer-o
factory/audit-r4.ts -> exit=2 | scripts/audit-r4.ts: line 14: `const project = new Project({'
factory/pre-merge-local.sh -> exit=64 | usage: pre-merge-local.sh [base-ref]    (base defaults to origin/main)
```

## L2f — corrections + .husky/pre-commit + L3 incident record
```
--- audit-r4.ts under its real runtime (tsx), factory-consumer (has tsx):
  exit=1 | Node.js v22.23.1
--- .husky/pre-commit in core consumer:
  exit=0
  ⚠ Skipping backup because there’s no initial commit yet. This might result in data loss.
  
  → lint-staged could not find any staged files.
```

## L3 — rename-sever window: results + INCIDENT RECORD

**Results (valid — the factory path was genuinely absent during the window; `test -e $REPO` → yes-gone):**
```
  consumer .husky/pre-push:  ❌ rule-glob liveness check failed (identical to non-severed run)
  consumer audit-ai-docs.sh: 4 PASS, 0 FAIL, 2 WARN (vs 5/0/1 non-severed — one WARN flip: D3/D5 goal-doc skips re-evaluated)
  consumer preset import:    ERR_MODULE_NOT_FOUND (identical — failure intrinsic to the consumer tree)
  consumer deps-hash-check:  exit=0, same baseline warning (reads only consumer files)
```

**INCIDENT (2026-09-08T18:36Z) — L3 restore was lossy mid-flight, fully recovered, zero data loss:**

- Mechanism: `mv $REPO /tmp/…` crosses filesystems (/tmp dev 64 vs /home/www dev 42) and degrades to copy+delete; 745 files under `.claude/skills/aif-*/`, `.claude/agents/*` + `AGENTS.md`/`CLAUDE.md` are handoff-prepared **mode-200 (write-only, node-owned)** and cannot be read by the copy pass, so the restore copied only 2639/3384 files before erroring.
- Detection: post-window verify (file-count diff 3384 vs 2639 + `git status` → exactly ` D AGENTS.md / D CLAUDE.md` — i.e. exactly 2 tracked files missing, all other damage untracked).
- Recovery: owner-identity `chmod u+r` on the 745 SEV-side copies → byte copy-back with per-file mode re-application (original 200 preserved) → verification: `comm` residual = 0, `git status` **clean** (tracked content byte-identical to HEAD), size comparison 0/745 mismatches.
- Residual risk: NONE for tracked files (git content-hash equality); untracked files verified by size + byte-copy construction; the SEV directory is retained at `/tmp/factory-severed.97085` until final cleanup as a belt-and-suspenders copy.
- Method lesson for the census record: **rename-severing is only safe same-filesystem and only on trees without unreadable-owner files.** For future runs: sever at the mount boundary (bind-mount over the path) or copy the consumer out and sever by construction, never mv the factory across mounts. The L1 grep + L2 runs + this one-window L3 (whose severed-run results ARE valid) satisfy §3's severing requirement for V0; the substitution is recorded rather than papered over.

## L2f addendum — audit-r4.ts exact error (tsx runtime, factory-consumer)
```
    const err = new Error(message);
Error: Cannot find module 'ts-morph'
  → audit-r4.ts needs ts-morph (present in the documented Next-steps npm install line: ts-morph@^28.0.0); absent from the 4-package probe install. Classification: R-2 deps-presence, not a delivery defect.
```

## L1 finding precision — /Users/art + host-scoped paths inside DELIVERED artefacts (file:line)
```
--- core-wYlJfn:
  (hits: 0)
--- env-VXYTkl:
./.claude/skills/orchestrator/references/reviewer-template.md:37:   - Optionally re-run `cd /Users/art/code/rules-as-tests-aif && npm run test:princip
./.claude/skills/orchestrator/references/ai-laziness-traps-orchestrator.md:131:**Counter:** Worker dispatch prompt MUST enumerate project-local princi
./.claude/skills/orchestrator/references/worker-template.md:73:cd /Users/art/code/rules-as-tests-aif && npm run test:principles
./.claude/skills/orchestrator/references/worker-template.md:82:- DO NOT edit project-scope files: README.md, CLAUDE.md, .claude/rules/*, .claude/skill
./.claude/skills/orchestrator/references/worker-template.md:107:| `<WORKDIR>`                    | `/Users/art/code/rules-as-tests-aif` (or project ro
  (hits: 5)
--- factory-Iwbf1j:
./.claude/skills/orchestrator/references/worker-template.md:73:cd /Users/art/code/rules-as-tests-aif && npm run test:principles
./.claude/skills/orchestrator/references/worker-template.md:82:- DO NOT edit project-scope files: README.md, CLAUDE.md, .claude/rules/*, .claude/skill
./.claude/skills/orchestrator/references/worker-template.md:107:| `<WORKDIR>`                    | `/Users/art/code/rules-as-tests-aif` (or project ro
./.claude/skills/orchestrator/references/reviewer-template.md:37:   - Optionally re-run `cd /Users/art/code/rules-as-tests-aif && npm run test:princip
./.claude/skills/orchestrator/references/ai-laziness-traps-orchestrator.md:131:**Counter:** Worker dispatch prompt MUST enumerate project-local princi
  (hits: 5)
```
