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
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: manifest-kinds-no-pin, stack: repo, date: 2026-10-07, result: 6-rows-empty-grep }
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

The `class` row is `B`: a named mechanism, not a test. Delivery is a dual pair —
the rule file's frontmatter `paths:` loads the whole rule when you read a
`setup.d/` file, and an edit-time injector re-surfaces a one-paragraph summary
when you edit one. The rule's own header is candid about what is missing: "No CI
gate yet". And here is a fact worth reading twice: the rule promotes itself to a
grep gate when the manifest reaches three rows. It has six, and the gate does not
exist yet. The promotion trigger has fired; the promotion has not landed. This
page reports that state rather than smoothing it over — landing the gate is a
code change outside this documentation batch.

What the rule does not do: nothing enforces it mechanically today, so a manifest
row carrying a version pin would not be rejected by any gate — only noticed by a
human or an agent reading the rule. Detect quality is also per-row judgment: the
rule guarantees the *shape* (detect first, official installer, no pin), not that
every detect command actually detects well.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree.

- The framing sentence and the never-pin / official-installer / free-default
  terms: `.claude/rules/companion-install-principle.md:23` (§1 opens at `:19`).
- The satellite-event table (version → never, changed command → one-line edit):
  `:27` to `:31`.
- §3 mechanism (manifest + engine loop) at `:38`; the three bullets — no version
  pin `:42`, official installer only `:43`, free-on-subscription default `:44`.
- The class-B delivery pair and the "No CI gate yet" sentence: `:12`; the
  `<!-- globs: -->` marker the injector reads: `:9`; the `paths:` frontmatter:
  `:3` to `:4`.
- The promotion trigger (grep gate at ≥3 rows): `:48` (§4 at `:46`). The manifest
  has 6 non-comment rows at this base (counted by the command above); the pin
  grep returns nothing (exit 1).
- The engine loop: `setup.d/engine.sh:232` (`companion_step()`), with the
  external-service routing branch at `:236` to `:240`.
- The edit-time injector that reads the marker:
  `.claude/hooks/inject-matching-rule.sh:342`.
- The index row grading this rule class `B` with channels
  `paths:(1), edit-time inject`: `.claude/rules/00-rule-index.md:17`.
