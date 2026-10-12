---
title: evidence-regeneration rule
description: The rule for refreshing live-fired evidence on a backend after a toolchain pin bump — re-fire the fixture with the version CI resolves and paste the fresh output, never edit the evidence block by hand.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/evidence-regeneration.md
  - .agents/rules/00-rule-index.md
  - .github/workflows/audit-self.yml
  - packages/core/backends/cargo/firing.test.ts
  - packages/core/composition/enforcement-line.ts
  - packages/core/composition/gates/composition-gate.ts
  - packages/core/backends/astgrep/firing-runner.ts
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: pin-site-grep, stack: repo, date: 2026-10-10, result: two-sites-0.44.1 }
---

# evidence-regeneration rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-evidence-regeneration plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `evidence-regeneration` |
| kind | rule |
| ships-to | framework |
| description | the evidence-regeneration procedure — §1 the rule, §2 the verified per-backend loop (numbered) + the safety interlocks, §3 the two entry conditions + the firing-evidence invariant, §4 the paste-from-fresh-stdout anti-theatre rule, §5 anti-patterns, §6 promotion/retirement. |
| source | `.agents/rules/evidence-regeneration.md:14` |
| class | B |
| fires | a freshness gate RED, or a first live-fired matrix cell. |
| channels | paths:(1), edit-time inject |
<!-- getff:end section=F1-card-evidence-regeneration -->

<!-- vale on -->

## Explanation

This framework's language backends each carry a matrix of evidence: proof that
a rule actually fires under a real linter, at a pinned tool version. When the
pin bumps, that evidence must be re-derived — and the failure that produced
this [rule](../../terms.md#rule) was an update that looked like a refresh but
was not. A regeneration changed the recorded date and toolchain string while
the captured diagnostic stayed byte-identical to the old block. Every
deterministic gate stayed green: the freshness gate only compares the
toolchain string, so a carried-over diagnostic is invisible to it. The
regeneration was semantically wrong and had to be reverted.

The rule is the verified procedure for doing it right. Its loop, per backend:
install the version CI will resolve (not whatever is on your local path),
re-fire the committed invalid fixture with that tool, confirm the expected
diagnostic actually appears, rewrite only the evidence block — date, toolchain
string from the live `--version` output, and one diagnostic pasted from *this
session's* firing — then verify the freshness gate and the composition gate
green **before** landing the pin-site edit and the matrix edit as one commit.

Two of those steps deserve their plain-English emphasis. First, "the version
CI will resolve" is a trap the rule's incident fell into: regenerating against
a host-local tool produces evidence that goes red again in CI, because the
freshness gate compares against the CI-resolved version. Each pin lives at
specific, enumerated sites — and several live at *two* sites, so a bump that
edits one leaves the other job on the old version. Re-deriving them is one
grep the rule itself prescribes:

```bash
grep -n 'ast-grep/cli@' .github/workflows/audit-self.yml
```

```text
355:        run: npm install -g @ast-grep/cli@0.44.1 # zizmor: ignore[adhoc-packages]
1129:        run: npm install -g @ast-grep/cli@0.44.1 # zizmor: ignore[adhoc-packages]
```

Two sites, same version — the state the rule demands; a bump that touched only
line 355 would leave a divergence this grep exists to catch. Second, the
paste-from-fresh-stdout step is the load-bearing one: the evidence block is
only evidence if it was produced this session, and the rule requires the fresh
output to be quoted in the PR body so a reviewer can see it was re-derived,
not carried over.

The `class` row is `B`, and the rule's header explains why it can never
honestly be a [gate](../../terms.md#gate) as written: the one step that
matters — was this diagnostic pasted from *this session's* fresh stdout? — is
not mechanically checkable, because the incident that proved the gap passed
every gate with a stale byte-identical paste. Detection exists and is
deterministic (the freshness gate and the coherence gate); this rule is the
procedure for satisfying them, delivered where backend files are edited.

What the rule does not do: it does not gate the *procedure* — a hand-written
toolchain string, a split commit, or a carried-over diagnostic would all pass
the gates the same way the original incident did. The rule's maintenance
section prices the alternative deliberately: a script that automates the loop
is the expensive branch, justified only by a *second* recorded incident of
following the recipe by hand and still getting it wrong. One incident is
recorded; the script is not built. And the recipe's cargo correction is
stated in place of an out-of-scope spec edit: cargo is a full CI-verified lane
today — its live-fire test skips when the tool is absent, never because CI is
running.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree. Pins re-verified 2026-10-12 at the universal-integration branch head: the range's rule/test/workflow edits (including this PR's in-body citation renumber) shifted no pin cited on this page — every pin was re-read at the current base and still shows the quoted content.

- The rule text: `.claude/rules/evidence-regeneration.md` — `paths:` and the
  `<!-- globs: -->` marker at `:3` to `:9`, the class-`B` ceiling rationale at
  `:12`, the fires line at `:13`, and the #1033→#1041 origin incident at
  `:17`.
- The rule statement: `:21` (§1); the numbered loop: `:27` to `:45` (§2);
  CI-as-authoritative-resolver at `:47`; the per-backend firing-command table
  at `:51` to `:57`; the verify-before-commit interlock at `:69`.
- The pin-site table and the dual-site warning: `:73` to `:81` — the grep
  above is the rule's own prescribed re-derivation, quoted at `:81`.
- The paste-from-fresh-stdout rule (load-bearing, #1033): `:94` to `:98`
  (§4), with the anti-patterns `#evidence-theatre`, `#regen-against-host-local-tool`,
  `#hand-written-toolchain`, `#split-regen-commit` at `:102` to `:105`.
- The two entry conditions and the firing-evidence invariant: `:85` to `:88`
  (§3); the predicate itself at
  `packages/core/composition/enforcement-line.ts:34` to `:38` (measured this
  base: `status !== 'no' && evidence?.kind === 'live-fired'`).
- The FF8004 coherence gate's deliberate silence on the spec-legal rendered
  case: `packages/core/composition/gates/composition-gate.ts:143` to `:158`.
- The cargo posture (no `!isCI` guard; skip on tool presence only):
  `packages/core/backends/cargo/firing.test.ts:38` and `:57`.
- The shared firing runner the manual firing reproduces:
  `packages/core/backends/astgrep/firing-runner.ts:49` (and the ruff twin at
  `packages/core/backends/ruff/firing-runner.ts:53`).
- The pin sites quoted above: `.github/workflows/audit-self.yml:355` and
  `:1129`, both `@ast-grep/cli@0.44.1` at this base.
- The index row grading this rule class `B` with channels
  `paths:(1), edit-time inject`: `.claude/rules/00-rule-index.md:24`.
