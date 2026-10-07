# Page kinds — the registry (closed set of seven)

> **Authoritative for:** the seven registered `kind:` values, each kind's required sections
> (what the C12 gate enforces, in order), and the two kinds without a deterministic skeleton.
> **NOT authoritative for:** project goal — see the repo README. The gate implementation —
> `scripts/docs-check.mjs` (its `KINDS` table and this registry must agree; a drift fails a
> page at commit time). The face-page rule's content — the face-pages design spec §5, by
> pointer.

Check types: `GATE` sections are deterministic (`docs-check.mjs`, C12); `JUDGE` items are the
form auditor's and the reviewer's. One page = one kind = one `kind:` frontmatter value from
this table. An unregistered value is a frontmatter error, permanently — add it here first (and
to the checker) if a new kind is genuinely needed.

## `reference-sheet`

One artifact, three bands in order:

1. `## Fact card` — band A: the generated fence (members registry renderer owns its content;
   never hand-edit inside the fence).
2. `## Explanation` — band B: how to think about the artifact; the why-before-how rule applies
   to this band's first paragraph (C3).
3. `## Evidence` — band C: paths and test names that prove the card's claims at the pin (C8).

JUDGE: would a reader who already chose this artifact find anything they do not need? No
selling language.

## `family-overview`

1. `## Common cases` — one generated table (one row per sheet), then a block of ready snippets
   that duplicates no sheet's example (an example lives once — link, never paste).
2. `## When not to reach for this family` — the honest-limits paragraph (C9).

## `learn-tutorial`

1. `## Steps` — numbered; the first runnable step appears before any concept explanation; every
   step shows its real output (C6).
2. `## What you built` — closes the page, with one link onward.

## `guide`

1. `## Prerequisites` — list form.
2. `## Steps` — no concept teaching inside steps (JUDGE).
3. `## Verify` — a verification step the reader can run.
4. `## Variations` — common departures from the main path.

The goal belongs in the title (C1).

## `understand`

1. `## Mechanism` — pain first, then how it works; no steps.
2. `## Proof` — link to the test or measurement that shows the mechanism is real (C8).
3. `## Limits` — where the mechanism stops holding (C9).

Snippets other than illustration do not belong on an understand page.

## `face-page`

No deterministic skeleton and deliberately so: the eleven product faces each follow the
face-pages design spec §5 (pain, mechanism, proof, honest limit in the page's own proportion),
with seven per-page skeletons the gate must never encode (a shared section gate would assert
nothing or copy the spec). The gate for this kind is JUDGE only; C13 frontmatter still applies.

## `glossary`

`terms.md` only. Frontmatter gate applies (C13); there is no section skeleton to enforce. Region
(a) is hand-written concept entries; region (b) is a generated fence fed by the members
registry — names only, never hand-edited. Only entries marked with the name-class `Do not use
(name):` form render into the name rule; plain `Do not use:` entries are judgment items (C10).
