<!-- scope:arch-v2-s-e-instructionsloaded-observability-verdict -->

# InstructionsLoaded hook observability verdict — OBSERVE yes, BLOCK no

> **Scope:** arch-v2-context-pipeline S-E §1 item 5 (P3c) ADR-3 falsifier note + measurement
> extension probe. ADR-3 (gate at pre-push/CI, measurement-vs-gate split — see
> [`2026-07-31-arch-v2-context-pipeline-design.md`](../superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md))
> chose the pre-push/CI channel partly on the assumption that session-start hooks could not
> reliably BLOCK instruction loading. This patch records the falsifier outcome from
> primary-docs verification on 2026-08-06. **Outcome:** InstructionsLoaded CAN OBSERVE the
> loaded set (and is therefore a viable measurement-extension channel) but CANNOT BLOCK
> (exit code is ignored) — confirming the ADR-3 channel choice stays at pre-push/CI.

## §1 The two questions (P3c, ADR-3 falsifier note)

1. **Observability:** can a hook on `InstructionsLoaded` OBSERVE the full loaded set?
2. **Blocking:** can a hook on `InstructionsLoaded` BLOCK the load?

A "yes" on observability alone does NOT change the ADR-3 gate-channel choice — blocking
is the load-bearing property for a gate. Observability-only hooks are channels for
*measurement* (counting bytes loaded, attribution to sources), not for *gating*.

## §2 Primary-source citations

Source: <https://code.claude.com/docs/en/hooks> (WebFetch 2026-08-06).

### §2.1 When InstructionsLoaded fires (verbatim)

> "When a CLAUDE.md or `.claude/rules/*.md` file is loaded into context. Fires at session start and when files are lazily loaded during a session"

### §2.2 Matcher values for InstructionsLoaded (verbatim `load_reason` enumeration)

> "`session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact`"

These five `load_reason` values match every mechanism by which a CLAUDE.md or `.claude/rules/*.md`
file can enter the loaded set — covering both session-start bulk-load and all five lazy-load
triggers during a session. A hook matching on `load_reason` therefore observes the COMPLETE
population, not a subset.

### §2.3 JSON payload (verbatim)

Common input fields shared with all hook events: `session_id`, `prompt_id`, `transcript_path`,
`cwd`, `permission_mode`, `hook_event_name`. The InstructionsLoaded matcher values are the
`load_reason` enumeration above.

### §2.4 Blocking capability (verbatim)

> "Exit code is ignored"

And from the exit code table:

> "InstructionsLoaded | No | Exit code is ignored"

The exit code is ignored **regardless of value** — including exit code 2 (which on other
hook events blocks the action). This makes InstructionsLoaded strictly an observation channel.

## §3 Verdict

### §3.1 Observability — YES (with caveats)

InstructionsLoaded fires on every load event (5 `load_reason` values cover the full surface).
A hook can therefore OBSERVE the loaded set. Caveats:

1. **It is an event stream, not a snapshot.** Each fire carries one file load; the hook
   must accumulate state across fires to build the full loaded-set picture. There is no
   single "here is everything loaded" payload.
2. **Lazy-loaded files fire late.** A file loaded via `nested_traversal` mid-session only
   fires InstructionsLoaded at the moment of traversal, not at session start. A snapshot
   meter must wait for session end (or sample at a chosen moment) to be complete.
3. **No file-content payload.** The hook receives the *path*, not the bytes; the meter
   must read the file itself to count bytes.

### §3.2 Blocking — NO (decisive)

Exit code is ignored for InstructionsLoaded. A hook on this event CANNOT block the load.
This decisively falsifies the hypothetical "block at session-start" alternative to ADR-3.

### §3.3 ADR-3 channel choice — UNCHANGED

The ADR-3 choice (gate at pre-push/CI, not at session-start) is **confirmed** by §3.2.
A session-start hook can never be a gate; the deterministic, AI-agnostic gate must run
upstream of the session — at pre-push or CI. The P2b local-shadow section and the P3a
budget gate both run at pre-push for this reason.

### §3.4 Measurement-extension channel — YES (viable, belongs to S-H)

§3.1 establishes observability, which makes InstructionsLoaded a viable channel for the
P3d host-side measurement work (attribution by source, arrival-position, edit-time
injection firing rates — the items moved to S-H per spec §1.6 FORK C). S-E does NOT
implement a live host-session probe here (T-SE-B); S-H runs the live observation if and
when the host measurement work needs it.

## §4 Discrimination note (T-SE-A anti-tautology)

A LIVE host-session confirmation is NOT this stage's job. The verdict here is
primary-docs-only: it establishes what InstructionsLoaded is *capable* of (observe, not
block). Whether the *actual* CC client honours the docs at runtime is a S-H verification
task — a falsifier probe run on the host against a real session would surface any
docs/runtime drift. This stage does not manufacture such a probe from inside the aif
container (where no host session exists).

## §5 Triggers to revisit

- Claude Code docs change InstructionsLoaded to support blocking (e.g., exit code 2
  honoured) → re-open ADR-3: a session-start gate becomes viable, the pre-push/CI channel
  is no longer the only deterministic gate option.
- The matcher enumeration gains a new `load_reason` value → re-derive the observability
  completeness claim (the new value might cover a previously-unobserved surface).
- A runtime probe contradicts the docs (InstructionsLoaded actually blocks, or actually
  fires on a different schedule) → update this patch with the runtime evidence.

## §6 §1.7 self-reflexive note

- **Forward-check:** complies with [`research-source-trust.md`](../../.claude/rules/research-source-trust.md)
  (primary-source citation is the canonical docs URL); complies with [`attention-is-not-a-mechanism.md §1`](../../.claude/rules/attention-is-not-a-mechanism.md)
  (the verdict distinguishes gate vs measurement channels explicitly — a session-start
  hook being merely "observed" is NOT promoted to gate status); complies with
  [`phase-research-coverage.md §1`](../../.claude/rules/phase-research-coverage.md) (the
  blocking-capability claim is a negative-existence assertion verified against the
  full primary docs page, not a keyword search).
- **Backward-check:** records the falsifier outcome for the ADR-3 channel choice so
  future stages do not re-litigate it. The "live host-session confirmation NOT in this
  stage" line prevents the container from manufacturing a fake observation (T-SE-B).
