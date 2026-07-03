# Audit checklist for rules-as-tests-aif

> Self-audit of this package, applying the framework's own principle: rules must be executable. Every claim in this checklist is a probe — pass/fail.
>
> Use AUDIT-PROMPT.md to give a fresh AI agent the full audit task in one prompt.
> Use this checklist for manual verification or as the AI's reference.

This checklist is **rule-as-test recursion**: the package about "executable rules" gets audited by its own executable rules.

---

## Section 1 — Structural integrity (auto-checkable, ~2 min)

### 1.1 File count and structure
```bash
git ls-files | wc -l
# EXPECTED: grows monotonically over time (packages/ monorepo; was ~37-40 in the
# early flat layout, ~390 pre-1587). Not a fixed number — sanity-check the count
# is in the same order of magnitude as the last audit, not an exact match.
```

### 1.2 Bash scripts have valid syntax
```bash
for f in $(find . -name "*.sh"); do
  bash -n "$f" || echo "SYNTAX ERROR: $f"
done
# EXPECTED: no errors
```

### 1.3 JSON files are valid
```bash
for f in $(find . -name "*.json"); do
  python3 -c "import json; json.load(open('$f'))" 2>&1 | grep -v "^$" || echo "OK: $f"
done
# EXPECTED: no errors
```

### 1.4 No tracked .md file > 600 lines (except declared-transient exempt)
```bash
# Pre-commit enforces ≤600 on changed *.md, exempting docs/meta-factory/EXECUTION-PLAN.md
# (declared "transient artifact"). Mirror that exempt here.
git ls-files '*.md' | while read -r f; do
  [ "$f" = "docs/meta-factory/EXECUTION-PLAN.md" ] && continue
  lines=$(wc -l < "$f")
  [ "$lines" -gt 600 ] && echo "OVERWEIGHT: $f ($lines lines)"
done
# EXPECTED: nothing
```

### 1.5 Setup/install scripts are executable
```bash
# NOTE: scripts/audit-ai-docs.sh is the CONSUMER-installed path (absent in this source repo
# by design — see agents/living-docs-auditor.md). The source-repo canonical lives under
# packages/core/audit-self/.
[ -x setup.sh ] && [ -x install.sh ] && [ -x packages/core/audit-self/audit-ai-docs.sh ] || echo "FAIL: missing +x"
# EXPECTED: silent (no output = pass).
# KNOWN FINDING (2026-05-21): setup.sh is git mode 100644 (not +x) while install.sh is 100755.
# packages/core/audit-self/audit-ai-docs.sh is ALSO git mode 100644 (verify:
# git ls-files -s packages/core/audit-self/audit-ai-docs.sh). This probe FAILs on both —
# a real inconsistency finding, not a stale-probe artifact. Both scripts are invoked via
# `bash <script>` so they work, but the bit is inconsistent. Surface, do not fix here.
```

---

## Section 2 — Cross-references and consistency (~5 min)

### 2.1 Every R-rule in RULES.md has a documented enforcement strategy

> **Post-C-1 (2026-05-20):** `best-practices-sidecar.md` is no longer ours (KEEP-AIF —
> AIF's `rules-sidecar` reads `.ai-factory/RULES.md`). The per-rule enforcement strategy
> now lives in the audit-script header (`packages/core/audit-self/audit-ai-docs.sh` lines
> 8-18: delegated-to-ESLint / probe / manual-review-only) plus the `aif-rules-check`
> skill-context residue (R4/R10/R17 — the checks with no earlier deterministic channel).

```bash
RULES_FILE=packages/preset-next-15-canonical/RULES.md
AUDIT=packages/core/audit-self/audit-ai-docs.sh
RESIDUE=packages/core/templates/shared/skill-context/aif-rules-check/SKILL.md

RULES=$(grep -oE "^## R[0-9]+" "$RULES_FILE" | grep -oE "R[0-9]+")
for r in $RULES; do
  # Strategy documented as: a skip_unless probe, an ESLint/depcruise delegation note,
  # a "manual review only" note (all in the audit-script header), OR the skill-context residue.
  in_audit=$(grep -cE "skip_unless $r\b|^#.*\b$r\b" "$AUDIT" 2>/dev/null)
  in_residue=$(grep -cE "\b$r\b" "$RESIDUE" 2>/dev/null)
  if [ "$in_audit" -eq 0 ] && [ "$in_residue" -eq 0 ]; then
    echo "ORPHAN RULE: $r — no probe, no delegation/manual note, no skill-context residue"
  fi
done
# EXPECTED: nothing (every rule has a documented enforcement strategy)
```

### 2.2 Every probe in audit-ai-docs.sh has a comment mapping to an R-rule

```bash
grep -E "^# R[0-9]+ —|^# D[0-9]+ —" packages/core/audit-self/audit-ai-docs.sh | wc -l
# EXPECTED: ≥5 (R4 probe + D1-D4 drift checks; R1-R3/R5-R11 are delegated/manual per the
# header strategy block at lines 8-18, not per-probe comments)
```

### 2.3 Markdown links to .md files resolve

```bash
# Find all .md references in backticks
for src in $(find . -name "*.md"); do
  grep -oE "\`[^\`]*\.md\`" "$src" | tr -d '`' | sort -u | while read ref; do
    # Skip files that are CREATED at project install time (not in package)
    case "$ref" in
      *.ai-factory/*|*AGENTS.md|*CLAUDE.md|*.template.md|*\<*) continue ;;
      pravila-*|aif-rules-*|shift-left-*|rules-as-tests.md|contract-*) continue ;;  # outer corpus, not in package
    esac
    base=$(basename "$ref")
    find . -name "$base" 2>/dev/null | grep -q . || echo "DEAD LINK in $src → $ref"
  done
done | sort -u
# EXPECTED: nothing
```

### 2.4 No old paths after rename

```bash
# Historical rename: ai-factory-RULES\.md → factory/RULES.md → packages/preset-*/RULES.md.
# (Exclude the audit docs themselves — they legitimately name the historical path in prose.)
grep -rs "ai-factory-RULES\.md" --include="*.md" --include="*.sh" . 2>/dev/null \
  | grep -v node_modules | grep -v "AUDIT-CHECKLIST\|AUDIT-PROMPT"
# EXPECTED: empty

# Post-C-1 (2026-05-20): our docs-auditor was renamed → living-docs-auditor; our
# best-practices-sidecar was de-shipped (KEEP-AIF). Check no agent FILE and no active
# WIRING ships either old name. (Prose mentions like "renamed from docs-auditor" are
# explanatory and fine — only files + array/glob wiring matter.)
[ -e agents/best-practices-sidecar.md ] && echo "STALE: agents/best-practices-sidecar.md still present (should be KEEP-AIF)"
[ -e agents/docs-auditor.md ] && echo "STALE: agents/docs-auditor.md still present (renamed to living-docs-auditor)"
grep -nE '"agents/(best-practices-sidecar|docs-auditor)\.md"' install.sh extension.json 2>/dev/null
# EXPECTED: empty (no file, no wiring for either old name)
```

### 2.5 Stack-specific files match in name pattern

```bash
# ts-server configs stay at root templates/ts-server/ (Phase-3 Gate 2 option A — kept legacy).
# react-next configs moved to the preset package; shared/ deleted from root (canonical in packages/).
ls templates/ts-server/ packages/preset-next-15-canonical/templates/
# EXPECTED: templates/ts-server/ has eslint.config.mjs, vitest.config.ts, dependency-cruiser.cjs, stryker.config.json, github-actions-ci.yml
# EXPECTED: packages/preset-next-15-canonical/templates/ has eslint.config.react.mjs, github-actions-ci-ui.yml, ARCHITECTURE.react-next.md
```

---

## Section 3 — Content quality (~10 min, AI review needed)

### 3.1 Templates have clear placeholders

Read `packages/core/templates/shared/DESCRIPTION.template.md` and `packages/core/templates/shared/ARCHITECTURE.ts-server.md`. Verify:
- All `<PLACEHOLDER>` markers are valid (matched, not hanging brackets)
- Each placeholder has a comment explaining what to replace it with
- No real project names or paths leaked (this is generic template)

### 3.2 No duplicated rule statements

For each R-rule in `packages/preset-next-15-canonical/RULES.md`:
- Statement exists in RULES.md (canonical)
- Reference (not restatement) exists in the `aif-rules-check` skill-context residue (R4/R10/R17)
  and/or the audit-script header strategy block (post-C-1; replaces best-practices-sidecar.md)
- Reference (not restatement) exists in DESCRIPTION/ARCHITECTURE templates
- audit-ai-docs.sh probe quotes the R-number, not restates the rule

If you see the same rule stated 3 different ways in 3 files — fail.

### 3.3 References are progressive disclosure, not full re-explanations

`SKILL.md` should be ≤300 lines and have an index of references.
Each `references/<file>.md` should be self-contained but link to others, not duplicate.

Specifically check:
- `overview.md` and `checks-map.md` — they cover different layers; should NOT both have the same "5-layer framework" exposition
- `ai-traps.md` and `self-testing-docs.md` — both touch AI-docs drift; should be clearly differentiated

### 3.4 Sub-agents have clear responsibility boundaries

Post-C-1 (2026-05-20) `best-practices-sidecar` is KEEP-AIF — not ours; see
`docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md`. The
`agents/` directory has since grown beyond the original three — check current contents
rather than assuming a fixed count; cross-check which of these are actually copied to
consumer projects via the shipped-set logic in `setup.d/20-agents.sh` (§2 block):

- `review-sidecar` — adversarial two-AI diff review for tautological/mock-only tests; no
  awareness of how the code was written. (Portable SSOT; content also rides AIF's
  `aif-review` skill-context — `@dual-pair: review-sidecar`.)
- `living-docs-auditor` — runs `audit-ai-docs.sh`, parses output, reports **backward**
  Living-Documentation drift (do AGENTS.md/RULES.md rules still hold in code?). Renamed
  from `docs-auditor` to de-collide with AIF's same-named **forward** doc-gen gate.
- `compliance-verifier` — reviews PR-description §1.7 Forward/Backward sections for
  substantive file:line evidence; no collision with AIF.
- other agents added since (e.g. `backward-sweep-auditor`, `capability-reuse-auditor`,
  `manual-rule-liveness-prober`, `memory-codification-auditor`,
  `orchestrator-worker-discipline`, `rule-researcher`, `shipped-agent-liveness-prober`,
  `aif-init`) — see each file's own frontmatter `description:` for scope; not all are
  copied to consumers via `setup.d/20-agents.sh`.

```bash
ls agents/
# EXPECTED: no fixed count — grows over time. Verify NO best-practices-sidecar.md,
# NO docs-auditor.md (both retired per the C-1 resolution above); cross-check the
# shipped subset against setup.d/20-agents.sh §2.
```

If two agents have the same job description with different wording — fail.

### 3.5 Templates compile/lint independently

Try to parse templates without project context:
```bash
# eslint.config.mjs syntax check
node --check templates/ts-server/eslint.config.mjs 2>&1 | head -5
# (will fail on imports, that's OK — just check syntax)

# tsconfig.json valid (shared/ moved to packages/core/templates/shared/)
python3 -c "import json; json.load(open('packages/core/templates/shared/tsconfig.json'))"
```

---

## Section 4 — AI-specific quality (this is meta — apply AI traps to the package itself)

### 4.1 Token economy of the skill

Calculate approximate tokens loaded when skill triggers:
```bash
# SKILL.md is always loaded
SKILL_LINES=$(wc -l < skills/rules-as-tests/SKILL.md)
echo "SKILL.md: $SKILL_LINES lines (~$((SKILL_LINES * 30)) tokens)"

# References load on-demand — sum them
TOTAL_REF=$(find skills/rules-as-tests/references -name "*.md" -exec wc -l {} + | tail -1 | awk '{print $1}')
echo "All references combined: $TOTAL_REF lines (~$((TOTAL_REF * 30)) tokens)"

# Health check
[ "$SKILL_LINES" -lt 500 ] && echo "OK: SKILL.md under 500 lines" || echo "ALARM: SKILL.md > 500 lines"
[ "$TOTAL_REF" -lt 2000 ] && echo "OK: references combined < 2000 lines" || echo "ALARM: references heavy"
```

### 4.2 No tautological claims

Check the package doesn't make claims it can't substantiate:
- "Battle-tested" — false unless tested in production
- "Reduces bugs by X%" — false unless measured
- "Industry standard" — only if cited

Grep for marketing language:
```bash
grep -rEi "battle.tested|industry.standard|guarantees|prevents.*bugs|catches.*all|never.fails" \
  --include="*.md" .
# EXPECTED: empty or only inside negative examples
```

### 4.3 Lessons learned section is real, not aspirational

Each lesson in `references/ai-traps.md` "Lessons learned" should:
- Describe a concrete observed failure
- Have a generalizable lesson
- Have an executable detection rule

Read the section. If a lesson sounds like "you should be careful" without a concrete check — flag it.

### 4.4 Self-application: does the package follow its own rules?

Apply selected R-rules to this very package:
- **R10 Naming**: Files named after their content? (e.g., `audit-ai-docs.sh` does audit AI docs ✓)
- **R11 CI integrity**: Does the package describe how it's tested? **YES now** — `.github/workflows/audit-self.yml` runs `mechanical`, `rule-to-probe`, `probe-tests` + framework-self-install jobs on every push/PR. (Was a known gap pre-2026; now closed — see §8.1.)

---

## Section 5 — Setup and install verification (~5 min, requires test env)

### 5.1 In a fresh project, setup.sh succeeds

```bash
mkdir /tmp/rat-test && cd /tmp/rat-test
git init && npm init -y

# Run setup
bash /path/to/rules-as-tests-aif/setup.sh --stack=ts-server --skip-deps

# Verify
ls -la .ai-factory/ .claude/agents/ scripts/ 2>/dev/null
# EXPECTED: all directories exist with content
```

### 5.2 install.sh handles existing files gracefully

```bash
# Run setup TWICE in same project — should not corrupt
bash /path/to/setup.sh --skip-deps
bash /path/to/setup.sh --skip-deps  # second run
# EXPECTED: warns about existing files, does not crash
```

### 5.3 audit-ai-docs.sh runs on empty project without crashing

```bash
cd /tmp/rat-test
bash scripts/audit-ai-docs.sh
# EXPECTED: exit code 0 (no failures because no code to violate rules)
# EXPECTED: at least D1, D2 probes report (they're drift checks)
```

### 5.4 audit-ai-docs.sh fails when expected violations present

This is the **negative test for the audit script itself**:

```bash
# Inject a violation
mkdir -p src/domain
echo 'export const x = 5; const _ = Date.now();' > src/domain/bad.ts

# Run audit — should FAIL on R7
bash scripts/audit-ai-docs.sh
EXIT=$?
[ "$EXIT" -eq 1 ] && echo "OK: audit caught R7 violation" || echo "FAIL: audit missed R7 violation"

# Cleanup
rm -rf src/
```

If this passes — the audit script actually works. If it doesn't — the script has a regex bug or path bug.

---

## Section 6 — AIF integration (manual)

### 6.1 ai-factory init creates expected structure

In a clean project after `ai-factory init --agents claude`:
- `.ai-factory/` exists with DESCRIPTION.md, ARCHITECTURE.md, RULES.md, etc.
- `.claude/agents/` has AIF base agents (plan-coordinator, etc.)
- `.claude/skills/` has aif-* skills
- `.ai-factory.json` exists

### 6.2 install.sh overlays correctly without breaking AIF base

Post-C-1 (2026-05-20) our install occupies **ZERO** of AIF's agent slots (no `--force`
overwrite of any AIF agent). After `install.sh`:
- `.claude/agents/best-practices-sidecar.md` — **AIF's, untouched** (KEEP-AIF; AIF's
  `rules-sidecar` already reads our `.ai-factory/RULES.md`; we ship no override)
- `.claude/agents/living-docs-auditor.md` — **ours, new file** (renamed from `docs-auditor`
  so it does not collide with AIF's same-named agent)
- `.claude/agents/review-sidecar.md` — collides with AIF's; default `copy_safe` (no `--force`)
  keeps AIF's, and our anti-tautology content rides `.ai-factory/skill-context/aif-review/SKILL.md`
- `.claude/agents/compliance-verifier.md` — **ours, no collision**
- Other AIF base agents — UNTOUCHED (plan-coordinator, implement-worker, rules-sidecar, etc.)
- `.ai-factory/RULES.md` — seeded with our R1-R20, BUT user can adjust

```bash
# Disjointness check (the post-C-1 version-bump safety probe): our installed agent names
# must stay disjoint from AIF's. In a sandbox after both inits:
comm -12 <(ls "$AIF_PROBE/.claude/agents" | sort) <(ls agents | sort)
# EXPECTED: only review-sidecar.md (the one intentional collision, handled by skill-context)
```

### 6.3 /aif-verify exercises the chain end-to-end

In Claude Code, after `/aif-implement` (post-C-1 wiring):
- `/aif-verify` invokes AIF's `rules-sidecar` → reads `.ai-factory/RULES.md` (our R1-R20) and
  applies the `aif-rules-check` skill-context residue (R4/R10/R17) → verdict
- `aif-review` runs, augmented by our `.ai-factory/skill-context/aif-review/SKILL.md`
  anti-tautology conventions → two-AI review report
- Earlier channels (edit-time ESLint custom rules, pre-push `audit-ai-docs.sh`/tsc/depcruise)
  are the authoritative deterministic enforcers; `/aif-verify` is the late LLM channel
- `living-docs-auditor` (ours) is dispatched via its own name (not in AIF's coordinator
  allowlist after rename) or run at pre-push via `audit-ai-docs.sh`

(Manual test — requires Claude Code session + AIF init.)

---

## Section 7 — Documentation honesty (~5 min)

### 7.1 README accurately describes what's in the package

Read README.md. Cross-check claims:
- any file-count claim → match actual (`git ls-files | wc -l`)
- "covers ts-server and react-next" → `templates/ts-server/` (root) + `packages/preset-next-15-canonical/templates/` exist
- "self-testing AI docs via probes" → `packages/core/audit-self/audit-ai-docs.sh` exists with probes

### 7.2 INSTALL.md describes actual installation steps

Read INSTALL.md. Each step should be runnable. If any step references a file that doesn't exist or a command that doesn't work — fail.

### 7.3 No bullshit statements

Look for unsupported claims:
- "Improves AI quality" — say what aspect, by what mechanism
- "Best practice" — by whose definition? cite or remove
- "Production-ready" — production-tested? if not, remove

---

## Section 8 — Known gaps (must-verify findings)

The package authors flagged these gaps. They are not bugs — they are TODOs that
the package itself doesn't yet satisfy. **The audit must explicitly check whether
these are still gaps, and report them as findings if so.**

### 8.1 CI for the package itself — RESOLVED (was a gap pre-2026)

The package requires CI from user projects (R11). It now **has its own CI**:

```bash
grep -E "^  [a-z-]+:$" .github/workflows/audit-self.yml
# EXPECTED: jobs incl. mechanical, rule-to-probe, probe-tests, manifest-render-check,
#           principles-meta-tests, enforce-husky-presence, framework-self-install-*, …
```

**If the file is missing or the three core jobs (`mechanical`, `rule-to-probe`,
`probe-tests`) are gone** → report BLOCKER "Self-audit CI broken/missing" — this is
load-bearing for the package's own "rules as tests" thesis (silent regression here =
the package stops eating its own dog food).

### 8.2 Negative tests for audit-ai-docs.sh probes — RESOLVED (was a gap pre-2026)

`references/self-testing-docs.md` states: "every probe should have a matching
negative test — inject artificial violation, run probe, expect FAIL, revert."

Such tests now exist for the core (ts-server) probes:
```bash
npx vitest run packages/core/audit-self/audit-ai-docs.test.ts
# EXPECTED: exit 0, all tests pass (vitest — ported from the old bash
# negative-test harness, Wave 10.4).
# Each test injects a violation in a temp dir, runs the probe with --only=R<N>/D<N>,
# asserts the probe catches it. Wired into .github/workflows/audit-self.yml job `probe-tests`.
```

**If the file is missing, exit≠0, or any test FAILs** → report BLOCKER "Probes without
working negative tests — silent regex breakage risk."

**Remaining gap (genuine finding):** there is **no** paired negative-test file for the
react-next probes in `packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh`
(R17 + the R12/R14/R15/R16a/R16b/R20 ESLint-delegated probes). Report as MAJOR finding when
auditing — the ts-server probes are negative-tested; the react-next ones are not.

---



### Manual run (you with terminal)
1. Open this checklist
2. For each Section 1-7, run the bash commands
3. For text-based checks (Section 3, 4.3), read and judge
4. Note all failures in a separate file
5. Fix or document each failure

### AI run (give the prompt to a fresh Claude session)
Use AUDIT-PROMPT.md — it embeds this checklist into a single instruction.

### Time budget
- Sections 1, 2: ~5 min (auto-checkable)
- Section 3: ~10 min (AI review)
- Section 4: ~10 min (semantic checks)
- Section 5: ~5 min (test in /tmp project)
- Section 6: ~10 min (manual AIF integration)
- Section 7: ~5 min (documentation review)
- Section 8: ~3 min (must-verify gap findings)

**Total: ~48 minutes for full audit.**

For quick triage — Sections 1, 2, 5, 8.
