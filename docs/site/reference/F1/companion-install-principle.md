---
title: companion-install-principle rule
description: The rule that this project's installer installs only its own artifacts — every companion is installed by its own official installer, detected first, never version-pinned, never silently a paid API.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/companion-install-principle.md
  - .agents/rules/00-rule-index.md
  - setup.d/companions.manifest
  - setup.d/engine.sh
  - .agents/hooks/inject-matching-rule.sh
  - scripts/check-ships-manifest.mjs
  - scripts/check-ships-manifest.test.sh
  - .husky/pre-commit
  - .github/workflows/audit-self.yml
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: manifest-kinds-no-pin, stack: repo, date: 2026-10-07, result: 6-rows-empty-grep }
docs-refresh: deferred — re-verified 2026-10-12, the cited overview changed only its batch-status paragraph, class-list links and frontmatter sources (the all-30 refresh after the F1b merge); this sheet's only anchor into it, #how-to-read-a-rule-page, is untouched; clears at the next gold refresh of this page
---

# companion-install-principle rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-companion-install-principle plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `companion-install-principle` |
| kind | rule |
| ships-to | framework |
| description | how this project installs companions/external services — §1 the principle, §2 trigger, §3 the manifest mechanism, §4 promotion / retirement. |
| source | `.agents/rules/companion-install-principle.md:14` |
| class | B |
| fires | editing `setup.d/**` (companion install manifest/engine). |
| channels | paths:(1), edit-time inject |
<!-- getff:end section=F1-card-companion-install-principle -->

<!-- vale on -->

## Explanation

A "companion" is another team's tool this project installs alongside itself — a
plugin, an MCP server, a CLI. The maintenance trap is obvious: if your installer
runs `tool install x@1.2.3`, then every time the tool's authors ship 1.2.4, your
installer is the thing that has to move. This [rule](../../terms.md#rule) refuses
that job. Its one-sentence framing: our installer installs only our own artifacts;
companions are installed via their own official top-level installer, after a
detect-first check, without pinning a version, configured to the free tier by
default.

The rule exists to make one property hold: when a satellite updates itself, our
installer should not need to. The rule's own table prices the two satellite events:
a new satellite version touches our installer **never** (their registry serves
latest); a changed install command touches it yes, but as a one-line data edit.

That data edit is the mechanism, and it is deliberately boring. A manifest holds
one TAB-delimited row per companion — name, detect command, install command, kind
— and a small engine loops over the rows: run the detect command; if the companion
is already present, skip; otherwise offer an interactive yes/no and run the
companion's own install command verbatim. The engine is a table plus a loop, not a
plugin framework. The manifest is data, so adding a companion is a row, not code:

```bash
grep -v "^#" setup.d/companions.manifest | grep -v "^$" | awk -F'\t' '{print $1" -> "$4}'
```

```text
superpowers -> cc-plugin
runtime-bridge -> external-service
deepwiki -> mcp
ast-grep-cli -> cli
ast-grep -> cc-plugin
aif-handoff -> external-service
```

Six companions, four kinds, and the "no version pin" half of the principle is
checkable in one grep — which returns nothing:

```bash
grep -E '@[0-9]+(\.[0-9]+)*' setup.d/companions.manifest
```

```text
```

(empty — exit status 1, no match)

The generated `class` row is still `B`, and the rule is delivered through
path-scoped loading plus an edit-time reminder. Its header's "No CI gate yet"
sentence is stale about one concrete part: the no-version-pin check already
ships in `scripts/check-ships-manifest.mjs`. It rejects numeric `@`, `@v` and
`==` pins in a row's install command. Pre-commit invokes it when the companion
manifest is staged, provided Node is available, and CI runs the same checker
plus paired positive/negative fixtures.

That check establishes the no-pin subset. It does not by itself establish
that an installer is official, that a detect command works well, or that a
companion uses a free tier. The generated Class B declaration is preserved;
this page distinguishes that declaration from the narrower enforcement
already present rather than claiming the entire rule has been promoted.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree. Pins re-verified 2026-10-12 at the universal-integration branch head: the range's rule/test/workflow edits (including the in-body citation renumber) shifted no pin cited on this page — every pin was re-read at the current base and still shows the quoted content.

- The framing sentence and the never-pin / official-installer / free-default
  terms: `.claude/rules/companion-install-principle.md:23` (§1 opens at `:19`).
- The satellite-event table (version → never, changed command → one-line edit):
  `:27` to `:31`.
- §3 mechanism (manifest + engine loop) at `:38`; the three bullets — no version
  pin `:42`, official installer only `:43`, free-on-subscription default `:44`.
- The declared Class B delivery pair and the stale "No CI gate yet" sentence:
  `.agents/rules/companion-install-principle.md:12`; delivery markers at `:3`
  to `:10`; the broader promotion criterion at `:48`.
- The shipped no-pin arm: `scripts/check-ships-manifest.mjs:209` to `:219`;
  findings cause exit 1 at `:224` to `:227`. Pre-commit wiring:
  `.husky/pre-commit:211` to `:227`. CI wiring:
  `.github/workflows/audit-self.yml:2735` to `:2740`.
- Paired fixture coverage at the current staging base:
  `scripts/check-ships-manifest.test.sh:163` to `:167` accepts the unpinned
  row and rejects npm and marketplace version pins. The manifest's six
  non-comment rows contain no version pin matching the example grep.
- The engine loop: `setup.d/engine.sh:232` (`companion_step()`), with the
  external-service routing branch at `:236` to `:240`.
- The edit-time injector that reads the marker:
  `.claude/hooks/inject-matching-rule.sh:342`.
- The index row grading this rule class `B` with channels
  `paths:(1), edit-time inject`: `.claude/rules/00-rule-index.md:17`.
