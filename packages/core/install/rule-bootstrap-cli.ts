#!/usr/bin/env -S npx tsx
/**
 * rule-bootstrap-cli.ts — install-time entry for the rule-bootstrapping SKELETON spike.
 *
 * Invoked behind the `--full` carrier (session-bound, NEVER the CI self-install path)
 * to run: stub-research → generate.ts factory → install() → rules-lock.json, on the
 * react-next stack. Deterministic — no network, no LLM (principle 17, $0-in-CI).
 *
 * SHARED ENTRY: this CLI is what an install-time gate calls. The EXACT gate placement
 * (a standalone `setup.d/NN-*.sh` step vs a guarded branch in `setup.d/99-finalize.sh`)
 * is a PARKED design fork — see the kickoff §6. This CLI is the unambiguous dependency
 * of BOTH placements, so it is built here without deciding the fork. A FULL-gated,
 * node-present, degrade-on-absence shell block is sketched in the README banner below.
 *
 *   # --- ready-to-wire shell block (placement PARKED — do not enable without GO) ---
 *   if [ -n "${FULL:-}" ] && [ "$DRY_RUN" != "--dry-run" ] && command -v node >/dev/null 2>&1; then
 *     _rb="$PKG_ROOT/packages/core/install/rule-bootstrap-cli.ts"
 *     [ -f "$_rb" ] && ( cd "$PROJECT_ROOT" && npx --no-install tsx "$_rb" \
 *         --consumer-root "$PROJECT_ROOT" 2>&1 ) || true   # rc=0: never abort install
 *   fi
 *   # -------------------------------------------------------------------------------
 *
 * @cc-only-rationale: install-time orchestration script run in consumer context after
 *   --full dep-install; the bash gate is the primary gatekeeper, this CLI is the payload.
 *
 * Prior-art: prior-art-evaluations.md#183 (rule-research→rule-factory bridge BUILD;
 *   #798 §11). Re-grep the next-free id at commit time per kickoff §4.
 */

import process from 'node:process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runRuleBootstrap } from '../synthesizer/rule-bootstrap.ts';
import {
  FileResearchClient,
  FileGenerateClient,
  withManualDrop,
} from '../synthesizer/file-clients.ts';
import { ResearchPlanError } from '../research/validate-plan.ts';

interface Args {
  consumerRoot: string;
  force: boolean;
  strict: boolean;
  fromResearch?: string;
  fromSelection?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { consumerRoot: process.cwd(), force: true, strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--consumer-root') args.consumerRoot = argv[++i] ?? args.consumerRoot;
    else if (a === '--no-force') args.force = false;
    else if (a === '--strict') args.strict = true;
    else if (a === '--from-research') args.fromResearch = argv[++i];
    else if (a === '--from-selection') args.fromSelection = argv[++i];
    else if (a === '-h' || a === '--help') {
      process.stdout.write(
        'Usage: rule-bootstrap-cli [--consumer-root <path>] [--from-research <plan.json>] [--from-selection <sel.json>] [--no-force] [--strict]\n',
      );
      process.exit(0);
    } else if (!a.startsWith('-')) args.consumerRoot = a;
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Live path requires BOTH files; one-only is an authoring error.
  const oneOnly = Boolean(args.fromResearch) !== Boolean(args.fromSelection);
  if (oneOnly) {
    process.stderr.write(
      'rule-bootstrap-cli: --from-research and --from-selection must be passed together\n',
    );
    process.exit(args.strict ? 1 : 0);
  }

  const live = Boolean(args.fromResearch && args.fromSelection);
  const clients = live
    ? {
        researchClient: new FileResearchClient(args.fromResearch as string),
        generateClient: withManualDrop(new FileGenerateClient(args.fromSelection as string)),
      }
    : {};

  try {
    const result = await runRuleBootstrap({
      consumerRoot: args.consumerRoot,
      force: args.force,
      ...clients,
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (args.strict) {
      const ok = result.mode === 'synthesis' && result.install.ok;
      if (!ok) process.exit(1);
    }
  } catch (err) {
    // Decision B: a malformed/unreadable live artefact degrades with guidance, never a bad rule.
    const why = err instanceof ResearchPlanError ? err.message : (err as Error).message;
    process.stderr.write(
      `[rule-bootstrap] live research artefact invalid or unreadable — ${why}\n` +
        `[rule-bootstrap] run the rule-research protocol (agents/rule-researcher.md or the ` +
        `rule-research skill) to (re)author the two files, then re-run ./setup --full.\n`,
    );
    process.exit(args.strict ? 1 : 0); // rc=0: never abort install (the bash gate also || true's)
  }
}

/**
 * True when this module is the process entry point (executed directly, not imported).
 *
 * Realpath-normalizes BOTH sides before comparing. `argv1` is the path as-passed to the
 * runtime (logical — `install.sh` derives PKG_ROOT via `pwd`, which preserves symlinks),
 * while `metaUrl` is the path as tsx/node resolve it (realpath). A single symlink component
 * anywhere in the framework checkout path — macOS `/tmp`→`/private/tmp`, `mktemp` under
 * `/var/folders`, a symlinked `$HOME` or CI checkout dir — desyncs the two strings, so a
 * literal `import.meta.url === \`file://${argv1}\`` compare silently returns false and
 * `main()` never runs: `--full` exits 0 with zero synthesized rules. Normalizing both to
 * their realpaths closes that gap regardless of the caller's path (issue #910). Falls back
 * to a decoded literal compare if realpath fails (e.g. the entry no longer exists on disk).
 */
export function isDirectRun(argv1: string | undefined, metaUrl: string): boolean {
  if (!argv1) return false;
  const metaPath = fileURLToPath(metaUrl);
  try {
    return realpathSync(argv1) === realpathSync(metaPath);
  } catch {
    return metaPath === argv1;
  }
}

// Run only when executed directly (not when imported by a test).
if (isDirectRun(process.argv[1], import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`rule-bootstrap-cli failed: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
