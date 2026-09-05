/**
 * CLI dispatch entrypoint — invoked by the PostToolUse hook, or manually on demand.
 *
 * Usage: tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff-path> [--force]
 *
 * NOTE (kickoff §7, 2026-05-31): the PostToolUse hook layer is opt-IN — it invokes
 * this entrypoint ONLY when the kickoff's first line is `<!-- bridge: auto -->`.
 * The manual invocation above needs NO marker; the `bridge: skip` marker below
 * keeps serving this manual path (/dispatcher, /pipeline) unchanged. At the
 * library layer `buildKickoffSpec` defaults to requireAutoMarker: true — this
 * entrypoint is the ONE caller that opts out (`requireAutoMarker: false`),
 * because an explicit CLI invocation is itself the operator's consent.
 *
 * Behaviour:
 *   1. Build KickoffSpec from kickoff path (null → bridge: skip marker → exit 0)
 *   2. Check idempotency (dedup by content hash, TTL 24h) → if hit, exit 0.
 *      --force skips this check (deliberate re-dispatch of the same kickoff).
 *   3. Resolve backend (RUNTIME_BRIDGE_MODE env, probe available())
 *   4. Dispatch kickoff → record dedup entry ONLY on a real backend success.
 *      A ManualBackend fallback is NOT recorded: it created no autonomous task,
 *      so it must not block a later real retry once the blocker (e.g. a dirty
 *      worktree) is cleared. (qloop-ux-probe Finding B.)
 *   5. Output JSON hookSpecificOutput.additionalContext for CC PostToolUse contract
 *   6. On an ENVIRONMENTAL failure (quota_exceeded / unavailable / timeout /
 *      dispatch_failed) → fall back to ManualBackend + stderr warn
 *   7. On `spec_invalid` (the dispatch SPEC is wrong — the kickoff, or the
 *      configuration it requires; see isFallbackEligible) → ABORT. No fallback,
 *      no /tmp artefact, exit 2.
 *   8. On any non-BackendError (a defect in this code) → report on stdout as
 *      additionalContext and exit 1. Never a silent exit 0 (A5-4).
 *
 * Exit codes: 0 on every dispatch outcome the operator cannot fix by editing the
 * kickoff — including every fallback (non-blocking injection per
 * rule-enforcement-channel-selection §4 "injection, never gate"). 2 when the
 * dispatch spec itself is invalid (a `bridge-profile` marker naming no runtime
 * profile, or a missing RUNTIME_BRIDGE_AIF_PROJECT_ID). 1 on an UNEXPECTED
 * internal error — a non-BackendError throw, which is a defect in this code
 * rather than an outcome, and which exit 0 used to hide entirely (A5-4).
 *
 * The §4 contract is not weakened by that 2: the gate/injection split "turns on
 * the exit code" of the HOOK (rule §4), and .claude/hooks/runtime-bridge-dispatch.sh
 * captures this CLI's stdout in a command substitution, never inspects its status,
 * and `exit 0`s unconditionally — so a Write is never blocked. The non-zero code is
 * for the OTHER caller: /dispatcher, /pipeline and operators invoking the CLI
 * directly, where exit 0 was the whole defect. Same judgment cli/claim.ts already
 * makes ("a claim that silently failed is worse than no claim").
 *
 * @cc-only-rationale: PostToolUse hook entrypoint — but the logic is pure TS
 *   so also callable from portable test harness.
 */
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildKickoffSpec } from '../kickoff.js';
import { checkDedup, recordDispatch } from '../idempotency.js';
import { resolveBackend } from '../resolver.js';
import { ManualBackend } from '../ManualBackend.js';
import { BackendError, type BackendErrorCode } from '../backend.js';

/** True when --force is passed: skip the dedup check and re-dispatch deliberately. */
export function dispatchUsesForce(argv: readonly string[]): boolean {
  return argv.includes('--force');
}

/** First non-flag argument (the kickoff path) — lets --force sit anywhere in argv. */
export function resolveKickoffPath(argv: readonly string[]): string | undefined {
  return argv.find((a) => !a.startsWith('--'));
}

/**
 * Whether a dispatch via this backend should be recorded in the dedup log.
 * Real backend success → record (don't re-dispatch the same task). A 'manual'
 * fallback → DON'T record: it created no autonomous task and must not block a
 * later real retry once the underlying blocker is fixed (Finding B).
 */
export function shouldRecordDedup(backendName: string): boolean {
  return backendName !== 'manual';
}

/**
 * May a failure of this class degrade to ManualBackend?
 *
 * The fallback exists so a backend outage never leaves the operator stuck: the
 * kickoff lands in /tmp, they paste it, the work proceeds. That answer is only
 * correct when the KICKOFF IS FINE and the environment is not.
 *
 * `spec_invalid` inverts both halves. The operator is not stuck — a one-line
 * edit fixes it — and the fallback does not deliver what was asked: a kickoff
 * carrying `<!-- bridge-profile: X -->` requested a specific execution seat
 * (a specific model, a specific cost), and a /tmp file gets pasted into whatever
 * seat happens to be open. Degrading therefore reports success for work that did
 * not happen, which is the failure mode this split exists to remove
 * (.claude/rules/attention-is-not-a-mechanism.md §2 `#warning-nobody-reads`).
 *
 * The class is the SPEC, not the kickoff file alone: a missing
 * RUNTIME_BRIDGE_AIF_PROJECT_ID is the same shape — one line for the operator to
 * fix, and unsatisfiable by every backend until they do (E-3, #1597 ledger).
 *
 * An operator who genuinely wants the copy-paste artefact already has a
 * first-class way to ask for it — `RUNTIME_BRIDGE_MODE=manual` (resolver.ts:41-43)
 * selects ManualBackend outright, so no new escape flag is introduced here.
 */
export function isFallbackEligible(code: BackendErrorCode): boolean {
  return code !== 'spec_invalid';
}

/**
 * Optional doctor-heal preflight — "the dispatcher calls the doctor; the doctor heals."
 * If RUNTIME_BRIDGE_PREFLIGHT is set, run it before dispatch so the aif container base
 * is current (a stale base makes the agent branch off old code → false-`done` garbage;
 * see aif-doctor SKILL §3.4). The operator points it at the aif-doctor heal entrypoint,
 * e.g. `RUNTIME_BRIDGE_PREFLIGHT="bash ~/.claude/heal.sh"`.
 *
 * Ship-safe: NO-OP when the env var is unset (consumers without the script are
 * unaffected; no host path is hard-coded here — the dispatcher only knows "call the
 * doctor", the doctor owns what healing means). Non-blocking: a preflight failure
 * warns and dispatch proceeds — the base may already be fine, and the bridge's
 * contract is "never leave the operator stuck".
 */
export function runPreflight(env: NodeJS.ProcessEnv = process.env): void {
  const cmd = env['RUNTIME_BRIDGE_PREFLIGHT'];
  if (!cmd) return;
  try {
    const r = spawnSync('bash', ['-c', cmd], { encoding: 'utf8', timeout: 150_000 });
    if (r.stdout) process.stderr.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.status !== 0) {
      process.stderr.write(
        `[runtime-bridge] preflight exited ${r.status ?? 'signal'} — proceeding with dispatch anyway\n`,
      );
    }
  } catch (err) {
    process.stderr.write(`[runtime-bridge] preflight error: ${err} — proceeding with dispatch\n`);
  }
}

async function main(): Promise<void> {
  // First non-flag token = kickoff path, so `--force` may precede or follow it.
  const cliArgs = process.argv.slice(2);
  const kickoffPath = resolveKickoffPath(cliArgs);
  const force = dispatchUsesForce(cliArgs);
  if (!kickoffPath) {
    process.stderr.write('[runtime-bridge] dispatch.ts: no kickoff path provided\n');
    process.exit(0);
  }

  // ── Step 1: Build KickoffSpec ─────────────────────────────────────────────
  // requireAutoMarker: false — manual on-demand contract (kickoff §7 «everything
  // else stays manual»): /dispatcher, /pipeline and operators invoke this CLI on
  // unmarked kickoffs; the hook path is already auto-marker-gated in bash.
  let kickoff;
  try {
    kickoff = buildKickoffSpec(kickoffPath, { requireAutoMarker: false });
  } catch (err) {
    process.stderr.write(`[runtime-bridge] Failed to read kickoff ${kickoffPath}: ${err}\n`);
    process.exit(0);
  }

  if (!kickoff) {
    // bridge: skip marker — silent exit. (Manual-path opt-out only: the hook
    // layer never reaches here without a `bridge: auto` first line, kickoff §7.)
    process.exit(0);
  }

  // ── Step 2: Idempotency check (skipped under --force) ─────────────────────
  if (!force) {
    const priorHandle = checkDedup(kickoff.contentHash);
    if (priorHandle) {
      outputContext(
        `[runtime-bridge] Kickoff already dispatched (taskId=${priorHandle.taskId}, backend=${priorHandle.backend}) — skipping duplicate dispatch (pass --force to re-dispatch)`,
      );
      process.exit(0);
    }
  }

  // ── Step 2.5: Doctor heal preflight (the dispatcher calls the doctor) ─────
  // Ship-safe + non-blocking: NO-OP unless RUNTIME_BRIDGE_PREFLIGHT is set. The
  // operator points it at the aif-doctor heal entrypoint so the container base is
  // refreshed before dispatch (stale base → false-`done` garbage; aif-doctor §3.4).
  // Runs only past the dedup gate — i.e. when an actual dispatch is about to happen.
  runPreflight();

  // ── Step 3 + 4: Resolve backend + dispatch ────────────────────────────────
  let backend = await resolveBackend();
  let handle;

  try {
    handle = await backend.dispatch(kickoff);
  } catch (err) {
    // Auto-fallback to ManualBackend on every ENVIRONMENTAL BackendError —
    // unavailable, quota_exceeded, timeout, AND dispatch_failed (e.g. the
    // dirty-worktree guard). The bridge's contract is "never leave the operator
    // stuck": a backend failure degrades to copy-paste rather than a silent dead
    // end. `spec_invalid` is deliberately excluded (see isFallbackEligible):
    // there the kickoff is the defect, and degrading reports success for a
    // dispatch that never happened.
    // (AifHandoffBackend.dispatch best-effort deletes any half-created task
    // before throwing, so no orphan is left on the project.)
    if (err instanceof BackendError && !isFallbackEligible(err.code)) {
      // The kickoff is wrong, not the runtime. Abort: no ManualBackend artefact
      // (it would read as a successful dispatch), no dedup record, exit 2.
      const abort =
        `[runtime-bridge] ABORTED — the dispatch spec is invalid (the kickoff, or the ` +
        `configuration it requires), so no task was created and nothing was written to /tmp. ` +
        `Fix it (see below; the kickoff is ${kickoff.filePath}) and re-run.\n` +
        `[runtime-bridge] ${backend.name} (${err.code}): ${err.message}\n`;
      process.stderr.write(abort);
      // Also on stdout so the PostToolUse consumer sees it as additionalContext —
      // the hook forwards stdout and swallows this exit code by design.
      outputContext(
        `[runtime-bridge] ABORTED (${err.code}): ${err.message} — no aif task was created, ` +
          `no /tmp artefact written. Fix the spec (kickoff ${kickoff.filePath}, or the ` +
          `configuration named in the message above) and re-dispatch.`,
      );
      process.exit(2);
    }

    if (err instanceof BackendError) {
      process.stderr.write(
        `[runtime-bridge] ${backend.name} dispatch failed (${err.code}): ${err.message} — falling back to ManualBackend\n`,
      );
      backend = new ManualBackend();
      try {
        handle = await backend.dispatch(kickoff);
      } catch (manualErr) {
        process.stderr.write(`[runtime-bridge] ManualBackend dispatch failed: ${manualErr}\n`);
        process.exit(0);
      }
    } else {
      // A5-4 (#1597 ledger): an unexpected, non-BackendError throw — a shape or
      // programming error (the cited repro: _rest tolerates an empty body by
      // returning {}, so _resolveProfileId calls .filter on an object). This used
      // to write ONE stderr line and exit 0 with no additionalContext, and the
      // shipped hook redirects this CLI's stderr to a file and forwards only
      // stdout — so an auto-marked kickoff silently did not dispatch while its
      // author saw nothing but a successful Write. Report it on the channel that
      // is actually read, and exit non-zero for the direct callers (/dispatcher,
      // /pipeline, operators). The hook still never propagates this status, so
      // the "injection, never gate" contract is untouched.
      process.stderr.write(`[runtime-bridge] Dispatch error (unexpected): ${err}\n`);
      outputContext(
        `[runtime-bridge] UNEXPECTED internal error — NO task was dispatched and nothing was ` +
          `written to /tmp: ${err instanceof Error ? err.message : String(err)}. ` +
          `Re-run \`tsx <bridge>/src/cli/dispatch.ts ${kickoff.filePath} --force\` to see the ` +
          `full trace; do not treat the kickoff as dispatched.`,
      );
      process.exit(1);
    }
  }

  // ── Step 5: Record dedup (real backend only) + output additionalContext ───
  // A ManualBackend fallback produced no autonomous task; recording it would block
  // a legitimate retry for the full TTL once the blocker is cleared (Finding B).
  if (shouldRecordDedup(backend.name)) {
    recordDispatch(kickoff.contentHash, handle);
  }

  // Human-facing UI (the board), NOT the :3009 REST API (which returns raw JSON).
  const webBase = process.env['RUNTIME_BRIDGE_AIF_WEB_URL'] ?? 'http://localhost:5180';
  const projectId = process.env['RUNTIME_BRIDGE_AIF_PROJECT_ID'];
  const uiUrl = projectId ? `${webBase}/projects/${projectId}` : webBase;
  const msg =
    backend.name === 'manual'
      ? `[runtime-bridge] ManualBackend: kickoff written to /tmp/runtime-bridge-${handle.taskId}.md — paste into a new Claude Code session`
      : `[runtime-bridge] Dispatched to ${backend.name} (taskId=${handle.taskId}) — open the board: ${uiUrl}`;

  // Form guard (non-blocking; exit-0 contract preserved): an orchestration
  // meta-kickoff is NOT a single buildable task — aif investigates and halts
  // with ZERO code (live-confirmed 2026-05-31, task a4bdff98: $5.66, no code).
  // Warn so the operator re-dispatches a per-sub-wave implementation kickoff.
  if (backend.name !== 'manual' && isOrchestrationKickoff(kickoff)) {
    process.stderr.write(
      `[runtime-bridge] ⚠ ${kickoff.umbrellaName}/kickoff.md looks like an orchestration meta-kickoff ` +
        `(launch-table / stage-gates / multiple sub-waves), not a single buildable task. ` +
        `aif will likely produce ZERO code and halt. Dispatch a per-sub-wave implementation kickoff instead.\n`,
    );
  }

  outputContext(msg);
  process.exit(0);
}

/**
 * Heuristic: does this kickoff describe an orchestration plan (many sub-waves,
 * stage gates, dispatch instructions) rather than ONE buildable task? aif treats
 * the kickoff as an implementation spec — a meta-plan yields no code. Deterministic,
 * conservative (path marker OR ≥2 orchestration section markers).
 */
function isOrchestrationKickoff(kickoff: { umbrellaName: string; content: string }): boolean {
  if (kickoff.umbrellaName.endsWith('-meta-launch')) return true;
  const markers = [
    /^#+\s*§?\d*\.?\s*Launch-table/im,
    /^#+\s*§?\d*\.?\s*Stage gates/im,
    /\|\s*Sub-wave\s*\|/im,
    /Sub-wave dispatch instructions/im,
  ];
  return markers.filter((re) => re.test(kickoff.content)).length >= 2;
}

function outputContext(message: string): void {
  // CC PostToolUse contract: plain stdout is IGNORED; context must be JSON.
  // Source: code.claude.com/docs/en/hooks.md (verified 2026-05-22).
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: message,
    },
  };
  process.stdout.write(JSON.stringify(output) + '\n');
}

/**
 * True only when this file is the executed script (tsx/node dispatch.ts …),
 * not when imported for its named exports (tests import runPreflight etc.;
 * an import must be side-effect-free — under vitest a top-level main() hits
 * process.exit(0), which the runner turns into an unhandled rejection).
 * realpath both sides: worktrees/macOS /tmp reach this file via symlinks.
 */
function isDirectCliInvocation(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectCliInvocation()) {
  main().catch((err) => {
    // Same class as the non-BackendError branch above (A5-4): a silent exit 0
    // here would report a dispatch that never happened.
    process.stderr.write(`[runtime-bridge] Unhandled dispatch error: ${err}\n`);
    process.exit(1);
  });
}
