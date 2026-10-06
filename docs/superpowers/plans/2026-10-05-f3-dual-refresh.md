# F3 — bare refresh across installed layers

## Decision

Option A: bare `install.sh --refresh` refreshes every previously installed Python/cargo/Go lane, then the already installed npm/generic layer once. This fulfills INSTALL-FOR-AI.md's non-interactive refresh and existing-depth promises. Explicit stack/toolchain arguments retain their single-layer scope. Package manifests and shared RULES.md are not install evidence: use existing lane markers and npm-exclusive delivered payloads, captured before lane delivery. Each lane runs in a subshell to isolate exported toolchain contracts and log/global state while preserving plain-call set-e failure propagation. An existing project-checks record must survive those lane passes so npm checks stay armed.

## Pinned sibling population

Cold sweep enumerated 13 relevant files: source/assembled pairs of install.sh, setup, setup.d/lib.sh, and setup.d/45-python.sh, 46-cargo.sh, 47-go.sh, plus packages/getff/bin/getff. All six pairs were byte-identical. The packaged tree is gitignored and regenerated from tracked sources by scripts/build-getff-dist.sh; its preimage was pinned byte-identical to git show HEAD:install.sh. Only installer routing changes. Three table lanes all had the same first-marker early exit. Shared npm stack detection must distinguish Python's RULES.md from the npm-specific architecture passport.

Explicit GAP: setup and the packaged CLI do not forward --refresh (owner: setup/CLI argument delivery); this task fixes direct install.sh routing and does not claim to repair those callers.

## Verification and falsifiers

Real npm+Python installations pin both payload bytes before tampering, then run bare refresh under a real PTY and closed stdin. Controls exercise explicit npm and Python selections, pure Python with an unrelated package.json, generic+Python, core depth preservation, no package-manager calls, and all three installed markers under a non-mutating dry-run. Before-fix fixture: 30 pass / 5 fail (npm stale in both terminal modes and generic; cargo/go omitted). Cold review identified that lane checks could disarm existing npm checks; fixtures now arm lint after both installs and verify its state and stack survive refresh. Final main fixture: 43 pass / 0 fail. Sparse npm bundle/barrel fixtures: original preimage 0 pass / 2 fail, source and assembled twin 2 pass / 0 fail each. The extra source marker makes framework-layer detection consistent with stack detection.

Falsifiers: an installed layer stays stale; a manifest alone introduces a new layer; a refresh prompts or deepens; explicit arguments cross layers; an already armed check becomes not-armed; delivery failures report green. No paid LLM/API is used.
