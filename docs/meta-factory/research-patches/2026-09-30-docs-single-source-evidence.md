<!-- scope:docs-single-source-evidence -->
# Docs single source — the measurements behind the top-level design

> Scope: the evidence behind the numbers in
> [2026-09-30-docs-single-source-design.md](../../superpowers/specs/2026-09-30-docs-single-source-design.md)
> «Measured facts», and the F7 skill comparison. Measured at `origin/staging` `26ccdc6b160` unless
> marked (`9f69fa2097c` = its first parent, PR #1940). Scratch scripts are reproduced here because
> the session scratchpad is not durable (row SCOPE-U, OP-48).

## Problem

The owner asked for one source of truth for ALL documentation, for the AI and for the human,
current by mechanism, not by attention (OP-19, see the operator-log patch). The design has to
stand on measured facts about today's docs, gates and installs, not on impressions. Every number
in the spec's «Measured facts» section is reproduced below with its method.

## Root Cause

Today documentation stays current only by attention:
- the D26 refresh gate accepts a deferral token that never expires
  (`scripts/check-docs-refresh.mjs:302-346`), and every site page carries one;
- the gate binds a page to whole source FILES, so most alarms are noise, and noise is answered
  with a token;
- entry docs sit outside the citation gate, and the goal is typed by hand in seven places.

### Deferral tokens by their own reason (full population, measured at `9f69fa2097c`)

Method: every token (`grep -rn "docs-refresh: deferred" docs/site`, 66 hits on 61 of 61 pages
at `9f69fa2097c`; 65 on 60 of 61 at `26ccdc6b160`) classified by its reason text. The reason is
prose an agent wrote; each claim was not re-verified (a judgment, not a mechanical count).

| Class | Count | What the reason says |
|---|---|---|
| A | 31 | the cited source changed only in a part this page does not use |
| C | 25 | «page authored from the cited sources at this pin»: the page was born with the token, no triggering change (introduced in #1850 `46db92c60b2`, plus `2a16a96e14b`, `31884bb210f`) |
| B1 | 5 | the page was refreshed in the range, and the refresh only renumbered line citations after an insertion above them |
| B2 | 4 | the page was refreshed in the range with real content (#11, #14, #16, #46) |
| D | 1 | real alarm, the page was re-verified and needed no edit (#65, `understand/why-a-rule-must-prove-it-fires.md`) |

Classes A, C and B1 are the ones a named-place binding would not have produced: 31 + 25 + 5 =
61 of 66. B2 and D (5 of 66) are real alarms. Under a working gate those are handled by
refreshing the page, not by a token.

Classes A, C and B1 (61 of 66) are alarms a named-place binding would not have raised.

### File binding vs named-place binding: replay of 50 merges

Range `46db92c60b2..9f69fa2097c`, 50 first-parent steps (2026-09-27 … 2026-09-29), every page
at every step (3050 page-steps), no sampling. Per step A→B and page:
- **file alarm:** a hand-written cited source changed (derived JSON excluded, as in the gate);
- **silent:** every cited block at A is still present verbatim in B, every cited section
  byte-equal;
- **real:** some cited block or section changed;
- **unbound:** the moved source is cited only as a bare path.

Result: `fileAlarm 626, silent 245, real 27, unbound 354` (39.1 % / 4.3 % / 56.5 %). The 354
unbound page-changes fall on 50 pages over 27 merges; `install.sh` is among the moved sources in
48 of them, `setup.d/lib.sh` in 44. The 27 real alarms fall on 12 merges.

Script (scratch, run from a clone root: `node _measure-binding.mjs 46db92c60b2 9f69fa2097c`).
It imports `scripts/_probe-cit.mjs`, a copy of `scripts/check-line-citations.mjs` at
`9f69fa2097c` with two added lines: `export const CITES = [];` and, in the citation loop,
`CITES.push({ srcFile: rel, target, n, end: end ?? n, srcLine });`.

```js
// Scratch measurement (not repo code): per first-parent merge step, compare the D26 refresh
// gate's file binding (changed files ∩ cited sources) with a named-place binding (the cited
// line block or cited markdown section still present unchanged in the new version).
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const show = (rev, p) => { try { return git('show', `${rev}:${p}`); } catch { return null; } };
const [FROM, TO] = process.argv.slice(2);
const { isDerivedSource } = await import('./scripts/check-docs-refresh.mjs');

function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.mdx?$/.test(e.name)) out.push(p);
  }
  return out;
}
function sourcesOf(text) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text); if (!fm) return [];
  const out = []; let on = false;
  for (const l of fm[1].split('\n')) {
    if (/^sources:\s*$/.test(l)) { on = true; continue; }
    if (on) { const m = /^\s+-\s+(\S+)/.exec(l); if (m) out.push(m[1].replace(/^['"]|['"]$/g, '')); else if (/^\S/.test(l)) on = false; }
  }
  return out;
}
const slug = (h) => h.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
function section(text, anchor) {
  if (text === null) return null;
  const L = text.split('\n'); let start = -1, lvl = 0;
  for (let i = 0; i < L.length; i++) { const m = /^(#{1,6})\s+(.*)$/.exec(L[i]); if (m && slug(m[2]) === anchor) { start = i; lvl = m[1].length; break; } }
  if (start < 0) return null;
  let end = L.length;
  for (let i = start + 1; i < L.length; i++) { const m = /^(#{1,6})\s/.exec(L[i]); if (m && m[1].length <= lvl) { end = i; break; } }
  return L.slice(start, end).join('\n');
}
function anchorsOf(pageRel, text) {
  const out = []; const re = /\]\(([^)\s#]+\.mdx?)#([^)\s]+)\)/g; let m;
  while ((m = re.exec(text))) out.push({ target: normalize(join(dirname(pageRel), m[1])), anchor: m[2] });
  return out;
}

const steps = git('rev-list', '--first-parent', '--reverse', `${FROM}..${TO}`).trim().split('\n');
const tally = { steps: 0, pageSteps: 0, fileAlarm: 0, refreshed: 0, real: 0, unbound: 0, silent: 0 };
const rows = [];
for (const B of steps) {
  const A = git('rev-parse', `${B}^1`).trim();
  const changed = new Set(git('diff', '--name-only', A, B).trim().split('\n').filter(Boolean));
  git('checkout', '-q', '--detach', A);
  const mod = await import(`./scripts/_probe-cit.mjs?${A}`);
  tally.steps++;
  for (const page of walk('docs/site')) {
    const text = readFileSync(page, 'utf8');
    const moved = sourcesOf(text).filter((s) => changed.has(s) && !isDerivedSource(s));
    tally.pageSteps++;
    if (moved.length === 0) continue;
    tally.fileAlarm++;
    if (changed.has(page)) tally.refreshed++;
    mod.CITES.length = 0;
    try { mod.scanFile(page); } catch {}
    const lineCites = mod.CITES.filter((c) => c.srcFile === page);
    const anchorCites = anchorsOf(page, text);
    let realHit = [], bare = [];
    for (const s of moved) {
      const lc = lineCites.filter((c) => c.target === s);
      const ac = anchorCites.filter((c) => c.target === s);
      if (lc.length === 0 && ac.length === 0) { bare.push(s); continue; }
      const oldT = show(A, s), newT = show(B, s);
      for (const c of lc) {
        const blk = oldT === null ? null : oldT.split('\n').slice(c.n - 1, c.end).join('\n');
        if (blk !== null && blk.trim().length < 8) { realHit.push(`TRIVIAL ${s}:${c.n}`); continue; }
        if (blk === null || newT === null || !newT.split('\n').join('\n').includes(blk)) realHit.push(`${s}:${c.n}${c.end !== c.n ? '-' + c.end : ''}`);
      }
      for (const c of ac) {
        if (section(oldT, c.anchor) !== section(newT, c.anchor)) realHit.push(`${s}#${c.anchor}`);
      }
    }
    const verdict = realHit.length ? 'real' : bare.length ? 'unbound' : 'silent';
    tally[verdict]++;
    rows.push({ step: B.slice(0, 11), page, moved: moved.length, refreshed: changed.has(page), verdict, realHit: realHit.slice(0, 4), bare });
  }
}
git('checkout', '-q', '--detach', TO);
console.log(JSON.stringify({ tally, rows }, null, 1));
```

### Doc classes (zero three), measured at `9f69fa2097c`

One class per tracked `*.md` (1570 files at `9f69fa2097c`; 1573 at `26ccdc6b160`), first match
wins:

| Class | Predicate (mechanical) | Count |
|---|---|---|
| fixture | path has a `test(s)/` or `fixture(s)/` segment | 35 |
| rendered: plugin twin | under `plugin/` | 21 |
| rendered: whole file | first 8 lines say «do not hand-edit», «generated by» or «auto-generated» | 50 |
| bound | frontmatter has a `sources:` list | 67 |
| history: dated-record dir | `docs/meta-factory/{retros,research-patches,audits,history}/`, `docs/superpowers/{specs,plans}/`, `docs/audits/`, `closed-questions.md`, `PROPOSAL.md` | 435 |
| history?: work record | `.claude/orchestrator-prompts/`: kickoffs, reports, handoffs. Whether these count as «history» is a definition choice | 730 |
| pointer? | 25 or fewer non-blank lines and at least one link: a noisy proxy that also catches short skills | 11 |
| partly rendered | has a `<!-- *:begin … plan=` region, the rest hand-written | 4 |
| **unclassified** | none of the above | **217** |

The 217 by area:

| Area | Files |
|---|---|
| skills (`.claude/skills/`, `skills/`) | 59 |
| `docs/meta-factory` top level (phase prompts, research, `EXECUTION-PLAN.md`, `open-questions.md`, `operational-conventions.md`) | 51 |
| `.claude/rules/` | 29 |
| `agents/` | 21 |
| `packages/` READMEs and design docs | 20 |
| `docs/meta-factory` subdirs (`triage-corpus/`, `generator-forbid-mvp/`) | 13 |
| `packages/core/templates/`, shipped to consumers (`RULES.md`, `ARCHITECTURE.*`, `tier-home.md`, skill-context `SKILL.md`s) | 9 |
| repo root (`README`, `AGENTS`, `CLAUDE`, `CONTEXT`, `CONTRIBUTING`, `INSTALL*`, `LICENSE`, `AUDIT-*`) | 8 |
| other | 7 |

The spec classes `docs/superpowers/specs/` as history once a design is built (review round 1,
MAJOR-7); the «history?: work record» row is governed by H-Q2 + H-Q4 (`done.md`, idle clock).

```js
// Scratch measurement (not repo code): put every tracked *.md into one class by a stated,
// mechanical predicate, first match wins, and list what falls in none.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z', '*.md'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const HISTORY_RE = /^(docs\/meta-factory\/(retros|research-patches|audits|history)\/|docs\/superpowers\/(specs|plans)\/|docs\/audits\/|docs\/meta-factory\/(closed-questions|PROPOSAL)\.md$)/;
const WORK_RECORD_RE = /^\.claude\/orchestrator-prompts\//;
const FIXTURE_RE = /(^|\/)(tests?|__tests__|fixtures?)\//;
const classes = {};
const out = [];
for (const f of files) {
  let t = '';
  try { t = readFileSync(f, 'utf8'); } catch { continue; }
  const head = t.split('\n').slice(0, 8).join('\n');
  const lines = t.split('\n').filter((l) => l.trim()).length;
  let c;
  if (FIXTURE_RE.test(f)) c = 'fixture';
  else if (/^plugin\//.test(f)) c = 'rendered:plugin-twin';
  else if (/do not hand-edit|DO NOT EDIT|generated by|auto-generated/i.test(head)) c = 'rendered:whole-file';
  else if (/^---\n[\s\S]*?\nsources:\s*\n[\s\S]*?\n---/.test(t)) c = 'bound:sources-frontmatter';
  else if (HISTORY_RE.test(f)) c = 'history:dated-record-dir';
  else if (WORK_RECORD_RE.test(f)) c = 'history?:orchestrator-work-record';
  else if (lines <= 25 && /\]\([^)]+\)/.test(t)) c = 'pointer?:short-with-link';
  else if (/<!--\s*[\w-]*:begin\b[^>]*\bplan=/.test(t)) c = 'partly-rendered:has-generator-region';
  else c = 'UNCLASSIFIED';
  classes[c] = (classes[c] || 0) + 1;
  out.push(`${c}\t${lines}\t${f}`);
}
console.log(JSON.stringify(classes, null, 1));
const un = out.filter((l) => l.startsWith('UNCLASSIFIED') || l.startsWith('partly'));
const byDir = {};
for (const l of un) { const f = l.split('\t')[2]; const d = f.split('/').slice(0, f.startsWith('docs/') || f.startsWith('.claude/') ? 3 : 1).join('/'); byDir[d] = (byDir[d] || 0) + 1; }
console.log(Object.entries(byDir).sort((a, b) => b[1] - a[1]));
import('node:fs').then((fs) => fs.writeFileSync('../md-classes.tsv', out.join('\n') + '\n'));
```

## Solution

The design in the spec: a generated fact layer, named-place binding with a lock that is a
verification record, one relink action audited at the PR boundary, doc classes, and the passport
region as the one home of decided statements. The other measured facts it stands on:

| Fact | Command / source | Value |
|---|---|---|
| Stale citations in entry docs outside the citation gate | `node scripts/check-line-citations.mjs --check --show-skips README.md INSTALL-FOR-AI.md INSTALL.md docs/meta-factory/EXECUTION-PLAN.md packages/core/templates/shared/first-steps.source.json` | 20 stale of 27 resolved (18 at `9f69fa2097c`); the tool suggests a line for 13 |
| Tracked umbrellas with `done.md` | `git ls-tree -d origin/staging:.claude/orchestrator-prompts` → 355; `git ls-files '.claude/orchestrator-prompts/*/done.md'` → 327 | 327 of 355 |
| Goal typed by hand | `git grep -n "silently bypass undocumented"` outside history dirs | 7 places (listed in the spec) + 4 tagline places |
| Renderers | `ls scripts/render-*.mjs` | 10; 6 run `--check` in CI (`.github/workflows/audit-self.yml:293,298,300,304,308,1394`) |
| cargo / go deliver no passport | `grep -c DESCRIPTION tests/install-sh/baselines/{cargo,go}/*.fingerprint` | 0 on all four; 2 on each python fingerprint |
| H1: the agent container can run the docs gate | `/opt/homebrew/bin/docker --context pc exec -u node aif-agent-1 …` (2026-09-29T18:31Z) | Node v22.23.3, git 2.39.5, non-shallow linked worktrees, 2144 commits, tsx present |
| T-Q4: the passport can be tracked | `.gitignore:93` ignores `/.ai-factory/*` for the aif dirty-worktree guard; a committed file is not uncommitted work | not triggered; overwrite carve-outs `setup.d/lib.sh:889` (`--force`), `agents/aif-init.md:191` (`<PLACEHOLDER>`) |
| Firing rate of the B-Q2 gate (OP-47, OP-50) | last 50 first-parent commits at `26ccdc6b160`, a rough grep over each commit's added markdown lines outside history dirs (moved lines counted; exact command not preserved) | 26 change live markdown; 24 add a line with a digit; 22 add a backticked path (the OP-47 trigger) |

## F7 — which skill is reused for human docs

Decided A (OP-46). Upstream: `addyosmani/agent-skills` `skills/documentation-and-adrs/SKILL.md`,
last commit `cda4542ade0f` (2026-09-07), 288 lines, MIT, release 0.6.11; PR #514 «Documentation
Drift» open, not merged (re-checked live 2026-09-29). Line counts are non-blank lines.

### F7.1. The site-free core of `docs-author`

Read by hand, line by line; this replaces the regex proxy of round 6. **Core: 89 non-blank
lines, plus 16 that fit once the fact layer ships.** (Recount by the r6 bottom-up review: the
ADAPT row is 15, not 13.)

| File:lines | Content | Verdict | Non-blank |
|---|---|---|---|
| `SKILL.md:37` | one page = one kind, closed set | core | 1 |
| `SKILL.md:45-47` | kinds `learn-tutorial`, `guide`, `understand` | core (the Diátaxis tutorial / how-to / explanation) | 3 |
| `SKILL.md:43-44` + `page-kinds.md:15-32` | `reference-sheet` (band A = generated fence), `family-overview` (generated table) | ADAPT: this is the fact-layer page shape of picture statement 2; it generalises once a consumer gets the fact layer | 15 |
| `SKILL.md:48-49` + `page-kinds.md:57-69` | `face-page`, `glossary` (`terms.md`) | site-only | 12 |
| `SKILL.md:53-56` | five reader questions FIND / UNDERSTAND / DO / TRUST / SAME WORDS | core | 4 |
| `SKILL.md:57-58`, `criteria-card.md:29-38` | the card is filled per commit (`Docs-card:` trailer), a cold auditor diffs it | bound to getff gates; ships only if P3 ships the gate | 11 |
| `SKILL.md:60-71` | craft contract: why before how, second person, progressive disclosure, example lives once, split dashes, glossary terms | core | 11 |
| `SKILL.md:73-78` | glossary duty | principle is core («one glossary, coin a term there first»); path and regions are site-only | — |
| `SKILL.md:82-83`, `:90-92` | checklist: examples executed with real output; glossary links; «seed a defect once before trusting a green» | core | 5 |
| `SKILL.md:84-88` | `docs-check.mjs`, `Docs-card:` trailer | bound to getff gates | — |
| `SKILL.md:96-98`, `:100` | refresh: rework touched pages only, scope is the diff | core | 4 |
| `SKILL.md:99` | `docs-refresh: deferred` token | **conflicts with register row M4** (no standing deferral token) → drop | — |
| `SKILL.md:20-33` | pointer to pfeff `diataxis`, pin `657c61c5ca8c`, host-hand install | **drop**: pfeff withdrawn (OP-25); a host hand is a manual step | 12 |
| `page-kinds.md:10-13`, `:34-55` | closed-set rule; skeletons of tutorial / guide / understand | core | 19 |
| `criteria-card.md:15-24`, `:26` | C1-C10, C12 | core | 11 |
| `criteria-card.md:25`, `:27` | C11 (`llms.txt` twin); C13 (`sources:` frontmatter) | C11 site-only; C13 = the binding input of register row F9 → ADAPT | 2 |
| `craft.md:12-56` | long form of the craft contract | core; examples at `:18-20` speak of getff's renderer → rewrite | 31 |
| `references/gold/*` | five frozen getff pages | site-only | 770 total / 629 non-blank (five pages) |

What the core lacks, in the upstream skill's own terms: code comments, API docs, README
structure, changelog. Neither skill has a one-source section: PR #514 is open, and in
`docs-author` only «an example lives once» (`:67-68`) and the glossary's one home point that
way.

### F7.2. The upstream skill, section by section

| Lines | Section | Non-blank | Against the register / our stack | Keep? |
|---|---|---|---|---|
| 6-21 | Overview + When to Use: «Document decisions» | 11 | its «why» home is ADRs; ours is the passport (T-Q4) | drop |
| 23-101 | Architecture Decision Records | 56 | contradicts R3 (OP-37) and SSOT #255 (`prior-art-evaluations.md:328`) | **drop** |
| 102-150 | Inline documentation: comment the why; no TODO; no commented-out code; document gotchas | 39 | we have nothing like it (`grep -rlE 'When NOT to [Cc]omment|inline comment|gotcha'` over `.claude/skills skills agents packages/core/templates` hits only `pipeline` and `harvest`, where «gotcha» means a git trap). `:145` cites «ADR-003» → strip | keep |
| 156-175 | API docs inline with types, headed «Preferred for TypeScript» (TSDoc) | 18 | stack-specific. Under C-Q1 the base is stack-free and the stack part is generated by the agent at install (lanes python / cargo / go, N-Q3). So this block is a SEED for the npm-lane generated part, not base text; the base keeps one stack-free line «document public APIs in the language's native doc form» | seed of the generated part |
| 176-198 | OpenAPI / Swagger example | 22 | ours is a shipped RULE with a declared check: `packages/core/templates/shared/integration-rules.md:23-28` (OpenAPI generated from Zod); the check itself is a placeholder command today (`packages/core/manifest/rules-manifest.json:419`, `liveness-mode: workflow-exists`), so «stronger than prose» was overstated (r6 bottom-up MINOR-N6). The drop stands: the topic has its home | drop (ours) |
| 200-229 | README template | 23 | it types commands and install steps by hand (`:209-221`): exactly the duplication register rows F10 + R2 remove by rendering. `:225` «Link to ADRs» contradicts R3 | drop (advisor E3 concurs) |
| 231-248 | Changelog, hand-written per release | 13 | NOT a register row: the lead's own argument is that a hand-typed release list is a second home for merged-PR facts. What holds as ground: getff has no changelog file on staging (advisor E3: `git ls-tree -r --name-only origin/staging \| grep -iE '(^\|/)CHANGELOG'` → empty), no demand data, no mechanism behind it | drop (argued) |
| 250-257 | Documentation for agents | 6 | `ai-doc` owns this (F6); one bullet is ADRs | drop (ours) |
| 259-267 | Rationalizations | 8 | `:266` is the ADR row | keep 7 |
| 269-277 | Red flags | 8 | `:276` ADRs; `:271` decisions without written rationale (ADR-adjacent, R3); `:273` README how-to-run (stands on the dropped README section) | keep 5 |
| 279-288 | Verification | 8 | `:283` ADRs; `:284` README coverage (dropped section); `:288` rules files current (`ai-doc`'s) | keep 5 |

- The «nothing like it» claims rest on ONE grep phrasing (a one-phrasing negative, not the
  6-item check).
- **Narrow part, base:** about 55 non-blank lines (38 + 7 + 5 + 5).
- **Seed of the generated npm-lane part:** 18 lines (TSDoc).
- **What the text is.** After line-level stripping (`:145`, `:266`, `:271`, `:273`, `:276`,
  `:283`, `:284`, `:288`) the text matches no contiguous upstream range. It is an **adapted
  text under MIT with attribution**, not a pinned copy. The precedent test pins a contiguous
  tail (`packages/core/skills/domain-modeling-vendored-body.test.ts:19-20`, `tail -n +6`).
- **Upkeep mechanism (corrected after the r6 review, both seats).** The precedent test does NOT
  compare with upstream (`domain-modeling-vendored-body.test.ts:4-6`); its re-census trigger is
  prose. So upkeep is a scheduled deterministic check on the pattern of
  `.github/workflows/pin-freshness.yml`: fetch the upstream file's current blob sha, fail when it
  differs from the one recorded at `cda4542ade0f`, name the file to re-read. The re-read is agent
  work. Who picks up a red scheduled run is a known open detail (same gap as `pin-freshness.yml`).

### F7.3. Options for the operator

Operator's earlier word, OP-25 (draft `:1016-1021`), a leaning with question marks, not a
choice: «addyosmani может тогда сразу им заменить полностью diataxis везде? Я за!  а там где
нужно типы страниц: учебник, инструкция, справка, объяснение - пишим свой на основе diataxis».
The operator chose A (OP-46).

- **A. Own core + narrow part of addyosmani.**
  - The shipped human-docs skill is the site-free core of `docs-author` (89 lines, plus 16
    once the fact layer ships; was 14).
  - An adapted part of addyosmani (about 55 lines in the base): code comments, and the three
    lists without their ADR and README lines.
  - The TSDoc block (18 lines) seeds the generated npm-lane part.
  - README template and changelog are left out. This is the closest to OP-25: page kinds from
    our own Diátaxis-based core, the rest from addyosmani where it does not contradict the
    register.
- **B. A + README template + changelog** (about 111 lines of upstream text: A's 73, the README template 23, the changelog 13, and the two README list lines `:273`, `:284`). This goes further
  toward OP-25's «заменить полностью».
- **C. Own core only.** addyosmani is a link, nothing adapted. This departs from OP-25's
  leaning.
- Not offered: the whole upstream skill. Its ADR chapter reopens R3; «Other» on the card lets
  the operator reopen R3 by name.

**Lead's recommendation: A.**
- **Strongest reason:** the two sections B adds type by hand exactly what this design renders
  from one source. Shipping them would teach consumers the duplication the design removes.
- The parts A keeps fill a gap no skill of ours covers (one-phrasing grep, §2).
- The core is not thin: 89 non-blank lines against `ai-doc`'s 25 non-blank (36 total).
- Reversible: the adapted part is one file plus one scheduled upstream check; widening to B
  later is one change.

**Wrong if:**
- a consumer README written under the rendered-entry rule still needs the upstream section list
  to be complete (then B); or
- the scheduled upstream check fires so often that re-reading costs more than the 55 lines are
  worth (then C).
  Upstream history of the file: last change `cda4542ade0f`, 2026-09-07; PR #514 pending.


### F7.4. Consequences in every option (not a fork)

- `docs-author/SKILL.md:20-33` and site spec D17
  (`docs/superpowers/specs/2026-09-13-getff-ai-site-design.md:132`, «ADAPT pfeff `diataxis`»)
  stand on a withdrawn companion. That text is the site seat's (F2: site page content stays
  with it). Hand-over row, no edit here.
- `SKILL.md:99` (deferral token) goes when M4 lands.

### F7.Unverified

- The upstream licence text was not read in full. MIT is the repo-level `spdx_id` from
  `gh api`, and an excerpt keeps the copyright notice.
- Whether any consumer asked for changelog or README guidance: no data.


## Prevention

- The design's own gates are the prevention: the fact-layer `--check`, the named-place binding
  with its lock, the PR-boundary verdict gate (bare paths, typed values, relinks without an
  edit), the class file, and F3 on the passport region.
- These measurements are the baseline: the ACC «three zeros» (deferral tokens, stale citations,
  unclassified docs) are re-measured with the same commands after each implementation slice.

## Tags

`docs-single-source`, `refresh-gate`, `named-place-binding`, `fact-layer`, `doc-classes`,
`passport`, `build-vs-reuse`

## §1.7 self-review

- **Forward check.** Every number the spec states under «Measured facts» has its method here; the
  replay and classifier scripts are reproduced verbatim, with the probe's two-line instrumentation
  named.
- **Backward check.** The judgment counts (61 of 66 tokens, the F7 hand count 89 + 16) are marked
  as judgments; the firing rates are marked rough. The two review rounds re-derived most numbers
  independently (see the review-rounds patch).
- **Limits.** H1 was measured once in one container; the replay covers 50 merges of one week;
  the F7 «nothing like it» claims rest on one grep phrasing.
