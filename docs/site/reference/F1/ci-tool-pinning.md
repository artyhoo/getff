---
title: ci-tool-pinning rule
description: The rule that a CI job's behaviour must not depend on what a registry happens to serve the day the job runs — pin the tool version, install from the lock file.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/ci-tool-pinning.md
  - .agents/rules/00-rule-index.md
  - packages/core/hooks/checks/unpinned-tool-install.ts
  - packages/core/hooks/pre-push.ts
  - packages/core/hooks/unpinned-tool-install.test.ts
  - .github/workflows/audit-self.yml
  - docs/site/reference/F1/companion-install-principle.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: pin-and-deferred-gap, stack: repo, date: 2026-10-10, result: pinned-plus-18 }
docs-refresh: deferred — re-verified 2026-10-12, the cited pre-push.ts moved in-range only by the SHIPPED_SKILL_SLUGS intent line and citation renumbers at :2900+; the ci-tool-pinning wiring this sheet maps at pre-push.ts:823 is untouched; clears at the next gold refresh of this page
---

# ci-tool-pinning rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-ci-tool-pinning plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `ci-tool-pinning` |
| kind | rule |
| ships-to | framework |
| description | CI tool pinning discipline — §1 the two rules (version pin + lockfile-aware install), §2 scope (this repo's `.github/workflows/` + tracked shell scripts), §3 escape hatch, §4 relationship to companion-install-principle.md, §5 promotion / retirement. |
| source | `.agents/rules/ci-tool-pinning.md:20` |
| class | A |
| fires | editing `.github/workflows/**` or any repo shell script. |
| channels | paths:(6), edit-time inject |
<!-- getff:end section=F1-card-ci-tool-pinning -->

<!-- vale on -->

## Explanation

A CI job that says `pip install zizmor` gets whatever version the package index is
serving that morning. If the tool's authors publish a breaking change, your pipeline
changes behaviour with no commit to point at. This [rule](../../terms.md#rule) closes
that hole with two rules. Rule A: a CI install of a tool must carry an explicit
version pin. Rule B: a Node dependency install in CI must go through the project's
lock file (`npm ci` with a prefix), not a bare install — and where the rule demands
that, the repository borrows an existing security scanner (`zizmor`) to check it rather
than writing a second detector.

The class row is `A`: the [gate](../../terms.md#gate) ships as code. A pre-push
check scans the two populations the rule names — workflow
files and tracked shell scripts — for install lines, and rejects an unpinned one
with a message telling you how to fix it. The detection is split into small
functions: one decides what counts as a shell-script population file, one recognises
a `pip install` line, one a global `npm install` line, and one walks every changed
file and applies them.

Two facts show the rule in real use. First, the scanner the CI self-audit runs is
itself pinned, exactly as the rule requires:

```bash
grep -n "run: pip install zizmor==" .github/workflows/audit-self.yml
```

```text
2234:        run: pip install zizmor==1.26.1
```

Second, the rule is honest about what it has not fixed yet. Its own file records a
deferred gap: bare installs into a project's root are not gated, because the
repository still has sites that rely on them and a rule the repo itself violates
would be discipline theatre. Counted at this base, the self-audit workflow alone
carries 18 bare installs of that shape:

```bash
grep -c "npm install --silent" .github/workflows/audit-self.yml
```

```text
18
```

That number is the gap, measured — the rule file's `:44` records the same decision
in prose, and the class-`A` test suite pins the detector's current behaviour around
it rather than letting the gap widen silently.

The rule also draws a boundary against its neighbour
[companion-install-principle](companion-install-principle.md): install lines that
belong to that rule's companion manifest are out of scope here, because that rule
owns a different question — who updates the tool — and forbids the very version pin
this rule would otherwise demand. Each file's enforcement names which of the two it
answers.

What the rule does not do: it does not pin your application dependencies (the
lock file rule covers the install *method*, not the versions inside the lock file),
and its escape hatch — a comment token that suppresses the check for one line — is
an escape, not a pattern. At this base the token appears in the rule text, the
detector and test fixtures, but no install line in any workflow or tracked shell
script carries it: nothing live needs the exemption yet.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree. Pins re-verified 2026-10-12 at the universal-integration branch head: the range's rule/test/workflow edits (including the in-body citation renumber) shifted no pin cited on this page — every pin was re-read at the current base and still shows the quoted content.

- Rule A (version pin) and its MUST wording: `.claude/rules/ci-tool-pinning.md:27`
  to `:34`. Rule B (lockfile-aware install): `:36` to `:42`.
- The deferred bare-root gap, stated in the rule's own file: `:44`.
- The scope widening to tracked shell scripts (2026-07-10, after a setup-script
  incident): `:51`; the companion-manifest exclusion: `:53`.
- The escape hatch token and its same-line placement: `:67` to `:76`. (A rationale
  after `allow` is recommended but not gate-enforced here — `:76`; the ≥20-character
  rationale floor is an idiom in the *neighbouring* gates that mirror this token.)
- The shipped detector: `packages/core/hooks/checks/unpinned-tool-install.ts` —
  `:54` (shell-script population test), `:72` (escape-token regex), `:94` (pip-line
  check), `:125` (npm-line check), `:153` (entry point). Wired into pre-push at
  `packages/core/hooks/pre-push.ts:823`.
- The paired test suite: `packages/core/hooks/unpinned-tool-install.test.ts` —
  42 `it(` declarations counted at this base.
- The index row grading this rule class `A`:
  `.claude/rules/00-rule-index.md:15`.
- The pinned-scanner and bare-install counts above both ran at this base; the
  numbers are quoted as returned.
