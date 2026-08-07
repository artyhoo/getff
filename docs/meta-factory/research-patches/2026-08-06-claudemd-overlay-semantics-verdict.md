<!-- scope:arch-v2-s-e-claudemd-overlay-verdict -->

# claudeMdExcludes overlay semantics verdict — REPLACE-PER-KEY **OVERTURNED**, semantics are MERGE

> **⚠ VERDICT SUPERSEDED 2026-08-07.** The REPLACE-PER-KEY conclusion recorded below on
> 2026-08-06 is **WRONG**. The shipped client merges array settings across settings files
> (union + dedupe); `fallbackModel` is the only replace exception. The corrected verdict and
> its evidence are in **§3**; §1-§2 are preserved as the record of how the wrong answer was
> reached (T18 — correct in place, do not delete). **Consequence:** the kickoff's PARK
> condition ("PARK if the docs contradict the replace model") was MET, and P2b was removed.
>
> **Scope:** arch-v2-context-pipeline S-E §1 item 4 (P3b) binding instruction: "PARK if
> the docs contradict the replace model". This patch records the 2026-08-06 primary-docs
> verification, its citations, the 2026-08-07 source-level correction, and the downstream
> consequences.

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

## §3 Verdict — CORRECTED 2026-08-07: MERGE (union + dedupe)

**The §2 reasoning is unsound and its conclusion is overturned.** The docs page describes
*scope precedence*, which governs scalar keys; §2.3 then infers array semantics from the
absence of `claudeMdExcludes` in an exception list. That inference is backwards, and the
client settles it directly.

Source: the installed binary `@anthropic-ai/claude-code/bin/claude.exe`, **v2.1.207, commit
`bc512d563325`** (`strings -n 8` + grep; every symbol resolved, nothing inferred):

```js
_1 = ["userSettings","projectSettings","localSettings","flagSettings","policySettings"]  // fold order
GQ(): projectSettings → .claude/settings.json ; localSettings → .claude/settings.local.json
Soi(): n = eie(n, sourceSettings, ipe)   // lodash-mergeWith shape, `ipe` = customizer

function ipe(e,t,r){ if(Array.isArray(e)&&Array.isArray(t)){ if(r==="fallbackModel") return t; return WSm(e,t) } return }
function WSm(e,t){ return Mo([...e,...t]) }
function Mo(e){ return [...new Set(e)] }
```

**Array settings UNION with dedupe. `fallbackModel` is the single hard-coded replace key.**
Scope precedence sets the fold ORDER (so local wins for scalars, exactly as §2.1 says); it
does not make arrays replace. The docs agree once read for what they state rather than for
what they omit — `settings.md:278` names `fallbackModel` as the array key that does NOT
merge across settings files, which presupposes that the rest do.

**Falsifier:** a client ≥2.1.211 whose `ipe` special-cases `claudeMdExcludes` alongside
`fallbackModel`. Re-run the grep chain above against the installed binary.

**Not verified empirically:** `claude doctor` does not print effective settings, so no live
A/B discriminator was obtained. Note the "4 local globs work, 3 project relatives do not"
observation from 2026-08-01 is **non-discriminating** — merge and replace predict identical
output when the project entries are inert.

## §4 Downstream consequences (binding)

### §4.1 Task 1 (P3b) — measure-always-on.sh applies the UNION

The meter now applies `project ∪ local`, deduped. `overlay_source` on stderr reports the
composition: `none` · `project` · `local` · `project+local`. The previous `local-replace`
value is gone. Re-measured after the correction: **48,671 B, `overlay_source=project`** —
unchanged, because the host's local file currently sets no `claudeMdExcludes` key, so both
models coincide today. The fix is correctness-in-general, not a number change.

### §4.2 Task 4 (P2b) — superset assert is VACUOUS; P2b REMOVED

Under union the effective list is always `project ∪ local ⊇ project`, so "every file matched
by project is also matched by local" holds by construction and the assert can never go red.
§1 of this patch already stated this consequence ("under concatenate, the local list could
only ADD excludes (not subtract), making a 'strict subset' impossible by construction") and
then rejected the model that produced it.

P2b is removed: the pre-push section, its escape token `AIF_CLAUDEMD_LOCAL_SHADOW_ALLOW`,
the `worktree-doctor.sh` sweep arm, and the meter's `local-replace` branch. The
`packages/core` `picomatch` pin and SSOT #238 stay — principle 34 (P2a) imports picomatch
directly and is independent of P2b.

**Residual risk this does NOT cover:** under union the real hazard is the inverse — a local
file can silently ADD excludes and hide rules the project expects always-on. That needs its
own gate with its own justification, not a re-pointed P2b.

### §4.3 ADR-3 — measurement-vs-gate split unaffected

The gate runs at pre-push/CI (the "deterministic, AI-agnostic" channel per
[`attention-is-not-a-mechanism.md §1`](../../.claude/rules/attention-is-not-a-mechanism.md)).
The overlay verdict concerns only WHICH list the meter applies, not WHERE the gate runs.

## §5 Triggers to revisit

- A client release changes `ipe()` — specifically, any key other than `fallbackModel`
  short-circuiting to replace → re-derive §3 by re-running the grep chain against the
  installed binary. Docs alone are not sufficient; that is what produced the wrong verdict.
- The repo authors a `managed-settings.d/` drop-in for `claudeMdExcludes` → that surface has
  its own documented concat-and-de-duplicate rule (§2.4), consistent with §3 but reached
  through a different code path.
- Someone proposes a gate premised on a local list SUBTRACTING project excludes → it is
  unreachable; see §4.2 before building it.

## §6 §1.7 self-reflexive note

- **Forward-check:** complies with [`research-source-trust.md`](../../.claude/rules/research-source-trust.md)
  (primary-source citation is the canonical docs URL, not a third-party summary); complies
  with [`phase-research-coverage.md §1`](../../.claude/rules/phase-research-coverage.md)
  (negative-existence claim — "claudeMdExcludes is NOT in the merge-exception list" —
  verified against the full primary docs page, not just a keyword search); complies with
  [`attention-is-not-a-mechanism.md`](../../.claude/rules/attention-is-not-a-mechanism.md)
  (the verdict informs a gate, not a bare-attention check).
- **Backward-check (rewritten 2026-08-07):** the correct answer was reached **twice and
  discarded twice**, which is the finding worth carrying, not the docs quote. (1) An earlier
  session concluded "arrays concatenate" — right — and §2.4 above overrode it as a misreading.
  (2) A spec draft wrote `project ∪ local` — right — and spec §1.6 FORK D round-4 MAJOR-3
  overrode it with the stated reason that union "contradicts P2b" and "under union it would be
  vacuous". In both passes the disproof was written down and then treated as grounds to reject
  the model, because the gate was held fixed and the world model was adjusted to keep it
  load-bearing. The shape to watch for: **"model X would make our gate pointless, therefore
  not X."** The mis-attributed §2.2 citation is downstream of that, not the root cause.
  Method lesson: for behaviour of a shipped binary, read the binary; docs are corroboration.
