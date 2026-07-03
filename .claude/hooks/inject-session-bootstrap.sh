#!/usr/bin/env bash
# Wave 7 sub-wave 7.2.a — UserPromptSubmit hook: inject session-bootstrap digest.
# stdout is injected into Claude Code's prompt context by the harness automatically.
# Full bootstrap: .claude/session-bootstrap.md (Step 0 read-first file).
# @cc-only-rationale: internal dev tooling — UserPromptSubmit digest injection for the
#   maintainer's own environment; no portable hook fires at prompt-submit. The digest
#   content lives in .claude/session-bootstrap.md, readable by any harness.

cat <<'DIGEST'
[session-bootstrap digest — auto-injected at prompt submit]
Goal: AI agents can't silently bypass undocumented conventions. Every rule is an executable artifact that fails at the earliest reachable channel — edit-time → pre-commit → pre-push → CI → production audit. CI = last-resort gate. (README.md#why-this-exists)
Invariants: (1) build-vs-reuse SSOT consult before capability commit + build-first-reuse-default discipline (.claude/rules/build-first-reuse-default.md); (2) recursive self-application green (make self-audit); (3) search-coverage 6-item checklist on negative-existence claims; (4) multi-channel enforcement — every rule fails at earliest reachable channel (CI = last resort).
Step-0 reading order: README.md → .claude/session-bootstrap.md → CLAUDE.md → task-specific docs.
Recommendation discipline (H1): before issuing a verdict/recommendation (ADOPT/BUILD/REJECT/DEFER, «we should X», «use Y», «pick A over B») — (1) cite SSOT/prior-art by ID, (2) give file:line or command-output evidence, (3) state what would falsify it («wrong if …»), (4) for «nothing exists» claims run the 6-item search check. An unbacked verdict is provisional, not load-bearing. This is a reminder, not a gate. (see also .claude/rules/recommendation-laziness-discipline.md + T-trap in ai-laziness-traps.md §2) (.claude/rules/phase-research-coverage.md §1.7)
Full bootstrap + reviewer drift-prevention flowchart: .claude/session-bootstrap.md
[/session-bootstrap digest]
DIGEST

# B1 (language-discipline): when the operator pins a non-English human-facing language,
# tell the model — every turn, all skills. Precisely scoped so repo artifacts stay English.
# See .claude/rules/language-discipline.md §2.
case "${AIF_HOOK_LANG:-en}" in
  en|'') : ;;  # English default — nothing to inject
  ru)
    cat <<'LANGRU'
[output-language] Address the operator in Russian — chat explanations, recaps, narration, questions. Keep ALL repo artifacts and machinery in English: code, comments, commit/PR/issue bodies, kickoffs, specs, tool arguments, file contents. (AIF_HOOK_LANG=ru)
LANGRU
    ;;
  *)
    printf '[output-language] Address the operator in language "%s"; keep repo artifacts and machinery in English. (AIF_HOOK_LANG=%s)\n' "$AIF_HOOK_LANG" "$AIF_HOOK_LANG"
    ;;
esac
