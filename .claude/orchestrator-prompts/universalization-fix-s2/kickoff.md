# universalization-fix-s2 — wire shipped-but-inert layout-universalization verify-gates into pre-push

> Scope: orchestrator-drafted kickoff (gitignored — no Authoritative-for header required per
> doc-authority-hierarchy.md §2 "Not required for: Gitignored files"). Drafted 2026-06-14 from
> maintainer arg: `universalization-fix-s2 — Mode A wiring, check-rule-globs → pre-push, rest in kickoff`.
> Authoritative scope = THIS file once approved. Predecessor lineage: consumer-install-hardening (CIH) S3 #486.

## 0. One-line

CIH-S3 (#486) shipped two **layout-universalization verify-gates** to consumers but never wired them into
the pre-push hook — they only fire if a human manually runs them. For a "no check → no rule, fail at the
earliest reachable channel" framework, a gate that never auto-fires is **inert**. s2 wires them in.

## 1. Problem (code-grounded)

The two gates are CIH-S3's "+V" alarms against silent-inertness across consumer project layouts
(flat / layered / monorepo):

| Gate | What it catches | Shipped to consumer? | npm script? | In `validate`? | In pre-push? |
|---|---|---|---|---|---|
| `check-rule-globs.sh` | custom ESLint rule's `files` globs match ZERO source → rule silently inert | ✅ `install.sh:461` → `scripts/` | ✅ `check:globs` (`install.sh:697`) | ✅ (`install.sh:698`) | ❌ **never** |
| `check-lintstaged-resolves.sh` | lint-staged command's binary won't resolve in consumer's pnpm layout → blocked commit | ✅ `install.sh:465` → `scripts/` | ❌ **none** | ❌ **none** | ❌ **never** |

Both gates exist (`packages/core/audit-self/`), both ship, **neither auto-fires on a consumer's push**.
`check-lintstaged-resolves` is the more inert of the two (no script entry at all). This is the exact
"looks armed, checks nothing" failure each gate's own header warns about — applied recursively to the gates.

**Why this is "universalization":** these gates are the consumer-layout-robustness alarms. They are
*fundamentally consumer-side* — `check-rule-globs` reads the consumer's installed `eslint.config.mjs`
RULE_GLOBS; the maintainer repo has **no** root `eslint.config.mjs` (RULE_GLOBS live only in shipped
templates: `templates/ts-server/eslint.config.mjs`, `packages/preset-next-15-canonical/templates/...`).

## 2. Interpretation of the maintainer arg (confirm or correct)

- **"check-rule-globs → pre-push"** → wire `scripts/check-rule-globs.sh` into the pre-push flow. ✅ explicit.
- **"Mode A wiring"** → read as: wire into the **TS-core ("Mode A") arm** `packages/core/hooks/pre-push.ts`
  (the primary arm; the bash `pre-push.fallback.sh` is the degraded Node<20 arm). The phrase also matches
  the orchestrator's own Mode-A dispatch directive — either reading lands on the same TS-core insertion.
  **If "Mode A" meant something else, correct before dispatch.**
- **"rest in kickoff"** → the sibling gate `check-lintstaged-resolves` + its parity script (Batch B).

## 3. Wiring mechanism (precedent-locked)

`pre-push.ts:484-489` already wires a shipped bash gate exactly the way we need — copy this shape:

```ts
// ── 3b. Skill drift check ──
if (existsSync(resolve(REPO_ROOT, 'scripts/check-skill-drift.sh'))) {
  const r = run('bash', ['scripts/check-skill-drift.sh']);
  if (r.exitCode !== 0) die('❌ skill drift check failed', r);
  emit(r);
}
```

The `existsSync('scripts/check-rule-globs.sh')` guard is **load-bearing**: the script is installed at
`scripts/` only in *consumer* repos (`install.sh:461`). In the **maintainer repo** there is no
`scripts/check-rule-globs.sh` → the new section auto-skips → the maintainer's own push is **never** blocked
by a consumer-only gate. On a fresh consumer skeleton the script self-returns exit 0 ("no source yet").

## 4. Batches (for orchestrator Phase 2 — file-lock aware)

| # | Change | File(s) | Risk | File-lock |
|---|---|---|---|---|
| **A** | Wire `check-rule-globs.sh` into TS-core pre-push (existsSync guard + run + die-on-nonzero + emit) | `packages/core/hooks/pre-push.ts` | low | shares pre-push.ts with B1 → same worker |
| **B1** | Wire `check-lintstaged-resolves.sh` into TS-core pre-push (same shape) | `packages/core/hooks/pre-push.ts` | low | with A |
| **B2** | Add `check:lintstaged` npm script + include in `validate` (parity with `check:globs`) | `install.sh` (~L697-698) | low | parallel-safe |
| **C** | *(optional, DN-3)* Fallback-arm parity for both gates | `packages/core/hooks/pre-push.fallback.sh` | low | parallel-safe |
| **D** | Tests: assert new sections fire-when-shipped / skip-when-absent + run suite | `tests/hooks/*` | med | after A/B1 (or TDD-first) |

A + B1 edit the same file → **one worker, sequential**. B2, C independent → parallel-eligible.

## 5. Decision points (resolve before/at dispatch)

- **DN-1 (exit-2 handling):** `check-rule-globs.sh` exits **2** when `eslint.config.mjs` is absent. In an
  installed consumer the config exists; absence = genuinely broken consumer config.
  *Recommend:* treat any non-zero (incl. 2) as `die` (block), mirroring skill-drift — a broken installed
  config is a real problem. *Alt:* treat exit 2 as skip (graceful) if we want max non-blocking. **Maintainer call.**
- **DN-2 (check-lintstaged in `validate`):** add `check:lintstaged` to the `validate` aggregate too, or
  pre-push-only? *Recommend:* both (full parity with `check:globs`). **Maintainer call.**
- **DN-3 (fallback parity, Batch C):** `pre-push.fallback.sh` is **deliberately critical-only**
  (`criticalForFallback: true` → only trailer-presence checks). The layout gates are not trailer-critical.
  *Recommend:* **skip C** — keep the fallback minimal; Node<20 consumers retain the manual `npm run check:globs`.
  Add to `criticalForFallback` only if maintainer wants Node<20 auto-firing. **Maintainer call.**

## 6. Discipline / guardrails

- **NOT a capability commit:** wiring existing shipped scripts into a hook + adding package.json script
  entries + tests adds no new dependency and no new ≥50/80-LOC file under a new `packages/core/<dir>`.
  Prior-art trailer = escape hatch: `Prior-art: skipped — wiring-only, wires existing CIH-S3 verify-gates
  into pre-push, no new capability.` (≥20 chars, specifies why).
- **dual-implementation-discipline:** pre-push.ts is the SSOT arm; fallback parity is DN-3 (the fallback is
  intentionally a critical-only subset — not an automatic parity obligation).
- **Recursive self-application (invariant 2):** wiring a consumer-layout alarm so it actually fires is the
  framework dogfooding its own "no check → no rule" thesis on the gates themselves.
- **PR scope:** single concern = "wire the shipped layout-universalization gates into pre-push". Explicitly
  OUT: new install.sh layout fixes (done #511), mutation-gate wiring, any gate *logic* changes.
- **T-traps active (per ai-laziness-traps.md §2):** T3 (every finding file:line-backed), T15 (self-application
  — the gates auditing themselves), T19 (own cold-QA before handoff — run the real pre-push, don't trust CI shape).

## 7. Verify (Worker REPORT must include)

1. `grep -n check-rule-globs packages/core/hooks/pre-push.ts` → section present.
2. `grep -n check-lintstaged packages/core/hooks/pre-push.ts` → section present (if B1 in scope).
3. Maintainer-repo push not blocked: new sections skip (no `scripts/check-rule-globs.sh` here) — prove via a
   pre-push test run / dry section invocation.
4. Consumer-shape proof: in a fixture/temp consumer with `scripts/check-rule-globs.sh` present + a config whose
   active rule matches zero files → the new section FAILS the push (alarm fires).
5. `npm run check:all` (or the pre-push test suite) green.
6. Commit format + Prior-art escape-hatch trailer present.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
