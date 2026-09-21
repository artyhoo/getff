<!-- markdownlint-disable MD040 -->

# `grilling` — vendored upstream text (mattpocock/skills, MIT)

> **Authoritative for:** nothing of its own. This file is a **verbatim vendored copy** of the
> upstream `grilling` skill body, carried so that [`../SKILL.md`](../SKILL.md) §1's frontier
> pacing has a text-fidelity source when the `mattpocock-skills` plugin is not installed.
> The §Upstream body below is upstream's wording and upstream owns it; this repo owns only
> the wrapper (this header plus the provenance block).
> **NOT authoritative for:** the bindings layered over the mechanic (brainstorming collision,
> probe routing, round carrier, decision-register tree surface) — see
> [`../SKILL.md`](../SKILL.md) §1. The build-vs-reuse verdict that admitted this text — see
> [SSOT #253](../../../../docs/meta-factory/prior-art-evaluations.md). Project goal — see
> [README.md#why-this-exists](../../../../README.md#why-this-exists).

> **Why vendored rather than installed.** [SSOT #253](../../../../docs/meta-factory/prior-art-evaluations.md)
> ADOPTed this mechanic «AS IS via the `mattpocock-skills` companion plugin», and recorded a
> falsifier: _«the plugin's other skills (TDD, code-review, spec flows) collide with installed
> superpowers skills → fall back to a vendored byte-copy of `grilling` under
> `.claude/skills/arch/references/` (MIT permits), keeping this verdict's text-fidelity
> property.»_ That clause fired. The plugin exposes 11 model-invocable skills; this repo
> consumes exactly one of them and binds two away
> ([CLAUDE.md](../../../../CLAUDE.md) «Skill routing bindings»), and those bindings live in
> `.claude/rules/` + `CLAUDE.md`, neither of which is shipped to consumers
> (`setup.d/lib.sh:88` — not linked: `setup.d/` is outside the shipped-ref transform's
> rewrite table, so a link here would ship dangling). Vendoring delivers the one skill that is
> wanted without shipping the ten that are not.

## Provenance

| Field                | Value                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Upstream             | [github.com/mattpocock/skills](https://github.com/mattpocock/skills) — `skills/productivity/grilling/SKILL.md`                             |
| License              | MIT — Copyright (c) 2026 Matt Pocock                                                                                                       |
| Marketplace commit   | `9c9f36ccd3995266cd675468af71639c8dde1ec5` (recorded in `installed_plugins.json`, installed 2026-08-17)                                    |
| Upstream file sha256 | `d2498125dd20a0d3a27f03e0ebcc8e681cf42be468e2d3e3c9e8f5dadcae8d47` (the whole cached `SKILL.md`, frontmatter included)                     |
| Vendored body sha256 | `8c5fb7223da54cd8120e15a72dbabe87221b5baa78334ff8c50b9faab41aa007` (upstream minus frontmatter == the §Upstream body below, byte for byte) |
| Censused             | 2026-09-21                                                                                                                                 |

**The plugin's declared version `1.2.3` does NOT identify this text** and must not be used as
the provenance key: upstream tag `v1.2.3` is commit `6acc160e`, while the installed cache is
marketplace HEAD `9c9f36c` — the plugin channel serves HEAD-at-install-time, and
`claude plugin install` exposes no version flag at all (verified 2026-09-21:
`claude plugin install --help` lists only `--config`, `--json`, `--scope`, `--yes`). Pin
re-census against the commit SHA and the two hashes above, never against `1.2.3`.

**Deviations from the upstream bytes:** none in the body. The `markdownlint-disable MD040`
directive at the top of this file exists so the body's untagged fence survives
`.markdownlint.json` unmodified — the alternative, tagging the
fence, would have edited upstream's text.

**Re-census trigger:** upstream's `skills/productivity/grilling/SKILL.md` no longer hashes to
the upstream-file sha256 above → diff it, refresh this file, and append a dated note to SSOT #253.

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

**Extraction contract — the byte-identity gate depends on it.** The next heading is the
LAST heading in this file; everything after that heading line, minus exactly one leading
newline, IS the upstream body and must hash to the «Vendored body sha256» recorded above.
Nothing may be appended after the body. Enforced by
`packages/core/skills/grilling-vendored-body.test.ts` — prose alone would be
`#hope-as-gate` ([attention-is-not-a-mechanism.md §2](../../../rules/attention-is-not-a-mechanism.md)),
and the risk is live: `scripts/format-shipped.sh` prettifies `.claude/skills` whole, so a
future prettier-config change could silently rewrite "verbatim" bytes.

## Upstream body (verbatim — do not edit)

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Each question should be formatted like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
