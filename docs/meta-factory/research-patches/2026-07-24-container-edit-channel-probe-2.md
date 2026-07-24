> **Authoritative for:** round-2 edit-time channel-probe results — whether PostToolUse gates reach the AI model inside the aif-handoff container after the 2026-07-24 exit-1→exit-2 change.

# Container edit-time channel probe (round 2) — 2026-07-24

- **Task ID:** `3a5cad5f-e487-47be-bcae-87d6755617d8`
- **Branch:** `feature/container-edit-channel-probe-2-3a5cad`
- **Container:** aif-handoff agent (Claude Code, `HANDOFF_MODE=1`)

## §A — The violating write

**Action:** `Write` to `agents/_probe-channel.md` with content:

```markdown
# Probe

This file deliberately lacks the authority header.
```

**Write result:** SUCCEEDED.

```text
File created successfully: /home/www/rules-as-tests-aif-feature-container-edit-channel-probe-2-3a5cad-3a5cad5f-e487-47be-bcae-87d6755617d8/agents/_probe-channel.md
```

**PostToolUse hook output that reached the model (verbatim):**

```text
PostToolUse:Write hook additional context: 📎 Path-relevant rule — Source-before-shape: before creating a capability (new SKILL.md / agent / module) or scoping a dispatch, read the authoritative source FIRST as an input to the shape — grep the SSOT + existing skills/agents for reuse-overlap (thin-adapt or justify BUILD; the trailer's verdict must match what the body does), or re-read the spec's scope-chain. Never author or scope from recall. See .claude/rules/source-before-shape.md + run agents/capability-reuse-auditor.md before handoff. (see .claude/rules/source-before-shape.md)
```

**From `check-doc-authority.sh` (the gate under test):** NOTHING APPEARED. No error, no warning about the missing `> **Authoritative for:**` header. The gate was SILENT.

## §B — The passing case

**Action:** `Edit` on `agents/_probe-channel.md`, replacing `This file deliberately lacks the authority header.` with `> **Authoritative for:** nothing — throwaway channel probe.`

**Edit result:** SUCCEEDED.

```text
The file /home/www/rules-as-tests-aif-feature-container-edit-channel-probe-2-3a5cad-3a5cad5f-e487-47be-bcae-87d6755617d8/agents/_probe-channel.md has been updated successfully.
```

**Hook output:** NOTHING APPEARED. No system-reminder, no additional context, no warning.

## §C — Second gate, different path

**Action:** `Write` to `.claude/orchestrator-prompts/_probe/kickoff.md` with content:

```markdown
# Probe kickoff mentioning ai-laziness-traps with no T-numbers
```

**Write result:** BLOCKED by the permission system. The file was never created.

```text
Claude requested permissions to edit /home/www/rules-as-tests-aif-feature-container-edit-channel-probe-2-3a5cad-3a5cad5f-e487-47be-bcae-87d6755617d8/.claude/orchestrator-prompts/_probe/kickoff.md which is a sensitive file.
```

**Hook output:** NONE — the `check-kickoff-traps.sh` PostToolUse hook never ran because the Write was denied before the tool executed.

**Cleanup:** the file was never created, so there was nothing to delete. Verified: `ls .claude/orchestrator-prompts/_probe/` → `No such file or directory`.

## §D — Per-gate verdicts

| Gate | Step | Verdict | Root cause |
|---|---|---|---|
| `check-doc-authority.sh` (principle-09 authority header) | A | **SILENT** | Hook ran but exited 0 at line 26 — `node_modules/.bin/tsx` is not installed in this container → graceful no-op (`⚠ check-doc-authority: tsx not found — skipping` printed to stderr, exit 0) before reaching the violation-detection code. The exit-1→exit-2 fix is irrelevant because the hook never reaches the detection path. |
| `check-kickoff-traps.sh` (T-enumeration floor) | C | **BLOCKED-BEFORE-HOOK** | Claude Code's permission classifier denied the Write to `.claude/orchestrator-prompts/**` as a "sensitive file" — the tool never executed, so no PostToolUse hook fired. |
| `inject-matching-rule.sh` (incidental — not under test) | A | **REACHED-ME** | This hook uses pure bash (no `tsx` dependency) and delivers via stdout JSON `additionalContext`. Its "Source-before-shape" injection DID reach the model as a `<system-reminder>` block. |

### Root-cause analysis

The `check-doc-authority.sh` hook delegates to `packages/core/principles/09-doc-authority-hierarchy.bin.ts` via `npx tsx`. In this container:

- `jq`: installed (`/usr/bin/jq`) ✓
- `09-doc-authority-hierarchy.bin.ts`: exists ✓
- `node_modules/.bin/tsx`: **MISSING** ✗

The script's graceful-degradation design (lines 25-27 of `check-doc-authority.sh`) silently skips when `tsx` is absent — `exit 0`, warning to stderr. The Claude Code hook runner treats `exit 0` as success and does not surface the stderr warning to the model. Result: the gate is structurally inert in any container where devDeps (`tsx`) are not installed.

This is consistent with the known container devDeps gap: `NODE_ENV=production` npm install skips devDependencies (`tsx`, `vitest`, etc.).

**Note on `check-kickoff-traps.sh`:** this hook uses pure bash (`jq` + `grep`, no `tsx`) and would likely have worked if the Write hadn't been blocked. However, it still uses `exit 1` (line 52), not `exit 2` — so even if it had fired, the exit-1→exit-2 fix would not apply to this gate.

## §E — Comparison with round 1

Round 1 targeted `.claude/rules/*.md` and was blocked by the permission classifier (same mechanism as §C above). Round 2 used `agents/*.md` — the Write was permitted, advancing past the permission layer to where the PostToolUse hook should fire. But the gate (`check-doc-authority.sh`) silently no-ops because its `tsx` runtime dependency is absent from the container, so the exit-code path the fix was designed to test is never reached. The permission layer is no longer the blocker for `agents/*.md`; the missing devDep is.
