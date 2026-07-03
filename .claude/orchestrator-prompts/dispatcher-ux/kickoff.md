# KICKOFF — dispatcher-ux (UX + correctness hardening of /dispatcher — handle the already-done path)

> **Type:** R-phase → I-phase umbrella. Base: staging. Runner: CC (skill-leaning).
> **Persistence:** CANON (`~/.claude-coordination/rules-as-tests-aif/`), survives worktree deletion.
> **Sibling:** `pipeline-ux` (same shape, the `/pipeline` side). This is the `/dispatcher` side.
> **Relation:** follow-on to `dispatcher-skill` (Stage 1 `/dispatcher` shipped, PR #403). Captures fixes found DURING the dispatcher-skill Stage-2 eval. NOT a blocker for that eval; lands after.
> **Origin:** 2026-06-03 — first live `/dispatcher audit-tooling-refresh` run. The loop was designed for the happy path (umbrella has undone work); the real run hit the OTHER path (umbrella already merged) and exposed two missing steps + a self-application slip.

---

## §0 Problem (all evidence from the live 2026-06-03 `/dispatcher audit-tooling-refresh` run)

The first real run short-circuited *correctly* — but only because the operating session ran ad-hoc checks the SKILL does not define. The skill itself would have mis-behaved. Concrete:

- **P1 — No pre-dispatch «already-done» guard (correctness, surfaced as UX).** `SKILL.md §2.6` gates only AFTER implementation and keys the merged-check on the branch name: `gh pr list --search "is:merged head:<branch> base:staging"` (`.claude/skills/dispatcher/SKILL.md:95`). The umbrella was already shipped under a DIFFERENT branch + title (PR #85, branch `docs/audit-tooling-refresh`, title «refresh AUDIT-CHECKLIST/AUDIT-PROMPT post-C-1» — slug absent from title) → the §2.6 branch-keyed gate would NOT have caught it. The run found it only via ad-hoc `git branch -a --list '*<slug>*'` + broad `gh pr list --state all --search "<slug>"` + deliverable-artifact existence. Without that step `/dispatcher` re-dispatches already-merged work (the harvest-dedup inverse). → The loop needs a **pre-dispatch dedup guard (§2.0) BEFORE §2.1**, not just a post-implement gate.

- **P2 — No closure-marker (done.md) step.** `SKILL.md §2.7` emits «umbrella complete» (`.claude/skills/dispatcher/SKILL.md:99-100`) but never writes the `done.md` per the CLAUDE.md umbrella-closure convention. Consequence: `priority-score.sh` Layer C3 reads `done.md` to stop re-surfacing a candidate; with no marker, every completed umbrella re-appears as pending. This is the *exact* drift that made the two prior eval picks (audit-tooling-refresh #85, n8-c4 #177) look open when they were merged. The run wrote `done.md` ad-hoc. → Add a **closure step**: at last-stage complete (or on discovering an already-done-but-unmarked umbrella) write a schema-compliant `done.md` (`# <umbrella> — DONE` / `- Final PR:` / `- Closed:` / `- Summary:`) + sync to CANON.

- **P3 — Base-branch divergence not surfaced.** PR #85's base was `main`; the kickoff said «off origin/main»; our trunk is now `staging`; harvest defaults `--base staging` (`.claude/skills/dispatcher/SKILL.md:81`). When a kickoff's stated base diverges from the live trunk, `/dispatcher` should surface/normalize it, not silently assume staging. (Minor but real — caught at pick time.)

- **P4 — Self-application slip: a CLEAR fork was surfaced as a question.** The run ended by asking the operator «commit the done.md, or you handle?». Writing an accurate, tracked closure marker for a genuinely-merged PR is a CLEAR/technical action — by `/dispatcher`'s own DN-B Option-A discipline (`.claude/skills/dispatcher/SKILL.md:129`: clear → decide + report; only genuine/strategic → surface) it should have been auto-done and reported, not turned into a human round-trip. The skill did not apply its own fork-discrimination to its own closure step. (T15 self-application; `recommendation-laziness-discipline.md §5 #fork-decided-by-silent-action`'s inverse — here a clear call was needlessly surfaced.)

- **P5 — Monitor step uses a harness-BLOCKED wait pattern.** `SKILL.md §2.2` says «Poll `GET /tasks/:id` until status changes» (`.claude/skills/dispatcher/SKILL.md:70-75`) but specifies NO wait mechanism. The live run reached for `sleep 45; curl …/tasks/<id>` — which the CC harness **blocks** («Blocked: sleep 45 followed by: curl …»): foreground `sleep` is disallowed by contract («use Monitor with an until-loop»), and the long compound `;`-chain (`sleep; curl; echo; curl | python3`) trips the command-safety block. → §2.2 MUST specify a harness-safe poll: **single-poll-per-turn** (curl once, re-check next turn) OR a **scheduled re-check** (`ScheduleWakeup`/loop) OR `run_in_background` — never a foreground `sleep`, never a giant compound `;`-chain.

- **P6 — Dispatch emits no aif web-UI link to watch the task.** At dispatch, `SKILL.md §2.1` runs `dispatch.ts`, which only prints the PostToolUse `additionalContext` JSON — no human-clickable URL. The operator cannot open the running task to watch it. aif HAS a web UI (container `aif-handoff-web-1`, `0.0.0.0:5180->80`, SPA «AIF Handoff — Autonomous Task Management»; API is the separate `:3009`). → `/dispatcher` MUST emit the task link at launch, e.g. `http://localhost:5180` (board) or a deep-link `http://localhost:5180/tasks/<taskId>`. Source the host/port from config (the `:3009` API base is `RUNTIME_BRIDGE_AIF_*`; the web port `5180` is a separate docker-compose mapping) — do NOT hard-code if a consumer's mapping differs.

**Root cause (P1+P2):** the loop was specced for forward motion — «dispatch → implement → harvest → advance». It lacks the two bookends the *already-complete* path needs: a **dedup guard at the front** and a **closure-marker at the back**. P4 is the same fork-discipline the skill ships, not turned on itself. P5 is an unspecified-mechanism gap in the monitor step.

---

## §1 Stages

### Stage 0 — R-phase: design the dedup-guard + closure step (deliverable `ux-design.md`, no code)
- **Pre-dispatch dedup guard (§2.0):** define the check that runs BEFORE §2.1 — branch pattern (`git branch -a --list '*<slug>*'`) + broad `gh pr list --state all --search "<slug>"` (NOT `in:title`) + deliverable-artifact existence read from the kickoff's §Done/§Deliverable. Output verdict: ALREADY-DONE (skip dispatch → offer/write closure marker) / IN-FLIGHT (resume) / FRESH (dispatch).
- **Closure-marker step (§2.7+):** when/where `/dispatcher` writes `done.md` (schema per CLAUDE.md umbrella-closure convention), including the retroactive marker for already-done-but-unmarked umbrellas, + CANON sync. `done.md` IS git-tracked (`.gitignore:14` negation `!.claude/orchestrator-prompts/*/done.md`).
- **Base normalization (P3):** how `/dispatcher` reconciles a kickoff's stated base vs the live trunk (refresh `origin/HEAD`; warn on divergence; harvest `--base` follows the live trunk).
- **Self-application (P4):** the closure-marker decision MUST run through the skill's OWN DN-B discrimination — a clear closure action is auto-done + reported, never surfaced as a question.
- **Harness-safe monitor (P5):** §2.2 must spell out the wait mechanism — single-poll-per-turn or scheduled re-check or `run_in_background`; explicitly forbid foreground `sleep` and compound `;`-chains (both harness-blocked). Decide the default cadence.
- **How to VERIFY the monitor (P5-verify — the project-thesis bit):** prose in `SKILL.md §2.2` is unverifiable by construction («documents lie; tests don't»). So the fix must make the poll a **testable unit** (extract the poll/transition logic into a function or helper, not prose), then ship TWO deterministic checks: (1) **transition test** — drive the poll against a *stubbed* aif (`GET /tasks/:id` returning a scripted sequence `implementing → implementing → done`, plus a `blocked_external`/parked variant) and assert it detects each transition, terminates on `done`/`verified`, and routes parked→Q&A; (2) **safety check** — a deterministic grep/paired-negative asserting the monitor emits NO foreground `sleep` and NO compound `;`-chain (the exact P5 regression). The Stage-2 eval (a real run reaching `done` without stalling) is the *secondary* end-to-end signal — slow + non-deterministic, NOT the primary gate.
- **Watch-link at dispatch (P6):** §2.1 emits the aif web-UI link (`http://localhost:5180` / deep-link `/tasks/<taskId>`) right after dispatch. Determine how to derive host/port from config (web port `5180` ≠ API `:3009`), the real SPA deep-link route, and the graceful fallback when the web container is absent (print the `:3009` REST URL instead).
- **BFR (`build-first-reuse-default.md §3`):** `priority-score.sh` already has Layer-C completion detection (done.md / branch-prefix / jaccard). **REUSE** its logic for the pre-dispatch guard rather than re-implementing (T16 — confirm the problem class matches before reuse). DeepWiki/WebSearch only if priority-score's logic is insufficient.

### Stage 1 — I-phase: wire the guard + closure step into the skill
- Add §2.0 dedup-guard prose + the closure-marker step to `.claude/skills/dispatcher/SKILL.md`. Reuse `priority-score.sh` completion-detection where the problem class matches (BFR).
- Keep the SKILL ≤~200 LOC; principle 15 (paired-negative) + 09 (header) green.
- §1.7 PR-body (H3, «applied», ≥40 chars, ≥1 `file:line` each — touches `.claude/skills/**`). `Prior-art: skipped — UX/correctness fix to existing skill, no new capability` UNLESS a stage adds a capability-sized helper (≥50-80 LOC / new dep) → then carry an SSOT consult + `Prior-art:` trailer per CLAUDE.md.

### Stage 2 — Eval re-run
- Re-run the dispatcher behavioral eval on a genuinely-open umbrella; confirm: the guard skips an already-done umbrella, the closure-marker writes on complete, base is reconciled, and no clear fork is surfaced as a question.

---

## §2 Discipline
- Branch per stage, base staging. Principle tests green (`npm --prefix packages/core run test:principles`). §1.7 PR-body each stage.
- **Traps** (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)): T3 (file:line evidence) · T15 (self-application — the closure decision uses the skill's own fork-discipline) · T16 (reuse `priority-score.sh` completion-detection, don't re-invent by name-match) · T19 (own cold-QA before handoff) · T20 (no verdict without evidence-tool).
- **Domain trap T-DUX-A (guard false-negative):** the dedup guard must not mark a genuinely-fresh umbrella as already-done. Falsifier: a fresh umbrella whose slug appears in an unrelated merged PR's body gets skipped → require ≥2 corroborating signals (branch match AND artifact existence), not a lone slug-substring PR hit.
- **Domain trap T-DUX-B (monitor verified by prose, not by test):** «§2.2 says don't `sleep`» is prose the AI can ignore — it is NOT verification. Falsifier: the P5 fix lands with no deterministic transition-test against a stubbed status sequence AND no no-`sleep`/no-compound safety check → the monitor is unproven, and a future edit reintroducing `sleep` passes silently. The poll MUST be a testable unit with both checks (P5-verify), else P5 is «fixed» on paper only.

## §3 Anti-scope
- Do NOT change the core loop routing or the 4 primitives — add the two bookends (guard + closure) + base normalization only.
- Do NOT touch `pipeline-ux` (different umbrella / different skill) or the `dispatcher-skill` Stage-2 eval (parallel concern).
- Do NOT build new CLI primitives — reuse `priority-score.sh` completion-detection.
- Do NOT add npm deps. Does NOT edit `~/.claude/skills/orchestrator/` (global, agent-uncommittable).

## §4 Done =
`/dispatcher <umbrella>` (a) detects an already-merged umbrella BEFORE dispatch (branch + broad search + artifact, ≥2 signals), skipping re-dispatch and writing the closure marker; (b) writes a schema-compliant `done.md` at completion AND retroactively for unmarked-done umbrellas, without asking when the action is clear; (c) reconciles the kickoff's stated base vs the live trunk; (d) monitors via a harness-safe poll proven by a deterministic transition-test (stubbed status sequence → correct detection/termination) + a no-foreground-`sleep`/no-compound safety check, not by prose; (e) emits the aif web-UI watch-link at dispatch; (f) **UX-works asserted, not eyeballed** — a deterministic test confirms the dispatch output contains the watch-link and the run report is bounded (not a wall); tests green; §1.7 bodies present.
