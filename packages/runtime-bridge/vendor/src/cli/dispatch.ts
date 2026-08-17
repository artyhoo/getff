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
 *   6. On quota_exceeded / unavailable → fall back to ManualBackend + stderr warn
 *
 * Exit codes: 0 always (non-blocking injection per rule-enforcement-channel-selection
 * §4 "injection, never gate" contract).
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
import { BackendError } from '../backend.js';

/** True when --force is passed: skip the dedup check and re-dispatch deliberately. */
export function dispatchUsesForce(argv: readonly string[]): boolean {
  return argv.includes('--force');
}

/** First non-flag argument (the kickoff path) — lets --force sit anywhere in argv. */
export function resolveKickoffPath(
  argv: readonly string[],
): string | undefined {
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
    const r = spawnSync('bash', ['-c', cmd], {
      encoding: 'utf8',
      timeout: 150_000,
    });
    if (r.stdout) process.stderr.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.status !== 0) {
      process.stderr.write(
        `[runtime-bridge] preflight exited ${r.status ?? 'signal'} — proceeding with dispatch anyway\n`,
      );
    }
  } catch (err) {
    process.stderr.write(
      `[runtime-bridge] preflight error: ${err} — proceeding with dispatch\n`,
    );
  }
}

async function main(): Promise<void> {
  // First non-flag token = kickoff path, so `--force` may precede or follow it.
  const cliArgs = process.argv.slice(2);
  const kickoffPath = resolveKickoffPath(cliArgs);
  const force = dispatchUsesForce(cliArgs);
  if (!kickoffPath) {
    process.stderr.write(
      '[runtime-bridge] dispatch.ts: no kickoff path provided\n',
    );
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
    process.stderr.write(
      `[runtime-bridge] Failed to read kickoff ${kickoffPath}: ${err}\n`,
    );
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
    // Auto-fallback to ManualBackend on ANY BackendError — unavailable,
    // quota_exceeded, timeout, AND dispatch_failed (e.g. the dirty-worktree
    // guard). The bridge's contract is "never leave the operator stuck": any
    // backend failure degrades to copy-paste rather than a silent dead end.
    // (AifHandoffBackend.dispatch best-effort deletes any half-created task
    // before throwing, so no orphan is left on the project.)
    if (err instanceof BackendError) {
      process.stderr.write(
        `[runtime-bridge] ${backend.name} dispatch failed (${err.code}): ${err.message} — falling back to ManualBackend\n`,
      );
      backend = new ManualBackend();
      try {
        handle = await backend.dispatch(kickoff);
      } catch (manualErr) {
        process.stderr.write(
          `[runtime-bridge] ManualBackend dispatch failed: ${manualErr}\n`,
        );
        process.exit(0);
      }
    } else {
      // Non-BackendError (programming bug) — log and exit without dispatching.
      process.stderr.write(`[runtime-bridge] Dispatch error: ${err}\n`);
      process.exit(0);
    }
  }

  // ── Step 5: Record dedup (real backend only) + output additionalContext ───
  // A ManualBackend fallback produced no autonomous task; recording it would block
  // a legitimate retry for the full TTL once the blocker is cleared (Finding B).
  if (shouldRecordDedup(backend.name)) {
    recordDispatch(kickoff.contentHash, handle);
  }

  // Human-facing UI (the board), NOT the :3009 REST API (which returns raw JSON).
  const webBase =
    process.env['RUNTIME_BRIDGE_AIF_WEB_URL'] ?? 'http://localhost:5180';
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
function isOrchestrationKickoff(kickoff: {
  umbrellaName: string;
  content: string;
}): boolean {
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
    process.stderr.write(`[runtime-bridge] Unhandled dispatch error: ${err}\n`);
    process.exit(0);
  });
}
