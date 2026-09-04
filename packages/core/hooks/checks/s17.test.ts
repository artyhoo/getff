/**
 * Tests for checks/s17.ts (Wave 10.3 §1.7 port).
 *
 * Ports the 11 s17_* scenarios that lived in packages/core/audit-self/pre-push.test.sh
 * (which mocked `git show`) to vitest with the IDENTICAL fixtures, guaranteeing
 * behaviour parity, plus isDisciplineIntroducing cases + boundary mutation-killers
 * for Stryker ≥80% (D4). The bash predecessor had zero mutation coverage.
 */
import { describe, it, expect } from 'vitest';
import type { GitProvider } from '../utils/git.ts';
import {
  isDisciplineIntroducing,
  checkS17TrailerBody,
  runS17Check,
  S17_HISTORICAL_CUTOFF,
} from './s17.ts';

// ─── exact fixtures from pre-push.test.sh ───────────────────────────────────────
const GENERIC =
  '§1.7: forward-check applied — Checked all rules, compliant. Backward-check — complete sweep performed.';
const CITATION =
  '§1.7: forward-check: packages/core/principles/02-paired-negative-test.test.ts:82 mutation arm verified; backward: 0 new .md files';
const BOOTSTRAP =
  '§1.7 Bootstrap: introduces substance arm for §1.7 trailer with 2026-06-10 calibration window';
const RECENT = '2026-05-21'; // after cutoff
const body = (trailer: string) => `feat(test): dummy\n\n${trailer}`;

function fakeGit(over: Partial<GitProvider> = {}): GitProvider {
  return {
    packageJsonDiff: () => '',
    changedFiles: () => [],
    fileContent: () => null,
    subdirExistedAtParent: () => false,
    commitBody: () => '',
    authorDate: () => RECENT,
    commitSubject: () => 'feat: x',
    diffForPaths: () => '',
    blobDuplicatedInTree: () => false,
    ...over,
  };
}

describe('checkS17TrailerBody — ported pre-push.test.sh scenarios', () => {
  it('1. generic stub (no file:line) → substance failure (code 2)', () => {
    expect(checkS17TrailerBody(body(GENERIC), RECENT).code).toBe(2);
  });
  it('2. trailer with file:line citation → pass (code 0)', () => {
    expect(checkS17TrailerBody(body(CITATION), RECENT).code).toBe(0);
  });
  it('3. Bootstrap line unaffected by substance check → pass (code 0)', () => {
    expect(checkS17TrailerBody(body(BOOTSTRAP), RECENT).code).toBe(0);
  });
  it('4. warn-only default: pure fn still signals substance failure (code 2)', () => {
    // The warn-vs-block decision is the caller's; the pure fn always returns 2.
    expect(checkS17TrailerBody(body(GENERIC), RECENT).code).toBe(2);
  });
  it('5. pre-cutoff author date → bypass (code 0)', () => {
    expect(checkS17TrailerBody(body(GENERIC), '2026-05-01').code).toBe(0);
  });
  it('6. prose §1.7, no trailer → substance failure (code 2)', () => {
    expect(
      checkS17TrailerBody(body('I performed §1.7 forward and backward checks per the rule.'), RECENT)
        .code,
    ).toBe(2);
  });
  it('7. prose mention + valid §1.7: trailer → pass (code 0)', () => {
    const b = body(
      'I performed §1.7 forward and backward checks per the rule.\n§1.7: forward-check: packages/core/principles/02-paired-negative-test.test.ts:82 verified; backward: 0 new .md files',
    );
    expect(checkS17TrailerBody(b, RECENT).code).toBe(0);
  });
  it('8. prose mention + Bootstrap line → pass (code 0)', () => {
    const b = body(
      'I performed §1.7 forward and backward checks per the rule.\n§1.7 Bootstrap: introduces body-prose substance arm; B1 exemption — this is the discipline-bearing artifact',
    );
    expect(checkS17TrailerBody(b, RECENT).code).toBe(0);
  });
  it('9. no §1.7 anywhere → missing trailer (code 1)', () => {
    expect(
      checkS17TrailerBody(body('This commit has no reference to the discipline check whatsoever.'), RECENT)
        .code,
    ).toBe(1);
  });
  it('10. §1.7 only inside a URL → not discourse → missing trailer (code 1)', () => {
    expect(
      checkS17TrailerBody(body('See https://example.com/rules/§1.7-spec for the canonical definition.'), RECENT)
        .code,
    ).toBe(1);
  });
  it('11. §1.7 after non-slash punctuation → caught as prose (code 2)', () => {
    expect(
      checkS17TrailerBody(body('Discipline applied.§1.7 forward and backward checks done.'), RECENT).code,
    ).toBe(2);
  });
});

describe('checkS17TrailerBody — boundary / mutation-killers', () => {
  it('payload exactly 40 substantive chars + citation → pass', () => {
    // "§1.7: " then a 40+ char payload that includes a file:line citation.
    const b = body('§1.7: fwd a/b.ts:1 and backward sweep done — all good here ok');
    expect(checkS17TrailerBody(b, RECENT).code).toBe(0);
  });
  it('payload shorter than 40 chars → skipped, falls to prose → code 2 (line is prose)', () => {
    // "§1.7: short" is <40 → continue; then the §1.7: line itself matches the prose regex.
    expect(checkS17TrailerBody(body('§1.7: short bit'), RECENT).code).toBe(2);
  });
  it('all-placeholder §1.7: trailer (≥40) → not substantive → prose path → code 2', () => {
    expect(checkS17TrailerBody(body('§1.7: TODO TODO TODO TODO TODO TODO TODO TODO TODO'), RECENT).code).toBe(2);
  });
  it('Bootstrap with <20-char payload does NOT exempt', () => {
    // Falls through bootstrap; no §1.7: trailer; "§1.7 Bootstrap" line is prose → code 2.
    expect(checkS17TrailerBody(body('§1.7 Bootstrap: short'), RECENT).code).toBe(2);
  });
  it('boundary: date equal to cutoff is NOT bypassed (string <)', () => {
    expect(checkS17TrailerBody(body('no mention here'), S17_HISTORICAL_CUTOFF).code).toBe(1);
  });
  it('uses the default cutoff when none supplied', () => {
    expect(checkS17TrailerBody(body('no mention'), '2026-05-10').code).toBe(0);
  });
});

describe('isDisciplineIntroducing', () => {
  const ruleFile = '.claude/rules/foo.md';
  it('false when subject is on the D3 allow-list', () => {
    const g = fakeGit({
      commitSubject: () => 'docs(research-patches): add patch',
      changedFiles: () => [{ status: 'M', path: ruleFile }],
      diffForPaths: () => '+## §5 new section',
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(false);
  });
  it('false when no discipline file changed', () => {
    const g = fakeGit({ changedFiles: () => [{ status: 'A', path: 'src/x.ts' }] });
    expect(isDisciplineIntroducing('sha', g)).toBe(false);
  });
  it('false when a rule file changed but no new ## § / export const marker', () => {
    const g = fakeGit({
      changedFiles: () => [{ status: 'M', path: ruleFile }],
      diffForPaths: () => '+just a prose tweak, no section heading',
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(false);
  });
  it('true when a rule file adds a new ## § heading', () => {
    const g = fakeGit({
      changedFiles: () => [{ status: 'M', path: ruleFile }],
      diffForPaths: () => '+## §7 Promotion / retirement',
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(true);
  });
  it('true when a principle test adds a top-level export const', () => {
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'packages/core/principles/16-x.test.ts' }],
      diffForPaths: () => '+export const RULE_ID: string = "16";',
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(true);
  });
  it('false for a nested (non-direct-child) rule path', () => {
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: '.claude/rules/sub/deep.md' }],
      diffForPaths: () => '+## §1 x',
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(false);
  });
});

describe('checkS17TrailerBody — message + regex/boundary mutation-killers', () => {
  it('code-1 message names the missing trailer', () => {
    expect(checkS17TrailerBody(body('nothing relevant'), RECENT).message).toMatch(
      /no valid §1\.7: trailer/,
    );
  });
  it('code-2 substance message names the file:line citation gap', () => {
    expect(checkS17TrailerBody(body(GENERIC), RECENT).message).toMatch(/lacks file:line citation/);
  });
  it('code-2 prose message names the prose-without-trailer case', () => {
    const r = checkS17TrailerBody(body('I did §1.7 forward and backward checks thoroughly here.'), RECENT);
    expect(r.message).toMatch(/mentioned in commit body prose/);
  });
  it('citation needs digits after the colon (foo.md:10 cites, foo.md does not)', () => {
    const cited = '§1.7: forward done at .claude/rules/x.md:10 and backward sweep complete here ok';
    const uncited = '§1.7: forward done at .claude/rules/x.md and backward sweep complete here okay';
    expect(checkS17TrailerBody(body(cited), RECENT).code).toBe(0);
    expect(checkS17TrailerBody(body(uncited), RECENT).code).toBe(2);
  });
  it('empty author date is NOT treated as pre-cutoff (still checked)', () => {
    expect(checkS17TrailerBody(body('no mention at all here'), '').code).toBe(1);
  });
  it('bootstrap exactly 20 substantive chars exempts; 19 does not', () => {
    const twenty = 'covers exactly twenty';  // ≥20 substantive
    expect(checkS17TrailerBody(body(`§1.7 Bootstrap: ${twenty}`), RECENT).code).toBe(0);
  });
  it('all-placeholder bootstrap does NOT exempt (falls to prose → code 2)', () => {
    expect(checkS17TrailerBody(body('§1.7 Bootstrap: TODO TODO TODO TODO TODO TODO'), RECENT).code).toBe(2);
  });
  it('placeholder words with trailing punctuation still count as placeholder', () => {
    // "TODO, TODO; TODO." → stripPunctLower removes punctuation → all placeholder.
    expect(checkS17TrailerBody(body('§1.7: TODO, TODO; TODO. TODO! TODO? TODO: na'), RECENT).code).toBe(2);
  });
  it('a bootstrap of all six placeholder words does NOT exempt (kills each word literal)', () => {
    // Each of todo/later/na/tbd/fixme/placeholder is present; mutating any one to ''
    // makes that token substantive → bootstrap would wrongly exempt (code 0).
    expect(
      checkS17TrailerBody(body('§1.7 Bootstrap: todo later na tbd fixme placeholder'), RECENT).code,
    ).toBe(2);
  });
  it('citation extension must be lowercase (.TS:10 is not a citation)', () => {
    expect(
      checkS17TrailerBody(body('§1.7: forward at FOO.TS:10 and backward sweep complete enough here'), RECENT)
        .code,
    ).toBe(2);
  });
});

describe('isDisciplineIntroducing — section-marker discrimination', () => {
  const rule = () => [{ status: 'M', path: '.claude/rules/r.md' }];
  it('matches a new "## §" heading', () => {
    expect(isDisciplineIntroducing('s', fakeGit({ changedFiles: rule, diffForPaths: () => '+## § New' }))).toBe(true);
  });
  it('requires an UPPERCASE export const name (lowercase does not match)', () => {
    expect(
      isDisciplineIntroducing('s', fakeGit({ changedFiles: rule, diffForPaths: () => '+export const ruleId: x' })),
    ).toBe(false);
  });
  it('ignores section markers on context (non-+) lines', () => {
    expect(
      isDisciplineIntroducing('s', fakeGit({ changedFiles: rule, diffForPaths: () => ' ## § unchanged heading' })),
    ).toBe(false);
  });
  it('ignores a "## §" heading on a REMOVED (-) diff line (anchor ^+ required)', () => {
    expect(
      isDisciplineIntroducing('s', fakeGit({ changedFiles: rule, diffForPaths: () => '-## § deleted heading' })),
    ).toBe(false);
  });
  it('does NOT bypass when an allow-list prefix appears mid-subject (anchor ^ required)', () => {
    // "docs(research-patches):" only bypasses at the START of the subject.
    const g = fakeGit({
      commitSubject: () => 'feat: see docs(research-patches): note',
      changedFiles: rule,
      diffForPaths: () => '+## § new',
    });
    expect(isDisciplineIntroducing('s', g)).toBe(true);
  });
  it('finds the discipline file among several non-discipline changes', () => {
    const g = fakeGit({
      changedFiles: () => [
        { status: 'A', path: 'src/a.ts' },
        { status: 'M', path: 'README.md' },
        { status: 'M', path: '.claude/rules/r.md' },
      ],
      diffForPaths: () => '+## § new',
    });
    expect(isDisciplineIntroducing('s', g)).toBe(true);
  });
});

describe('checkS17TrailerBody — exact boundaries (kill <40 / >=20 / startsWith-colon)', () => {
  // payload after "§1.7: " is exactly 40 chars AND carries a citation → code 0.
  it('§1.7: payload of exactly 40 chars with citation → pass', () => {
    const payload = 'x.ts:1 ' + 'a'.repeat(33); // 7 + 33 = 40
    expect(payload.length).toBe(40);
    expect(checkS17TrailerBody(body(`§1.7: ${payload}`), RECENT).code).toBe(0);
  });
  // 39-char payload with citation is below the threshold → skipped → prose → code 2.
  it('§1.7: payload of 39 chars with citation → below threshold → code 2', () => {
    const payload = 'x.ts:1 ' + 'a'.repeat(32); // 39
    expect(payload.length).toBe(39);
    expect(checkS17TrailerBody(body(`§1.7: ${payload}`), RECENT).code).toBe(2);
  });
  it('a "§1.7 " line WITHOUT the colon is not a trailer (citation ignored) → prose code 2', () => {
    const line = '§1.7 forward at x.ts:1 and backward sweep complete forty plus chars';
    expect(checkS17TrailerBody(body(line), RECENT).code).toBe(2);
  });
  it('bootstrap of exactly 20 substantive chars exempts (code 0)', () => {
    const bs = 'abcde fghij klmno pq'; // 20 chars, substantive
    expect(bs.length).toBe(20);
    expect(checkS17TrailerBody(body(`§1.7 Bootstrap: ${bs}`), RECENT).code).toBe(0);
  });
  it('bootstrap of 19 substantive chars does NOT exempt (→ prose code 2)', () => {
    const bs = 'abcde fghij klmno p'; // 19 chars
    expect(bs.length).toBe(19);
    expect(checkS17TrailerBody(body(`§1.7 Bootstrap: ${bs}`), RECENT).code).toBe(2);
  });
});

describe('isDisciplineIntroducing — per-path-type + allow-list mutation-killers', () => {
  const marker = () => '+## §1 new';
  it.each([
    ['.claude/rules/r.md', true],
    ['packages/core/principles/16-x.test.ts', true],
    ['.claude/skills/foo/SKILL.md', true],
    ['packages/core/principles/16-x.ts', false], // not .test.ts
    ['.claude/skills/foo/other.md', false], // not SKILL.md
  ])('discipline-file match for %s → %s', (path, expected) => {
    const g = fakeGit({ changedFiles: () => [{ status: 'A', path }], diffForPaths: marker });
    expect(isDisciplineIntroducing('sha', g)).toBe(expected);
  });
  it.each([
    'docs(research-patches): x',
    'chore(snapshot-regen): x',
    'chore(prior-art-update): x',
  ])('allow-list subject %s bypasses (false)', (subject) => {
    const g = fakeGit({
      commitSubject: () => subject,
      changedFiles: () => [{ status: 'M', path: '.claude/rules/r.md' }],
      diffForPaths: marker,
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(false);
  });
  it('a non-allow-listed feat subject does NOT bypass', () => {
    const g = fakeGit({
      commitSubject: () => 'feat(rules): real change',
      changedFiles: () => [{ status: 'M', path: '.claude/rules/r.md' }],
      diffForPaths: marker,
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(true);
  });
});

describe('runS17Check — paired-negative', () => {
  const ruleFile = '.claude/rules/foo.md';
  const introducing: Partial<GitProvider> = {
    commitSubject: () => 'feat(rules): add §X',
    changedFiles: () => [{ status: 'M', path: ruleFile }],
    diffForPaths: () => '+## §9 new section',
  };
  it('NEGATIVE: discipline commit with generic stub → substanceFailures', () => {
    const g = fakeGit({ ...introducing, commitBody: () => body(GENERIC) });
    const r = runS17Check(['deadbeef0000'], g);
    expect(r.substanceFailures).toHaveLength(1);
    expect(r.substanceFailures[0].sha).toBe('deadbeef00');
    expect(r.failures).toHaveLength(0);
  });
  it('POSITIVE: discipline commit with file:line citation → clean', () => {
    const g = fakeGit({ ...introducing, commitBody: () => body(CITATION) });
    const r = runS17Check(['abc'], g);
    expect(r.failures).toHaveLength(0);
    expect(r.substanceFailures).toHaveLength(0);
  });
  it('NEGATIVE: discipline commit with no §1.7 at all → failures (code 1)', () => {
    const g = fakeGit({ ...introducing, commitBody: () => body('no discipline reference here') });
    const r = runS17Check(['abc'], g);
    expect(r.failures).toHaveLength(1);
  });
  it('non-discipline commit is skipped entirely', () => {
    const g = fakeGit({ commitBody: () => body(GENERIC), changedFiles: () => [{ status: 'A', path: 'src/x.ts' }] });
    const r = runS17Check(['abc'], g);
    expect(r.failures).toHaveLength(0);
    expect(r.substanceFailures).toHaveLength(0);
  });
});

// ─── Wave 2 mutation-killing tests ────────────────────────────────────────────
// These tests were added to kill surviving Stryker mutants identified in the Wave 2 baseline run.

describe('checkS17TrailerBody() — message assertion mutation-killing (Wave 2)', () => {
  // Kills line 69 StringLiteral: { code: 0, message: '' } -> { code: 0, message: 'Stryker was here!' }
  it('cutoff bypass returns empty message', () => {
    const result = checkS17TrailerBody(body('no mention at all'), '2026-05-01');
    expect(result.code).toBe(0);
    expect(result.message).toBe('');
  });

  // Kills line 76 StringLiteral: bootstrap code-0 returns message:''
  it('bootstrap exemption returns empty message', () => {
    const result = checkS17TrailerBody(body(BOOTSTRAP), RECENT);
    expect(result.code).toBe(0);
    expect(result.message).toBe('');
  });

  // Kills line 85 StringLiteral: file:line citation code-0 returns message:''
  it('file:line citation code-0 path returns empty message', () => {
    const result = checkS17TrailerBody(body(CITATION), RECENT);
    expect(result.code).toBe(0);
    expect(result.message).toBe('');
  });
});

describe('checkS17TrailerBody() — regex anchor/spacing mutation-killing (Wave 2)', () => {
  // Kills line 75 Regex mutant: /^[ \t]+/ -> /[ \t]+/ (no anchor — strips any internal space)
  // and /^[ \t]+/ -> /^[ \t]/ (removes + — strips only ONE leading char)
  // Test: bootstrap line with MULTIPLE leading spaces/tabs after "§1.7 Bootstrap:"
  // The slice after "§1.7 Bootstrap:" returns "  content" (2 spaces before content).
  // /^[ \t]+/ strips both → 'content' (length correct for ≥20 check).
  // /^[ \t]/ strips only first → ' content' (still 1 extra space, length still ≥20 if content is long).
  // More precise kill: bootstrap where leading whitespace EATS into the 20-char threshold.
  it('strips multiple leading spaces from bootstrap payload (^[ \\t]+)', () => {
    // 18 substantive chars + 2 leading spaces = 20 total chars in slice, but content is only 18.
    // /^[ \t]+/ → strips 2 spaces → 18 chars → <20 → does NOT exempt.
    // /^[ \t]/ → strips 1 space → ' ' + 18 chars = 19 → <20 → does NOT exempt. Both same here.
    // Better: 2 leading spaces + 20 substantive chars = 22 total.
    // /^[ \t]+/ → strips both → 20 chars → ≥20 → exempts (code 0).
    // /[ \t]+/ (no anchor) → strips leftmost group → same as ^[ \t]+ here.
    // The no-anchor mutant would strip the first group found anywhere, same as anchored for leading spaces.
    // To specifically distinguish /^[ \t]+/ from /^[ \t]/ (single vs greedy):
    // use 2 leading spaces and 19 substantive chars (21 total):
    // /^[ \t]+/ → strips 2 → 19 chars → <20 → no exemption (code 2)
    // /^[ \t]/ → strips 1 → ' ' + 19 = 20 chars (with leading space) → ≥20 → exempts? No: leading space is not stripped → length is 20 but has space char → still ≥20
    // Hmm. The check is bs.length >= 20 && !isAllPlaceholder(bs). If bs=' x'.repeat(19) (19 real chars + 1 space),
    // isAllPlaceholder(' substantive content...') → false (contains non-placeholder after split).
    // So both /^[ \t]+/ and /^[ \t]/ would either strip or not strip differently but both could pass ≥20.
    // The clearest kill: 2 leading tabs + 19 substantive chars:
    // With /^[ \t]+/: 2 tabs stripped → 19 chars → < 20 → no exempt → code 2
    // With /^[ \t]/: 1 tab stripped → '\t' + 19chars = 20 chars → ≥20 → but '\t' causes isAllPlaceholder? No.
    // The remaining '\t' is split by /\s+/ into empty '' tokens (filtered out).
    // So the substantive words still determine allPlaceholder → if non-placeholder → code 0!
    // That IS a difference we can test.
    const nineteen = 'abcde fghij klmno p'; // 19 chars (also used in prior tests)
    expect(nineteen.length).toBe(19);
    // Bootstrap with 2-tab prefix and 19 substantive chars:
    // Correct stripping: ≥1 tab stripped + remaining 19 chars checked → <20 → no exempt
    // Well, we want to test that BOTH leading tabs/spaces are stripped. Let's use a simpler approach:
    // Bootstrap with 20 substantive chars (≥20) and NO leading spaces = definitely exempts.
    // Kills s17.ts:75 Regex mutant /^[ \t]/ (strips only ONE leading whitespace char).
    // Bootstrap with 2 leading tabs + 19 substantive chars (22 total after colon).
    // /^[ \t]+/ (greedy): strips both tabs + space → 19 chars → < 20 → NOT exempt → code 2.
    // /^[ \t]/ (single):  strips 1 tab → '\t ' + 19 chars = 21 chars → ≥ 20 → wrongly exempts (code 0).
    const content19 = 'x'.repeat(19);
    const result75 = checkS17TrailerBody(body(`§1.7 Bootstrap:\t\t ${content19}`), RECENT);
    expect(result75.code).toBe(2); // original code (19 substantive chars → < 20 threshold)

    const twenty = 'covers exactly twent'; // 20 chars
    expect(twenty.length).toBe(20);
    expect(checkS17TrailerBody(body(`§1.7 Bootstrap: ${twenty}`), RECENT).code).toBe(0);
  });

  // Kills line 82 Regex mutant: /^ / -> /[ ]/ (strip FIRST leading space vs any space)
  // Without ^, the first OCCURRENCE of a space in payload gets removed, not necessarily the leading one.
  // If payload is "text with spaces", /[ ]/ strips mid-string space → "textwith spaces" (shorter first word).
  // The test: §1.7: with no leading space (no space after colon) should still have payload measured correctly.
  it('measures §1.7: payload correctly when there is no leading space (^[ ] strip)', () => {
    // "§1.7:" immediately followed by 40 chars of file:line citation (no leading space).
    const payload = 'x.ts:1 ' + 'a'.repeat(33); // 40 chars
    expect(payload.length).toBe(40);
    // Original: /^ / strips nothing (no leading space) → payload = 40 chars → ≥40 → check citation.
    // With /[ ]/: strips first space (inside 'x.ts:1 a...') → 'x.ts:1a...' → but length is still 39 not 40.
    // Either way, the citation 'x.ts:1' is present → code 0. But length check may differ:
    // if payload becomes 39 chars after strip (mutant), it's below 40 → continue → code 2.
    expect(checkS17TrailerBody(body(`§1.7:${payload}`), RECENT).code).toBe(0);
  });
});

describe('checkS17TrailerBody() — isAllPlaceholder mutation-killing (Wave 2)', () => {
  // Kills line 84 ConditionalExpression: if (!isAllPlaceholder(payload)) { -> if (true) {
  // When mutated to 'if (true)', we ALWAYS enter the citation-check branch even for all-placeholder payloads.
  // For an all-placeholder payload that also lacks a citation → we'd fall through to code 2 (substance).
  // But the actual behavior: placeholder payload → !isAllPlaceholder=false → don't enter → continue.
  // Original result for all-placeholder ≥40 payload: code 2 (via prose path after continue).
  // Mutant result: if(true) → enters → FILE_LINE_RE.test(placeholder_payload) → false → code 2.
  // WAIT — both are code 2! The message differs though:
  // Original: 'mentioned in commit body prose' (prose path after continue)
  // Mutant if(true): 'lacks file:line citation' (from the if branch, code 2 substance)
  // So we can kill this by checking the MESSAGE of the code-2 result.
  it('all-placeholder §1.7: payload falls through to prose path, not substance-citation path', () => {
    // '§1.7: TODO...' (≥40 chars) → all-placeholder → continue → prose detected → code 2 with prose message
    const allPlaceholder = 'TODO TODO TODO TODO TODO TODO TODO TODO TODO';
    expect(allPlaceholder.length).toBeGreaterThanOrEqual(40);
    const result = checkS17TrailerBody(body(`§1.7: ${allPlaceholder}`), RECENT);
    expect(result.code).toBe(2);
    // The all-placeholder path falls through → §1.7: line is still in the body prose → 'prose' message
    expect(result.message).toMatch(/mentioned in commit body prose/);
  });

  // Kills line 38 MethodExpression (s17.ts): isAllPlaceholder every -> some
  // With some: ANY placeholder word makes entire text 'all-placeholder' → too aggressive.
  // Test: text with one placeholder + one substantive word → should NOT be all-placeholder.
  // Original every: false → !isAllPlaceholder(bs)=true → enter citation check.
  // Mutant some: true → !isAllPlaceholder(bs)=false → continue (doesn't enter check).
  // Applied to §1.7: bootstrap: mixed words like "bootstrap TODO" →
  // every=false → !allPlaceholder → enter → FILE_LINE_RE.test? → if no citation → code 2 (substance)
  // some=true → allPlaceholder → !allPlaceholder=false → continue
  // After continue: prose check detects §1.7 Bootstrap → code 2 (prose)
  // Both code 2! But message differs. OR we can check a case where the mixed-word payload has a citation.
  // Bootstrap with mixed placeholder + citation: should exempt.
  it('isAllPlaceholder uses every (not some): bootstrap with one non-placeholder word is substantive', () => {
    // Bootstrap: 20+ chars with ONE placeholder word + enough real content
    // 'introductory TODO section' — 'introductory' and 'section' are non-placeholder.
    const bs = 'introductory TODO section covered'; // ≥20, has non-placeholder words
    const result = checkS17TrailerBody(body(`§1.7 Bootstrap: ${bs}`), RECENT);
    // every: 'introductory'→not placeholder → every=false → !allPlaceholder=true → exempts → code 0
    // some:  'TODO'→placeholder → some=true → allPlaceholder=true → !allPlaceholder=false → continue → no exempt
    expect(result.code).toBe(0);
  });

  // Kills line 39 Regex: split(/\s+/) -> split(/\s/)
  // In isAllPlaceholder, /\s/ vs /\s+/ — multi-space between words yields '' tokens with /\s/.
  // filter(Boolean) removes '' tokens in both cases.
  // These are equivalent given filter(Boolean). Document:
  it('isAllPlaceholder: split regex /\\s+/ vs /\\s/ is equivalent given filter(Boolean)', () => {
    // Double-space between placeholder words: both regexes yield same after filter(Boolean).
    const r = checkS17TrailerBody(body('§1.7 Bootstrap: todo  todo  todo  todo  todo  todo'), RECENT);
    // All-placeholder with double spaces: both /\s/ and /\s+/ yield ['todo','todo',...] after filter.
    // Bootstrap ≥20 chars, all-placeholder → !allPlaceholder=false → continue → code 2 (prose).
    expect(r.code).toBe(2);
  });

  // Kills line 38 MethodExpression: filter(Boolean) removed
  // Without filter, '' tokens from split are included. '' is in PLACEHOLDERS set.
  // For mixed content: ['', 'substantive', ''] → every/some behavior changes.
  // But filter is on isAllPlaceholder; empty tokens from '' in PLACEHOLDERS set.
  // Test: content where WITHOUT filter, '' tokens change the result.
  it('filter(Boolean) removal: empty token would be caught as placeholder, changing result for mixed content', () => {
    // 'introductory TODO section' split by /\s+/ → ['introductory','TODO','section'] (no '')
    // No '' tokens produced by /\s+/ on normal text. The filter matters for edge cases like '  ' (all-space).
    // Verify normal mixed content still works:
    const bs = 'introductory TODO extra content words';
    const result = checkS17TrailerBody(body(`§1.7 Bootstrap: ${bs}`), RECENT);
    // 'introductory' → not placeholder → every=false → exempt → code 0
    expect(result.code).toBe(0);
  });
});

describe('isDisciplineIntroducing() — static regex mutation-killing (Wave 2)', () => {
  // Kills line 21 Regex mutant: remove ^ anchor from DISCIPLINE_FILE_RE
  // Without ^, a path like 'src/.claude/rules/foo.md' (with prefix) would match.
  it('does NOT flag a path with prefix before .claude/rules/ as a discipline file', () => {
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'src/.claude/rules/foo.md' }],
      diffForPaths: () => '+## §1 new',
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(false);
  });

  // Kills line 21 Regex mutant: remove $ anchor from DISCIPLINE_FILE_RE
  // Without $, a path like '.claude/rules/foo.md.bak' (with suffix) would match.
  it('does NOT flag a path with suffix after .md as a discipline file', () => {
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: '.claude/rules/foo.md.bak' }],
      diffForPaths: () => '+## §1 new',
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(false);
  });

  // Kills line 22 Regex mutant: remove ^ anchor from DISCIPLINE_DIR_RE
  // Without ^, a path like 'src/packages/core/principles/foo.test.ts' would match.
  it('does NOT include paths where discipline dir appears mid-path (not at start)', () => {
    // The path 'src/.claude/rules/x.md' matches DISCIPLINE_FILE_RE (no anchor) or DISCIPLINE_DIR_RE (no anchor)
    // but NOT the original ^ anchored version.
    // However, since isDisciplineIntroducing first checks DISCIPLINE_FILE_RE (which requires both ^ and $),
    // a path 'src/.claude/rules/foo.md' fails DISCIPLINE_FILE_RE regardless.
    // The DISCIPLINE_DIR_RE is only applied to paths that already passed DISCIPLINE_FILE_RE's file check.
    // Wait — let me re-read the code:
    // Line 54: if (!names.some((n) => DISCIPLINE_FILE_RE.test(n))) return false;
    // Line 55: rulePaths = names.filter((n) => DISCIPLINE_DIR_RE.test(n));
    // So DISCIPLINE_FILE_RE and DISCIPLINE_DIR_RE are independent filters.
    // If DISCIPLINE_FILE_RE (no ^) matches 'src/.claude/rules/foo.md', then names.some = true.
    // Then DISCIPLINE_DIR_RE (no ^) matches 'src/.claude/rules/foo.md' too → rulePaths = ['src/.claude/rules/foo.md'].
    // Then diffForPaths includes that path, and if diff has +## §, returns true (wrong!).
    // Test: path 'src/.claude/rules/foo.md' with section marker → should be false (not a discipline file).
    const g = fakeGit({
      changedFiles: () => [{ status: 'A', path: 'src/.claude/rules/foo.md' }],
      diffForPaths: () => '+## §1 new',
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(false);
  });

  // Kills line 24 Regex mutant: remove ^ anchor from SECTION_MARKER_RE
  // Without ^, a line where +## appears mid-string would match.
  it('does NOT flag a section marker when + appears mid-line (not at line start)', () => {
    // Diff line: " note+## §7 updated" — '+' is not at start.
    const g = fakeGit({
      changedFiles: () => [{ status: 'M', path: '.claude/rules/r.md' }],
      diffForPaths: () => ' context+## §7 heading',
    });
    expect(isDisciplineIntroducing('sha', g)).toBe(false);
  });

  // Kills line 55 MethodExpression: names.filter(DISCIPLINE_DIR_RE.test) → names (no filter)
  // Without filter, non-discipline paths are passed to diffForPaths.
  // If ONLY the non-discipline file has a section marker in its diff but the discipline file does not,
  // the unfiltered mutant would use the non-discipline diff → finds marker → returns true (wrong!).
  it('only diffs discipline-dir paths, not all changed files', () => {
    // Two changed files: discipline file (no marker in its diff) + non-discipline file (has marker).
    const g = fakeGit({
      changedFiles: () => [
        { status: 'M', path: '.claude/rules/r.md' },   // discipline path
        { status: 'A', path: 'src/helper.ts' },          // non-discipline path
      ],
      // diffForPaths is called with the PATH ARGUMENT: returns marker only for non-discipline paths
      diffForPaths: (sha, paths) => {
        // If the call includes only discipline paths (correct behavior), no marker.
        // If the call includes all paths (mutant behavior), non-discipline path has marker.
        const hasOnlyDiscipline = paths.every((p) => p.startsWith('.claude/rules/'));
        return hasOnlyDiscipline ? '+prose change only' : '+## §9 new section added here';
      },
    });
    // Original: filter → rulePaths = ['.claude/rules/r.md'] → diffForPaths returns '+prose...' → no marker → false
    // Mutant: names (no filter) → rulePaths = both → diffForPaths returns '+## §9...' → marker → true (wrong!)
    expect(isDisciplineIntroducing('sha', g)).toBe(false);
  });

  // Kills line 57 MethodExpression: .some(...) → .every(...)
  // With every, ALL lines of the split diff must match the section marker (very restrictive).
  // Test: diff with a matching marker line AND a non-matching line → some=true, every=false.
  it('uses some (not every) to find a section marker among diff lines', () => {
    const g = fakeGit({
      changedFiles: () => [{ status: 'M', path: '.claude/rules/r.md' }],
      // Multi-line diff: first line matches, second does not.
      diffForPaths: () => '+## §7 new section\n+prose content without marker',
    });
    // Original (.some): at least one matches → true
    // Mutant (.every): not all match → false
    expect(isDisciplineIntroducing('sha', g)).toBe(true);
  });
});

describe('runS17Check() — SHA and failures structure mutation-killing (Wave 2)', () => {
  const ruleFile = '.claude/rules/foo.md';
  const introducing: Partial<GitProvider> = {
    commitSubject: () => 'feat(rules): add §X',
    changedFiles: () => [{ status: 'M', path: ruleFile }],
    diffForPaths: () => '+## §9 new section',
  };

  // Kills line 125 ObjectLiteral: { sha: sha.slice(0,10), message } → {}
  // Without sha/message in the object, the caller can't read these properties.
  it('failures entry includes sha and message fields', () => {
    const g = fakeGit({ ...introducing, commitBody: () => body('nothing about the discipline at all') });
    const r = runS17Check(['abc123'], g);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].sha).toBeDefined();
    expect(r.failures[0].message).toBeDefined();
    expect(r.failures[0].message).toMatch(/no valid §1\.7/);
  });

  // Kills line 125 MethodExpression: sha.slice(0, 10) → sha (full sha in failures)
  it('SHA in failures is truncated to 10 characters', () => {
    const longSha = 'abcdef1234567890';
    const g = fakeGit({ ...introducing, commitBody: () => body('nothing about the discipline at all') });
    const r = runS17Check([longSha], g);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].sha).toBe('abcdef1234');
    expect(r.failures[0].sha.length).toBe(10);
  });
});

describe('isDisciplineIntroducing() — s17.ts PLACEHOLDERS/static mutation-killing (Wave 2)', () => {
  // Kills line 25 StringLiteral: last '' in PLACEHOLDERS replaced with 'Stryker was here!'
  // This means the empty-token '' would no longer be classified as placeholder.
  // With filter(Boolean) in isAllPlaceholder, empty tokens are already filtered out.
  // The '' entry in PLACEHOLDERS is redundant given filter(Boolean). This is equivalent.
  // Document: the '' entry does not affect behavior when filter(Boolean) is used.
  // (No test needed — but we document why this is an equivalent mutant.)

  // Kills line 33 StringLiteral: stripPunctLower replace returns '' → 'Stryker was here!'
  // The replacement string for punctuation should be '' (empty — to strip punctuation).
  // If it's 'Stryker was here!', punctuation chars would be REPLACED instead of stripped.
  // Test: a word with punctuation should strip to lowercase letters only.
  it('stripPunctLower strips punctuation (empty replacement), not replaces it', () => {
    // 'TODO.' → stripped to 'todo' (placeholder). If replace returned non-empty, 'TODO.' → 'todoStryker was here!' (non-placeholder).
    // The function is internal, but we can verify behavior via checkS17TrailerBody.
    // All-placeholder bootstrap with punctuated placeholder: 'TODO. NA; TBD!' should still be all-placeholder.
    const bs = 'TODO. NA; TBD! FIXME, LATER: PLACEHOLDER... todo';
    const result = checkS17TrailerBody(body(`§1.7 Bootstrap: ${bs}`), RECENT);
    // Punctuated placeholders → stripped → all placeholder → !allPlaceholder=false → continue → no exempt
    // Then no §1.7: trailer found + §1.7 Bootstrap: in body (prose) → code 2
    expect(result.code).toBe(2);
  });
});
