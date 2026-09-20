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

## Calibrated values (band and threshold initialised from the gold pages, 2026-09-21)

| Value | Today | How it changes |
|---|---|---|
| Sentence length | suggestion at 30 words (Microsoft default). **Measured threshold: 35 words** (longest gold sentence 34, rounded up to the next 5; see the gold record below). The promotion to ERROR is NOT switched on yet | After the gold `GO`: threshold := longest gold sentence rounded up to the next 5 words; from family 1 on, ERROR at that threshold with the D-Q12 escape (D-Q5) |
| Readability band (FRE min/max, FK max) | **FRE 84.1 to 91.3, FK at most 4.7** (five bulk gold pages, 2026-09-21; see the gold record below) | After the gold `GO`: min/max FRE and max FK over the five bulk gold pages go here (D-Q4); the eleven face pages may only widen the band, never gate before it |
| Vocabulary | seeded from the spec-named terms plus the tool names this corpus uses | `accept.txt` edits are allowed in the page's own commit (D-Q12, the F6a route); plurals of accepted terms still fire, so a sweep may add derived forms |
| Name-class entries | the four measured pairs rendered from `docs/site/terms.md` region (a) | The substitution is never widened by hand — region (a) is the only source (D-Q7); a name-class entry that fires on a legitimate use moves to JUDGE in the same commit |

## Gold record (2026-09-21, stage S0b, after the Opus `GO`)

Measured with Vale 3.21.0 on the five bulk gold pages at their live paths. Counts come
from `vale ls-metrics`. FRE is `206.835 - 1.015 * (words / sentences) - 84.6 *
(syllables / words)`, the formula of the vendored rule. FK grade is `0.39 * (words /
sentences) + 11.8 * (syllables / words) - 15.59`. The longest sentence was found with
copies of the `Microsoft.SentenceLength` rule at `max:` 28 to 50, so it uses that rule's
own word count.

| Gold page | Kind | Words | Sentences | Syllables | FRE | FK grade | Longest sentence |
|---|---|---|---|---|---|---|---|
| `docs/site/reference/B/getff.md` | reference-sheet | 424 | 33 | 550 | 84.1 | 4.7 | 24 |
| `docs/site/reference/B.md` | family-overview | 787 | 75 | 1001 | 88.6 | 3.5 | 21 |
| `docs/site/learn/stop-a-bad-commit.md` | learn-tutorial | 596 | 56 | 748 | 89.9 | 3.4 | 24 |
| `docs/site/guides/add-design-and-review-skills.md` | guide | 404 | 45 | 508 | 91.3 | 2.8 | 34 |
| `docs/site/understand/why-a-rule-must-prove-it-fires.md` | understand | 798 | 70 | 1016 | 87.6 | 3.9 | 32 |

- **Band (D-Q4):** FRE 84.1 to 91.3, FK at most 4.7. Outside the band is a MINOR note,
  never a gate.
- **Sentence threshold (D-Q5):** longest gold sentence 34 words, so the threshold is 35.
- **The ERROR promotion is not switched on.** At 35 words the 34 pages of the gold set
  hold 5 sentences over the threshold, by the same probe. Flipping
  `Microsoft.SentenceLength` to `error` with `max: 35` would turn those pages red, so
  the flip needs those 5 sentences split or escaped first. It is left to the owner of
  the Vale profile.
- **Gate-set false positives on gold (D-Q2 falsifier, duty 1 below):** the ERROR rules
  ran over all 34 pages. The first run had 4 `Vale.Spelling` hits, all vocabulary misses
  (`dev` twice, `accessor`, `APIs`). No `getff.Names` hit. No rule was demoted.
- **Face pages:** the eleven face pages join this record as a second dated entry after
  their own gold review. They may only widen the band. That entry is not written yet.
- **Per-kind notes on what good looks like** are not written yet. The five frozen copies
  under the docs-author skill's `references/gold/` are the baseline until they are.

## Re-measure duties (before the gold pages)

1. Re-run Vale over the gold pages before family 1: every ERROR rule that shows a false
   positive that is not a vocabulary miss demotes to suggestion (D-Q2 falsifier).
   **Done 2026-09-21** — see the gold record above; nothing was demoted.
2. Initialise the readability band and the sentence threshold from the gold pages, and
   record them in the table above (D-Q4/D-Q5). **Done 2026-09-21** — see the gold record
   above. The ERROR promotion of the threshold stays open.
3. The escape is the two-comment form — a bare `<!-- vale off -->` immediately followed
   by a `<!-- vale-reason: ... -->` comment, closed by `<!-- vale on -->`; the
   single-comment `vale off: reason` form is INERT in Vale 3.21.0 and both D-Q12 and
   this record keep it that way (measured 2026-09-16: the inert form fired on the
   suppressed block, the two-comment form suppressed it exactly).
4. Vocabulary lookup is `<StylesPath>/config/vocabularies/<name>/accept.txt` in Vale
   3.21.0 — a vocabulary outside `config/` is not found (`E100`, measured). Keep the
   tree layout when moving anything.
