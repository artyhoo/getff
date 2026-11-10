import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The reporting grammar must represent every verdict the review method can produce.
function assertRecommendationCoverage(source) {
  const method = source.match(/one\*\* verdict ([^\n]+)/)?.[1];
  const verdicts = [...method.matchAll(/`([A-Z]+)`/g)].map((match) => match[1]);
  const grammar = source.match(/## Output grammar[\s\S]*?```text([\s\S]*?)```/)?.[1];
  const recommendation = grammar.split('Recommendation:')[1];
  for (const verdict of verdicts) {
    assert.match(recommendation, new RegExp(`\\b${verdict}\\b`),
      `Recommendation grammar cannot represent ${verdict}`);
  }
  assert.equal(verdicts.length, 3, 'Review method must declare all three verdicts');
}

const source = readFileSync(new URL('../../.agents/roles/adapter-jig-reviewer.md', import.meta.url), 'utf8');
test('every review outcome is representable by the recommendation grammar', () => {
  assertRecommendationCoverage(source);
});
test('removing the unavailable-evidence outcome makes the contract inconsistent', () => {
  const mutant = source.replace(/INSUFFICIENT — <missing evidence[^\n]*\n?/, '');
  assert.throws(() => assertRecommendationCoverage(mutant), /cannot represent INSUFFICIENT/);
});
