---
title: Docs quality calibration record
description: Provenance of the Vale profile, the pins it is built from, and the duties that must be re-measured before the gold pages.
kind: glossary
sources:
  - docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md
---

# Docs quality calibration record

This file is the calibration record D-Q2/D-Q14 name. It exists because the original
authoring session left its Vale tuning artifacts in a private scratchpad: `tuned.ini`,
the working `accept.txt`, and the JSON dumps behind the F6/F6a measurements are all
unreachable (finding F-9). The profile shipped at `docs/site-quality/vale/` was
therefore rebuilt from the spec's explicit rule list, and everything below is either a
pin someone can re-verify or a duty someone must re-measure.

## Pins (re-verified 2026-09-16)

| Tool | Version | Integrity | Source |
|---|---|---|---|
| Vale | 3.21.0 | `sha256 96997d19a4ca6981673b0d4c5ca7f3ede4a9f97964a96edc29fba9e28a328336` (`vale_3.21.0_Linux_64-bit.tar.gz`, checked against upstream `vale_3.21.0_checksums.txt`) | release download |
| Microsoft style pack | v0.15.1 | `sha256 0b37660b244a9399d7f10225895773291d27b2967ed0d239a1d379b633e8cd16` (`Microsoft.zip`) | `vale-cli/Microsoft` releases (MIT) |
| Readability style pack | v0.1.1 | `sha256 fbe178b4b648c4d41bb72cee533addfd8f51cf0f3d1f0adfa08808770b418106` (`Readability.zip`) | `vale-cli/readability` releases (MIT) |
| lychee | v0.24.2 | pinned in `.github/workflows/audit-self.yml` (the docs-check job reuses that pin) | existing CI pin |

The two style packs are vendored under `docs/site-quality/vale/styles/` so the six
declared D-Q2 suggestions resolve offline. They are vendored ONLY for those six rules:
`.vale.ini` enables them individually and bases on no Microsoft or Readability style
wholesale, so no undeclared rule gates anything.

## What the profile enforces today

- **ERROR tier** (fails the commit): `Vale.Spelling` against
  `styles/config/vocabularies/getff/accept.txt`, and `getff.Names` — the substitution
  rule generated from region (a) of `docs/site/terms.md` by
  `scripts/render-terms-style.mjs`. Every other D-Q2 ERROR item (markdownlint, lychee,
  C13 frontmatter, C12 skeletons, the escape-reason check) lives in
  `scripts/docs-check.mjs`, not in Vale.
- **SUGGESTION tier** (reported, never blocking): `Microsoft.SentenceLength`,
  `Microsoft.Passive`, `Microsoft.Contractions`, `Microsoft.Headings`,
  `Readability.FleschReadingEase`, `Readability.FleschKincaid`.
- **OFF**: everything else, by absence — `Vale.Terms`, the ai-tells package, the five
  other Readability metrics, every undeclared Microsoft rule.

## Calibrated values (corpus-derived, uncalibrated)

| Value | Today | How it changes |
|---|---|---|
| Sentence length | 30 words (Microsoft default), suggestion | After the gold `GO`: threshold := longest gold sentence rounded up to the next 5 words; from family 1 on, ERROR at that threshold with the D-Q12 escape (D-Q5) |
| Readability band (FRE min/max, FK max) | uninitialised | After the gold `GO`: min/max FRE and max FK over the five bulk gold pages go here (D-Q4); the eleven face pages may only widen the band, never gate before it |
| Vocabulary | seeded from the spec-named terms plus the tool names this corpus uses | `accept.txt` edits are allowed in the page's own commit (D-Q12, the F6a route); plurals of accepted terms still fire, so a sweep may add derived forms |
| Name-class entries | the four measured pairs rendered from `docs/site/terms.md` region (a) | The substitution is never widened by hand — region (a) is the only source (D-Q7); a name-class entry that fires on a legitimate use moves to JUDGE in the same commit |

## Re-measure duties (before the gold pages)

1. Re-run Vale over the gold pages before family 1: every ERROR rule that shows a false
   positive that is not a vocabulary miss demotes to suggestion (D-Q2 falsifier).
2. Initialise the readability band and the sentence threshold from the gold pages, and
   record them in the table above (D-Q4/D-Q5).
3. The escape is the two-comment form — a bare `<!-- vale off -->` immediately followed
   by a `<!-- vale-reason: ... -->` comment, closed by `<!-- vale on -->`; the
   single-comment `vale off: reason` form is INERT in Vale 3.21.0 and both D-Q12 and
   this record keep it that way (measured 2026-09-16: the inert form fired on the
   suppressed block, the two-comment form suppressed it exactly).
4. Vocabulary lookup is `<StylesPath>/config/vocabularies/<name>/accept.txt` in Vale
   3.21.0 — a vocabulary outside `config/` is not found (`E100`, measured). Keep the
   tree layout when moving anything.
