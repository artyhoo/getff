/** CI entrypoint — env in, exit code out (sibling of pr-body-prior-art-bin.ts). */
import { checkPrBodyFidelity } from './pr-body-fidelity.ts';

const baseRef = process.env.BASE_REF ?? '';
if (baseRef !== 'staging') {
  // Defense-in-depth: the workflow-level `if:` already scopes to staging (spec D3/m3).
  console.log(`pr-body-fidelity: base '${baseRef}' out of scope (staging only) — pass`);
  process.exit(0);
}
const result = checkPrBodyFidelity({
  body: process.env.PR_BODY ?? '',
  headSha: process.env.HEAD_SHA ?? '',
});
if (result.ok) {
  console.log('pr-body-fidelity: OK');
  process.exit(0);
}
console.error('pr-body-fidelity: FAIL');
for (const e of result.errors) console.error(`  - ${e}`);
process.exit(1);
