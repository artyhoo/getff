#!/usr/bin/env -S npx tsx
// rules-as-tests-verify-provenance — S5 anti-hand-edit gate CLI.
// Usage: rules-as-tests-verify-provenance <bundleDir>
// Exit 0  → the emitted bundle matches its provenance (no hand-edit).
// Exit 1  → a hand-edit (content-hash mismatch / added / deleted rule / stripped
//           marker) or a structural tamper (missing/!JSON provenance|manifest).
// Exit 2  → usage error.
// Emits ::error:: annotations so a hand-edit reds CI mechanically.

import { ProvenanceVerifyError, verifyProvenance } from './verify-provenance.ts';

function main(): void {
  const dir = process.argv[2];
  if (!dir) {
    process.stderr.write('usage: rules-as-tests-verify-provenance <bundleDir>\n');
    process.exit(2);
    return;
  }

  try {
    const result = verifyProvenance(dir);
    if (result.ok) {
      process.stdout.write(
        `verify-provenance: OK (${result.rulesChecked} rule(s) match provenance)\n`,
      );
      process.exit(0);
      return;
    }
    process.stderr.write(
      '::error::generated rule file hand-edited — the synthesizer is the sole writer; regenerate (do not edit the emitted files).\n',
    );
    for (const m of result.mismatches) {
      const hashes = m.expectedHash
        ? ` (expected ${m.expectedHash.slice(0, 12)}…, got ${(m.actualHash ?? 'n/a').slice(0, 12)}…)`
        : '';
      process.stderr.write(`::error::  ${m.ruleId}: ${m.kind}${hashes}\n`);
    }
    process.exit(1);
  } catch (err) {
    if (err instanceof ProvenanceVerifyError) {
      process.stderr.write(`::error::${err.message}\n`);
      process.exit(1);
      return;
    }
    throw err;
  }
}

main();
