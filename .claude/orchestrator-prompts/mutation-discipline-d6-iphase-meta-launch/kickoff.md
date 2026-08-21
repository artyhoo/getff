# KICKOFF — mutation-discipline D.6 drift-check (I-phase) — meta-launch

> **Type:** I-phase-small (Mode SOLO). Single atomic commit, ~15 LOC, 3 files. Spec is fully fixed by merged R-phase #382 — no design judgment left.
> **Origin:** mutation-discipline umbrella, Stage 4 D.6. R-phase #382 (`docs/meta-factory/research-patches/2026-06-02-deps-hash-check-dup.md`) verdict (b) keep-both + drift-check. This implements that verdict's §6 fix path. Last residual before umbrella closure.
> **Base branch:** staging (NOT main — main is prod, manual promote only).
> **Branch:** `feat/deps-hash-drift-check`
> **Deliverable:** silent-drift guard for the two byte-identical `deps-hash-check.sh` copies (source `packages/core/hooks/` + dogfood `.claude/hooks/`).

---

## §1 The spec (read #382 §6 — but apply the corrected marker placement below; T3: verified against the live files)

Read `docs/meta-factory/research-patches/2026-06-02-deps-hash-check-dup.md §6` first. **Correction applied (file-evidence, not in #382 §6):** the two copies are *currently byte-identical* (`diff` → IDENTICAL, verified 2026-06-02). #382 §6's literal edits are asymmetric (4-line block to the dogfood copy, 1-line marker to the source) — applying them verbatim would make the files DIVERGE and the new byte-identity test would fail on its own first run. Byte-identity is the binding constraint (it is the whole mechanism of verdict (b)), so **both copies get the IDENTICAL marker block.** The `# spec:` line is harmlessly self-referential when present in the source copy — byte-identity is preferred over an asymmetric spec-pointer (a deliberate trade-off, not an oversight).

1. **BOTH `packages/core/hooks/deps-hash-check.sh` AND `.claude/hooks/deps-hash-check.sh`** — insert the SAME block immediately after the `#!/usr/bin/env bash` shebang (line 1), so both files stay byte-identical:
   ```bash
   #!/usr/bin/env bash
   # @dual-pair: deps-hash-check-dogfood
   # spec: packages/core/hooks/deps-hash-check.sh — packages/ copy is SOURCE (install.sh:261);
   # .claude/ copy is this repo's dogfood instance (settings.json:74). Kept byte-identical.
   # Consumer-facing UserPromptSubmit hook — D7=a (Wave 5.3).
   ... (rest of existing header unchanged) ...
   ```
2. **`packages/core/hooks/deps-hash-check.test.ts`** — add a new describe block asserting `readFileSync(packages-copy) === readFileSync(.claude-copy)` (the mechanical drift-check). Shape in patch §6.

**No deletions. No symlink. No changes to `install.sh` or `settings.json`.**

> **Verify before commit (T19):** after editing both files, run `diff packages/core/hooks/deps-hash-check.sh .claude/hooks/deps-hash-check.sh` — must report no differences. If they differ, the markers were applied asymmetrically; fix before the test run.

## §2 §4b PR-body mandate — NOT triggered

Target files: `.claude/hooks/deps-hash-check.sh`, `packages/core/hooks/deps-hash-check.sh`, `packages/core/hooks/deps-hash-check.test.ts`. None match the §4b load-bearing path list (`.claude/rules/`, `packages/core/principles/`, `CLAUDE.md`, `packages/core/templates/`, `.claude/skills/`, `agents/`, EXECUTION-PLAN, prior-art-evaluations). So the §1.7 Forward/Backward PR-body sections are NOT required. Standard PR body + the Prior-art trailer below.

## §3 Commit / PR

- Single atomic commit, all three edits.
- Trailer (verbatim from §6): `Prior-art: prior-art-evaluations.md#87 (worktree-create-setup dual-pair, SSOT BUILD — this commit extends the @dual-pair pattern with a second pair; no new mechanism introduced).`
- PR to `staging`.

## §4 Acceptance

- Both `.sh` copies carry `@dual-pair: deps-hash-check-dogfood`.
- `npm --prefix packages/core test -- deps-hash-check` green, including the new byte-identity assertion.
- Falsifier baked in: editing one copy without the other → the new test FAILS. Verify by temporarily appending a space to one copy and confirming red, then revert.

## §4c Fork discipline (if any ambiguity in §1 surfaces)

The §1 marker/byte-identity interaction is the one place this could fork. If §6's spec is internally inconsistent (asymmetric markers vs a whole-file identity assertion), do NOT pick a resolution silently — surface it as a question with both readings (Option A: identical marker blocks in both / Option B: identity test compares post-marker body only). Everything else is deterministic.

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md §2`)

Active for this I-phase: **T3, T5→N/A(this IS the I-phase), T13, T16, T19.**

- **T3 (no prose-only / read the source):** read #382 §6 directly; do not implement from this kickoff's paraphrase if it diverges from the patch.
- **T13/T16 (pattern-matching-on-name):** the two files are NOT "just duplicates" — one is shipped SOURCE (`install.sh:261`), one is the in-repo DOGFOOD copy (`settings.json:74`). The drift-check guards the source→dogfood sync, not a generic dedup. Verify roles hold before committing.
- **T19 (own QA before handoff):** run the falsifier in §4 (break-one-copy → red → revert) before pushing. CI green ≠ the test actually catches drift.

**Domain-specific:**
- **T-D6-A — "the new marker breaks the identity it asserts."** Tempted: add asymmetric markers, push, let CI find that the files are no longer byte-identical. Counter: the §1 verify-block — confirm marker symmetry (or post-marker-body comparison) makes the test pass on first run; this is a self-application of the very drift the test guards.

## §6 Recursive self-application

This I-phase ships the mechanical guarantee that the source/dogfood pair cannot silently drift — the same drift-discipline the whole umbrella establishes, applied to the umbrella's own delivery-channel artifact (`@dual-pair` per SSOT #87 / dual-implementation-discipline.md).

## §7 Stage gate (single stage → umbrella closure)

```bash
gh pr list --search "is:merged head:feat/deps-hash-drift-check base:staging" \
  --json number,title,mergedAt --limit 5
```

On merge → meta-orchestrator writes `done.md` + `project_mutation_discipline_umbrella_done.md` memory (§8 umbrella-done item 7).

## §8 Stop conditions

- §1 marker/byte-identity inconsistency in #382 §6 → park per §4c, do not guess.
- Any temptation to delete a copy / create a symlink / touch `install.sh` or `settings.json` → STOP (T17 + §6 verdict explicitly rejected those).
- New test red on first run for any reason other than the deliberate §4 falsifier → investigate before pushing.

## §9 See also

- `docs/meta-factory/research-patches/2026-06-02-deps-hash-check-dup.md` — binding spec (esp. §5 verdict + §6 fix path).
- `.claude/rules/dual-implementation-discipline.md §5` — `@dual-pair` convention.
- `docs/meta-factory/prior-art-evaluations.md` #87 — `worktree-create-setup` dual-pair precedent.
- `.claude/orchestrator-prompts/mutation-discipline-umbrella-meta-launch/state.md §0.4` — umbrella reconciliation.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
