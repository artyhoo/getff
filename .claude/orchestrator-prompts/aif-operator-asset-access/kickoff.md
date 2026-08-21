# KICKOFF — aif-operator-asset-access (R-phase → I-phase · "aif uses nothing I have")

> **Type:** R-phase-first umbrella (research the solution space → verdict → I-phase implement). Solution is NOT pre-decided.
> **Base branch:** `staging`.
> **Persistence:** CANON `~/.claude-coordination/rules-as-tests-aif/aif-operator-asset-access/` → mirrored into worktrees by `link-coordination.sh`. Authored 2026-06-03.
> **Sibling context:** this gap was discovered while writing the `meta-orchestrator-refactor` kickoff (see its **§4c Runtime availability** table) — that umbrella hit the wall first; this umbrella fixes the wall for ALL future aif dispatches.

---

## §0 Cold-start

Read: `README.md#why-this-exists` → `.claude/session-bootstrap.md` → `CLAUDE.md` → `docs/runtime-bridge-setup.md` (esp. workspace-currency §) → `.claude/rules/build-first-reuse-default.md §1.1` (the two-axis doctrine — load-bearing for this umbrella) → `.claude/rules/dual-implementation-discipline.md` → this kickoff.

**Problem in one line:** when work is dispatched to aif-handoff, the aif agent runs Claude Code CLI **inside a container with only the repo clone bind-mounted** (`/home/www/rules-as-tests-aif`) — so it has **none of the operator's machine-side assets**: global skills (`~/.claude/skills/orchestrator`, `reviewer`, Superpowers plugins `~/.claude/plugins/`), gitignored coordination (`.claude/orchestrator-prompts/` kickoffs + audit-plans), or CANON (`~/.claude-coordination/`). Net: "мой аиф ничем не пользуется что есть у меня." This umbrella makes aif **leverage what the operator has** — without violating the shipped-axis agnostic invariant.

---

## §1 The gap (VERIFIED 2026-06-03 — do not re-derive, re-confirm)

| Asset | In aif container? | Why |
|---|---|---|
| Project `.claude/skills/`, `.claude/rules/`, `.claude/hooks/`, `agents/*.md` | ✅ yes | committed → in the git clone → CC-CLI auto-loads (`runtime-bridge-setup.md:35,40`) |
| Global `~/.claude/skills/orchestrator/`, `reviewer/`, Superpowers `~/.claude/plugins/` | ❌ no | operator-home; only the repo clone is bind-mounted; container has its own `$HOME` |
| Gitignored `.claude/orchestrator-prompts/*` (kickoffs, audit-plans) | ❌ no | gitignored → not in clone; CANON symlink target is operator-home |
| CANON `~/.claude-coordination/<repo>/` | ❌ no | operator-home, not mounted |
| Dispatched kickoff CONTENT | ✅ transmitted | `dispatch.ts:63 buildKickoffSpec` reads it operator-side, sends content (sibling files it *references* do NOT travel) |

**Confirm each row before building** (T-trap T3 / T-MOR-A — the meta-orchestrator-refactor audit was overstated in places; re-verify, don't trust).

---

## §2 R-phase: solution space (evaluate ALL; cite prior art; verdict per `build-first-reuse-default.md`)

**Existing project mechanisms the R-phase MUST account for (do not reinvent — BFR):**
- `packages/core/templates/shared/skill-context/` already ships `aif-review` + `aif-rules-check` skill-context overrides → **aif skill-context is already a shipped concept.** What does it currently cover, and can it carry orchestrator/reviewer discipline?
- `agents/*.md` (compliance-verifier, living-docs-auditor, memory-codification-auditor, review-sidecar) = the project's **AI-agnostic, in-repo skill-substitute** pattern (the shipped-axis answer to "no global skills"). The orchestrator/reviewer disciplines may already have, or need, in-repo `agents/*.md` equivalents.
- `link-coordination.sh` + CANON = the cross-worktree asset-mirroring mechanism (operator-side only today).
- `.ai-factory/skill-context` (aif's own skill-context dir, see `detector/fixtures/aif-skill-context/`).

**Candidate approaches (NOT pre-decided — R-phase scores each):**
- **A — Mount operator assets into the container** (bind-mount selected `~/.claude/skills/` + `~/.claude-coordination/<repo>/` into the aif agent service). Operator-axis legitimate (your machine). Con: aif-handoff docker-compose change (operator-owned, not this repo); machine-specific; global skills may reference operator-only paths.
- **B — In-repo AI-agnostic equivalents** (ship the needed orchestrator/reviewer discipline as `agents/*.md` or `.claude/skills/*` IN the repo, so they ride the clone). Shipped-axis aligned (agnostic, degrades gracefully). Con: duplication risk vs the global skills; **must respect CLAUDE.md: the global `~/.claude/skills/orchestrator/` is agent-uncommittable / owner=maintainer — do NOT just commit it.**
- **C — Extend the dispatch payload** (`dispatch.ts` resolves + inlines a kickoff's referenced sibling files — audit-plan, cited rules — into the transmitted content). Solves the "audit-plan doesn't travel" half. Con: payload bloat; doesn't help global skills.
- **D — Extend the skill-context shipping** (`templates/shared/skill-context/`) to carry the orchestrator/reviewer/launch-table discipline aif needs. Reuses an existing shipped mechanism. 
- **E — Pre-dispatch hydration step** (a script that stages the operator's needed assets into the clone or a mounted dir before `docker compose up` / dispatch).

**R-phase deliverable:** `docs/meta-factory/research-patches/2026-06-XX-aif-operator-asset-access.md` — per-candidate verdict (ADOPT/ADAPT/BUILD/REJECT) + the recommended composition. Likely a **combo** (e.g. B+D for disciplines that should be agnostic anyway + C for per-dispatch inputs + A only for operator-private convenience), but that is the R-phase's call, not pre-committed here.

---

## §3 Doctrine tension to resolve (DN — surface, don't silently pick)

**DN-1 (load-bearing):** operator-axis vs shipped-axis (`build-first-reuse-default.md §1.1`). For the OPERATOR's own machine, mounting their skills (A) is legitimate ("use companions maximally"). For the SHIPPED product, hard-depending on operator global skills violates the agnostic invariant ("degrade gracefully when companion absent"). **The fix must not make a consumer's aif require the operator's `~/.claude/`.** R-phase must split: what is operator-convenience (A-style, fine) vs what becomes a shipped capability (B/D-style, must stay agnostic). Surface this split as the binding decision.

**DN-2:** which assets are even WORTH bridging? (orchestrator launch-table/stage-gate discipline → probably yes; reviewer-discipline → yes; full Superpowers → maybe not.) R-phase scopes.

**DN-3:** the docker-compose mount (A) edits the **aif-handoff deployment** (operator-owned, outside this repo) — is that in scope, or out (operator-runbook only)?

---

## §4 I-phase (after R-phase verdict)

Implement the chosen composition. Each piece atomic. If it ships a new in-repo discipline artifact (B/D), it carries Class + Authoritative-for header (`doc-authority-hierarchy.md`) + a paired-negative test where mechanizable. If it touches `dispatch.ts` (C), add a paired test. Verify a real aif dispatch then actually sees the bridged asset (liveness, not just "wired").

---

## §5 AI-traps active (`.claude/rules/ai-laziness-traps.md §2`)

T3 (re-confirm §1 gap rows with fresh evidence) · T11/T12 (BFR search before any BUILD — the skill-context + agents/* mechanisms already exist) · T13/T16 (don't assume the existing `skill-context/aif-*` covers orchestrator discipline — verify problem-class) · T15 (self-application: the fix itself must work when THIS umbrella is later dispatched via aif) · T19 (own cold-QA) · T20 (verdict needs evidence). **Domain trap T-AOA-A:** "solve it by committing the global orchestrator skill into the repo" — FORBIDDEN (CLAUDE.md: agent-uncommittable). The agnostic equivalent is an `agents/*.md` or skill-context artifact, not a copy of the global skill.

---

## §6 Anti-scope

- Do NOT commit/copy `~/.claude/skills/orchestrator/` into the repo (agent-uncommittable, owner=maintainer).
- Do NOT make consumer-side aif hard-require the operator's `~/.claude/` (shipped-axis agnostic invariant).
- Do NOT add npm deps. Do NOT edit the global skills.
- R-phase produces a research-patch + verdict ONLY — no implementation until the verdict + DN-1 are resolved.

---

## §7 See also
- `meta-orchestrator-refactor/kickoff.md §4c` (sibling — where this gap was found; the verified availability table).
- `docs/runtime-bridge-setup.md` (clone/mount model) · `.claude/rules/build-first-reuse-default.md §1.1` (two-axis) · `dual-implementation-discipline.md` (CC-native + portable-fallback) · `no-paid-llm-in-ci.md`.
- `packages/core/templates/shared/skill-context/` · `agents/*.md` · `scripts/link-coordination.sh` · SSOT (`docs/meta-factory/prior-art-evaluations.md`) for aif-handoff rows (#67/#97).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
