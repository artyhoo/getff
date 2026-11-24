#!/usr/bin/env node
/**
 * mermaid-allowlist — THE canonical mermaid fence validator (getff-ai-site R6/R19).
 *
 * One module, two consumers:
 *   1. framework — `scripts/docs-check.mjs` (the R19 renderability assertion, pages profile)
 *   2. landing   — the pre-render allow-list in front of `renderMermaidSVG`
 *                  (docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md R6)
 *
 * Both repos import THIS file (the landing repo consumes it through the pin sync), so the
 * two enforcement surfaces cannot diverge: a fence the landing build rejects is a fence the
 * framework gate already rejects, and vice versa. Widening the accepted syntax is an edit to
 * THIS module and lands in both consumers at once — never a local override in either repo.
 *
 * WHY AN ALLOW-LIST (not just header checking): the renderer's throw is a HEADER check only.
 * Measured upstream evidence:
 *   - beautiful-mermaid 1.1.3 type detection is a first-line regex (`xychart(-beta)?`,
 *     `sequencediagram`, `classdiagram`, `erdiagram`, everything else -> flowchart), and its
 *     renderer silently DROPS constructs it does not know: a `click` directive, an unsupported
 *     shape, a `par/and` block, or an outright garbage line all render as if absent (R6, amended
 *     cold round 1 BU-3 — content loss inside a supported type is silent and byte-identical).
 *   - mermaid-js itself, on a parse failure, substitutes a "Syntax error in text" error SVG
 *     instead of failing (mermaidAPI.ts renderDiagram) — renderers degrade, they do not fail.
 * A dropped edge is invisible in a screenshot and passes every downstream gate; so the
 * validator below is deny-by-default: every statement must match an allow-listed shape for
 * its diagram type, and anything else is an error naming the construct.
 *
 * Supported set = the renderer's six types: flowchart, state, sequence, class, ER, XY.
 * The accepted statement grammar per type is deliberately narrow (see GRAMMARS): it covers the
 * shapes measured in this repo's pages plus the renderer's documented core, and nothing else.
 *
 * Plain ESM, Node built-ins only, zero dependencies — the landing repo must be able to
 * consume this file without pulling the framework's node_modules.
 */

/** The six supported diagram types: canonical header keyword -> renderer id. */
export const SUPPORTED_TYPES = [
  {
    id: 'flowchart',
    label: 'flowchart',
    header: /^flowchart(?:\s+(?:lr|tb|rl|bt))?$/i,
  },
  { id: 'sequence', label: 'sequenceDiagram', header: /^sequencediagram$/i },
  { id: 'class', label: 'classDiagram', header: /^classdiagram$/i },
  { id: 'er', label: 'erDiagram', header: /^erdiagram$/i },
  { id: 'state', label: 'stateDiagram-v2', header: /^statediagram-v2$/i },
  { id: 'xychart', label: 'xychart-beta', header: /^xychart(?:-beta)?$/i },
];

/**
 * Constructs the renderer silently drops (the R6 measured loss class), named so the error
 * can say WHY a construct is rejected instead of a bare "not allowed".
 */
const SILENT_LOSS = [
  {
    re: /\bclick\b/,
    why: '`click` directives are silently dropped by the renderer (R6 BU-3)',
  },
  {
    re: /\bstyle\s+\S/,
    why: '`style` lines are silently dropped; use `classDef` + `class` (flowchart)',
  },
  {
    re: /\blinkStyle\b/,
    why: '`linkStyle` lines are silently dropped (R6 BU-3)',
  },
  {
    re: /\bsubgraph\b/,
    why: '`subgraph` blocks are outside the allow-list (silent-loss family)',
  },
  { re: /\bcall\s/, why: '`call` statements are silently dropped (R6 BU-3)' },
  {
    re: /\bnote\s+(?:over|left of|right of)\b/i,
    why: '`note` blocks are outside the allow-list (silent-loss family)',
  },
  {
    re: /^\s*(?:loop|alt|else|opt|par|and|or|critical|break|rect|box)\b/i,
    why: 'control blocks (loop/alt/par/rect/box/…) are outside the allow-list (R6: `par/and` blocks render as if absent)',
  },
  {
    re: /\b(?:activate|deactivate|autonumber)\b/,
    why: 'activation/autonumber statements are outside the allow-list (unmeasured against the renderer)',
  },
  {
    re: /\baccTitle\b|\baccDescr\b/,
    why: 'accessibility statements are outside the allow-list (unmeasured against the renderer)',
  },
];

// ── per-type statement grammars ────────────────────────────────────────────────────────────────
// Every statement (a line, or a `;`-separated chunk of one — the renderer splits on both) must
// match exactly one regex for its type, after `%%` comment chunks are removed.

const NODE_SHAPE = String.raw`(?:\[[^\]]*\]|\[[^[\]]*\([^[\]]*\)[^[\]]*\]|\([^)]*\)|\{[^}]*\}|\[\([^)]*\)\]|\{\{[^}]*\}\})`;
const NODE = String.raw`[A-Za-z0-9_]+\s*${NODE_SHAPE}?`;
const EDGE = String.raw`(?:(?:-->|---|===|-\.->)(?:\s*\|\s*[^|]*\|)?)`;
const LABELED_EDGE = String.raw`(?:--\s+[^;]*?\s*-->|==\s+[^;]*?\s*==>|-\.\s+[^;]*?\s*\.->)`;

const GRAMMARS = {
  flowchart: [
    {
      re: new RegExp(String.raw`^flowchart(?:\s+(?:lr|tb|rl|bt))?$`, 'i'),
      header: true,
    },
    { re: new RegExp(String.raw`^classDef\s+[A-Za-z0-9_]+\s+[^;]*$`) },
    { re: new RegExp(String.raw`^class\s+[A-Za-z0-9_,\s]+?\s+[A-Za-z0-9_]+$`) },
    {
      re: new RegExp(
        String.raw`^${NODE}(?:\s*(?:${EDGE}|${LABELED_EDGE})\s*${NODE})*$`,
      ),
    },
  ],
  sequence: [
    { re: /^sequencediagram$/i, header: true },
    { re: /^participant\s+[A-Za-z0-9_]+(?:\s+as\s+.+)?$/ },
    {
      re: new RegExp(
        String.raw`^[A-Za-z0-9_]+\s*(?:->>|-->>|->|--|-x|--x)\s*[A-Za-z0-9_]+\s*:\s*\S.*$`,
      ),
    },
  ],
  class: [
    { re: /^classdiagram$/i, header: true },
    { re: /^class\s+[A-Za-z0-9_]+(?:\s*\{)?$/ },
    { re: /^\}$/ },
    {
      re: new RegExp(
        String.raw`^[A-Za-z0-9_]+\s*(?:<\|--|--\|>|\.\.\|>|--\|>|\.\.\>|\*--|--\*|o--|--o|\*o--|o\*--|--|\.\.)\s*[A-Za-z0-9_]+\s*(?::\s*\S.*)?$`,
      ),
    },
    { re: new RegExp(String.raw`^[A-Za-z0-9_]+\s*:\s*\S.*$`) },
  ],
  er: [
    { re: /^erdiagram$/i, header: true },
    { re: new RegExp(String.raw`^[A-Za-z0-9_]+\s*\{$`) },
    { re: /^\}$/ },
    // attribute line: <type> <name> [PK|FK|UK] ["comment"]
    {
      re: new RegExp(
        String.raw`^[A-Za-z0-9_]+\s+[A-Za-z0-9_]+(?:\s+(?:PK|FK|UK))?(?:\s+"[^"]*")?$`,
      ),
    },
    // relationship line: ENTITY <left-crow> (--|..) <right-crow> ENTITY [: label]
    {
      re: new RegExp(
        String.raw`^[A-Za-z0-9_]+\s+(?:\|o|\|\||\}o|\}\|)(?:--|\.\.)(?:o\||o\{|\|\||\|\{)\s+[A-Za-z0-9_]+\s*(?::\s*\S.*)?$`,
      ),
    },
  ],
  state: [
    { re: /^statediagram-v2$/i, header: true },
    {
      re: new RegExp(
        String.raw`^(?:\[\*\]|[A-Za-z0-9_]+)\s*-->\s*(?:\[\*\]|[A-Za-z0-9_]+)(?:\s*:\s*\S.*)?$`,
      ),
    },
    { re: /^state\s+"[^"]*"\s+as\s+[A-Za-z0-9_]+$/ },
    { re: /^state\s+[A-Za-z0-9_]+$/ },
  ],
  xychart: [
    { re: /^xychart(?:-beta)?$/i, header: true },
    { re: /^title\s+\S.*$/ },
    { re: /^x-axis\s+\S.*$/ },
    { re: /^y-axis\s+\S.*$/ },
    {
      re: new RegExp(
        String.raw`^(?:bar|line)\s+(\[[^\]]*\]|\[[^\]]*\]\s*\{[^}]*\}|\S.*)$`,
      ),
    },
  ],
};

const TYPE_BY_ID = Object.fromEntries(SUPPORTED_TYPES.map((t) => [t.id, t]));

/** Remove `%%…` comment chunks from a statement (the renderer ignores them). */
function stripCommentChunks(stmt) {
  return stmt.replace(/%%.*$/gm, '').trim();
}

/**
 * Validate ONE mermaid fence body (header line first, 1-based lines).
 * Returns [{ line, rule, message }] — empty when the fence is fully allow-listed.
 */
export function validateMermaidFence(source) {
  const errors = [];
  const lines = String(source ?? '').split('\n');
  let headerLine = -1;
  let type = null;
  for (let i = 0; i < lines.length; i++) {
    const stmt = stripCommentChunks(lines[i]);
    if (stmt === '') continue;
    headerLine = i + 1;
    for (const t of SUPPORTED_TYPES) {
      if (GRAMMARS[t.id][0].re.test(stmt)) {
        type = t;
        break;
      }
    }
    if (type === null) {
      errors.push({
        line: headerLine,
        rule: 'mermaid.allowlist.type',
        message: `unsupported or unknown diagram header \`${stmt}\` — the supported set is ${SUPPORTED_TYPES.map((t) => `\`${t.label}\``).join(', ')}; the renderer coerces unknown headers to flowchart or drops content silently (R6 BU-3), so an unlisted header fails this gate instead`,
      });
    }
    break;
  }
  if (headerLine === -1) {
    return [
      {
        line: 1,
        rule: 'mermaid.allowlist.empty',
        message: 'empty mermaid fence — nothing to render',
      },
    ];
  }
  if (type === null) return errors;

  for (let i = headerLine; i < lines.length; i++) {
    // A physical line may carry several `;`-separated statements (the renderer splits on both).
    const statements = lines[i].split(';');
    for (const raw of statements) {
      const stmt = stripCommentChunks(raw);
      if (stmt === '') continue;
      const lineNo = i + 1;
      const loss = SILENT_LOSS.find((s) => s.re.test(stmt));
      if (loss) {
        errors.push({
          line: lineNo,
          rule: 'mermaid.allowlist.silent-loss',
          message: `\`${stmt.slice(0, 80)}\` — ${loss.why}`,
        });
        continue;
      }
      const grammar = GRAMMARS[type.id].slice(1);
      if (!grammar.some((g) => g.re.test(stmt))) {
        errors.push({
          line: lineNo,
          rule: 'mermaid.allowlist.statement',
          message: `statement \`${stmt.slice(0, 80)}\` is not in the ${type.label} allow-list — widen scripts/lib/mermaid-allowlist.mjs (both consumers share it) rather than shipping a fence the renderer may silently truncate`,
        });
      }
    }
  }
  return errors;
}

/**
 * Extract ```mermaid fences from a markdown source.
 * Returns [{ startLine, source, unterminated }] — startLine is the 1-based markdown line of
 * the fence BODY's first line; `unterminated` fences run to end-of-input and are reported.
 */
export function extractMermaidFences(markdown) {
  const fences = [];
  const lines = String(markdown ?? '').split('\n');
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (open === null) {
      // CommonMark: a fence is 3+ backticks or tildes, and the info string's FIRST word names
      // the language — ````mermaid, ```Mermaid and ```mermaid title="x" are all mermaid fences.
      // Anything narrower lets such a fence skip the allow-list entirely (deny-by-default).
      const m = /^(`{3,}|~{3,})\s*mermaid(?:\s.*)?$/i.exec(trimmed);
      if (m) open = { marker: m[1], bodyStart: i + 1 };
    } else if (
      trimmed.startsWith(open.marker) &&
      new RegExp(`^\\${open.marker[0]}+\\s*$`).test(trimmed)
    ) {
      fences.push({
        startLine: open.bodyStart + 1,
        source: lines.slice(open.bodyStart, i).join('\n'),
      });
      open = null;
    }
  }
  if (open !== null) {
    fences.push({
      startLine: open.bodyStart + 1,
      source: lines.slice(open.bodyStart).join('\n'),
      unterminated: true,
    });
  }
  return fences;
}

/**
 * Validate every ```mermaid fence in a markdown source. Findings carry the ABSOLUTE markdown
 * line number (fence offset + in-fence line), the rule id, and an actionable message.
 */
export function validateMarkdownMermaid(markdown) {
  const findings = [];
  for (const fence of extractMermaidFences(markdown)) {
    if (fence.unterminated) {
      findings.push({
        line: fence.startLine,
        rule: 'mermaid.allowlist.unterminated',
        message:
          'mermaid fence is never closed — the renderer would consume the rest of the page as diagram input',
      });
    }
    for (const err of validateMermaidFence(fence.source)) {
      findings.push({
        line: fence.startLine + err.line - 1,
        rule: err.rule,
        message: err.message,
      });
    }
  }
  return findings;
}
