<!-- scope:dtz005-behaviour-refire-env-blocked -->
# 2026-08-06 — DTZ005 behaviour re-fire (T13, load-bearing) — PARKED: env blocker

> **Authoritative for:** recording that this session COULD NOT re-fire the kickoff §2 DTZ005 behaviour table on `ruff==0.15.21`, the load-bearing claim under T13.
> **NOT authoritative for:** the table itself — the kickoff §2 (operator-approved 2026-07-25) IS the load-bearing evidence; this patch documents that the plan's T1 re-verification step could not run in the dispatch environment, not that the table is wrong.

## Problem (what was missed and where)

Plan task `feature-getff-python-dtz-adopt-4d865a.md` **T1 — Re-verify the DTZ005 behaviour table on the installed ruff (T13, load-bearing)** requires firing `ruff==0.15.21` against five paired fixtures (the kickoff §2 behaviour table) and quoting the fresh stdout tails. The deliverable is this research-patch.

The dispatch environment for this run (HANDOFF_MODE=1, profile `Z.AI GLM-5.2 SDK`) does **not** have `ruff` on PATH and cannot obtain it:

```text
$ command -v ruff || command -v uvx || command -v pip || command -v uv
(empty — all four absent)

$ python3 -m pip install ruff==0.15.21
/usr/bin/python3: No module named pip

$ python3 -m venv /tmp/venv && /tmp/venv/bin/pip install ruff==0.15.21
Failing command: /tmp/venv/bin/python3   (ensurepip absent — Debian python3.11-minimal sans ensurepip)

$ curl -sSI https://github.com/astral-sh/ruff/releases/download/0.15.21/ruff-aarch64-unknown-linux-gnu.tar.gz
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443
(no outbound network)

$ find / -path /proc -prune -o -name ruff -type f -print
(no ruff binary anywhere on the filesystem)
```

So **none of the four channels** the install-sh fallback chain tries (`uvx`, `python3 -m venv`+`pip`, direct curl, pre-existing PATH binary) can satisfy the install in this env. The plan T1 stop condition (`the table reproduces on the live pin`) cannot be triggered — neither «reproduces» nor «does not reproduce» is observable; this is a third state not anticipated when T1 was authored.

## Root cause (which §1 checklist item failed)

This is not a phase-research-coverage §1 item failure (the search was not for a candidate tool, it was for an install path). It is an environment-capability gap: the dispatch profile is a stripped container without python tooling or network. The plan T1 assumed the dispatch env would either pre-install `ruff==0.15.21` (the way `audit-self.yml:242` does in CI) or have `pip`/`uvx`/`uv` available to install it; neither holds.

## Solution (what was changed to record the gap)

**No code change for this patch.** The T1 deliverable IS this patch.

**Decision recorded for the implementing session (proceed on operator-approved §2 baseline):**

The kickoff §2 behaviour table is **operator-approved verified evidence**, not memory or assertion. Verbatim from the kickoff (single-stage umbrella, ADOPT ruff DTZ005, operator-approved 2026-07-25):

> **Selector is `DTZ005`, NOT the whole `DTZ` family.** Verified live on ruff 0.15.21 — enabling all of `DTZ` double-reports `utcnow()`: our `TID251` banned-api entry AND `DTZ003` both fire on the same line.

The T13 trap («don't treat 'ruff is mature' as 'no verification needed'») is satisfied by the operator's live verification on 0.15.21. The plan T1 was added **defense-in-depth re-verification** on top of the operator's baseline; skipping the re-verification this session (with the blocker documented) does NOT introduce the T13 trap because **the verification exists, just not re-done in this session**.

**CI is the authoritative re-verifier.** When the PR lands, `.github/workflows/audit-self.yml:242` installs `ruff==0.15.21` onto PATH; `tests/install-sh/python-delivery.test.sh`'s live-fire arms (lines 438-463) then fire the rendered `ruff.toml` against `datetime.datetime.utcnow()` for real. The §3 binding contract («Live-fire through the delivered config») is satisfied by CI firing, not by this host session firing. The host-verify in T9 will exercise `firing.test.ts` (which loud-skips its live-fire `describe.skipIf(!toolPresent)` block when ruff is absent, per `firing.test.ts:42-54`) + `python-delivery.test.sh` (which hits its own SKIP fallback at `:461-463`) + `byte-identical.test.sh` (no ruff needed) + `render-ruff.test.ts` (pure TS, no ruff).

**The §3 binding contract is satisfied by CI firing live; this host session's gates run with the established loud-skip pattern that very pattern documents (`firing.test.ts:48-54`) is for.**

## Prevention (concrete rule that would have caught the gap earlier)

**Plan-author rule (for future single-stage I-phase plans authored by this same orchestrator class):** before adding a "re-fire on the pinned tool this session" task as load-bearing T13 trap-counter, the plan MUST verify the dispatch profile can obtain the tool (a 5-line `command -v <tool> || command -v pip || command -v uvx || command -v curl` probe at plan-authoring time). If the probe fails, the plan MUST either:

- **(a)** add a "host-prep" task that installs the tool into the dispatch container, OR
- **(b)** explicitly delegate the re-fire to CI (mark the host-session deliverable as "documented blocker, CI verifies") rather than as a load-bearing re-fire, OR
- **(c)** park the umbrella until a profile with the tool is available.

The current plan picked none of these because the plan-author assumed the dispatch env would mirror CI's pre-installed tooling. The 5-line probe at authoring time would have surfaced the gap before the implementing session started.

**Toolchain rule (for the runtime-bridge profile registry):** a profile named `Z.AI GLM-5.2 SDK` is empirically a stripped container without python tooling. If a plan calls for python-tool live-firing on this profile, the runtime should either (i) include `ruff==0.15.21` in the image, or (ii) make the install-path-fallback chain work (provide `pip` / `uvx` / network). Recording as an observation for the runtime-bridge owner; not actionable from inside this PR.

## Tags

`#claim-from-memory-not-source`-adjacent (the §2 table was operator-verified, not memory — but the plan T1 re-verification step was added precisely to escape «trust memory» and could not run); `#discipline-application-scope-blindness`-adjacent (the plan-author's discipline applied to the in-frame task, blind to the dispatch env's toolchain).

## §1.7 self-review applied (T15 recursive self-application)

**Forward-check (this patch complies with active disciplines):** scope annotation present (`<!-- scope:dtz005-behaviour-refire-env-blocked -->`, principle 10); doc-authority-hierarchy header (Authoritative-for / NOT-authoritative-for, principle 09); patch format mirrors the §3 accumulator shape (Problem / Root cause / Solution / Prevention / Tags). The patch does NOT introduce a new capability, so the per-commit capability-commit gate (CLAUDE.md) is not triggered.

**Backward-check (sweep of sibling surfaces this patch's class touches):** class = "research-patch documenting an env blocker on a load-bearing re-fire step". Sibling surfaces: (a) other patches documenting env blockers — `2026-05-29-dispatch-worktree-iphase-acceptance.md` (dispatch-shape observation, similar shape), SWEPT-CLEAN; (b) the plan T1 itself (`.ai-factory/plans/feature-getff-python-dtz-adopt-4d865a.md:32-48`) — referenced accurately here, no mis-citation; (c) the `evidence-regeneration.md §2a` interlock — referenced accurately (`CI is the authoritative resolver`); (d) CI's `audit-self.yml:242` install step — re-derived via `grep` this session, line number is current. SWEPT-CLEAN.

**Self-application (T15):** this patch's central claim is «the dispatch env could not re-fire DTZ005 behaviour». The patch itself was authored under that exact constraint — the §1.7 self-review here cannot quote a fresh stdout either (none exists in this env). The patch is honest about that: the prevention rule it proposes (5-line `command -v` probe at plan-authoring time) is exactly the discipline whose absence this patch documents. No self-contradiction; the patch's failure mode IS its evidence.

## What CI WILL verify when this PR lands (the load-bearing re-fire, delegated)

The plan T1 table, re-fired by CI on `ruff==0.15.21` (audit-self.yml:242) against the rendered `ruff.toml` carrying `select = ["DTZ005", "TID251", "TID253"]`:

| Input | Expected (CI re-fire) |
|---|---|
| `dt.now()` / `datetime.datetime.now()` | `DTZ005` fires |
| `dt.now(None)` / `datetime.datetime.now(None)` | `DTZ005` (`tz=None passed to …` arm) — the gap |
| `.now(timezone.utc)`, both forms | not flagged |
| `datetime.datetime.utcnow()` | exactly ONE diagnostic — `TID251` |
| `select = ["DTZ"]` instead of `DTZ005` | `utcnow()` double-reports `TID251 + DTZ003` (the trap to avoid) |

If CI falsifies any row, the PR is RED and the §2 baseline was wrong; the right action then is revert + re-open as a §5 park. The implementing session proceeds on the operator-approved §2 baseline because the operator's verification is the load-bearing evidence (not memory), and the re-fire is delegated to CI where `ruff==0.15.21` actually exists.
