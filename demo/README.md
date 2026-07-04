# demo/ — regenerable README GIFs

The two GIFs embedded in the root [README.md](../README.md) are recorded, not hand-drawn — a
demo that can't go stale because it's a real terminal session against a real sandbox install.

## Regenerate

```bash
brew install vhs   # one-time; charm.sh/vhs — records a real terminal session
make demo
```

`make demo` runs, in order:

1. [`setup-sandbox.sh`](setup-sandbox.sh) — builds a throwaway consumer project at
   `/tmp/getff-demo`: `git init`, the README's documented `./setup ts-server` install
   (dev-deps + husky hooks activated), and a clean baseline `src/index.ts` commit.
2. [`violation-blocked.tape`](violation-blocked.tape) — appends an `as any` cast and commits;
   the shipped pre-commit hook (lint-staged + ESLint) blocks it before it reaches git history.
3. [`doc-drift-gate.tape`](doc-drift-gate.tape) — edits a rule's own "Fires" claim in
   `.claude/rules/ci-tool-pinning.md` without regenerating the derived index, then runs
   `scripts/render-rule-index.mjs --check` against this repo itself — the gate fails, naming
   the exact file that drifted and the command to fix it. Self-application, not a staged prop.

Both `.tape` files write directly to `demo/*.gif` (VHS's `Output` directive) — commit the
regenerated GIFs alongside any change that would alter what they show.
