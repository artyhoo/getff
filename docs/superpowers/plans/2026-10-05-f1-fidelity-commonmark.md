# F1 fidelity section boundaries

> **Authoritative for:** F1 design choice, compatibility measurement and regression evidence.
> **NOT authoritative for:** project goal or verdict grammar; see README.md and the fidelity gate.

## Decision

Choose B: context-aware parsing through the already declared `remark` dependency.
It understands list containers rather than approximating their depth with finding-entry
regexes. There is no new dependency or consumer-facing authoring restriction.

[CommonMark 0.31.2 §4.4](https://spec.commonmark.org/0.31.2/#indented-code-blocks)
and [§4.5](https://spec.commonmark.org/0.31.2/#fenced-code-blocks) distinguish literal
indented code from fences, and require matching fence characters and closing lengths.
A/C alone fix root indentation but retain delimiter mismatches and cannot handle an
unclosed list fence whose container ends before the next root heading.

## Population before comparison

Pinned history: staging `599c8f5f2f3085da281fb299a52baffe3f8ef168`.
Enumerated **all 1,782 first-parent commits**, not a recent sample, with
`git log origin/staging --first-parent --format='%H%x00%B%x00'`.
**300** commit bodies contain `## Fidelity verdict`; **one** of those bodies contains
an indented backtick/tilde delimiter anywhere (a superset of “near the verdict”).

| Merged PR | Commit | Delimiters | Old end line | A/C end line | B end line |
|---|---|---|---|---|---|
| #1639 | `9e6c778fafadab0f1a25cd023512ae5e20b437ac` | two-space backticks in Review findings | 102 | 102 | 102 |

All candidates preserve the historical verdict-section boundary and B preserves the
old gate's passing result. The complete qualifying body is pinned in
`packages/core/hooks/checks/fixtures/fidelity-indented-fence-history.json` and exercised
by the fidelity tests. Counts and HEAD are stored alongside it.

Limit: this is exhaustive **git-history body** coverage; old squash messages do not
necessarily preserve the complete GitHub description. An attempted supplemental
all-merged GitHub read was cancelled by the peer connection and is not claimed as coverage.
The corpus alone cannot establish list-fence compatibility; paired synthetic tests do.

## Regression proof and sibling pins

Before production edits, the new suite ran against the exact `git show HEAD:` production
pre-image: **11 failed / 64 passed**. Seven failures cover boundary detection (four
foreign-evidence false passes, three mismatched-closer false failures); four cover quoted
section headings. SHA, provenance and evidence grammar remain pinned in the fixtures.
Positive controls cover every permitted root indentation and a closed list-nested fence;
the existing suite and historical compatibility case must remain green.

Production population: `rg` over all production TypeScript in `packages/core/hooks`
found one fence-toggle regex, in `sectionEndAt`. Its three consumers (Fidelity,
Provenance, Review findings) now use the same parser-derived code-line mask for both
start headings and end headings. The HTML-comment stripper remains unchanged.

Cold backward sweep additionally found a raw-heading gap in
`packages/core/hooks/checks/pr-body-removal-consumers.ts` (owner: core hook maintainers):
a quoted Removal consumers section is accepted. It has no fence-toggle twin and is an
independent gate concern, left explicit rather than silently bundled into F1.

## Falsifier

A root heading outside CommonMark code still supplies evidence to the preceding verdict,
or a legitimate list-nested fence changes a previously valid gate result. Both directions
are exercised through the exported production check, without mocked parsing.
