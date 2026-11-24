// Byte-identity gate for the vendored `grilling` upstream text.
//
// Origin: 2026-09-21 cold backward sweep over the "vendor a third-party skill body"
//   change class. `.claude/skills/arch/references/grilling.md` promises a VERBATIM
//   upstream body and pins its sha256 in a provenance table — but the only thing
//   protecting that promise was the prose heading «do not edit». That is
//   `#hope-as-gate` (.claude/rules/attention-is-not-a-mechanism.md §2), and the risk
//   is concrete rather than theoretical: `scripts/format-shipped.sh` hands
//   `.claude/skills` to prettier WHOLE, so a future prettier-config change (proseWrap,
//   emphasis style, table padding) would silently rewrite the "verbatim" bytes with
//   nothing to notice. The first-party sibling — `packages/runtime-bridge/vendor/**` —
//   already has such a parity gate; the third-party copy had none.
//
// ── What this gate ASSERTS ──
//   (a) the extraction contract still holds — the body heading is the LAST heading and
//       nothing is appended after the body;
//   (b) the body hashes to the pinned value;
//   (c) the pin recorded in the file's own provenance table equals the constant below,
//       so «edit the body AND relax the table» cannot pass as a one-sided fix.
//
// ── What it must NOT claim ──
//   It does NOT verify the copy against upstream. Upstream lives in the operator's
//   `~/.claude/plugins/**`, absent on a CI runner and in the aif container (the
//   environment fact established by upstream-skill-reference.test.ts). Comparing
//   against upstream is the human re-census step the file's «Re-census trigger» owns;
//   this gate only makes OUR copy immutable-by-accident. Selling it as an
//   upstream-freshness check would be `#discipline-theatre` (ai-laziness-traps.md T2).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const VENDORED = join(REPO_ROOT, '.claude/skills/arch/references/grilling.md');

// Recorded 2026-09-21 == `tail -n +6 <marketplace>/skills/productivity/grilling/SKILL.md
// | shasum -a 256` (upstream minus its 5-line frontmatter).
const PINNED_BODY_SHA = '8c5fb7223da54cd8120e15a72dbabe87221b5baa78334ff8c50b9faab41aa007';

const BODY_HEADING = '## Upstream body (verbatim — do not edit)\n';

/** The extraction contract stated in the file: text after the body heading, minus one leading newline. */
function extractBody(doc: string): string {
  const at = doc.indexOf(BODY_HEADING);
  if (at === -1) throw new Error(`body heading absent from ${VENDORED}`);
  const after = doc.slice(at + BODY_HEADING.length);
  return after.startsWith('\n') ? after.slice(1) : after;
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('vendored grilling body stays byte-identical to its pin', () => {
  const doc = readFileSync(VENDORED, 'utf8');

  it('the body heading is the LAST heading — nothing may be appended after the body', () => {
    const headings = [...doc.matchAll(/^## .*$/gm)].map((m) => m[0]);
    expect(headings.at(-1)).toBe(BODY_HEADING.trimEnd());
  });

  it('the extracted body is the upstream text, not an empty or truncated slice', () => {
    const body = extractBody(doc);
    expect(body.length).toBeGreaterThan(1000);
    expect(body.startsWith('Interview the user relentlessly until you reach')).toBe(true);
  });

  it('the body hashes to the pinned sha256', () => {
    expect(sha256(extractBody(doc))).toBe(PINNED_BODY_SHA);
  });

  it('a one-character edit to the body breaks the hash (the check is not tautological)', () => {
    expect(sha256(`${extractBody(doc)} `)).not.toBe(PINNED_BODY_SHA);
  });

  it("the provenance table's own pin equals this test's constant", () => {
    const row = doc.match(/\|\s*Vendored body sha256\s*\|\s*`([0-9a-f]{64})`/);
    expect(row).not.toBeNull();
    expect(row![1]).toBe(PINNED_BODY_SHA);
  });
});
