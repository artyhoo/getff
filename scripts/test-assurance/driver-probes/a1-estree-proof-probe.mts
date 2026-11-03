// D011 S1 recovery — A1 reachability proof (amended-2, NEW).
// Finding A1: the amended-1 Q2 mutant read cbBody.statements — a property ESTree never
// provides — so the mutant crashed with TypeError instead of reaching permissive
// behavior. The BlockStatement children live at .body. This probe parses the FROZEN
// corpus file (be84 bytes) and proves the corrected mutant's guard is TRUE on exactly
// that input: the it() callback body is a BlockStatement whose .body array is empty.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import tsParser from '@typescript-eslint/parser';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const TARGET = 'scripts/test-assurance/corpus/q2-noassertion/bad.comment-only.ts';
const code = readFileSync(join(ROOT, TARGET), 'utf8');
const ast = tsParser.parseForESLint(code, { ecmaVersion: 'latest', sourceType: 'module' }).ast;

// Find it('...', () => {...}) calls whose callback body is an empty BlockStatement.
const empties: Array<{ line: number; bodyType: string; bodyLen: number }> = [];
const visit = (node: unknown): void => {
  const n = node as { type?: string; callee?: { name?: string; property?: { name?: string } }; arguments?: unknown[]; body?: { type?: string; body?: unknown[] }; [k: string]: unknown };
  if (n && typeof n === 'object' && n.type === 'CallExpression') {
    const name = n.callee?.name ?? n.callee?.property?.name;
    if (name === 'it' || name === 'test') {
      for (const arg of n.arguments ?? []) {
        const fn = arg as { type?: string; body?: { type?: string; body?: unknown[] } };
        if (fn?.type === 'ArrowFunctionExpression' || fn?.type === 'FunctionExpression') {
          const b = fn.body;
          if (b?.type === 'BlockStatement') {
            empties.push({
              line: (n.loc as { start: { line: number } } | undefined)?.start?.line ?? -1,
              bodyType: b.type,
              bodyLen: (b.body ?? []).length,
            });
          }
        }
      }
    }
  }
  for (const k of Object.keys(n ?? {})) {
    const v = n[k];
    if (v && typeof v === 'object' && typeof (v as { type?: string }).type === 'string') visit(v);
    else if (Array.isArray(v)) for (const item of v) if (item && typeof item === 'object') visit(item);
  }
};
visit(ast);

console.log(`A1-ESTREE file=${TARGET} candidates=${empties.length}`);
for (const e of empties) {
  // The corrected mutant's guard: cbBody && cbBody.type === 'BlockStatement' && cbBody.body.length === 0
  const guardTrue = e.bodyType === 'BlockStatement' && e.bodyLen === 0;
  console.log(
    `A1-ESTREE it-line=${e.line} cb.body.type=${e.bodyType} cb.body.body.length=${e.bodyLen} mutant-guard=${guardTrue ? 'TRUE (reachable, returns early — permissive)' : 'false'}`,
  );
}
if (empties.length === 0 || !empties.some((e) => e.bodyType === 'BlockStatement' && e.bodyLen === 0)) {
  console.log('A1-ESTREE-FAIL no empty BlockStatement callback found — mutant unreachable on this input');
  process.exit(1);
}
console.log('A1-ESTREE-OK the amended-2 Q2PERM mutant is REACHABLE on the frozen corpus input (no TypeError path)');
