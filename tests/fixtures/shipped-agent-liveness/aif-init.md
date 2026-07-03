# Fixture: aif-init

```yaml
agent: aif-init
tools-required: Read, Glob, Write
shape: read-glob
```

## task-prompt

```text
You are the aif-init sub-agent. Detect this repo's tech stack from its deterministic signals
(package.json(s), directory layout, config files) and report the stack values you would write
into .ai-factory/DESCRIPTION.md — with NO <PLACEHOLDER> fields.

Report, for THIS repo specifically:
1. The primary language + package manager (from the root package.json / lockfile present).
2. The test runner and any framework/build tool (from devDependencies + config files).
3. The monorepo/workspace layout (are there packages/* workspaces? name two of them).
4. For each value: cite the exact file:line (or file + key) where you observed the signal.

Do NOT invent a plausible-sounding stack. If a signal is genuinely absent, say so.
```

## observable-failure

Signs of a tool-less (RED) response — a subagent without Read/Glob:

```text
TOOL-LESS RED MARKERS (any of the following suffice):

1. Emits a plausible generic stack passport without reading package.json:
   "Language: TypeScript. Test runner: Jest. Build tool: webpack."
   (stated confidently — but this repo uses vitest, not Jest; a fabrication from training-data
   priors about "a typical TS repo", not from a Read of the actual package.json.)

2. Fabricates workspace/package names it could only know by Glob:
   "Workspaces: packages/core, packages/utils." — asserts specific directory names without
   a Glob of packages/*.

3. No file:line citations, or citations to files it never opened:
   "package.json line 12 declares the test script." — stated without a Read call.

4. No tool_uses in the response trace (the definitive mechanical signal).

5. Explicit decline: "I cannot detect the stack without reading the repo files." — also RED
   (the agent correctly declined rather than fabricating, but no passport was produced).
```

## observable-compliance

Signs of a tool-using (GREEN) response:

```text
TOOL-USING GREEN MARKERS (all three required for a LIVE verdict):

1. tool_uses > 0 — at minimum one Read of package.json AND one Glob of packages/* visible in
   the response trace.

2. Cites actual repo content only a tool could surface:
   "Read package.json — devDependencies include 'vitest' (NOT jest); test runner is Vitest."
   "Glob packages/* — real workspaces include packages/core and packages/preset-next-15-canonical."
   (The exact values depend on the real repo; the point is the agent READ/Glob'd them — and
   in particular reports vitest, which a training-data prior would likely get wrong as Jest.)

3. Every reported stack value carries a file:line or file + key citation reachable only via a
   tool call; absent signals are honestly reported as absent, not padded with a plausible guess.
```

## requires-tools-justification

`Read` is required to read `package.json`(s) and config files to detect the real stack values —
a tool-less agent can only emit a training-data-shaped "typical repo" that will differ from this
repo's actual choices (e.g. vitest vs Jest). `Glob` is required to enumerate the real
`packages/*` workspace layout — the specific directory names cannot be inferred without listing
them. `Write` is the passport-emission surface (the runner surface); the RED→GREEN evidence gap
is on the `Read`/`Glob` detection surface — run RED→GREEN on the detection surface and note that
`Write` is not exercised in a reporting-only probe.
