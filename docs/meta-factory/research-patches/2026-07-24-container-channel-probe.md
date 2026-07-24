> **Authoritative for:** the 2026-07-24 container-channel-probe report — verbatim captures of what the worker observed when probing gate reachability after the 2026-07-24 staging fixes. Append-only research-patch artefact, scope-bound by gap ID `container-channel-probe-0cedb6`.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The parity audit that motivated this probe — see [`docs/meta-factory/research-patches/2026-07-23-container-channel-parity-audit.md`](./2026-07-23-container-channel-parity-audit.md) (predecessor). The gate implementations themselves — see [`scripts/render-harness-config.mjs`](../../../scripts/render-harness-config.mjs) and `.claude/hooks/check-doc-authority*`.

# Container channel probe — 2026-07-24

Worker: GLM-5.2 in `aif-handoff-agent-1` container, branch `feature/container-channel-probe-0cedb6`, prepared worktree at `/home/www/rules-as-tests-aif-feature-container-channel-probe-0cedb6-0cedb6bd-fc50-48c0-8ed0-8abae47ff235`.

## §A — Dependency output (verbatim)

Command:
```text
for t in jq gh python3 node npx; do printf '%s: ' "$t"; command -v $t || echo MISSING; done; ls -ld /home/node/.npm
```

Captured stdout:
```text
jq: /usr/bin/jq
gh: /usr/bin/gh
python3: /usr/bin/python3
node: /usr/local/bin/node
npx: /usr/local/bin/npx
drwxr-xr-x 1 node node 4096 Jul 24 00:08 /home/node/.npm
```

All five tools present on PATH. `/home/node/.npm` exists and is owned by `node:node` (not root-owned — diverges from the older `project_handoff_npm_cache_root_owned` memory; the fixed image corrected ownership).

## §B — Verbatim capture (violating rule file)

Target file: `.claude/rules/_probe-channel.md` with content exactly:
```text
# Probe

This file deliberately lacks the authority header.
```

First Write call returned this tool output (verbatim):
```text
Claude requested permissions to edit /home/www/rules-as-tests-aif-feature-container-channel-probe-0cedb6-0cedb6bd-fc50-48c0-8ed0-8abae47ff235/.claude/rules/_probe-channel.md which is a sensitive file.
```

Second Write call (retry) returned identically:
```text
Claude requested permissions to edit /home/www/rules-as-tests-aif-feature-container-channel-probe-0cedb6-0cedb6bd-fc50-48c0-8ed0-8abae47ff235/.claude/rules/_probe-channel.md which is a sensitive file.
```

No system-reminder blocks. No hook output. No additional context injected. The Write tool never landed the file — both attempts were intercepted by Claude Code's permission classifier on the `sensitive file` heuristic for paths under `.claude/rules/`.

The PostToolUse `check-doc-authority.sh` gate therefore never had a chance to fire — the violation it would catch (missing `> **Authoritative for:**` header) was preempted by a higher layer (permission classifier) that sits in front of the entire PostToolUse channel for this path class.

## §C — Verbatim capture (passing case)

The file does not exist (§B Write was blocked), so the Edit step could not be performed. Skipped — `NOTHING APPEARED` because the Edit was not attempted.

## §D — Commit-time gates

**Round 1 — rejected.** Pre-commit hook ran markdownlint-cli2 via `npx`. Full output:
```text
npm warn exec The following package was not found and will be installed: markdownlint-cli2@0.23.1
markdownlint-cli2 v0.23.1 (markdownlint v0.41.1)
Finding: docs/meta-factory/research-patches/2026-07-24-container-channel-probe.md
Linting: 1 file
Summary: 5 issues in 1 file
docs/meta-factory/research-patches/2026-07-24-container-channel-probe.md:11 error MD040/fenced-code-language Fenced code blocks should have a language specified [Context: "```"]
docs/meta-factory/research-patches/2026-07-24-container-channel-probe.md:16 error MD040/fenced-code-language Fenced code blocks should have a language specified [Context: "```"]
docs/meta-factory/research-patches/2026-07-24-container-channel-probe.md:30 error MD040/fenced-code-language Fenced code blocks should have a language specified [Context: "```"]
docs/meta-factory/research-patches/2026-07-24-container-channel-probe.md:37 error MD040/fenced-code-language Fenced code blocks should have a language specified [Context: "```"]
docs/meta-factory/research-patches/2026-07-24-container-channel-probe.md:42 error MD040/fenced-code-language Fenced code blocks should have a language specified [Context: "```"]
❌ markdownlint-cli2 violations — fix before commit
```
Exit code 1. Commit did not land. Per task instructions ("fix only what the gate names"), applied MD040 fix — added `text` language specifier to all five fenced code blocks. No other content changes.

**Round 2 — retry pending** (output to be appended once retry runs).

## §E — Per-channel verdict

- **Edit-time PostToolUse gate (`check-doc-authority.sh` on Write/Edit to `.claude/rules/**`):** `SILENT` — but not because the hook is unregistered or jq-missing; the gate is preempted by Claude Code's permission classifier, which blocks Write to `.claude/rules/*.md` before any PostToolUse matcher runs. The hook cannot reach the model on this path because a higher layer refuses to let the Write land.
- **Permission-classifier layer (Claude Code built-in, sensitive-file heuristic):** `REACHED-ME` — this is the layer that actually intercepted the probe. Its message (`requested permissions to edit ... which is a sensitive file`) is the only feedback that reached the model context.
- **UserPromptSubmit injection (session-bootstrap digest, H1 reminder, etc.):** `REACHED-ME` — present from the very first prompt turn (visible in the injected `<system-reminder>` block at the top of the conversation).
- **Commit-time markdownlint gate (pre-commit hook):** `REACHED-ME` — fired on round 1, exit-code-1, named exactly what to fix (MD040 on five fenced blocks).

## §F — What surprised me

1. **The blocking layer on `.claude/rules/**` is the permission classifier, not the registered gate.** The probe was designed assuming the Write would succeed and then the PostToolUse hook would catch the missing-header violation. In this container, the Write never succeeds — `.claude/rules/*.md` is treated as a sensitive path and the permission layer refuses without ever consulting the registered hook. The PostToolUse channel is structurally unreachable for this probe target.

2. **markdownlint-cli2 reached me through npx without an `npm_config_cache=` override.** This contradicts the older `project_handoff_npm_cache_root_owned` memory, which predicted commit-time failure because `npx` hit a root-owned cache. The §A probe shows `/home/node/.npm` is now owned by `node:node` — the 2026-07-24 image fixed the ownership, and `npx markdownlint-cli2` installed and ran cleanly. Memory needs updating (left for follow-up; this task is report-only).

3. **The `/home/node/.npm` ownership is the only divergence from the prior incident baseline.** Everything else on the dependency axis reads as the fixed image intends (`jq`, `gh`, `python3`, `node`, `npx` all on PATH; no MISSING).

4. **The probe's success criterion is honest reporting.** A `SILENT` verdict on the PostToolUse channel is the truthful answer here — and per the task's own framing, "a truthful `SILENT` is a better outcome than a flattering `REACHED-ME`." The interesting nuance is *why* it is silent: not because the gate is broken, but because a different layer (permission classifier) intercepts first. This is a channel-reach finding the parity audit did not anticipate.

5. **Plan file was missing.** The dispatch referenced `@.ai-factory/plans/container-channel-probe.md`, which did not exist in the worktree at dispatch time. The task Description WAS the spec. Noted as a bookkeeping discrepancy; not a probe finding.
