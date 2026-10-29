# `ADR-FORMAT` — vendored upstream text (mattpocock/skills, MIT)

> **Authoritative for:** nothing of its own. This file is a **verbatim vendored copy** of upstream's ADR format file,
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
> would have no text to read. The vendored [`domain-modeling.md`](domain-modeling.md) body links this file as `./ADR-FORMAT.md`.

## Provenance

| Field                | Value                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Upstream             | [github.com/mattpocock/skills](https://github.com/mattpocock/skills) — `skills/engineering/domain-modeling/ADR-FORMAT.md`            |
| License              | MIT — Copyright (c) 2026 Matt Pocock                                                                                                 |
| Marketplace commit   | `9c9f36ccd3995266cd675468af71639c8dde1ec5` (recorded in `installed_plugins.json`, installed 2026-08-17)                              |
| Upstream file sha256 | `f1f36cd3f8d3b6474ddd5855da4e233bfc4ae1a1c5024909ccf11871819a41b2` (the whole cached `ADR-FORMAT.md`)                                |
| Vendored body sha256 | `f1f36cd3f8d3b6474ddd5855da4e233bfc4ae1a1c5024909ccf11871819a41b2` (the whole upstream file, byte for byte the §Upstream body below) |
| Censused             | 2026-09-22                                                                                                                           |

**The plugin's declared version `1.2.3` does NOT identify this text** — see the same paragraph in
[`grilling.md`](grilling.md). Re-census against the commit SHA and the two hashes above.

**Deviations from the upstream bytes:** none in the body. The wrapper adds the `prettier-ignore`
range around the body, because `scripts/format-shipped.sh` formats `.claude/skills` whole and prettier
rewrites upstream's `*emphasis*` (measured 2026-09-22).

**Re-census trigger:** upstream's `skills/engineering/domain-modeling/ADR-FORMAT.md` no longer hashes to the
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
# ADR Format

ADRs live in `docs/adr/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create the `docs/adr/` directory lazily — only when the first ADR is needed.

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

That's it. An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why* — not in filling out sections.

## Optional sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — useful when decisions are revisited
- **Considered Options** — only when the rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need to be called out

## Numbering

Scan `docs/adr/` for the highest existing number and increment by one.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it — you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, deployment target. Not every library — just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected alternatives when the rejection is non-obvious.** If you considered GraphQL and picked REST for subtle reasons, record it — otherwise someone will suggest GraphQL again in six months.

<!-- prettier-ignore-end -->
