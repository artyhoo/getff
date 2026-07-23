# multi-model-profile-marker — kickoff

> **Umbrella:** `multi-model-profile-marker`. **Status:** DRAFT — authored in the 2026-07-21 design session; awaiting operator GO to land on staging + dispatch.
> **Goal:** light tasks run their WHOLE aif pipeline (plan+review+implement) on the cheap executor profile without a manual UI click — a `bridge-profile` HTML-comment marker in the kickoff makes our dispatcher set the task-level profile override at task creation. (The literal marker syntax is spelled out in §2; it is deliberately NOT written out here — the header region is exactly what `extractProfileHint` scans, so a documentation mention in this blockquote would be parsed as a directive and abort this kickoff's own dispatch.)

## §1 Why (verified facts)

Complexity-based routing rule (design session 2026-07-21): complex task → project per-mode defaults (Plan=Opus, Review/Task=GLM); light task → whole task on GLM. aif already supports the light path out of the box: `tasks.runtimeProfileId` is a task-level override that applies to ALL stages (aif-handoff `packages/data/src/index.ts:2746-2757` — «Task-level override applies to all stages»), and task creation accepts it (`packages/api/src/schemas.ts:69` `runtimeProfileId` in `createTaskSchema`). What is missing is OUR side: runtime-bridge dispatch never passes the field (verified 2026-07-21: `grep -rn runtimeProfileId packages/runtime-bridge/src` = 0 hits).

## §2 Scope

`packages/runtime-bridge` only. **NO aif-handoff changes.**

- **Marker is a SEPARATE parse channel — do NOT touch the `firstLine` opt-in/opt-out logic.** The existing `<!-- bridge: auto -->` / `<!-- bridge: skip -->` markers are matched by **exact string equality** on the trimmed first line (`kickoff.ts:47` `firstLine === '<!-- bridge: skip -->'`; `:53` `firstLine !== '<!-- bridge: auto -->'`). Overloading that line (e.g. `<!-- bridge: profile=GLM -->`) would match neither branch → `buildKickoffSpec` returns `null` → the kickoff silently stops dispatching. Instead add an **independent** marker `<!-- bridge-profile: <name> -->`, parsed by its own regex — orthogonal to the auto/skip decision. Marker absent → no profile hint → project defaults apply unchanged. **Scan ONLY the header blockquote** (the leading `>`-prefixed lines, same region as `Umbrella:`/`Goal:` today) — NOT the whole file body. This kickoff itself proves why: it mentions the literal string `bridge-profile` 6 times in prose/explanation, not as a directive — a whole-file scan would false-positive on a kickoff that merely documents the convention.
- **Touch points (4, all small — real scope, not «one field»):** (1) `buildKickoffSpec` in `kickoff.ts:38` — scan for the `bridge-profile` marker, extract the name; (2) `KickoffSpec` in `types.ts:15` — new optional `profileHint?: string`; (3) `AifHandoffBackend` POST body at `AifHandoffBackend.ts:175` — add resolved `runtimeProfileId` when a hint is present; (4) a name→id resolver.
- Resolution at dispatch time: `GET /runtime-profiles`, case-insensitive substring match on profile `name`; 0 or >1 matches → dispatch fails loudly with the candidate list (no silent fallback, no guessing).
- No hardcoded profile UUIDs anywhere in the repo — ids are per-install.
- Tests: unit for marker parse + resolver (HTTP mocked); paired negatives: (a) ambiguous match aborts, (b) a `bridge-profile` marker must NOT alter the existing auto/skip first-line behaviour, (c) a `bridge-profile`-shaped string appearing in the file BODY (outside the header blockquote — e.g. in prose or a code fence) must NOT be picked up as a directive.

## §3 Acceptance criteria

1. Kickoff with `<!-- bridge-profile: <name> -->` → created task carries the matched profile id (verify live: `GET /tasks/:id` shows `runtimeProfileId`).
2. Kickoff without the marker → field null/absent; project defaults untouched.
3. Unknown/ambiguous marker → dispatch aborts with an actionable error naming the candidates.
4. **Regression guard:** an `<!-- bridge: auto -->` / `<!-- bridge: skip -->` kickoff that ALSO carries a `bridge-profile` marker keeps its exact existing first-line dispatch behaviour (the profile channel is orthogonal). A `bridge-profile` marker on a kickoff with neither auto nor skip does not, by itself, make it dispatch.
5. **Self-reference guard:** a kickoff that merely mentions `bridge-profile` in its body prose (documentation, examples) — outside the header blockquote — does NOT trigger a profile hint. Use THIS kickoff file itself as the paired-negative fixture (it contains the string 6× in prose, 0 of which are the header-blockquote directive).
6. Expected NOT a capability commit (edit to existing module, <80 LOC, no new dir, no new dep); if it outgrows that, carry a `Prior-art:` trailer per CLAUDE.md.

## §4 AI-traps

Per [.claude/rules/ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md). Active traps for this umbrella: **T2** (the dispatch must be run e2e against live aif, not «would work»), **T3** (REPORT claims carry command output or file:line), **T20** (no verdict without evidence-bearing tool output).

Domain-specific:

- **T-MMPM-A** — profile matching runs against a live per-install DB: never snapshot real profile UUIDs into tests/fixtures; tests mock the HTTP layer and assert on names, not ids.
- **T-MMPM-B** — `firstLine`-channel regression: the auto/skip markers are matched by EXACT string equality (`kickoff.ts:47/53`), so any implementation that folds the profile hint into the first-line marker silently breaks dispatch (`buildKickoffSpec` → `null`). The profile marker MUST be a separate, orthogonal parse channel; the §3.4 regression guard is the falsifier — if it is missing from the test suite, the implementation is not accepted.
- **T-MMPM-C** — self-reference collision: a naive "scan the whole file for `bridge-profile`" implementation false-positives on any kickoff that documents the convention in prose (this file being the proof). The marker parse MUST be scoped to the header blockquote only; the §3.5 self-reference guard is the falsifier.
