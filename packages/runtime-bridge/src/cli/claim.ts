/**
 * CLI claim entrypoint — the operator/skill-facing half of two-phase dispatch.
 *
 * Usage:
 *   tsx packages/runtime-bridge/src/cli/claim.ts create <kickoff-path>
 *   tsx packages/runtime-bridge/src/cli/claim.ts release <taskId>
 *   tsx packages/runtime-bridge/src/cli/claim.ts cancel  <taskId>
 *
 * Why a separate entrypoint from dispatch.ts: dispatch.ts is a PostToolUse hook
 * entrypoint and therefore exits 0 on EVERY path (injection, never gate). A claim is
 * the opposite contract — it is invoked by `/pipeline` §6 Step 3 and by operators, and
 * a claim that silently failed to be created is strictly worse than no claim at all
 * (the stage would then be dispatched believing the lane was probed clean). So this
 * entrypoint exits NON-ZERO on failure and never falls back to ManualBackend: a
 * backend with no queue cannot hold a claim, and pretending otherwise would be the
 * `#hope-as-gate` shape (attention-is-not-a-mechanism.md §2).
 *
 * `create` prints the TaskHandle as one line of JSON on stdout so a caller can capture
 * the taskId; human-facing narration goes to stderr.
 *
 * Deliberately NOT idempotency-checked (unlike dispatch.ts): the claim IS the
 * de-duplication mechanism — `probe-inflight.sh` reads live claims out of the queue —
 * so layering the 24h content-hash dedup on top would suppress a legitimate re-claim
 * after a cancelled Phase -1.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildKickoffSpec } from '../kickoff.js';
import { resolveBackend } from '../resolver.js';
import { supportsClaims } from '../backend.js';
import type { RuntimeBackend } from '../backend.js';
import type { CancelOutcome } from '../AifHandoffBackend.js';
import type { TaskHandle } from '../types.js';

export type ClaimVerb = 'create' | 'release' | 'cancel';

/** Parse `<verb> <arg>` out of argv, rejecting anything else. */
export function parseClaimArgs(
  argv: readonly string[],
): { verb: ClaimVerb; arg: string } | { error: string } {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const [verb, arg] = positional;
  if (verb !== 'create' && verb !== 'release' && verb !== 'cancel') {
    return { error: `unknown verb ${verb ? `"${verb}"` : '(none)'} — expected create|release|cancel` };
  }
  if (!arg) {
    return {
      error:
        verb === 'create' ? 'create needs a kickoff path' : `${verb} needs a taskId`,
    };
  }
  return { verb, arg };
}

/**
 * Narrow a resolved backend to a claim-capable one, or explain why not.
 * Loud on purpose — see the module docblock on why there is no manual fallback.
 */
export function requireClaimBackend(backend: RuntimeBackend): { error: string } | null {
  if (supportsClaims(backend)) return null;
  return {
    error:
      `backend "${backend.name}" cannot hold a claim (no queue to claim in). ` +
      `Set RUNTIME_BRIDGE_MODE=aif-handoff and make sure aif answers on RUNTIME_BRIDGE_AIF_URL, ` +
      `or run the stage without the claim protocol (and accept the Phase -1 race).`,
  };
}

/** Handle shim for the release/cancel verbs, which are given a bare taskId. */
export function handleFromTaskId(taskId: string): TaskHandle {
  return { backend: 'aif-handoff', taskId, dispatchedAt: new Date().toISOString() };
}

/** A backend that can say WHY a cancel did not happen, not just that it did not. */
interface CheckedCanceller {
  cancelClaimChecked(handle: TaskHandle): Promise<CancelOutcome>;
}

/** Capability probe, same shape as `supportsClaims` — optional by construction. */
export function supportsCheckedCancel(backend: unknown): backend is CheckedCanceller {
  return typeof (backend as Partial<CheckedCanceller>).cancelClaimChecked === 'function';
}

/**
 * Turn a cancel outcome into what the operator is told, and what the shell sees.
 *
 * A5-1 (#1597 ledger): the old branch printed «cancelled claim <id> — lane is
 * free» for any DELETE that returned 2xx. aif-handoff's DELETE removes the row
 * and nothing stops the worker, so on a RELEASED task that line was false in the
 * most expensive direction available: the worker kept running headless, the lane
 * stayed occupied, `probe-inflight.sh` saw nothing, and the stage was free to be
 * re-dispatched on top of itself (live, 2026-09-02). Backend-side the delete is
 * now refused; here the refusal has to READ as a refusal — a non-zero exit and a
 * line that never contains «lane is free».
 */
export function describeCancelOutcome(
  taskId: string,
  outcome: CancelOutcome,
): { text: string; exit: 0 | 1 } {
  if (outcome.cancelled) {
    return { text: `[runtime-bridge] cancelled claim ${taskId} — lane is free\n`, exit: 0 };
  }
  if (outcome.reason === 'running') {
    return {
      text:
        `[runtime-bridge] claim ${taskId} was NOT cancelled — the task is live (${outcome.detail}), ` +
        `not a paused claim. aif-handoff cannot stop a running worker (its task API exposes no ` +
        `stop/abort event), so deleting the record would drop the row while the worker keeps going ` +
        `headless — the lane stays taken and probe-inflight sees nothing. Stop the work on the aif ` +
        `board first, or let it finish; do NOT report the stage as cancelled.\n`,
      exit: 1,
    };
  }
  if (outcome.reason === 'unverifiable') {
    return {
      text:
        `[runtime-bridge] claim ${taskId} was NOT cancelled — its state could not be read ` +
        `(${outcome.detail}), and a task that cannot be shown to be idle is not safe to delete: a ` +
        `running worker survives the delete. Check the task on the aif board.\n`,
      exit: 1,
    };
  }
  return {
    text:
      `[runtime-bridge] claim ${taskId} could NOT be deleted (${outcome.detail}) — the lane is ` +
      `still taken. Delete it from the aif board, or leave it to age into STALE-CLAIM; do not ` +
      `report the stage as cancelled.\n`,
    exit: 1,
  };
}

async function main(): Promise<void> {
  const parsed = parseClaimArgs(process.argv.slice(2));
  if ('error' in parsed) {
    process.stderr.write(`[runtime-bridge] claim: ${parsed.error}\n`);
    process.exit(2);
  }

  const backend = await resolveBackend();
  const unsupported = requireClaimBackend(backend);
  if (unsupported) {
    process.stderr.write(`[runtime-bridge] claim: ${unsupported.error}\n`);
    process.exit(1);
  }
  if (!supportsClaims(backend)) return; // unreachable; narrows for the type checker

  try {
    if (parsed.verb === 'create') {
      // requireAutoMarker:false for the same reason dispatch.ts opts out — an
      // explicit CLI invocation is itself the operator's consent (kickoff §7).
      const kickoff = buildKickoffSpec(parsed.arg, { requireAutoMarker: false });
      if (!kickoff) {
        process.stderr.write(
          `[runtime-bridge] claim: ${parsed.arg} carries a \`bridge: skip\` marker — nothing claimed\n`,
        );
        process.exit(1);
      }
      const handle = await backend.claim(kickoff);
      process.stderr.write(
        `[runtime-bridge] claimed "${kickoff.umbrellaName}" as paused task ${handle.taskId} ` +
          `— run Phase -1, then \`claim.ts release ${handle.taskId}\` on GO or ` +
          `\`claim.ts cancel ${handle.taskId}\` on RED\n`,
      );
      process.stdout.write(JSON.stringify(handle) + '\n');
    } else if (parsed.verb === 'release') {
      await backend.release(handleFromTaskId(parsed.arg));
      process.stderr.write(`[runtime-bridge] released claim ${parsed.arg} — coordinator picks it up\n`);
    } else {
      const handle = handleFromTaskId(parsed.arg);
      // Prefer the reporting form when the backend has it: «could not delete» and
      // «refused to delete a live task» are different answers and need different
      // operator moves (A5-1). A backend without it keeps the boolean contract.
      const outcome: CancelOutcome = supportsCheckedCancel(backend)
        ? await backend.cancelClaimChecked(handle)
        : (await backend.cancelClaim(handle))
          ? { cancelled: true, reason: 'deleted' }
          : { cancelled: false, reason: 'delete-failed', detail: 'DELETE did not succeed' };
      const { text, exit } = describeCancelOutcome(parsed.arg, outcome);
      process.stderr.write(text);
      if (exit !== 0) process.exit(exit);
    }
  } catch (err) {
    process.stderr.write(`[runtime-bridge] claim ${parsed.verb} failed: ${err}\n`);
    process.exit(1);
  }
  process.exit(0);
}

/**
 * True only when this file is the executed script, not when imported for its named
 * exports (an import must be side-effect-free — under vitest a top-level main() hits
 * process.exit, which the runner turns into an unhandled rejection).
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
    process.stderr.write(`[runtime-bridge] Unhandled claim error: ${err}\n`);
    process.exit(1);
  });
}
