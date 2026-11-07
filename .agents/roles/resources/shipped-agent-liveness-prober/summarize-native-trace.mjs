// Bounded Claude stream-json counter for the verified top-level launcher.
// It reads evidence only; it never launches a model or modifies a trace.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

try {
  if (process.argv.length !== 3) throw new Error('Expected one native stream-json trace path');
  const path = process.argv[2];
  const raw = readFileSync(path);
  const records = raw.toString('utf8').split('\n').filter((s) => s.trim()).map((s) => JSON.parse(s));
  const inits = records.filter((r) => r.type === 'system' && r.subtype === 'init');
  const results = records.filter((r) => r.type === 'result');
  if (inits.length !== 1 || results.length !== 1) throw new Error('Expected one fresh init and one completed result');
  const init = inits[0], result = results[0];
  if (!init.session_id || !Array.isArray(init.tools) || !init.tools.every((t) => typeof t === 'string')) throw new Error('Unknown native init/grant shape');
  if (result.session_id !== init.session_id || result.subtype !== 'success' || result.is_error !== false) throw new Error('Failed or mismatched native result');
  const calls = new Map();
  for (const record of records) {
    if (!['system', 'assistant', 'user', 'result'].includes(record.type)) throw new Error('Unsupported native event shape');
    if (record.type !== 'assistant') continue;
    if (record.session_id !== init.session_id) throw new Error('Foreign or unknown assistant session');
    if (!Array.isArray(record.message?.content)) throw new Error('Unknown assistant content shape');
    for (const block of record.message.content) {
      if (block.type !== 'tool_use') continue;
      if (record.parent_tool_use_id) throw new Error('Nested trace needs a separately verified child correlation contract');
      if (typeof block.id !== 'string' || !block.id || typeof block.name !== 'string' || !init.tools.includes(block.name)) throw new Error('Unknown or ungranted native tool call');
      const signature = JSON.stringify({ name: block.name, input: block.input });
      if (calls.has(block.id) && calls.get(block.id).signature !== signature) throw new Error('Conflicting replayed native tool ID');
      calls.set(block.id, { id: block.id, name: block.name, signature });
    }
  }
  const counts = {};
  for (const call of calls.values()) counts[call.name] = (counts[call.name] || 0) + 1;
  process.stdout.write(JSON.stringify({ raw_trace: path, raw_sha256: createHash('sha256').update(raw).digest('hex'), session_id: init.session_id, granted_tools: init.tools, total: calls.size, counts, calls: [...calls.values()].map(({ id, name }) => ({ id, name })) }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`Unverified native trace: ${error.message}\n`);
  process.exitCode = 1;
}
