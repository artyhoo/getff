# Egress no-API-bypass — host-push-default discipline rule

> **Class:** B — compensating mechanism without a CI test: the discipline is about **egress channel choice at harvest time** (which `git push` channel a finished aif-agent branch lands through), and a branch-scoped CI run cannot assert "this branch was landed via the host pre-push hook rather than the Git-Data-API". The compensating mechanism is the [/harvest](../skills/harvest/SKILL.md) §1 procedure (host-push default, API break-glass) + the existing [`scripts/run-local-ci-sweep.sh`](../../scripts/run-local-ci-sweep.sh) gate-substitute on the break-glass path. Promotion criterion in §4.
> **Fires:** harvesting/egressing a finished aif-agent branch to a PR.
> **Authoritative for:** the egress channel-preference rule — §1 the two channels (host-push default / API break-glass), §2 trigger, §3 mechanism + why the container cannot push, §4 promotion / retirement, §5 §1.7 self-reflexive note.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). The egress primitives themselves (`harvest.ts`, `harvest-via-api.sh`) — owned by `packages/runtime-bridge` + [/dispatcher](../skills/dispatcher/SKILL.md). The harvest procedure surface — owned by [/harvest §1](../skills/harvest/SKILL.md) (this rule sets the channel preference that §1 implements). CI tool-pinning (a different egress surface) — see [ci-tool-pinning.md](ci-tool-pinning.md).

> **Origin:** 2026-06-27 operator dialogue. The [/harvest](../skills/harvest/SKILL.md) skill (#729) §1 step 4 "Push channel" prescribed **Git-Data-API land (`harvest-via-api.sh`) as the DEFAULT egress channel** ("container is a runtime, not a push env → land via API"). The operator flagged this as a **pre-push-gate bypass**: API-land creates the commit + ref server-side, so the local `.husky/pre-push` hook never runs (verified: `harvest-via-api.sh` = 9× `gh api`, 0 real `git push`). The project thesis is "every rule fails at the earliest reachable channel — edit → pre-commit → **pre-push** → CI"; an API-default egress silently skips the pre-push channel. Umbrella kickoff: `.claude/orchestrator-prompts/egress-host-push-default/kickoff.md` (#754).

## §1 The rule — two channels, host-push is the default

**Channel A — DEFAULT: host-pull + host `git push` (runs the real pre-push gate).**

Egress of a finished aif-agent branch lands by **pulling the container's committed branch to the host, rebasing onto live `origin/staging`, and `git push`-ing from the host**:

1. Read the agent's `branchName` + commit from the aif task; bring that commit to the host (e.g. `git -C <container-worktree> bundle create` → `docker cp` → host `git fetch <bundle>`).
2. `git fetch origin` + `git rebase origin/staging` on the host (the host carries the cost the API-land avoided — keeping the branch rebased on live staging).
3. `git push origin <branch>` **from the host**. The host has working transport + the full pre-push toolchain (`gh` / `actionlint` / `zizmor`), so `.husky/pre-push` runs for real — the **earliest reachable gate** for this work.

This is the default because the project invariant is "earliest reachable channel": host-push runs the literal pre-push hook before the PR exists; nothing later (CI, audit) is a substitute for the channel that fires first.

**Channel B — BREAK-GLASS ONLY: Git-Data-API land (`harvest-via-api.sh`).**

Used **solely when the host transport is ALSO dead** (no working `git push` from the host either). When taken, it is **not a free pass**: `scripts/run-local-ci-sweep.sh` is the mandatory gate-substitute (it runs the CI-equivalent checks the skipped pre-push would have run), plus the clobber check (`harvest-via-api.sh` builds on the live remote tree — confirm no shared file drifted past the fork). The API path skips the literal pre-push hook by construction (server-side commit), so it is the channel of last resort, not the default.

## §2 Trigger

The **harvest step** — egress of a finished aif-agent branch out of its container to a PR on `staging`. Fires whenever a `/harvest` (or equivalent manual egress) is about to choose a push channel.

## §3 Mechanism + why the container cannot push

The container **cannot push** — and that is a **feature, not a bug** (do NOT "fix the container push"):

- **Network block, not auth.** Verified 2026-06-27: `curl https://github.com` from `aif-handoff-agent-1` → CONNECT FAILED at 0.000s (TCP never opens); `api.github.com` → HTTP 200; `gh` not installed in-container. So "fix the push" would mean fixing a fragile tunnel network path, not flipping an auth flag.
- **Missing pre-push toolchain.** The container lacks `gh` / `actionlint` / `zizmor`, so even if it could push, its `.husky/pre-push` could not fully run anyway.
- **Security boundary.** A sandboxed autonomous-agent container being unable to push to the repo **widens the trust boundary if "fixed"**. The host is the correct trusted integration boundary — the operator admits the work (aligns with the aif-doctor "container is a runtime, not a push env" classification).

The procedure that implements §1 lives in [/harvest §1](../skills/harvest/SKILL.md) (host-pull + rebase + host-push as the default block; API-land demoted to the labelled break-glass block). This rule sets the **preference**; the skill owns the **steps**.

## §4 Promotion / retirement

- **Promotion to Class A (gate):** add a harvest-preflight or pre-push check asserting the API path (`harvest-via-api.sh`) is taken **only after a host-transport-dead probe succeeds** (e.g. a `git ls-remote origin` from the host fails) — so an API-land without a recorded host-transport-failure is a gate violation. Fires when a "API-land used while host transport was alive" incident is observed, OR the harvest surface grows a second consumer of the API path.
- **Retirement:** 12 consecutive months with zero "API-default / pre-push-bypass" incidents → archive to prose in [CLAUDE.md](../../CLAUDE.md). Matches peer-rule retirement criteria ([reviewer-discipline.md §4](reviewer-discipline.md), [ci-tool-pinning.md §6](ci-tool-pinning.md)).

## §5 §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (the mechanism is plain `git fetch`/`rebase`/`push` + the existing deterministic `run-local-ci-sweep.sh` — zero API-billed calls); [build-first-reuse-default.md §1](build-first-reuse-default.md) (REUSE/ADAPT verdict — reorders an existing procedure's channel preference, builds no new egress engine; the host-pull mechanism is stdlib git); [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (this file carries Class + Authoritative-for header and is registered in principle 09 `REQUIRED_HEADER_DOCS`); [dual-implementation-discipline.md §7](dual-implementation-discipline.md) (this rule and [/harvest §1](../skills/harvest/SKILL.md) describe the SAME two channels — single source of truth, the skill is the procedure, this rule is the preference).
- **Backward-check:** codifies the 2026-06-27 incident (`/harvest` §1 step 4 defaulting to API-land, skipping the pre-push channel); the companion `/harvest` §1 revision enforces the fix (host-push default, API break-glass-labelled). Orthogonal to [ci-tool-pinning.md](ci-tool-pinning.md) (that rule governs CI-tool install pinning in `.github/workflows/`; this rule governs the egress push channel) — no contradiction. Self-applies: this very umbrella's PR is landed via host `git push` (running `.husky/pre-push`), dogfooding the rule.

## See also

- [/harvest §1](../skills/harvest/SKILL.md) — the egress procedure implementing this rule's channel preference (host-push default, API break-glass).
- [`scripts/run-local-ci-sweep.sh`](../../scripts/run-local-ci-sweep.sh) — the CI-equivalent gate-substitute mandatory on the break-glass path.
- [`packages/runtime-bridge/src/cli/harvest.ts`](../../packages/runtime-bridge/src/cli/harvest.ts) + [`.claude/skills/dispatcher/helpers/harvest-via-api.sh`](../skills/dispatcher/helpers/harvest-via-api.sh) — the egress primitives.
- [ci-tool-pinning.md](ci-tool-pinning.md) — sibling CI-discipline rule (different surface).
- [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) — hard constraint the egress mechanism satisfies.
- `.claude/orchestrator-prompts/egress-host-push-default/kickoff.md` — origin umbrella kickoff (#754).
