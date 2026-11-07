# Self-testing documentation — AGENTS.md rules as executable tests

> Every AGENTS.md rule that can be formalised should have a bash check in `scripts/audit-ai-docs.sh`. Drift and code-vs-docs decay are caught by one command in 5-10 seconds.

This document applies the rules-as-tests framework **to the AI documentation itself**. The same principle as for production code: a rule is either executable or it is not a rule. Only here the object of enforcement is `AGENTS.md` / `CLAUDE.md` / `.claude/skills/` / `.claude/rules/`.

The approach was developed in real practice (see the audit scripts in the sisters-sphere and artyhoo-cv projects); this is the generalised, portable form.

> **Authoritative for:** «rules-as-tests applied to AI documentation» pattern — `audit-ai-docs.sh` design, code-vs-doc probe pairing, negative-test pairing for AGENTS.md rules.
> **NOT authoritative for:** framework's project goal — see [../../../README.md#why-this-exists](../../../../README.md#why-this-exists). Doc-vs-doc authority drift (separate failure mode) — see [.claude/rules/doc-authority-hierarchy.md](../../../rules/doc-authority-hierarchy.md). AI-doc organization — see [doc-organization.md](doc-organization.md).

---

## Why

The standard drift checks (§drift detection in `doc-organization.md`) check that **files exist**: a skill is mentioned in AGENTS.md → is there a matching folder in `.claude/skills/`?

That is not enough. The file can exist while **the code stopped matching the rule long ago**. That is _decay_, and no existing drift checker catches it.

The fix: **code-vs-docs probes**. Every AGENTS.md rule that can be formalised with grep/awk becomes a bash check in `audit-ai-docs.sh`. The script runs all probes in 5-10 seconds, exit 0 (PASS) or 1 (FAIL).

```text
AGENTS.md «Rule N: <rule>»
            ↓
scripts/audit-ai-docs.sh §[probe N]: grep/awk check
            ↓
exit 0 (PASS) | 1 (FAIL) | 0+WARN (decay-watch)
```

It runs at three levels:

1. **`./scripts/audit-ai-docs.sh`** directly (or through the `living-docs-auditor` sub-agent) — before a PR. If you have an external AI Factory installed, its `/aif-verify` wraps this same script, but the script itself is the gate.
2. **Pre-push hook** (`.husky/pre-push`) — before the code leaves the machine.
3. **CI on PR** — a required check; it blocks the merge unless it PASSes.

---

## Catalogue of typical probes

Each probe has three parts: **detect** (find candidates), **filter** (drop exceptions), **assert** (PASS if empty, FAIL otherwise).

### Probe 1: «Every Server Action starts with requireUser()»

```bash
# Detect: every file exporting an async function in actions/
# Filter: drop files where the first line of the function contains requireUser
# Assert: empty = PASS

BAD=$(grep -rn "^export async function" src/app/actions/ \
  | while read line; do
      file=$(echo "$line" | cut -d: -f1)
      lineno=$(echo "$line" | cut -d: -f2)
      # Check that requireUser appears within 3 lines after the declaration
      next3=$(awk "NR>=$lineno && NR<=$((lineno+3))" "$file")
      echo "$next3" | grep -q "await requireUser()" || echo "$line"
    done)

[ -z "$BAD" ] && echo "PASS: Rule 1" || { echo "FAIL: Rule 1: $BAD"; exit 1; }
```

### Probe 2: «No direct calls to the supabase admin client outside actions/api»

```bash
LEAK=$(grep -rn "from.*supabase/admin" src/ \
  | grep -v "src/app/actions/" \
  | grep -v "src/app/api/")

[ -z "$LEAK" ] && echo "PASS: Rule 2" || { echo "FAIL: Rule 2: $LEAK"; exit 1; }
```

### Probe 3: «redirect() must not be called from try/catch»

Harder — it needs AWK for a structured check of function bodies:

```bash
VIOL=""
for f in $(grep -rl "redirect(" src/); do
  out=$(awk '
    /try \{/ { intry=1; trystart=NR }
    /\} catch/ { intry=0 }
    /redirect\(/ {
      if(intry) print FILENAME":"NR": redirect inside try/catch (try started at "trystart")"
    }
  ' FILENAME="$f" "$f")
  [ -n "$out" ] && VIOL="$VIOL\n$out"
done

[ -z "$VIOL" ] && echo "PASS: Rule 3" || { echo "FAIL: Rule 3: $VIOL"; exit 1; }
```

### Probe 4: «Every action taking FormData must call isHoneypotFilled»

```bash
VIOL=""
for f in src/app/actions/*.ts; do
  out=$(awk '
    /^export async function/ {
      fn=$4; sub(/\(.*/,"",fn); start=NR; has_fd=0; has_hp=0;
    }
    /formData: FormData/ { has_fd=1 }
    /isHoneypotFilled/ { has_hp=1 }
    /^}/ {
      if(start && has_fd && !has_hp) print FILENAME":"start": "fn
      start=0; has_fd=0; has_hp=0;
    }
  ' FILENAME="$f" "$f")
  [ -n "$out" ] && VIOL="$VIOL\n$out"
done

[ -z "$VIOL" ] && echo "PASS: Rule 4" || { echo "FAIL: Rule 4: $VIOL"; exit 1; }
```

### Probe 5: «Config X must contain Y»

```bash
grep -q "dangerouslyAllowLocalIP" next.config.ts \
  && echo "PASS: Rule 5" \
  || { echo "FAIL: Rule 5: missing dangerouslyAllowLocalIP in next.config.ts"; exit 1; }
```

### Probe 6 (decay-watch): «Migration X must be done by date Y»

Does not block CI, but emits a WARN:

```bash
if ls supabase/migrations/*role* 2>/dev/null; then
  echo "PASS: Rule 6 (migration exists)"
else
  echo "WARN: Rule 6 — role migration overdue, deadline 2026-06-01"
fi
```

---

## Mandatory rule: a negative test for every probe

**A probe without a negative test does not count as implemented.** If the regex is accidentally broken (say, a forgotten `\$` escape), the probe will always return PASS, and nobody will notice.

The procedure for each probe:

1. **Implement the probe.**
2. **Introduce an artificial violation** into the code (comment out `requireUser()` in one file, for example).
3. **Run the probe.** Expect `FAIL`.
4. **If it PASSes, the probe is broken** — fix it.
5. **Revert the artificial violation.**
6. **Run it again.** Expect `PASS`.

This can be automated in the audit script's own test suite:

```bash
# tests/audit-ai-docs.unit.sh
# Check that each probe catches a deliberately introduced violation

test_probe_R1() {
  # Create a temporary violation
  cp src/app/actions/example.ts /tmp/example.bak
  sed -i.bak 's/await requireUser()/\/\/ await requireUser()/' src/app/actions/example.ts

  # Run probe R1 only.
  # Important: the probe name is R<N>, not a bare number. audit-ai-docs.sh parses --only=R1
  # as a string comparison; --only=1 matches no probe and the test passes falsely.
  if ./scripts/audit-ai-docs.sh --only=R1 > /dev/null 2>&1; then
    echo "FAIL: probe R1 should have caught the violation"
    cp /tmp/example.bak src/app/actions/example.ts
    return 1
  fi

  # Revert
  cp /tmp/example.bak src/app/actions/example.ts
  rm /tmp/example.bak
  echo "PASS: probe R1 correctly catches violation"
}
```

These negative tests run once a week or whenever `audit-ai-docs.sh` itself changes. Not on every commit — otherwise they waste time.

---

## Guidelines for probes

- **One probe = one AGENTS.md rule**. Do not combine.
- **Probe name = rule name** («Rule 14: verifyImageMagicBytes used», not «check 14»).
- **AWK for structured checks** (function bodies, blocks). Grep for simple strings/imports. No regexes through `sed` — unreadable.
- **False positives are caught by `grep -v` filters** or by explicit exceptions held in variables.
- **When a rule has a documented exception** («everything except X»), put the exception in the script explicitly through a variable, not as a hard-coded string.
- **Standard exit codes**: 0 — everything PASSes, 1 — at least one FAIL. A WARN does not affect the exit code.
- **Output format**: `PASS: Rule N` / `FAIL: Rule N: <details>` / `WARN: Rule N: <details>`.
- **Runs in 5-10 seconds on a typical codebase.** If it takes longer, optimise.

---

## When a rule is NOT self-testable

Not every rule can be formalised. These stay in AGENTS.md, but **we do not try to check them in the audit script**:

- **Semantic** («code must be readable») — cannot be formalised.
- **UX rules** («show a clear error») — need manual QA.
- **Process rules** (Conventional Commits) — a separate linter (commitlint).
- **Rules that need runtime data** (RLS policy enforcement) — a separate integration test.

For these → mark them in AGENTS.md as **«checked by eye»** or **«checked in an integration test»**, so there is no illusion of automation.

---

## Maintenance discipline

- **A new AGENTS.md rule** → a new probe in the audit script (if it can be formalised).
- **A rule removed** → remove the probe.
- **A rule changed** → update the probe + its negative test.
- **Without a negative test a probe does not count as implemented** — otherwise you can silently break a regex and believe everything PASSes.

The script itself is documentation. Every probe in it = a line in AGENTS.md. A mismatch is visible right away in code review (a PR changed a rule but did not update the probe).

---

## Continuous validation — three levels

| Level                            | Who runs it               | When it fails                               | Protects against                                     |
| -------------------------------- | ------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| **Local** (`npm run audit:docs`) | The developer before a PR | If forgotten, drift reaches review          | Skipping it                                          |
| **Pre-push** (`.husky/pre-push`) | `git push`                | The author knows before opening the PR      | `--no-verify` can bypass it, but on average it works |
| **CI on PR**                     | GitHub Actions            | The reviewer sees red CI and does not merge | Authoritative gate, cannot be bypassed               |

For a solo project local is enough. For a team → CI is mandatory. **Pre-push is a compromise between speed and reliability** (~10 s on every push).

### `npm run audit:docs`

In `package.json`:

```json
"scripts": {
  "audit:docs": "bash scripts/audit-ai-docs.sh",
  "audit:docs:react": "bash scripts/audit-ai-docs.react-next.sh"
}
```

### `.husky/pre-push`

```bash
echo "▶ Audit AI documentation..."
npm run audit:docs || {
  echo "AI-docs audit failed. Run npm run audit:docs locally and fix."
  exit 1
}
```

### CI on PR

```yaml
- name: Audit AI documentation
  run: npm run audit:docs
```

---

## Sub-agent: living-docs-auditor

The script is called directly and is a gate on its own. In addition, if you have an external AI Factory installed (the installer does not install it), it wires the same `living-docs-auditor` sub-agent under `/aif-verify`, which:

1. Runs `audit-ai-docs.sh`
2. Parses the output
3. For each FAIL writes a human-readable explanation linking to the specific rule in AGENTS.md
4. If everything PASSes, outputs «VERDICT: ALL PROBES PASSED»

See `agents/living-docs-auditor.md` in this package.

---

## Anti-patterns

- ❌ **CI only, with no local command** — a slow feedback loop; the developer does not know where it failed.
- ❌ **An audit with `set +e`** (continuing after a FAIL) — the first red gets lost, and the agent sees warnings mixed in.
- ❌ **An audit without a negative test** — the grep filter is accidentally broken, everything PASSes, nobody notices.
- ❌ **A probe that only checks «the file exists»** — that is §drift detection, not code-vs-docs consistency.
- ❌ **A regex with backreferences and no tests** — works fine 99% of the time, breaks on an edge case.
- ❌ **A probe dozens of lines long for one rule** — if it is that hard, the rule is not a fit for self-testing; leave it «by eye».
- ❌ **Bash comments instead of function names** — `# rule 14` cannot be found with grep; a function `probe_rule_14_verify_magic_bytes()` can.

---

## Related

- `references/doc-organization.md` — hot/cold split of AGENTS.md, drift detection §5.1-5.5.
- `agents/living-docs-auditor.md` — the sub-agent that runs the audit script and interprets PASS/FAIL. Called directly; if you have an external AI Factory, it is also wired under `/aif-verify`.
- `packages/core/audit-self/audit-ai-docs.sh` — the reference for server-side TS.
- `packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh` — the reference for the UI stack.
- `references/overview.md` Layer 5 — Living Documentation as the principle of which self-testing AI documentation is a special case.
