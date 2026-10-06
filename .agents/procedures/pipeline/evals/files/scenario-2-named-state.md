# Injected live state — Scenario 2 (`/pipeline docs-lint-sweep`)

> Raw `!shell`-injected live state for `/pipeline docs-lint-sweep`.
> Reason over THIS state only — do NOT run real `git` / `gh`.

## §1 — `git status` / branch / `gh pr list`

```text
(clean working tree)
--- branch: staging
--- 0	0
```

```json
gh pr list --search "is:open":  []
gh pr list --state merged (head contains "docs-lint-sweep"):  []   # nothing landed yet for this umbrella
```

Plan-currency verdict for this run: **Plan is current** (no drift items).

## §3 Step 1 — `launch-table-generator.sh docs-lint-sweep` (auto-detected sub-wave skeleton)

```text
UMBRELLA: docs-lint-sweep
SUBWAVE: A
SUBWAVE: B
SUBWAVE: C
SUBWAVE: D
```

## §3 Step 1 — `dispatch-from-state.sh docs-lint-sweep` (state context + kickoff head)

```text
winner_id: docs-lint-sweep
sub_wave_state: (fresh — no sub-wave dispatched yet)
--- kickoff.md (head-120) ---
```

### Attached kickoff body: `.claude/orchestrator-prompts/docs-lint-sweep/kickoff.md`

```markdown
# docs-lint-sweep — umbrella kickoff

## §0 Meta

- Type: I-phase-large
- Goal: introduce a markdown-lint gate + fix all existing violations across docs/ and .claude/rules/.
- Base: staging

## §2 Sub-wave decomposition

| Sub-wave | Nature                                                    | Est. LOC          | Files          | Stage | Parallel-with | Scope                |
| -------- | --------------------------------------------------------- | ----------------- | -------------- | ----- | ------------- | -------------------- |
| A        | R-phase: pick markdownlint config + rule set              | ~0 (research doc) | research-patch | 1     | —             | decides ruleset      |
| B        | execution-build: fix violations in docs/meta-factory/\*\* | ~300              | ~25 docs       | 2     | C             | disjoint from C      |
| C        | execution-build: fix violations in .claude/rules/\*\*     | ~200              | ~12 rules      | 2     | B             | disjoint from B      |
| D        | wiring: add markdownlint CI step + pre-commit hook        | ~40               | 2 config       | 3     | —             | depends on A ruleset |

## §3 Dependencies

- B, C depend on A (ruleset decided first).
- D depends on B + C merged (gate only goes green once violations fixed).
- B and C edit disjoint file trees → safe to run parallel in Stage 2.

## §4 Acceptance

- Stage 1: research-patch committed naming the chosen ruleset + rationale.
- Stage 2: zero markdownlint violations under docs/meta-factory/** and .claude/rules/**.
- Stage 3: CI step fails a PR that introduces a new violation (paired-negative proven).
```
