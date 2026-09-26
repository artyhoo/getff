---
title: worktree-setup hook
description: "`claude --worktree <name>` normally creates a bare worktree. This hook replaces that moment with a provisioned one: node_modules linked, the base ref refreshed, the coordination store wired — or a loud refusal."
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/worktree-setup.sh
  - .claude/rules/zcode-parity-doctrine.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/reference/D/adopt-orchestrator-prompts.md
  - docs/site/terms.md
  - packages/core/hooks/worktree-setup-hydration.test.ts
  - packages/core/hooks/worktree-setup.test.ts
  - scripts/create-worktree.sh
  - scripts/link-coordination.sh
  - scripts/worktree-node-modules.sh
executed:
  - { example: worktree-setup-refuses-a-payload-without-a-name, stack: repo, date: 2026-09-25, result: printed }
  - { example: worktree-setup-creates-a-provisioned-worktree-and-prints-only-its-path, stack: repo, date: 2026-09-25, result: printed }
  - { example: worktree-setup-reuses-an-existing-worktree-path-idempotently, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# worktree-setup hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim, including the deliberate unregistered token -->

<!-- getff:begin section=D-card-worktree-setup plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `worktree-setup` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | WorktreeCreate hook — provisions a new worktree with node_modules symlinks |
| source | `.claude/hooks/worktree-setup.sh:2` |
| event | `{"absent":"unregistered"}` |
| matcher | `{"absent":"unregistered"}` |
| delivery | `["@dual-pair:worktree-create-setup"]` |
<!-- getff:end section=D-card-worktree-setup -->

<!-- vale on -->

## Explanation

This is the one hook in the family that is allowed to say no. Its contract
(header lines 9-13): read `{"name": …}` from stdin, and print **only** the
worktree path on stdout — a second line would break Claude Code's parsing —
while a non-zero exit blocks the worktree from being created at all. That
makes it the opposite of the injection hooks: it is a [gate](../../terms.md#gate)
on the harness's own worktree creation, which is why its jq guard exits 1
(lines 39-44) where every injector in this family exits 0.

What "provisioned" means, in order. The branch is `worktree-<name>` (line 67),
cut from a base ref that was *refreshed first* — a local `origin/HEAD` frozen
at an old default branch is exactly the stale-base bug this replaced (lines
78-84) — falling back through `origin/main`, `main`, `HEAD` (line 88). Then
`scripts/worktree-node-modules.sh` links node_modules from the primary
checkout instead of running an install (lines 112-118; the divergence from a
naive npm-install is recorded at header lines 22-25, and the shared script is
the same one `scripts/create-worktree.sh` calls — one implementation, two
entry points, the `@dual-pair:worktree-create-setup` on the card). A tsx
self-heal follows for a worktree whose primary lost its binaries (lines
120-145). Last, the coordination store: `scripts/link-coordination.sh` links
the worktree's `.claude/orchestrator-prompts/` into the canonical store — the
same world [adopt-orchestrator-prompts](adopt-orchestrator-prompts.md) guards
at write time — and if that helper is missing, the hook is loud about what did
not happen (lines 153-166).

A bare temp repo shows both the refusal and the provisioning. No name, no
worktree:

```bash
printf '%s' '{}' | bash .claude/hooks/worktree-setup.sh
```

```text
⚠ worktree-setup: missing .name in WorktreeCreate stdin payload
```

Exit 1. Now a real creation in a throwaway repo (the demo checkout lacks the
helper scripts, so the loud misses fire exactly as designed; the only stdout
line is the path):

```bash
R="$(mktemp -d)/repo"; mkdir -p "$R" && cd "$R"
git init -q . && git -c user.email=you@example.com -c user.name=you commit -q --allow-empty -m init
printf '%s' '{"name":"docs-demo"}' | bash .claude/hooks/worktree-setup.sh
```

```text
bash: /tmp/t5wt/repo/scripts/worktree-node-modules.sh: No such file or directory
⚠ worktree-setup: /tmp/t5wt/repo/scripts/link-coordination.sh not found — orchestrator-prompts NOT linked to the canonical store; files created under .claude/orchestrator-prompts/ in this worktree are sole-copy until scripts/link-coordination.sh is run manually
/tmp/t5wt/repo/.claude/worktrees/docs-demo
```

In a real getff checkout those helpers exist, the provisioning runs silently,
and the path line is still the only thing on stdout (lines 169-170). Run the
same input again and the existing worktree is reused — same path, exit 0 —
with the provisioning re-attempted but the link step skipped (lines 72-74
short-circuit before it). That reuse-then-reprovision is deliberate: a stale
`.vite` cache inside an old worktree was the 2026-07-23 incident that turned
"idempotent" into "idempotent AND re-provisioned". In the parity census this
is row 20, `cc-only` (maintainer-applied scaffolding): WorktreeCreate is a
Claude-Code harness feature, absent from ZCode entirely, and the hook is
deliberately not registered in `.claude/settings.json` — it reaches your
machine only if you wire it by hand.

## Evidence

- `.claude/hooks/worktree-setup.sh:2` is the header the card's description row
  quotes: `# worktree-setup.sh — WorktreeCreate hook — provisions a new worktree with node_modules symlinks`.
- Contract: header lines 9-13 — stdin JSON `.name`; «Print path — the ONLY thing on
  stdout per CC command-hook contract»; exit non-zero CAN BLOCK; the dual-pair note
  at lines 27-33 names `scripts/create-worktree.sh` as the portable counterpart.
- Guards that block: jq missing → exit 1 at lines 39-44; missing `.name` at
  lines 46-52; unresolvable project root at lines 54-64 (exit at 63).
- Paths: lines 66-67 — `.claude/worktrees/<name>` and branch `worktree-<name>`.
- Idempotent reuse: lines 72-74 — re-provision via `worktree-node-modules.sh --apply`,
  print the path, exit before the link step; header line 20 records the contract.
- Base ref: lines 78-84 refresh `origin/HEAD` (the 2026-05-30 stale-base fix); the
  cascade loop at line 88; the base-ref RED — «⚠ worktree-setup: cannot resolve a
  base ref (origin/HEAD, origin/main, main, HEAD all missing)» — at lines 95-96.
- Creation: lines 99-108 (`git worktree add` with an existing-branch fallback at
  103-108).
- Provisioning: lines 112-118 call `scripts/worktree-node-modules.sh` — ONE canonical
  implementation (comment at 113-117); tsx self-heal conditions at lines 133-136 with
  the stale-primary incident (≈48-minute drift, vite clobber) at lines 123-126.
- Coordination link + loud miss: lines 147-167; the standalone literal warning line at
  lines 160-163 exists so a paired-negative test can strip it from output.
- stdout contract: lines 169-170 — `printf '%s\n' "$WORKTREE_DIR"` and nothing else.
- Census row 20 (`.claude/rules/zcode-parity-doctrine.md` §2): `cc-only`
  (maintainer-applied scaffolding) — «impossible (event ∉ `ZCODE_EVENTS`); CC harness
  feature, not in default settings».
- Paired tests: `packages/core/hooks/worktree-setup.test.ts` — path-on-stdout creation
  (line 205), node_modules symlinks (213, 220, 234), tsx self-heal (243) and its no-op
  twin (283), branch convention (308), idempotent reuse (316), single-line stdout
  (324), env precedence (331); `worktree-setup-hydration.test.ts` — the coordination
  symlink present after creation (196), the paired-negative without the link call
  (211), and hook↔script dual-pair parity (297).
