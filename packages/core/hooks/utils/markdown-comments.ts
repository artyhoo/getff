/**
 * Markdown-aware HTML-comment stripping — shared by the two PR-body gates
 * (checks/pr-body-fidelity.ts, checks/pr-stale-revert.ts).
 *
 * Both gates must read a PR body the way GitHub RENDERS it: text hidden inside an
 * HTML comment must not satisfy a check, because a section that renders empty is
 * not a section anyone wrote. Both used to implement that as a raw
 * `text.replace(/<!--[\s\S]*?-->/g, '')` over the whole body — one copy each,
 * the `#sync-by-copy-paste` shape .claude/rules/dual-implementation-discipline.md §8
 * names. That regex has no notion of code, and markdown does:
 *
 *   The shipped line is `a/** --> <!-- inject: X` verbatim.
 *
 * GitHub renders that `<!--` as literal text inside a code span. The regex saw a
 * comment opener, found no `-->` until the template footer far below, and deleted
 * everything in between — including the `## Fidelity verdict` heading. The gate then
 * reported a missing section for a section that was plainly present (incident
 * 2026-09-02, measured at 6947 characters swallowed on PR #1575's own body — a PR
 * whose subject was marker syntax, so it could not avoid quoting markers).
 *
 * The fix is not a cleverer regex — it is to ask a CommonMark parser where the
 * comments actually are. remark is already an adopted dependency for exactly this
 * problem class (prior-art-evaluations.md#58, ADOPT — «code-fence-aware text
 * extraction»; first consumer audit-self/audit-ai-docs.ts).
 *
 * Scrubbing is confined to node boundaries, which is what makes the result
 * conservative in the fail-CLOSED direction:
 *   - a comment can never start inside code and close outside it (the incident);
 *   - a comment INSIDE code is still removed, so nothing that used to be hidden
 *     from a gate becomes visible to it — this fix widens no hole;
 *   - an unterminated `<!--` in prose hides the rest of the document, because
 *     CommonMark HTML block type 2 ends only at a line containing `-->` and
 *     otherwise runs to end of input. The old regex found no match and stripped
 *     NOTHING, i.e. fed the gate text GitHub does not show. Deferring the node
 *     boundary to remark fixes that direction for free.
 */
import { remark } from 'remark';

/**
 * The mdast shape this module needs. Declared locally rather than imported from
 * `unist` / `unist-util-visit`: those are transitive deps of remark, not declared
 * ones, and the CI gates install with `npm ci --prefix packages/core` — resolving a
 * package nobody declared is an accident of hoisting, not a contract.
 */
interface AstNode {
  type: string;
  position?: { start?: { offset?: number }; end?: { offset?: number } };
  children?: AstNode[];
}

/** Balanced comment — the original grammar, now applied per node instead of per body. */
const BALANCED_RE = /<!--[\s\S]*?-->/g;
/** An opener with no closer left in a raw-HTML node: hidden through the node's end. */
const UNTERMINATED_RE = /<!--[\s\S]*$/;

/**
 * A source range scrubbed in isolation. `raw` marks mdast `html` (markup GitHub
 * interprets); `code`/`inlineCode` are literal text, where an unterminated opener
 * is just characters and must survive.
 */
interface Region {
  start: number;
  end: number;
  raw: boolean;
}

function scrub(source: string, raw: boolean): string {
  const balanced = source.replace(BALANCED_RE, '');
  return raw ? balanced.replace(UNTERMINATED_RE, '') : balanced;
}

/**
 * Remove HTML comments from a markdown body, leaving every other byte in place.
 *
 * Text outside the returned regions can hold no comment: any `<!--` in prose is
 * parsed as an `html` node (block or inline), and a `<!--` that CommonMark does not
 * treat as markup — an unterminated opener mid-paragraph, say — is literal text
 * GitHub shows, so leaving it is the rendered truth.
 */
export function stripHtmlComments(text: string): string {
  const regions: Region[] = [];
  const walk = (node: AstNode): void => {
    const raw = node.type === 'html';
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    const isRegion = raw || node.type === 'code' || node.type === 'inlineCode';
    if (isRegion && start !== undefined && end !== undefined) {
      regions.push({ start, end, raw });
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(remark().parse(text) as AstNode);
  regions.sort((a, b) => a.start - b.start);

  let out = '';
  let cursor = 0;
  for (const r of regions) {
    // mdast never nests these node types; the guard keeps a malformed tree from
    // duplicating source rather than trusting that invariant silently.
    if (r.start < cursor) continue;
    out += text.slice(cursor, r.start) + scrub(text.slice(r.start, r.end), r.raw);
    cursor = r.end;
  }
  return out + text.slice(cursor);
}
