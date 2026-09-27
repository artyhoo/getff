---
title: deps-hash-check hook
description: Your recorded tool baselines were true at some past moment. This hook re-checks them every time you send a prompt, and spends exactly one line telling your agent when the declared dependencies have moved on since.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/deps-hash-check.sh
  - .claude/rules/zcode-parity-doctrine.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - package.json
  - packages/core/hooks/deps-hash-check.test.ts
  - plugin/hooks/hooks.json
executed:
  - { example: deps-hash-check-warns-when-the-manifest-drifted-from-the-baseline, stack: repo, date: 2026-09-25, result: printed }
  - { example: deps-hash-check-stays-silent-when-the-baseline-matches, stack: repo, date: 2026-09-25, result: silent }
  - { example: deps-hash-check-zcode-channel-wraps-the-warning-as-one-json-object, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# deps-hash-check hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-deps-hash-check plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `deps-hash-check` |
| kind | hook |
| ships-to | framework: python, react-native, react-next, react-spa, ts-server |
| description | UserPromptSubmit hook — per-stack declared-deps staleness detector (package.json/pyproject.toml/Cargo.toml) |
| source | `.claude/hooks/deps-hash-check.sh:2` |
| event | `["UserPromptSubmit"]` |
| matcher | `[]` |
| delivery | `["@dual-pair:deps-hash-check-dogfood","plugin"]` |
<!-- getff:end section=D-card-deps-hash-check -->

<!-- vale on -->

## Explanation

Before your agent reads your prompt it gets one chance to learn that its tool
picture is stale. This hook hashes the dependency-relevant part of each stack
manifest your project has — `package.json`, `pyproject.toml`, `Cargo.toml` —
and compares each hash against the `deps-hash-*` line recorded in
`.ai-factory/tool-decisions.md` at the last tool reconciliation. A match means
the tools your agent is about to trust were chosen against the dependencies you
still have, and the hook says nothing. A mismatch draws one warning line that
names the way out: re-run the bootstrapping skill, then record the new hash
with the hook's own `--print-baseline` arm (lines 10-16 and 536-541).

Both states, run for real. Here is the drift case — a throwaway project whose
baseline was recorded, then a dependency was added:

```bash
demo="$(mktemp -d)"
cp package.json "$demo/"
mkdir -p "$demo/.ai-factory"
CLAUDE_PROJECT_DIR="$demo" bash .claude/hooks/deps-hash-check.sh --print-baseline \
  > "$demo/.ai-factory/tool-decisions.md"
python3 - "$demo/package.json" <<'EOF'
import json, sys
p = sys.argv[1]
d = json.load(open(p))
d.setdefault('devDependencies', {})['docs-demo-dep'] = '0.0.0'
json.dump(d, open(p, 'w'), indent=2)
EOF
printf '%s' '{"hook_event_name":"UserPromptSubmit","session_id":"docs-demo-dh-1","prompt":"status"}' \
  | CLAUDE_PROJECT_DIR="$demo" bash .claude/hooks/deps-hash-check.sh
```

```text
⚠ package.json deps changed since last tool-bootstrap — run /tool-bootstrapping to re-evaluate, then update the deps-hash-* lines in .ai-factory/tool-decisions.md with: bash …/.claude/hooks/deps-hash-check.sh --print-baseline
```

(The WARN names the hook's own absolute path; elided here.) Exit code stays 0 —
this is a warning to the model, never a [gate](../../terms.md#gate). In a
project whose baseline matches, the same command is silent:

```bash
printf '%s' '{"hook_event_name":"UserPromptSubmit","session_id":"docs-demo-dh-2","prompt":"status"}' \
  | CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/deps-hash-check.sh
```

```text
(nothing — exit 0)
```

Silence has a dispatch problem: a quiet run could mean "checked, all fresh" or
"never ran". The hook refuses to be unverifiable — `LOG_LEVEL=DEBUG` prints the
outcome to stderr on both branches (a GH #1705 fix, lines 370-387):

```text
[deps-hash-check] DEBUG: dispatched — package.json stack hashed, baseline matched
[deps-hash-check] DEBUG: dispatched — package.json stack hashed, no baseline in .ai-factory/tool-decisions.md (silent by design)
```

Honesty extends to the unbaselined case (GH #548): a stored placeholder that is
not a `sha256-` hash produces the wording «package.json tool decisions not yet
baselined», not a false "deps changed" (lines 389-400). And a project with no
`.ai-factory/tool-decisions.md` at all is skipped entirely — the hook never
demands a file a fresh install has not grown yet (lines 124-131).

Under ZCode the same warning wraps as one strict-JSON object on stdout, because
plain text there is discarded and a second JSON object would break parsing
(lines 38-40, 364):

```json
{
  "hookEventName": "UserPromptSubmit",
  "additionalContext": "package.json deps changed since last tool-bootstrap — run /tool-bootstrapping to re-evaluate, then update the deps-hash-* lines in .ai-factory/tool-decisions.md with: bash …/deps-hash-check.sh --print-baseline"
}
```

The card's delivery row carries two entries worth telling apart. The
`@dual-pair:deps-hash-check-dogfood` marker names the framework's own
portable [twin](../../terms.md#twin) discipline — the hook ships in two
byte-identical copies (`packages/` source and the `.claude/` dogfood copy)
with a test that fails if they drift (header lines 3-7). The `plugin` entry is
separate: the getff plugin registers the same script on its channel too
(`plugin/hooks/hooks.json:32`). In the parity census this is row 8 — `parity`,
the quiet good case: the event exists on both harnesses and nothing is lost.

## Evidence

- `.claude/hooks/deps-hash-check.sh:2` is the header the card's description row
  quotes: `# deps-hash-check.sh — UserPromptSubmit hook — per-stack declared-deps staleness detector (package.json/pyproject.toml/Cargo.toml)`.
- Registration: `.claude/settings.json:65` opens the `UserPromptSubmit` array whose
  second command (line 78) is this hook; the plugin registers it at
  `plugin/hooks/hooks.json:32`.
- Baselines: line 122 — `DECISIONS=".ai-factory/tool-decisions.md"`; storage format at
  lines 34-36 («one line per stack — deps-hash-npm / deps-hash-python / deps-hash-cargo»);
  the three per-stack compares at lines 515-521, npm's workspace-aware key at line 515.
- Fresh-install silence: lines 127-129 — exit 0 when the decisions file is absent, with
  the explicit `--print-baseline` bypass explained at 125-126.
- Wording fork: `_drifted` lines 389-400 — `sha256-*` stored → «deps changed since last
  tool-bootstrap»; anything else → «tool decisions not yet baselined» (GH #548).
- DEBUG arms: lines 377-378 (no baseline) and 386-387 (matched), both stderr-only; the
  header documents the invocation at lines 87-91.
- Single emission: `_emit_warn` at lines 97-103; the one-object rule and its ZCode
  JSON.parse rationale at lines 38-40; the combined emit at lines 536-541, which also
  carries the `--print-baseline` re-record pointer (W1-B review F1, lines 533-535).
- Conditional suffix: lines 528-534 — a generated `rules-lock*.json` under
  `.ai-factory/synthesizer-output/` appends «run /rule-tests» INSIDE the same WARN,
  never as a second emission.
- Memo: the 60-second TTL is documented at lines 224-229; the paired tests pin that a
  warm memo cannot mask drift (`deps-hash-check.test.ts` lines 472, 488).
- Documented blind spots: header lines 43-72 (workspace-root boundary, transitive
  resolution, lockfile-only drift).
- Census row 8 (`.claude/rules/zcode-parity-doctrine.md` §2): `parity` — «works».
- Paired test: `packages/core/hooks/deps-hash-check.test.ts` — stale → warn + exit 0
  (line 375), ZCode strict-JSON shape (402), honest unbaselined wording (419), matched
  → silent (447), no decisions file → silent skip (507), byte-identical twin copies
  (595).
