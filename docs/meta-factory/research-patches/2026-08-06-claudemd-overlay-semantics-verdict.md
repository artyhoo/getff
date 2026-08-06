<!-- scope:arch-v2-s-e-claudemd-overlay-verdict -->

# claudeMdExcludes overlay semantics verdict — REPLACE-PER-KEY confirmed

> **Scope:** arch-v2-context-pipeline S-E §1 item 4 (P3b) binding instruction: "PARK if
> the docs contradict the replace model". This patch records the verdict from primary-docs
> verification on 2026-08-06, the citations, and the downstream consequences (Task 1
> overlay half un-parked; Task 4 P2b superset assert now load-bearing).
> **Outcome:** the kickoff's REPLACE-PER-KEY overlay model is **CONFIRMED** by primary
> docs. The earlier conclusion in this session (which had concluded "arrays concatenate")
> was based on a misreading of the docs — the concatenate language refers to
> `managed-settings.d/*.json` drop-in files specifically, NOT to `.claude/settings.local.json`.

## §1 The question

When `.claude/settings.local.json` defines a key (`claudeMdExcludes`) that also appears in
`.claude/settings.json`, what is the effective value?

- **REPLACE-PER-KEY** (the kickoff's model): the local list ENTIRELY SHADOWS the project list.
- **CONCATENATE**: the two arrays are concatenated (possibly de-duplicated).
- **DEEP-MERGE**: arrays merge key-by-key.

The kickoff's P2b superset assert is load-bearing ONLY under the REPLACE model — under
concatenate, the local list could only ADD excludes (not subtract), making a "strict subset"
impossible by construction.

## §2 Primary-source citations

Source: <https://code.claude.com/docs/en/settings> (WebFetch 2026-08-06).

### §2.1 General scope precedence (verbatim)

> "When the same setting appears in multiple scopes, Claude Code applies them in priority order:
> 1. **Managed** (highest): can't be overridden by any other scope, apart from the exceptions under Settings precedence
> 2. **Command line arguments**: temporary session overrides
> 3. **Local**: overrides project and user settings
> 4. **Project**: overrides user settings
> 5. **User** (lowest): applies when nothing else specifies the setting"

Local scope (settings.local.json) is rank 3 — higher-priority than project scope (rank 4).

### §2.2 Settings.local.json vs settings.json (verbatim)

> "When both files set the same key, the repository root's value wins, except that permission rules from both files stay in effect."

("the repository root's value" here = `.claude/settings.local.json`, which lives at the
repository root; `.claude/settings.json` also lives at the repository root but is the
"project" scope. The phrasing is awkward but the meaning is unambiguous: **local wins**.)

### §2.3 Exceptions to override behavior

The docs name TWO array-merge exceptions explicitly:

1. **Permission rules** (verbatim): "Permission rules behave differently because they merge across scopes rather than override"
2. **AllowedHttpHookUrls** (verbatim): "Arrays merge across settings sources."

`claudeMdExcludes` is **NOT** named in either exception list. Therefore the general rule
("local REPLACES project") applies.

### §2.4 Managed-settings drop-in directory (verbatim — DOES NOT apply here)

> "Following the systemd convention, `managed-settings.json` is merged first as the base, then all `*.json` files in the drop-in directory are sorted alphabetically and merged on top. Later files override earlier ones for scalar values, **arrays are concatenated and de-duplicated**, and objects are deep-merged."

This paragraph describes the `managed-settings.d/*.json` drop-in merging ONLY. It is NOT
about `.claude/settings.local.json` vs `.claude/settings.json`. The earlier conclusion in
this session had erroneously read this paragraph as describing local-vs-project overlay.

## §3 Verdict

**REPLACE-PER-KEY CONFIRMED.** A `.claude/settings.local.json` that defines
`claudeMdExcludes` ENTIRELY SHADOWS the project list — the project list is not consulted
when the local key is present. The kickoff's overlay model is correct.

## §4 Downstream consequences (binding)

### §4.1 Task 1 (P3b) — measure-always-on.sh overlay half UN-PARKED

The earlier commit `53a8d36f2` had parked the overlay handling pending this verdict. The
follow-up commit `5bc888e12` un-parks it: the meter now applies the EFFECTIVE list (local
if it sets the key, else project) per the REPLACE semantics. The `overlay_source` field
on stderr distinguishes the three cases:
- `overlay_source=project` — local file absent or doesn't set the key
- `overlay_source=local-replace` — local file sets the key, entirely shadows project

### §4.2 Task 4 (P2b) — superset assert IS load-bearing

Under REPLACE, a local list that is a strict SUBSET of the project list silently drops the
missing excludes — a real defect that the P2b section now catches. The acceptance
discrimination pair (`5bc888e12` commit) confirms the section discriminates:

- SUBSET (6 entries, missing `egress-no-api-bypass.md`) → RED, EXIT=1, names the missing file
- SUPERSET (all 7 project entries) → GREEN, EXIT=0

### §4.3 ADR-3 — measurement-vs-gate split unaffected

The gate runs at pre-push/CI (the "deterministic, AI-agnostic" channel per
[`attention-is-not-a-mechanism.md §1`](../../.claude/rules/attention-is-not-a-mechanism.md)).
The overlay verdict concerns only WHICH list the meter applies, not WHERE the gate runs.

## §5 Triggers to revisit

- Claude Code docs introduce `claudeMdExcludes` into the merge-exception list (alongside
  `permissions` and `AllowedHttpHookUrls`) → re-derive this verdict AND re-evaluate whether
  the P2b superset assert is still load-bearing (under concat, it would not be).
- A future CC release changes the merge semantics in any way → re-verify via primary docs.
- The repo authors a `managed-settings.d/` drop-in for `claudeMdExcludes` → that surface
  uses concat-and-de-duplicate, distinct from the local-overlay surface this patch covers.

## §6 §1.7 self-reflexive note

- **Forward-check:** complies with [`research-source-trust.md`](../../.claude/rules/research-source-trust.md)
  (primary-source citation is the canonical docs URL, not a third-party summary); complies
  with [`phase-research-coverage.md §1`](../../.claude/rules/phase-research-coverage.md)
  (negative-existence claim — "claudeMdExcludes is NOT in the merge-exception list" —
  verified against the full primary docs page, not just a keyword search); complies with
  [`attention-is-not-a-mechanism.md`](../../.claude/rules/attention-is-not-a-mechanism.md)
  (the verdict informs a gate, not a bare-attention check).
- **Backward-check:** records the source of the corrected verdict to prevent recurrence
  of the earlier misreading. The earlier conclusion in this session (which had parked
  Task 1's overlay half) is captured here as a documented error (the misreading of the
  managed-settings drop-in language as describing local-vs-project overlay).
