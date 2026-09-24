# Recap × `/wait-what` reuse — Part B (teaching lines, `/story`, `/arch` domain-modeling; after S4) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the half of the reuse spec that recap-v2 slice S4 edits: four D1 teaching lines
in the recap contract, D1 lines 1-3 in the story spec and `/story`, and `/arch`'s adoption of
mattpocock `domain-modeling` with its vendored text.

**Architecture:** Pack text only; the Stop hook's code is not edited. The `plugin/hooks/lang/`
twins are copied by hand, and the EN contract golden is patched by a one-off script. Three
upstream files are vendored byte-for-byte inside wrappers, and one new test pins their hashes.

**Tech Stack:** bash `lang/*.sh` packs; Markdown; TypeScript + vitest; the repo's regen scripts.

**Spec:** [`2026-09-21-recap-wait-what-reuse-design.md`](../specs/2026-09-21-recap-wait-what-reuse-design.md)
revision 3 — D1, D7, D9, D10, R-17. **Sibling:** [Part A](2026-09-22-recap-wait-what-reuse-part-a.md),
merged first.

## Global Constraints

- Part A's [Global Constraints](2026-09-22-recap-wait-what-reuse-part-a.md#global-constraints)
  apply, except its fence around S4's files: this part edits exactly those files.
- Start only after S4 (aif task `6ae9ecab-efa4-4829-9113-2a45059f2191`) and Part A are merged
  to `staging`. Never redispatch S4.
- **S4 rewrites text this part edits** (`.claude/orchestrator-prompts/plain-words-recap-v2/kickoff-s4.md`
  §0): the story marker becomes «## 🎬 What changed this session», the story body and its
  `story/SKILL.md` sentences are rewritten, and the `/arch` round form lands in §1 next to
  «Frontier pacing». So each edit anchors on a phrase re-read after S4; pre-S4 line numbers
  (read on `574adde27dc`) are hints only.
- Both pack functions are unquoted `cat <<EOF` heredocs: inserted text has no `$` or backtick.
- Upstream bytes are never edited: a vendored body sits in a `prettier-ignore` range, because
  `format-shipped.sh` formats `.claude/skills` whole and prettier rewrites `*emphasis*`.
- Invoke `ai-doc` before a SKILL.md edit, `superpowers:test-driven-development` per test, and
  `self-reflection` before the PR, because parent R-4(b) is reversed in part.
- One PR to `staging` from `feat/recap-wait-what-reuse-part-b`, cut from `staging` after S4.

## File map

| File | Change | Task |
| --- | --- | --- |
| `.claude/hooks/lang/{en,ru}.sh` + `plugin/hooks/lang/{en,ru}.sh` | D1 lines in the contract; story bullets | B1, B2 |
| `packages/core/hooks/end-of-turn-reminder.test.ts` | one new `describe` at the end | B1, B2 |
| `packages/core/hooks/__fixtures__/gate-unarmed-goldens.json` | EN contract text, script-patched | B1 |
| `.claude/skills/story/SKILL.md` | the jargon clauses | B2 |
| `.claude/skills/arch/references/{domain-modeling,CONTEXT-FORMAT,ADR-FORMAT}.md` | create (vendored) | B3 |
| `packages/core/skills/domain-modeling-vendored-body.test.ts` | create | B3 |
| `.claude/skills/arch/SKILL.md` §1 | one paragraph | B3 |
| `CONTEXT.md` header; harmonization spec D-H11 row; register row 253 | one note each | B3 |
| install fingerprints, `MANIFEST.sha256`, `docs/site/reference/B/{arch,story,ai-doc,getff}.md` | regenerate / refresh | B4 |

---

### Task B0: Preconditions and fresh anchors

- [ ] **Step 1: S4 and Part A are merged**

```bash
git fetch origin
git grep -c "AIF_STORY_MARKER='## 🎬 What changed this session'" origin/staging -- .claude/hooks/lang/en.sh
git grep -c 'spelling-uniqueness' origin/staging -- CONTEXT.md
```

Expected: `1`, then `1` or more. Anything less means that part has not landed: stop and wait.

- [ ] **Step 2: Branch** — `git switch -c feat/recap-wait-what-reuse-part-b origin/staging`,
then `git branch --unset-upstream`.

- [ ] **Step 3: Re-read every anchor after S4**

```bash
grep -n -E 'no longer than .*RECAP_MAX_LINES|it is instructions to yourself:' .claude/hooks/lang/en.sh
grep -n -E 'не длиннее .*RECAP_MAX_LINES|а инструкции тебе самому:' .claude/hooks/lang/ru.sh
sed -n '/^aif_msg_eot_branch_story()/,/^}/p' .claude/hooks/lang/en.sh .claude/hooks/lang/ru.sh
grep -n -i -E 'jargon|plain words' .claude/skills/story/SKILL.md
grep -n -E '^\*\*Frontier pacing|round' .claude/skills/arch/SKILL.md
cmp .claude/hooks/lang/en.sh plugin/hooks/lang/en.sh && cmp .claude/hooks/lang/ru.sh plugin/hooks/lang/ru.sh && echo TWINS-IDENTICAL
```

Record each contract's cap and seam lines, the story bullets, each `story/SKILL.md` jargon
clause and what S4 placed after «Frontier pacing». If the twins differ, stop and find out why.

- [ ] **Step 4: Baseline** — run
`PC_LOCAL=1 npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts packages/core/skills packages/core/principles`.
Expected: green. Record the pass count for the PR body. Drop `PC_LOCAL=1` once the PC is up.

---

### Task B1: D1 lines in the recap contract

**Files:** the four pack files; the golden; `packages/core/hooks/end-of-turn-reminder.test.ts`.
**Interfaces:** produces `D1_PACKS`, `D1_PHRASES` and `callPack`, which Task B2's tests reuse.

- [ ] **Step 1: Write the failing test** — append at the end of the test file:

```ts
// Reuse spec D1 (docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md): four
// teaching lines with bad/good examples. Lines 1-3 are block rules and sit before the
// «instructions to yourself» seam; line 4 is about the turn and sits after it. All four pack
// files are sourced, twins included, because no generator rebuilds `plugin/hooks/lang/`.
describe('reuse spec D1 — teaching lines in the recap contract and the story spec', () => {
  const D1_PACKS = [
    ['en', '.claude/hooks/lang/en.sh'],
    ['en', 'plugin/hooks/lang/en.sh'],
    ['ru', '.claude/hooks/lang/ru.sh'],
    ['ru', 'plugin/hooks/lang/ru.sh'],
  ] as const;
  const D1_PHRASES = {
    en: { seam: 'it is instructions to yourself:', growth: 'record it in CONTEXT.md', oldJargon: 'Explain jargon on the spot',
      rules: ['at most 25 words', 'One idea per sentence', 'Write a CONTEXT.md term bare'] },
    ru: { seam: 'а инструкции тебе самому:', growth: 'запиши слово в CONTEXT.md', oldJargon: 'Жаргон объясняй на месте',
      rules: ['до 25 слов', 'Одна мысль — одна фраза', 'Термин из CONTEXT.md пиши голым'] },
  } as const;
  const callPack = (pack: string, fn: string) =>
    spawnSync('bash', ['-c', `source "$1"; ${fn}`, '_', resolve(REPO_ROOT, pack)], { encoding: 'utf8' });

  it.each(D1_PACKS)('%s %s: the contract carries lines 1-3 before the seam, line 4 after it', (lang, pack) => {
    const r = callPack(pack, 'aif_msg_eot_recap_contract');
    expect(r.status, r.stderr).toBe(0);
    const p = D1_PHRASES[lang];
    const seamAt = r.stdout.indexOf(p.seam);
    expect(seamAt).toBeGreaterThan(-1);
    for (const phrase of p.rules) {
      const at = r.stdout.indexOf(phrase);
      expect(at, phrase).toBeGreaterThan(-1);
      expect(at, phrase).toBeLessThan(seamAt);
    }
    expect(r.stdout.indexOf(p.growth)).toBeGreaterThan(seamAt);
  });
});
```

- [ ] **Step 2: Watch it fail** — run
`PC_LOCAL=1 npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts -t 'reuse spec D1'`.
Expected: FAIL in all four cases: `at most 25 words` / `до 25 слов` not found.

- [ ] **Step 3: Edit `.claude/hooks/lang/en.sh`** — in `aif_msg_eot_recap_contract`, insert
after the line «The whole block is no longer than … toward the cap.»:

```text
Sentences in the block are short, at most 25 words. Split a long one in two instead of chaining clauses with colons, dashes and parentheses. Bad: "The test failed — the assert expected the old text (fixed it), green now". Good: "The test failed: the assert expected the old text. I fixed it. The test is green."
One idea per sentence. Bad: "Fixed X, but CI is red because of Y". Good: "Fixed X. CI is red: Y."
Write a CONTEXT.md term bare, as the glossary spells it, and never replace it with a paraphrase. Say jargon that is not in the glossary in plain words. Bad: "did a merge-forward". Good: "merged fresh staging into the branch".
```

and add as the last `•` bullet after the seam, just before `EOF`:

```text
• If the human asked this turn what a word means, explain it in the answer and, in the same turn, record it in CONTEXT.md: the definition plus their spelling under _Operator says_.
```

- [ ] **Step 4: Edit `.claude/hooks/lang/ru.sh`** — after «Весь блок — не длиннее … в лимит не
входит.»:

```text
Фразы в блоке короткие, до 25 слов. Длинную фразу дели на две, а не сцепляй двоеточием, тире и скобками. Плохо: «Тест упал — ассерт ждал старый текст (поправил), теперь зелёный». Хорошо: «Тест упал: ассерт ждал старый текст. Я его поправил. Тест зелёный.»
Одна мысль — одна фраза. Плохо: «Поправил X, но CI красный, потому что Y». Хорошо: «Поправил X. CI красный: Y.»
Термин из CONTEXT.md пиши голым, как в словаре, и не заменяй его пересказом. Жаргон, которого в словаре нет, говори простыми словами. Плохо: «сделал merge-forward». Хорошо: «влил свежий staging в ветку».
```

and as the last `•` bullet after the seam:

```text
• Если человек в этом ходе спросил, что значит слово, — объясни в ответе и в этом же ходе запиши слово в CONTEXT.md: определение и его написание под _Operator says_.
```

- [ ] **Step 5: Copy the twins and check parity**

```bash
cp .claude/hooks/lang/en.sh plugin/hooks/lang/en.sh
cp .claude/hooks/lang/ru.sh plugin/hooks/lang/ru.sh
bash .claude/hooks/lang/check-parity.sh; echo "EXIT=$?"
```

Expected: `EXIT=0`. Task B0 proved the twins identical, so the copy carries only this change.

- [ ] **Step 6: Run the new test, then the whole file** — the Step 2 command passes. The whole
file then fails only in the unarmed golden replay, on the case that carries the EN contract.
That failure is the golden doing its job.

- [ ] **Step 7: Patch the golden** — write `$SCRATCH/patch-golden.mjs` and run it from the
worktree root:

```js
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'packages/core/hooks/__fixtures__/gate-unarmed-goldens.json';
// Each case stores the hook's JSON stdout as a JSON string, so pack text is escaped twice.
const esc2 = (s) => JSON.stringify(JSON.stringify(s).slice(1, -1)).slice(1, -1);
const CAP = 'The whole block is no longer than 15 lines; the fork card does not count toward the cap.';
const LAST = 'The operator must see both open and closed forks.';
const RULES = [
  'Sentences in the block are short, at most 25 words. Split a long one in two instead of chaining clauses with colons, dashes and parentheses. Bad: "The test failed — the assert expected the old text (fixed it), green now". Good: "The test failed: the assert expected the old text. I fixed it. The test is green."',
  'One idea per sentence. Bad: "Fixed X, but CI is red because of Y". Good: "Fixed X. CI is red: Y."',
  'Write a CONTEXT.md term bare, as the glossary spells it, and never replace it with a paraphrase. Say jargon that is not in the glossary in plain words. Bad: "did a merge-forward". Good: "merged fresh staging into the branch".',
];
const GROWTH = '• If the human asked this turn what a word means, explain it in the answer and, in the same turn, record it in CONTEXT.md: the definition plus their spelling under _Operator says_.';
let src = readFileSync(F, 'utf8');
const count = (s) => src.split(s).length - 1;
const n = count(esc2(CAP));
if (n === 0 || count(esc2(LAST)) !== n) throw new Error(`anchors disagree: cap=${n} last=${count(esc2(LAST))}`);
src = src.split(esc2(CAP)).join(esc2([CAP, ...RULES].join('\n')));
src = src.split(esc2(LAST)).join(esc2(`${LAST}\n${GROWTH}`));
writeFileSync(F, src);
console.log(`patched ${n} case(s)`);
```

On `574adde27dc` each anchor occurs once. If Task B0 found a new last seam bullet, set `LAST` to
its closing sentence. Rerun the whole file. Expected: PASS, the golden replay included.

- [ ] **Step 8: Commit**

```bash
git add .claude/hooks/lang/en.sh .claude/hooks/lang/ru.sh plugin/hooks/lang/en.sh plugin/hooks/lang/ru.sh packages/core/hooks/__fixtures__/gate-unarmed-goldens.json packages/core/hooks/end-of-turn-reminder.test.ts
git commit -m "feat(recap): four D1 teaching lines in the recap contract, both packs and twins (reuse spec D1)"
```

---

### Task B2: `/story` carries D1 lines 1-3 (spec D10)

**Files:** the four pack files (`aif_msg_eot_branch_story`); `.claude/skills/story/SKILL.md`;
the Task B1 `describe`.

- [ ] **Step 1: Invoke `ai-doc`** for the SKILL.md edit.

- [ ] **Step 2: Write the failing tests** — inside the Task B1 `describe`, after its `it.each`:

```ts
  it.each(D1_PACKS)('%s %s: the story spec carries lines 1-3 and no «jargon on the spot»', (lang, pack) => {
    const r = callPack(pack, 'aif_msg_eot_branch_story');
    expect(r.status, r.stderr).toBe(0);
    for (const phrase of D1_PHRASES[lang].rules) expect(r.stdout, phrase).toContain(phrase);
    expect(r.stdout).not.toContain(D1_PHRASES[lang].oldJargon);
  });

  it('story/SKILL.md teaches the same thing as the story spec', () => {
    const skill = readFileSync(resolve(REPO_ROOT, '.claude/skills/story/SKILL.md'), 'utf8');
    expect(skill).not.toMatch(/jargon (explained )?on the spot/);
    expect(skill).toMatch(/terms written bare/);
  });
```

Run the Task B1 Step 2 command. Expected: FAIL in the four story cases and the SKILL.md case.

- [ ] **Step 3: The three bullets in both story bodies** — in `aif_msg_eot_branch_story`, put
them where S4's body lists its style rules, replacing the jargon bullet if it survived S4
(pre-S4: «• Explain jargon on the spot — hit a term …»). EN:

```text
• Short sentences, at most 25 words. Split a long one in two instead of chaining clauses with colons, dashes and parentheses. Bad: "The test failed — the assert expected the old text (fixed it), green now". Good: "The test failed: the assert expected the old text. I fixed it. The test is green."
• One idea per sentence. Bad: "Fixed X, but CI is red because of Y". Good: "Fixed X. CI is red: Y."
• Write a CONTEXT.md term bare, as the glossary spells it, and never replace it with a paraphrase. Say jargon that is not in the glossary in plain words. Bad: "did a merge-forward". Good: "merged fresh staging into the branch".
```

RU, replacing «• Жаргон объясняй на месте — …» when it survived:

```text
• Фразы короткие, до 25 слов. Длинную фразу дели на две, а не сцепляй двоеточием, тире и скобками. Плохо: «Тест упал — ассерт ждал старый текст (поправил), теперь зелёный». Хорошо: «Тест упал: ассерт ждал старый текст. Я его поправил. Тест зелёный.»
• Одна мысль — одна фраза. Плохо: «Поправил X, но CI красный, потому что Y». Хорошо: «Поправил X. CI красный: Y.»
• Термин из CONTEXT.md пиши голым, как в словаре, и не заменяй его пересказом. Жаргон, которого в словаре нет, говори простыми словами. Плохо: «сделал merge-forward». Хорошо: «влил свежий staging в ветку».
```

Then repeat Task B1 Step 5.

- [ ] **Step 4: The clauses in `story/SKILL.md`** — each clause teaching jargon explained on the
spot becomes «in short sentences of one idea each, with `CONTEXT.md` terms written bare and
other jargon in plain words», and nothing else in S4's sentence changes. Pre-S4 there were two:
procedure step 2 (`:25-26`) and the summary paragraph (`:43`). If S4 removed both, add the
clause once, to the procedure step that tells the story. Then run
`bash scripts/format-shipped.sh --write .claude/skills/story/SKILL.md` and read the diff.

- [ ] **Step 5: Run and commit** — the Task B1 Step 2 command and
`PC_LOCAL=1 npx vitest run packages/core/skills/emit-story-prompt.test.ts`. Expected: PASS.

```bash
git add .claude/hooks/lang plugin/hooks/lang .claude/skills/story/SKILL.md packages/core/hooks/end-of-turn-reminder.test.ts
git commit -m "feat(story): the story spec and /story carry D1 lines 1-3 instead of «jargon on the spot» (reuse spec D10)"
```

---

### Task B3: `/arch` adopts `domain-modeling` (spec D9)

**Files:** three vendored files, `packages/core/skills/domain-modeling-vendored-body.test.ts`,
`.claude/skills/arch/SKILL.md`, `CONTEXT.md`, the harmonization spec, the register, `open-questions.md`.

- [ ] **Step 1: Confirm the upstream bytes still match the pins**

```bash
U="$HOME/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.3/skills/engineering/domain-modeling"
jq -r '.plugins["mattpocock-skills@mattpocock"][0].gitCommitSha' ~/.claude/plugins/installed_plugins.json
shasum -a 256 "$U/SKILL.md" "$U/CONTEXT-FORMAT.md" "$U/ADR-FORMAT.md"
tail -n +6 "$U/SKILL.md" | shasum -a 256
```

Expected: commit `9c9f36ccd3995266cd675468af71639c8dde1ec5`; `SKILL.md`
`9617041db9b0f6606ecf974e2061c83596b05059b5bb20ddb884c60f147c70e9`; the two format files and the
body hash as pinned in Step 2. Any other value means the cache moved: stop and re-census.

- [ ] **Step 2: Write the failing test** `packages/core/skills/domain-modeling-vendored-body.test.ts` —
the shipped file is the reference copy (this plan's draft drifted from it at execution): six
checks per vendored file — marker order, one trailing newline, body hash equals the pin, a
one-character edit breaks the hash, the provenance table repeats the pin, and a pinned list of
relative links outside fenced blocks, each resolving to a sibling. The body is the text between
the start marker and the one blank line before the end marker (see Step 3).

Run: `PC_LOCAL=1 npx vitest run packages/core/skills/domain-modeling-vendored-body.test.ts`.
Expected: FAIL, because the files do not exist yet.

- [ ] **Step 3: Generate the three files** — write `$SCRATCH/vendor-domain-modeling.mjs` and run
it from the worktree root:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const UP = join(homedir(), '.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.3/skills/engineering/domain-modeling');
const REFS = '.claude/skills/arch/references';
const ROOT = '../../../..';
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const grilling = readFileSync(join(REFS, 'grilling.md'), 'utf8');
const from = grilling.indexOf("## License — upstream's MIT notice, reproduced in full\n");
const to = grilling.indexOf('**Extraction contract');
if (from < 0 || to < from) throw new Error('license section not found in grilling.md');
const sibling = (n) => `The vendored [\`domain-modeling.md\`](domain-modeling.md) body links this file as \`./${n}\`.`;
const FILES = [
  { out: 'domain-modeling.md', src: 'SKILL.md', drop: 5, what: 'the upstream `domain-modeling` skill body',
    why: 'The body links its two format files relatively; both are vendored beside it, so no link dangles.' },
  { out: 'CONTEXT-FORMAT.md', src: 'CONTEXT-FORMAT.md', drop: 0, what: "upstream's `CONTEXT.md` format file", why: sibling('CONTEXT-FORMAT.md') },
  { out: 'ADR-FORMAT.md', src: 'ADR-FORMAT.md', drop: 0, what: "upstream's ADR format file", why: sibling('ADR-FORMAT.md') },
];

for (const f of FILES) {
  const raw = readFileSync(join(UP, f.src), 'utf8');
  const body = raw.split('\n').slice(f.drop).join('\n');
  const md040 = f.drop > 0; // only the skill body has fences without a language (measured)
  const lines = [
    ...(md040 ? ['<!-- markdownlint-disable MD040 -->', ''] : []),
    `# \`${f.out.replace(/\.md$/, '')}\` — vendored upstream text (mattpocock/skills, MIT)`,
    '',
    `> **Authoritative for:** nothing of its own. This file is a **verbatim vendored copy** of ${f.what},`,
    '> carried so that [`../SKILL.md`](../SKILL.md) §1 has a text-fidelity source for the domain-vocabulary',
    "> moves when the `mattpocock-skills` plugin is not installed. The §Upstream body below is upstream's",
    '> wording and upstream owns it; this repo owns only the wrapper.',
    '> **NOT authoritative for:** the four bindings `/arch` layers over the moves, which override the body',
    "> where the two differ — for example, `CONTEXT.md` records the operator's own words under",
    "> `_Operator says_` where upstream's format uses `_Avoid_`; see [`../SKILL.md`](../SKILL.md) §1. The",
    `> verdict that admitted this text — see [SSOT #253](${ROOT}/docs/meta-factory/prior-art-evaluations.md)`,
    `> and [reuse spec D9](${ROOT}/docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md).`,
    `> Project goal — see [README.md#why-this-exists](${ROOT}/README.md#why-this-exists).`,
    '',
    '> **Why vendored rather than installed.** `/arch` ships to every `env`+ consumer, and the',
    '> `mattpocock-skills` plugin is not in the companions manifest, so a consumer without the plugin',
    `> would have no text to read. ${f.why}`,
    '',
    '## Provenance',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Upstream | [github.com/mattpocock/skills](https://github.com/mattpocock/skills) — \`skills/engineering/domain-modeling/${f.src}\` |`,
    '| License | MIT — Copyright (c) 2026 Matt Pocock |',
    '| Marketplace commit | `9c9f36ccd3995266cd675468af71639c8dde1ec5` (recorded in `installed_plugins.json`, installed 2026-08-17) |',
    `| Upstream file sha256 | \`${sha(raw)}\` (the whole cached \`${f.src}\`) |`,
    `| Vendored body sha256 | \`${sha(body)}\` (${f.drop ? 'upstream minus its 5-line frontmatter' : 'the whole upstream file'}, byte for byte the §Upstream body below) |`,
    '| Censused | 2026-09-22 |',
    '',
    "**The plugin's declared version `1.2.3` does NOT identify this text** — see the same paragraph in",
    '[`grilling.md`](grilling.md). Re-census against the commit SHA and the two hashes above.',
    '',
    '**Deviations from the upstream bytes:** none in the body. The wrapper adds the `prettier-ignore`',
    "range around the body, because `scripts/format-shipped.sh` formats `.claude/skills` whole and prettier",
    `rewrites upstream's \`*emphasis*\` (measured 2026-09-22)${md040 ? ', and the `markdownlint-disable MD040` directive at the top, so the fences without a language survive' : ''}.`,
    '',
    `**Re-census trigger:** upstream's \`skills/engineering/domain-modeling/${f.src}\` no longer hashes to the`,
    'upstream-file sha256 above → diff it, refresh all three vendored files, and append a dated note to SSOT #253.',
    '',
    grilling.slice(from, to).trimEnd(),
    '',
    '**Extraction contract — the byte-identity gate depends on it.** Everything between the',
    '`prettier-ignore-start` line after the next heading and the one blank line before the',
    '`prettier-ignore-end` line IS the upstream body and must hash to the «Vendored body sha256» above;',
    'only one newline follows the end marker. The blank line keeps the end marker out of a body that',
    'ends in a list, where Markdown would read it as part of the last item. Enforced by `packages/core/skills/domain-modeling-vendored-body.test.ts`.',
    '',
    '## Upstream body (verbatim — do not edit)',
    '',
    '<!-- prettier-ignore-start -->',
  ];
  writeFileSync(join(REFS, f.out), `${lines.join('\n')}\n${body}\n<!-- prettier-ignore-end -->\n`);
  console.log(f.out, sha(body));
}
```

The three printed hashes must equal the test's pins. Then run
`bash scripts/format-shipped.sh --write .claude/skills/arch/references/domain-modeling.md .claude/skills/arch/references/CONTEXT-FORMAT.md .claude/skills/arch/references/ADR-FORMAT.md`
so prettier pads the provenance table; if it leaves the tables unpadded, run `npx prettier --write`
on the three files and re-run `format-shipped.sh --check`. Read the diff: only wrapper lines may change.

- [ ] **Step 4: Run the test** — the Step 2 command. Expected: PASS, 18 tests (6 × 3 files).

- [ ] **Step 5: Invoke `ai-doc`, then add the `/arch` §1 paragraph** — at the end of §1, after
«Frontier pacing» and the round-form text S4 put beside it:

```markdown
**Domain vocabulary (ADOPT-with-bindings of mattpocock `domain-modeling`, [reuse spec D9](../../../docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md); [SSOT #253](../../../docs/meta-factory/prior-art-evaluations.md)).** In idea sessions, invoke `mattpocock-skills:domain-modeling` next to `grilling` — upstream's own pairing — and run its whole «During the session» chapter, ADRs included (`docs/adr/`, created lazily). Read the moves from the upstream text, never from a paraphrase here; when the plugin is absent, say so and read the vendored copy [`references/domain-modeling.md`](references/domain-modeling.md) (byte-identical body, SHA-pinned, with its two format files beside it). This contour owns four bindings: (i) `CONTEXT.md` records the operator's raw words under `_Operator says_` where upstream's format uses `_Avoid_`; (ii) a challenge or a «X or Y?» question is about what a word _means_ — never tell the operator to stop using their word; a different spelling of a known term is mapped silently per the `CONTEXT.md` header, not challenged; (iii) the moves run only inside idea sessions — `CLAUDE.md` «Skill routing bindings» carries the same limit for every other session; (iv) an ADR points at the spec that owns the argument and never restates it ([doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md)).
```

Then `bash scripts/format-shipped.sh --write .claude/skills/arch/SKILL.md` and read the diff.

- [ ] **Step 6: Four notes**

1. `CONTEXT.md` header — `Consumers: the `/wait-what` skill (operator-invoked).` becomes
   ``Consumers: the `/wait-what` skill (operator-invoked) and `/arch` idea sessions, which run
   upstream `domain-modeling` with the operator ([reuse spec D9](docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md#d9-arch-adopts-mattpocock-domain-modeling-parent-r-4-is-reversed-in-part);
   parent recap-v2 R-4(b) is reversed there in part).``, with the blockquote reflowed.
2. Harmonization spec, D-H11 row — append inside its Resolution cell, on the same line, before
   the cell's closing ` |`: ` **Superseded in part 2026-09-22 ([reuse spec D9](2026-09-21-recap-wait-what-reuse-design.md)):** `/arch` idea sessions adopt the whole «During the session» chapter, ADRs included — «ADR dir REJECT» is reversed; the operator's words stay under `_Operator says_`.`
3. Register row 253 — set its `Last reviewed` cell to today (`date +%F`) and append before the
   row's final ` |`: ` **Note (<today>, [reuse spec](../superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md) D9/R-19):** a second body from the same marketplace commit — `domain-modeling` plus `CONTEXT-FORMAT.md` and `ADR-FORMAT.md` — is vendored beside `grilling.md` under `.claude/skills/arch/references/`, ADOPT-with-bindings in `/arch` idea sessions, ADRs adopted; gated by `packages/core/skills/domain-modeling-vendored-body.test.ts`.`
4. `docs/meta-factory/open-questions.md` §13.20 — append to its `**Status:**` line, after one space: ``**Superseded in part 2026-09-22** ([reuse spec D9/R-19](../superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md)): `/arch` idea sessions write upstream-format ADRs, created lazily in `docs/adr/`; a later promotion of this entry uses that directory, not a second `docs/adrs/`, and ADRs for supersedes stay deferred.``

Check: the `wc -l` of the harmonization spec and of `open-questions.md` is unchanged, and both principle-42 tests pass.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/arch packages/core/skills/domain-modeling-vendored-body.test.ts CONTEXT.md docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md docs/meta-factory/prior-art-evaluations.md docs/meta-factory/open-questions.md
git commit -F - <<'MSG'
feat(arch): adopt mattpocock domain-modeling in idea sessions, vendored and hash-pinned (reuse spec D9)

The whole upstream body plus its two format files, byte-identical inside a
prettier-ignore range, pinned by one sha256 each. /arch owns four bindings
over the moves; ADRs are adopted, reversing D-H11's ADR REJECT.

Prior-art: prior-art-evaluations.md#253 (second vendored body from the grilling marketplace commit, ADOPT-with-bindings)
MSG
```

---

### Task B4: Regeneration chain and the reference pages

- [ ] **Step 1: Regenerate** (order from `kickoff-s4.md` §3; measure the drift before capturing)

```bash
git status --short
SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh > "$SCRATCH/snap.log" 2>&1; echo "EXIT=$?"
bash scripts/build-getff-dist.sh
PC_LOCAL=1 npx tsx scripts/render-reference.mjs --check; echo "EXIT=$?"
PC_LOCAL=1 npx tsx scripts/render-face-facts.mjs --check; echo "EXIT=$?"
git status --short
```

Expected derived set, after `kickoff-s4.md` §3: the install fingerprints (env+ ones gain the
three `references/` files), `packages/getff/MANIFEST.sha256`, and the generated hook twin if
pre-commit rebuilt it. A path outside that set is a STOP. On a `--check` failure, run that
renderer with `--write` and read its diff.

- [ ] **Step 2: Refresh the pages the gate names** — run
`node scripts/check-docs-refresh.mjs origin/staging..HEAD; echo "EXIT=$?"`. Expected: the four
`docs/site/reference/B/` pages. A page whose prose changed meaning gets a real refresh:

- `arch.md` names `grilling.md` as the vendored copy and cites a fingerprint line (pre-S4
  `:118-121`). Name all four vendored files and re-point the line to where the capture moved
  `grilling.md`: `grep -n 'arch/references/grilling.md' tests/install-sh/baselines/ts-server/greenfield.fingerprint`.
- `story.md` quotes the story body from the printed output of
  `AIF_HOOK_LANG=en bash .claude/skills/story/helpers/emit-story-prompt.sh`. Re-run it and quote
  the three new bullets from that output.
- `ai-doc.md` and `getff.md` cite only the fingerprint. Check that every line they quote is
  unmoved, then rewrite the token: `docs-refresh: deferred — re-verified <today>: the cited
  install fingerprint gained three arch/references lines; no line or path this page cites
  moved; clears at the next gold refresh of this page`.

Rerun the gate. Expected: `EXIT=0`.

- [ ] **Step 3: Commit** — add each path Step 1 listed, by name, plus the refreshed pages:

```bash
git add tests/install-sh/baselines packages/getff/MANIFEST.sha256 docs/site
git commit -m "chore(regen): fingerprints, dist manifest and reference pages for the reuse slice"
```

---

### Task B5: Gates, review, PR, merge, re-measure task

- [ ] **Step 1: Full gate sweep**

```bash
PC_LOCAL=1 npx vitest run packages/core
PC_LOCAL=1 npx tsc --noEmit -p packages/core
bash .claude/hooks/lang/check-parity.sh
node scripts/check-line-citations.mjs --check --corpus
bash scripts/build-getff-dist.sh --check
PC_LOCAL=1 bash scripts/run-local-ci-sweep.sh > "$SCRATCH/sweep-b.log" 2>&1; echo "EXIT=$?" >> "$SCRATCH/sweep-b.log"
```

Expected: every command exits 0. The sweep runs `tests/install-sh/lychee-shipped-md-offline.test.sh`,
which proves the wrapper links survive the install-time link transform.

- [ ] **Step 2: `self-reflection`, then cold review** — `getff:review-sidecar` on
`git diff origin/staging...HEAD`, given paths only.

- [ ] **Step 3: PR and §1.7 check** — `git push -u origin feat/recap-wait-what-reuse-part-b`,
then open the PR with the sections of Part A Task A6 Step 2. The Test plan names the golden
replay failing before Task B1 Step 7 and passing after it. Then run
`getff:compliance-verifier` on the body.

- [ ] **Step 4: CI and merge** — the three commands of Part A Task A6 Step 4, then
`gh pr merge <PR> --squash`.

- [ ] **Step 5: R-17 re-measure task** — right after the merge, load
`mcp__scheduled-tasks__create_scheduled_task` with ToolSearch and create a one-shot task dated
the merge day plus 14 days. Its prompt runs these commands in the repo and reports R-10…R-14
and R-18 to the operator:

```bash
python3 scripts/measure/measure-recap-sentences.py --since <merge day>
python3 scripts/measure/measure-term-reasks.py
python3 scripts/measure/measure-interaction-shape.py --days 35 --dedup
```

The done-claim names the task id; a merge without it is incomplete (spec D7 step 3).

## Self-review

- **Spec coverage.** D1 lands in B1, D10 in B2, D9 in B3, D7's regeneration chain and pages in
  B4, R-17 in B5. Part A carries D8, D11, the `CLAUDE.md` line and the spec amendments.
- **S4 drift.** No step pastes a pre-S4 paragraph back: B2 and B3 patch a clause or append,
  anchored on phrases that Task B0 re-reads.
- **Placeholders.** `<merge day>`, `<today>` and `<PR>` are known only at execution, and each
  step says where the value comes from.
- **Names.** `D1_PACKS`, `D1_PHRASES` and `callPack` are defined in B1 and reused in B2. The
  three pins agree in B3's test, the generator output and the Step 1 check.
