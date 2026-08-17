# Kickoff — tier membership: dependency or association?

<!-- host-verify: none — handoff brief for an in-session design conversation; nothing is dispatched to the aif container, so there is no container-vs-host acceptance gap to verify. -->

> **Handoff, not a dispatch.** Written 2026-08-17 at the end of the triage-kernel-v2 tail
> session, for a fresh top-tier session to CONTINUE THE DISCUSSION with the operator.
> Nothing here is approved for implementation. The operator paused every pending PR
> («do not proceed, wait for next instruction») — honour that until they lift it.

## §0 Seat + entry

Top-tier session, operator in the loop. This is a design conversation, not a build. Read
this file, then talk to the operator — the open forks in §5 are theirs, not yours.

Isolation: work in an isolated worktree, never the repo root
([parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md)).

## §1 Settled — do NOT re-open

- **triage-kernel-v2 umbrella is fully closed.** S5 (#1405), `done.md` (#1407), S5b
  (#1428, corrected by #1431), drift-register repair (#1435). No stage remains.
- **Drift-register row `1346-r1-1` is NOT a defect.** PR #1346's own fidelity report closes
  it «Accept or widen at the operator's discretion» — a recorded operator fork. Do not
  «fix» it; it is listed in §5 as a fork because that is what it is.
- **The changelog disposition vocabulary is landed and corrected.** `ACCEPTED` and `FIXED`
  are two authorial registers for one slot, not opposites — measured across all 66 specs.
  See `.claude/skills/arch/SKILL.md` §2. Do not re-litigate.

## §2 The question this session is for

The operator's premise, stated verbatim 2026-08-17:

> «все это должно поставляться консьюмерам иначе зачем я это делаю? просто есть кор а есть
> бонусы при желании - это фул поставка»

The installer ships three monotonic depths — `core` ⊂ `env` ⊂ `factory`
([install.sh:483-505](../../../install.sh), lists at
[setup.d/lib.sh:58-60](../../../setup.d/lib.sh)). The question is whether the current
membership of each depth is justified by **dependency** (this skill cannot work without an
external runtime) or merely by **association** (it was born next to the operator suite).

Evidence so far says: partly by association. That is the thing to resolve.

## §3 AI-laziness traps — active for this session

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). Active traps
for this discussion: **T3, T10, T14, T15, T20**.

- **T3** (no prose-only findings) and **T20** (no verdict without an evidence-bearing call in
  the same turn) are the load-bearing pair here. The predecessor session shipped an INVENTED
  definition in #1428 by reading the corpus instead of counting it, and had to correct it in
  #1431 one hour later. Every claim below carries a command or a `file:line`; keep that bar.
- **T10** — enumerate the population before sampling. The §4 coupling counts are a whole-set
  enumeration (6/6 factory skills), not a sample; keep it that way if you extend it.
- **T14** — «clean» at low coverage is «coverage insufficient», not «clean». See §6.
- **T15** — self-application: this file's own claims are subject to the same bar.

**Domain trap `T-TIER-A` — «grep-count read as dependency proof».** The §4 table counts
mentions of `aif-handoff|runtime-bridge|docker` per SKILL.md. A count of 0 is strong evidence
of no coupling; a count of 21 is NOT proof the skill is unusable without the runtime — it
could be prose about the runtime. Tempted output: «`harvest` scores 6, therefore factory-only,
settled». Counter: for any skill whose membership you propose to CHANGE, open the file and
name the specific line that would break without the runtime.

## §4 Measured facts (2026-08-17, this machine)

**A. The `env` depth is genuinely runtime-independent.** `bash install.sh ts-server
--profile env --full` into a scratch tree → exit 0; the `runtime-bridge` vendor correctly
absent (gate at [setup.d/55-runtime-bridge-vendor.sh:65](../../../setup.d/55-runtime-bridge-vendor.sh));
`.ai-factory/tier-home.md` + worktree scripts present; 9 skills land.

**B. Dangling-reference scan of the three `env` skills' SKILL.md:**

| Skill      | Result                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| `arch`     | clean — zero dangling refs                                                                                              |
| `reviewer` | clean — zero dangling refs                                                                                              |
| `pipeline` | ONE genuine: `.claude/hooks/check-worker-dispatch-channel.sh` ([pipeline/SKILL.md:388](../../skills/pipeline/SKILL.md)) |

That one ref is already an arm of the open shipped-ref allowlist audit; this probe confirmed
it independently from the CONSUMER side. Three further hits were FALSE POSITIVES of the
scanning regex — do not re-report them: `.claude/skills/orchestrator/` at `:22/:487/:595` is
`~/.claude/skills/orchestrator/` (tilde-path, the file itself says «not a repo link»), and
`.ai-factory/orchestrator-prompts/plan.md` at `:120` is absent by design (the skill writes a
stub when missing).

**C. `factory` membership is NOT uniformly dependency-driven.** Mentions of
`aif-handoff|runtime-bridge|docker` per SKILL.md, all six factory skills:

| Skill                         | Count | Reading                                                                                                                                                                                                                                    |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aif-doctor`                  | 44    | genuine — its whole subject is the runtime                                                                                                                                                                                                 |
| `dispatcher`                  | 21    | genuine                                                                                                                                                                                                                                    |
| `claude-glm-executor-handoff` | 7     | genuine                                                                                                                                                                                                                                    |
| `harvest`                     | 6     | genuine                                                                                                                                                                                                                                    |
| `night-mode`                  | 2     | ONE real hit ([night-mode/SKILL.md:33](../../skills/night-mode/SKILL.md)) and it is a CROSS-REFERENCE («/pipeline §7 and /dispatcher §2.4 point here»), not a runtime call — night-mode is coupled to the other factory skills, not to aif |
| `story`                       | **0** | no coupling at all — a session-recap skill («расскажи что сделали, по актам»), localized via `AIF_HOOK_LANG`, sharing its spec with the Stop-hook branch                                                                                   |

**D. Precedent.** `reviewer` was in NO tier until #1432, where it turned out to be a missed
delivery rather than an exclusion. `story` would be the third instance of the same shape.

**E. Unexamined, found in passing.**
[setup.d/85-worktree-scripts.sh:22](../../../setup.d/85-worktree-scripts.sh) gates
`getff-work.sh` — «workspace one-command entry-point» — behind `env`, so a `core` consumer
has no one-command entry. Never investigated; the layer cites «spec A9», unread.

## §5 Open forks — the operator's, not yours

> **2026-08-17 design session #2:** fork 2 is CLOSED (widened into the three-part model) — see
> §7. Forks 1 and 3 remain open.

1. **Default depth: stay `core`, or raise to `env`?** Changes installer behaviour for every
   consumer. Argument for `env`: §4A shows it needs nothing external, so gating it is a
   decision rather than a necessity, and it makes the operator's «core + optional bonuses»
   model literal. Argument for waiting: `pipeline` carries the §4B dangling ref today —
   raising the default widens that exposure from opt-in consumers to everyone. Recommended
   order if the answer is yes: fix the ref FIRST, then raise the default.
2. **Does `story` (and possibly `night-mode`) belong in `factory`?** §4C says `story` has
   zero runtime coupling. Candidate move: `story` → `core`.
3. **The marker fix is DECIDED but unopened.** Two shipped docs use `pipeline` as the
   `factory` discriminator — [AGENTS.md.template:30](../../../packages/core/templates/shared/AGENTS.md.template)
   (the depth-detector row itself) and
   [AI-USAGE-GUIDE.md:41-42](../../../packages/core/templates/shared/AI-USAGE-GUIDE.md) —
   but `pipeline` is `env`-tier ([lib.sh:59](../../../setup.d/lib.sh)), so an `env` install
   reads itself as `factory` in both. The correct discriminator is
   `.claude/skills/dispatcher/` (factory-only, [lib.sh:60](../../../setup.d/lib.sh)); any
   factory-only skill would do, `dispatcher` is the natural pick. This is a factual defect,
   not a fork — it is correct under EITHER answer to fork 1. It was not opened only because
   [CLAUDE.md:89](../../../CLAUDE.md) forbids autonomously opening a PR for a systemic issue
   noticed mid-PR without an explicit invitation. Ask for the invitation.
   **Note:** editing `AGENTS.md.template` requires `SNAPSHOT_MODE=capture bash
tests/install-sh/snapshot.sh` — its content hash sits in the 11 baselines that ship it.

## §6 Limits of §4 — state these before building on it

- **One stack, one run.** `ts-server` only. Other stacks were not probed.
- **`SKILL.md` only.** The `arch`/`reviewer` «clean» verdict does NOT cover their
  `references/*.md`. Per T14 this is «coverage insufficient to conclude», not «clean».
- **Coupling counts are a proxy** (`T-TIER-A`), not a proof of unusability.
- The scan ran on the framework's own tree plus one scratch install — not on any real
  consumer project.

## §7 Decisions recorded — 2026-08-17 design session #2 (operator dialogue)

Recorded from the live operator conversation on `claude/drift-register-probe`. The PR pause
is STILL IN FORCE — nothing below is implemented; this section is the decision record.

**D1 — three-part delivery model CONFIRMED (fork 2 closed and widened).** The operator's
cut: **core** («rules = tests», always ships) / **harness** (the operator's working contour,
optional) / **factory** (the aif engine room, optional). «Any 2 of 3» was measured and
REJECTED: all four factory skills reference harness skills (dispatcher → /pipeline at
:3/:24/:42/:401 + /arch at :367; aif-doctor → /pipeline ×6; harvest → night-mode :67 +
/arch :81; claude-glm-executor-handoff → night-mode throughout), so factory presupposes
harness and the ladder stays monotonic: `core ⊂ harness ⊂ factory`. Installer nesting
mechanics unchanged; only list membership moves ([setup.d/lib.sh:58-60](../../../setup.d/lib.sh)).

**D2 — target membership.** harness = arch, pipeline, reviewer + orchestrator (D3) +
night-mode (D4) + story (D5) + the question hooks (`ask-question-reminder.sh`,
`end-of-turn-reminder.sh` — present in the setup.d manifests; their PROFILE gate is
UNVERIFIED, enumerate before moving). factory = dispatcher, aif-doctor, harvest,
claude-glm-executor-handoff (+ the aif-handoff runtime).

**D3 — orchestrator ships in harness.** Vendored into the repo by #1420
(`.claude/skills/orchestrator/`, tracked) yet present in NO tier list — the same
missed-delivery shape as reviewer before #1432 (§4D). Runtime coupling ≈0 (1 mention in
SKILL.md, 0 across all working `references/*.md`). BFR: NOT a duplicate of Superpowers SDD —
the body delegates via `Skill('superpowers:…')` at 9+ points
([orchestrator/SKILL.md:67](../../skills/orchestrator/SKILL.md) «Discovery is our niche;
decomposition is companion's»; also :122, :264, :382, :486) and adds five capabilities
upstream lacks: Mode B cross-session dispatch, Queue mode, quota zones, Phase -1 cold
kickoff read, discovery. Obligation: re-verify upstream Superpowers (>6.2.0) for a queue
layer when the BFR record is written.

**D4 — night-mode moves to harness WITH degradation work.** Its core loop is runtime-free
by design ([night-mode/SKILL.md:17](../../skills/night-mode/SKILL.md)), but three refs are
factory-only: runtime-bridge CLI (:33), dispatcher (:35), claude-glm-executor-handoff (:19).
The move requires conditional/degrading refs, never a bare list edit.

**D5 — story moves to harness AFTER #934.** The installer's own rationale comment
([setup.d/10-skills.sh:92-94](../../../setup.d/10-skills.sh)) records that story «crashes on
landing until its lang-pack ships (#934)» — the factory gate was masking a delivery bug, not
a runtime dependency. Binding order: fix #934 → move.

**D6 — new defects found this session (no PR without explicit invitation):**

1. Stale tilde-refs to the pre-vendoring global orchestrator:
   [pipeline/SKILL.md:22/:487/:595](../../skills/pipeline/SKILL.md) («global,
   agent-uncommittable, owner=maintainer») and [CLAUDE.md:134](../../../CLAUDE.md) —
   `~/.claude/skills/orchestrator/` no longer exists (probed 2026-08-17 on the operator
   machine: `ls` → ENOENT).
2. The per-tier rationale comment [setup.d/10-skills.sh:52-102](../../../setup.d/10-skills.sh)
   drifted from the lib.sh lists (still holds pipeline in the factory suite; reviewer absent
   from env) — while [lib.sh:57](../../../setup.d/lib.sh) delegates per-tier rationale to
   exactly that comment.
3. (already §5.3) pipeline-as-factory-marker in two shipped docs.
4. (already §4B) pipeline dangling hook ref.

**Still open — the operator's:** fork 1 (default depth `core` → core+harness; recommended
order: fix the §4B ref first), fork 3 (invitation for the marker fix).
