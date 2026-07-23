# beta-delivery-ux — umbrella kickoff (track-2 umbrella A)

> **Type:** execution-build, multi-stage. **Tier 2** per [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md)
> — every stage carries real design decisions (profile payloads, preset data model, aif
> API shapes), so NO `bridge-profile` marker: top tier plans, executor implements/reviews.
> **Base branch:** `staging`.
> **Status:** READY after (a) the binding spec + the meta-launch amendment are merged to
> staging and (b) the §0 preflights pass. Dispatch is operator-run `/pipeline`.
> **Binding design:** [docs/superpowers/specs/2026-07-23-beta-program-design.md](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> — §2 decisions D1-D9 (with falsifiers), §4 umbrella A design (A1-A8 + R1), §8
> integration contract (Lego map + ordering rules), §9 tier routing + dispatch
> preflights. This kickoff is the dispatch input; the spec is the design SSOT — on any
> divergence the spec wins, surface the divergence instead of improvising.

## §0 Dispatch gate (binding preflights, per spec §9)

1. The meta-launch amendment (spec §2 D1) is MERGED to staging — until then U3-U7
   surfaces contend with this umbrella on `install.sh`/`setup.d/` and dispatch is
   forbidden.
2. Pre-dispatch in-flight probe (CLAUDE.md operational conventions) MUST cover the
   track-1 umbrellas (`getff-honest-signals`, `getff-any-stack-trace`,
   `getff-foreign-scan-triage`, `getff-freshness-widening`), the aif task queue, and any
   worktree touching `install.sh` / `setup.d/**`. Re-probe after every Phase -1 review.
3. Stages marked `blocked-pending-neighbor` below do NOT start until the named neighbor
   artifact is ON staging (spec §8/§9): A3 needs the acceptance-contour CLAUDE.md
   amendment; A4 marker semantics need the acceptance-contour spec; the go-lane rows
   need adapter-jig J3.
4. Every stage re-verifies its file:line anchors live at stage entry — the spec's line
   citations are snapshots (measured at `812268ac2`/`d534019b3`), staging moves fast.

## §1 Goal

The environment layer installs in minutes with named depth profiles, GLM connects with
exactly one human-entered key, and daily use always has one obvious proposed next
command — measured by the four design objectives of spec §1 (time-to-working,
zero-forgettability, AI-performs-setup, AI DX).

## §2 Stages

| # | Stage | Scope (spec ref) | Gate | Notes |
|---|---|---|---|---|
| S1 | Install profiles | A1: `core`/`env`/`factory` over existing flags; one-line consequence text per profile; `--profile` flag + TTY menu + INSTALL-FOR-AI dialog default; per-profile payload inventory incl. the shipped convenience+guard hook set | fresh-machine smoke per profile; `--refresh` upgrade path proven; existing flag back-compat kept | absorbs U3 (run the T17/T18 residue sweep of `mif-s3-integ` FIRST) + U6 layer-selection + U7 plugin-channel scope per the amendment |
| S2 | Pipeline presets + status + workspace one-command | A4: 4 declarative presets (`aif`/`night`/`economy`/`sdd`) in `references/`, list verb, `--preset` flag, TTY proposal in launch-table; A5: `/pipeline status` (read-only, sectioned, next-command lines); A9: `getff work <name>`-class one-command (REUSE `scripts/create-worktree.sh` + ship it + per-harness session start/print; flag-first) | preset activation works flag-only (non-TTY); status renders all three sections against live bricks (`questions.ts`, bridge REST, `gh pr list`); A9 smoke on CC AND one non-CC harness (launch or exact printed command) | `economy` emits the bridge-profile marker — semantics per acceptance-contour D1: **blocked-pending-neighbor** for the marker-emitting branch only |
| S3 | Tier-home + degradation matrix | A3: shipped AI-agnostic doc (home per fork F-A′) with Tier 0/1/2 criteria + full degradation table; CLAUDE.md «Task-tier routing» → pointer | doc ships in `env`+`factory` payloads; AGENTS.md template points at it (C1 contract) | **blocked-pending-neighbor** (acceptance-contour D1 amendment must land in CLAUDE.md first); the CLAUDE.md pointer-ization = cross-owner edit → separate atomic commit + maintainer sign-off |
| S4 | GLM one-button + aif companion install | A2: aider-pattern flow (detect → explain → ONE key by human → REST profile create + per-mode defaults + validation ping + glm-handoff skill delivery); A1 companion upgrade: `factory` profile offers consented guided INSTALL of aif-handoff itself (official repo, docker compose, detect-first; decline → `env` degradation) | live end-to-end on a clean machine against a running aif; degrade-to-manual counts as objective-3 MISS, not a pass | aif API field shapes are designed-not-proven (checkout 2026-05-26) — verify live FIRST; the key value is never touched by tooling |
| S5 | Ship contour skills + foreign dispatch | A8: wiring-only additions of `/arch` + `claude-glm-executor-handoff` to `setup.d/10-skills.sh` (env/factory); A7: `factory` profile vendors the runtime-bridge subset (CLI + hook, env-parameterized, per-project dedup path) | agnosticism harness green over the widened shipped set; vendored dispatch smoke on a non-framework repo | NO content edits to /arch or glm-handoff (three parallel sessions touch them — rebase on staging content) |
| R1 | npm release mechanics | A6: name freeze @getff (absorbs U11 + its gate «имена заморожены ДО публикации»), `files` allowlist + tarball matrix cell, bin runnability (fork F-C′), package metadata, release-drafter notes | `npm pack` tarball installs + runs in the matrix cell; publish itself NOT executed (operator act, release-frame phase 2) | binding input: [s6-u10-handoff.md](../launch-preannounce-track/s6-u10-handoff.md) |

Stage order: S1 → S2 ∥ S3 ∥ S4 ∥ S5 → R1. One PR per stage onto staging; umbrella
closure writes `done.md` (CLAUDE.md convention).

## §3 Out of scope

Killer-layer code (track 1 owns); aif-handoff internals (acceptance walls); U9 repo
split / bridge npm packaging (post-announce); /arch + glm-handoff CONTENT; docs-site
work (umbrella B); AGENTS.md/AI-guide content (umbrella C — S3's doc is the SSOT C1
points at).

## §4 AI traps (per [.claude/rules/ai-laziness-traps.md §2-§3](../../rules/ai-laziness-traps.md))

Active traps for this umbrella: T3, T7, T16, T17, T19, T20, T21.

- T3 — every «works» claim needs command+output (fresh-machine smokes, not prose).
- T7 — do not pattern-match the spec's stage table into checkbox theater; the gates are
  live-fired evidence, not section headers.
- T16 — rustup/aider are ADOPTED **patterns**, not code: verify our regen-upgrade and
  one-key flow against OUR install semantics, not upstream's.
- T17 — U3 residue sweep BEFORE supersession (destructive-delegation guard).
- T19 — own cold QA of every stage diff before handoff; CI ≠ design review.
- T20/T21 — verdicts and backward-checks carry file:line evidence; sweeps enumerate
  sibling surfaces (install.sh, setup, plugin channel, INSTALL-FOR-AI), not the diff.
- **T-BDU-A (domain):** «profile payload looks complete because the happy stack
  installed» — payload completeness is judged against the per-profile inventory
  (incl. the convenience+guard hook set) on ALL lanes (js/python/cargo/go-when-J3),
  not against one demo run.

## §5 Escalation

Park questions via runtime-bridge `park`/`answer` (acceptance-contour D5 routing once
live; until then `/arch` §4 office-hours class). Design-level drift from the spec →
STOP + surface, never improvise past a binding decision.
