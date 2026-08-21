# Consumer-setup auto-write (relax NC-3) — I-phase kickoff

> **Mode:** small I-phase (code + docs change to a shipped artefact). Scoped tight: make `setup-runtime-bridge.sh` able to auto-write the consumer's `.claude/settings.json` (with consent + safety), instead of only printing a snippet.
> **Origin:** live setup session 2026-05-31. Maintainer insight: the `settings.json` deny-list binds only the **AI agent's tool calls**, NOT a shell script the human (or `install.sh`) runs. So a bash setup script CAN safely write `settings.json` — NC-3 ("print, don't write") is stricter than necessary for the consumer path.
> **Umbrella:** parallel to `runtime-bridge-mcp-dispatch-fix`. Use a git worktree (`bash scripts/create-worktree.sh consumer-setup-autowrite` or `claude -w consumer-setup-autowrite`) — parallel-subwave-isolation.md. File-scope note: this touches `scripts/` + `docs/` + hook *comment*; the MCP-fix umbrella touches `src/*.ts` — minimal overlap, but isolate anyway.
> **PR base:** staging.

## §0 The change

Today `setup-runtime-bridge.sh` (per NC-3, round-6) **only prints** the `settings.json` PostToolUse entry for the consumer to paste by hand, because `settings.json` is "agent-self-protected". The insight: that protection is an *agent* deny-list — a shell script run by a human is not the agent and is not blocked. So the consumer-facing setup script should **offer to auto-write** the entry itself (with a `--no-write` / "print only" fallback).

**Proven this session:** `/Users/art/code/aif-handoff/setup-bridge-local.sh` did exactly this on the maintainer's machine — idempotent python JSON patch, `.bak` backup, JSON validation before swap, preserves all existing PostToolUse hooks. **Use it as the implementation template** (it works; verified: PostToolUse 5→6, existing 5 preserved, re-run skips).

## §1 Scope (tight — "работы немного")

1. **`packages/runtime-bridge/scripts/setup-runtime-bridge.sh`:** in the `yes` branch, after copying the hook, ADD a step that patches `.claude/settings.json`:
   - append the PostToolUse entry `{matcher:"Write|Edit|MultiEdit", hooks:[{type:"command", command:"bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/runtime-bridge-dispatch.sh\""}]}`;
   - **idempotent** (skip if the `runtime-bridge-dispatch.sh` command already present);
   - **backup** `settings.json` → `settings.json.bak` before write;
   - **preserve** all existing PostToolUse entries (parse + append, never overwrite);
   - **validate** JSON before replacing (atomic temp-then-rename);
   - use `python3` if present, else fall back to **print-the-snippet** (current NC-3 behaviour) — never leave a half-written/corrupt file;
   - gate behind consent: a `--no-write-settings` flag (or a y/n prompt) keeps the print-only path for users who manage settings.json themselves.
2. **`docs/runtime-bridge-setup.md`:** update the Quick-start text «it never edits `settings.json` for you — that file is agent-protected» to reflect the new auto-write-with-consent behaviour + the fallback. Keep the Authoritative-for header.
3. **`.claude/hooks/runtime-bridge-dispatch.sh` comment:** the `NC-3 (round-6): Do NOT wire this into .claude/settings.json automatically` note — update/qualify: the *agent* must not; the *consumer setup script* (human-run) may, with backup+validation.
4. **Record the NC-3 relax rationale** where NC-3 was decided (kickoff round-6 / the runtime-bridge umbrella) so the loosening is traceable, not silent.

## §2 Discipline (shipped artefact — do not skip)

- **Prior-art:** there IS a direct precedent — aif-handoff's own `installMcpServer` writes the AI-runtime config (`~/.claude.json` / `~/.codex/config.toml`) from a setup action (DeepWiki, 2026-05-31). Cite it: "setup-script writes AI-runtime config" is an established pattern, not novel. Add/confirm an SSOT row if this counts as a capability commit (the script grows ≥? LOC — check the capability-commit definition in CLAUDE.md).
- **dual-implementation-discipline.md §3:** this is the consumer-facing setup script (consumer-facing → the auto-write is the convenience; print-only fallback = graceful degradation when `python3`/`jq` absent — §8 `#subscription-conflation`-style "degrade gracefully"). Carry the `@dual-pair` / `@cc-only-rationale` discipline if applicable.
- **doc-authority-hierarchy.md:** `docs/runtime-bridge-setup.md` already carries an Authoritative-for header — keep it, update only the behavioural claim.
- **§1.7 forward+backward** self-check in the PR body.
- **no-paid-llm-in-ci.md:** pure bash + python json — trivially compliant.
- **NC-3 is not deleted, it's scoped:** the *agent* still must never write settings.json (the deny-list stays); only the *human-run consumer setup script* gains the ability. Make that distinction explicit in the doc + commit message.

## §3 AI laziness traps (per ai-laziness-traps.md §2 — MANDATORY)

Active: **T3** (verify the JSON-patch on a copy, show before/after entry counts — the template script already does this), **T5** (don't expand scope into the MCP-dispatch fix — that's the other umbrella), **T11** (the aif-handoff `installMcpServer` prior-art — cite, don't reinvent the "should a script touch settings?" question), **T15** (self-application: the relax must not weaken the *agent* deny-list — only the human-script path), **T16** (don't assume "settings.json protection" means "nothing may write it" — it means "the agent's tools may not"; verify the distinction), **T19** (own cold-QA: run the patched script against a throwaway settings.json with pre-existing hooks, confirm none clobbered), **T20** (back the "deny binds only the agent" claim with the actual deny-list entries — `Edit/Write(.claude/settings.json)` are Edit/Write *tool* permissions, not a filesystem lock).
Domain-specific: **T-NC3-A** — «tempted to make auto-write unconditional/default-on; but a consumer may hand-manage settings.json or have a non-standard hooks block — auto-write MUST be idempotent + backup + consent, never silent clobber». Counter: test against a settings.json that already has 5 unrelated PostToolUse hooks (like this repo) and prove all survive.

## §4 Read-first
1. `packages/runtime-bridge/scripts/setup-runtime-bridge.sh` (the `yes` branch + the NC-3 print block).
2. `/Users/art/code/aif-handoff/setup-bridge-local.sh` — **the working template** (python idempotent JSON patch + backup + validate). NOTE: this path is outside the repo (maintainer's local proof-of-concept); copy the logic, adapt paths to `$CLAUDE_PROJECT_DIR`.
3. `docs/runtime-bridge-setup.md` (Quick-start + the "never edits settings.json" claim to update).
4. `.claude/hooks/runtime-bridge-dispatch.sh` (NC-3 comment header).
5. `.claude/rules/dual-implementation-discipline.md` + `doc-authority-hierarchy.md` + `no-paid-llm-in-ci.md`.
6. CLAUDE.md «capability commit» definition (does this cross the LOC threshold → Prior-art trailer + SSOT).

Finish REPORT with: PR# · what auto-write does + fallback path · proof existing hooks preserved (before/after) · §1.7 presence · `## 🟢 Простыми словами`.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
