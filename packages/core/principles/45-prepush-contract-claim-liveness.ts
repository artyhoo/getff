/**
 * Principle 45 — consumer pre-push contract claim liveness (extraction + resolution).
 *
 * The mechanism lives here; the arms and the paired negatives live in the sibling
 * `.test.ts`. Split for the same reason as principles 20/29/31/33: the extractor is
 * exercised by synthetic corpora in the negatives and by the live corpus in the
 * positives, so it must be importable without dragging a `describe` block along.
 *
 * See the test file's header for the incident, the channel choice and the measured
 * false-positive floor.
 */
import { execFileSync } from 'node:child_process';
import { SHIPPED_SKILL_SLUGS } from '../hooks/pre-push.ts';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../../..');

/* ────────────────────────────────────────────────────────────────────────────
 * 1. The claim population — enumerated by PREDICATE, never by a hand-picked list.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Git pathspecs whose markdown may assert a pre-push behaviour on a reader's behalf.
 *
 * Two halves, and the split is the whole point:
 *   · SHIPPED — content that is installed into a consumer project and becomes the
 *     standing instructions their agent reads every session. A false claim here is
 *     acted on by a machine, not merely read by a human.
 *   · LIVE AUTHORITY — this repo's own canonical docs + rules. Mirrors the scope the
 *     citation gate calls LIVE_AUTHORITY_MD (`packages/core/hooks/pre-push.ts`).
 *
 * Deliberately EXCLUDED: `docs/**` (research patches, retros and specs cite the
 * contract as a DATED snapshot — re-truthing history is not drift repair) and
 * `.claude/orchestrator-prompts/**` (transient kickoffs). Same carve-out, same
 * reasoning, as the citation gate's live-authority narrowing.
 *
 * Kept honest by `it('the corpus covers every markdown-bearing shipped pathspec')`,
 * which parses scripts/format-shipped.sh — the shipped-surface SSOT — rather than
 * trusting this list to have been maintained.
 *
 * The live-authority half is `:(glob)*.md` — EVERY tracked markdown at the repo root,
 * by predicate — and not the five names this list carried when principle 45 shipped.
 * That spelling was the brief's own forbidden shape one level up: the claims inside
 * each listed file were enumerated by predicate, but the list of root canon was picked
 * by hand, so `INSTALL.md:439` («pre-push ← typecheck + tests + arch + audit», the same cite:historical quotes root docs as measured 2026-09-14, since repaired
 * ASCII-tree shape already caught at `INSTALL-FOR-AI.md:354`) and cite:historical quotes root docs as measured 2026-09-14, since repaired
 * `AUDIT-CHECKLIST.md:370,:373` sat outside the corpus and read green. Both were found cite:historical quotes root docs as measured 2026-09-14, since repaired
 * by a parallel docs-repair branch, not by this gate — measured 2026-09-14. A root
 * glob also admits each future root canon without an edit here.
 */
export const CLAIM_CORPUS_PATHSPECS: readonly string[] = [
  // live authority (this repo's canon) — every tracked root markdown, by predicate
  ':(glob)*.md',
  '.claude/rules/*.md',
  // shipped surface
  'packages/**/*.md',
  'packages/**/*.template',
  'templates/**/*.md',
  'templates/**/*.template',
  'skills/**/*.md',
  'skills/**/*.template',
  '.claude/skills/**/*.md',
  '.claude/skills/**/*.template',
  'agents/*.md',
  'plugin/**/*.md',
  'plugin/**/*.template',
];

/**
 * Paths whose claims are resolved against the CONSUMER composition only.
 *
 * A file that ships into a consumer tree describes THEIR hook, which composes only
 * the `owner: consumer | both` sections. Everything else in the corpus describes this
 * repo's own push and resolves against the union (see `implementedFor`).
 */
const SHIPPED_PREFIXES: readonly string[] = [
  'packages/core/templates/',
  'packages/preset-',
  'packages/getff/',
  'packages/runtime-bridge/vendor/',
  'templates/',
  'skills/',
  'agents/',
  'plugin/',
  'INSTALL-FOR-AI.md',
];

export function isShippedSurface(file: string): boolean {
  if (SHIPPED_PREFIXES.some((p) => file === p || file.startsWith(p)))
    return true;
  // `.claude/skills/` is NOT a shipped prefix wholesale: setup.d/10-skills.sh delivers
  // NAMED slugs, and treating the whole subtree as shipped classified this repo's own
  // `self-reflection` skill as consumer-facing. Same #1630 defect, same fix — reuse the
  // slug list the §8 walk already derives rather than restating it.
  return SHIPPED_SKILL_SLUGS.some((slug) =>
    file.startsWith(`.claude/skills/${slug}/`),
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2. Claim extraction.
 * ────────────────────────────────────────────────────────────────────────── */

/** The anchor: any mention of the hook, however the prose spells it. */
const MENTION_RE = /(?:\.husky\/)?pre[-‑–]?push/gi;

/**
 * Connectives that open an enumeration AFTER the mention. Measured against the live
 * corpus before shipping — see the test's `false-positive floor` arm. A mention with
 * no connective (`don't bypass the pre-push hook`, `wired into the pre-push hook`)
 * asserts nothing about WHAT runs and yields no segment, which is why the bare
 * mention is not itself the anchor.
 */
const POST_CONNECTIVE_RE = /[:—–←]|<-/;
/**
 * The other way prose opens the same enumeration: a verb of execution. `README.md:34` cite:historical quotes root docs as measured 2026-09-14, since repaired
 * uses the parenthesis arm and `AGENTS.md.template:46` the em-dash arm, but the
 * sentence the operator's brief QUOTES — «the pre-push hook runs typecheck + vitest
 * related + dependency-cruiser» — has neither, and a gate blind to it would miss any
 * ninth surface written in the most natural English there is.
 */
const POST_VERB_RE =
  /\b(?:runs?|executes?|invokes?|performs?|запускает|прогоняет)\b/i;
/*
 * KNOWN BLIND SPOT, declared rather than patched: a slash-joined list apposed to the
 * mention with NO connective at all — `AUDIT-CHECKLIST.md:370`, «Earlier channels cite:historical quotes root docs as measured 2026-09-14, since repaired
 * (edit-time ESLint custom rules, pre-push `audit-ai-docs.sh`/tsc/depcruise)». The
 * paren arm does not reach it (the mention is INSIDE the parenthetical), and nothing
 * opens an enumeration after it.
 *
 * Not fixed here because the population is ONE (measured 2026-09-14 over the whole
 * corpus: `grep -nE 'pre-push `[^`]+`/'` → a single hit, that line). A regex shaped to
 * catch one known sentence is fitted to the example, and the cheapest spelling of it —
 * "a slash-joined token run near the mention" — collides head-on with ordinary repo
 * paths (`packages/core/hooks/pre-push.ts` is itself a slash-joined run next to a
 * mention), so it would trade a real blind spot for a false-positive class.
 *
 * Revisit when a SECOND instance appears: two is a shape, one is a sentence.
 */
/** `<list> at pre-push` — the same claim with the enumeration on the other side. */
const PRE_CONNECTIVE_RE = /\b(?:at|in|by)\s+$/i;

/**
 * How far the mention and its connective may be apart. Long enough for the observed
 * `pre-push hook (\`.husky/pre-push\`) fires automatically on \`git push\` —` (57
 * chars), short enough that an unrelated later clause in the same paragraph is out of
 * reach. A sentence boundary inside the gap disqualifies it outright.
 */
const MAX_GAP = 90;
const SENTENCE_BREAK_RE = /[.!?](\s|$)/;

/** Escape hatch, mirroring `ci-tool-pin: allow` / `make-claim: allow`. */
const ESCAPE_RE = /\bprepush-claim:\s+allow\b[ \t]*(.*?)(?:-->)?\s*$/;
export const MIN_RATIONALE_CHARS = 20;

/**
 * Word-level stoplists, applied to an item's PARTS rather than to the whole item —
 * `Husky hooks (lint-staged` and `npm run typecheck` are both real corpus items, and
 * only a part-wise filter reduces the first to nothing and the second to `typecheck`.
 *
 * RUNNER_WORDS name the thing that FIRES the hook or the plumbing around it, never a
 * check. CHANNEL_WORDS name a DIFFERENT rung: an item that says «at edit-time» is
 * telling you where it runs, and it is not here.
 */
const RUNNER_WORDS = new Set([
  'husky',
  'git',
  'push',
  'hook',
  'hooks',
  'node',
  'npm',
  'npx',
  'bash',
  'run',
  'runs',
  'the',
  'a',
  'at',
  'on',
  'in',
  'it',
  'its',
  'and',
  'via',
  'no-verify',
  'dry-run',
  'time',
  'всего',
  'проекта',
  'на',
  'файлах',
  'делает',
  'сьют',
]);
const CHANNEL_WORDS = ['edit-time', 'pre-commit', 'editor', 'in ci', 'ci job'];
/** A negated clause states what the hook does NOT do — the opposite of a false claim. */
const NEGATION_RE =
  /\b(?:not|never|no longer|without)\b|(?:^|\s)(?:\u043d\u0435|\u043d\u0438|\u043d\u0438\u043a\u043e\u0433\u0434\u0430)\s/i;

export interface ClaimItem {
  /** The item as normalised for resolution (lowercased, markup stripped). */
  token: string;
  /** The item exactly as it appears, for the failure message. */
  raw: string;
}

export interface PrePushClaim {
  file: string;
  /** 1-indexed line of the FIRST line of the unit carrying the claim. */
  line: number;
  /** The enumeration text, as extracted. */
  segment: string;
  items: ClaimItem[];
  escaped: boolean;
}

export interface Violation {
  file: string;
  line: number;
  segment: string;
  /** The item exactly as written, for the failure message. */
  item: string;
  /** The normalised item, for stable keying against the quarantine. */
  token: string;
  reason: string;
}

/** A logical unit: a table row, or a paragraph/list-item with its wrapped continuations. */
interface Unit {
  line: number;
  text: string;
}

const NEW_BLOCK_RE = /^(?:[-*+>]\s|\d+[.)]\s|#{1,6}\s|```|\||\s*$)/;

/**
 * Join wrapped continuation lines so a claim that markdown reflowed across two lines
 * is still one claim. Without this, `fires automatically: typecheck, \`vitest
 * related\`,` / `dependency-cruiser.` reports only half its items.
 */
export function toUnits(content: string): Unit[] {
  const units: Unit[] = [];
  content.split('\n').forEach((raw, idx) => {
    const isTableRow = raw.trimStart().startsWith('|');
    const isContinuation =
      !isTableRow &&
      /^\s+\S/.test(raw) &&
      !NEW_BLOCK_RE.test(raw.trimStart()) &&
      units.length > 0 &&
      !units[units.length - 1].text.trimStart().startsWith('|') &&
      units[units.length - 1].text.trim() !== '';
    if (isContinuation) {
      units[units.length - 1].text += ' ' + raw.trim();
      return;
    }
    units.push({ line: idx + 1, text: raw });
  });
  return units;
}

/** Strip markdown decoration and normalise one enumeration item. */
function normaliseItem(raw: string): string {
  return raw
    .replace(/`/g, '')
    .replace(/\*\*?/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:the|a|an|its|their|full|whole)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\w`$§.а-яё]+|[^\w§а-яё]+$/gi, '')
    .toLowerCase()
    .trim();
}

/**
 * Item separators. `/` only when it abuts a code span (`` `tsc`/`depcruise` `` is a
 * list; `packages/core/templates` is one path) — splitting every slash turned a single
 * path item into five phantom checks in the pre-ship measurement.
 */
const ITEM_SPLIT_RE =
  /\s*(?:,|\+|;|\(|\)|\band\b|\b\u0438\b|&)\s*|(?<=`)\/|\/(?=`)/;

function itemsOf(segment: string): ClaimItem[] {
  return segment
    .split(ITEM_SPLIT_RE)
    .filter((raw): raw is string => typeof raw === 'string')
    .map((raw) => ({ raw: raw.trim(), token: normaliseItem(raw) }))
    .filter((i) => i.token.length > 0 && /[a-zа-я]/i.test(i.token))
    .filter((i) => !NEGATION_RE.test(i.token))
    .filter((i) => !CHANNEL_WORDS.some((c) => i.token.includes(c)));
}

/** The enumeration that FOLLOWS a mention, or null when the mention asserts nothing. */
function postSegment(tail: string): string | null {
  const paren = /^[^(.:—–←]{0,30}\(([^)]{3,})\)/.exec(tail);
  if (
    paren &&
    !SENTENCE_BREAK_RE.test(paren[0].slice(0, paren[0].indexOf('(')))
  )
    return paren[1];
  // Whichever opener comes first wins: a verb before a colon means the colon belongs
  // to a later clause, and vice versa.
  const conn = POST_CONNECTIVE_RE.exec(tail);
  const verb = POST_VERB_RE.exec(tail);
  const open =
    conn && verb ? (conn.index <= verb.index ? conn : verb) : (conn ?? verb);
  if (!open || open.index > MAX_GAP) return null;
  const gap = tail.slice(0, open.index);
  if (SENTENCE_BREAK_RE.test(gap)) return null;
  // «the pre-push hook does NOT run typecheck» states the opposite of a false claim.
  // The per-item negation filter cannot see this: the negation sits in the gap, not
  // in any item, and `or` is not an enumeration separator.
  if (NEGATION_RE.test(gap)) return null;
  const rest = tail.slice(open.index + open[0].length);
  const end = SENTENCE_BREAK_RE.exec(rest);
  const seg = (end ? rest.slice(0, end.index) : rest).trim();
  return seg.length >= 3 ? seg : null;
}

/** The enumeration that PRECEDES a mention — the `<list> at pre-push` shape. */
function preSegment(head: string): string | null {
  if (!PRE_CONNECTIVE_RE.test(head)) return null;
  const clause = head.replace(PRE_CONNECTIVE_RE, '');
  // Back up to the start of the clause: the last sentence break, colon or dash.
  const start = Math.max(
    clause.lastIndexOf(': '),
    clause.lastIndexOf('— '),
    clause.lastIndexOf('. '),
  );
  const seg = clause.slice(start + 1).trim();
  // A pre-mention clause must actually ENUMERATE. Without this, any sentence that ends
  // «… at pre-push» donates its whole clause as a claim — measured: «principle 11 F1
  // enforces it at pre-push» in a shipped skill, which asserts nothing about a check
  // SET. The post-mention arm needs no such floor: its connective already marks a list.
  if (!/[,+;/]|\band\b/.test(seg)) return null;
  return seg.length >= 3 ? seg : null;
}

/**
 * Extract every pre-push contract claim from one file's text.
 *
 * A table ROW is handled cell-wise: the cells after the one carrying the mention are
 * the claim (`| Pre-push hook | \`git push --dry-run\` | Typecheck + tests + audit run |`
 * asserts the contract across a cell boundary, with no connective anywhere).
 */
export function extractClaims(file: string, content: string): PrePushClaim[] {
  const out: PrePushClaim[] = [];
  for (const unit of toUnits(content)) {
    const esc = ESCAPE_RE.exec(unit.text);
    const escaped = esc !== null && esc[1].trim().length >= MIN_RATIONALE_CHARS;
    const segments = new Set<string>();

    if (unit.text.trimStart().startsWith('|')) {
      const cells = unit.text.split('|').map((c) => c.trim());
      const at = cells.findIndex((c) =>
        new RegExp(MENTION_RE.source, 'i').test(c),
      );
      if (at >= 0)
        for (const cell of cells.slice(at + 1))
          if (cell.length >= 3) segments.add(cell);
    } else {
      MENTION_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = MENTION_RE.exec(unit.text)) !== null) {
        const post = postSegment(unit.text.slice(m.index + m[0].length));
        if (post) segments.add(post);
        const pre = preSegment(unit.text.slice(0, m.index));
        if (pre) segments.add(pre);
      }
    }

    for (const segment of segments) {
      const items = itemsOf(segment);
      if (items.length > 0)
        out.push({ file, line: unit.line, segment, items, escaped });
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. Resolution against the registry.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Claim vocabulary → the pre-push section id that implements it.
 *
 * This table is the ONLY hand-written half, and it is gated from both ends: every
 * VALUE must be a live section id (`alias integrity` arm — renaming or deleting a
 * section reddens every doc that named it), and every KEY is matched as a substring
 * of a normalised claim item, so `npm run rule-globs check` resolves through
 * `rule-globs` without an entry of its own.
 *
 * A claim item that matches NO key is a violation. That polarity is the mechanism:
 * the gate does not need to know that `typecheck` is wrong — it needs only to know
 * that nothing in the registry implements it.
 */
export const ALIASES: ReadonlyMap<string, string> = new Map([
  ['rule-glob', 'rule-globs'],
  ['check-rule-globs.sh', 'rule-globs'],
  ['lint-staged resolution', 'lint-staged-resolves'],
  ['lint-staged binary resolution', 'lint-staged-resolves'],
  ['lintstaged-resolves', 'lint-staged-resolves'],
  ['check-lintstaged-resolves.sh', 'lint-staged-resolves'],
  ['generated-rule-material', 'generated-rule-material'],
  ['rule-test firing', 'generated-rule-material'],
  ['run-rule-tests-firing.sh', 'generated-rule-material'],
  ['link check', 'lychee'],
  ['lychee', 'lychee'],
  ['unpinned', 'unpinned-tool-install'],
  ['ci-tool-pinning', 'unpinned-tool-install'],
  ['tool-pin', 'unpinned-tool-install'],
  // maintainer-composed sections — legitimate in this repo's OWN docs, and a lie in
  // anything that ships (see implementedFor).
  ['audit-ai-docs', 'audit-ai-docs'],
  ['§1.7', 's17'],
  ['prior-art', 'prior-art'],
  ['actionlint', 'actionlint'],
  ['zizmor', 'zizmor-live'],
  ['skill-drift', 'skill-drift'],
  ['principle', 'principles-meta'],
  ['spec-validate', 'spec-discipline'],
  ['guard-liveness', 'guard-liveness'],
  ['citation', 'line-citations'],
  // python lane — ids derived from the shipped hook, not declared here.
  ['ast-grep', 'python:ast-grep'],
  ['ruff', 'python:ruff'],
]);

/** Resolve one normalised item to a section id, or null. */
export function resolveItem(token: string): string | null {
  for (const [key, id] of ALIASES) if (token.includes(key)) return id;
  return null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3b. What COUNTS as naming a check — derived, never hand-listed.
 *
 * The gate must not need a curated list of "tools we do not run": that list is the
 * half that goes stale, and its staleness is invisible (a new false claim naming a
 * tool nobody listed is simply missed). So the vocabulary is DERIVED from the
 * installer's own delivery — `setup.d/70-deps.sh`, which writes the consumer's
 * `package.json` scripts and devDependencies. Everything a consumer-facing doc could
 * plausibly call a check is in there by construction, because the installer is what
 * put it in their project.
 *
 * Three token families come out of it, plus the two already-derived lanes:
 *   · npm script names (`typecheck`, `arch:check`, `audit:docs`) and their
 *     colon-segments (`arch`, `audit`), so prose that says "arch" resolves;
 *   · the binaries those scripts invoke (`tsc`, `vitest`, `depcruise`, `stryker`)
 *     and the shipped `scripts/*.sh` they call;
 *   · the devDependency package names (`dependency-cruiser` — the spelling prose
 *     actually uses, which the `depcruise` BINARY name would never have matched).
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Segments that are ordinary English before they are check names. `check`, `run` and
 * `docs` are script-name furniture; `enforced` and `generated` are participles that
 * appear in prose about enforcement constantly. Measured: without this set the gate
 * reported «name those as "enforced earlier"» as an unimplemented check.
 */
const GENERIC_SEGMENTS = new Set([
  'check',
  'run',
  'watch',
  'fix',
  'docs',
  'enforced',
  'generated',
  'incremental',
  'integration',
  'coverage',
  'parallel',
  'prepare',
  'write',
  'include',
  'src',
]);
/** Wrappers — the word after them is the real binary. */
const WRAPPERS = new Set(['bash', 'sh', 'npx', 'npm', 'node', 'pnpm', 'yarn']);

/** Parse the installer's `want = {…}` scripts block + its devDependency names. */
export function deriveToolchainTokens(depsSh: string): Set<string> {
  const tokens = new Set<string>();
  const add = (raw: string) => {
    const v = raw
      .trim()
      .toLowerCase()
      .replace(/^\.?\//, '');
    const base = v.includes('/') ? v.slice(v.lastIndexOf('/') + 1) : v;
    if (
      base.length >= 3 &&
      !GENERIC_SEGMENTS.has(base) &&
      /^[a-z@][\w@:.-]*$/.test(base)
    )
      tokens.add(base);
  };
  const wantBlock = /const want = \{([\s\S]*?)\n {6}\};/.exec(depsSh);
  if (wantBlock) {
    for (const m of wantBlock[1].matchAll(
      /"([a-z][a-z0-9:._-]*)"\s*:\s*([^\n]+)/g,
    )) {
      add(m[1]);
      for (const seg of m[1].split(':')) if (seg.length >= 4) add(seg);
      // Every quoted command in the value (the ternary arms included); from each, the
      // first word that is not a wrapper — that is the tool the script actually runs.
      for (const lit of m[2].matchAll(/"([^"]+)"/g)) {
        const words = lit[1].split(/\s+/).filter(Boolean);
        const bin = words.find((w) => !WRAPPERS.has(w.toLowerCase()));
        if (bin) add(bin);
      }
    }
  }
  // The PROSE spelling of a tool, taken from the CONFIG FILE its script points at.
  // `arch:check` runs `depcruise --config .dependency-cruiser.cjs`: the binary is
  // `depcruise`, but every document that describes the check calls it
  // «dependency-cruiser». Without this the gate missed one of the four checks at the
  // centre of the incident — caught by planting a claim naming it and watching only two
  // of its three items redden.
  //
  // Config basenames, NOT the devDependency pin arrays. Harvesting those arrays instead
  // was measured and rejected: it also admits `typescript`, `tsx`, `zod`, `glob` and
  // `storybook` — libraries, not checks — and immediately reported
  // `CONTRIBUTING.md:20` («the pre-push hook runs TypeScript checks via `tsx`», true and
  // framework-internal) as a violation. A config file is named after the check it
  // configures; a dependency list is not.
  for (const m of depsSh.matchAll(/["\s]\.([a-z][a-z0-9.-]*)\.(?:c|m)?js\b/g))
    add(m[1]);
  return tokens;
}

/**
 * Match one item part against one lexicon token: exact, or singular/plural.
 *
 * Deliberately NOT sub-word: an earlier draft also matched a token's `:._/-` segments,
 * which made `rule` (from `check-rule-globs.sh`) match the word "rule" in ordinary
 * prose and reported two `.claude/rules/*.md` sentences as unimplemented checks. The
 * segments that genuinely read as prose vocabulary (`arch`, `audit`) are added as
 * standalone tokens by `deriveToolchainTokens`, so nothing is lost.
 */
function partMatches(part: string, lex: string): boolean {
  const sing = (v: string) => v.replace(/s$/, '');
  return part === lex || sing(part) === sing(lex);
}

/**
 * Does this item name a check at all? Either the implemented vocabulary (ALIASES) or
 * the derived consumer toolchain. Anything else is ordinary prose and is ignored —
 * the measured alternative (treat every enumeration item as a check) produced 60+
 * findings on the live corpus, none of them about the contract.
 */
export function isCheckToken(
  token: string,
  toolchain: ReadonlySet<string>,
): boolean {
  if (resolveItem(token) !== null) return true;
  const parts = token
    .split(/[^a-z0-9@/:._\u0430-\u044f-]+/)
    .filter((p) => p.length > 0 && !RUNNER_WORDS.has(p));
  if (parts.length === 0) return false;
  for (const lex of toolchain)
    if (parts.some((p) => partMatches(p, lex))) return true;
  return false;
}

/**
 * The section ids composed for a given file's audience, plus the python lane's arms.
 * `implemented` is passed in rather than read here so the negatives can drive a fixed
 * synthetic registry.
 */
export function findViolations(
  entries: readonly { file: string; content: string }[],
  implemented: (file: string) => ReadonlySet<string>,
  toolchain: ReadonlySet<string>,
): Violation[] {
  const violations: Violation[] = [];
  for (const { file, content } of entries) {
    for (const claim of extractClaims(file, content)) {
      if (claim.escaped) continue;
      const live = implemented(file);
      for (const item of claim.items) {
        if (!isCheckToken(item.token, toolchain)) continue;
        const id = resolveItem(item.token);
        if (id === null) {
          violations.push({
            file,
            line: claim.line,
            segment: claim.segment,
            item: item.raw,
            token: item.token,
            reason: `names \`${item.raw}\`, which no pre-push section implements`,
          });
        } else if (!live.has(id)) {
          violations.push({
            file,
            line: claim.line,
            segment: claim.segment,
            item: item.raw,
            token: item.token,
            reason:
              `names \`${item.raw}\` → section '${id}', which is NOT composed for ` +
              `this file's audience (${isShippedSurface(file) ? 'consumer' : 'framework'})`,
          });
        }
      }
    }
  }
  return violations;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4. Corpus loading.
 * ────────────────────────────────────────────────────────────────────────── */

export function enumerateCorpus(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', '-z', '--', ...CLAIM_CORPUS_PATHSPECS],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return out.split('\0').filter(Boolean);
}

export function loadCorpus(): { file: string; content: string }[] {
  return enumerateCorpus().map((file) => ({
    file,
    content: readFileSync(resolve(REPO_ROOT, file), 'utf8'),
  }));
}

/** The installer's delivery, read from disk. */
export function toolchainTokens(): Set<string> {
  return deriveToolchainTokens(
    readFileSync(resolve(REPO_ROOT, 'setup.d/70-deps.sh'), 'utf8'),
  );
}

/** The python lane's arms, derived from the shipped hook rather than declared. */
export function pythonLaneIds(): Set<string> {
  const src = readFileSync(
    resolve(REPO_ROOT, 'packages/core/templates/python/hooks/pre-push.sh'),
    'utf8',
  );
  const ids = new Set<string>();
  for (const m of src.matchAll(/command -v ([a-z][a-z0-9-]*)\s/g))
    ids.add(`python:${m[1]}`);
  return ids;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5. Dated quarantine — the ratchet, not an allowlist.
 * ────────────────────────────────────────────────────────────────────────── */

export interface QuarantineRow {
  file: string;
  /** Normalised item tokens (`Violation.token`), not the raw spelling. */
  items: readonly string[];
  /** Who removes the row, and when. */
  owner: string;
}

/**
 * The claims that were already live-and-false when this gate shipped (2026-09-14,
 * measured against `origin/staging` d5a06c8cde5). Ten of the twelve original rows were
 * repaired by the docs-truth-prepush PR and deleted here in the same change, as the
 * `staleQuarantine` arm below requires. What remains is one surface and its generated
 * twin, held for a reason the gate cannot decide. `checks-map.md` declares itself
 * authoritative for the GENERIC eight-level enforcement model (`:8`), not for getff's
 * delivery: its levels 5-8 name Stryker, Pact Broker, Datadog and Argo Rollouts, none of
 * which getff installs. Both of the row's claim sites live in that register — `:43` is
 * row 3 of the model table and `:143` is the «minimum pipeline for a new project» — so
 * they say where a check BELONGS, not what getff wires. Rewriting the model is a product
 * decision for the maintainer. The consumer-confusion half is closed instead: the
 * docs-truth-prepush PR adds a note above the table stating outright that the installed
 * `.husky/pre-push` runs getff's own rule checks and that your typecheck, tests and
 * architecture check stay yours.
 *
 * This is a ratchet, not an allowlist, and it is load-bearing in BOTH directions:
 *
 *  - a claim NOT listed here fails the gate — so no ninth surface can be added;
 *  - a row listed here that no longer matches a live violation ALSO fails the gate
 *    (`staleQuarantine`) — so the docs PR that repairs a surface must delete its row
 *    in the same change, and the quarantine cannot outlive the debt it records.
 *
 * The second arm is the whole point. A suppression list nobody is forced to shrink is
 * `#hope-as-gate` with extra steps (`.claude/rules/attention-is-not-a-mechanism.md §2`);
 * the same self-cleaning shape is why ESLint errors on an unused disable directive.
 *
 * NOTE for the docs PR: deleting rows from this file IS part of the prose fix. That is
 * the intended friction — a repaired sentence and a stale quarantine row are one change.
 */
export const KNOWN_UNBACKED_CLAIMS: readonly QuarantineRow[] = [
  {
    file: 'skills/getff/references/checks-map.md',
    items: [
      'npm run typecheck',
      'npm run arch:check',
      'dependency-cruiser',
      'tsc --noemit всего проекта',
      'vitest related $changed',
      'vitest related на изменённых файлах',
    ],
    owner:
      'maintainer fork — BOTH sites are the generic 8-level model, not a description of getff: :43 is row 3 of the model table (whose levels 5-8 name Stryker/Pact/Datadog, which getff never installs) and :143 is the «minimum pipeline for a new project». Rewriting the model is a product decision; the consumer-confusion half is closed by the note this PR adds above the table',
  },
  {
    file: 'plugin/skills/getff/references/checks-map.md',
    items: [
      'npm run typecheck',
      'npm run arch:check',
      'dependency-cruiser',
      'tsc --noemit всего проекта',
      'vitest related $changed',
      'vitest related на изменённых файлах',
    ],
    owner: 'maintainer fork — plugin twin of the row above; regenerated, not hand-edited',
  },
];

const quarantineIndex = (): Map<string, Set<string>> => {
  const index = new Map<string, Set<string>>();
  for (const row of KNOWN_UNBACKED_CLAIMS) {
    const bucket = index.get(row.file) ?? new Set<string>();
    for (const item of row.items) bucket.add(item);
    index.set(row.file, bucket);
  }
  return index;
};

export interface Partition {
  /** Violations the gate reddens on — everything not pre-recorded. */
  blocking: Violation[];
  /** Violations matched by a quarantine row. */
  held: Violation[];
  /** `file → item` pairs recorded here that match no live violation any more. */
  stale: { file: string; item: string }[];
}

/**
 * Split measured violations against the quarantine, and report rows that have gone
 * stale. Both halves are asserted by the principle test; neither is advisory.
 */
export function partition(violations: readonly Violation[]): Partition {
  const index = quarantineIndex();
  const seen = new Map<string, Set<string>>();
  const blocking: Violation[] = [];
  const held: Violation[] = [];
  for (const v of violations) {
    if (index.get(v.file)?.has(v.token)) {
      held.push(v);
      const bucket = seen.get(v.file) ?? new Set<string>();
      bucket.add(v.token);
      seen.set(v.file, bucket);
    } else {
      blocking.push(v);
    }
  }
  const stale: { file: string; item: string }[] = [];
  for (const [file, items] of index)
    for (const item of items)
      if (!seen.get(file)?.has(item)) stale.push({ file, item });
  return { blocking, held, stale };
}
