# Context-economy instruments that enforce their own contract — design

> **Status:** design accepted 2026-09-14 (operator «го»). Two PRs, zero file overlap.
> **Authoritative for:** the two fixes below and why each takes the channel it takes.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> Channel-selection doctrine — see [rule-enforcement-channel-selection.md](../../../.claude/rules/rule-enforcement-channel-selection.md).
> Residency model — see `packages/core/principles/31-rule-channel-declaration.ts`.

## §1 The concern

This repo's context-economy instruments do not enforce their own contract. Two findings,
both measured 2026-09-14 on Claude Code 2.1.270, both against `origin/staging` at
`6472bf6f2c7`.

They share one concern — *the thing that prices our always-on context is not itself
priced* — but they are two artefacts with disjoint file sets, so they ship as two PRs.

## §2 Finding 1 — the live meter overstates the resident set 2.37×

### §2.1 Mechanism

`scripts/measure-session-start-tokens.sh` builds its exclusion membership test as

```sh
EXCLUDES_SET=$(jq -r '.claudeMdExcludes[]? // empty' "$SETTINGS")
excludes_has() { printf '%s\n' "$EXCLUDES_SET" | grep -Fxq -- "$1"; }
```

`grep -Fxq` is an **exact-line** match. The enumeration loop calls `excludes_has` with
`.claude/rules/<basename>`, while every committed entry is the glob `**/<basename>.md`.
The test therefore succeeds **zero times out of eight**. Measured:

```text
#   always-on (no paths: key, not excluded): .claude/rules/effort-worthiness.md
#   always-on (no paths: key, not excluded): .claude/rules/reviewer-discipline.md
...
## Section B — Excluded by claudeMdExcludes
#   WARNING: excludes entry **/effort-worthiness.md listed but file absent
```

Section B fails from the other side of the same bug: it stats `$REPO_ROOT/$rel` where
`$rel` is a glob, so all eight entries report «file absent».

### §2.2 Cost

| | bytes | tokens_est | rows |
|---|---|---|---|
| Section A as printed | 174,538 | 47,067 | 14 |
| of which: the 8 excluded rules | 108,768 | 27,190 | 8 |
| **corrected resident set** | **65,770** | **19,877** | **6** |

Ratio 2.37× on tokens.

**Independent confirmation of the corrected figure.** The authoring session's own
system prompt held exactly six autoloaded sources — `CLAUDE.md`, `~/.claude/CLAUDE.md`,
`MEMORY.md`, and the three `ALWAYS_ON_CORE` rules — and none of the 19 `paths:`-gated
rules nor any of the 8 excluded ones. The corrected row count and the live harness agree.

### §2.3 The real defect class: one list, four grammars

`claudeMdExcludes` has four readers, each with its own matching grammar:

| Reader | Grammar | Status |
|---|---|---|
| `scripts/measure-always-on.sh` `is_excluded()` | bash `case` over `*/<name>` \| `<name>` | correct; also unions `.claude/settings.local.json` |
| `packages/core/principles/34-claudemd-excludes-liveness.test.ts:107` | picomatch `{dot:true}`, absolute paths | correct (mirrors the client) |
| `packages/core/principles/31-rule-channel-declaration.ts:289` `resolveExcludeEntry` | basename-exact after stripping `**/` | works on the current shape; not a glob engine by construction |
| `scripts/measure-session-start-tokens.sh` `excludes_has()` | `grep -Fxq` | **dead** |

A fifth, quieter divergence: the session-start meter never reads
`.claude/settings.local.json` at all, while its sibling applies the project ∪ local union.

This is `#sync-by-copy-paste` per
[dual-implementation-discipline.md §8](../../../.claude/rules/dual-implementation-discipline.md):
semantic text shared by manual copy rather than an SSOT pointer. The §8 counter is
«extract the shared spec; one channel becomes the SSOT, the other points to it».

Structural corroboration: of the three meters, this is the only one with **no `.test.sh`
sibling** (`scripts/measure-always-on.test.sh` and `scripts/check-alwayson-budget.test.sh`
both exist and both run from the `alwayson-budget` job at
`.github/workflows/audit-self.yml:1162-1168`). And the existing sibling test could not
have caught this bug class anyway: it asserts `total_bytes > FLOOR`, and an
**over**-count is invisible to a floor.

### §2.4 Fix shape — reuse the correct bash matcher, do NOT shell out to picomatch

**Decision: extract `measure-always-on.sh`'s `is_excluded()` plus its settings-union
reader into `scripts/lib/claude-md-excludes.sh`, sourced by both meters.**

Shelling out to picomatch — the apparently-cleaner «one SSOT» — was rejected on
measurement, not taste:

- **Wrong major at the root.** `node_modules/picomatch` is **2.3.2**;
  `packages/core/node_modules/picomatch` is **4.0.5**. SSOT
  [prior-art-evaluations.md#238](../../meta-factory/prior-art-evaluations.md) pins
  picomatch in `packages/core` and **not** at the root for exactly this reason: «the root
  carries a different picomatch major (2.3.2) and pinning the root manifest produces a
  green local run + an unresolvable import where the test executes». A bash meter invoking
  node from the repo root would silently load 2.3.2 — the «one SSOT» would be a second
  semantics wearing the first one's name.
- **picomatch ships no CLI.** Its public surface is the library API
  (`picomatch(glob, options)`, `matchBase`) — context7 `/micromatch/picomatch`, 2026-09-14.
  Shelling out therefore means authoring a new node entry point: a new artefact, against
  reusing a shell function that already exists and is already documented as the
  picomatch-equivalent translation.
- **The shell-out precedent points the other way.**
  [destination-environment-verification.md §1](../../../.claude/rules/destination-environment-verification.md)
  (`host-verify.sh --list`) says a gate should call *the runner that owns the fact*. In
  bash-land that runner is `measure-always-on.sh`: its `excludes_applied=8` is the number
  the pre-push budget gate already trusts. Calling **it** is the faithful application.

Two grammars (bash `case` ↔ picomatch) survive. They are made honest rather than merely
promised:

- the shared lib carries a `# spec:` pointer to principle 34 / SSOT #238 (the §8 counter);
- a **cross-grammar parity test** runs a fixture path/pattern corpus through both the bash
  matcher and `packages/core`'s pinned picomatch and asserts identical verdicts. Without
  it, «bash-native equivalent of picomatch» is a comment nobody executes — `#hope-as-gate`
  per [attention-is-not-a-mechanism.md §2](../../../.claude/rules/attention-is-not-a-mechanism.md).

### §2.5 PR A deliverables (as built)

1. `scripts/lib/claude-md-excludes.sh` — new. Owns: reading the project ∪ local
   `claudeMdExcludes` union (dedupe, per the client's `[...new Set(...)]` array customizer),
   `claude_md_excludes_match <path>`, `claude_md_excludes_matching_files <entry>`,
   `claude_md_excludes_count`, `claude_md_excludes_entry_supported <entry>`. bash-3.2-safe
   (no `declare -A`, no `mapfile`) — the constraint the existing header comments already record.
2. `scripts/measure-always-on.sh` — sources the lib; its inline `is_excluded()` and
   settings-union block are removed. **Behaviour verified unchanged**: stdout+stderr are
   byte-identical to the `origin/staging` baseline
   (`overlay_source=project resident_count=12 excluded_count=8 excludes_applied=8`,
   `total_bytes=35831`).
3. `scripts/measure-session-start-tokens.sh` — sources the lib; `excludes_has()`'s
   `grep -Fxq` body deleted; Section B resolves each entry to the files it actually matches
   instead of stat-ing the glob, and warns only when an entry matches **no** tracked file.
   `SETTINGS` becomes env-overridable (`MEASURE_SETTINGS_PATH`), and the meter now also reads
   `.claude/settings.local.json` (`MEASURE_SETTINGS_LOCAL_PATH`) — a fifth divergence found
   while fixing the fourth: `measure-always-on.sh` had always read the overlay and this meter
   never had. Measured after the fix: **65,770 bytes / 19,877 est. tokens / 6 rows**, against
   174,538 B / 47,067 / 14 rows before.
4. `scripts/measure-session-start-tokens.test.sh` — new, and **discriminating**, not a
   floor: with a fixture settings file that excludes a known rule, that rule's row must be
   **absent** from Section A and **present** in Section B; with an empty exclude list the
   same row must be present in Section A, and the TOTAL delta between the two runs must equal
   that rule's byte size exactly. Asserting a difference, per the N34-1a precedent. Every
   assertion runs against fixture settings, so an edit to the committed exclude list can
   neither break this test nor make it pass for the wrong reason.
5. `scripts/lib/claude-md-excludes.test.sh` — new. 23 assertions: matcher unit legs, the
   narrow-contract legs (§2.6), `load()` union/dedupe/refusal, `matching_files()`, and the
   cross-grammar parity leg against `packages/core`'s picomatch — the whole tracked tree
   (2,767 files) × the whole committed exclude list (8 entries), asserting an identical hit
   set, with a **vacuity guard** that fails the leg if picomatch matched nothing (a parity run
   where neither grammar matches is exactly the shape of the defect being fixed).
6. `.github/workflows/audit-self.yml` — both new tests wired into the `alwayson-budget`
   job beside their siblings (principle 41 `shell-test-ci-coverage` already gates this; an
   unwired `*.test.sh` fails CI), **and** the `install-sh` shellcheck gate's file list widened
   from `scripts/*.sh` to `scripts/*.sh scripts/lib/*.sh` with `-x -P SCRIPTDIR`. The glob
   does not recurse, so without this the new SSOT directory would have shipped unscanned —
   an unscanned new channel is the same class of hole as an unexecuted claim.

**Seeded-break proof.** Re-inserting the original exact-line matcher into the lib makes
`measure-session-start-tokens.test.sh` emit 4 FAIL and `claude-md-excludes.test.sh` 6 FAIL;
restoring the correct lib returns both to ALL PASS. The tests go RED on the defect class
they guard — they are not green-by-construction.

### §2.6 The supported-entry contract is NARROW, and refusal is loud

The equivalence claim «the bash `case` translation is picomatch's `**/<name>` with
`{dot:true}`» turned out to be true **only for the live form**. Measured 2026-09-14 with
`packages/core`'s pinned picomatch 4.0.5:

| entry | path | bash | picomatch |
|---|---|---|---|
| `*.md` | `other/y.md` | MATCH (bash `*` crosses `/`) | no match |
| `**/*.md` | `a/x.md` | no match (the stripped remainder is quoted, hence literal) | MATCH |

Papering over that with a wider `case` would have re-created the very thing this PR removes:
a second grammar wearing the first one's name. Instead the lib declares exactly two supported
forms — `**/<basename>` with no glob metacharacter, and a literal path — and
`claude_md_excludes_load` **fails with a FATAL on stderr and a non-zero return** when any
entry falls outside them; both meters propagate that as a non-zero exit rather than
continuing with a silently mis-priced budget.

This is the same refusal principle 31's `resolveExcludeEntry` already makes when a basename
is ambiguous: error rather than take a first match. It also converts a dead comment into a
mechanism — the old header promised «a future exclude in a different form would need an
extension here» with nothing checking it, which is `#hope-as-gate`
([attention-is-not-a-mechanism.md §2](../../../.claude/rules/attention-is-not-a-mechanism.md)).

## §3 Finding 2 — an invariant that falls between principles 31 and 34

### §3.1 The invariant

> for every `.claude/rules/*.md`: (no `paths:` frontmatter) AND (not in `ALWAYS_ON_CORE`)
> ⟹ some `claudeMdExcludes` entry matches it.

Neither shipped principle asserts it:

- `packages/core/principles/31-rule-channel-declaration.ts` asserts every rule **declares**
  a channel (four OR'd branches). A rule can pass via branch (d) — a live
  `<!-- channel: ... -->` marker — while still loading always-on.
- `packages/core/principles/34-claudemd-excludes-liveness.test.ts` asserts every
  `claudeMdExcludes` **entry** matches ≥1 real file. Its population is the *list*; it
  cannot see a missing entry.

The live instance was `.claude/rules/effort-worthiness.md`, which carries four valid
`skill-embed` channel markers — passing principle 31 — while loading always-on at 7,696 B.
PR #1769 added `**/effort-worthiness.md` to the list: a data fix, not a gate.

### §3.2 Green on landing — verified, and stated as such

```text
core_resident=3 excludes=8 violations=0
```

30 tracked rules = 19 `paths:`-gated + 3 `ALWAYS_ON_CORE` + 8 excluded. **The gate has no
live positive.** Its paired negative must therefore be constructed, not harvested.

### §3.3 Channel — extend principle 31

Per [rule-enforcement-channel-selection.md §1](../../../.claude/rules/rule-enforcement-channel-selection.md)
the detectability axis says **gate**. Among the three candidate homes:

- **Not principle 34.** Population decides. 34 iterates *list entries* → repo files; this
  invariant iterates *rules* → list entries. Different population, different check.
- **Not a new slot.** A new file directly in `packages/core/principles/` is a capability
  commit per [CLAUDE.md](../../../CLAUDE.md), and it would add a **third** reader of the
  same list — more sibling surface for zero cohesion gain.
- **Principle 31.** It already owns the residency model: `ALWAYS_ON_CORE` with its asserted
  ceiling of 4 (`31-rule-channel-declaration.ts:58`), the 4-branch predicate, and
  `checkExclusionConsistency` (`:318`) — the *excluded ⇒ live token* direction. It also
  documents the missing direction as deliberately unimplemented, with a rationale that has
  since expired (`:251`):

  > IMPLEMENTED DIRECTION ONLY: excluded ⇒ live-token. The REVERSE … is deliberately NOT
  > checked — as of this principle's authoring, `.claude/settings.json` `claudeMdExcludes`
  > was EMPTY/absent

  The list now holds 8 entries; the same file's own «STATUS UPDATE 2026-08-06» records it.
  Closing the direction there is finishing declared work, not adding capability.

### §3.4 Shape — one partition assertion, not a second one-way check

```text
partition(.claude/rules/*.md) = {paths-gated} ⊎ {ALWAYS_ON_CORE} ⊎ {excluded}
```

**This is the answer to the sibling-channel trap** (precedent PR #1644 → #1651). Two
one-way checks reading the same list can each pass on the other's side effect; a single
partition assertion cannot. The pattern — glob the population, read the config, assert set
equality so that both an uncovered member and a stale entry fail — is the surveyed
industry shape for allowlist-coverage gates (2026-09-14 external sweep); no off-the-shelf
package applies, since the semantics are this repo's own config.

Note the invariant deliberately does **not** exempt branch (b) (`<!-- globs: -->` without
`paths:`). A globs-only rule is still resident — the marker drives an edit-time injection
hook, it does not stop CC autoload — so it must still be excluded. Today no such rule
exists; the gate is what keeps that true.

Side effect worth naming: the gate makes the `ALWAYS_ON_CORE` ceiling load-bearing. A new
always-on rule must now go through `paths:`, through `claudeMdExcludes`, or through an
explicit entry in the 4-member core array with its own assertion — instead of simply
landing resident and being noticed by nobody.

### §3.5 Pinning the sibling

`N31-7` runs entirely on fixtures — a fixture rule population plus a fixture settings file
— so neither the live `.claude/settings.json` nor principle 34's population can move it.
Two legs, proving a **difference**:

- **(a) RED:** a fixture rule with no `paths:`, not in `ALWAYS_ON_CORE`, not matched by the
  fixture excludes ⇒ the partition check reports it.
- **(b) positive control:** the same fixture rule with a fixture settings file that
  excludes it ⇒ clean.

### §3.6 PR B deliverables

1. `packages/core/principles/31-rule-channel-declaration.ts` — new exported
   `checkResidencyPartition(repoRoot, ruleFieldsByPath, settingsPath)`; `resolveExcludeEntry`'s
   hand-rolled glob arm replaced by picomatch (already a pinned devDep of `packages/core`
   per SSOT #238), preserving its «ambiguous basename is an error, never a first match»
   behaviour. Four grammars become three.
2. `packages/core/principles/31-rule-channel-declaration.test.ts` — the real-repo leg
   (green on landing) plus `N31-7` (a) and (b).
3. Fixtures under `packages/core/principles/fixtures/rule-channel/` as needed.
4. The stale `IMPLEMENTED DIRECTION ONLY` paragraph rewritten to record what is now
   checked and what remains deliberately open.

## §4 Prior-art / capability-commit status

Verified against the detector itself, `packages/core/hooks/checks/prior-art.ts`: both LOC
arms require a `packages/` prefix (`isNewCoreSubdir50Loc`, `isNewPackages80Loc`), and
`ENFORCEMENT_FILE_RE = /^packages\/core\/principles\/[^/]+$/` matches **new** files only.

- **PR A** — new files live in `scripts/`, outside `packages/`; no new dependency.
  Not a capability commit.
- **PR B** — edits **existing** `31-rule-channel-declaration.ts` and its test; fixtures fall
  under the `*fixtures/` test-material carve-out; picomatch is already a declared devDep of
  `packages/core`. Not a capability commit.

No new SSOT row is required. SSOT #238 is cited as the matcher referent in both PRs.

## §5 Self-reflection (§1.7)

**Forward-check.** The two fixes are themselves context-economy instruments, so they must
not reintroduce the class they close. PR A's shared lib is the SSOT the §8 counter asks
for, and the parity test is what stops the surviving second grammar from being a comment.
PR B's partition assertion is a single check over a single population rather than a second
one-way check — the shape that made this gap possible in the first place.

**Backward-check.** Sibling surfaces sharing the `claudeMdExcludes` list: the four readers
enumerated in §2.3, plus `scripts/worktree-doctor.sh` (its excludes arm was removed with
arch-v2 S-E P2b and only the header comment remains — no live reader), plus
`packages/core/hooks/inject-session-bootstrap.test.ts` and
`tests/agnosticism/harness-self.test.sh` (both reference the key in assertions about other
mechanisms, neither matches patterns). After both PRs the reader count is unchanged at
four, the grammar count drops from four to two, and each surviving grammar is either the
SSOT or parity-tested against it.

**What would falsify this design.** If `paths:` frontmatter turned out *not* to suppress
CC autoload, §3's invariant would be wrong in its first clause and the partition would need
a different third bucket. Checked live at authoring time (§2.2): 19 `paths:`-gated rules,
none resident.
