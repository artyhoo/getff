<!-- markdownlint-disable MD040 -->

# `domain-modeling` — vendored upstream text (mattpocock/skills, MIT)

> **Authoritative for:** nothing of its own. This file is a **verbatim vendored copy** of the upstream `domain-modeling` skill body,
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
> would have no text to read. The body links its two format files relatively; both are vendored beside it, so no link dangles.

## Provenance

| Field                | Value                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upstream             | [github.com/mattpocock/skills](https://github.com/mattpocock/skills) — `skills/engineering/domain-modeling/SKILL.md`                               |
| License              | MIT — Copyright (c) 2026 Matt Pocock                                                                                                               |
| Marketplace commit   | `9c9f36ccd3995266cd675468af71639c8dde1ec5` (recorded in `installed_plugins.json`, installed 2026-08-17)                                            |
| Upstream file sha256 | `9617041db9b0f6606ecf974e2061c83596b05059b5bb20ddb884c60f147c70e9` (the whole cached `SKILL.md`)                                                   |
| Vendored body sha256 | `6e49118599619a407f89024b4fc6435883f13728c95707a32136eacf8fe887ca` (upstream minus its 5-line frontmatter, byte for byte the §Upstream body below) |
| Censused             | 2026-09-22                                                                                                                                         |

**The plugin's declared version `1.2.3` does NOT identify this text** — see the same paragraph in
[`grilling.md`](grilling.md). Re-census against the commit SHA and the two hashes above.

**Deviations from the upstream bytes:** none in the body. The wrapper adds the `prettier-ignore`
range around the body, because `scripts/format-shipped.sh` formats `.claude/skills` whole and prettier
rewrites upstream's `*emphasis*` (measured 2026-09-22), and the `markdownlint-disable MD040` directive at the top, so the fences without a language survive.

**Re-census trigger:** upstream's `skills/engineering/domain-modeling/SKILL.md` no longer hashes to the
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
# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline — challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* `CONTEXT.md` for vocabulary is not this skill — that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

<!-- prettier-ignore-end -->
