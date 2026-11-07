#!/usr/bin/env node
/** Plain-node adapter for the existing locked markdownlint-cli2 dependency.
 * Bundled by scripts/build-runtime-bundles.mjs; configuration belongs to the cwd project.
 * Uses the upstream bin contract without changing rules, output, or exit statuses.
 */
import { main } from 'markdownlint-cli2';

try {
  process.exitCode = await main({
    argv: process.argv.slice(2),
    logMessage: console.log,
    logError: console.error,
    allowStdin: true,
  });
} catch (error) {
  console.error(error);
  process.exitCode = 2;
}
