/**
 * Principle 31 — Rule channel declaration: the gate-on-the-gate.
 *
 * CTX Stage 1 declared per-rule delivery channels by CONVENTION (`paths:` frontmatter,
 * `<!-- globs: -->` / `<!-- channel: ... -->` markers, `.claude/rules/00-rule-index.md`).
 * Nothing stopped a future rule from shipping with NO declared channel — the convention was
 * enforced only by the renderer's own drift check (scripts/render-rule-index.mjs --check),
 * which only asserts the RENDERED INDEX matches whatever markers happen to exist; it never
 * asserts that a channel marker exists AT ALL. This principle makes "every rule declares a
 * channel" itself a mechanical, CI-gated invariant — "documents lie; tests don't" applied to
 * the channel declarations themselves (SSOT prior-art-evaluations.md#208, the render-index
 * capability this principle is the gate-half of).
 *
 * Source: .claude/rules/rule-enforcement-channel-selection.md §6 ("promotion when ≥3 rules
 * carry markers" — trigger fired, 8 rules carry channel-shaped markers as of this principle).
 *
 * PASS-predicate (4 branches, OR'd — a rule passes if ANY branch holds):
 *   (a) carries `paths:` frontmatter (CC-native path-scoped read channel), OR
 *   (b) carries a `<!-- globs: -->` marker (edit-time inject channel via inject-matching-rule.sh)
 *       — fix D1: kickoff-staging-placement.md legitimately lives on an edit-time channel
 *       WITHOUT `paths:` (it is delivered by the hook's globs marker alone), OR
 *   (c) is named in ALWAYS_ON_CORE (asserted length <= 4 — the Tier-0 core, always resident), OR
 *   (d) carries a `<!-- channel: <mechanism> <artifact-path>#<anchor> -->` marker whose
 *       artifact-path resolves to a real, existsSync-confirmed in-repo file, with the anchor
 *       (when present) actually found (grepped) inside that file — fix D2: a free-prose
 *       exception ("delivered elsewhere") is unfalsifiable; naming + verifying the artifact
 *       catches an eviction-without-delivery mechanically.
 *
 * Mirrors the enumerator+paired-negative+fixture shape of principles 12/15/30. Its doctrine
 * home is `.claude/rules/rule-enforcement-channel-selection.md` §6 (the Class B->A promotion
 * record for this principle); the §1.7 backward-check enumeration of those siblings lives in
 * the shipping PR body, not in a companion rule file (this principle has no `rules/*.md` of its
 * own — the channel-selection doctrine already owns the convention it gates).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
// @ts-expect-error picomatch 4.x ships no type declarations; no @types/picomatch exists.
import picomatch from 'picomatch';
import {
  extractHeaderField,
  extractFrontmatterPaths,
  extractGlobsMarker,
  extractChannelMarkers,
  extractLivenessExemptions,
  parseChannelMarker,
  checkPathsGlobsParity,
} from './rule-channel-glob.ts';

/**
 * Tier-0 "always-on core" rules: never evicted from always-on context regardless of
 * paths:/globs declarations (mirrors scripts/render-rule-index.mjs TIER0_CORE, PLUS the
 * rendered index itself — 00-rule-index.md is a generated artifact carrying fence markers,
 * not a hand-authored channel declaration, and is treated as always-on by construction since
 * it IS the digest of every other rule's channel).
 *
 * Asserted length <= 4 below (module-neighbor precedent: REQUIRED_HEADER_DOCS-style array,
 * this one deliberately kept tiny — the whole point of Stage 0/1 was to SHRINK the always-on
 * set, so a growing ALWAYS_ON_CORE would silently undo that work).
 */
export const ALWAYS_ON_CORE: readonly string[] = [
  'attention-is-not-a-mechanism.md',
  'ai-laziness-digest.md',
  '00-rule-index.md',
];

if (ALWAYS_ON_CORE.length > 4) {
  throw new Error(
    `ALWAYS_ON_CORE grew past its asserted ceiling of 4 (currently ${ALWAYS_ON_CORE.length}) — ` +
      "this defeats CTX Stage 0/1's always-on-context shrink. Revisit before adding entries.",
  );
}

export interface RuleChannelFields {
  name: string;
  path: string;
  source: string;
  paths: string[] | null;
  globsMarker: string[] | null;
  channelMarkers: string[];
  livenessExemptions: Set<string>;
}

/** Tracked `.claude/rules/*.md` files (excluding 00-rule-index.md, which is ALWAYS_ON_CORE by
 *  construction, not a hand-authored channel-bearing rule) — git-aware, mirrors principle 09's
 *  enumerateFlatRequiredDocs / principle 15's trackedSkillMds pattern (installer-populated
 *  clones may carry gitignored/untracked rule copies out of scope). Falls back to filesystem
 *  enumeration when git is unavailable. */
export function enumerateRuleFiles(repoRoot: string): string[] {
  const rulesDir = `${repoRoot}/.claude/rules`;
  let tracked: Set<string> | null;
  try {
    const out = execFileSync(
      'git',
      ['-C', repoRoot, 'ls-files', '--', '.claude/rules'],
      {
        encoding: 'utf8',
      },
    );
    tracked = new Set(out.split('\n').filter(Boolean));
  } catch {
    tracked = null;
  }
  const found: string[] = [];
  for (const entry of readdirSync(rulesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name === '00-rule-index.md') continue; // ALWAYS_ON_CORE by construction, not a rule
    const rel = `.claude/rules/${entry.name}`;
    if (tracked && !tracked.has(rel)) continue;
    found.push(rel);
  }
  return found.sort();
}

/** Parse one rule file's channel-declaration fields (paths/globs/channel markers). */
export function parseRuleChannelFields(
  relPath: string,
  repoRoot: string,
): RuleChannelFields {
  const abs = `${repoRoot}/${relPath}`;
  const source = readFileSync(abs, 'utf8');
  const name = relPath.split('/').pop()!;
  return {
    name,
    path: relPath,
    source,
    paths: extractFrontmatterPaths(source),
    globsMarker: extractGlobsMarker(source),
    channelMarkers: extractChannelMarkers(source),
    livenessExemptions: extractLivenessExemptions(source),
  };
}

export interface ChannelCheckResult {
  ok: boolean;
  reasons: string[];
}

/**
 * Branch (d): every `<!-- channel: ... -->` marker on the rule must parse (mechanism +
 * artifact-path) AND the artifact-path must existsSync AND (if an anchor is present) the
 * anchor string must be found (grepped) inside that artifact file. A marker that fails any
 * of these does NOT count toward the PASS predicate — it is treated as absent, so a rule
 * relying SOLELY on a dangling channel marker fails the whole predicate (N31-3).
 */
export function checkChannelMarkersLive(
  fields: Pick<RuleChannelFields, 'name' | 'channelMarkers'>,
  repoRoot: string,
): ChannelCheckResult {
  const reasons: string[] = [];
  let anyLive = false;
  for (const raw of fields.channelMarkers) {
    const parsed = parseChannelMarker(raw);
    if (!parsed) {
      reasons.push(
        `${fields.name}: channel marker "${raw}" does not name an artifact-path (must be "<mechanism> <artifact-path>[#anchor]")`,
      );
      continue;
    }
    const artifactAbs = `${repoRoot}/${parsed.artifactPath}`;
    if (!existsSync(artifactAbs)) {
      reasons.push(
        `${fields.name}: channel marker "${raw}" — artifact "${parsed.artifactPath}" does not exist (dangling)`,
      );
      continue;
    }
    if (parsed.anchor) {
      const artifactSource = readFileSync(artifactAbs, 'utf8');
      if (!artifactSource.includes(parsed.anchor)) {
        reasons.push(
          `${fields.name}: channel marker "${raw}" — anchor "#${parsed.anchor}" not found in "${parsed.artifactPath}"`,
        );
        continue;
      }
    }
    anyLive = true;
  }
  return { ok: anyLive, reasons };
}

/**
 * The 4-branch PASS predicate for a single rule. Returns ok=true iff at least one branch
 * holds; `reasons` accumulates diagnostic detail for the branches that were tried and failed
 * (useful when a rule carries e.g. a channel marker that turned out dangling — branch (d)
 * fails, but if no other branch holds either, the overall verdict is fail with that reason
 * surfaced rather than a bare "no channel").
 */
export function evaluateRuleChannel(
  fields: RuleChannelFields,
  repoRoot: string,
): ChannelCheckResult {
  const reasons: string[] = [];

  // (a) paths: frontmatter
  if (fields.paths && fields.paths.length > 0) return { ok: true, reasons };

  // (b) <!-- globs: --> marker (fix D1 — no paths: needed, e.g. kickoff-staging-placement.md)
  if (fields.globsMarker && fields.globsMarker.length > 0)
    return { ok: true, reasons };

  // (c) ALWAYS_ON_CORE membership
  if (ALWAYS_ON_CORE.includes(fields.name)) return { ok: true, reasons };

  // (d) <!-- channel: ... --> marker with a live, existing, anchor-verified artifact (fix D2)
  if (fields.channelMarkers.length > 0) {
    const channelResult = checkChannelMarkersLive(fields, repoRoot);
    if (channelResult.ok) return { ok: true, reasons };
    reasons.push(...channelResult.reasons);
  }

  if (reasons.length === 0) {
    reasons.push(
      `${fields.name}: no channel declared — needs paths: frontmatter, <!-- globs: --> marker, ALWAYS_ON_CORE membership, or a live <!-- channel: ... --> marker (see .claude/rules/rule-enforcement-channel-selection.md)`,
    );
  }
  return { ok: false, reasons };
}

/**
 * Glob-parity check (set-equality + subset-grammar + liveness) delegated to the shared module
 * — the SAME function scripts/render-rule-index.mjs's --check uses. Returns [] when either
 * side is absent (only applies when BOTH paths: and globs: are present, per shared module doc).
 */
export function checkGlobParity(
  fields: RuleChannelFields,
  repoRoot: string,
): string[] {
  return checkPathsGlobsParity(
    {
      name: fields.name.replace(/\.md$/, ''),
      paths: fields.paths,
      globsMarker: fields.globsMarker,
      livenessExemptions: fields.livenessExemptions,
    },
    repoRoot,
  );
}

/** Minimal shape of the ack/settings JSON this check reads `claudeMdExcludes` from. */
export interface ClaudeMdExcludesSettings {
  claudeMdExcludes?: string[];
}

/**
 * §"Consistency of eviction": a file listed in `claudeMdExcludes` MUST carry a channel-token
 * with a live artifact (i.e. branch (d) of the PASS predicate must independently hold for it).
 *
 * STATUS 2026-09-14: the committed `claudeMdExcludes` carries 8 entries, all in `**\/<name>.md`
 * glob form. The excluded ⇒ live-token direction below fires against real repo state rather
 * than vacuously; all 8 carry live `<!-- channel: ... -->` markers, verified on the host.
 *
 * THE REVERSE DIRECTION NOW HAS ITS OWN CHECK — see `checkResidencyPartition` below.
 * The paragraph that stood here until 2026-09-14 declined to assert anything in the reverse
 * direction, on the stated ground that `claudeMdExcludes` was "EMPTY/absent (agent-uncommittable;
 * the 4 CTX-Stage-1 evictions were a maintainer-handoff patch not yet applied)". That premise
 * expired when the maintainer applied the evictions; the rationale outlived it and the gap it
 * excused went unguarded for the whole interval. It is restated correctly here because the
 * reverse direction it declined is NOT the one that matters:
 *
 *   - "carries a channel token ⇒ must be excluded" is still deliberately NOT checked, and that
 *     part of the old paragraph remains true. Over-delivery (a token present, the rule still
 *     always-on) is a legal operational choice — asserting it would false-RED real repo state.
 *   - What IS now checked is the RESIDENCY PARTITION, which is a different predicate: a rule
 *     with no `paths:` frontmatter that is not in ALWAYS_ON_CORE is RESIDENT — it is paid for in
 *     every session's context — and must therefore be named in `claudeMdExcludes`. A channel
 *     token does not suppress autoload; only `paths:` and `claudeMdExcludes` do. That is why
 *     `evaluateRuleChannel` passing on branch (b)/(d) says nothing about residency, and why
 *     this principle could be fully green while a rule silently joined the always-on set.
 *
 * `settingsPath` is injectable so tests can point this at a FIXTURE settings.json
 * (principles/fixtures/rule-channel/settings-with-exclude.json) rather than the real
 * .claude/settings.json — needed for N31-6 (excluded-without-token -> RED), since the real
 * settings.json has an empty exclude set and can never exercise that branch.
 */
/**
 * Resolve one `claudeMdExcludes` entry to the enumerated rule it evicts.
 *
 * TWO FORMS ARE LEGAL, because the SHIPPED CLIENT honours only one of them and the repo's own
 * history contains both:
 *
 *  - `**\/<name>.md` — the GLOB form, and the only form that actually evicts anything. The client
 *    matches `claudeMdExcludes` with picomatch against ABSOLUTE paths, and its normaliser skips
 *    any pattern not starting with "/", so a repo-relative entry can never match. Measured on the
 *    host 2026-08-06 against the real `.claude/rules/` tree: relative form matched 0 of 7 entries,
 *    glob form matched 7 of 7.
 *  - `.claude/rules/<name>.md` — the repo-relative form. Accepted here for continuity (it is what
 *    this function originally required, and what shipped in `.claude/settings.json` until the
 *    glob rewrite), but it is INERT at runtime. It is resolved, not blessed: a rule listed in this
 *    form is still subject to the live-channel-token assertion below, so the check stays honest
 *    either way.
 *
 * Resolution of the glob form goes through picomatch — the matcher the shipped client itself
 * bundles, already pinned in `packages/core` devDeps by SSOT prior-art-evaluations.md#238 and
 * already used by principle 34. Until 2026-09-14 it was a hand-rolled basename-exact comparison
 * (`rel.endsWith('/' + basename)`) on the stated ground that "adding a matcher dependency here
 * would be a capability commit for no gain". The dependency was already paid for by principle
 * 34, so the only thing the hand-rolled arm added was a THIRD grammar for one list — the defect
 * class measured on 2026-09-14 in the bash channel, where a fourth grammar (`grep -Fxq`) had
 * been silently dead for the life of the file. One list, one matcher per language channel.
 *
 * What did NOT change: an ambiguous basename (two enumerated rules sharing one filename) is an
 * ERROR rather than a silent first-match, and a multi-segment glob is refused rather than
 * resolved. picomatch could resolve the latter, but the bash channel's SSOT
 * (`scripts/lib/claude-md-excludes.sh`, landing in the sibling PR) refuses it too, and a form
 * one channel accepts while the other refuses is how the grammars drifted apart in the first
 * place. If that PR is not merged yet, the reference is forward-looking, not dangling.
 */

/**
 * Does one `claudeMdExcludes` entry match one repo-RELATIVE path?
 *
 * `{dot:true}` so that `**\/x.md` reaches `.claude/rules/x.md` — the same option principle 34
 * passes, and the semantics the bash channel is parity-tested against.
 * Principle 34 matches ABSOLUTE paths (it asks a different question: "does this entry match any
 * file in the tree at all"); this one matches the relative keys of `ruleFieldsByPath`. Both are
 * picomatch with `{dot:true}`, so the grammar is shared even though the corpus differs.
 */
export function excludeEntryMatchesPath(entry: string, relPath: string): boolean {
  return picomatch.isMatch(relPath, entry, { dot: true }) as boolean;
}
function resolveExcludeEntry(
  entry: string,
  ruleFieldsByPath: Map<string, RuleChannelFields>,
): { fields?: RuleChannelFields; error?: string } {
  const exact = ruleFieldsByPath.get(entry);
  if (exact) return { fields: exact };

  const globPrefix = '**/';
  if (entry.startsWith(globPrefix)) {
    const basename = entry.slice(globPrefix.length);
    if (basename.includes('/')) {
      return {
        error: `claudeMdExcludes lists "${entry}" — only the \`**/<basename>\` glob shape is supported here; a multi-segment glob cannot be resolved to a single enumerated rule.`,
      };
    }
    const hits = [...ruleFieldsByPath.entries()].filter(([rel]) => excludeEntryMatchesPath(entry, rel));
    if (hits.length === 1) return { fields: hits[0][1] };
    if (hits.length > 1) {
      return {
        error: `claudeMdExcludes lists "${entry}" but "${basename}" matches ${hits.length} enumerated rules (${hits.map(([rel]) => rel).join(', ')}) — ambiguous eviction.`,
      };
    }
  }

  return {
    error: `claudeMdExcludes lists "${entry}" but that file is not an enumerated rule (typo or removed?)`,
  };
}

/**
 * Read `claudeMdExcludes` from one settings file.
 *
 * Shared by `checkExclusionConsistency` and `checkResidencyPartition` so the two directions of
 * the same invariant cannot end up reading the list two different ways — the failure mode this
 * whole area is being repaired for (2026-09-14: one list, four grammars, one of them dead).
 * An absent file means no excludes, which is a vacuous pass, not an error: a consumer clone
 * without `.claude/settings.json` is legitimate.
 *
 * NOTE — deliberately project-settings-only. `.claude/settings.local.json` is untracked and
 * per-machine; a gate that read it would go green or red depending on the developer's own
 * overlay. The bash meters DO read the union, because they are measuring what this session
 * actually pays for; a CI gate is asserting what the repo commits to. Different questions,
 * deliberately different inputs.
 */
export function readClaudeMdExcludes(settingsPath: string): {
  excludes: string[];
  error?: string;
} {
  if (!existsSync(settingsPath)) return { excludes: [] };
  let parsed: ClaudeMdExcludesSettings;
  try {
    parsed = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    return { excludes: [], error: `${settingsPath}: invalid JSON (${(e as Error).message})` };
  }
  return { excludes: parsed.claudeMdExcludes ?? [] };
}

export function checkExclusionConsistency(
  repoRoot: string,
  ruleFieldsByPath: Map<string, RuleChannelFields>,
  settingsPath: string,
): string[] {
  const errs: string[] = [];
  const read = readClaudeMdExcludes(settingsPath);
  if (read.error) {
    errs.push(read.error);
    return errs;
  }
  for (const excludedPath of read.excludes) {
    const resolved = resolveExcludeEntry(excludedPath, ruleFieldsByPath);
    if (resolved.error) {
      errs.push(resolved.error);
      continue;
    }
    const fields = resolved.fields!;
    const channelResult = checkChannelMarkersLive(fields, repoRoot);
    if (!channelResult.ok) {
      errs.push(
        `"${excludedPath}" is excluded (claudeMdExcludes) but carries no LIVE <!-- channel: ... --> marker — eviction without a delivery channel. ${channelResult.reasons.join('; ')}`,
      );
    }
  }
  return errs;
}

/**
 * §"Residency partition" — the invariant that fell between principles 31 and 34.
 *
 * THE INVARIANT. For every enumerated `.claude/rules/*.md`:
 *
 *     (no `paths:` frontmatter) AND (not in ALWAYS_ON_CORE)
 *       ==> some `claudeMdExcludes` entry matches it
 *
 * equivalently: the rule population partitions into {path-gated} + {ALWAYS_ON_CORE} + {excluded},
 * with nothing left over. A leftover is a rule that is RESIDENT — loaded into every session's
 * context, paid for in every turn — without anyone having declared it so.
 *
 * WHY NEITHER SIBLING CATCHES IT.
 *   - `evaluateRuleChannel` (this principle) asks "is this rule DELIVERED by some channel?".
 *     Branches (b) and (d) — a `<!-- globs: -->` marker, a live `<!-- channel: ... -->` marker —
 *     are delivery mechanisms that do NOT suppress autoload. A rule can pass this principle on
 *     branch (d) and still be resident. `fixtures/rule-channel/valid-channel-exception.md` is
 *     exactly that shape, and the N31-7 RED leg uses it for that reason.
 *   - `checkExclusionConsistency` (this principle) asks the one-way question
 *     "excluded ==> live token?". It iterates the EXCLUDES list, so a rule missing from that
 *     list is never visited at all.
 *   - Principle 34 asks "does every exclude entry match at least one real file?" — also
 *     iterating the excludes list, from the other end. A rule that should be listed and is not
 *     is invisible to all three.
 *
 * GREEN ON LANDING — stated, not hidden. Measured 2026-09-14 on `origin/staging`: 29 enumerated
 * rules = 19 `paths:`-gated + 2 ALWAYS_ON_CORE (the third, `00-rule-index.md`, is excluded from
 * enumeration by construction) + 8 `claudeMdExcludes`-matched, leftover = 0. A gate that is
 * green the day it lands has proved nothing about itself, which is why N31-7 pairs it with a
 * fixture RED and three fixture positive controls (one per exempting branch) — see the test.
 *
 * SIBLING-CHANNEL PINNING (precedent PR #1644 -> #1651). Principles 31 and 34 both read
 * `.claude/settings.json`, so a test of one can pass on the other's side effect. `settingsPath`
 * and `ruleFieldsByPath` are BOTH injected: N31-7 runs on a synthetic one-entry map and a
 * fixture settings file, touching neither the live rules tree nor the live settings, so nothing
 * principle 34 reads or the maintainer edits can move its verdict.
 */
export function checkResidencyPartition(
  ruleFieldsByPath: Map<string, RuleChannelFields>,
  settingsPath: string,
): string[] {
  const errs: string[] = [];
  const read = readClaudeMdExcludes(settingsPath);
  if (read.error) {
    errs.push(read.error);
    return errs;
  }
  for (const [rel, fields] of ruleFieldsByPath) {
    if (fields.paths && fields.paths.length > 0) continue; // path-scoped: not resident
    if (ALWAYS_ON_CORE.includes(fields.name)) continue; // deliberately resident
    if (read.excludes.some((entry) => excludeEntryMatchesPath(entry, rel))) continue; // evicted
    errs.push(
      `${rel}: RESIDENT but undeclared — it carries no \`paths:\` frontmatter, is not in ` +
        `ALWAYS_ON_CORE, and no claudeMdExcludes entry matches it, so it is auto-loaded into ` +
        `every session at full byte cost with nobody having chosen that. Pick one: add ` +
        `\`paths:\` frontmatter (read-time scoped), add it to ALWAYS_ON_CORE (Tier-0, ceiling 4), ` +
        `or list it in .claude/settings.json claudeMdExcludes (needs a live <!-- channel: ... --> ` +
        `marker too — see checkExclusionConsistency).`,
    );
  }
  return errs;
}
