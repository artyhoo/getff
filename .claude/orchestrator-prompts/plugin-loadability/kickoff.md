# plugin-loadability — umbrella kickoff

> **Type:** fix umbrella (dispatch input). Has-build (touches `plugin/`, `.claude-plugin/`, `agents/`, `packages/core/principles/24-*`).
> **Authoritative for:** scope of the «make the shipped CC plugin actually load» fix — P1 manifest placement, P2 broken agent frontmatter, P3 strengthen the plugin self-test that missed both; stage gates; carve-outs (§8).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The plug-packaging branch S2–S8 roadmap (separate, 113 commits behind staging) — see operator notes `roadmap-state.md`.
> **Base branch:** `staging` (NOT `main` — manual promote).
> **Origin:** plan-currency-reconcile S1 deeper works-verify, 2026-06-28. The plugin payload is on `main` (18 files, #673) but **does not load**: CC's own validator (`claude plugin tag --dry-run plugin`) rejects it. Two defects + a self-test coverage-gap that let both pass. Evidence: operator-notes `S1-RECONCILE-2026-06-28.md` §Plugin-loadability finding.

---

## §1 Goal (one sentence)

The shipped CC plugin **loads in current Claude Code** — `claude plugin tag --dry-run plugin` passes (today it fails), all shipped skills/agents/commands/hooks register, and the plugin's own rule-as-test (`principle 24`) is **strengthened so it would have caught both defects** (closing the T14 presence-theatre gap that is itself the deepest finding).

## §2 Fixed decisions (do not re-litigate without cause)

1. **CC's own validator is the acceptance arbiter, not internal tests.** The bug exists precisely because `principle 24` + `bootstrap.test.sh` are GREEN while `claude plugin tag --dry-run plugin` FAILS. The mechanical gate `claude plugin tag --dry-run plugin` exit 0 is the load-truth (CC-native, deterministic, zero paid-LLM per [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)). Internal tests must be made to **agree** with it (P3), never to override it.
2. **P3 is non-optional and ships in the SAME umbrella as P1/P2.** Fixing the two defects without closing the test-gap = `#fix-without-closing-the-gap` (§6 T-PL-A) — the next regression slips through identically. The on-thesis deliverable is the strengthened test, not just the two fixes.
3. **No new paid mechanism.** P3 strengthens an existing deterministic principle test (real YAML parse + manifest-location assertion). No LLM-in-CI.

## §3 Stages

| Stage | Deliverable | Depends on |
|---|---|---|
| **S1** | **P3 first (TDD):** strengthen `principle 24` so it FAILS on the current tree (real YAML-parse of every frontmatter; assert manifest lives where CC resolves it for the declared `source`). Red proves the gap was real. | — (start) |
| **S2** | **P1 manifest** — relocate so `claude plugin tag --dry-run plugin` passes (likely `.claude-plugin/plugin.json` → `plugin/.claude-plugin/plugin.json`; OR marketplace `source: .`). Update `principle 24` `MANIFEST` path + any `install.sh`/`fetch-and-wire.sh` refs. | S1 (test now asserts location) |
| **S3** | **P2 frontmatter** — quote the `description:` in `agents/living-docs-auditor.md` so YAML parses; regenerate the byte-identical `plugin/agents/` copy (principle-24 (d) drift guard). | S1 (test now YAML-parses) |
| **S4** | **Green gate:** `principle 24` GREEN again (now meaningfully) + `claude plugin tag --dry-run plugin` exit 0 + `bootstrap.test.sh` green + `make self-audit` green. | S2 ∥ S3 |

**Order:** S1 (red test) → (S2 ∥ S3) → S4 (all green). TDD: the strengthened test must be RED before the fixes, GREEN after.

## §4 Detail per defect (evidence from S1-RECONCILE)

- **P1 — manifest misplaced.** `marketplace.json` → `source: ./plugin`, but `plugin.json` is at repo-root `.claude-plugin/`. CC at that source expects `plugin/.claude-plugin/plugin.json` (absent). Proof: `claude plugin tag --dry-run plugin` → `✘ No plugin manifest found. Expected …/plugin/.claude-plugin/plugin.json`. Fix to whichever layout makes the validator pass (the gate decides; do NOT guess — run it).
- **P2 — broken agent YAML.** `(plugin/)agents/living-docs-auditor.md` `description:` is an unquoted scalar containing `: ` → parse fails «mapping values are not allowed here» → agent loads with empty metadata. Proof: `claude plugin tag --dry-run .` + `python3 -c 'import yaml; yaml.safe_load(fm)'`. Fix: quote the value (block scalar `>` or double-quote). Both root `agents/` and `plugin/agents/` copies (byte-identical) must end consistent.
- **P3 — self-test gap.** `packages/core/principles/24-plugin-manifest-integrity.test.ts` V3/V4 use `frontmatterHas()` = regex `^name:`/`^description:` (presence), not YAML parse; and `MANIFEST = resolve(REPO_ROOT, '.claude-plugin')` is hard-coded (never asserts CC's `source`-relative resolution). Strengthen: (a) replace regex frontmatter check with real YAML parse (fail on parse error); (b) assert the manifest sits where CC resolves it for the marketplace `source`. Keep the principle-02 paired-negative (broken fixture stays RED) so the strengthened gate is non-tautological.

## §5 Build-first-reuse (see [build-first-reuse-default.md](../../rules/build-first-reuse-default.md))

- **No capability-commit / no new dependency.** P1/P2 are edits; P3 strengthens an existing test. The YAML parser is already a dev-dep (used elsewhere). The load-truth check (`claude plugin tag`) is CC-native — **REUSE**, not build. Consult SSOT only if a new module ≥50-80 LOC appears (it should not).

## §6 AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active canonical traps:** **T2** (strengthen the test ≠ run it — actually run `claude plugin tag --dry-run plugin` and the RED→GREEN principle-24, paste output), **T3** (every claim = command + output, esp. the validator verdict), **T14** (this whole bug is «green test ≠ works»; a clean run after the fix means nothing unless coverage is real — keep the paired-negative), **T15** (self-application: principle-24 is the project's own rule-as-test; strengthening it IS the recursive fix — it must fail on a deliberately-broken fixture), **T16** (don't assume `claude plugin tag` passing == «skills actually activate»; it validates manifest+frontmatter, not runtime activation — state that boundary honestly).

**Domain-specific:**
- **T-PL-A — `#fix-without-closing-the-gap`.** Tempted to fix P1+P2 (validator goes green) and skip P3 because «it works now». Counter: P3 is §2 decision 2 — non-optional, same umbrella. The deliverable that matters is the test that would have caught this.
- **T-PL-B — `#strengthen-into-new-theatre`.** Replacing presence-regex with another shallow check (e.g. «file exists») instead of a real YAML parse + CC-resolution assertion → a new presence-theatre. Counter: P3 acceptance = the strengthened test is RED on the pre-fix tree (proven before S2/S3), GREEN after; paired-negative fixture stays RED.

## §7 Stage gates (real checks, not vibe)

- **S1 gate:** strengthened `principle 24` is **RED on the current (pre-fix) tree** — `npm --prefix packages/core run test:principles -- 24` shows the new assertions failing on P1+P2. (If it's green pre-fix, the strengthening is theatre — T-PL-B.)
- **S2 gate:** `claude plugin tag --dry-run plugin` → exit 0, no «No plugin manifest found». Paste the output.
- **S3 gate:** `python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]).read().split("---")[1])' plugin/agents/living-docs-auditor.md` → no error; `diff agents/living-docs-auditor.md plugin/agents/living-docs-auditor.md` → identical (drift guard).
- **S4 gate:** `principle 24` GREEN + `bootstrap.test.sh` PASS + `claude plugin tag --dry-run plugin` exit 0 + `make self-audit` green. All four, pasted.

## §8 Carve-outs (not this umbrella)

- The `plug-packaging` branch S2–S8 roadmap (skeleton, 113 behind staging) — separate effort; this umbrella fixes the #673 payload already on `main`/`staging`.
- Stale `plug-packaging` branch «Proprietary» README residue — that is plan-currency-reconcile S3, not here.
- Live-session smoke (skills actually auto-activate in a running CC) — out of scope; `claude plugin tag` + strengthened principle-24 are the mechanical bound. Note the boundary (T16), don't claim runtime activation.

## §9 §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) (validator + YAML parse are deterministic, zero API), [build-first-reuse-default.md](../../rules/build-first-reuse-default.md) (REUSE — no new capability), [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md) (§6 cites + enumerates + adds 2 domain traps).
- **Backward-check:** codifies the 2026-06-28 plugin-loadability finding; the P3 strengthening supersedes the presence-regex frontmatter check in `principle 24` (a scope-narrowing of what counts as «valid», made stricter, not a new artifact).

## §10 Closure

On last-stage merge — `done.md` per [CLAUDE.md «Umbrella closure convention»](../../../CLAUDE.md): `# plugin-loadability — DONE` · Final PR · Closed · Summary.

> **Dispatch note (per [kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)):** this kickoff must be merged to `staging` BEFORE `/pipeline plugin-loadability` or any aif dispatch — a kickoff living only on a feature branch is invisible to the dispatch session (which runs on `staging`).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
