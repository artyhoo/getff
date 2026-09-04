<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage-scoped dispatch input — S-E of the arch-v2-context-pipeline umbrella. Marker carried per /arch §3 D1 exception: this kickoff is produced by the 2026-08-06 /arch contour and is plan-complete (decomposition + descopes encoded below); the dispatcher MUST re-verify the fidelity-verdict-in-pr-body precondition at dispatch time per the umbrella §0. RE-ISSUED rev 4 (2026-08-06 /arch re-planning after a Phase -1 STOP): P3d/P11/P14 moved to stage S-H (container-infeasible — spec §1.6 FORK C); P3b extended to the membership predicate; P3a ceiling formula decided; now depends on S-G merged (spec §1.6 FORK D). -->

# arch-v2-context-pipeline S-E — budget gate + config-assertion asserts (container-safe set)

> **Stage goal:** make session context a gated convention (ADR-3) and give context config a
> failure signal. **Design SSOTs (read both, in full):**
> [`2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
> — ADR-3 (gate at pre-push/CI, measurement-vs-gate split, the FIRED falsifier note);
> [`2026-08-06-pipeline-token-economy-design.md`](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
> — §2 (asserts + backstop), §3 rows P2/P3, §1.6 FORK C/D (the rev-4 resolutions this
> re-issue implements), §0.5/§0.6 (priority + agnosticism).
> Umbrella context (sequencing only): [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md).
>
> **This stage is S-E only.** S-D′ (subtraction maps), S-G (trim/small-fixes) and S-H
> (host-side measurements — P3d/P11/P14 live THERE now) are OUT OF
> SCOPE — do not implement, do not pre-wire. A systemic issue noticed mid-stage is surfaced as
> a PR-body observation, never an extra PR ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

**Base:** `origin/staging` **with S-G merged** — verify before starting with the
deterministic content check (round-4 minor: a subject-line grep is satisfiable by any
commit containing «s-g»):
`git cat-file -e origin/staging:.claude/rules/ai-laziness-digest.md && echo S-G-MERGED`.
If it fails, STOP and park: the P3a ceilings derive from the post-S-G
resident baseline (spec §1.6 FORK D) and deriving them earlier produces stale-high numbers.
**Mode:** implementation, one PR onto staging.

## §1 Deliverables (decomposition — all decisions already taken, none re-open)

1. **P2a — committed-list liveness principle test** — slot **34**, PRE-ASSIGNED, do NOT
   re-derive «next free» (S-G — merged before this stage per the §1 base precondition — holds
   slot **35**; the pre-assignment survives the rev-4 re-order because «next free» at your
   base now resolves to 34 anyway, and keeping it explicit prevents regressions if S-G's
   test slips): every `claudeMdExcludes` entry in `.claude/settings.json`
   evaluated with `picomatch` (absolute paths, `{dot:true}`) against the repo file tree; any
   entry matching 0 files FAILS with the entry named. Behavioural — no prefix-form check
   (`**/` works via picomatch semantics, NOT the normaliser; spec §2). `picomatch` becomes an
   explicit **pinned** devDependency → this is a **capability commit**: `Prior-art:` trailer
   (verdict ADOPT verbatim — picomatch is the matcher the shipped client bundles) + SSOT entry
   in the same commit. **The escape hatch is REFUSED on this commit** — `prior-art.ts:195-199`
   rejects `Prior-art: skipped` on a capability commit («cite an SSOT entry … instead»), and no
   picomatch row exists yet (`grep -i picomatch docs/meta-factory/prior-art-evaluations.md` → no
   hits; highest id `#236`), so the new SSOT row must land in the SAME commit or the push is
   blocked with an error that looks unrelated. **No principle-test allowlist exists** (rev 5 —
   the rev-4 instruction sent you to a registry that is not there): principle tests are
   glob-discovered (`packages/core/vitest.config.ts:10` `principles/**/*.test.ts`). The
   registration you DO need is the pre-push one in item 2/3 below.

   **Dependency pin — name the manifest, there are two (rev 5).** Pin in
   `packages/core/package.json` + `packages/core/package-lock.json`, NOT the repo root: the suite
   runs as `npm --prefix packages/core run test:principles` (`.github/workflows/audit-self.yml:214`).
   The tree already carries **two majors** — root `picomatch@2.3.2`, `packages/core@4.0.4` — so pin
   the `packages/core` major (4.x) and say so in the trailer; pinning the root manifest produces a
   green local run and an unresolvable import where the test actually executes.
2. **P2b — local-shadow pre-push section** (+ `worktree-doctor.sh` arm): if
   `.claude/settings.local.json` defines `claudeMdExcludes`, its picomatch match-set must be a
   superset of the project list's match-set — else error-with-escape-token (rationale ≥20
   chars, `ci-tool-pinning.md §3` precedent). Host-only channel: CI cannot see the file.

   **Acceptance for P2b — a discrimination pair, not just «the arm exists» (rev 5; the rev-4
   kickoff declared no criterion at all for this item, so a no-op arm would have passed every
   stated check).** `.claude/settings.local.json` is gitignored (`git check-ignore -v` →
   `~/.config/git/ignore:1`) and on the host currently has **no** `claudeMdExcludes` key
   (`jq -r 'has("claudeMdExcludes")'` → `false`), so the assert is unexercised on both sides
   unless you build fixtures. Required: (i) a fixture local list that is a strict SUBSET of the
   project list → the section exits non-zero **naming the missing entry**; (ii) the same fixture
   as a superset → the section stays green. Both quoted in the PR body.

   **Pre-push registration (BINDING — rev 5; without it the hook throws at runtime and principle
   32 goes red).** Every pre-push section is an entry in the `SECTIONS` array at
   `packages/core/hooks/pre-push.ts:1445`, and `:1552` throws when a section carries no valid
   `owner`. Add each new section there with `owner: 'maintainer'` (both new sections are
   maintainer-surface), per `packages/core/principles/32-prepush-section-owner.test.ts`.
   **Implement both sections INLINE in `pre-push.ts` — do NOT extract a new
   `packages/core/hooks/checks/*.ts` module.** A new relative import from `pre-push.ts` turns
   principle 27 red (`27-prepush-copylist-complete.test.ts:108` real-tree arm and `:260`
   fresh-install arm), and the fix would be to edit the copy loops at `install.sh:874` and
   `setup.d/50-hooks.sh:26` — neither of which is in this stage's §2 permitted set. Inlining
   keeps the change inside the permitted surface.
3. **P3a — wire the EXISTING `scripts/check-alwayson-budget.sh`** (ceiling 101,000 B, `:8`)
   into `.husky/pre-push` + CI mirror, with **per-environment ceilings** (N2 label required —
   the gate refuses an unlabelled ceiling) + escape token. REUSE — do not write a new gate.
   **Declared coverage — state it, do not inherit it silently (umbrella §3 gate 2).**
   token-audit S1's falsifier FIRED: the repo-authored injected set this gate can see measures
   **29,589 tok (aif-container) / 39,021 tok (host-cc) against a ~100k session-start total →
   29-39%** ([`2026-07-26-session-start-token-attribution.md:214-218`](../../../docs/meta-factory/research-patches/2026-07-26-session-start-token-attribution.md)).
   The gate therefore governs a **minority share**, and the remaining 60-71% is harness-resident
   and unreachable by any file-trim — it is addressed by P14 as operator recommendations, never
   by this gate. Carry that as a **comment in the gate itself** (next to the ceiling) and as a
   sentence in the PR body. Transplanting the old ceilings while implying whole-session coverage
   is `#hope-as-gate` ([attention-is-not-a-mechanism.md §2](../../rules/attention-is-not-a-mechanism.md));
   the ceiling numbers themselves are re-derived per the formula below, not copied.
   **Ceiling formula (decided, spec §1.6 FORK D):** per-environment ceiling = the post-P3b
   meter's measured baseline at this stage's base commit × 1.10, rounded UP to the next
   1,000 B, each labelled with its environment and a derivation comment quoting the baseline
   run. For calibration: the true resident set at re-plan time (staging `c8a2bfcec6`, BEFORE
   S-G) measured 69,453 B; post-S-G expect ≈ ≤ 50.2 KB — if the fixed meter's baseline is not
   in that neighbourhood, STOP and park (the predicate or the base is wrong).

   **«Per-environment» defined (rev 5 — the rev-4 text required a label for a set it never
   named, and no detection idiom exists anywhere in the spec or the gate).** The environment set
   is exactly two: **`host-cc`** and **`aif-container`**. The gate exposes ONE knob
   (`check-alwayson-budget.sh:8` `CEILING="${AIF_ALWAYSON_CEILING:-…}"`), and **only the
   container baseline is measurable from where this stage runs** — so the accepted shape is
   **one committed ceiling carrying TWO labelled derivation comments**: the `aif-container`
   line quoting your own baseline run, and the `host-cc` line stating `UNMEASURED — baseline not
   reachable from the container; S-H's host session supplies it`. Inventing a host number from
   the container is `#budget-sized-to-the-wrong-machine`. **Added to the §3a park list:** if you
   conclude a genuine per-environment *runtime* switch is required (rather than two labelled
   comments), park it — that is a gate-shape decision, not an implementation detail.
4. **P3b — fix `scripts/measure-always-on.sh` — BOTH blindnesses (extended rev 4):**
   (i) membership predicate: the manifest must be `CLAUDE.md` + `.claude/rules/*.md` files
   **lacking `^paths:` frontmatter** (the `scripts/probe-channels.sh:20` predicate — one bash
   idiom, two consumers; `packages/core/principles/rule-channel-glob.ts` stays the semantic
   owner, note the twin in a comment), because `paths:`-scoped rules are not resident — the
   current all-files glob over-counts **~8×** — measured at this stage's post-S-G base
   (`origin/staging`): all-files **400,919 B** vs a true resident **≈48.7 KB** (rev 5; the
   rev-4 sentence quoted the pre-S-G pair 394,687 B / 69,453 B and read as «~4×», both stale
   now that S-G re-scoped `ai-laziness-traps.md` behind `paths:`), spec §1.6 FORK D;
   (ii) apply the effective `claudeMdExcludes` under **replace-per-key overlay semantics**
   (a local `claudeMdExcludes` SHADOWS the project list entirely — spec §1.6 FORK D,
   round-4 MAJOR-3; this is the only model under which P2b's superset assert is
   load-bearing): verify the client's merge semantics against primary docs in this same
   task, cite the verdict in BOTH P2b and P3b, and PARK if the docs contradict the replace
   model. The fixed output then serves as the §2 item-3 fallback outcome channel.
5. **P3c — `InstructionsLoaded` verification task** (ADR-3): can a hook on it OBSERVE the full
   loaded set, and can it BLOCK? Primary-docs verification, verdict recorded either way with
   citations. Doubles as the measurement-extension probe (ADR-3 falsifier note). A LIVE
   host-session confirmation is NOT this stage's job — S-H runs it if your verdict says
   «observable»; do not manufacture a live observation from the container (T-SE-B).

> **SUPERSEDED (rev 4 — preserved per T18, do not execute here):** former items 6-8 — P3d
> N2 attribution extension (per-turn re-write trigger classes incl. the config-change class,
> arrival-position, edit-time-injection firing rates), P11 Explore/Plan subagent probe, P14
> harness-remainder price list — **moved verbatim to
> [`../arch-v2-context-pipeline-s-h/kickoff.md`](../arch-v2-context-pipeline-s-h/kickoff.md)**.
> Reason: each needs the host (`~/.claude/projects`, measured host sessions, `/context`) and
> this kickoff's marker routes execution into the aif container, where none of those exist
> (spec §1.6 FORK C, `aif-handoff/docker-compose.yml:27`).

**Descopes (encoded, binding):** no CLAUDE.md/traps trim, no renderer/probe edits (S-G owns
— and it has ALREADY MERGED by this stage's base precondition); no subtraction maps
(S-D′ owns); no host-side measurements (S-H owns); no Bash-output economy (L1 dropped on the
RTK measurement, SSOT #233); no re-derivation of any §2/§4 prep-doc fact.

## §2 Permitted files

`packages/core/principles/*` (new test + allowlist), `packages/core/hooks/pre-push.ts` /
`.husky/pre-push`, `scripts/check-alwayson-budget.sh`, `scripts/measure-always-on.sh`,
`scripts/worktree-doctor.sh`, **`packages/core/package.json` + `packages/core/package-lock.json`**
(picomatch pin — the `packages/core` manifest specifically, rev 5: the repo root carries its own
pair and a different picomatch major),
`docs/meta-factory/research-patches/*` (P3c verdict output),
`docs/meta-factory/prior-art-evaluations.md` (P2a SSOT entry), `.github/workflows/*` (CI
mirror only). NOT permitted: `.claude/settings.json` (operator-only), `.claude/rules/*`,
`CLAUDE.md`, `scripts/render-rule-index.mjs` / `scripts/probe-channels.sh` /
`scripts/render-rule-channels.mjs` (S-G owned, already
merged), `scripts/measure-turn-attribution.sh` (S-H's file — may not exist yet, do not
create it).

## §3 Acceptance

```bash host-verify
npx vitest run packages/core/principles
bash scripts/check-alwayson-budget.sh
bash scripts/measure-always-on.sh | jq -e '[.sources[].path] | index(".claude/rules/ai-laziness-traps.md") == null'
```

**Why line 3 is not a bare `measure-always-on.sh` run (rev 5).** The bare form passes today with
zero work done: the script has no non-zero exit path (it ends at a `printf`), so it cannot
distinguish a fixed meter from an untouched one — verified, `bash scripts/measure-always-on.sh`
→ EXIT 0, `"total_bytes": 400919`. The `jq -e` form asserts the **membership predicate** the stage
exists to fix: `ai-laziness-traps.md` carries `paths:` frontmatter since S-G, so a correct meter
must NOT list it as resident. RED today, GREEN only after P3b lands.

**The budget gate must ASSERT AND DISCRIMINATE — an acceptance TRIPLE (spec §1.6 FORK D,
round-4 M-2: the before/after pair alone proves the meter was fixed, never that the gate
catches anything — EXIT=0 after is true by construction when the ceiling derives from the
measured state):**
(1) BEFORE — unmodified meter at the base commit, `bash scripts/check-alwayson-budget.sh`
exits 1 reporting ~394-403 KB (post-S-G tree: the digest adds ≤ 8.2 KB to the broken
meter's count) against the 101,000 B ceiling — quote it; (2) AFTER — fixed meter +
re-derived per-environment ceilings, the same command exits 0 — quote it; (3)
DISCRIMINATION — **rev 5 replaces the rev-4 wording, which was vacuous**: forcing the ceiling
below the baseline only exercises the pre-existing `total > CEILING` comparator, which this
stage does not touch. Verified on an untouched tree: `AIF_ALWAYSON_CEILING=1000 bash
scripts/check-alwayson-budget.sh` → `DRIFT: … 400919B exceeds ceiling 1000B`, **EXIT=1 with
zero work done**. The leg must discriminate the **membership predicate** instead: add a temp
`.claude/rules/<fixture>.md` **without** `paths:` frontmatter, sized above the post-fix
headroom → the gate goes RED naming the overage; add the same-size fixture **with** `paths:`
frontmatter → the gate stays GREEN. Both runs quoted; the fixture removed before commit. That
pair is red-then-green only if the predicate was actually fixed. A PR whose gate still exits 1
at merge time, or whose «fix» is raising the ceiling to cover the broken ~400 KB
measurement, or whose gate was never shown RED on an over-budget state,
FAILS this stage.

Plus review-time:

- **P2a discrimination, demonstrated without waiting on the operator (UPDATED rev 4 — P1 has
  LANDED, PR #1223: the committed list is already the working `**/` glob form).** The test
  MUST be shown to discriminate on BOTH configurations, and neither run may depend on an
  operator action: (i) against the LIVE committed list
  (`jq -r '.claudeMdExcludes' .claude/settings.json`, 7 `**/` entries) → **PASSES**;
  (ii) against a **fixture / temp copy** of the list rewritten back to the historical
  relative-path form (`.claude/rules/<name>.md`) → **FAILS**, naming every inert entry.
  Both runs quoted in the PR body. The FAIL leg is what proves the test catches the P1
  defect class recurring; a test that passes on both forms is T-SE-A theatre.
- The escape token tested (<20-char rationale fails); every ceiling carries an environment
  label + the derivation comment quoting the baseline run; the P3a declared-coverage sentence
  is present in both the gate comment and the PR body
  with the 29-39% figure and its citation; the P3c verdict carries primary-source citations
  whichever way it lands.

## §3a Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
defensible implementations, an undecided design choice, a missing spec detail that changes
behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
`blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
Y») and **stop that task.** Proceed only on the unambiguous parts.

Expected to fire here on: **(a)** the per-environment ceiling numbers, if the post-P3b
baseline lands far outside the calibration neighbourhood in §1 item 3 — park with the two
candidate readings and their consequences rather than picking the safer-looking one;
**(b)** P3c, if `InstructionsLoaded` turns out to
observe but not block — that changes ADR-3's channel choice, so record the verdict with its
citation and park the «promote the gate earlier?» decision; **(c)** the S-G base
precondition, if S-G is NOT on staging at start — park, do not proceed on the pre-S-G
baseline. Never manufacture a quoted command output for anything outside your environment.

## §3b Stage neighbours (rev 4 — S-G is a PREDECESSOR now, not a parallel)

> **SUPERSEDED (rev 4, preserved per T18):** the rev-3 text here said S-G «runs
> concurrently» and prescribed merge-forward on collision. The spec re-derived the order
> (§1.6 FORK D): **S-G merges BEFORE this stage dispatches** — the §1 base precondition.

Slot bookkeeping survives the re-order: S-G has taken principle-test slot **35**; this stage
takes slot **34** as pre-assigned in §1. If staging moves mid-stage for any other reason,
resolve by **merging staging into this branch** — never `git rebase` a published branch
([git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md)).

## §4 AI-traps

See [`ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md) (cited per §3 of that rule).
**Active traps for this stage: T2, T3, T6, T14, T16, T20.** T2 — P3c must be RUN against the
primary docs, not designed («would verify» = failure); T3 — every measurement row carries
command + output;
T6/T14 — a probe that cannot observe reports «coverage insufficient», never «clean»; T16 —
picomatch-in-tree (2 majors) is not picomatch-pinned: verify the pinned major matches the
client's, not just the name; T20 — no verdict without quoted evidence.
**T-SE-A — gate-green-on-broken-config:** the tempting test asserts the glob FORM (passes
forever, catches nothing — the round-1 reviewer's form-proxy finding). Counter: assert
match-COUNT against the real tree. Note rev 4: P1 has LANDED (PR #1223) — the committed list
is now the WORKING 7-glob form, so §3's discrimination pair runs against a fixture BROKEN
(relative-path) copy for the FAIL leg and the live committed list for the PASS leg — the
inverse of the rev-3 arrangement; both runs still quoted.
**T-SE-B — observation-by-assumption:** tempted to «confirm» P3c behaviour or the resident
set from inside the container. Counter: ~~container-unreachable claims carry a primary-doc
citation or park~~ — **CORRECTED 2026-08-09: a primary-doc citation is the INSUFFICIENT case.**
A cannot-reach claim carries the **probe** (`docker exec`/`docker inspect` against the live
destination) **plus the date**, or an explicit `INCONCLUSIVE — could not probe`. Measured
falsification: `meta-orchestrator-refactor/kickoff.md` §4c cited `runtime-bridge-setup.md:40`
for «Superpowers plugins NOT available» — a primary-doc citation, and false; `docker inspect`
returned two plugin mounts. This trap's whole class is now owned by
[`destination-environment-verification.md §1b`](../../rules/destination-environment-verification.md)
(PR #1347); never a manufactured live observation.
