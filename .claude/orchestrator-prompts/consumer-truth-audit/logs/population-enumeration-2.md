# §2 Population enumeration — part 2 (C9-C11 + splits + drift)

> Split from population-enumeration.md (606 lines > 600-line markdown gate). Part 1: classes C1-C8 + tracked/local splits; this part: C9-C11 + spec corrections + drift table. Read both.

## C9. MCP config — what setup.d/05-mcp.sh ships
```
-- repo-root .mcp.json (exists: yes):
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    },
    "deepwiki": {
      "type": "http",
      "url": "https://mcp.deepwiki.com/mcp"
    }
  }
}
-- setup.d/05-mcp.sh copy/copy_dir targets:
7:# Processes kind=mcp manifest rows INSIDE install.sh (before 70-deps) per I1 channel constraint.
17:# ── T1: context7 → .mcp.json (regression L1 restore from setup.sh:289-303) ──────────────────
19:# .mcpServers entries (brownfield safety, D3 + park-don't-guess contract).
20:_05mcp_json="${PROJECT_ROOT}/.mcp.json"
27:  printf '  [05-mcp] context7 already in .mcp.json — skipping (use --force to refresh)\n'
29:  printf '  [dry-run] would: add context7 to .mcp.json (%s)\n' "$_05mcp_json"
33:      # Brownfield: additive merge — only sets the context7 key; all other .mcpServers entries preserved.
35:      # over a failed rewrite — the consumer kept the old .mcp.json, a half-written .mcp.json.tmp was
38:      if jq '.mcpServers["context7"] = {"command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"]}' \
40:        printf '  ✓ [05-mcp] context7 added/updated in existing .mcp.json\n'
46:      # Greenfield: create minimal .mcp.json with exact shape from setup.sh:289-303.
49:      printf '  ✓ [05-mcp] .mcp.json created with context7\n'
53:    printf '  ⚠ [05-mcp] jq not found — add context7 to .mcp.json manually:\n'
58:# ── T2: kind=mcp manifest rows — detect-first claude mcp add (I1: before 70-deps) ────────────
72:  printf '  [05-mcp] processing kind=mcp row #%d: %s\n' "$_05mcp_row_count" "$_05mcp_name"
76:printf '  [05-mcp] processed %d kind=mcp manifest row(s)\n' "$_05mcp_row_count"
```

## C10. CI workflows — packages/core/templates/**/workflows + repo .github/workflows
```
-- template workflows:
-- repo .github/workflows (factory-only, for HAS column of the repo itself):
audit-self.yml
context7-refresh.yml
demo-regen.yml
discipline-self-check.yml
framework-self-template-render.yml
guard-liveness-fullsweep.yml
link-checker.yml
metrics-collect.yml
pr-body-fidelity.yml
pr-body-prior-art.yml
pr-stale-revert.yml
release-drafter.yml
workflow-integrity.yml
```

## C11. scripts — scripts/ (top level) + what setup.d/85-worktree-scripts.sh ships
```
-- scripts/ (files only):
scripts/aif-clone-hygiene.sh
scripts/apply-doc-fixes.sh
scripts/build-getff-dist.sh
scripts/build-shipped-eslint-rules.sh
scripts/build-synth-bundle.sh
scripts/build-synth-bundle.test.sh
scripts/check-alwayson-budget.sh
scripts/check-alwayson-budget.test.sh
scripts/check-ask-files.sh
scripts/check-ask-files.test.sh
scripts/check-bundle-dep-parity.sh
scripts/check-bundle-dep-parity.test.sh
scripts/check-skill-drift.sh
scripts/ci-success-gate.sh
scripts/ci-success-gate.test.sh
scripts/create-worktree.sh
scripts/fire-routine.sh
scripts/format-shipped.sh
scripts/generate-plugin-twins.sh
scripts/getff-glm-onebutton.sh
scripts/getff-work.sh
scripts/host-verify-coverage.sh
scripts/host-verify-coverage.test.sh
scripts/host-verify.sh
scripts/install-coordination-wiring.sh
scripts/kickoff-hv-inventory.sh
scripts/link-coordination.sh
scripts/measure-always-on.sh
scripts/measure-always-on.test.sh
scripts/measure-session-start-tokens.sh
scripts/measure-turn-attribution.sh
scripts/probe-channels.sh
scripts/probe-channels.test.sh
scripts/register-precompact-hook.sh
scripts/render-harness-config.mjs
scripts/render-install-roster.mjs
scripts/render-presets.mjs
scripts/render-rule-channels.mjs
scripts/render-rule-index.mjs
scripts/render-zcode-parity-rollup.mjs
scripts/run-local-ci-sweep-coverage.test.sh
scripts/run-local-ci-sweep.sh
scripts/run-local-ci-sweep.test.sh
scripts/setup-cc-adoptions.sh
scripts/triage-corpus-probe.mjs
scripts/triage-s0-run.mjs
scripts/triage-s0-score.mjs
scripts/triage-s2-labels-check.mjs
scripts/triage-s3-agreement.mjs
scripts/triage-s4-score.mjs
scripts/triage-s4b-outcomes.mjs
scripts/worktree-doctor.sh
scripts/worktree-node-modules.sh
-- scripts/ subdirs:
scripts/triage-kernel-v2-bench
-- count all: 62
-- setup.d/85-worktree-scripts.sh shipped files:
7:# Depends on: 40-configs ($PROJECT_ROOT/scripts/ already created).
10:# What this layer does (INSTALL-TIME, file-copy only):
11:#   Ships the three worktree helper scripts from the framework's scripts/ tree
12:#   into the consumer's scripts/ tree so `getff work <name>` (and direct
13:#   `scripts/create-worktree.sh <name>` invocations) work for consumers at
27:#   The scripts are copied VERBATIM from $PKG_ROOT/scripts/ — no rewrite,
58:  if [ ! -f "$PKG_ROOT/scripts/$s" ]; then
61:      echo "▶ Worktree scripts → [dry-run] missing source: $PKG_ROOT/scripts/$s"
63:      echo "  ⚠ Worktree scripts: source absent ($PKG_ROOT/scripts/$s) — skipped"
71:echo "▶ Worktree scripts → scripts/ (profile=${PROFILE:-env+})"
75:    echo "  [dry-run] would: cp $PKG_ROOT/scripts/$s → $PROJECT_ROOT/scripts/$s"
80:# Real install path — copy each script verbatim, mark executable.
83:  copy_safe "$PKG_ROOT/scripts/$s" "$PROJECT_ROOT/scripts/$s"
84:  chmod_safe +x "$PROJECT_ROOT/scripts/$s" 2>/dev/null || true
87:echo "  ✓ scripts/create-worktree.sh (worktree entrypoint — REUSE per kickoff §4)"
88:echo "  ✓ scripts/worktree-node-modules.sh (node_modules provisioning)"
89:echo "  ✓ scripts/link-coordination.sh (workspace link coordination)"
90:echo "  ✓ scripts/getff-work.sh (workspace one-command entry-point — spec A9)"
92:echo "      via \`bash scripts/create-worktree.sh <name>\`."
```

## C4b. hooks — recursive count + lang/lib contents
```
.claude/hooks/adopt-orchestrator-prompts.sh
.claude/hooks/ask-question-reminder.sh
.claude/hooks/check-doc-authority-header.sh
.claude/hooks/check-doc-authority.sh
.claude/hooks/check-hook-marker.sh
.claude/hooks/check-kickoff-traps.sh
.claude/hooks/check-worker-dispatch-channel.sh
.claude/hooks/deps-hash-check.sh
.claude/hooks/end-of-turn-reminder.sh
.claude/hooks/inject-matching-rule.sh
.claude/hooks/inject-memory-codification.sh
.claude/hooks/inject-output-language.sh
.claude/hooks/inject-project-digest.sh
.claude/hooks/inject-session-bootstrap.sh
.claude/hooks/inject-subagent-context.sh
.claude/hooks/inject-subagent-digest.sh
.claude/hooks/lang/check-parity.sh
.claude/hooks/lang/en.sh
.claude/hooks/lang/ru.sh
.claude/hooks/lib/hook-emit.sh
.claude/hooks/precompact-residue.sh
.claude/hooks/runtime-bridge-dispatch.sh
.claude/hooks/validate-prompt.sh
.claude/hooks/warn-subagent-report.sh
.claude/hooks/worktree-setup.sh
-- recursive file count: 25
```

## C10b. where do shipped CI workflow templates actually live? (spec said packages/core/templates/**/workflows — find returned nothing there)
```
$ find packages -name '*.yml' -path '*workflow*' -o -name 'ci.yml' | grep -v node_modules | sort
-- search install scripts for the ci.yml source path:
setup.d/40-configs.sh:79:  # Storybook scaffold: the shipped react-next ci.yml has a test-storybook job that needs a
setup.d/40-configs.sh:448:    deliver_getff_workflow "$PKG_ROOT/templates/ts-server/github-actions-ci.yml" "$PROJECT_ROOT/.github/workflows/ci.yml"
setup.d/40-configs.sh:467:    deliver_getff_workflow "$PKG_ROOT/packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml" "$PROJECT_ROOT/.github/workflows/ci.yml"
setup.d/40-configs.sh:483:    deliver_getff_workflow "$PKG_ROOT/packages/preset-react-spa/templates/github-actions-ci-ui.yml" "$PROJECT_ROOT/.github/workflows/ci.yml"
setup.d/40-configs.sh:506:    deliver_getff_workflow "$PKG_ROOT/packages/preset-react-native/templates/github-actions-ci-ui.yml" "$PROJECT_ROOT/.github/workflows/ci.yml"
setup.d/46-cargo.sh:30:#                                           .github/workflows/getff-cargo.yml (never the consumer's ci.yml).
setup.d/46-cargo.sh:162:# occupies our path. NEVER writes to the consumer's ci.yml. Body = lib.sh _lane_deliver_ci (S-2);
setup.d/46-cargo.sh:163:# the pins in the REFUSE hints MIRROR github-actions-ci.yml (the delivered template) — keep the two
setup.d/47-go.sh:4:# Ships the pre-rendered golangci-lint bundle (.golangci.yml authored at
setup.d/47-go.sh:5:# packages/core/templates/go/.golangci.yml) into a consumer Go module with an AUGMENT-FIRST
```

## C8b. .getff/ at repo root — what is it?
```
no .getff dir
```

## C-splits: tracked (framework HAS) vs container-local
```
tracked .claude/skills families (16):
  ai-doc
  aif-doctor
  arch
  claude-glm-executor-handoff
  dispatcher
  harvest
  night-mode
  orchestrator
  pipeline
  reviewer
  rule-research
  rule-tests
  self-reflection
  story
  template-audit
  tool-bootstrapping
gitignored container-local skill dirs (25): aif, aif-* per .gitignore:115 (/.claude/skills/aif-*/)
tracked: hooks 25 (21 top + lang 3 + lib 1) | rules 30 | agents 20 | root skills/: 8 dirs (getff, tool-bootstrapping)
```

## Drift table — authoring counts vs re-derived (spec §2: re-derive, do not trust)

| class | authoring | measured (this census) | drift |
|---|---|---|---|
| skills | 16 | 16 tracked families (.claude/skills 15 + root skills/getff; 25 gitignored aif-* dirs are container-local, not framework cargo) | none once tracked-only is the denominator |
| agents | 20 | 20 | none |
| discipline rules | 30 | 30 | none |
| hooks | 29 | 25 tracked files (.claude/hooks: 21 top + 3 lang/ + 1 lib/) | **−4** (authoring count unreproducible; 25 is the tree truth) |
| hook checks | 25 | 25 files in packages/core/hooks/checks/ — 13 production .ts + **12 .test.ts** | none (but composition differs from a naive '25 shipped checks' reading) |
| principles | 47 | 47 *.test.ts | none |
| template dirs | 5 | 5 (cargo, go, python, react-next, shared under packages/core/templates/) + root templates/ts-server/ (stack configs + CI yml sources) | none (but see C10b spec-path correction) |

## Spec-corrections surfaced by enumeration (recorded, not fixed — §6)

1. **C10 spec path wrong:** §2 says CI workflows source from `packages/core/templates/**/workflows` — that glob matches NOTHING (`find packages/core/templates -path '*workflows*'` → empty, quoted in C10). Real sources: root `templates/ts-server/github-actions-ci.yml` + `github-actions-workflow-integrity.yml` via setup.d/40-configs.sh:448,454; cargo/go/python CI ymls under `packages/core/templates/<stack>/` via 46-cargo.sh/47-go.sh/45-python.sh.
2. **C8 spec path wrong:** `.getff/astgrep-rules` does not exist at repo root (`ls .getff` → No such file or directory). The 4 ast-grep rule ymls live at `packages/core/templates/python/.getff/astgrep-rules/`; clippy.toml at `packages/core/templates/cargo/clippy.toml`; .golangci.yml at `packages/core/templates/go/.golangci.yml`; ruff.toml at `packages/core/templates/python/ruff.toml`. Lint bundles are stack-specific template cargo, not root config.
3. **C1 naive count misleads:** `ls -d .claude/skills/*/` → 41, but 25 are gitignored container-local consumer skills (aif suite, .gitignore:115). The framework-shipped population is the 16 tracked families.
4. **self-reflection anomaly:** `.claude/skills/self-reflection/` is git-tracked but appears in NO install log section for any of the three profiles (core/env/factory skill lists quoted above) — candidate HAS=true / DELIVERED=false row. Resolved in the census matrix, not here.

## C11b. ADDENDUM (rework round 2) — the consumer-script sources §C11 missed

§C11 enumerated repo `scripts/` (62 tracked files) — the kickoff §2 source. The installer's
DOMINANT consumer-script source is elsewhere: `setup.d/40-configs.sh:14-54` copies named files
from `packages/core/{audit-self,probes,synthesizer}` into consumer `scripts/`, and
`setup.d/10-skills.sh:168` ships `scripts/run-local-ci-sweep.sh` (factory, operator-skill
payload). Round 1 left those 20 delivered files with no census row while report §census summary
quoted the full 20/24/25 delivered matrix — the two deliverables contradicted each other
(review round-2 BLOCKER). Enumerated now, from the setup.d copy list:

```
$ grep -h 'copy_safe.*PROJECT_ROOT/scripts/' setup.d/*.sh | sed 's/.*\$PKG_ROOT\///; s/".*//' | sort -u
packages/core/audit-self/audit-ai-docs.sh
packages/core/audit-self/check-arch-boundaries.sh
packages/core/audit-self/check-fences-fire.sh
packages/core/audit-self/check-lintstaged-resolves.sh
packages/core/audit-self/check-rule-enforced.sh
packages/core/audit-self/check-rule-globs.sh
packages/core/audit-self/check-shields-up.sh
packages/core/audit-self/ci-available-probe.sh
packages/core/audit-self/detect-r2-boundary.sh
packages/core/audit-self/fixtures/fences-fire     ← dir payload → scripts/fences-fire-fixtures/ (40-configs.sh:54)
packages/core/audit-self/pre-merge-local.sh
packages/core/audit-self/r2-na-marker.sh
packages/core/probes/audit-r4.ts
packages/core/synthesizer/run-generated-rule-mutation.sh
packages/core/synthesizer/run-rule-tests-firing.sh
packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh   ← stack variants, NOT on the ts-server flow
packages/preset-react-native/audit-self/audit-ai-docs.react-native.sh
packages/preset-react-spa/audit-self/audit-ai-docs.react-spa.sh
```

Fixture-dir contents (framework side, `packages/core/audit-self/fixtures/fences-fire/`, 9 files):
no-server-imports-in-client.{bad.txt,good.txt,manifest.json} (react-next-stack material —
delivered only on react-next stacks, absent from all 3 round-2 ts-server trees),
no-unsafe-zod-parse.{bad.txt,good.txt,manifest.json},
require-use-server-directive.{bad.txt,good.txt,manifest.json}.

**C11b script-class population: 85 rows = 62 (repo `scripts/`, §C11) + 23 (audit-self 11 .sh +
6 fixtures + probes/audit-r4.ts + synthesizer 2 .sh; of the fixtures, 3 are stack-gated and
undelivered here).** Delivered sums re-verified on the round-2 trees: 20 / 24 / 25 (= §M7).
Stack-variant `audit-ai-docs.react-{next,native,spa}.sh` sources are outside every
kickoff-named population and stay unenumerated (same cut as the gitignored skills).
