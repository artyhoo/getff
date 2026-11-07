---
name: template-audit
description: 'Use when auditing rendered templates via local advisory review. Triggers: template, audit, render, generated docs, AGENTS.md, paraphrase, cue placement, local advisory, template-render, audit-template.'
---

<!-- @harness-posture: portable — prose advisory audit checklist; no harness primitives -->

# template-audit — local advisory skill

> **Authoritative for:** local advisory template audit skill — trigger keywords, two-step procedure, P2/P3/P5 advisory checks, promotion trigger.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](https://github.com/artyhoo/getff/blob/main/README.md#why-this-exists). Deterministic CI gate — see [template-render.audit.ts](https://github.com/artyhoo/getff/blob/main/packages/core/audit-self/template-render.audit.ts).

Session-bound advisory audit. **FREE under Claude Code subscription.** No API key. Not blocking.

## Procedure

**Step 1 — Deterministic probes (framework checkout only)**

Preserve supplied rendered-document paths before changing cwd: relative targets
are invocation-cwd-relative; absolute targets remain unchanged. Bind the nearest
project through its native plugin binding below. Preserve invocation cwd for inputs.
Use that bound project for runner and delivered-check paths. Checking `scripts/`
from a nested cwd cannot establish that the project has no delivered checks.
Execute this binding through the shell tool, passing only the supplied document
paths as separately quoted positional arguments (none when no paths were supplied):

<!-- template-audit:bind -->
```bash
getff_invocation_cwd="${getff_invocation_cwd:-$PWD}"
[ "${getff_arguments+x}" = x ] || getff_arguments=("$@")
GETFF_SKILL_DIR="${CLAUDE_SKILL_DIR}"
[ -n "$GETFF_SKILL_DIR" ] && [ -f "$GETFF_SKILL_DIR/SKILL.md" ] || {
  printf '%s\n' 'STOP: missing native plugin skill/resource root (CLAUDE_SKILL_DIR)' >&2
  exit 2
}
_getff_require_resource() {
  [ -f "$GETFF_SKILL_DIR/\$1" ] || {
    printf 'STOP: missing plugin resource: %s\n' "$GETFF_SKILL_DIR/\$1" >&2
    return 2
  }
}
GETFF_PROJECT_ROOT="$getff_invocation_cwd"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/template-audit/SKILL.md" ] && [ "$GETFF_PROJECT_ROOT" != / ]; do
  GETFF_PROJECT_ROOT="$(dirname "$GETFF_PROJECT_ROOT")"
done
if [ "$GETFF_PROJECT_ROOT" = / ]; then
  GETFF_PROJECT_ROOT="${CLAUDE_PROJECT_DIR}"
  GETFF_PROJECT_ROOT="$(cd "$GETFF_PROJECT_ROOT" 2>/dev/null && pwd -P)" || { printf '%s\n' 'STOP: missing native plugin project directory' >&2; exit 2; }
  [ -d "$GETFF_PROJECT_ROOT" ] || { printf '%s\n' 'STOP: missing native plugin project directory' >&2; exit 2; }
  getff_containment_cwd="$(cd "$getff_invocation_cwd" && pwd -P)" || exit 2
  case "$getff_containment_cwd/" in
    "$GETFF_PROJECT_ROOT/"*) ;;
    *) printf '%s\n' 'STOP: native plugin project directory does not contain invocation cwd' >&2; exit 2 ;;
  esac
fi
rendered_documents=()
for input in "${getff_arguments[@]}"; do
  case "$input" in
    /*) rendered_documents+=("$input") ;;
    *) rendered_documents+=("$getff_invocation_cwd/$input") ;;
  esac
done
cd "$GETFF_PROJECT_ROOT" || exit 2
```

Keep the resulting bound root and target paths for subsequent shell invocations.
First verify
`packages/core/package.json` contains `test:template-render`. If present in the
framework checkout, execute the following command through the shell tool from that
root; reading its declaration is not execution:

```bash
npm --prefix packages/core run test:template-render
```

Preserve the actual command, cwd, shell output and exit status from this invocation.
If it fails, stop before Step 2 and report the failure; fix and rerun only within the
operator's authorized scope. If execution is unavailable, report UNVERIFIED with
the observed tool diagnostic rather than inventing an exit status.

In a consumer, inspect the actual rendered documents and use its delivered checks
where available; record the framework runner as unavailable. Do not run a fabricated
equivalent or label advisory inspection CI-equivalent.

**Step 2 — LLM advisory checks (session-bound, P2/P3/P5)**

Use the current agent session (no additional API call). Inspect the rendered document
path supplied by the operator; otherwise use the consumer's installed `AGENTS.md`.
In a framework checkout, use an actual disposable install output; if none is
available, report the rendered target unavailable. The framework's own `AGENTS.md`
and a template source are not evidence of consumer rendering. A missing supplied
target is unavailable, never permission to silently substitute another file:

- **P2 — Paraphrase fidelity**: Does rendered `AGENTS.md` convey that each rule
  has an executable check that fails at the earliest reachable channel
  (edit-time → pre-commit → pre-push → CI → production audit), with CI as the
  last resort? This is the framework goal from README, not the consumer's product
  goal. Does wording instead reduce enforced rules to guidelines/suggestions?
- **P3 — Cue placement**: Is the session-bootstrap cue in the first 10 lines of
  rendered `AGENTS.md`?
- **P5 — Synonym coverage**: Does the P1 synonym list in `template-render.audit.ts`
  still match current template phrasing (no synonym drift)?

For P5, if the framework audit source is absent, record the synonym-list comparison as unavailable. Report P2/P3/P5 as **advisory** (not blocking), with observations and unavailable probes distinguished. Record any drift locally; open an external follow-up issue only if authorized.

## Without this skill

An agent treats a visual inspection of rendered consumer documents as a passing framework CI run, even when the runner and synonym source are not installed. Goal phrasing and cue placement can drift without an honest verification record.

## With this skill

The agent runs the real framework probes where available and inspects actual consumer output otherwise. It reports fidelity, cue placement and synonym coverage separately, recording missing probes explicitly instead of turning an advisory review into a false green.

## Promotion trigger

Promote P2/P3/P5 → CI gate when:

- Deterministic CI PASS rate <80% over 30 days, OR
- Consumer reports goal-phrase miss not caught by P1/P4/P6.

Promotion path: re-evaluate Decision 3 in [closed-questions.md §13.27](https://github.com/artyhoo/getff/blob/main/docs/meta-factory/closed-questions.md).

<!-- getff:common-invocation-binding -->
## Native plugin invocation binding

Preserve the complete supplied arguments and operator request. Execute this native
plugin binding before resolving resources. Native Skill supplies CLAUDE_SKILL_DIR;
use the actual plugin directory even when a universal installation also exists.
Keep supplied relative inputs invocation-cwd-relative and absolute paths unchanged.

<!-- plugin-native:bind -->
```bash
getff_invocation_cwd="${getff_invocation_cwd:-$PWD}"
[ "${getff_arguments+x}" = x ] || getff_arguments=("$@")
GETFF_SKILL_DIR="${CLAUDE_SKILL_DIR}"
[ -n "$GETFF_SKILL_DIR" ] && [ -f "$GETFF_SKILL_DIR/SKILL.md" ] || {
  printf '%s\n' 'STOP: missing native plugin skill/resource root (CLAUDE_SKILL_DIR)' >&2
  exit 2
}
_getff_require_resource() {
  [ -f "$GETFF_SKILL_DIR/\$1" ] || {
    printf 'STOP: missing plugin resource: %s\n' "$GETFF_SKILL_DIR/\$1" >&2
    return 2
  }
}
GETFF_PROJECT_ROOT="$getff_invocation_cwd"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/template-audit/SKILL.md" ] && [ "$GETFF_PROJECT_ROOT" != / ]; do
  GETFF_PROJECT_ROOT="$(dirname "$GETFF_PROJECT_ROOT")"
done
if [ "$GETFF_PROJECT_ROOT" = / ]; then
  GETFF_PROJECT_ROOT="${CLAUDE_PROJECT_DIR}"
  GETFF_PROJECT_ROOT="$(cd "$GETFF_PROJECT_ROOT" 2>/dev/null && pwd -P)" || { printf '%s\n' 'STOP: missing native plugin project directory' >&2; exit 2; }
  [ -d "$GETFF_PROJECT_ROOT" ] || { printf '%s\n' 'STOP: missing native plugin project directory' >&2; exit 2; }
  getff_containment_cwd="$(cd "$getff_invocation_cwd" && pwd -P)" || exit 2
  case "$getff_containment_cwd/" in
    "$GETFF_PROJECT_ROOT/"*) ;;
    *) printf '%s\n' 'STOP: native plugin project directory does not contain invocation cwd' >&2; exit 2 ;;
  esac
fi
```

Do not change cwd before resolving supplied arguments against getff_invocation_cwd.
Use GETFF_PROJECT_ROOT for project checks and GETFF_SKILL_DIR for skill resources.
Before reading or executing each mandatory resource, run _getff_require_resource
with its skill-relative path; STOP on its diagnostic and nonzero status. Quote every
path and argument separately and preserve helper exits. Missing companions or
framework-only executables remain explicit prerequisites; plugin discovery grants
no permissions, hook trust, global configuration changes or external messaging.
When explaining an idea, design or workflow with meaningful relationships, use a
small Mermaid diagram plus equivalent readable text in an existing permitted output
section. Preserve strict report grammars and closing anchors. Show only supplied or
verified relationships, label uncertainty, and do not depict an unobserved execution
or authorization as completed. Skip diagrams when they add no explanatory value.
<!-- /getff:common-invocation-binding -->
