# tests/fixtures/shipped-agent-liveness — M2 probe fixtures

> **Authoritative for:** per-shipped-agent RED→GREEN fixture scenarios consumed by
> `agents/shipped-agent-liveness-prober.md` (the M2 behavioural liveness probe). Individual
> files are scope-bound by their agent slug.
> **NOT authoritative for:** project goal — see consumer's README.md. The shipped-surface
> definition — see `install.sh` §2 skip-loop. The probe protocol — see
> `agents/shipped-agent-liveness-prober.md`.
> **Append-only:** fixtures are authored data; do not delete a fixture without a corresponding
> agent removal from the shipped surface.

Each file in this directory is a **fixture scenario** for one shipped agent. Schema:

```yaml
# Fixture schema (one file per agent slug, e.g. compliance-verifier.md)
agent: <slug>
tools-required: <comma-separated list of tools the agent declares>
shape: read-grep-glob | bash-assisted | read-only

task-prompt: |
  <the EXACT prompt given to the fresh subagent in both RED (Pass 1) and GREEN (Pass 2)>

observable-failure: |
  <RED markers — what a tool-less subagent produces: fabricated findings, hallucinated
  file:line, plausible-but-unverifable claims, or explicit "I cannot help without files">

observable-compliance: |
  <GREEN markers — what a tool-using subagent produces: tool_uses > 0, citations to real
  lines reachable only via Read/Grep/Glob calls, concrete diff between fabricated and real>
```

**Fixture authoring discipline:** every `observable-failure` marker must be something a real
tool-less LLM can plausibly produce (not a strawman). Every `observable-compliance` marker must
require at least one tool call to surface (not inferrable from training data alone for this repo).

**Folder-level doc-authority:** individual fixture files inherit this README's scope declaration.
Individual files do not need their own Authoritative-for header.
