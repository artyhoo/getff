# Egress host-push-default — umbrella kickoff

> **Class:** operational kickoff (dispatch input).
> **Authoritative for:** scope of the egress-discipline codification — fixed decisions (host-push default, container-push deliberately not fixed, API-land break-glass only), stages S1–S3, carve-outs (§9).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The egress primitives (`harvest.ts`, `harvest-via-api.sh`) — owned by `packages/runtime-bridge` + [/dispatcher](../../skills/dispatcher/SKILL.md). The harvest procedure surface — owned by [/harvest](../../skills/harvest/SKILL.md) (this umbrella revises its §1.4).
> **Base branch:** `staging` (NOT `main` — promote manually).

> **Origin:** 2026-06-27 operator dialogue. The `/harvest` skill (#729) §1.4 prescribes **Git-Data-API push (`harvest-via-api.sh`) as the DEFAULT egress channel** ("container is a runtime, not a push env → land via API"). Operator flagged this as a **pre-push-gate bypass**: API-land creates the commit + ref server-side, so the local `.husky/pre-push` hook never runs (verified: harvest-via-api.sh = 9× `gh api`, 0 real `git push`). The project thesis is "every rule fails at the earliest reachable channel — edit → pre-commit → **pre-push** → CI"; API-default skips the pre-push channel. Operator chose **break-glass (option 1)** + **Option Y (pull to host, push from host)**.

## §1 Goal (one phrase)

Egress of a finished aif-agent branch runs the **real `.husky/pre-push` gate** by default: pull the container's committed branch to the **host**, rebase onto live `origin/staging`, `git push` from the host (authed, full toolchain, working transport). The Git-Data-API land becomes a **break-glass** path used only when the host transport is also dead — and even then the §3 local CI-equivalent sweep is mandatory.

## §2 Fixed decisions (do not re-litigate without cause — evidence from the 2026-06-27 session)

1. **Default egress = host-pull + host `git push`** (option 1 break-glass; option Y). The real pre-push hook runs.
2. **Do NOT "fix push in the aif container."** The container failure is a **network block**, not auth — verified: `curl https://github.com` from `aif-handoff-agent-1` → CONNECT FAILED at 0.000s (TCP never opened); `api.github.com` → HTTP 200; `gh` not installed in container. So "fixing it" means fixing the fragile tunnel network path, not flipping an auth flag — and the container also lacks the pre-push toolchain (`gh`/`actionlint`/`zizmor`), so its pre-push could not fully run anyway.
3. **Security rationale (load-bearing):** a sandboxed autonomous-agent container being **unable to push to the repo is a feature, not a bug** — giving it push access widens the trust boundary. The host is the correct trusted integration boundary; the operator admits the work. Aligns with the existing aif-doctor classification ("container is a runtime, not a push env → land from host").
4. **API-land = break-glass only** (`harvest-via-api.sh`), when host transport is ALSO dead. When used, the §3 `run-local-ci-sweep.sh` gate is mandatory as the gate-substitute (it already runs in the skill).
5. **The §3 sweep already exists** (`scripts/run-local-ci-sweep.sh`, CI-equivalent) — so the current state is not a *naked* bypass; the literal pre-push hook is what is skipped. This umbrella makes the real hook the default, not a replacement of the sweep.

## §3 Stages

| Stage | Deliverable | Depends on |
|---|---|---|
| **S1** | `.claude/rules/egress-no-api-bypass.md` (Class B) — §1 the two-channel rule (host-push default / API break-glass), §2 trigger, §3 mechanism, §4 promotion. Carries Class + Authoritative-for header (doc-authority §2-§3) + §1.7 self-reflection. Registered in principle 09 `REQUIRED_HEADER_DOCS` if applicable. | — (start) |
| **S2** | Revise [/harvest](../../skills/harvest/SKILL.md) §1.4 "Push channel": reorder to **host-pull + rebase-onto-live-staging + `git push` (real pre-push)** as default; API-land demoted to a clearly-labelled break-glass block (host transport dead) with mandatory §3 sweep + clobber check. Add the `fetch + rebase origin/staging` step (the host-path cost the API-land avoided). | S1 |
| **S3** | Verify: dogfood — place S1+S2 via host `git push` (not API); `make self-audit` green; principle 09 + 12 green; `done.md` closure. | S1, S2 |

## §4 Already done (do not redo) — #745 API-land verification

The 2026-06-27 session already **verified the API-landed #745** (the request "проверить то что мы по апи залили"):
- **Clobber: clean** — `git show 485a07f57 --stat` = exactly the 24 intended files, zero collateral; no staging-ahead file reverted (append-merge-on-live-tree worked).
- **Functional: green** — post-merge staging CI ran `f17 planted-violation (Node 20)` + `(Node 22)` both success.
- **Gate-equivalence:** #745 CI = 0/27 failing → the content satisfied the same checks pre-push would run. No material slip; only the *early channel* was skipped.

So S1–S3 codify forward-going discipline; no remediation of #745 is required.

## §5 Build-first-reuse (see [build-first-reuse-default.md](../../rules/build-first-reuse-default.md))

- **REUSE** existing primitives — `harvest.ts`, `harvest-via-api.sh`, `run-local-ci-sweep.sh`, `.husky/pre-push`. No new code: S1 is a prose rule; S2 is a skill-doc revision; the host-pull mechanism is plain `git bundle`/`fetch` + `git rebase` + `git push` (stdlib git, no new dependency).
- Verdict: **ADAPT/REFERENCE** — reorder an existing procedure's channel preference; do not build a new egress engine.

## §6 AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps:** **T3** (every claim = command + output — e.g. the network-not-auth verdict is backed by the container curl probe, not asserted), **T11/T13** (don't propose a new egress mechanism without checking the §3 sweep + primitives already exist), **T15** (self-application — place this very umbrella via host-push, dogfooding the rule), **T16** (pattern-on-name: "container can't push → must API" was the trap; the real fix is host-push, not API), **T19** (own cold-QA of the §1.4 revision before handoff — CI-green ≠ design-review).

**Domain-specific:**
- **T-EGR-A** — "fixing the container push is the obvious fix". Trap: it looks like an auth toggle. Counter: §2.2 evidence — it is a network block + missing toolchain + a security-boundary you should NOT widen. The fix is host-side, not container-side.
- **T-EGR-B** — "the sweep already runs, so API-default is fine, skip the rule". Counter: the sweep is a CI-*equivalent*, not the literal pre-push hook; the project invariant is "earliest reachable channel" — host-push runs the real hook earlier. Codify the default shift.

## §7 Gates (real checks, not vibe)

- **S1 gate:** `.claude/rules/egress-no-api-bypass.md` passes principle 09 (header present) + is grep-able for the two-channel rule; `npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts` green.
- **S2 gate:** `/harvest` §1.4 default block describes host-pull+push BEFORE the API block; the API block is explicitly labelled break-glass with a host-transport-dead precondition. `grep -n 'break-glass' .claude/skills/harvest/SKILL.md` returns the API block.
- **S3 gate (closure):** placed via host `git push` (the push ran `.husky/pre-push` — dogfood proof); `make self-audit` green; `done.md` written.

## §8 Invariant guard (in `done.md`)

Confirm `make self-audit` green, principles 17 (no-paid-LLM) + 21 (agnosticism) not regressed (cheap re-run of existing self-audit).

## §9 Carved out — do not pull in

- **Fixing the aif container network/auth** — explicitly rejected (§2.2/§2.3). Do not "make the container push".
- **Promoting the §3 sweep to a pre-push gate** — that is the `/harvest` skill's own promotion criterion; out of scope here unless an incident fires.
- **The egress-queue-probe lesson** (pre-dispatch probe must scan the aif task queue) — separate codification, see memory `feedback_inflight_probe_must_include_aif_queue`.

## §10 Closure

On S3 — `done.md` per CLAUDE.md "Umbrella closure convention": `# egress-host-push-default — DONE` · Final PR · Closed · Summary + proof the placement push ran `.husky/pre-push`.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
