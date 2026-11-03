// D011 S1 recovery — P53 delivery-discovery probe (amended-2, A4-corrected).
// P53-CF: the REAL runDeliveryScenario counterfactual per-file statuses (the P53WEAK
// mutant sanitizes them — the demonstrated kill must read fail pristine).
// P53-LIVE lane-a-intended: the scenario's own liveBaseline (planted q1 bad corpus input).
// P53-LIVE lane-b-wrong-reason: a scratch whose probe input is a PARSE ERROR — exit 1
// without the intended rule id — the verified wrong-reason reject lane (receipt:
// evidence/runner-and-lane-receipts.md). Pristine: infrastructure-failure; under a
// ruleMentioned=true fault: delivery-live.
//
// A4 correction (amended-supplemental-freeze-review finding 4): amended-1 credited the
// DISCOVERY obligations (K6 ratchet / reconcile) off the delivery-CLI predicate
// (ruleMentioned) — a different checker. The P53-DISC lanes below observe the ACTUAL
// discovery channels exported by this module, over the REAL repo surfaces:
//   reconcile real-corpus — corpusPopulation over the real scripts/test-assurance/corpus
//     reconciled against the real frozen expectations.json case paths (bidirectional;
//     live-verified mismatches=0 at be84).
//   ratchet real-corpus — principleDiscoveryRatchet over the real packages/core with the
//     include grammar parsed from the real packages/core/vitest.config.ts (23 globs;
//     live-verified orphans=0 at be84).
//   ratchet scratch-orphan — the CAUSAL CONTROL: a constructed scratch coreRoot carrying
//     principles/99-demo.ts (numbered module, no selected sibling test) IS flagged
//     pristine (live-verified orphans=1 module=principles/99-demo.ts) and reads clean
//     under the SUP-R3-P53-DISCOVERY-PERM fault.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildScratch } from '../../../packages/core/principles/52-subprocess-status-conformance.ts';
import {
  corpusPopulation,
  emitDeliveredArtifact,
  parseVitestInclude,
  principleDiscoveryRatchet,
  Q6_DELIVERY_SPEC,
  reconcileCorpusRegistry,
  runDeliveryLiveness,
  runDeliveryScenario,
} from '../../../packages/core/principles/53-delivery-discovery-conformance.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;

const outcome = runDeliveryScenario();
for (const name of ['q6-good-wired-config.test.ts', 'q6-bad-disconnected.test.ts']) {
  const f = outcome.counterfactual.files[name];
  console.log(`P53-CF ${name} ${f ? f.status : 'absent'}`);
}
console.log(`P53-LIVE lane-a-intended ${outcome.liveBaseline.classification}`);

const scratch = join(tmpdir(), `s1-p53laneb-${process.pid}-${Date.now().toString(36)}`);
buildScratch(Q6_DELIVERY_SPEC, scratch);
try {
  emitDeliveredArtifact(scratch);
  // Overwrite the delivered probe input with a parse error: a reject for the WRONG reason.
  writeFileSync(join(scratch, 'tests', 'probe-vacuous.test.ts'), 'const brokenSyntax = {{{;\n');
  const probe = runDeliveryLiveness(scratch);
  console.log(`P53-LIVE lane-b-wrong-reason ${probe.classification}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// ── A4 discovery lanes: the ACTUAL K6 channels over the REAL repo surfaces ──
const corpusDir = join(ROOT, 'scripts/test-assurance/corpus');
const registered = (JSON.parse(readFileSync(join(ROOT, 'scripts/test-assurance/expectations.json'), 'utf8')) as {
  cases: Array<{ path: string }>;
}).cases.map((c) => c.path);
const population = corpusPopulation(corpusDir);
console.log(`P53-DISC reconcile population=${population.length} registered=${registered.length}`);
console.log(`P53-DISC reconcile real-corpus mismatches=${reconcileCorpusRegistry(corpusDir, registered).length}`);

const includeGlobs = parseVitestInclude(join(ROOT, 'packages/core/vitest.config.ts'));
console.log(`P53-DISC ratchet real-corpus orphans=${principleDiscoveryRatchet(join(ROOT, 'packages/core'), includeGlobs).length}`);

const scratchCore = join(tmpdir(), `s1-p53disc-${process.pid}-${Date.now().toString(36)}`);
mkdirSync(join(scratchCore, 'principles'), { recursive: true });
writeFileSync(join(scratchCore, 'principles', '99-demo.ts'), 'export const demo = 1;\n');
try {
  const orphans = principleDiscoveryRatchet(scratchCore, includeGlobs);
  console.log(`P53-DISC ratchet scratch-orphan orphans=${orphans.length} module=${orphans[0]?.module ?? 'none'}`);
} finally {
  rmSync(scratchCore, { recursive: true, force: true });
}
