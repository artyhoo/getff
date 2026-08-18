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
import type { TaskHandle } from '../types.js';

export type ClaimVerb = 'create' | 'release' | 'cancel';

/** Parse `<verb> <arg>` out of argv, rejecting anything else. */
export function parseClaimArgs(
  argv: readonly string[],
): { verb: ClaimVerb; arg: string } | { error: string } {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const [verb, arg] = positional;
  if (verb !== 'create' && verb !== 'release' && verb !== 'cancel') {
    return {
      error: `unknown verb ${verb ? `"${verb}"` : '(none)'} — expected create|release|cancel`,
    };
  }
  if (!arg) {
    return {
      error:
        verb === 'create'
          ? 'create needs a kickoff path'
          : `${verb} needs a taskId`,
    };
  }
  return { verb, arg };
}

/**
 * Narrow a resolved backend to a claim-capable one, or explain why not.
 * Loud on purpose — see the module docblock on why there is no manual fallback.
 */
export function requireClaimBackend(
  backend: RuntimeBackend,
): { error: string } | null {
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
  return {
    backend: 'aif-handoff',
    taskId,
    dispatchedAt: new Date().toISOString(),
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
      const kickoff = buildKickoffSpec(parsed.arg, {
        requireAutoMarker: false,
      });
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
      process.stderr.write(
        `[runtime-bridge] released claim ${parsed.arg} — coordinator picks it up\n`,
      );
    } else {
      const gone = await backend.cancelClaim(handleFromTaskId(parsed.arg));
      if (!gone) {
        process.stderr.write(
          `[runtime-bridge] claim ${parsed.arg} could NOT be deleted — the lane is still taken. ` +
            `Delete it from the aif board, or leave it to age into STALE-CLAIM; do not report the ` +
            `stage as cancelled.\n`,
        );
        process.exit(1);
      }
      process.stderr.write(
        `[runtime-bridge] cancelled claim ${parsed.arg} — lane is free\n`,
      );
    }
  } catch (err) {
    process.stderr.write(
      `[runtime-bridge] claim ${parsed.verb} failed: ${err}\n`,
    );
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
