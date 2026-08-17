<!-- scope: arch-prep handoff v3 — the autonomous-night contour, commissioned by the operator
     2026-08-09 at the close of the v2 session-bus contour. This is a CONTINUATION handoff
     (the v2 spec survived its review contour and stands r2-repaired), NOT a membrane
     fresh-take: no sections are sealed. Nothing load-bearing remains only in the v2
     session's chat — state, dispositions, and open forks are all on disk. -->

# Arch-prep v3: autonomous night — /night-mode joins the seat design (2026-08-09)

> **Authoritative for:** the v3 continuation protocol (§0), the operator's directives
> verbatim-faithful (§1), contour state at handoff (§2), carried work items (§3), open
> design questions for v3 (§4).
> **NOT authoritative for:** the reviewed v2 design — [2026-08-09-session-bus-v2.md](2026-08-09-session-bus-v2.md)
> stands as repaired; ADR Parts 1/3/4 — [2026-08-09-pipeline-chips-session-bus-design.md](2026-08-09-pipeline-chips-session-bus-design.md);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Current as of 2026-08-09.** Branch: `claude/pipeline-chips-auto-sessions-e9b6de`.

## §0 Protocol for the next session

Fresh top-tier session, `/arch <this doc>`. Continuation, not membrane — reading order:

1. This doc in full.
2. The v2 spec **in full** ([2026-08-09-session-bus-v2.md](2026-08-09-session-bus-v2.md)),
   including §14/§14b dispositions — do NOT re-litigate discharged findings without new
   evidence; the 2-round review cap was reached and the repairs answer a named finding
   each.
3. On demand: [arch-prep-session-bus-v2 §2](2026-08-09-arch-prep-session-bus-v2.md)
   (verified capability facts) and the merged ADR Parts 1/3/4 (chips D1/D2, handoff D6–D8,
   calibration D9 — all standing, none re-opened by v2 or by this handoff).

The new scope (§1) runs the normal /arch contour: ideate → cold two-altitude review →
route. The deferred probes (§3) gate Part-II *landing*, not v3 ideation — interleave them
as separate tasks per the operator's instruction.

## §1 Operator directives (2026-08-09, paraphrased faithfully from Russian)

1. **Add /night-mode to the seat design** alongside /arch, /pipeline, /dispatcher: the
   autonomous night is to be DESIGNED INTO the four-skill architecture, not bolted on.
2. **All four use the session bus** (v2 Part-II grammar/addressing as the base; its probes
   pending).
3. **Self-cleaning at a context cap:** when a seat reaches a defined context threshold it
   hands off / re-invokes itself. The v2 night-continuation ladder (spec §4) is the base;
   cap value + trigger mechanics are v3 design scope.
4. **Chips where needed** (ADR Part-1 D1/D2 stand — chips are the day-time spawn/attention
   UI; they never enter the bus).
5. **Maximally autonomous** — minimal operator relay across the whole contour. Standing
   earlier directives remain ratified: night autonomy with morning review; bursts are
   acceptable spend; night preferred as SEVERAL communicating self-respawning sessions
   (recorded with its F4 dependency in spec §4); pointer-only / untrusted-body / bus never
   load-bearing / no daemons / no new deps / capability-check constraints all stand.

## §2 Contour state at handoff

- **v2 spec status:** PHASE-B ROUND-2 REPAIRED at the review cap. Commit chain:
  `42f8836d72` (Phase-A membrane draft, read prep §1 only) → `83c6e78901` (fact
  reconciliation) → `3a150e7d9e` (r1 after two cold REVISE verdicts) → `dcf26617dc` (r2
  repairs + operator split directive) → `0a96e6fcff` (night continuation ladder).
- **UNRESOLVED routing fork** (operator did not pick before closing the session): Part I
  (night-autonomy policy, bus-free) → Phase C now [author-recommended] · vs · narrow cold
  delta-check of the r2 repairs first · vs · full third review pass over the cap. **v3
  should re-surface this EARLY** — Part I is also the natural vehicle for §1's night-mode
  scope, so the fork may dissolve into v3's own routing.
- **Part II** (doorbell overlay) parked behind P1/F4/P4; `ANSWERED` reserved (empty
  recipient class); addressing = cwd-only per-role files pending the P4 join probe.
- Round-1/round-2 review reports were session-ephemeral scratchpad files; every finding
  and disposition is inlined in spec §14/§14b.

## §3 Carried work items

| Item | State | Recipe / notes |
|---|---|---|
| P1 idle-wake | deferred to separate task (operator) | spec §13; co-critical for night push |
| F4 CLI headless spawn + SendMessage | **co-critical** — night session-birth; BOTH the split directive AND §1.3 self-cleaning-at-cap hang on it at night | prep-v2 §2 recipe |
| P4 cwd join verification | Part-II entry condition | spec §6/§13 |
| P5 multi-match frequency | rule codified (0 or >1 → skip); measurement only | spec §6 |
| P3 liveness signal | optional (design no longer depends on one) | spec §13 |
| Corpus-vs-envelope validation | REQUIRED before Part I lands | spec §4, incl. population-proxy caveat |
| Phase-C landing obligations | pending routing | 3 policy surfaces in ONE change + /self-reflection; supersession pointer into ADR Part-2 (same PR) |

## §4 Open design questions for v3 (the new scope)

1. **Is night-mode a SEAT or a MODE?** Today `/night-mode` is an authorization/off-hours
   layer over an orchestrator session. v3 decides: a fourth seat file
   (`role=night-orchestrator`) vs a mode flag the existing seats carry at lights-out.
   Interacts with the venue-tier availability degradation (spec §4) and the dispatcher §3
   routing amendment (spec §5).
2. **Context-cap self-cleaning mechanics:** the cap value, WHO measures it, and the
   trigger channel. Known constraints: a Stop hook cannot originate turns (spec §8, r2
   NEW-M2); the context-arm layout in `end-of-turn-reminder.sh` is owned by ADR **D7** —
   not re-opened, so v3 COORDINATES with it, never forks it; PreCompact preservation is
   ADR **D8**. Day: chip/handoff; night: F4-dependent (the continuation ladder, spec §4).
3. **Chips placement across the four-seat contour:** which edges get chips (ADR Part-1
   D1/D2 stand for dispatch chips; F7/F9 chip probes in prep-v2 §4 are still open and
   become relevant again the moment chips appear on new edges).
4. **Autonomy ceiling:** what «maximally autonomous» may NOT cross — the reversibility
   envelope hard floor + [Artifact Ownership Contract](../../../CLAUDE.md) stand; the
   morning report remains the operator's review gate. v3 should state the ceiling
   explicitly rather than let «maximally» erode it.
5. **Bus verbs for the night contour:** does night-mode need verbs beyond
   PARKED/REBIND/NUDGE? Law 1 applies — no verb without a pull-twin (spec §3).

## §5 Handoff block

- **Done in the v2 session:** membrane Phase-A from-zero draft → Phase-B fact
  reconciliation → two cold reviews (top-down, bottom-up) → r1 revision → cold round-2
  verification → r2 repairs → operator directives absorbed (split, continuation ladder,
  probes-deferred). Five commits, chain in §2.
- **Next (fresh top-tier session):** `/arch docs/superpowers/specs/2026-08-09-arch-prep-night-v3.md`
  — v3 ideation per §1, then the standard contour.
- **Truth lives in:** this doc + the v2 spec + prep-v2 + the merged ADR + cited SKILL/rule
  files. Nothing load-bearing remains only in the v2 session's chat.
