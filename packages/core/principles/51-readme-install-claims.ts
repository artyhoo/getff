/** Pure checks for principle 51. Installer sets are supplied by its shared readers. */
type Arm = 'A' | 'B' | 'C' | 'D';
const patterns: Record<Arm, RegExp> = {
  A: /(\d+) shipped by default: ((?:`[a-z0-9-]+`(?:, )?)+)/g,
  B: /(\d+) more agents ship only under ([^:]+): ((?:`[a-z0-9-]+`(?: \+ |, )?)+)/g,
  C: /(\d+) skills at the default `env` profile: ((?:`[a-z0-9-]+`(?:, )?)+)/g,
  D: /`--profile factory` adds (\d+) more skills: ((?:`[a-z0-9-]+`(?:, )?)+)/g,
};
function section(text: string): string {
  const match = text.match(/^## What you get today\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
  return match ? match[1] : /^## /m.test(text) ? '' : text;
}
export function checkClaim(arm: Arm, text: string, expected: string[]): string[] {
  const matches = [...section(text).matchAll(patterns[arm])];
  if (matches.length !== 1) return [`${arm}: claim not found exactly once — keep it in the checkable form`];
  const match = matches[0];
  const list = match[arm === 'B' ? 3 : 2];
  const names = [...list.matchAll(/`([^`]+)`/g)].map(m => m[1]);
  const errors: string[] = [];
  const tail = section(text).slice((match.index ?? 0) + match[0].length);
  if (/^\s*(?:[,;+|/]\s*|(?:and|or)\s+)?`[a-z0-9-]+`/.test(tail)) errors.push(`${arm}: malformed list continuation`);
  if (arm === 'B' && !match[2].includes('--profile factory')) errors.push('B: missing --profile factory');
  if (Number(match[1]) !== names.length || names.length !== expected.length) errors.push(`${arm}: inconsistent count or list length`);
  if (new Set(names).size !== names.length) errors.push(`${arm}: duplicate names`);
  const missing = expected.filter(x => !names.includes(x));
  const extra = names.filter(x => !expected.includes(x));
  if (missing.length) errors.push(`${arm}: missing ${missing.join(', ')}`);
  if (extra.length) errors.push(`${arm}: extra ${extra.join(', ')}`);
  return errors;
}
export function uncheckedCounts(text: string, live = false): string[] {
  let items = live ? section(text).match(/^1\. \*\*Skills\*\*[\s\S]*?(?=^3\. )/m)?.[0] ?? '' : text;
  if (live && !items) return ['E: items 1–2 not found'];
  for (const pattern of Object.values(patterns)) items = items.replace(pattern, '');
  const errors: string[] = [];
  for (const line of items.split('\n')) {
    const tokens = line.replace(/`[^`]*`/g, '').split(/\s+/).map(x => x.replace(/^[(),.;:]+|[(),.;:]+$/g, ''));
    for (let i = 0; i < tokens.length; i++) {
      if (/^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)$/i.test(tokens[i]) && tokens.slice(i + 1, i + 4).some(x => /^(?:sub-)?(?:agent|skill)s?$/i.test(x))) errors.push(`E: unchecked count: ${line.trim()}`);
    }
  }
  return errors;
}
export function checkPins(text: string): string[] {
  const assignments = [...text.matchAll(/^[ \t]*CORE_DEVDEPS=\(/gm)];
  const blocks = [...text.matchAll(/^[ \t]*CORE_DEVDEPS=\([ \t]*\n([\s\S]*?)^[ \t]*\)/gm)];
  if (assignments.length !== 1 || blocks.length !== 1) return ['F: expected exactly one CORE_DEVDEPS block'];
  const errors: string[] = [];
  let count = 0;
  for (const line of blocks[0][1].split('\n')) {
    const marker = line.indexOf('#');
    if (marker > 0 && !/\s/.test(line[marker - 1])) errors.push('F: # is not a shell comment boundary');
    const [code, ...commentParts] = line.split('#');
    const comment = commentParts.join('#');
    if (/(?:@[\w.-]+\/)?[\w.-]+@[\w.*^~<>=+-]+|[\w./-]+\.(?:c|m)?js\b/.test(comment)) errors.push('F: comment contains a package spec or JS token');
    if (!code.trim()) continue;
    const specs = code.trim().split(/\s+/);
    count += specs.length;
    if (specs.length !== 1) errors.push(`F: one spec per line required: ${code.trim()}`);
    if (!/^\s*why:\s*\S/.test(comment) || comment.replace(/^\s*why:\s*/, '').trim().length < 15) errors.push(`F: ${specs.join(' ')} needs # why: with at least 15 characters`);
  }
  if (!count) errors.push('F: CORE_DEVDEPS is empty');
  return errors;
}
