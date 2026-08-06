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
  'build-first-reuse-default.md',
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
 * STATUS UPDATE 2026-08-06: the "EMPTY/absent" premise below is NO LONGER TRUE — the committed
 * `claudeMdExcludes` now carries 7 entries, in `**\/<name>.md` glob form (see
 * `resolveExcludeEntry` for why that form, and for the 0-of-7 vs 7-of-7 measurement). The
 * excluded⇒live-token direction below therefore now fires against real repo state rather than
 * vacuously; all 7 carry live `<!-- channel: ... -->` markers, verified on the host.
 *
 * IMPLEMENTED DIRECTION ONLY: excluded ⇒ live-token. The REVERSE ("carries a channel token ⇒
 * must be excluded") is deliberately NOT checked — as of this principle's authoring,
 * `.claude/settings.json` `claudeMdExcludes` was EMPTY/absent (agent-uncommittable; the 4
 * CTX-Stage-1 evictions were a maintainer-handoff patch not yet applied), while 5 rules already
 * carry `<!-- channel: ... -->` tokens (egress-no-api-bypass, memory-codification,
 * reviewer-discipline, recommendation-laziness-discipline, research-source-trust) WITHOUT
 * being excluded yet. Over-delivery (a token present but the rule still always-on) is legal —
 * asserting the reverse would false-RED the real, currently-committed repo state. See
 * .claude/rules/rule-enforcement-channel-selection.md and the Stage-2 kickoff contract.
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
 * Resolution of the glob form is deliberately basename-exact rather than a glob engine: the
 * entries this gate must serve are always `**\/<basename>`, and adding a matcher dependency here
 * would be a capability commit for no gain. An ambiguous basename (two enumerated rules sharing
 * one filename) is an ERROR rather than a silent first-match — matching the client's own
 * behaviour would be guesswork, and guessing is what this whole principle exists to prevent.
 */
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
    const hits = [...ruleFieldsByPath.entries()].filter(([rel]) => rel.endsWith(`/${basename}`));
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

export function checkExclusionConsistency(
  repoRoot: string,
  ruleFieldsByPath: Map<string, RuleChannelFields>,
  settingsPath: string,
): string[] {
  const errs: string[] = [];
  if (!existsSync(settingsPath)) return errs; // no settings file -> no excludes -> vacuous pass
  const raw = readFileSync(settingsPath, 'utf8');
  let parsed: ClaudeMdExcludesSettings;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    errs.push(`${settingsPath}: invalid JSON (${(e as Error).message})`);
    return errs;
  }
  const excludes = parsed.claudeMdExcludes ?? [];
  for (const excludedPath of excludes) {
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
