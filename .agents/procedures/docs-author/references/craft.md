# Craft — how a getff.ai page reads

> **Authoritative for:** the craft contract's long form — openers, why-before-how, second
> person, progressive disclosure, callouts, the one punctuation sentence.
> **NOT authoritative for:** project goal — see the repo README. The gates that enforce the
> deterministic slice of this — `scripts/docs-check.mjs` (spelling, names, structure). Diátaxis
> mechanics generally — the installed diataxis plugin (see SKILL.md's upstream pointer).

Worked examples come from the gold pages once they exist
([references/gold/](gold/README.md)); until then each rule carries a minimal shape only.

## Openers

The first paragraph answers two questions before any mechanism appears: what does the reader
get, and why does it matter to them. If the paragraph opens with how the thing works, rewrite —
the how moves down.

- Weak: «The renderer walks the members registry and emits a fence per artifact.»
- Strong: «Every artifact page opens with a card you never have to write: the renderer builds
  it from the registry, so the numbers on the page are the numbers in the tests.»

## Why before how

Mechanism earns its place only after the reader knows what they get. In tutorials the first
runnable step appears before any concept explanation — the reader types first, understands
second. In reference sheets the why lives in band B's first paragraph, never inside the card.

## Second person, short sentences

Write to one reader: you. Prefer the shortest sentence that carries the claim; when a sentence
needs a dash to hold together, split it. No unexplained acronym on first use.

## Progressive disclosure

The common case first; edge cases and internals after; callouts only for warnings (a callout on
a nice-to-know is a false alarm the reader learns to ignore). Depth is a link away, not a wall
of asides.

## Examples are copy-ready

Every example runs at the pin and shows its real output — paste the output you got, not the
output you expect. An example lives once: other pages link to it, never paste it. If two pages
carry the same fenced block, one of them is wrong today and both are wrong after the next
change.

## Same words

Use terms as the glossary defines them and link the first mention. The forbidden synonyms live
in terms.md; the name-class ones are gated mechanically, the contextual ones are judgment
calls — both are named so you never have to guess which register a term belongs to.

## The one punctuation sentence

Punctuation serves the reader; when a sentence needs a dash to hold together, split it. There
is no dash count, no semicolon ban, no style cop — read the sentence aloud and split where you
breathe.
