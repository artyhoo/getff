# `CONTEXT-FORMAT` — vendored upstream text (mattpocock/skills, MIT)

> **Authoritative for:** nothing of its own. This file is a **verbatim vendored copy** of upstream's `CONTEXT.md` format file,
> carried so that [`../SKILL.md`](../SKILL.md) §1 has a text-fidelity source for the domain-vocabulary
> moves when the `mattpocock-skills` plugin is not installed. The §Upstream body below is upstream's
> wording and upstream owns it; this repo owns only the wrapper.
> **NOT authoritative for:** the four bindings `/arch` layers over the moves, which override the body
> where the two differ — for example, `CONTEXT.md` records the operator's own words under
> `_Operator says_` where upstream's format uses `_Avoid_`; see [`../SKILL.md`](../SKILL.md) §1. The
> verdict that admitted this text — see [SSOT #253](../../../../docs/meta-factory/prior-art-evaluations.md)
> and [reuse spec D9](../../../../docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md).
> Project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists).

> **Why vendored rather than installed.** `/arch` ships to every `env`+ consumer, and the
> `mattpocock-skills` plugin is not in the companions manifest, so a consumer without the plugin
> would have no text to read. The vendored [`domain-modeling.md`](domain-modeling.md) body links this file as `./CONTEXT-FORMAT.md`.

## Provenance

| Field                | Value                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Upstream             | [github.com/mattpocock/skills](https://github.com/mattpocock/skills) — `skills/engineering/domain-modeling/CONTEXT-FORMAT.md`        |
| License              | MIT — Copyright (c) 2026 Matt Pocock                                                                                                 |
| Marketplace commit   | `9c9f36ccd3995266cd675468af71639c8dde1ec5` (recorded in `installed_plugins.json`, installed 2026-08-17)                              |
| Upstream file sha256 | `b8cc318f2a4285b530e908b6bc43901c3c5cd11100362636bbc4216639bef597` (the whole cached `CONTEXT-FORMAT.md`)                            |
| Vendored body sha256 | `b8cc318f2a4285b530e908b6bc43901c3c5cd11100362636bbc4216639bef597` (the whole upstream file, byte for byte the §Upstream body below) |
| Censused             | 2026-09-22                                                                                                                           |

**The plugin's declared version `1.2.3` does NOT identify this text** — see the same paragraph in
[`grilling.md`](grilling.md). Re-census against the commit SHA and the two hashes above.

**Deviations from the upstream bytes:** none in the body. The wrapper adds the `prettier-ignore`
range around the body, because `scripts/format-shipped.sh` formats `.claude/skills` whole and prettier
rewrites upstream's `*emphasis*` (measured 2026-09-22).

**Re-census trigger:** upstream's `skills/engineering/domain-modeling/CONTEXT-FORMAT.md` no longer hashes to the
upstream-file sha256 above → diff it, refresh all three vendored files, and append a dated note to SSOT #253.

## License — upstream's MIT notice, reproduced in full

MIT clause 2 requires the copyright notice **and** this permission notice to travel with
every copy or substantial portion of the software. The body below is redistributed inside
an FSL-1.1-ALv2 payload (repo `LICENSE.md`) to every `env`+ consumer, so upstream's notice
is reproduced here verbatim from the marketplace checkout's `LICENSE`:

```text
MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Extraction contract — the byte-identity gate depends on it.** Everything between the
`prettier-ignore-start` line after the next heading and the one blank line before the
`prettier-ignore-end` line IS the upstream body and must hash to the «Vendored body sha256» above;
only one newline follows the end marker. The blank line keeps the end marker out of a body that
ends in a list, where Markdown would read it as part of the last item. Enforced by `packages/core/skills/domain-modeling-vendored-body.test.ts`.

## Upstream body (verbatim — do not edit)

<!-- prettier-ignore-start -->
# CONTEXT.md Format

## Structure

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
- **Only include terms specific to this project's context.** General programming concepts (timeouts, error types, utility patterns) don't belong even if the project uses them extensively. Before adding a term, ask: is this a concept unique to this context, or a general programming concept? Only the former belongs.
- **Group terms under subheadings** when natural clusters emerge. If all terms belong to a single cohesive area, a flat list is fine.

## Single vs multi-context repos

**Single context (most repos):** One `CONTEXT.md` at the repo root.

**Multiple contexts:** A `CONTEXT-MAP.md` at the repo root lists the contexts, where they live, and how they relate to each other:

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md) — receives and tracks customer orders
- [Billing](./src/billing/CONTEXT.md) — generates invoices and processes payments
- [Fulfillment](./src/fulfillment/CONTEXT.md) — manages warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment → Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

The skill infers which structure applies:

- If `CONTEXT-MAP.md` exists, read it to find contexts
- If only a root `CONTEXT.md` exists, single context
- If neither exists, create a root `CONTEXT.md` lazily when the first term is resolved

When multiple contexts exist, infer which one the current topic relates to. If unclear, ask.

<!-- prettier-ignore-end -->
