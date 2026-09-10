/**
 * Per-test-file setup: SCRUB host state out of `process.env` before any test module loads.
 *
 * WHY THIS EXISTS (incident 2026-09-09, staging @ 7ad05c385b). Every hook test spawns the
 * shipped hook as `spawnSync('bash', [HOOK], { env: { ...process.env, ...a few pins } })`.
 * The pins cover only what each individual test happens to care about; every OTHER knob the
 * hook reads was inherited from whatever shell invoked vitest. CI's shell carries none of
 * them, so CI was green by accident of environment rather than by construction, while the
 * same suite went RED on the maintainer's machine — 16 failures out of 1465:
 *
 *   - `AIF_HANDOFF_GATE=1` armed the D13 handoff-currency gate inside the D7 context-arm
 *     tests. The gate then legitimately REPLACES the context line
 *     (.claude/hooks/end-of-turn-reminder.sh:426, D21), so 13 assertions matching
 *     /\[context\]/ received the `[handoff-gate]` block instead.
 *   - `CLAUDE_CODE_AUTO_COMPACT_WINDOW=300000` reached `f10c-floor-none`, the golden case
 *     whose entire premise is "neither the env nor settings.json declares a compaction
 *     point". The hook derived floor = 300000 x 67% = 201000 and blocked, exactly as it
 *     should have for that environment.
 *
 * Neither was a defect in the hook: both are the hook obeying host configuration the test
 * never meant to supply. The fix belongs at the harness, not at the assertions — a
 * per-assertion patch closes one leak and leaves the class open (there are ~147
 * `{ ...process.env }` spreads across packages/core).
 *
 * CONTRACT: a test that WANTS one of these variables sets it explicitly on the child env.
 * That still works — the spread reads the scrubbed `process.env`, then the explicit pin
 * wins. What can no longer happen is a variable arriving without a test asking for it.
 *
 * Drift is gated by hooks/env-hermeticity.test.ts, which re-derives the knob set from the
 * shipped hook trees and fails on anything the tables do not classify. Without that gate
 * the tables are a `#hope-as-gate` artefact (.claude/rules/attention-is-not-a-mechanism.md §2).
 *
 * Registered in BOTH vitest configs: packages/core/vitest.config.ts and the repo-root one,
 * because pre-push runs individual packages/core files from the repo root.
 */
import { scrubHostEnv } from './vitest.host-env.ts';

scrubHostEnv(process.env);
