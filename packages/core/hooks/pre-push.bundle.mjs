/* eslint-disable */
// @ts-nocheck
import{createRequire as ___cr}from'node:module';const require=___cr(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/core/hooks/checks/harness-config-local.ts
var harness_config_local_exports = {};
__export(harness_config_local_exports, {
  RENDERER_REL: () => RENDERER_REL,
  ZCODE_CONFIG: () => ZCODE_CONFIG,
  ZCODE_DIR: () => ZCODE_DIR,
  ZCODE_SKILLS: () => ZCODE_SKILLS,
  checkLocalHarnessConfig: () => checkLocalHarnessConfig
});
import { lstatSync } from "node:fs";
import { join } from "node:path";
function present(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}
function checkLocalHarnessConfig(root, runRenderer) {
  if (!present(join(root, ZCODE_DIR))) return { kind: "skip" };
  if (!present(join(root, RENDERER_REL))) return { kind: "skip" };
  if (!present(join(root, ZCODE_CONFIG))) {
    if (present(join(root, ZCODE_SKILLS))) return { kind: "partial" };
    return {
      kind: "skip",
      note: `${ZCODE_CONFIG} absent \u2014 no rendered zcode shim in this checkout, nothing checked`
    };
  }
  const result = runRenderer(root, [RENDERER_REL, "--check", "--root", root]);
  if (result.timedOut || result.notFound) return { kind: "error", result };
  return result.exitCode === 0 ? { kind: "ok", result } : { kind: "drift", result };
}
var ZCODE_DIR, RENDERER_REL, ZCODE_CONFIG, ZCODE_SKILLS;
var init_harness_config_local = __esm({
  "packages/core/hooks/checks/harness-config-local.ts"() {
    "use strict";
    ZCODE_DIR = ".zcode";
    RENDERER_REL = "scripts/render-harness-config.mjs";
    ZCODE_CONFIG = `${ZCODE_DIR}/config.json`;
    ZCODE_SKILLS = `${ZCODE_DIR}/skills`;
  }
});

// packages/core/hooks/pre-push.ts
import {
  existsSync as existsSync2,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync
} from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync as spawnSync2 } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// packages/core/hooks/utils/run-check.ts
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { win32 as pathWin32 } from "node:path";
var DEFAULT_TIMEOUT_MS = 12e4;
var TIMEOUT_EXIT_CODE = 124;
var SPAWN_FAILURE_EXIT_CODE = 127;
function resolveNodeToolShim(cmd, args, platform = process.platform, execPath = process.execPath, exists = existsSync) {
  if (platform !== "win32") return { cmd, args };
  if (cmd !== "npm" && cmd !== "npx") return { cmd, args };
  const cli = pathWin32.join(
    pathWin32.dirname(execPath),
    "node_modules",
    "npm",
    "bin",
    `${cmd}-cli.js`
  );
  if (!exists(cli)) return { cmd, args };
  return { cmd: execPath, args: [cli, ...args] };
}
function runCheck(cmd, args = [], opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const spawned = resolveNodeToolShim(cmd, args);
  const result = spawnSync(spawned.cmd, spawned.args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024
  });
  const errCode = result.error?.code;
  const timedOut = errCode === "ETIMEDOUT" || result.signal === "SIGTERM";
  const notFound = errCode === "ENOENT";
  let exitCode;
  if (timedOut) {
    exitCode = TIMEOUT_EXIT_CODE;
  } else if (result.error) {
    exitCode = SPAWN_FAILURE_EXIT_CODE;
  } else {
    exitCode = result.status ?? 1;
  }
  let stderr = result.stderr ?? "";
  if (result.error && stderr.length === 0) {
    stderr = `${result.error.message}
`;
  }
  return {
    exitCode,
    stdout: result.stdout ?? "",
    stderr,
    timedOut,
    notFound
  };
}

// packages/core/hooks/checks/prior-art.ts
var PA_HISTORICAL_CUTOFF = "2026-05-12";
var SSOT_CITATION_RE = /prior-art-evaluations\.md#(\d+)/g;
function extractCitedSsotIds(text) {
  const out = [];
  SSOT_CITATION_RE.lastIndex = 0;
  let m;
  while ((m = SSOT_CITATION_RE.exec(text)) !== null) out.push(Number(m[1]));
  return out;
}
function loadSsotIds(ssotContent) {
  const ids = /* @__PURE__ */ new Set();
  const rowRe = /^\|\s*(\d+)\s*\|/gm;
  let m;
  while ((m = rowRe.exec(ssotContent)) !== null) ids.add(Number(m[1]));
  return ids;
}
var ROW_RENAMED_RE = /<!--\s*prior-art:renamed\s+([^>]*?)\s*-->/;
var ROW_RENAMED_RATIONALE_MIN = 20;
var ROW_MOVED_RE = /<!--\s*prior-art:was\s+(\d+)\s+in\s+([0-9a-f]{7,40})\s*-->/g;
function normaliseRowTitle(cell) {
  return cell.replace(ROW_RENAMED_RE, "").replace(ROW_MOVED_RE, "").replace(/[*`_]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function loadSsotRowTitles(ssotContent) {
  const titles = /* @__PURE__ */ new Map();
  for (const line of ssotContent.split("\n")) {
    const m = /^\|\s*(\d+)\s*\|([^|]*)\|/.exec(line);
    if (m === null) continue;
    const escape = ROW_RENAMED_RE.exec(line);
    if (escape !== null && escape[1].trim().length >= ROW_RENAMED_RATIONALE_MIN)
      continue;
    titles.set(Number(m[1]), normaliseRowTitle(m[2]));
  }
  return titles;
}
function loadSsotRowMoves(ssotContent) {
  const moves = /* @__PURE__ */ new Map();
  for (const line of ssotContent.split("\n")) {
    const m = /^\|\s*(\d+)\s*\|/.exec(line);
    if (m === null) continue;
    const found = [...line.matchAll(ROW_MOVED_RE)].map((x) => ({
      oldId: Number(x[1]),
      sha: x[2]
    }));
    if (found.length > 0) moves.set(Number(m[1]), found);
  }
  return moves;
}
function movedRowVerifies(id, then, views) {
  const { atTip, tipMoves, sha } = views;
  if (atTip === void 0 || tipMoves === void 0 || sha === void 0)
    return false;
  for (const [row, moves] of tipMoves) {
    const claims = moves.some((mv) => mv.oldId === id && sha.startsWith(mv.sha));
    if (claims && atTip.get(row) === then) return true;
  }
  return false;
}
function renumberedCitedIds(citedIds, views) {
  const { atCommit, atTip } = views;
  if (atCommit === void 0 || atTip === void 0) return [];
  return citedIds.filter((id) => {
    const then = atCommit.get(id);
    const now = atTip.get(id);
    if (then === void 0 || now === void 0) return false;
    return then !== now && !movedRowVerifies(id, then, views);
  });
}
var REFERENT_RE = /prior-art-evaluations\.md#\d+|[\w.-]+(?:\/[\w.-]+)*\.(?:tsx?|[cm]?js|sh|md|markdown|json|ya?ml|py|rs|toml)\b|#\d{2,}/;
var PLACEHOLDERS = /* @__PURE__ */ new Set([
  "todo",
  "later",
  "na",
  "tbd",
  "fixme",
  "placeholder",
  ""
]);
function loc(content) {
  return content.split("\n").length - 1;
}
function stripPunctLower(word) {
  return word.toLowerCase().replace(/[!-/:-@[-`{-~]/g, "");
}
function braceDelta(body) {
  const code = body.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  let depth = 0;
  for (const ch of code) {
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
  }
  return depth;
}
function isNewDepAdded(packageJsonDiff) {
  if (!packageJsonDiff) return false;
  const added = /* @__PURE__ */ new Set();
  const removed = /* @__PURE__ */ new Set();
  const re = /^([+-])\s+"([^"]+)":\s*"(\^|~|>=?|<=?|=|[0-9*])/;
  const nonDepBlockRe = /^[+\- ]\s*"(overrides|resolutions|pnpm)"\s*:\s*\{/;
  let skipIndent = null;
  for (const line of packageJsonDiff.split("\n")) {
    if (line.startsWith("@@")) {
      skipIndent = null;
      continue;
    }
    const body = line.slice(1);
    const indent = body.length - body.trimStart().length;
    if (skipIndent !== null) {
      if (indent <= skipIndent && /^\s*[}\]]/.test(body)) skipIndent = null;
      continue;
    }
    if (nonDepBlockRe.test(line)) {
      if (braceDelta(body) > 0) skipIndent = indent;
      continue;
    }
    const m = re.exec(line);
    if (!m) continue;
    (m[1] === "+" ? added : removed).add(m[2]);
  }
  for (const key of added) {
    if (!removed.has(key)) return true;
  }
  return false;
}
var DOC_FILE_RE = /\.(md|markdown)$/i;
var TEST_FILE_RE = /(?:^|\/)(?:tests?|__tests__|__fixtures__|[\w.-]*fixtures)\/|\.(?:test|spec)\.(?:[cm]?[jt]sx?|sh|mjs)$/;
var ENFORCEMENT_FILE_RE = /^packages\/core\/principles\/[^/]+$/;
function isExemptTestMaterial(path) {
  if (ENFORCEMENT_FILE_RE.test(path)) return false;
  return TEST_FILE_RE.test(path);
}
function isNewCoreSubdir50Loc(sha, g) {
  for (const { status, path } of g.changedFiles(sha)) {
    if (status !== "A") continue;
    if (!path.startsWith("packages/core/")) continue;
    if (DOC_FILE_RE.test(path)) continue;
    if (isExemptTestMaterial(path)) continue;
    const subdir = path.slice("packages/core/".length).split("/")[0];
    if (g.subdirExistedAtParent(sha, subdir)) continue;
    const content = g.fileContent(sha, path);
    if (content !== null && loc(content) >= 50) {
      if (!g.blobTrackedAtBase(sha, path)) return true;
    }
  }
  return false;
}
function isNewPackages80Loc(sha, g) {
  for (const { status, path } of g.changedFiles(sha)) {
    if (status !== "A") continue;
    if (!path.startsWith("packages/")) continue;
    if (DOC_FILE_RE.test(path)) continue;
    if (isExemptTestMaterial(path)) continue;
    const content = g.fileContent(sha, path);
    if (content !== null && loc(content) >= 80) {
      if (!g.blobTrackedAtBase(sha, path)) return true;
    }
  }
  return false;
}
function detectCapabilityReason(sha, g) {
  if (isNewDepAdded(g.packageJsonDiff(sha)))
    return "new explicit dep in package.json";
  if (isNewCoreSubdir50Loc(sha, g))
    return "new file \u226550 LOC under new packages/core/<dir>/";
  if (isNewPackages80Loc(sha, g)) return "new file \u226580 LOC under packages/";
  return null;
}
function checkTrailerBody(body, authorDate, cutoff = PA_HISTORICAL_CUTOFF, ssotIds, ssotTitles) {
  if (authorDate && authorDate < cutoff) return { code: 0, message: "" };
  let foundAny = false;
  let sawUnreferenced = false;
  for (const line of body.split("\n")) {
    if (!line.startsWith("Prior-art:")) continue;
    foundAny = true;
    let payload = line.slice("Prior-art:".length).replace(/^ /, "");
    if (payload.length < 20) continue;
    if (payload.startsWith("skipped")) {
      let rationale = payload.slice("skipped".length).replace(/^ +/, "");
      rationale = rationale.replace(/^[—–\-:]/, "").replace(/^ +/, "");
      if (rationale.length < 20) continue;
      const words = rationale.split(/\s+/).filter(Boolean);
      const allPlaceholder = words.every(
        (w) => PLACEHOLDERS.has(stripPunctLower(w))
      );
      if (allPlaceholder) continue;
      return {
        code: 2,
        message: "substance: Prior-art: skipped on capability commit \u2014 cite an SSOT entry (prior-art-evaluations.md#N) instead"
      };
    }
    if (!REFERENT_RE.test(payload)) {
      sawUnreferenced = true;
      continue;
    }
    if (ssotIds) {
      const missing = extractCitedSsotIds(line).filter(
        (id) => !ssotIds.has(id)
      );
      if (missing.length > 0) {
        return {
          code: 3,
          message: `cites prior-art-evaluations.md#${missing.map(String).join(", #")} but no such entry exists in SSOT \u2014 broken citation`
        };
      }
    }
    if (ssotTitles) {
      const moved = renumberedCitedIds(extractCitedSsotIds(line), ssotTitles);
      if (moved.length > 0) {
        return {
          code: 4,
          message: `cites prior-art-evaluations.md#${moved.map(String).join(
            ", #"
          )} but that id now names a different entry than it did in this commit's own tree \u2014 the row was renumbered under the trailer`
        };
      }
    }
    return { code: 0, message: "" };
  }
  if (sawUnreferenced) {
    return {
      code: 1,
      message: "Prior-art: line names no resolvable referent \u2014 cite an SSOT row (prior-art-evaluations.md#N), a concrete artefact path (path/to/file.ts:12), or an issue/PR reference (#1271)"
    };
  }
  return {
    code: 1,
    message: foundAny ? "Prior-art: line found but invalid (length <20 or placeholder rationale)" : "no Prior-art: trailer"
  };
}
function runPriorArtCheck(commits, g, cutoff = PA_HISTORICAL_CUTOFF, ssotIds, ssotTitles) {
  const failures = [];
  const substanceFailures = [];
  const brokenCitations = [];
  const renumberedCitations = [];
  for (const sha of commits) {
    const reason = detectCapabilityReason(sha, g);
    if (reason === null) continue;
    const ids = typeof ssotIds === "function" ? ssotIds(sha) : ssotIds;
    const views = ssotTitles === void 0 ? void 0 : {
      atCommit: ssotTitles.atCommit(sha),
      atTip: ssotTitles.atTip,
      tipMoves: ssotTitles.tipMoves,
      sha
    };
    const { code, message } = checkTrailerBody(
      g.commitBody(sha),
      g.authorDate(sha),
      cutoff,
      ids,
      views
    );
    if (code === 1) failures.push({ sha: sha.slice(0, 10), reason, message });
    else if (code === 2)
      substanceFailures.push({ sha: sha.slice(0, 10), reason, message });
    else if (code === 3)
      brokenCitations.push({ sha: sha.slice(0, 10), reason, message });
    else if (code === 4)
      renumberedCitations.push({ sha: sha.slice(0, 10), reason, message });
  }
  return {
    failures,
    substanceFailures,
    brokenCitations,
    renumberedCitations
  };
}

// packages/core/hooks/checks/s17.ts
var S17_HISTORICAL_CUTOFF = "2026-05-12";
var ALLOWLIST_RE = /^(docs\(research-patches\)|chore\(snapshot-regen\)|chore\(prior-art-update\)):/;
var DISCIPLINE_FILE_RE = /^(\.claude\/rules\/[^/]+\.md|packages\/core\/principles\/[^/]+\.test\.ts|\.claude\/skills\/[^/]+\/SKILL\.md)$/;
var DISCIPLINE_DIR_RE = /^(\.claude\/rules\/|packages\/core\/principles\/|\.claude\/skills\/)/;
var SECTION_MARKER_RE = /^\+(## §|export const [A-Z_]+: )/;
var PLACEHOLDERS2 = /* @__PURE__ */ new Set([
  "todo",
  "later",
  "na",
  "tbd",
  "fixme",
  "placeholder",
  ""
]);
var FILE_LINE_RE = /[^\s]+\.[a-z]+:[0-9]+/;
var PROSE_S17_RE = /(^|[^/])§1\.7/;
function stripPunctLower2(word) {
  return word.toLowerCase().replace(/[!-/:-@[-`{-~]/g, "");
}
function isAllPlaceholder(text) {
  return text.split(/\s+/).filter(Boolean).every((w) => PLACEHOLDERS2.has(stripPunctLower2(w)));
}
function isDisciplineIntroducing(sha, g) {
  if (ALLOWLIST_RE.test(g.commitSubject(sha))) return false;
  const names = g.changedFiles(sha).map((c) => c.path);
  if (!names.some((n) => DISCIPLINE_FILE_RE.test(n))) return false;
  const rulePaths = names.filter((n) => DISCIPLINE_DIR_RE.test(n));
  if (rulePaths.length === 0) return false;
  return g.diffForPaths(sha, rulePaths).split("\n").some((line) => SECTION_MARKER_RE.test(line));
}
function checkS17TrailerBody(body, authorDate, cutoff = S17_HISTORICAL_CUTOFF) {
  if (authorDate && authorDate < cutoff) return { code: 0, message: "" };
  const lines = body.split("\n");
  const bsLine = lines.find((l) => l.startsWith("\xA71.7 Bootstrap:"));
  if (bsLine) {
    const bs = bsLine.slice("\xA71.7 Bootstrap:".length).replace(/^[ \t]+/, "");
    if (bs.length >= 20 && !isAllPlaceholder(bs))
      return { code: 0, message: "" };
  }
  for (const line of lines) {
    if (!line.startsWith("\xA71.7:")) continue;
    const payload = line.slice("\xA71.7:".length).replace(/^ /, "");
    if (payload.length < 40) continue;
    if (!isAllPlaceholder(payload)) {
      if (FILE_LINE_RE.test(payload)) return { code: 0, message: "" };
      return {
        code: 2,
        message: "\xA71.7: trailer present but lacks file:line citation (substance check \u2014 Wave 8.3)"
      };
    }
  }
  if (lines.some((l) => PROSE_S17_RE.test(l))) {
    return {
      code: 2,
      message: "\xA71.7 mentioned in commit body prose but no formal trailer line (substance check \u2014 Wave 9.4)"
    };
  }
  return { code: 1, message: "no valid \xA71.7: trailer (or bootstrap)" };
}
function runS17Check(commits, g, cutoff = S17_HISTORICAL_CUTOFF) {
  const failures = [];
  const substanceFailures = [];
  for (const sha of commits) {
    if (!isDisciplineIntroducing(sha, g)) continue;
    const { code, message } = checkS17TrailerBody(
      g.commitBody(sha),
      g.authorDate(sha),
      cutoff
    );
    if (code === 1) failures.push({ sha: sha.slice(0, 10), message });
    else if (code === 2)
      substanceFailures.push({ sha: sha.slice(0, 10), message });
  }
  return { failures, substanceFailures };
}

// packages/core/hooks/checks/docs-card.ts
var DOCS_CARD_IDS = [
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
  "C10",
  "C11",
  "C12",
  "C13"
];
var DOCS_CARD_VALUES = ["PASS", "FAIL", "N/A"];
var DOCS_CARD_SKIP_MIN = 20;
var TRAILER_RE = /^[ \t]*Docs-card:[ \t]*(.*)$/im;
var CLAIM_RE = /^[ \t]*Docs-card-for:[ \t]*([0-9a-f]{7,40})[ \t]+(.*)$/gim;
var DEFERRAL_MARKER_RE = /^docs-refresh: deferred\b/;
function isMechanicalProseDiff(diff) {
  const hunks = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("@@")) hunks.push({ removed: [], added: [] });
    const hunk = hunks[hunks.length - 1];
    if (!hunk || line.startsWith("---") || line.startsWith("+++")) continue;
    const text = line.slice(1);
    if (DEFERRAL_MARKER_RE.test(text)) continue;
    if (line.startsWith("-")) hunk.removed.push(text);
    else if (line.startsWith("+")) hunk.added.push(text);
  }
  if (hunks.length === 0) return false;
  const digitless = (s) => s.replace(/\d+/g, "0");
  return hunks.every(
    ({ removed, added }) => removed.length === added.length && removed.every((r, i) => digitless(r) === digitless(added[i] ?? ""))
  );
}
function isDocsSiteProsePath(path) {
  return /^docs\/site\/.*\.mdx?$/i.test(path);
}
var PLACEHOLDERS3 = /* @__PURE__ */ new Set([
  "todo",
  "later",
  "na",
  "n/a",
  "tbd",
  "fixme",
  "placeholder",
  ""
]);
function parseDocsCardTrailer(body) {
  const m = TRAILER_RE.exec(body);
  if (!m) return { kind: "absent" };
  return parseDocsCardPayload(m[1] ?? "");
}
function parseDocsCardPayload(raw) {
  const payload = raw.trim();
  if (payload.startsWith("skipped")) {
    const rationale = payload.slice("skipped".length).replace(/^[\s—–-]+/, "").trim();
    return { kind: "skipped", reason: rationale };
  }
  const entries = /* @__PURE__ */ new Map();
  const invalid = [];
  const unknown = [];
  const duplicated = [];
  for (const raw2 of payload.split(",")) {
    const token = raw2.trim();
    if (token === "") continue;
    const tm = /^(C\d{1,2})\s+(\S+)$/i.exec(token);
    if (!tm) {
      invalid.push(token);
      continue;
    }
    const id = `C${Number(tm[1].slice(1))}`;
    const value = tm[2] ?? "";
    if (!DOCS_CARD_IDS.includes(id)) {
      unknown.push(token);
      continue;
    }
    if (!DOCS_CARD_VALUES.includes(value)) {
      invalid.push(token);
      continue;
    }
    if (entries.has(id)) {
      duplicated.push(id);
      continue;
    }
    entries.set(id, value);
  }
  const missing = DOCS_CARD_IDS.filter((id) => !entries.has(id));
  return { kind: "card", entries, missing, invalid, unknown, duplicated };
}
function isMergeCommit(subject) {
  return /^Merge /i.test(subject);
}
function payloadProblem(parsed) {
  if (parsed.kind === "absent") return null;
  if (parsed.kind === "skipped") {
    if (parsed.reason.length < DOCS_CARD_SKIP_MIN || PLACEHOLDERS3.has(parsed.reason.toLowerCase())) {
      return {
        reason: "escape rationale too short or placeholder",
        message: `\`Docs-card: skipped \u2014 ${parsed.reason}\` \u2014 rationale must be >=${DOCS_CARD_SKIP_MIN} chars and say why (not TODO/later/n-a/tbd/fixme/placeholder)`
      };
    }
    return null;
  }
  const problems = [];
  if (parsed.missing.length > 0) problems.push(`missing card ids: ${parsed.missing.join(", ")}`);
  if (parsed.invalid.length > 0)
    problems.push(`invalid entries (want \`C<n> PASS|FAIL|N/A\`): ${parsed.invalid.join(", ")}`);
  if (parsed.unknown.length > 0) problems.push(`unknown entries: ${parsed.unknown.join(", ")}`);
  if (parsed.duplicated.length > 0) problems.push(`duplicated ids: ${parsed.duplicated.join(", ")}`);
  return problems.length > 0 ? { reason: "malformed Docs-card trailer", message: problems.join("; ") } : null;
}
function runDocsCardCheck(commits, git) {
  const failures = [];
  const isMerge = new Map(commits.map((sha) => [sha, isMergeCommit(git.commitSubject(sha))]));
  const prosePaths = /* @__PURE__ */ new Map();
  const own = /* @__PURE__ */ new Map();
  for (const sha of commits) {
    if (isMerge.get(sha)) continue;
    prosePaths.set(sha, git.changedFiles(sha).map((f) => f.path).filter(isDocsSiteProsePath));
    own.set(sha, parseDocsCardTrailer(git.commitBody(sha)));
  }
  const claims = /* @__PURE__ */ new Map();
  for (const claimer of commits) {
    if (isMerge.get(claimer)) continue;
    for (const m of git.commitBody(claimer).matchAll(CLAIM_RE)) {
      const prefix = m[1] ?? "";
      const named = commits.filter((sha) => sha.startsWith(prefix));
      const target = named.length === 1 ? named[0] : void 0;
      const fail = (reason) => {
        failures.push({ sha: claimer, reason, message: `\`Docs-card-for: ${prefix}\` \u2014 ${reason}` });
      };
      if (target === void 0) fail(named.length > 1 ? "claim names an ambiguous sha prefix" : "claim names a commit outside the range");
      else if (isMerge.get(target)) fail("claim names a merge commit, which owes no card");
      else if ((prosePaths.get(target) ?? []).length === 0) fail("claim names a commit that touches no docs/site prose");
      else if (own.get(target)?.kind !== "absent") fail("claim names a commit that carries its own Docs-card trailer");
      else if (claims.has(target)) fail("more than one claim names this commit");
      else claims.set(target, parseDocsCardPayload(m[2] ?? ""));
    }
  }
  let checked = 0;
  let proseCommits = 0;
  for (const sha of commits) {
    if (isMerge.get(sha)) continue;
    checked++;
    const paths = prosePaths.get(sha) ?? [];
    if (paths.length === 0) continue;
    proseCommits++;
    const ownCard = own.get(sha) ?? { kind: "absent" };
    const claim = claims.get(sha);
    if (ownCard.kind === "absent" && claim === void 0) {
      failures.push({
        sha,
        reason: "missing Docs-card trailer",
        message: "commit touches docs/site/**/*.md prose but carries no `Docs-card:` trailer"
      });
      continue;
    }
    const parsed = claim ?? ownCard;
    const problem = payloadProblem(parsed);
    if (problem) {
      failures.push({ sha, ...problem });
      continue;
    }
    if (claim?.kind === "skipped" && !isMechanicalProseDiff(git.diffForPaths(sha, paths))) {
      failures.push({
        sha,
        reason: "skip claim on a commit whose prose diff is not mechanical",
        message: "a `Docs-card-for:` skip is accepted only when every changed prose line differs from its pair in digits alone, or is a docs-refresh deferral marker \u2014 this diff changes words, so the claim must carry the full card"
      });
    }
  }
  return { checked, proseCommits, failures };
}

// packages/core/hooks/checks/unpinned-tool-install.ts
function isShellScriptPopulationFile(relPath) {
  if (relPath.startsWith(".husky/_/")) return false;
  if (relPath.endsWith(".sh")) return true;
  if (relPath === "setup") return true;
  if (relPath.startsWith(".husky/") || relPath.startsWith("plugin/hooks/")) {
    const base = relPath.slice(relPath.lastIndexOf("/") + 1);
    return !base.includes(".");
  }
  return false;
}
var ESCAPE_HATCH_RE = /\bci-tool-pin:\s+allow\b/;
var COMMENT_LINE_RE = /^\s*#/;
var PRINT_LINE_RE = /^\s*(?:echo|printf)\b/;
function checkPipLine(rawLine) {
  if (COMMENT_LINE_RE.test(rawLine)) return null;
  if (PRINT_LINE_RE.test(rawLine)) return null;
  if (ESCAPE_HATCH_RE.test(rawLine)) return null;
  if (!/\bpip\s+install\b/.test(rawLine)) return null;
  if (/\bpip\s+install\s+-r\b/.test(rawLine)) return null;
  if (/\bpip\s+install\s+\./.test(rawLine)) return null;
  if (/\bpip\s+install\s+-e\s+\./.test(rawLine)) return null;
  if (/==/.test(rawLine)) return null;
  return "fix: add a version pin, e.g. `pip install <pkg>==<ver>`";
}
function checkNpmGlobalLine(rawLine) {
  if (COMMENT_LINE_RE.test(rawLine)) return null;
  if (PRINT_LINE_RE.test(rawLine)) return null;
  if (ESCAPE_HATCH_RE.test(rawLine)) return null;
  if (!/\bnpm\s+(?:install|i)\s+-g\b/.test(rawLine)) return null;
  if (/@[\^~>=]*\d/.test(rawLine.replace(/@[\w.-]+\//g, ""))) return null;
  return "fix: add a version pin, e.g. `npm install -g <pkg>@<ver>`";
}
function checkUnpinnedToolInstalls(content, filename) {
  const findings = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNo = i + 1;
    const pipHint = checkPipLine(rawLine);
    if (pipHint !== null) {
      findings.push({ file: filename, line: lineNo, text: rawLine.trim(), hint: pipHint });
      continue;
    }
    const npmHint = checkNpmGlobalLine(rawLine);
    if (npmHint !== null) {
      findings.push({ file: filename, line: lineNo, text: rawLine.trim(), hint: npmHint });
    }
  }
  return findings;
}

// packages/core/hooks/utils/git.ts
function gitOut(args) {
  return runCheck("git", args).stdout;
}
var Z40 = "0000000000000000000000000000000000000000";
function parsePushRefs(stdin) {
  return stdin.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => line.split(/\s+/)).filter((parts) => parts.length >= 4).map(([localRef, localSha, remoteRef, remoteSha]) => ({
    localRef: localRef ?? "",
    localSha: localSha ?? "",
    remoteRef: remoteRef ?? "",
    remoteSha: remoteSha ?? ""
  }));
}
function upstreamExists(ref) {
  return runCheck("git", ["rev-parse", "--verify", ref]).exitCode === 0;
}
function resolveDefaultBase() {
  const head = gitOut([
    "symbolic-ref",
    "--short",
    "refs/remotes/origin/HEAD"
  ]).trim();
  if (head && upstreamExists(head)) return head;
  for (const ref of ["origin/staging", "origin/main", "origin/master"]) {
    if (upstreamExists(ref)) return ref;
  }
  return null;
}
function commitsNotOnRemotes(localSha) {
  return gitOut(["rev-list", localSha, "--not", "--remotes"]).split("\n").map((s) => s.trim()).filter(Boolean);
}
function getCommits(upstreamRef, head = "HEAD", excludeReachableFrom) {
  const args = ["rev-list", `${upstreamRef}..${head}`];
  if (excludeReachableFrom) args.push("--not", excludeReachableFrom);
  return gitOut(args).split("\n").map((s) => s.trim()).filter(Boolean);
}
function getChangedFiles(upstreamRef, diffFilter = "ACMR", head = "HEAD") {
  return gitOut([
    "diff",
    "--name-only",
    `${upstreamRef}..${head}`,
    `--diff-filter=${diffFilter}`
  ]).split("\n").map((s) => s.trim()).filter(Boolean);
}
function parseNameStatus(out) {
  return out.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const tab = line.indexOf("	");
    if (tab === -1) return { status: line, path: "" };
    return { status: line.slice(0, tab), path: line.slice(tab + 1) };
  }).filter((e) => e.path !== "");
}
var realGit = {
  packageJsonDiff: (sha) => gitOut(["show", sha, "--", "package.json"]),
  changedFiles: (sha) => parseNameStatus(
    gitOut(["diff-tree", "--no-commit-id", "--name-status", "-r", sha])
  ),
  fileContent: (sha, path) => {
    const r = runCheck("git", ["show", `${sha}:${path}`]);
    return r.exitCode === 0 ? r.stdout : null;
  },
  subdirExistedAtParent: (sha, subdir) => {
    const parent = `${sha}^`;
    if (!upstreamExists(parent)) return false;
    const out = gitOut([
      "ls-tree",
      "-r",
      "--name-only",
      parent,
      "--",
      `packages/core/${subdir}/`
    ]);
    return out.trim().length > 0;
  },
  commitBody: (sha) => gitOut(["show", "-s", "--format=%B", sha]),
  authorDate: (sha) => gitOut(["show", "-s", "--format=%ai", sha]).trim().split(" ")[0] ?? "",
  commitSubject: (sha) => gitOut(["show", "-s", "--format=%s", sha]).replace(/\n$/, ""),
  diffForPaths: (sha, paths) => gitOut(["show", sha, "--", ...paths]),
  blobTrackedAtBase: (sha, path) => blobTrackedIn(`${sha}^`, sha, path)
};
function blobTrackedIn(baseTree, sourceTree, path) {
  const blob = runCheck("git", ["rev-parse", `${sourceTree}:${path}`]);
  if (blob.exitCode !== 0) return false;
  const hash = blob.stdout.trim();
  if (!/^[0-9a-f]{40,64}$/.test(hash)) return false;
  if (!upstreamExists(baseTree)) return false;
  for (const line of gitOut(["ls-tree", "-r", baseTree]).split("\n")) {
    const m = /^\d+ blob ([0-9a-f]+)\t/.exec(line);
    if (m && m[1] === hash) return true;
  }
  return false;
}

// packages/core/hooks/pre-push.ts
var HERE = dirname(fileURLToPath(import.meta.url));
var REPO_ROOT = resolve(HERE, "../../..");
var CORE = resolve(REPO_ROOT, "packages/core");
var run = (cmd, args = []) => runCheck(cmd, args, { cwd: REPO_ROOT });
var EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
function readPushStdin() {
  if (process.stdin.isTTY) return "";
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}
function resolveBase() {
  const env = process.env["PREPUSH_UPSTREAM_REF"];
  if (env)
    return {
      base: env,
      commits: null,
      head: "HEAD",
      exclude: resolveDefaultBase(),
      source: "env"
    };
  const refs = parsePushRefs(readPushStdin());
  if (refs.length > 0) {
    const r = refs[0];
    if (r.remoteSha !== Z40 && upstreamExists(`${r.remoteSha}^{commit}`)) {
      return {
        base: r.remoteSha,
        commits: null,
        head: r.localSha,
        exclude: resolveDefaultBase(),
        source: "stdin"
      };
    }
    const newCommits = commitsNotOnRemotes(r.localSha);
    const oldest = newCommits[newCommits.length - 1];
    const base = oldest && upstreamExists(`${oldest}^`) ? `${oldest}^` : EMPTY_TREE;
    return {
      base,
      commits: newCommits,
      head: r.localSha,
      exclude: null,
      source: "stdin-new-branch"
    };
  }
  const def = resolveDefaultBase();
  if (def) {
    return {
      base: def,
      commits: null,
      head: "HEAD",
      exclude: null,
      source: "default"
    };
  }
  return {
    base: null,
    commits: null,
    head: "HEAD",
    exclude: null,
    source: "unresolved"
  };
}
function warnSkip(label, why) {
  process.stdout.write(
    `\u26A0 pre-push ${label}: could not determine a base ref (${why}) \u2014 skipping this check.
  Not a silent pass: set PREPUSH_UPSTREAM_REF, or push so git supplies the base on stdin.
`
  );
}
function commitsToCheck(rb, label) {
  if (rb.commits !== null) return rb.commits;
  if (rb.base === null) {
    warnSkip(label, "no PREPUSH_UPSTREAM_REF, no git stdin, no default branch");
    return null;
  }
  if (!upstreamExists(rb.base)) {
    warnSkip(label, `base ref '${rb.base}' not found`);
    return null;
  }
  return getCommits(rb.base, rb.head, rb.exclude ?? void 0);
}
var saidNotArmed = /* @__PURE__ */ new Set();
function onceNotArmed(out) {
  return out.split(/(?<=\n)/).filter((l) => {
    if (!l.startsWith("\xB7 not armed: ")) return true;
    const key = l.trimEnd();
    if (saidNotArmed.has(key)) return false;
    saidNotArmed.add(key);
    return true;
  }).join("");
}
function emit(r) {
  if (r.stdout) process.stdout.write(onceNotArmed(r.stdout));
  if (r.stderr) process.stderr.write(r.stderr);
}
function die(msg, r) {
  process.stderr.write(`${msg}
`);
  if (r) emit(r);
  process.exit(1);
}
function workflowYmlFiles() {
  const dir = resolve(REPO_ROOT, ".github/workflows");
  if (!existsSync2(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".yml")).map((f) => `.github/workflows/${f}`);
}
function shellScriptFiles() {
  const r = run("git", ["ls-files", "-z"]);
  if (r.exitCode !== 0) return [];
  return r.stdout.split("\0").filter((l) => l.length > 0 && isShellScriptPopulationFile(l));
}
function requireTool(cmd, args, installHint, failHint) {
  const r = run(cmd, args);
  if (r.notFound) {
    die(`\u274C ${cmd} not found in PATH.
${installHint}`);
  }
  if (r.exitCode !== 0) {
    if (failHint) {
      emit(r);
      die(`
${failHint}`);
    }
    die(`\u274C ${cmd} reported problems:`, r);
  }
  emit(r);
}
function envWarnOnly(name) {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}
var SSOT_REL = "docs/meta-factory/prior-art-evaluations.md";
function ssotIdsAt(sha) {
  const content = realGit.fileContent(sha, SSOT_REL);
  return content === null ? void 0 : loadSsotIds(content);
}
function ssotTitlesAt(sha) {
  const content = realGit.fileContent(sha, SSOT_REL);
  return content === null ? void 0 : loadSsotRowTitles(content);
}
function ssotContentAtTip() {
  const abs = resolve(REPO_ROOT, SSOT_REL);
  if (!existsSync2(abs)) return void 0;
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return void 0;
  }
}
function priorArtSection(rb) {
  const commits = commitsToCheck(rb, "\xA77");
  if (commits === null) return;
  const substanceWarnOnly = envWarnOnly("PA_SUBSTANCE_WARN_ONLY");
  const tip = ssotContentAtTip();
  const report = runPriorArtCheck(commits, realGit, void 0, ssotIdsAt, {
    atCommit: ssotTitlesAt,
    atTip: tip === void 0 ? void 0 : loadSsotRowTitles(tip),
    tipMoves: tip === void 0 ? void 0 : loadSsotRowMoves(tip)
  });
  if (report.failures.length > 0) {
    process.stdout.write(
      "\n\u274C Prior-art trailer missing or invalid on capability commit(s):\n"
    );
    for (const f of report.failures) {
      process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}
`);
    }
    process.stdout.write(
      '\nFix: amend the commit body to include a `Prior-art:` line per CONTRIBUTING.md.\nExamples:\n  Prior-art: prior-art-evaluations.md#1 (Autogrep, verdict DEFER \u2014 different domain).\n  Prior-art: skipped \u2014 refactor only, no new capability\n\nRules: \u226520 chars after "Prior-art:" (or after "skipped \u2014 "); placeholder\nrationales (TODO / later / n/a / tbd / fixme / placeholder) are rejected.\nA positive line must also name a resolvable referent \u2014 an SSOT row\n(prior-art-evaluations.md#N), an artefact path (setup.d/lib.sh:359), or an\nissue/PR reference (#1271). See CLAUDE.md \xA7`Prior-art:` trailer syntax.\n\n'
    );
    process.exit(1);
  }
  if (report.brokenCitations.length > 0) {
    process.stdout.write(
      "\n\u274C Prior-art trailer cites a non-existent SSOT entry (C1 existence check):\n"
    );
    for (const f of report.brokenCitations) {
      process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}
`);
    }
    process.stdout.write(
      '\nFix: cite an entry that exists in docs/meta-factory/prior-art-evaluations.md,\nor add the entry to the SSOT in the same commit (per CLAUDE.md build-vs-reuse).\nVerify: grep -nE "^\\| *<N> *\\|" docs/meta-factory/prior-art-evaluations.md\n\n'
    );
    process.exit(1);
  }
  if (report.renumberedCitations.length > 0) {
    process.stdout.write(
      "\n\u274C Prior-art trailer cites an id that was RENUMBERED under it (C2):\n"
    );
    for (const f of report.renumberedCitations) {
      process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}
`);
    }
    process.stdout.write(
      '\nThis is the concurrent-lane collision: two branches appended a row with the\nsame id, the one that landed on the base kept the number, and yours was\nrenumbered \u2014 leaving an already-pushed trailer pointing at someone else\u2019s row.\nFix, in order of preference:\n  1. amend the commit body to cite the new id (only while unpushed);\n  2. if history is already published, carry the correction in the SQUASH\n     message and merge the PR yourself \u2014 an auto-merge writes its own body;\n  3. if the row title was reworded deliberately and nothing moved, mark the\n     row: <!-- prior-art:renamed <why, >= 20 chars> -->\n  4. if the commit cannot be amended and the prior art only moved to a new id\n     (a join of lanes), mark its new row: <!-- prior-art:was <old id> in <sha> -->\n     \u2014 accepted only for that commit, and only when the titles still match.\nVerify: grep -nE "^\\| *<N> *\\|" docs/meta-factory/prior-art-evaluations.md\n\n'
    );
    process.exit(1);
  }
  if (report.substanceFailures.length > 0) {
    if (substanceWarnOnly) {
      process.stdout.write(
        "\n\u26A0 Prior-art: escape-hatch on capability commit (substance arm, Wave 8.4):\n"
      );
      for (const f of report.substanceFailures) {
        process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}
`);
      }
      process.stdout.write(
        "\nWarn-only via explicit PA_SUBSTANCE_WARN_ONLY=true (enforcing is the default since 2026-07-25).\nFix: replace `Prior-art: skipped \u2014 \u2026` with `Prior-art: prior-art-evaluations.md#N (verdict X \u2014 rationale)`.\n\n"
      );
    } else {
      process.stdout.write(
        "\n\u274C Prior-art: escape-hatch on capability commit:\n"
      );
      for (const f of report.substanceFailures) {
        process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}
`);
      }
      process.stdout.write(
        "\nA capability commit must cite the SSOT, not take the escape hatch:\n  Prior-art: prior-art-evaluations.md#N (verdict X \u2014 rationale)\nEnforcing by default since 2026-07-25; PA_SUBSTANCE_WARN_ONLY=true downgrades locally.\n\n"
      );
      process.exit(1);
    }
  }
}
function docsCardSection(rb) {
  const commits = commitsToCheck(rb, "Docs-card");
  if (commits === null) return;
  const report = runDocsCardCheck(commits, realGit);
  if (report.failures.length > 0) {
    process.stdout.write(
      "\n\u274C Docs-card trailer missing or invalid on docs/site prose commit(s):\n"
    );
    for (const f of report.failures) {
      process.stdout.write(`  ${f.sha}  reason: ${f.reason}; ${f.message}
`);
    }
    process.stdout.write(
      "\nFix: add a `Docs-card:` trailer listing every criterion \u2014\n  Docs-card: C1 PASS, C2 PASS, \u2026 C13 N/A   (values: PASS | FAIL | N/A)\nor escape with a reason:\n  Docs-card: skipped \u2014 <why, at least 20 chars>\nIf the commit cannot be amended (it sits under merges), a later commit in the same range may\ncarry it for that commit: Docs-card-for: <sha> <card or skip> \u2014 a skip only when its prose diff\nchanges digits or deferral markers alone, one claim per commit.\nThe card is the writer's self-filled criteria card\n(.claude/skills/docs-author/references/criteria-card.md, D30 D-Q16).\n\n"
    );
    process.exit(1);
  }
  process.stdout.write(
    `\u2713 Docs-card: ${report.checked} commit(s) checked, ${report.proseCommits} docs/site prose commit(s), 0 failures
`
  );
}
function s17Section(rb) {
  const commits = commitsToCheck(rb, "\xA71.7");
  if (commits === null) return;
  const warnOnly = envWarnOnly("S17_WARN_ONLY");
  const substanceWarnOnly = envWarnOnly("S17_SUBSTANCE_WARN_ONLY");
  const report = runS17Check(commits, realGit);
  if (report.failures.length > 0) {
    if (warnOnly) {
      process.stdout.write(
        "\n\u26A0 \xA71.7 trailer missing or invalid on rule-introducing commit(s):\n"
      );
      for (const f of report.failures)
        process.stdout.write(`  ${f.sha}  ${f.message}
`);
      process.stdout.write(
        "\nLocal downgrade active (S17_WARN_ONLY=true); the default is enforcing.\nFix: add `\xA71.7: forward-check applied \u2014 \u2026; backward-check sweep \u2014 \u2026` to commit body.\n\n"
      );
    } else {
      process.stdout.write(
        "\n\u274C \xA71.7 trailer missing or invalid on rule-introducing commit(s):\n"
      );
      for (const f of report.failures)
        process.stdout.write(`  ${f.sha}  ${f.message}
`);
      process.stdout.write(
        "\nFix: add `\xA71.7: forward-check applied \u2014 \u2026; backward-check sweep \u2014 \u2026` to commit body.\nBootstrap exemption: `\xA71.7 Bootstrap: <reason>` (\u226520 chars rationale).\n\n"
      );
      process.exit(1);
    }
  }
  if (report.substanceFailures.length > 0) {
    if (substanceWarnOnly) {
      process.stdout.write(
        "\n\u26A0 \xA71.7 trailer lacks file:line citation on rule-introducing commit(s) (substance arm \u2014 Wave 8.3):\n"
      );
      for (const f of report.substanceFailures)
        process.stdout.write(`  ${f.sha}  ${f.message}
`);
      process.stdout.write(
        "\nLocal downgrade active (S17_SUBSTANCE_WARN_ONLY=true); the default is enforcing.\nFix: include \u22651 file:line citation, e.g. `packages/core/principles/02.test.ts:82`.\n\n"
      );
    } else {
      process.stdout.write(
        "\n\u274C \xA71.7 trailer lacks file:line citation on rule-introducing commit(s) (substance arm \u2014 Wave 8.3):\n"
      );
      for (const f of report.substanceFailures)
        process.stdout.write(`  ${f.sha}  ${f.message}
`);
      process.stdout.write(
        "\nFix: include \u22651 file:line citation, e.g. `packages/core/principles/02.test.ts:82`.\nBootstrap exemption: `\xA71.7 Bootstrap: <reason>` (\u226520 chars rationale).\n\n"
      );
      process.exit(1);
    }
  }
}
async function guardLivenessSection(rb) {
  if (rb.base === null) {
    warnSkip(
      "guard-liveness",
      "no resolvable base for change-scoped liveness diff"
    );
    return;
  }
  let gate;
  try {
    gate = await import("./checks/guard-liveness.ts");
  } catch (err) {
    die(
      `\u274C guard-liveness: failed to load the ESLint stack \u2014 the gate requires a
   root-level workspace install (run \`npm install\` at the repo root).
   ${err.message}`
    );
  }
  const report = gate.runGuardLivenessGate(rb.base);
  for (const s of report.skipped) {
    process.stdout.write(`\u2139 guard-liveness: SKIP ${s}
`);
  }
  for (const id of report.noData) {
    process.stdout.write(
      `\u26A0 guard-liveness: ${id} has no negative-test data \u2014 add negative-test.input to enable liveness check
`
    );
  }
  if (report.failures.length === 0) {
    if (report.passed.length > 0) {
      process.stdout.write(
        `\u2705 guard-liveness: ${report.passed.length} ESLint rule(s) passed liveness check
`
      );
    }
    return;
  }
  process.stdout.write(
    "\n\u274C Guard-liveness: ESLint rule negative-test failures on changed rules:\n"
  );
  for (const f of report.failures) {
    process.stdout.write(`  ${f.ruleId}:
`);
    for (const msg of f.failures) {
      process.stdout.write(`    - ${msg}
`);
    }
  }
  process.stdout.write(
    "\nFix: ensure each negative-test.input entry actually triggers the ESLint rule,\nand that examples.good produces no violation.\nSee packages/core/manifest/rules-manifest.json \u2014 the negative-test block.\n\n"
  );
  process.exit(1);
}
async function cmdScriptLivenessSection(rb) {
  if (rb.base === null) {
    warnSkip(
      "cmd-script-liveness",
      "no resolvable base for change-scoped liveness diff"
    );
    return;
  }
  let gate;
  try {
    gate = await import("./checks/cmd-script-liveness.ts");
  } catch (err) {
    die(
      `\u274C cmd-script-liveness: failed to load the liveness runner.
   ${err.message}`
    );
  }
  const report = gate.runCmdScriptLivenessGate(rb.base);
  for (const s of report.skipped) {
    process.stdout.write(`\u2139 cmd-script-liveness: SKIP ${s}
`);
  }
  for (const e of report.exempt) {
    process.stdout.write(`\u2139 cmd-script-liveness: EXEMPT ${e}
`);
  }
  for (const nd of report.noData) {
    process.stdout.write(`\u26A0 cmd-script-liveness: ${nd}
`);
  }
  if (report.failures.length === 0) {
    if (report.passed.length > 0) {
      process.stdout.write(
        `\u2705 cmd-script-liveness: ${report.passed.length} command/script rule(s) passed liveness check
`
      );
    }
    return;
  }
  process.stdout.write(
    "\n\u274C Cmd/script-liveness: rule check failed to catch its violation on changed rules:\n"
  );
  for (const f of report.failures) {
    process.stdout.write(`  ${f.ruleId} [${f.mode ?? "unknown"}]:
`);
    for (const msg of f.failures) process.stdout.write(`    - ${msg}
`);
  }
  process.stdout.write(
    "\nFix: ensure each fixture.setup-script creates the rule's REAL violating state\nso the check exits non-zero. See packages/core/manifest/rules-manifest.json (fixture block).\n\n"
  );
  process.exit(1);
}
function unpinnedToolInstallSection(ctx) {
  if (recordGoverned(
    ctx,
    "scripts/check-ci-pins.sh",
    "\u274C unpinned tool install check failed"
  ))
    return;
  const population = [
    ...workflowYmlFiles(),
    ...ctx.isFrameworkRepo ? shellScriptFiles() : []
  ];
  if (population.length === 0) return;
  const allFindings = [];
  for (const relPath of population) {
    const absPath = resolve(REPO_ROOT, relPath);
    if (!existsSync2(absPath)) continue;
    const content = readFileSync(absPath, "utf8");
    const findings = checkUnpinnedToolInstalls(content, relPath);
    allFindings.push(...findings);
  }
  if (allFindings.length === 0) return;
  process.stdout.write(
    "\n\u274C Unpinned bare-run tool install(s) found in .github/workflows/ or repo shell scripts (.claude/rules/ci-tool-pinning.md \xA71 Rule A):\n"
  );
  for (const f of allFindings) {
    process.stdout.write(`  ${f.file}:${f.line}: ${f.text}
`);
    process.stdout.write(`    ${f.hint}
`);
  }
  process.stdout.write(
    "\nFix: add a version pin to each flagged install, e.g.:\n  pip install pyyaml  \u2192  pip install pyyaml==6.0.2\n  npm install -g tool  \u2192  npm install -g tool@1.2.3\nEscape hatch (genuinely un-pinnable): append  # ci-tool-pin: allow <reason>\n\n"
  );
  process.exit(1);
}
var VALID_OWNERS = [
  "consumer",
  "maintainer",
  "both"
];
var ZIZMOR_FIX_HINT = "   Fix: `zizmor --fix=all <file>` auto-fixes artipacked + template-injection.\n        unpinned-uses is NOT auto-fixable \u2014 SHA-pin each action (e.g. via `pinact` or Dependabot).\n   Audit docs: https://docs.zizmor.sh/audits/";
function actionlintSection() {
  const workflows = workflowYmlFiles();
  if (workflows.length > 0) {
    requireTool(
      "actionlint",
      workflows,
      "   Install: brew install actionlint   (macOS)\n         or: go install github.com/rhysd/actionlint/cmd/actionlint@latest"
    );
  }
}
function zizmorLiveSection() {
  const workflows = workflowYmlFiles();
  if (workflows.length > 0) {
    requireTool(
      "zizmor",
      ["--format", "plain", ".github/workflows/"],
      "   Install: pip install zizmor",
      ZIZMOR_FIX_HINT
    );
  }
}
function zizmorTemplatesSection() {
  const templates = trackedShippedWorkflowTemplates();
  if (templates === null) {
    die(
      "\u274C zizmor shipped-template scan: `git ls-files` failed, so the shipped-template\n   population could not be determined. The scan would silently cover nothing.\n   Fix the repository state; do not skip the gate."
    );
  }
  if (templates.length > 0) {
    requireTool(
      "zizmor",
      ["--format", "plain", ...templates],
      "   Install: pip install zizmor",
      ZIZMOR_FIX_HINT
    );
  }
}
function trackedShippedWorkflowTemplates() {
  const r = run("git", ["ls-files", "-z", "--", "*github-actions*.yml"]);
  if (r.exitCode !== 0) return null;
  return r.stdout.split("\0").filter((l) => l.length > 0 && !l.startsWith(".github/")).filter((l) => existsSync2(resolve(REPO_ROOT, l))).sort();
}
function auditAiDocsSection() {
  if (existsSync2(
    resolve(REPO_ROOT, "packages/core/audit-self/audit-ai-docs.test.ts")
  )) {
    const r = run("npx", [
      "vitest",
      "run",
      "--reporter=default",
      "packages/core/audit-self/audit-ai-docs.test.ts"
    ]);
    if (r.notFound)
      die("\u274C npx not found \u2014 install Node.js to run audit-ai-docs tests");
    if (r.exitCode !== 0) die("\u274C audit-ai-docs.test.ts failed:", r);
    emit(r);
  }
  if (existsSync2(resolve(REPO_ROOT, "packages/core/audit-self/audit-ai-docs.sh"))) {
    const live = [
      [
        "audit-ai-docs.sh",
        "bash",
        ["packages/core/audit-self/audit-ai-docs.sh"]
      ],
      [
        "audit-ai-docs.ts",
        "npx",
        ["tsx", "packages/core/audit-self/audit-ai-docs.ts"]
      ]
    ];
    for (const [label, cmd, args] of live) {
      const r = run(cmd, args);
      if (r.notFound) die(`\u274C ${cmd} not found \u2014 cannot run ${label} live`);
      if (r.exitCode !== 0) die(`\u274C ${label} FAILED on this repo:`, r);
      const summary = r.stdout.split("\n").find((l) => l.startsWith("Audit complete:")) ?? "(no summary line)";
      process.stdout.write(`\u2713 ${label} live: ${summary}
`);
    }
  }
}
function skillDriftSection() {
  if (existsSync2(resolve(REPO_ROOT, "scripts/check-skill-drift.sh"))) {
    const r = run("bash", ["scripts/check-skill-drift.sh"]);
    if (r.exitCode !== 0) die("\u274C skill drift check failed", r);
    emit(r);
  }
}
var RUN_ARMED = "scripts/run-armed.sh";
function armedProbeTimeoutMs(env = process.env) {
  const raw = env["PREPUSH_ARMED_PROBE_TIMEOUT_MS"]?.trim() ?? "";
  return /^[1-9]\d*$/.test(raw) ? Number(raw) : 6e5;
}
function mutationBudgetMs(env = process.env) {
  const raw = env["PREPUSH_MUTATION_TIMEOUT_MS"]?.trim() ?? "";
  return /^[1-9]\d*$/.test(raw) ? Number(raw) : 3e5;
}
function consumerGate(script) {
  return existsSync2(resolve(REPO_ROOT, RUN_ARMED)) ? run("bash", [RUN_ARMED, "bash", script]) : run("bash", [script]);
}
function recordGoverned(ctx, script, failMsg) {
  if (ctx.isFrameworkRepo || process.env["GETFF_SECTION_DIRECT"] === "1")
    return false;
  if (!existsSync2(resolve(REPO_ROOT, RUN_ARMED)) || !existsSync2(resolve(REPO_ROOT, script)))
    return false;
  const r = consumerGate(script);
  if (r.exitCode !== 0) die(failMsg, r);
  emit(r);
  return true;
}
function armedProbeSection() {
  if (!existsSync2(resolve(REPO_ROOT, RUN_ARMED))) return;
  const timeoutMs = armedProbeTimeoutMs();
  const r = runCheck("bash", [RUN_ARMED, "--probe"], { cwd: REPO_ROOT, timeoutMs });
  if (r.timedOut) {
    process.stdout.write(
      `\xB7 armed-probe: skipped \u2014 over ${timeoutMs / 1e3} s; the not-armed checks stay as they are (not blocking)
`
    );
    return;
  }
  if (r.exitCode !== 0)
    die("\u274C the project-checks record could not be read", r);
  emit(r);
}
function ruleGlobsSection() {
  if (existsSync2(resolve(REPO_ROOT, "scripts/check-rule-globs.sh"))) {
    const r = consumerGate("scripts/check-rule-globs.sh");
    if (r.exitCode !== 0) die("\u274C rule-glob liveness check failed", r);
    emit(r);
  }
}
function worktreeProvisioningSection() {
  const helper = resolve(REPO_ROOT, "scripts/worktree-node-modules.sh");
  if (!existsSync2(helper) || !statSync(resolve(REPO_ROOT, ".git")).isFile())
    return;
  if (run("bash", [helper, "--check", REPO_ROOT]).exitCode === 0) return;
  const applied = run("bash", [helper, "--apply", REPO_ROOT]);
  if (applied.exitCode !== 0) {
    die(
      "\u274C this worktree has no node_modules and cannot be provisioned automatically.\n   Run `npm install` in the primary checkout, then `bash scripts/worktree-doctor.sh --fix`.",
      applied
    );
  }
  process.stdout.write(
    "\u2713 worktree node_modules provisioned (symlinks were missing \u2014 healed before the test sections)\n"
  );
}
function lintStagedResolvesSection() {
  if (existsSync2(resolve(REPO_ROOT, "scripts/check-lintstaged-resolves.sh"))) {
    const r = consumerGate("scripts/check-lintstaged-resolves.sh");
    if (r.exitCode !== 0) die("\u274C lint-staged resolution check failed", r);
    emit(r);
  }
}
function validateSidecarShape(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return `not valid JSON \u2014 ${e.message}`;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return "top level must be an object keyed by ruleId";
  for (const [id, entry] of Object.entries(parsed)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry))
      return `entry "${id}" must be an object { bad: string[], good: string[] }`;
    const sample = entry;
    for (const k of Object.keys(sample))
      if (k !== "bad" && k !== "good")
        return `entry "${id}" has an unexpected key "${k}" (only "bad" and "good" are allowed)`;
    for (const f of ["bad", "good"]) {
      if (!(f in sample)) return `entry "${id}" is missing "${f}"`;
      const v = sample[f];
      if (!Array.isArray(v))
        return `entry "${id}" field "${f}" must be an array of code samples`;
      if (v.length === 0)
        return `entry "${id}" field "${f}" must be a non-empty array (${f === "bad" ? "no violating sample = nothing fires" : "no clean counter-sample = over-firing unproven"})`;
      for (const x of v)
        if (typeof x !== "string" || x.length === 0)
          return `entry "${id}" field "${f}" each sample must be a non-empty string`;
    }
  }
  return null;
}
function generatedRuleMaterialSection() {
  const resolveRunner = (name) => {
    const consumer = resolve(REPO_ROOT, `scripts/${name}`);
    if (existsSync2(consumer)) return consumer;
    const framework = resolve(REPO_ROOT, `packages/core/synthesizer/${name}`);
    return existsSync2(framework) ? framework : null;
  };
  const binResolvable = (bin) => existsSync2(resolve(REPO_ROOT, `node_modules/.bin/${bin}`)) || existsSync2(resolve(REPO_ROOT, `packages/node_modules/.bin/${bin}`));
  const toolPresent = (backend) => {
    if (backend === "astgrep")
      return !run("ast-grep", ["--version"]).notFound || !run("sg", ["--version"]).notFound;
    if (backend === "ruff")
      return !run("ruff", ["--version"]).notFound || !run("uvx", ["--version"]).notFound;
    return !run("cargo", ["--version"]).notFound;
  };
  const manifest = resolve(
    REPO_ROOT,
    ".ai-factory/synthesizer-output/rules-manifest-additions.json"
  );
  if (existsSync2(manifest)) {
    const runner = resolveRunner("run-generated-rule-mutation.sh");
    if (!runner) {
      process.stdout.write(
        "\u26A0 DEGRADED: generated-rules manifest present but run-generated-rule-mutation.sh not delivered \u2014 mutation check SKIPPED (a skipped check is NOT green).\n"
      );
    } else if (!binResolvable("tsx")) {
      process.stdout.write(
        "\u26A0 DEGRADED: tsx not resolvable \u2014 generated-rule mutation check SKIPPED (run npm install; a skipped check is NOT green).\n"
      );
    } else {
      const consumer = runner === resolve(REPO_ROOT, "scripts/run-generated-rule-mutation.sh");
      const timeoutMs = mutationBudgetMs();
      const r = consumer ? existsSync2(resolve(REPO_ROOT, RUN_ARMED)) ? runCheck("bash", [RUN_ARMED, "bash", "scripts/run-generated-rule-mutation.sh"], { cwd: REPO_ROOT, timeoutMs }) : runCheck("bash", ["scripts/run-generated-rule-mutation.sh"], { cwd: REPO_ROOT, timeoutMs }) : runCheck("bash", [runner, manifest], { cwd: REPO_ROOT, timeoutMs });
      if (consumer && r.timedOut) {
        die(
          `\u274C generated-rule mutation check ran over its budget (${timeoutMs / 1e3} s) \u2014 NOT green. Set PREPUSH_MUTATION_TIMEOUT_MS higher if the machine is slow; a check that did not finish did not pass`,
          r
        );
      } else if (r.notFound || r.timedOut || r.exitCode === 127) {
        process.stdout.write(
          `\u26A0 DEGRADED: generated-rule mutation runner did not execute (${r.timedOut ? "timed out" : "not runnable"}) \u2014 SKIPPED (a skipped check is NOT green).
`
        );
      } else if (r.exitCode === 2) {
        process.stdout.write(
          "\u26A0 DEGRADED: generated-rule mutation check exited 2 (it could not run; the reason follows) \u2014 SKIPPED (a skipped check is NOT green).\n"
        );
        emit(r);
      } else if (r.exitCode !== 0) {
        die(
          "\u274C generated-rule mutation check failed \u2014 npm negative-test material is selector-blind",
          r
        );
      } else {
        emit(r);
      }
    }
  }
  const firingRunner = resolveRunner("run-rule-tests-firing.sh");
  for (const backend of ["astgrep", "ruff", "cargo"]) {
    const sidecar = resolve(
      REPO_ROOT,
      `.ai-factory/rule-tests/${backend}.json`
    );
    if (!existsSync2(sidecar)) continue;
    const shapeError = validateSidecarShape(sidecar);
    if (shapeError !== null) {
      die(
        `\u274C ${backend} rule-test sidecar is not valid rule-test material \u2014 broken material (.ai-factory/rule-tests/${backend}.json)
   ${shapeError}`
      );
    }
    if (backend === "cargo" && process.env["GETFF_PREPUSH_CARGO_FIRE"] !== "1") {
      process.stdout.write(
        // Unified wording with the runner (run-rule-tests-firing.sh) so drift breaks a test.
        "\u26A0 cargo firing arm is opt-in (compile cost) \u2014 set GETFF_PREPUSH_CARGO_FIRE=1 to enable; a skipped check is NOT green.\n"
      );
      continue;
    }
    if (!firingRunner) {
      process.stdout.write(
        `\u26A0 DEGRADED: ${backend} sidecar present but run-rule-tests-firing.sh not delivered \u2014 firing SKIPPED (a skipped check is NOT green).
`
      );
      continue;
    }
    if (!toolPresent(backend)) {
      process.stdout.write(
        `\u26A0 DEGRADED: ${backend} lane tool not found \u2014 rule-test firing SKIPPED (a skipped check is NOT green).
`
      );
      continue;
    }
    const r = run("bash", [firingRunner, REPO_ROOT, backend]);
    if (r.notFound || r.timedOut || r.exitCode === 127) {
      process.stdout.write(
        `\u26A0 DEGRADED: ${backend} firing runner did not execute (${r.timedOut ? "timed out" : "not runnable"}) \u2014 SKIPPED (a skipped check is NOT green).
`
      );
      continue;
    }
    if (r.exitCode !== 0) {
      die(
        `\u274C ${backend} rule-test firing failed \u2014 broken sidecar material (a bad[] sample did not fire, or a good[] sample over-fired)`,
        r
      );
    }
    emit(r);
  }
}
function kickoffPortabilitySection() {
  if (existsSync2(
    resolve(
      REPO_ROOT,
      "packages/core/audit-self/check-kickoff-portability.sh"
    )
  )) {
    const r = run("bash", [
      "packages/core/audit-self/check-kickoff-portability.sh"
    ]);
    if (r.exitCode !== 0) die("\u274C kickoff-portability check failed", r);
    emit(r);
  }
}
function synthBundleSection() {
  if (existsSync2(resolve(REPO_ROOT, "scripts/build-synth-bundle.sh"))) {
    const r = run("bash", ["scripts/build-synth-bundle.sh", "--check"]);
    if (r.exitCode === 2) {
      process.stderr.write(
        "\u26A0\uFE0F  synth-bundle drift gate skipped \u2014 esbuild not installed (run: NODE_ENV=development npm install --include=dev)\n"
      );
    } else if (r.exitCode !== 0) {
      die(
        "\u274C synth-bundle drift detected \u2014 run: bash scripts/build-synth-bundle.sh",
        r
      );
    } else {
      emit(r);
      const bundlePath = resolve(
        REPO_ROOT,
        "packages/core/install/synth-and-wire.bundle.mjs"
      );
      if (existsSync2(bundlePath)) {
        const smoke = runCheck(
          "node",
          [
            bundlePath,
            "--stack",
            "react-next",
            "--path",
            "/tmp/no-eslint-config-smoke.mjs",
            "--dry-run"
          ],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              AIF_SYNTH_PKG_ROOT: resolve(REPO_ROOT, "packages/core")
            }
          }
        );
        if (smoke.exitCode !== 0) {
          die(
            "\u274C synth-bundle smoke test failed \u2014 bundle crashed (anchor break or runtime error)",
            smoke
          );
        }
        if (smoke.stdout.includes("emitted no rules")) {
          die(
            "\u274C synth-bundle smoke test: synthesis emitted no rules \u2014 anchor break still present",
            smoke
          );
        }
        emit(smoke);
      }
    }
  }
}
function runtimeBundlesSection() {
  if (!existsSync2(resolve(REPO_ROOT, "scripts/build-runtime-bundles.mjs")))
    return;
  const r = run("node", ["scripts/build-runtime-bundles.mjs", "--check"]);
  if (r.exitCode === 2) {
    process.stderr.write(
      "\u26A0\uFE0F  runtime-bundle drift gate skipped \u2014 esbuild not installed (run: NODE_ENV=development npm install --include=dev)\n"
    );
  } else if (r.exitCode !== 0) {
    die(
      "\u274C runtime-bundle drift detected \u2014 run: node scripts/build-runtime-bundles.mjs",
      r
    );
  } else {
    emit(r);
  }
}
function shippedRuleDriftSection(ctx) {
  if (!existsSync2(resolve(REPO_ROOT, "scripts/build-shipped-eslint-rules.sh")))
    return;
  if (ctx.rb.base !== null) {
    const touched = getChangedFiles(ctx.rb.base, "ACMRD", ctx.rb.head).some(
      (f) => f.includes("/eslint-rules/") || f === "scripts/build-shipped-eslint-rules.sh"
    );
    if (!touched) return;
  }
  const r = run("bash", ["scripts/build-shipped-eslint-rules.sh", "--check"]);
  if (r.exitCode === 2) {
    process.stderr.write(
      "\u26A0\uFE0F  shipped-rule drift gate skipped \u2014 tsc not installed (run: npm install at repo root)\n"
    );
  } else if (r.exitCode !== 0) {
    die(
      "\u274C shipped-rule drift/orphan detected \u2014 run: bash scripts/build-shipped-eslint-rules.sh (and delete orphaned .mjs/.d.ts)",
      r
    );
  } else {
    emit(r);
  }
}
function payloadChanges(base, head) {
  const out = runCheck("git", [
    "diff",
    "--name-status",
    `${base}..${head}`
  ]).stdout;
  const entries = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const cols = line.split("	");
    const code = cols[0] ?? "";
    if (code.startsWith("R") || code.startsWith("C")) {
      if (cols[1]) entries.push({ status: "D", path: cols[1] });
      if (cols[2]) entries.push({ status: "A", path: cols[2] });
    } else if (cols[1]) {
      const status = code.startsWith("D") ? "D" : code.startsWith("A") ? "A" : "M";
      entries.push({ status, path: cols[1] });
    }
  }
  return entries;
}
function sha256Bytes(buf) {
  return createHash("sha256").update(buf).digest("hex");
}
function payloadDriftSection(ctx) {
  const manifestPath = resolve(REPO_ROOT, "packages/getff/MANIFEST.sha256");
  const baselineDir = resolve(REPO_ROOT, "tests/install-sh/baselines");
  const lister = resolve(REPO_ROOT, "scripts/build-getff-dist.sh");
  const hasManifest = existsSync2(manifestPath) && existsSync2(lister);
  const hasBaselines = existsSync2(baselineDir);
  if (!hasManifest && !hasBaselines) return;
  if (ctx.rb.base === null) {
    if (hasManifest) {
      const r = run("bash", ["scripts/build-getff-dist.sh", "--check"]);
      if (r.exitCode !== 0)
        die(
          "\u274C getff-dist payload drift \u2014 run: bash scripts/build-getff-dist.sh",
          r
        );
      emit(r);
    }
    return;
  }
  const changes = payloadChanges(ctx.rb.base, ctx.rb.head);
  const problems = [];
  let judged = 0;
  if (hasManifest) {
    const listed = run("bash", [
      "scripts/build-getff-dist.sh",
      "--list-payload"
    ]);
    const roots = listed.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
    const inPayload = (p) => roots.some((root) => p === root || p.startsWith(`${root}/`));
    const manifest = /* @__PURE__ */ new Map();
    for (const line of readFileSync(manifestPath, "utf8").split("\n")) {
      const m = /^([0-9a-f]{64})\s\s?(.+)$/.exec(line.trim());
      if (m?.[1] && m[2]) manifest.set(m[2], m[1]);
    }
    for (const { status, path } of changes) {
      if (!inPayload(path)) continue;
      judged += 1;
      const recorded = manifest.get(path);
      if (status === "D") {
        if (recorded !== void 0)
          problems.push(`  ${path} \u2014 deleted, still listed in MANIFEST.sha256`);
        continue;
      }
      if (recorded === void 0) {
        problems.push(`  ${path} \u2014 shipped, missing from MANIFEST.sha256`);
        continue;
      }
      const abs = resolve(REPO_ROOT, path);
      if (!existsSync2(abs)) continue;
      if (sha256Bytes(readFileSync(abs)) !== recorded)
        problems.push(
          `  ${path} \u2014 content differs from its MANIFEST.sha256 row`
        );
    }
    if (problems.length)
      die(
        "\u274C getff-dist payload drift \u2014 packages/getff/MANIFEST.sha256 does not describe this push:\n" + problems.join("\n") + "\n       Re-run: bash scripts/build-getff-dist.sh"
      );
  }
  let fingerprints = 0;
  if (hasBaselines) {
    const recorded = /* @__PURE__ */ new Set();
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const abs = `${dir}/${name}`;
        if (statSync(abs).isDirectory()) {
          walk(abs);
          continue;
        }
        if (!name.endsWith(".fingerprint")) continue;
        fingerprints += 1;
        for (const line of readFileSync(abs, "utf8").split("\n")) {
          const m = /^([0-9a-f]{64})\s/.exec(line.trim());
          if (m?.[1]) recorded.add(m[1]);
        }
      }
    };
    walk(baselineDir);
    const stale = [];
    for (const { status, path } of changes) {
      if (status === "A") continue;
      const show = spawnSync2("git", ["show", `${ctx.rb.base}:${path}`], {
        maxBuffer: 64 * 1024 * 1024
      });
      if (show.status !== 0 || !show.stdout) continue;
      if (recorded.has(sha256Bytes(show.stdout))) stale.push(`  ${path}`);
    }
    if (stale.length)
      die(
        "\u274C stale install baselines \u2014 these changed files are still recorded in\n   tests/install-sh/baselines by the bytes this push replaced:\n" + stale.join("\n") + "\n       Re-run: SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh"
      );
  }
  process.stdout.write(
    `\u2713 payload drift: ${judged} changed payload file(s) match MANIFEST.sha256; ${fingerprints} install fingerprint(s) current
`
  );
}
function manifestRenderSection() {
  if (existsSync2(resolve(REPO_ROOT, "packages/core/render/render-rules.ts"))) {
    const r = run("npx", [
      "tsx",
      "packages/core/render/render-rules.ts",
      "--check"
    ]);
    if (r.notFound) {
      die(
        "\u274C npx not found. Install Node.js to enable manifest render drift check."
      );
    }
    if (r.exitCode !== 0) die("\u274C manifest render drift detected:", r);
    emit(r);
  }
}
function ruleIndexRenderSection() {
  if (existsSync2(resolve(REPO_ROOT, "scripts/render-rule-index.mjs"))) {
    const r = run("npx", ["tsx", "scripts/render-rule-index.mjs", "--check"]);
    if (r.notFound) {
      die(
        "\u274C npx/tsx not found. Install Node.js + tsx to enable rule-index drift check."
      );
    }
    if (r.exitCode !== 0) die("\u274C rule-index drift detected:", r);
    emit(r);
  }
}
function referenceRenderSection() {
  if (existsSync2(resolve(REPO_ROOT, "scripts/render-reference.mjs"))) {
    const r = run("npx", ["tsx", "scripts/render-reference.mjs", "--check"]);
    if (r.notFound) {
      die(
        "\u274C npx/tsx not found. Install Node.js + tsx to enable reference drift check."
      );
    }
    if (r.exitCode !== 0) die("\u274C reference render drift detected:", r);
    emit(r);
  }
}
function faceFactsRenderSection() {
  if (existsSync2(resolve(REPO_ROOT, "scripts/render-face-facts.mjs"))) {
    const r = run("npx", ["tsx", "scripts/render-face-facts.mjs", "--check"]);
    if (r.notFound) {
      die(
        "\u274C npx/tsx not found. Install Node.js + tsx to enable face-facts drift check."
      );
    }
    if (r.exitCode !== 0) die("\u274C face-facts render drift detected:", r);
    emit(r);
  }
}
function docsRefreshSection(c) {
  if (existsSync2(resolve(REPO_ROOT, "scripts/check-docs-refresh.mjs"))) {
    if (c.rb.base === null) {
      warnSkip(
        "docs-refresh",
        "no PREPUSH_UPSTREAM_REF, no git stdin, no default branch"
      );
      return;
    }
    if (c.rb.head === Z40) {
      warnSkip("docs-refresh", "branch deletion push \u2014 no head commit to gate");
      return;
    }
    const trunk = resolveDefaultBase();
    const mb = trunk ? run("git", ["merge-base", trunk, c.rb.head]) : null;
    const base = mb && mb.exitCode === 0 && mb.stdout.trim() ? mb.stdout.trim() : c.rb.base;
    const r = run("node", [
      "scripts/check-docs-refresh.mjs",
      `${base}..${c.rb.head}`
    ]);
    if (r.notFound) {
      die(
        "\u274C node not found. Install Node.js to enable the docs refresh gate."
      );
    }
    if (r.exitCode === 2) {
      die("\u274C docs refresh gate could not run:", r);
    }
    if (r.exitCode !== 0) die("\u274C docs refresh gate failed:", r);
    emit(r);
  }
}
function lineCitationsSection(ctx) {
  const { rb } = ctx;
  if (rb.base === null) {
    warnSkip("\xA79", "no resolvable base for the path:line citation check");
    return;
  }
  if (!existsSync2(resolve(REPO_ROOT, "scripts/check-line-citations.mjs")))
    return;
  const changed = getChangedFiles(rb.base, "ACMR", rb.head);
  if (changed.length === 0) return;
  const timeoutMs = lineCitationsTimeoutMs();
  const r = runCheck(
    "node",
    [
      "scripts/check-line-citations.mjs",
      "--check",
      "--corpus",
      ...changed.map((f) => `--affected-by=${f}`)
    ],
    { cwd: REPO_ROOT, timeoutMs }
  );
  if (r.notFound) return;
  if (r.timedOut) {
    die(
      // runCheck also reports an outside SIGTERM as timedOut, hence «or was terminated».
      `\u274C path:line citation checker did not finish within ${timeoutMs / 1e3} s (timed out or was terminated) \u2014 no citation was found stale.
   Usually machine load (the checker is ~1.5 s of CPU; the rest is waiting on
   git blame/show per affected citation). Retry when load drops, or raise
   PREPUSH_LINE_CITATIONS_TIMEOUT_MS (milliseconds) for this push.`
    );
  }
  if (r.exitCode !== 0) die("\u274C stale `path:line` citation(s):", r);
  emit(r);
}
var LINE_CITATIONS_TIMEOUT_MS = 6e5;
function lineCitationsTimeoutMs(env = process.env) {
  const raw = env["PREPUSH_LINE_CITATIONS_TIMEOUT_MS"]?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(raw)) return LINE_CITATIONS_TIMEOUT_MS;
  return Number(raw);
}
var HEAVY_RUNNER_TIMEOUT_MS = 6e5;
function runCoreSuite(script) {
  const runner = process.env["PREPUSH_HEAVY_RUNNER"]?.trim();
  if (!runner) return run("npm", ["--prefix", CORE, "run", script]);
  const r = runCheck(runner, ["npm", "run", script], {
    cwd: CORE,
    timeoutMs: HEAVY_RUNNER_TIMEOUT_MS
  });
  if (r.notFound || /^spawnSync .* E[A-Z]+$/m.test(r.stderr)) {
    die(
      `\u274C PREPUSH_HEAVY_RUNNER='${runner}' could not be started (${r.stderr.trim()}).
   Fix the path, or unset PREPUSH_HEAVY_RUNNER to run the suite here.`
    );
  }
  if (r.timedOut) {
    die(
      `\u274C PREPUSH_HEAVY_RUNNER='${runner}' did not finish \`npm run ${script}\` within ${HEAVY_RUNNER_TIMEOUT_MS / 6e4} min.
   Unset PREPUSH_HEAVY_RUNNER to run the suite here.`
    );
  }
  return r;
}
function principlesMetaSection() {
  if (existsSync2(resolve(CORE, "package.json"))) {
    const r = runCoreSuite("test:principles");
    if (r.notFound) {
      die(
        "\u274C npm/npx not found. Install Node.js to enable principles meta-tests."
      );
    }
    if (r.exitCode !== 0)
      die("\u274C principles meta-tests failed \u2014 fix before push", r);
    emit(r);
  }
}
function alwaysonBudgetSection() {
  const r = run("bash", ["scripts/check-alwayson-budget.sh"]);
  if (r.notFound) {
    die(
      "\u274C bash not found to run scripts/check-alwayson-budget.sh (arch-v2 S-E P3a always-on budget gate)."
    );
  }
  if (r.exitCode !== 0) {
    die(
      "\u274C always-on budget gate RED \u2014 fix the resident set, OR escape with\n   AIF_ALWAYSON_BUDGET_ALLOW='<rationale \u226520 chars>'\n   (rationale must name why this push is exempt).",
      r
    );
  }
  emit(r);
}
function askFileSchemaSection() {
  if (!existsSync2(resolve(REPO_ROOT, "scripts/check-ask-files.sh"))) return;
  const r = run("bash", ["scripts/check-ask-files.sh"]);
  if (r.notFound) {
    die(
      "\u274C bash not found to run scripts/check-ask-files.sh (ask-file schema gate)."
    );
  }
  if (r.exitCode !== 0) {
    die(
      "\u274C ask-file schema gate RED \u2014 fix the ask file(s) named above.\n   Schema reference: the header of scripts/check-ask-files.sh.",
      r
    );
  }
  emit(r);
}
function irMetaSection() {
  if (existsSync2(resolve(CORE, "package.json"))) {
    const r = runCoreSuite("test:ir");
    if (r.notFound) {
      die("\u274C npm/npx not found. Install Node.js to enable IR meta-tests.");
    }
    if (r.exitCode !== 0)
      die("\u274C IR grammar-gate tests failed \u2014 fix before push", r);
    emit(r);
  }
}
function backendsMetaSection() {
  if (existsSync2(resolve(CORE, "package.json"))) {
    const r = runCoreSuite("test:backends");
    if (r.notFound) {
      die(
        "\u274C npm/npx not found. Install Node.js to enable backend meta-tests."
      );
    }
    if (r.exitCode !== 0) die("\u274C backend tests failed \u2014 fix before push", r);
    emit(r);
  }
}
function compositionMetaSection() {
  if (existsSync2(resolve(CORE, "package.json"))) {
    const r = runCoreSuite("test:composition");
    if (r.notFound) {
      die(
        "\u274C npm/npx not found. Install Node.js to enable composition meta-tests."
      );
    }
    if (r.exitCode !== 0)
      die("\u274C composition tests failed \u2014 fix before push", r);
    emit(r);
  }
}
function specDisciplineSection(ctx) {
  const { rb } = ctx;
  if (rb.base !== null) {
    const specFiles = getChangedFiles(rb.base, "ACM", rb.head).filter(
      (f) => /^\.claude\/orchestrator-prompts\/.*\.md$/.test(f)
    );
    if (specFiles.length > 0 && existsSync2(
      resolve(
        REPO_ROOT,
        "packages/core/spec-validation/validate-batch-spec.ts"
      )
    )) {
      process.stdout.write(
        "Validating force-added orchestrator-prompts in this push...\n"
      );
      const r = run("npx", [
        "tsx",
        "packages/core/spec-validation/validate-batch-spec.ts",
        ...specFiles
      ]);
      if (r.exitCode !== 0)
        die("\u274C spec-validate findings \u2014 fix before push", r);
      emit(r);
    }
  } else {
    warnSkip("\xA76", "no resolvable base for the spec-discipline diff");
  }
}
async function guardLivenessEntry(ctx) {
  if (existsSync2(resolve(REPO_ROOT, "packages/core/manifest/rules-manifest.json"))) {
    await guardLivenessSection(ctx.rb);
  }
}
async function cmdScriptLivenessEntry(ctx) {
  if (existsSync2(resolve(REPO_ROOT, "packages/core/manifest/rules-manifest.json"))) {
    await cmdScriptLivenessSection(ctx.rb);
  }
}
var SHIPPED_MD_DESTINATIONS = [
  "AGENTS.md",
  // 30-templates.sh:112 / 45-python.sh:1639 (install_agents_md)
  ".ai-factory/AI-USAGE-GUIDE.md",
  ".ai-factory/ARCHITECTURE.md",
  ".ai-factory/ARCHITECTURE.python.md",
  // 45-python.sh:1654 (ledger A2-10)
  ".ai-factory/ARCHITECTURE.react-native.md",
  ".ai-factory/ARCHITECTURE.react-next.md",
  ".ai-factory/ARCHITECTURE.react-spa.md",
  ".ai-factory/ARCHITECTURE.ts-server.md",
  ".ai-factory/DESCRIPTION.md",
  ".ai-factory/DESCRIPTION.template.md",
  ".ai-factory/RULES.md",
  ".ai-factory/RULES.react-native.md",
  ".ai-factory/RULES.react-next.md",
  ".ai-factory/RULES.react-spa.md",
  ".ai-factory/rules/integration-rules.md",
  ".ai-factory/tier-home.md",
  ".ai-factory/tool-decisions.md",
  ".claude/session-bootstrap.md"
  // 10-skills.sh:388 / install.sh --refresh (conditional starter)
];
var SHIPPED_MD_PREFIXES = [
  ".ai-factory/skill-context/"
];
var SHIPPED_SKILL_SLUGS = [
  "ai-doc",
  "aif-doctor",
  "arch",
  "claude-glm-executor-handoff",
  "dispatcher",
  "getff",
  "harvest",
  "night-mode",
  "orchestrator",
  "pipeline",
  "reviewer",
  "rule-research",
  "rule-tests",
  "story",
  "template-audit",
  "tool-bootstrapping"
];
function refreshBaselinePaths() {
  const manifest = resolve(REPO_ROOT, ".ai-factory/refresh-baseline.json");
  if (!existsSync2(manifest)) return null;
  try {
    const parsed = JSON.parse(readFileSync(manifest, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return null;
    return new Set(Object.keys(parsed));
  } catch {
    return null;
  }
}
function isFrameworkShippedMarkdown(p, baseline) {
  if (SHIPPED_MD_DESTINATIONS.includes(p)) return true;
  if (SHIPPED_MD_PREFIXES.some((x) => p.startsWith(x))) return true;
  if (SHIPPED_SKILL_SLUGS.some((slug) => p.startsWith(`.claude/skills/${slug}/`)))
    return true;
  if (baseline !== null) return baseline.has(p);
  return p.startsWith(".claude/agents/");
}
var PLUGIN_AGENT_TWIN_PREFIX = "plugin/agents/";
function lycheeSection(ctx) {
  if (!run("lychee", ["--version"]).notFound && recordGoverned(
    ctx,
    "scripts/check-doc-links.sh",
    "\u274C lychee found broken links in this project's Markdown \u2014 fix before push"
  ))
    return;
  const { rb } = ctx;
  if (rb.base !== null) {
    let changedMd = getChangedFiles(rb.base, "ACMR", rb.head).filter(
      (f) => f.endsWith(".md")
    );
    {
      const before = changedMd.length;
      changedMd = changedMd.filter(
        (f) => !f.startsWith(PLUGIN_AGENT_TWIN_PREFIX)
      );
      const excluded = before - changedMd.length;
      if (excluded > 0) {
        process.stdout.write(
          `  \xB7 \xA78 lychee: excluded ${excluded} plugin/agents twin(s) \u2014 byte-identical copies, link-checked at their agents/ source
`
        );
      }
    }
    if (!ctx.isFrameworkRepo) {
      const baseline = refreshBaselinePaths();
      const before = changedMd.length;
      changedMd = changedMd.filter(
        (f) => !isFrameworkShippedMarkdown(f, baseline)
      );
      const excluded = before - changedMd.length;
      if (excluded > 0) {
        process.stdout.write(
          `  \xB7 \xA78 lychee: excluded ${excluded} framework-shipped *.md (S2 Part 1 narrowing; consumer-authored only)
`
        );
      }
      if (baseline === null && before > 0) {
        process.stdout.write(
          "  \xB7 \xA78 lychee: .ai-factory/refresh-baseline.json absent or unreadable \u2014 .claude/agents/*.md excluded wholesale (re-run the installer to record the delivery set and get consumer-authored agents checked)\n"
        );
      }
    }
    if (changedMd.length > 0) {
      const r = run("lychee", [
        "--offline",
        "--no-progress",
        "--root-dir",
        REPO_ROOT,
        ...changedMd
      ]);
      if (r.notFound) {
        process.stdout.write(
          "\u26A0 lychee not found in PATH \u2014 offline link check skipped.\n"
        );
        process.stdout.write(
          "  Install: cargo install lychee   OR   brew install lychee\n"
        );
      } else {
        emit(r);
        if (r.exitCode !== 0) {
          die(
            "\u274C lychee found broken links in changed Markdown files \u2014 fix before push",
            r
          );
        }
      }
    }
  } else {
    warnSkip("\xA78", "no resolvable base for the changed-Markdown link check");
  }
}
function invariantsRenderSection() {
  if (existsSync2(resolve(REPO_ROOT, "scripts/render-invariants.mjs"))) {
    const r = run("node", ["scripts/render-invariants.mjs", "--check"]);
    if (r.notFound) {
      die(
        "\u274C node not found. Install Node.js to enable the invariants-line drift check."
      );
    }
    if (r.exitCode === 1) die("\u274C invariants-line drift detected:", r);
    if (r.exitCode !== 0)
      die(
        "\u274C invariants-line render failed (README invariants block or hook markers unparseable):",
        r
      );
    emit(r);
  }
}
async function harnessConfigLocalSection() {
  const { checkLocalHarnessConfig: checkLocalHarnessConfig2 } = await Promise.resolve().then(() => (init_harness_config_local(), harness_config_local_exports));
  const v = checkLocalHarnessConfig2(
    REPO_ROOT,
    (root, args) => runCheck(process.execPath, args, { cwd: root })
  );
  if (v.kind === "skip") {
    if (v.note) process.stdout.write(`\u24D8 harness-config-local: ${v.note}
`);
    return;
  }
  if (v.kind === "partial") {
    die(
      "\u274C .zcode/skills exists but .zcode/config.json does not \u2014 a half-rendered zcode shim the renderer would skip entirely.\n   Fix: node scripts/render-harness-config.mjs --write"
    );
  }
  if (v.kind === "error") {
    die(
      "\u274C render-harness-config --check could not run (timed out or node not found) \u2014 this is not a drift verdict.",
      v.result
    );
  }
  if (v.kind === "drift") {
    die(
      "\u274C local harness config drifted from .ai-factory/harness-model.json (the renderer lists the files below).\n   Fix: node scripts/render-harness-config.mjs --write",
      v.result
    );
  }
  process.stdout.write(
    "\u2713 local harness config (.zcode/ shim) matches the model\n"
  );
}
var SECTIONS = [
  // FIRST by design: must land the symlinks before any section shells out to vitest, which
  // would otherwise plant node_modules/.vite and freeze this worktree out of provisioning
  // permanently (incident 2026-07-23). composeSections() filters, preserving this order.
  {
    id: "worktree-provisioning",
    owner: "maintainer",
    run: () => worktreeProvisioningSection()
  },
  { id: "actionlint", owner: "maintainer", run: () => actionlintSection() },
  { id: "zizmor-live", owner: "maintainer", run: () => zizmorLiveSection() },
  {
    id: "zizmor-templates",
    owner: "maintainer",
    run: () => zizmorTemplatesSection()
  },
  { id: "audit-ai-docs", owner: "maintainer", run: () => auditAiDocsSection() },
  {
    id: "line-citations",
    owner: "maintainer",
    run: (c) => lineCitationsSection(c)
  },
  { id: "skill-drift", owner: "maintainer", run: () => skillDriftSection() },
  { id: "armed-probe", owner: "consumer", run: () => armedProbeSection() },
  { id: "rule-globs", owner: "consumer", run: () => ruleGlobsSection() },
  {
    id: "lint-staged-resolves",
    owner: "consumer",
    run: () => lintStagedResolvesSection()
  },
  {
    id: "generated-rule-material",
    owner: "consumer",
    run: () => generatedRuleMaterialSection()
  },
  {
    id: "kickoff-portability",
    owner: "maintainer",
    run: () => kickoffPortabilitySection()
  },
  { id: "synth-bundle", owner: "maintainer", run: () => synthBundleSection() },
  {
    id: "runtime-bundles",
    owner: "maintainer",
    run: () => runtimeBundlesSection()
  },
  {
    id: "shipped-rule-drift",
    owner: "maintainer",
    run: (c) => shippedRuleDriftSection(c)
  },
  {
    id: "payload-drift",
    owner: "maintainer",
    run: (c) => payloadDriftSection(c)
  },
  {
    id: "manifest-render",
    owner: "maintainer",
    run: () => manifestRenderSection()
  },
  {
    id: "rule-index-render",
    owner: "maintainer",
    run: () => ruleIndexRenderSection()
  },
  {
    id: "invariants-render",
    owner: "maintainer",
    run: () => invariantsRenderSection()
  },
  {
    id: "reference-render",
    owner: "maintainer",
    run: () => referenceRenderSection()
  },
  {
    id: "face-facts-render",
    owner: "maintainer",
    run: () => faceFactsRenderSection()
  },
  {
    id: "harness-config-local",
    owner: "maintainer",
    run: () => harnessConfigLocalSection()
  },
  {
    id: "docs-refresh",
    owner: "maintainer",
    run: (c) => docsRefreshSection(c)
  },
  {
    id: "principles-meta",
    owner: "maintainer",
    run: () => principlesMetaSection()
  },
  { id: "ir-meta", owner: "maintainer", run: () => irMetaSection() },
  {
    id: "backends-meta",
    owner: "maintainer",
    run: () => backendsMetaSection()
  },
  {
    id: "composition-meta",
    owner: "maintainer",
    run: () => compositionMetaSection()
  },
  {
    id: "spec-discipline",
    owner: "maintainer",
    run: (c) => specDisciplineSection(c)
  },
  { id: "prior-art", owner: "maintainer", run: (c) => priorArtSection(c.rb) },
  { id: "s17", owner: "maintainer", run: (c) => s17Section(c.rb) },
  { id: "docs-card", owner: "maintainer", run: (c) => docsCardSection(c.rb) },
  {
    id: "guard-liveness",
    owner: "maintainer",
    run: (c) => guardLivenessEntry(c)
  },
  {
    id: "cmd-script-liveness",
    owner: "maintainer",
    run: (c) => cmdScriptLivenessEntry(c)
  },
  { id: "lychee", owner: "both", run: (c) => lycheeSection(c) },
  {
    // owner: 'both' — the WORKFLOW population (ci-tool-pinning.md §2 pop 1) is
    // "scanned on every push, framework and consumer repos alike"; the SHELL-SCRIPT
    // population (pop 2) is framework-only, gated inside the section body by
    // ctx.isFrameworkRepo. See the section docstring + owner-semantics block above.
    id: "unpinned-tool-install",
    owner: "both",
    run: (c) => unpinnedToolInstallSection(c)
  },
  {
    // arch-v2 S-E P3a: standing drift-guard on the always-on resident set size.
    // maintainer-only — ceiling is framework-derived; consumer layout has its own
    // CLAUDE.md. See alwaysonBudgetSection docstring + scripts/check-alwayson-budget.sh.
    id: "alwayson-budget",
    owner: "maintainer",
    run: () => alwaysonBudgetSection()
  },
  {
    // advisor-pattern §8 item 6: ask-file schema + the answered⇒decisions-entry
    // cross-check. maintainer-only — the mailbox is this repo's coordination store;
    // a consumer layout has no advisor seat and no scripts/ directory to run.
    id: "ask-file-schema",
    owner: "maintainer",
    run: () => askFileSchemaSection()
  }
];
function composeSections(sections, isFrameworkRepo) {
  const wanted = isFrameworkRepo ? "maintainer" : "consumer";
  return sections.filter((s) => {
    if (!s.owner || !VALID_OWNERS.includes(s.owner)) {
      throw new Error(
        `pre-push section '${s.id}' has no valid owner tag (got ${JSON.stringify(
          s.owner
        )}) \u2014 refusing to compose (fail-closed). Tag it consumer|maintainer|both.`
      );
    }
    return s.owner === "both" || s.owner === wanted;
  });
}
function activeSections(isFrameworkRepo) {
  return composeSections(SECTIONS, isFrameworkRepo);
}
async function main() {
  const rb = resolveBase();
  const isFrameworkRepo = existsSync2(resolve(REPO_ROOT, SSOT_REL));
  const ctx = { rb, isFrameworkRepo };
  const only = process.env["PREPUSH_ONLY"];
  if (only !== void 0 && only !== "") {
    const section = SECTIONS.find((s) => s.id === only);
    if (!section) {
      die(
        `\u274C PREPUSH_ONLY='${only}' matches no pre-push section id.
   Known ids: ${SECTIONS.map((s) => s.id).join(", ")}`
      );
    }
    await section.run(ctx);
    process.exit(0);
  }
  for (const section of activeSections(isFrameworkRepo)) {
    await section.run(ctx);
  }
  process.exit(0);
}
function isDirectCliInvocation() {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
if (isDirectCliInvocation()) {
  main().catch((err) => {
    process.stderr.write(
      `\u274C pre-push hook crashed: ${err.message}
`
    );
    process.exit(1);
  });
}
export {
  SECTIONS,
  SHIPPED_MD_DESTINATIONS,
  SHIPPED_MD_PREFIXES,
  SHIPPED_SKILL_SLUGS,
  VALID_OWNERS,
  activeSections,
  composeSections,
  isFrameworkShippedMarkdown,
  lineCitationsTimeoutMs
};
