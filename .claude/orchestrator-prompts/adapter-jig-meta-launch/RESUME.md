# adapter-jig J2 — PARK / RESUME state (2026-07-22, night-mode)

> Parked on operator request (quota). Everything below is durably committed on branch
> `worktree-adapter-jig-j2` (based on `origin/staging` @ `06174f286`). A fresh session resumes
> from HEAD of that branch. NO PR opened, NOTHING merged, umbrella NOT closed (no done.md).

## Where the work is
- **Branch:** `worktree-adapter-jig-j2` — 9 commits ahead of origin/staging (`git log --oneline origin/staging..HEAD`).
- **Worktree:** `.claude/worktrees/pipeline-ecosystem-wiring-696c01` (this dir).
- **Binding spec:** `docs/superpowers/specs/2026-07-22-adapter-jig-design.md` (on staging). §3 = 22 arms; §2 = frozen F1-F11; §9 J2/J3.
- **Decisions log (15 resolved technical forks, 0 owner forks):** `.claude/orchestrator-prompts/adapter-jig-meta-launch/j2.decisions.md`
- **Meta-launch kickoff + state:** same dir, `kickoff.md` + `state.md`.

## J2 — DONE (committed, 8 of 10 increments)
REG · A · B(+1 review round) · H · G · D · E · C — the 22-arm registry frame + 20 of 22 arms
landed, each RED-before-GREEN paired. **8 real fix+arm-atomic bugs found by the retrofit-run:**
- A1: `packages/core/detector/read-manifest.ts:19` unguarded `JSON.parse` → `resolveCtxForRoot` threw on malformed package.json.
- H×2: census-regex fixes (`ecosystem-unwired-debt.test.ts`).
- D×2: cargo lane — silent fingerprint degrade (`setup.d/46-cargo.sh` `_cargo_write_rules_lock`) + F11 core-set violation in shipped cargo lock.
- E×2: RED-only firing self-checks + python `_ruffcfg` consumer-first config fallback (`setup.d/45-python.sh:421`).
- C×1: loud orphan-residue report on refresh.

## J2 — REMAINING (resume here)
1. **P increment** (arm P1 `pinned-toolchain-in-ci` — F10 two-surface pin parity, getff-shipped tools only per decisions #11). Was in flight when parked; NOT committed. Recon plan: `scratchpad/recon-group-P.json` (if scratch survives; else re-recon from spec §3.6).
2. **FIN increment:** flip registry meta-check to `count===22`; author `docs/meta-factory/research-patches/2026-07-22-adapter-jig-j2-drift-probe.md` (DN-J1 = TRIVIAL, per-lane glue — measured evidence in `scratchpad/recon-drift.json`); verify every new `tests/install-sh/*.test.sh` is wired in `.github/workflows/audit-self.yml`; run full local gates (vitest + tsc + snapshot compare + touched bash tests).
3. **Two-altitude whole-work review** of the entire J2 diff + own cold-review via `agents/adapter-jig-reviewer.md`.
4. **merge-forward** fresh `origin/staging` into the branch (picks up #1088 cargo-demo flake fix; files disjoint — no conflict expected).
5. **PR base=staging** with §1.7 Forward/Backward-check body (paths trigger the mandate — `packages/core/principles/**`, `.claude/rules/**` not touched but `packages/core/**` + `setup.d/**` + `.github/workflows/**` are). Monitor CI to green. Squash-merge (agent pre-authorized on staging).

## Resume recipe
```bash
cd .claude/worktrees/pipeline-ecosystem-wiring-696c01
git status                                  # confirm on worktree-adapter-jig-j2, clean
git log --oneline origin/staging..HEAD      # confirm 9 (or more if P/FIN landed) commits
npx --prefix packages/core vitest run principles/33-adapter-jig-arm-registry.test.ts  # registry state
# then finish P + FIN per REMAINING above, review, merge-forward staging, PR, merge.
```

## Known heads-up
- CI-log name collision: cargo-demo test has its own arm labelled "D3" (see merged PR #1088). Our jig arm is also D3 (`lock-schema-parity`). If a `D3` failure appears, disambiguate by file. FIN/review should give jig arms unique `@arm: AJ-<id>` slugs (recorded as a MINOR to apply).
- If full-suite run flakes on `demo.test.ts` "D3: paired-negative expected +0 not to be +0" → that's the pre-#1088 flake; merge-forward staging fixes it.

## J3 (NOT started — fresh full-quota session, Tier-2)
go family stamp — adapter `ecosystem-go.ts` + delivery `setup.d/47-go.sh` + golangci-lint CI arm + scratch red/green, ONE atomic PR, BASELINE lockstep, zero frozen-row edits. Gated on J2 merge + Phase -1. Hard node: go Tier-1 host-derivation (module-path-as-host vs the URL-metadata model frozen contract F3 assumes, spec §2.1) + go.mod direct-vs-indirect (arm B3). Start as Tier-2 (top-tier plans). Full DoD: spec §9 J3 + umbrella kickoff §1 J3.
