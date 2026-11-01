// D011 S1 recovery — P52 judging-predicate probe (amended-2, A4-corrected).
// Frozen observation literals through the REAL exported evaluateExecutedExpectation:
//   reject-killed     (pass, fail, no intended)  expect 'reject' — must NOT be ok
//   reject-survived   (pass, pass)               expect 'reject' — must be ok (control)
//   admit-intended    (pass, fail, intended)     expect 'admit'   — must be ok
//   admit-unintended  (pass, fail, no intended)  expect 'admit'   — must NOT be ok
// A4 correction (amended-supplemental-freeze-review finding 4): the Q3 reject predicate
// is now observed through REAL counterfactual replays, not frozen literals alone. Both
// Q4 scenario cases are observed through the real runScenario/observe machinery:
//   q4/good.asserted-exit — the counterfactual (process.exit(42)→(0)) KILLS the good
//     companion's assertion: baseline pass, counterfactual fail. Pristine: reject is NOT
//     demonstrated (ok=false — gap-not-demonstrated is the honest verdict); under the
//     SUP-R3-Q3-PERM fault (survived = baseline-only) it flips to ok=true.
//   q4/bad.ignored-exit — the genuinely surviving case (baseline pass, counterfactual
//     pass): reject IS demonstrated (ok=true) — the causal control that the flip is
//     exactly the killed shape, not a blanket rejection change.
import {
  evaluateExecutedExpectation,
  observe,
  Q4_SCENARIO,
  runScenario,
  type CaseObservation,
} from '../../../packages/core/principles/52-subprocess-status-conformance.ts';

const rejectKilled: CaseObservation = {
  caseId: 'probe/reject-killed',
  baseline: 'pass',
  counterfactual: 'fail',
  intendedAssertion: false,
};
const rejectSurvived: CaseObservation = {
  caseId: 'probe/reject-survived',
  baseline: 'pass',
  counterfactual: 'pass',
  intendedAssertion: false,
};
const admitIntended: CaseObservation = {
  caseId: 'probe/admit-intended',
  baseline: 'pass',
  counterfactual: 'fail',
  intendedAssertion: true,
};
const admitUnintended: CaseObservation = {
  caseId: 'probe/admit-unintended',
  baseline: 'pass',
  counterfactual: 'fail',
  intendedAssertion: false,
};

console.log(`P52-EVAL reject-killed ok=${evaluateExecutedExpectation(rejectKilled, 'reject').ok}`);
console.log(`P52-EVAL reject-survived ok=${evaluateExecutedExpectation(rejectSurvived, 'reject').ok}`);
console.log(`P52-EVAL admit-intended ok=${evaluateExecutedExpectation(admitIntended, 'admit').ok}`);
console.log(`P52-EVAL admit-unintended ok=${evaluateExecutedExpectation(admitUnintended, 'admit').ok}`);

// A4 real-replay lane: both Q4 cases through the full runScenario → observe → judge chain.
const outcome = runScenario(Q4_SCENARIO);
const observations = observe(outcome);
const q4Bad = observations.find((o) => o.caseId === 'q4/bad.ignored-exit');
const q4Good = observations.find((o) => o.caseId === 'q4/good.asserted-exit');
if (!q4Bad) {
  console.error('P52-PROBE-INFRA q4/bad.ignored-exit case not observed');
  process.exit(3);
}
if (!q4Good) {
  console.error('P52-PROBE-INFRA q4/good.asserted-exit case not observed');
  process.exit(3);
}
console.log(`P52-REPLAY q4/bad.ignored-exit baseline=${q4Bad.baseline} counterfactual=${q4Bad.counterfactual}`);
console.log(`P52-REPLAY q4/good.asserted-exit baseline=${q4Good.baseline} counterfactual=${q4Good.counterfactual}`);
console.log(`P52-REPLAY q4/bad.ignored-exit reject ok=${evaluateExecutedExpectation(q4Bad, 'reject').ok}`);
console.log(`P52-REPLAY q4/good.asserted-exit reject ok=${evaluateExecutedExpectation(q4Good, 'reject').ok}`);
