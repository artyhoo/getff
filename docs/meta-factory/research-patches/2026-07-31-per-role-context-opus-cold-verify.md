<!-- scope:per-role-context-opus-cold-verify -->
# Per-role context — Opus cold-verify: 7 contradictions resolved + 8-item verify-list run

> **Authoritative for:** the cold-verification result over the 2026-07-26/27 per-role-context research
> material — §1 contradiction resolutions (#1-#7), §2 verify-list results (1-8), §3 corrections that
> down-weight specific prior claims, §4 findings the prior research did not surface, §5 what stays open.
> This patch **filters**; it does **not** design. No shape is picked, no fork is resolved.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The design decision — reserved for the later `/arch` session with the operator, from a clean slate.
> Prior deliverables — cited and corrected **by ID**, never edited (research-patches are append-only per
> [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md)).

**Author:** Opus reviewer seat (Claude Code, host, CC 2.1.207), 2026-07-31.
**Base:** `origin/staging` `3172cc5653`.
**Reviewed material:** [`2026-07-26-per-role-context-shaping-raw-research.md`](2026-07-26-per-role-context-shaping-raw-research.md) (C1-C10),
[`2026-07-27-per-role-context-addendum-fresh-2026.md`](2026-07-27-per-role-context-addendum-fresh-2026.md) (C11-C13),
[`bundle-for-opus`](../../superpowers/specs/2026-07-27-per-role-context-bundle-for-opus.md),
[`candidate-shapes`](../../superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md),
[`inflight-context`](../../superpowers/specs/2026-07-26-per-role-context-inflight-context.md),
plus the 3 aif task outputs (`f164e807` runtime-probe, `f4dc0bff` deep-research, `4e73e54e` cold-review).

---

## §0 Headline — the three results that change the decision space

1. **C10's causal claim is REFUTED by its own falsifier.** The uniform digest is *not* the anti-drift
   machinery of the 2026-05-09 incident: it postdates the incident, came from a different workstream, and
   was once recorded as *amplifying* drift. The anti-drift property is held by doc-authority mechanisms,
   which are role-independent. **The main stated blocker against per-role shaping has no evidentiary base.**
2. **C11's always-on measurement overstates the host load by ~31% of the rule bytes.** `claudeMdExcludes`
   **does** work on host CC — verified by live self-observation. Rules loaded on host = 7 files / 90,699 B,
   not 11 files / 131,408 B. The container measured a genuinely different environment.
3. **A parked BUILD trigger has already fired.** `inject-layer-extension`'s DEFER re-trigger «≥6 marked
   rules» stands at **15 of 26** today (2.5× the threshold). Any per-role-marker design walks into an
   already-live trigger, not a fresh decision.

---

## §1 Contradiction resolutions (#1-#7)

### #1 — `subagent_type` branching — RESOLVED: reading (ii)+(iii); C3/C5 stand, but must be narrowed

**Evidence read directly.** [`docs/superpowers/specs/2026-06-02-aif-parallel-dispatch-design.md:73-75`](../../superpowers/specs/2026-06-02-aif-parallel-dispatch-design.md)
describes `Tool: Agent {…, "subagent_type":"implement-worker", …}` entries as **`agent_activity_log` observables** —
the aif-handoff coordinator's own Agent-tool spawn, logged by an `onToolUse` callback. `:88-91` names the
mechanism: `use_subagents=true` → `implementer.ts:199-200` → `--agent implement-coordinator`, whose
execution algorithm launches an `implement-worker` per ready task.

**Verdict:** this is dispatch by agent-definition **inside the external aif-handoff product**, at a layer
the repo does not own. It is not a hook in this repo reading `subagent_type` to vary an injected payload.
C3 («per-role injection does not exist in any hook today») and C5 survive — *at their stated scope*.

**Required narrowing (from the independent re-grep, verify-list #2/#5 below):** exactly one role branch
does exist in this repo — [`.claude/hooks/warn-subagent-report.sh:69-75`](../../../.claude/hooks/warn-subagent-report.sh)
(`AGENT_TYPE` read at `:69`; `case … Explore) exit 0` at `:70-75`). It is a binary *suppression* of a
warning at `SubagentStop`, not context shaping. Any claim phrased «nothing branches on agent role» is
refuted by that line; phrased «no hook varies the injected **context payload** by role», it holds.

### #2 — digest location — RESOLVED: Source B correct, C5/C10's file:line citation is wrong

```text
$ grep -n 'digest' .claude/session-bootstrap.md   → exit 1, zero lines (file has no HTML comment at all)
$ sed -n '25,33p' .claude/hooks/inject-session-bootstrap.sh
  read -r -d '' DIGEST <<'DIGEST'
  [session-bootstrap digest — auto-injected at prompt submit]
  …
```
The digest is the inline heredoc at [`inject-session-bootstrap.sh:25-33`](../../../.claude/hooks/inject-session-bootstrap.sh).
`.claude/session-bootstrap.md` (54 lines / 3,780 B) carries no `digest:start`/`digest:end` markers.
**The runtime-probe (P5 REFUTED) is right; the raw patch's citation is stale.** Anyone following the
verify-list's own item 1 («`wc -c` the block between the markers») gets 0 bytes.

**Correction to the probe's Anomaly #2, though** — the «silent no-op» framing over-reads. On CC the
consuming hook [`inject-subagent-context.sh:33`](../../../.claude/hooks/inject-subagent-context.sh)
exits at the `_is_zcode` gate and never reaches the awk at `:54`; and the markers *do* exist, empty by
design, in the consumer template [`.claude/templates/session-bootstrap.md:17-18`](../../../.claude/templates/session-bootstrap.md).
The marker path is the shipped zero-setup default, not a broken path — and it is not the channel that
delivers the CC digest (that is `SubagentStart` → `inject-subagent-digest.sh` → the heredoc). «Dead
marker branch in this repo» is true; «the digest does not arrive» does not follow.

### #3 — uniform digest vs operator framing — DISSOLVED, not a fork

Source A's premise (C10: «uniform digest = deliberate anti-drift») is refuted — see verify-list #2.
With the premise gone there is no tension left to park. The honest restatement for fabla:

> The 2026-05-09 goal-drift incident is real and well recorded, but its recorded root cause is
> **misleading authoritative language in an operational doc**, and its landed fix is the doc-authority
> layer. Those mechanisms (principle 09, `Authoritative-for` headers, the D-3 goal-phrase parity probe,
> the Artifact Ownership Contract) are **role-independent** — per-role context shaping does not weaken
> any of them. There is no evidenced anti-drift cost to trade against.

This does **not** mean per-role shaping is a good idea; it means the specific objection C10 raised is not
supported by the record. Cost/benefit remains the fabla's call.

### #4 — DeepWiki vs local file — RESOLVED: DeepWiki wrong, and the reason is knowable

`re-review-prompt.md` **exists** in v6.2.0: `/Users/art/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/skills/subagent-driven-development/re-review-prompt.md`,
**106 lines** / 4,300 B (canonical; the «107» reading counts the position after the trailing newline —
same file). It is **absent** from 6.1.1 and 5.1.0 in both plugin trees. It did **not** replace
`task-reviewer-prompt.md` — both ship side by side in 6.2.0 (7,816 B + 4,300 B).
`RELEASE-NOTES.md:10` documents the addition under `## v6.2.0 (2026-07-23)`.

DeepWiki's «not in v6.2.0» is false; its «v6.0.0 replaced it» conflates the file's *absence in 6.1.1*
with absence in 6.2.0. All three line-range citations in the addendum (`:46-53`, `:55-63`, `:94-103`)
were checked verbatim and are **accurate to the line**.

**Generalisable observation (not an instruction):** DeepWiki answers a repo at its indexed state; a
version-scoped question («is X in release N?») is exactly the shape it gets wrong. Local file + release
notes beat it for version questions.

### #5 — re-reviewer scope vs always-on load — RESOLVED: different layers, both true

Verified mechanically: `hooks/session-start` is **byte-identical** across 5.1.0 / 6.1.1 / 6.2.0
(sha256 `88a060272ca8047e0d1cd73a016e1cebba8396807a44be1e296d7c02dcbb9934`, all three trees). The only
`hooks.json` delta 6.1.1→6.2.0 is `+"shell": "bash"` (a Windows dispatch fix). The plugin registers
**one** event (`SessionStart`, matcher `startup|clear|compact`), one command hook. Branching inside the
script is **per-harness output shape** (Cursor / CC / Copilot JSON envelope), never per-role.

So v6.2.0's scoped re-reviewer narrows a **dispatch prompt** (task-scoped, controller-authored) and
touches **zero** always-on bytes. C11 and C12 measure different layers and do not conflict. The
addendum's own §R2.f says as much; the bundle's framing as a «contradiction» was over-read.

### #6 — definition fork — CONFIRMED as a fork, and sharpened into three named layers

Both sides are right at their layer. The useful output is not «which side wins» but a layer map, because
**only two of the three layers are reachable by the operator's verbatim question**:

| Layer | What it is | Role-differentiated today? | Evidence |
|---|---|---|---|
| **L1 — harness session-start assembly** | `~/.claude/CLAUDE.md`, project `CLAUDE.md`, no-`paths:` rules, memory | **NO**, with two exceptions: CC's documented Explore/Plan omission of CLAUDE.md+git-status, and `claudeMdExcludes` (works on host — §1 #7) | §1 #7 measurement; addendum R3.b |
| **L2 — repo's own SubagentStart digest** | `inject-subagent-digest.sh` → the heredoc | **NO** — byte-identical across `general-purpose`/`Explore`/`Plan`, sha256 `4bdebe58…`, 1,539 B | runtime-probe P1 CONFIRMED |
| **L3 — dispatch-time authored content** | kickoff text, `agents/*.md` personas, SDD prompt templates, 6-block contract, tier routing | **YES, heavily** — 35 agent personas, 5 SDD role templates, 5 cold-agent input contracts | deep-research S8/S9/S11/S12/S13 |

The operator's verbatim «инжектят только нужное» is an **L1+L2** question. C11 is correct there (modulo
the byte correction in §3). S8/S11/S12/S13 are all **L3** findings — correct there, and not a rebuttal of
C11. The prior material's real defect is that it presented L3 evidence as if it answered an L1 question.

**Unresolved and left for fabla:** whether the operator's *framing* («roles receive different») also
intends L3. That is an intent question, not a fact question — it belongs in `/arch §1` dialogue.

### #7 — `claudeMdExcludes` — RESOLVED: both measurements are correct; they measured different runtimes

**Host CC, live self-observation (this session, CC 2.1.207).** The 11 no-`paths:` rules on staging split
4 excluded / 7 not. The excludes list is
[`.claude/settings.json`](../../../.claude/settings.json) → `egress-no-api-bypass`, `memory-codification`,
`recommendation-laziness-discipline`, `reviewer-discipline`. This session's injected rule set contained
**exactly the 7 non-excluded rules and none of the 4 excluded ones** — an 11/11 match with the prediction.

| | predicted | observed on host | observed in aif container |
|---|---|---|---|
| no-`paths:` rules loaded | 7 | **7** ✓ | 11 ✗ |
| `claudeMdExcludes` honored for `.claude/rules/` | yes | **yes** | no |

**Independent in-repo corroboration:** [`inject-session-bootstrap.sh:20-23`](../../../.claude/hooks/inject-session-bootstrap.sh)
states in its own comment that `recommendation-laziness-discipline.md` «is evicted from always-on rule
context per CTX Stage 1» and that the H1 digest line is its compensating always-on channel. The eviction
mechanism (`claudeMdExcludes`, landed in `74d8d023d8`, PR #909) is designed-for and compensated-for in
the shipped hook. If eviction did not work on host, that compensation line would be redundant.

**So hypothesis 2 from the review brief is correct** — and it is exactly the failure the token-audit
kickoff's own BINDING per-environment-attribution rule was written to prevent.

**The documented contract says the host is right and the container is broken.** Official CC docs
([code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory), «Exclude specific CLAUDE.md
files») document `claudeMdExcludes` and give `"/home/user/monorepo/other-team/.claude/rules/**"` as a
worked example — `.claude/rules/**` exclusion is **documented, supported behaviour**, not a side effect.
So the probe's stated «likely cause» («`claudeMdExcludes` scopes CLAUDE.md memory imports, not rules»)
is **wrong on the documentation**, even though its *observation* was real.

**The likely real mechanism is a format defect in this repo, not a CC difference.** The docs state:
«Patterns are matched against **absolute file paths** using glob syntax.» This repo's four entries are
**repo-relative literals** (`.claude/rules/egress-no-api-bypass.md`), not absolute globs. A relative
pattern that happens to resolve on one runtime's path handling and matches nothing on another produces
exactly the observed host-yes / container-no split. Note the version hypothesis is *inverted* by the
changelog: the container runs the **newer** 2.1.218, and 2.1.211 shipped «Fixed nested `.claude/rules/*.md`
files loading even when setting sources exclude project settings» — the newer runtime is the one with the
exclusion fix, yet it is the one where exclusion failed. Version-drift alone does not explain it; a
non-conforming pattern does.

> **Wrong if:** rewriting the four entries as absolute globs (`**/.claude/rules/<name>.md`) leaves the
> container behaviour unchanged — then the cause is environmental after all. **That is a cheap, decisive
> experiment and nobody has run it.** It matters beyond this review (see §4.2).

---

## §2 Verify-list results (raw patch §Verify-list, items 1-8)

| # | Item | Result |
|---|---|---|
| 1 | Digest size via the `session-bootstrap.md` markers | **Instruction is unrunnable** — no markers exist (§1 #2). Correct source is the heredoc: 1,500 B body, 4% non-ASCII → ASCII divisor → **~375 tokens**. The «~500 tokens» estimate is in range. The digest is **not** where the always-on cost lives. |
| 2 | The 2026-05-09 incident | **PARTIALLY-CONFIRMED / causal core REFUTED.** See §4.1 — the falsifier the patch itself wrote fires. |
| 3 | `skill-context` generalisation to foreground workers | **Claim HOLDS — still unverified.** The 2026-05-20 probe's scope line (`2026-05-20-skill-context-runtime-probe.md:4`) is explicitly a `background: true` review-sidecar; `:73` records the foreground control as **deliberately not run** («Moot… only needed to interpret a *negative*»). Delivery for workers ships (`aif-orchestrator-discipline/SKILL.md:6,19-20`; `install.sh:877-885`) but tests assert **file presence only** (`tests/install-sh/with-aif-suite-flag.test.sh:51,76`). The umbrella's own risk register names the gap: `2026-06-03-aif-operator-asset-access.md:144` — «if the dispatched agent bypasses aif's skill pipeline, the skill-context is ignored». SSOT #50 still cites only the background probe. |
| 4 | `inject-layer-extension` BUILD re-trigger | **TRIGGER ALREADY FIRED.** See §4.3. |
| 5 | Re-grep for hidden per-role machinery | **CONFIRMED with one narrowing** — see §1 #1. 23 hook files swept (20 + 3 under `lang/`), both `.claude/hooks/` and `plugin/hooks/`; zero hits for `per-role`/`role-specific`/`roleFilter` in executable code; the only role branch is `warn-subagent-report.sh:70-75`. |
| 6 | Wrapper-skill claim C8 | **CONFIRMED** — independently by the runtime-probe's P6 (all three skills read in full: arch / pipeline / dispatcher; no per-role context table, no allow/deny list) and by deep-research S9. Differentiation is by question + model tier. |
| 7 | Newer superpowers version | **6.2.0 is current**, released 2026-07-23; no 6.2.1+ in either plugin tree. C5's falsifier does not fire: v6.2.0 still ships exactly one hook on one event, no per-role branch (§1 #5). C7 (zero quantitative context discipline) also survives — no counter, no budget gate found. |
| 8 | C9 orthogonality with `session-start-token-audit` | **Orthogonal in mechanism, coupled in one lever.** token-audit trims **L1** by re-scoping which files load; per-role shaping would act on **L1/L2 by role** or on **L3 by authoring**. They compose — except both reach for the same lever (`paths:` frontmatter + `claudeMdExcludes`), and §4.2 shows that lever is environment-dependent. That coupling is real and belongs in fabla's input. |

---

## §3 Corrections — claims that must be down-weighted before fabla reads them

| Claim | Status after cold-verify | Correction |
|---|---|---|
| **C10** «uniform digest = deliberate anti-drift» | **REFUTED (causal core)** | The incident is real; the causal attribution is not. §4.1. |
| **C11** «always-on load ~236 KB, 11 rules / 131,408 B» | **CORRECTED for host** | Arithmetic is right (40,709 + 90,699 = 131,408) but the attribution is not: on host only the 7 non-excluded rules load = **90,699 B**. `claudeMdExcludes` saves **40,709 B (~31% of the rule load)**. The ~236 KB total should be restated per environment, not as one number. |
| **C5 / C10 P5 file:line** («digest in `session-bootstrap.md` between markers») | **REFUTED** | Actual source is the `inject-session-bootstrap.sh:25-33` heredoc. §1 #2. |
| **C3 / C5** «no per-role branching in any hook» | **HOLDS, needs narrowing** | Narrow to «no hook varies the injected **context payload** by role». `warn-subagent-report.sh:70-75` is a role branch (warning suppression). §1 #1. |
| runtime-probe **P4** «claudeMdExcludes silently ignored» | **TRUE in container, FALSE on host** | Restate per environment. §1 #7. |
| runtime-probe **Anomaly #2** «ZCode fallback is a silent no-op» | **Over-read** | Literally true for the marker branch, but CC exits earlier at the `_is_zcode` gate and the markers exist by design in the consumer template. §1 #2. |
| bundle **§5 rows 1 and 5** framed as «contradictions» | **Not contradictions** | Row 1 = different layer (§1 #1). Row 5 = different layer, and the addendum already says so at R2.f (§1 #5). |
| bundle **Reachability audit** «substrate UNREACHABLE» | **Container-only artifact** | All 4 substrate docs are present on `origin/staging` and were read here. The bundle's «operator pastes into CC» instruction is obsolete. |
| deep-research pre-flight **T1** «prior research files absent» | **Container-branch artifact** | The branch predated the merge. The report's own §T20 check already flags this honestly. |
| raw patch R3/R4 paths under `/Users/art/.zcode/…6.1.1/` and `.zcode/skills/…` | **Stale** | `.zcode/skills` does not exist; the installed CC plugin is 6.2.0 at `~/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/`. The `.zcode` tree does still hold a 6.1.1 copy — so the *path* is real but the *version audited* was not the live one. |

**What survives untouched:** C1, C2, C4, C6, C7, C8, C9, C12, C13, and the whole deep-research S1-S13
surface census. The 18 candidate shapes are unaffected — none of them was argued from the refuted claims.

---

## §4 Findings the prior research did not surface

### 4.1 The 2026-05-09 incident does not support the uniform digest (verify-list #2, load-bearing)

The record is rich and consistent; the causal claim built on it is not.

- **Recorded root cause is doc-authority, and «missing context» is explicitly denied.**
  [`doc-authority-hierarchy.md:20`](../../../.claude/rules/doc-authority-hierarchy.md): «The drift went
  uncaught for months because the project had code-level discipline … but **no doc-authority
  discipline**.» And `:35` names the mechanism outright: «goal drift is caused by **pattern-matching on
  observed authoritative-language in context, not by token-distance forgetting**» (citing arXiv 2505.02709).
  A drift caused by *language present in context* is not fixed by *delivering more context uniformly*.
- **Chronology breaks the causal link.** `.claude/session-bootstrap.md` landed 2026-05-09 (`458cd0b52d`)
  as a **read-first** Step-0 file, no auto-delivery. The UserPromptSubmit injection hook landed
  **2026-05-11** (`5c0d32ec72`), whose body closes «Wave 6 D-1» and does not mention the incident. The
  `SubagentStart` uniform digest — the exact behaviour C10 defends — landed **2026-06-01**
  (`c2f83e7bc1` / `a68c3e58bf`, «#108 SubagentStart digest-injection (orchestrator gate)»), **23 days
  later, from orchestrator-gate work, not from anti-drift work.**
- **The digest was once recorded as *amplifying* drift.**
  [`2026-05-16-goal-clarity-dialogue.md:37-41`](2026-05-16-goal-clarity-dialogue.md): the hook injected the
  narrow phrasing as the *first content* of the very dialogue convened to fix that narrow phrasing —
  logged as `#operational-doc-redefines-goal` «in self-inflicted recursive form». Commit `e2398d158e`
  had to hard-edit the heredoc because the hook does not read `session-bootstrap.md`.
- **The recurrence detector that actually landed is the D-3 goal-phrase parity probe** (`2b0a505f92`,
  2026-05-11; `self-application.md:72`). The 2026-06-05 goal-drift audit verdict CLEAN
  (`2026-06-05-goal-drift-audit.md:8`) rests on six doc-authority criteria; the digest is credited nowhere.
- **«every role was observed to drift»** is an extrapolation — the record shows drift in one class
  (reviewer cycles).

**Unrecoverable:** the primary 718-LOC research lived in `/tmp` and was never committed (PR #16 body),
so «which reviewer, which cycle» cannot be reconstructed from the repo.

**Consequence for the decision space:** Fork 1's «forcing function» premise — *«the project's anti-drift
thesis argues against per-role shaping»* — is unsupported. Fork 1 should be re-posed to the operator
without that counterweight.

### 4.2 The `claudeMdExcludes` entries do not match the documented pattern format, and two umbrellas rest on them

`claudeMdExcludes` is the lever PR #909 «CTX Stage 1 eviction» spent (`74d8d023d8`), that the
`session-start-token-audit` S2 pre-decided moves plan to spend again (`autonomous-loop-continuity.md` +
`git-conflict-merge-forward.md` → `claudeMdExcludes`), and that C11's measurement assumed inert.

Three facts, none of which was on record before this review:

1. The behaviour is **documented and supported** for `.claude/rules/**`
   ([docs/en/memory](https://code.claude.com/docs/en/memory)) — so the container's non-exclusion is a
   defect somewhere, not a design boundary.
2. The docs specify patterns match **absolute file paths**; this repo's four entries are repo-relative
   literals. They are **non-conforming as written**, and they work on the host anyway.
3. Its failure mode is **silent over-injection**: nothing goes red, the session simply carries ~40 KB more
   than intended. That is precisely
   [`attention-is-not-a-mechanism.md §2`](../../../.claude/rules/attention-is-not-a-mechanism.md)'s
   `#hope-as-gate` — a saving whose only verification is «someone notices the context felt big».

A framework whose thesis is «every rule is an executable artifact that fails at the earliest reachable
channel» currently has an unverified 40,709-byte context saving with **zero** channels asserting it. CC
2.1.207 even shipped an `InstructionsLoaded` hook event «that fires when CLAUDE.md or `.claude/rules/*.md`
files are loaded into context» — a reachable channel for exactly this assertion.

**Surfaced, not fixed.** The reachable-channel design is a design decision (`/arch`'s job) and the lever
belongs to the token-audit umbrella, not to this review.

### 4.3 A parked BUILD trigger has already fired (verify-list #4)

[`2026-06-13-inject-layer-extension-rphase.md:79-82`](2026-06-13-inject-layer-extension-rphase.md) sharpened
the DEFER's re-trigger to fire when **any one** of: «≥6 shipped rules (half) need path-scope markers», ≥1
consumer mis-scope report, or per-artifact-class generated rules.

```text
$ grep -lE '^paths:|^<!-- globs:|<!-- inject:' .claude/rules/*.md | wc -l   → 16   (of 26 rules)
$ grep -lE '^paths:' .claude/rules/*.md | wc -l                            → 15
```
The R-phase's own baseline was **3 of 12** (`:75` — «the manual path works at current scale»). Today it is
**15 of 26**. Condition (a) is met on both readings: literal ≥6 → 2.5× over; parenthetical «(half)» →
15 ≥ 13. **The DEFER's stated premise is stale.** SSOT #101 (`prior-art-evaluations.md:173`, verdict
`ADAPT`) still carries an unclosed «reconcile read-trigger vs edit-trigger semantics» — and per-role
markers land exactly on that unreconciled seam. This is not a recommendation to build; it is notice that
the fabla inherits a live trigger, not a clean slate.

### 4.4 Twin divergence: the role branch is missing from the ZCode arm

`.claude/hooks/warn-subagent-report.sh:69-75` carries the `Explore` noise-guard;
`plugin/hooks/warn-subagent-report-zcode` contains **zero** occurrences of `agent_type`/`Explore`. The
repo's single role branch is absent from its portable twin. Out of scope here (PR-strategy: no drive-by),
recorded as an observation for whoever owns
[`zcode-parity-doctrine.md §2 row 19`](../../../.claude/rules/zcode-parity-doctrine.md).

### 4.5 The cold-review commissioned over this material has still never run

Task `4e73e54e` returned a blocker-report, not an audit: the 3 substrate deliverables were absent from the
container's branch, so 6 of its 8 checklist dimensions (A format honesty, B claim quality, C hidden
pressure language, E verify-list quality, G framing bias, H token-economy) were **SKIPPED**. They are on
`origin/staging` now. The audit is re-runnable and un-run — recorded in §5 as a ready dispatch, not as a
completed check. This patch is an Opus cold-verify of *substance*; it is not that 8-dimension audit.

---

## §5 What stays open for the `/arch` session

**Facts settled here (do not re-litigate):** contradictions #1-#7; verify-list 1-8; the §3 corrections.

**Genuinely open — decisions, not facts:**

1. **Fork 1, re-posed** — is per-role shaping worth doing at all, now that the anti-drift counterweight
   is gone? The remaining case rests on measured L1 bytes, not on a principle.
2. **Fork 2 (channel)** — unchanged, but note that channel (b) (`skill-context` override) is still
   **unverified for foreground workers** (verify-list #3), and channels touching `paths:`/`claudeMdExcludes`
   inherit §4.2's environment dependency.
3. **Forks 3-7** — unchanged (absorb-into-token-audit; sequencing; vocabulary; single-vs-multi-level
   routing; isolation-vs-filtering).
4. **The L3 intent question** (§1 #6) — does the operator's framing reach dispatch-time authored content,
   or only the always-on load? Only the operator can settle this; it is `/arch §1` material.
5. **The 18 candidate shapes** — untouched by this review, all still on the table.

**Ready-to-dispatch aif work (the runtime was down at review time — see §6):**
[`.claude/orchestrator-prompts/per-role-context-cold-verify/kickoff.md`](../../../.claude/orchestrator-prompts/per-role-context-cold-verify/kickoff.md)
— two tasks: (T1) the never-run 8-dimension cold-review, now that its inputs exist on staging;
(T2) a sweep of the aif-handoff runtime's own agent definitions, the L3 layer nobody has surveyed.

---

## §6 Honest disclosures

- **aif runtime was DOWN** for this review (Docker daemon socket absent; `$RUNTIME_BRIDGE_AIF_URL`
  `/runtime-profiles` and `/tasks` both `HTTP 000`). Nothing was dispatched; the kickoff in §5 is written
  and staged instead. Read-only diagnosis only, per `aif-doctor` — no repair attempted. The three aif task
  output files were readable on disk and were read as primary sources.
- **The §1 #7 host measurement is a self-observation from inside a subagent context.** Per
  [docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents), «Explore and Plan skip your CLAUDE.md
  files … Every other built-in and custom subagent loads both» — this seat is not Explore/Plan, so it
  loads the full set and the observation generalises to the main session. Corroborated by the in-repo
  design intent at `inject-session-bootstrap.sh:20-23`. Still one observation on one CC version; §1 #7
  states the falsifier.
- **The docs do not explicitly state whether Explore/Plan also skip `.claude/rules/`** — only CLAUDE.md
  and git status are named. If they do, that is a *documented* per-role context filter already shipping in
  the harness, and it would be directly relevant to fabla's L1 question. **Unverified — worth one probe.**
- **Not done:** no independent re-run of the addendum's 6 external 2026 web sources (C13's falsifier is
  untested here); no full-content read of the 18 candidate shapes (they were not in dispute); the
  `4e73e54e` cold-review's 6 skipped dimensions remain skipped.

---

## §1.7 self-review

**Forward-check applied.**

- [`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md): every resolution
  in §1 carries command output or file:line, not prose. The two load-bearing new claims (§4.1, §4.3) each
  carry commit SHAs / a reproducible command. §1 #7 states its own falsifier explicitly.
- [`recommendation-laziness-discipline.md §3`](../../../.claude/rules/recommendation-laziness-discipline.md):
  no ADOPT/BUILD/REJECT/DEFER verdict is issued and no shape is picked. §4.3 reports that a *pre-existing*
  trigger's condition is met — a measurement, explicitly disclaimed as «not a recommendation to build».
- [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md): forks stay parked (§5).
  Contradiction #3 is *dissolved by evidence*, not decided — the cost/benefit call is left open.
- [`ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md): **T3** — no finding is
  prose-only; **T7** — the review did not pattern-match the brief's framing: contradiction #1 resolved
  *against* the brief's leading hypothesis and #5/#1-row-1 were downgraded from «contradiction» to «layer
  confusion»; **T13** — the ADOPTED superpowers substrate was audited locally rather than trusted
  (§1 #4/#5) and DeepWiki, the upstream-authority channel, was found wrong; **T14** — verify-list #5's
  clean result is reported as «confirmed *at narrowed scope*» plus the one refuting line, not as «clean»;
  **T19** — the material's own author is not the verifier here, and the one check this seat could not run
  (the 8-dimension audit) is handed on rather than claimed (§4.5).
- [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md): §4.2
  names a silent-failure lever as `#hope-as-gate` and **surfaces** it rather than proposing a gate —
  proposing one would be design, reserved for `/arch`.
- [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md): N/A — no
  capability commit; this is a research record.
- [`doc-authority-hierarchy.md §2-§3`](../../../.claude/rules/doc-authority-hierarchy.md): Authoritative-for /
  NOT-authoritative-for header present.
- [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md): the two GLM patches and the three aif task
  outputs are corrected **by ID in this file** and left byte-unmodified, per «research-patches are
  append-only, owned by the session that discovered the gap».

**Backward-check applied.** Class of this change = *a cold-verification record that corrects a prior
research patch's claims by ID without editing it*. Surfaces enumerated where that class occurs
(`grep -rl 'REFUTED\|supersedes' docs/meta-factory/research-patches/*.md` + `ls docs/meta-factory/research-patches/2026-0[5-7]-*`):

- [`2026-07-27-per-role-context-addendum-fresh-2026.md`](2026-07-27-per-role-context-addendum-fresh-2026.md) —
  the immediate precedent for this exact pattern (its §0 corrects the 2026-07-26 patch by claim-ID and
  states «where the two disagree, this one is more recent»). **SWEPT-CLEAN** — this patch follows the same
  convention and extends the chain by one link; it supersedes the addendum only on C11's host attribution
  (§3), stated explicitly rather than silently.
- [`2026-05-16-goal-clarity-dialogue.md`](2026-05-16-goal-clarity-dialogue.md) — **GAP CLOSED, not
  created**: it already recorded the digest amplifying drift (`:37-41`), and C10 was authored 2026-07-26
  in contradiction of it without citing it. This patch reconnects the two. Nothing superseded — the older
  record was right and had simply gone unread.
- [`2026-06-13-inject-layer-extension-rphase.md`](2026-06-13-inject-layer-extension-rphase.md) +
  [`.claude/orchestrator-prompts/inject-layer-extension/done.md`](../../../.claude/orchestrator-prompts/inject-layer-extension/done.md) —
  **GAP FOUND** (§4.3): a DEFER whose re-trigger has fired. Recorded here, **not** unilaterally reopened —
  reopening is the owning umbrella's call.
- [`docs/meta-factory/prior-art-evaluations.md`](../prior-art-evaluations.md) #50, #101 — **SWEPT, both
  stale-but-not-wrong**: #50 still cites only the background skill-context probe (verify-list #3); #101's
  «reconcile read-vs-edit» is still open (§4.3). Append-only SSOT, reviewer-read-only — cited, untouched.
- [`.claude/orchestrator-prompts/session-start-token-audit/kickoff.md`](../../../.claude/orchestrator-prompts/session-start-token-audit/kickoff.md)
  (branch, not staging) — **CORROBORATED, not contradicted**: its `claudeMdExcludes` claim is the one that
  survives (§1 #7), and its own BINDING per-environment-attribution rule is what predicted the container
  divergence. Operator-owned; not edited.
- [`.claude/rules/zcode-parity-doctrine.md §2`](../../../.claude/rules/zcode-parity-doctrine.md) row 19 —
  **GAP FOUND** (§4.4), out-of-scope, surfaced as observation per the CLAUDE.md PR-strategy rule.
- Sibling 2026-07-* patches (12 files) — all carry §1.7 markers; this patch conforms. **SWEPT-CLEAN.**

**T21 anti-restatement check.** The surface list above is deliberately **not** this PR's own diff: five of
the seven enumerated surfaces (`2026-05-16-goal-clarity-dialogue.md`, `2026-06-13-inject-layer-extension-rphase.md`,
`prior-art-evaluations.md`, the token-audit kickoff, `zcode-parity-doctrine.md`) are untouched by this
change, and two of them yielded GAP-FOUND verdicts that became §4.3 and §4.4.

## See also

- [`2026-07-26-per-role-context-shaping-raw-research.md`](2026-07-26-per-role-context-shaping-raw-research.md) — C1-C10; corrected by ID in §3.
- [`2026-07-27-per-role-context-addendum-fresh-2026.md`](2026-07-27-per-role-context-addendum-fresh-2026.md) — C11-C13; C11 corrected in §3.
- [`bundle-for-opus`](../../superpowers/specs/2026-07-27-per-role-context-bundle-for-opus.md) — the assembled input; its §5 contradiction table is answered here row by row.
- [`.claude/orchestrator-prompts/per-role-context-cold-verify/kickoff.md`](../../../.claude/orchestrator-prompts/per-role-context-cold-verify/kickoff.md) — the ready-to-dispatch aif follow-up (§5).
- [`doc-authority-hierarchy.md`](../../../.claude/rules/doc-authority-hierarchy.md) — the mechanism that actually holds the anti-drift property (§4.1).
