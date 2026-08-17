<!-- scope:dual-impl-s8-detection-layer -->

# 2026-08-09 — dual-implementation §8 had no detection layer

Scope: the gap between [dual-implementation-discipline.md §8](../../../.claude/rules/dual-implementation-discipline.md)
and [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md), and the
measurement that decided each anti-pattern's channel.

## §1 The gap

`dual-implementation-discipline.md:14` declared the three §8 *semantic* anti-patterns
(`#two-prompts-drift`, `#sync-by-copy-paste`, `#brand-name-detection`) «reviewer-time judgment,
not gated». `attention-is-not-a-mechanism.md §1` forbids exactly that: a load-bearing check MUST
be (a) a deterministic gate at the earliest reachable channel or (b) a NAMED cold-agent protocol
with structured output. Bare attention may be merge *authority*, never the *detection* layer —
`#hope-as-gate`.

§5/§6 of the same rule were already properly gated (`channel-coverage.sh` Surface 8 +
`check-hook-marker.sh`). Only the §8 half was uncovered. It was the **sole outlier** across the
twelve surfaces carrying the «judgment ceiling → delegated to a named cold agent» class; the
other eleven each name a concrete agent (e.g. `source-before-shape.md:3` →
`capability-reuse-auditor.md`; `ai-laziness-traps.md` T21 → `backward-sweep-auditor.md`).

## §2 Measurement (both directions, per the 2026-08-09 allowlist-closure patch shape)

The governing discipline: a candidate detector must fire on a known violation **and** stay
silent on the legitimate shape. A detector that fires on neither is worthless; one that fires on
both is a false-positive machine. Each §8 member was measured before being assigned a channel.

### 2.1 `#brand-name-detection` — GATEABLE

The rule's own falsification command, run verbatim over the real population:

```console
$ grep -rn '"claude"\|"cc"\|ANTHROPIC' .claude/hooks/ | wc -l
0
```

Zero — but that alone proves nothing (T14: clean result on an unvalidated detector is not a
clean bill). Running it against a known-violating fixture, it **did** fire. Running it against a
§4-*legitimate* capability check, it also fired:

```console
$ grep -rn '"claude"\|"cc"\|ANTHROPIC' fx/legit.sh
fx/legit.sh:3:if [[ -n "$ANTHROPIC_API_KEY" ]]; then echo has-key; fi
```

So the command as printed in the rule was **not shippable verbatim** — it flags the very shape §4
prescribes. The refined detector matches a brand literal only in *comparison* position
(`==` / `!=` / `=~` / space-delimited `=` / `case … in claude)`), whole-line comments stripped:

| direction | fixtures | result |
|---|---|---|
| true positive | `== "claude"`, `= 'claude'`, `case … in claude)`, `=~ anthropic` | **4/4 fire** |
| false positive | `$ANTHROPIC_API_KEY`, `$CLAUDE_CODE_HOOKS_ENABLED`, `.claude/` path, comment | **0/3 fire** |
| real population | 267 tracked `*.sh` | **0 hits** (genuinely clean) |

→ shipped as a gate: `tests/agnosticism/probes/brand-detection.sh` (Surface 10 of principle 21),
with a both-direction seeded-break in `tests/agnosticism/harness-self.test.sh`.

> **A third carve-out was found by dogfooding, not by design.** On its first full-population run
> the shipped probe flagged one file: `harness-self.test.sh` itself, at the `printf` line that
> *generates* the seeded violation fixtures. A brand literal inside a printed payload is emitted
> text, not a branch this script takes. Carve-out added for lines whose leading command is
> `echo`/`printf` — the same carve-out, for the same reason, as
> [ci-tool-pinning.md §2](../../../.claude/rules/ci-tool-pinning.md) «Printed hints». Re-verified
> after: 4/4 seeded violations still flagged, 3/3 legitimate shapes still silent, whole-repo audit
> clean. Recorded here because a gate whose first real finding is its own test harness is exactly
> the false-positive shape §2.2 rejects the `spec:` sketch for.

### 2.2 `#sync-by-copy-paste` — NOT gateable (measured, not assumed)

The rule shipped a «reviewer-time grep sketch» at `:199`: flag any `@dual-pair` member lacking a
`spec:`/`spec-of:` pointer. Scored against ground truth (does the group actually contain ≥5
consecutive verbatim non-boilerplate lines?) over all 24 anchor groups:

```text
groups=24  proxy TP=5  FP=8  FN=2  TN=9      → precision 38%, recall 71%
```

It flagged groups sharing at most **one** line (`review-sidecar`, `rule-tests-protocol`,
`cross-worktree-coordination-doc-sync`, …), and it called `deps-hash-check-dogfood` *clean* while
its two members share **257** verbatim lines.

Inverting to a raw «≥5 verbatim lines» threshold fails the other way — the largest real runs are
all **intentional**:

```text
 340 lines  runtime-bridge-aif-handoff   src/AifHandoffBackend.ts ~ vendor/src/AifHandoffBackend.ts
 257 lines  deps-hash-check-dogfood      .claude/hooks/… ~ packages/core/hooks/…
  69 lines  runtime-bridge-types         src/resolver.ts ~ vendor/src/resolver.ts
```

The `vendor/` copies are byte-identical *by construction* (the CLAUDE.md vendor carve-out); the
dogfood twin has a byte-identity test at `packages/core/hooks/deps-hash-check.test.ts:515`.
Separating a deliberate twin from copy-rot requires identifying and judging a *mechanism* — a
judgment, not a threshold.

> **Measurement caveat (recorded because it nearly produced a false clean).** The first run of
> this comparison scored `maxrun 0` for every group. Cause: BSD `diff` on macOS rejects GNU
> `--unchanged-group-format` (`rc=2`, empty stdout), so every run silently measured zero. Caught
> by sanity-checking a pair known to be byte-identical. Re-run with Python `difflib`. The numbers
> above are from the corrected run.

### 2.3 `#two-prompts-drift` — NOT gateable

«Diverge by ≥3 *substantive* lines (excluding boilerplate, comments, path references)» — the
exclusion set is the whole difficulty. No deterministic form of «substantive» survives
[no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md).

## §3 Prior-art consult (BFR §3) — [SSOT #242](../prior-art-evaluations.md)

DeepWiki (`kucherenko/jscpd`) + WebSearch ≥3 phrasings. jscpd: Rabin-Karp token similarity, «does
not have semantic judgment to distinguish between intentional and accidental duplication» —
handled only via `jscpd:ignore-start` / `--ignore` globs. PMD CPD: same shape. Trail of Bits
Vendetect: MOSS/winnowing, built for exactly the vendored-vs-copied question, still leaves the
legitimate-or-not call to the analyst.

**T16 problem-class check.** Upstream problem class: *find* duplicated token blocks in an unknown
corpus. Our problem class: the pairing is already **declared** by the anchor; the unknown is
intentional-twin vs copy-rot. Different — upstream validation does not transfer. Adding jscpd
would also trip the BFR cost gate (new dependency, no cited friction instance). Verdict:
REFERENCE the detectors, BUILD the judgment layer.

## §4 What shipped

1. **Gate** — `tests/agnosticism/probes/brand-detection.sh` (Surface 10) + both-direction
   paired-negative (4 seeded violations flagged, 3 legitimate shapes silent) in
   `tests/agnosticism/harness-self.test.sh`.
2. **Named cold agent** — `agents/dual-channel-drift-auditor.md`, PR-blind, anchor-group input
   contract, verdicts INTENTIONAL-TWIN / SSOT-POINTER / COPY-RISK / DRIFT / INCONCLUSIVE. Requires
   a *named mechanism* (regenerating hook, byte-identity test) to justify INTENTIONAL-TWIN —
   absent one, the honest verdict is COPY-RISK.
3. **Class line + §8 + §9 rewritten** to state only what actually ships, with the measurement
   inline and a re-gate trigger.

Reuse was checked first: all 18 `agents/*.md` were read. `capability-reuse-auditor` (single
proposed capability; should-this-exist) and `backward-sweep-auditor` (change class → sibling
surfaces; PR-blind) have different input contracts, populations, and verdict vocabularies from
«an already-declared pair group; are these two in sync». BUILD justified.

## §5 Self-application (T15)

This patch's own claims are measured, not asserted: every verdict above carries a command and its
output, and the one measurement that broke (§2.2 caveat) is recorded rather than quietly re-run.
The `#brand-name-detection` gate is dogfooded — it runs over this repo's own 267 scripts,
including the probe that implements it (whose brand literals live in comments and are stripped).
The agent is subject to the discipline it audits: it carries a `<!-- spec: -->` pointer to the
rule it enforces, so it is an SSOT-POINTER member by its own §7 classification rather than a
fourth copy of the §8 text.
