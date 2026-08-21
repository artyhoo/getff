# KICKOFF — ship a PORTABLE aif base-refresh ("heal") helper to consumers

> **For:** a fresh CC session (cold start — this file is self-contained; you have NO memory of the session that wrote it).
> **Type:** single-concern I-phase + one shipped-code change (`install.sh`). One focused PR.
> **Base branch:** `staging` (NOT main). **PR via gh Data API** (git push is tunnel-blocked — see §5).
> **Origin:** 2026-06-14 session. The dispatcher-side seam already shipped (PR #502, merged). This PR ships the *consumer-facing* heal helper that seam points at — the maintainer's catch: "хелперы же тоже нужны консьюмеру" (consumers run aif too).

---

## §0 Context — why this exists (read first)

**The failure mode (live incident 2026-06-13):** the aif-handoff agent branches every task off its container's local `staging`. That base **cannot `git fetch`** (the proxy tunnel blocks `github.com:443` from inside the container) so it is hand-synced host→container and **drifts stale within days**. A task dispatched on a stale base branches off old code, does the wrong thing, and **false-marks itself `done`** (its auto-review false-passes). A dispatched `consumer-install-completeness` S3 task did exactly this — produced off-scope/empty diffs, marked `done`, nothing harvestable. Codified as **aif-doctor SKILL §3.4** (already on staging).

**Already shipped (PR #502, merged — do NOT redo):**
- `packages/runtime-bridge/src/cli/dispatch.ts` → `runPreflight()`: env-gated `RUNTIME_BRIDGE_PREFLIGHT`, runs after dedup / before backend-resolve, ship-safe NO-OP when unset, non-blocking. **"The dispatcher calls the doctor; the doctor heals."** + a test `packages/runtime-bridge/test/aif-dispatch-preflight.test.ts`.
- `.claude/skills/aif-doctor/SKILL.md` §3.4 (stale-base failure mode) + a §1 "Base currency" probe row.

**Operator-local scripts to PORT (currently `~/.claude/`, machine-specific — the maintainer's tunnel/docker):**
- `~/.claude/refresh-aif-base.sh` — gh-API real tip → fast no-op if container base already current → else: host gets objects (host current: `git bundle`; host stale: `~/.claude/sync-branch-from-api.sh` FF-only) → `docker cp` → container `git branch -f <branch> <real>` + tracking ref → verify; prints old SHA for reversibility.
- `~/.claude/heal.sh` — the doctor's entrypoint: in-flight guard (`/agent/status` `activeTaskCount==0`) → calls `refresh-aif-base.sh`. Non-blocking (always exit 0).

**Why consumers need this (the maintainer's correct catch):** `install.sh:343` copies `pipeline / dispatcher / aif-doctor / template-audit` skills to consumers, and `./setup` installs the runtime-bridge (`install.sh:337`). So **a consumer runs aif-handoff too** → their container base can also go stale → they need the heal. The `~/.claude/` scripts are tunnel-tuned and NOT shipped; this PR ships a **portable** version.

---

## §1 Goal (one line)

Ship an in-repo, **portable** base-refresh + heal pair under `.claude/skills/aif-doctor/helpers/`, wired into `install.sh` so consumers get it, that the already-shipped `RUNTIME_BRIDGE_PREFLIGHT` seam can point at — primary path uses a plain in-container `git fetch` (works for any consumer whose container reaches GitHub), with the host-bundle path as the tunnel/airgap fallback.

---

## §2 Scope (build these)

1. **`.claude/skills/aif-doctor/helpers/refresh-aif-base.sh`** (portable):
   - Resolve container generically: `C=${AIF_AGENT_CONTAINER:-$(docker ps --filter name=agent --format '{{.Names}}' | grep -i aif | head -1)}`; repo path `${AIF_CONTAINER_REPO:-/home/www/rules-as-tests-aif}`; branch arg (default `staging`). Graceful exit if no container.
   - Real tip via `gh api repos/<owner/repo>/git/refs/heads/<branch>` (derive repo from `git remote get-url origin`). Fast NO-OP if container base already == real tip.
   - **PRIMARY (portable, common consumer):** `docker exec $C git -C $REPO fetch origin <branch>` then `git branch -f <branch> origin/<branch>` — works when the container CAN reach GitHub.
   - **FALLBACK (tunnel/airgap — the maintainer's case):** if the in-container fetch fails → host-bundle path (the existing `~/.claude/refresh-aif-base.sh` logic): ensure host has objects (`~/.claude/sync-branch-from-api.sh` if host stale — keep this an OPTIONAL operator-local dep; degrade with a clear message if absent) → `git bundle` → `docker cp` → container `git branch -f` + tracking ref.
   - Verify container base == real; print old SHA for one-command revert. Non-destructive to task records/worktrees.
2. **`.claude/skills/aif-doctor/helpers/heal.sh`** (portable): in-flight guard (`curl -s $AIF_URL/agent/status | jq .activeTaskCount` == 0, else skip) → run `refresh-aif-base.sh`. Always exit 0 (non-blocking). `RUNTIME_BRIDGE_AIF_URL` default `http://localhost:3009`.
3. **`install.sh` wiring** (near `:343`, where it copies the companion skills): copy `helpers/heal.sh` + `helpers/refresh-aif-base.sh` into the consumer's `.claude/skills/aif-doctor/helpers/`, mark executable, and add a one-line "Next steps" hint that the consumer may `export RUNTIME_BRIDGE_PREFLIGHT='bash .claude/skills/aif-doctor/helpers/heal.sh'` to auto-heal before dispatch. **Keep it opt-in + degrading** (no companion made mandatory — that would be a goal change).
4. **`.claude/skills/aif-doctor/SKILL.md §3.4`** — update the Fix bullet's paths from `~/.claude/refresh-aif-base.sh` / `~/.claude/heal.sh` to the in-repo `.claude/skills/aif-doctor/helpers/` paths (keep `~/.claude/` mentioned as the operator's own copy if useful). Keep the "dispatcher calls doctor" wiring text.

---

## §3 Acceptance (executable)

- **Dogfood on this machine:** `bash .claude/skills/aif-doctor/helpers/heal.sh staging` → fast no-op when current; when the container base is behind, it refreshes and verifies (test by forcing the container base back: `docker exec aif-handoff-agent-1 git -C /home/www/rules-as-tests-aif branch -f staging <older-sha>` then re-run heal → it should restore to the real tip). Container `aif-handoff-agent-1`, aif at `localhost:3009`, projectId `441c1c0c-b633-4612-a34c-2cc0c4d0eaf2` (for any dispatch test).
- **Ship proof:** run `install.sh` into a `/tmp` consumer (as CI does — `bash install.sh ts-server`) and confirm the helpers landed at `<consumer>/.claude/skills/aif-doctor/helpers/heal.sh` (+ executable).
- **Portability proof:** the PRIMARY path is plain `git fetch` — assert the script does NOT hard-depend on `~/.claude/sync-branch-from-api.sh` (it's a fallback only; the script must still function for a consumer who has neither the tunnel nor that script).

---

## §4 Discipline gates (MUST satisfy)

- **§1.7 PR body** — `.claude/skills/**` is a watched path → the PR body MUST carry `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` (H3 headings, word "applied", ≥40 non-ws chars + ≥1 `file:line` citation each). The CI gate is strict (H2 silently fails). Pre-flight grep before `gh pr create`.
- **BFR / capability-commit** — new `.sh` files live under `.claude/skills/` (NOT `packages/`), so NOT a capability commit by the LOC rule; no new dependency. REUSE: the helper composes existing `git fetch` / `git bundle` / `docker` / the `/agent/status` probe — document this; the only operator-local dep (`sync-branch-from-api.sh`) is an optional fallback. Add `Prior-art: skipped — ...` (≥20 chars rationale) on the commit defensively.
- **dual-implementation-discipline (operator vs shipped axis)** — the shipped version must degrade gracefully when a companion/tunnel is absent ([.claude/rules/dual-implementation-discipline.md §3](../../rules/dual-implementation-discipline.md), [build-first-reuse-default.md §1.1](../../rules/build-first-reuse-default.md) shipped-axis). Integrate, never hard-depend; opt-in companion-install only.
- **no-paid-llm-in-ci** — bash/git/curl/docker only, zero API-billed calls.

---

## §5 Commit / push (tunnel-blocked — use gh Data API, like PR #502)

`git push` is blocked by the proxy tunnel; `api.github.com` works. Commit via the gh Git Data API onto `staging` parent (memory `feedback_diagnose_fix_remote_pr_via_gh_api`):
1. `PARENT=$(gh api repos/<repo>/git/refs/heads/staging --jq .object.sha)`; `BASETREE=$(gh api repos/<repo>/git/commits/$PARENT --jq .tree.sha)`.
2. blobs: `jq -n --rawfile c <file> '{content:$c,encoding:"utf-8"}' | gh api repos/<repo>/git/blobs --input - --jq .sha` per file.
3. tree (`base_tree` + entries, mode `100644`; **shell scripts → mode `100755`** so they're executable) → `gh api .../git/trees --input -`.
4. commit (parent=staging) → ref `refs/heads/aif-heal-portable` → `gh pr create --base staging` → `gh pr merge <N> --squash --auto` (create + merge in SEPARATE calls — git-safety hook blocks compound).
- Verify `gh api compare/staging...<branch> --jq '.files[].filename'` == exactly your changed files before PR.

---

## §6 Anti-scope

- Do NOT redo PR #502 (the `dispatch.ts` seam + §3.4 are already merged) — this PR only adds the helpers + install.sh wiring + the §3.4 path update.
- Do NOT hard-code `~/.claude/` paths or the maintainer's tunnel in the SHIPPED version (that was the original mistake; the shipped version is portable).
- Do NOT make a companion/aif mandatory for consumers (goal change per [README.md#why-this-exists](../../../README.md#why-this-exists)).
- Do NOT add an npm dependency or a new file ≥80 LOC under `packages/`.

## §7 AI-traps active (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

T3 (executable acceptance, not prose "ported"), T13/T16 (the SHIPPED helper is the subject — prove it lands in a consumer install + the primary git-fetch path works without the tunnel-fallback), T19 (own cold-QA: actually run heal.sh against a forced-stale container before claiming done; CI's self-install jobs run WITHOUT `--full` and do NOT test heal). Domain: **T-HEAL-A — "shipped a tunnel-tuned script"**: if the portable version still requires `~/.claude/sync-branch-from-api.sh` to function at all, it's not portable — the fetch-primary path must stand alone.

## §8 See also (verify, don't trust this file blindly)
- PR #502 (merged) — the dispatcher seam + §3.4. `gh pr view 502`.
- `~/.claude/refresh-aif-base.sh` + `~/.claude/heal.sh` — the operator-local originals to port.
- memory `reference_aif_dispatch_projectid` — projectId, dispatch env, stale-base lesson, the helper.
- `.claude/skills/aif-doctor/SKILL.md` §3.4 + §1 — the codified failure mode.
- `.gitignore:14` — `done.md` is the only tracked file under `orchestrator-prompts/*/` (this kickoff is NOT tracked).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
