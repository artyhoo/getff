// Strict JSON reader for Dot review reports — spec §7 bounds in one deterministic pass.
//
// JSON.parse collapses duplicate object keys (last wins), so a report carrying two
// "verdict" keys would parse to whichever the forger put last. The contract requires
// rejecting that outright, together with the payload/nesting bounds the schema cannot
// express on raw bytes: <= 1 MiB payload, <= 64 nesting levels (spec §7.1).
//
// Recursive-descent, no dependencies; throws Error with .code:
//   BOM | SIZE | PARSE | TRAILING | DEPTH | DUP_KEY | PROTO_KEY
// (non-finite numbers and comments are PARSE — outside the JSON grammar).
//
// Objects are constructed with Object.create(null) and the __proto__ key is
// refused outright: plain `{}` + `obj[key] = v` routes a JSON key "__proto__"
// through the prototype setter, so a report's real fields could sit on
// Object.prototype where every downstream property read still sees them (review R7).

const MAX_BYTES = 1024 * 1024;
const MAX_DEPTH = 64;

export function parseStrictJson(text, { maxBytes = MAX_BYTES, maxDepth = MAX_DEPTH } = {}) {
  if (typeof text !== 'string') throw code('PARSE', 'input is not a string');
  if (text.charCodeAt(0) === 0xfeff) throw code('BOM', 'leading byte-order mark');
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > maxBytes) throw code('SIZE', `payload ${bytes} bytes exceeds ${maxBytes}`);

  let i = 0;
  // Depth counts container nesting (objects + arrays); a scalar leaf is not a level.
  const parseValue = (depth, where) => {
    ws();
    if (i >= text.length) throw code('PARSE', `unexpected end at ${where}`);
    const c = text[i];
    if (c === '{') return parseObject(depth + 1, where);
    if (c === '[') return parseArray(depth + 1, where);
    if (c === '"') return parseString(where);
    return parseLiteral(where);
  };

  const ws = () => {
    while (i < text.length) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
      else break;
    }
  };

  const parseObject = (depth, where) => {
    if (depth > maxDepth) throw code('DEPTH', `nesting exceeds ${maxDepth} at ${where}`);
    i++; // {
    const obj = Object.create(null);
    const seen = new Set();
    ws();
    if (text[i] === '}') { i++; return obj; }
    for (;;) {
      ws();
      if (text[i] !== '"') throw code('PARSE', `expected key at ${where}:${i}`);
      const key = parseString(`${where}.key`);
      if (key === '__proto__') throw code('PROTO_KEY', `"__proto__" is not a data key at ${where}:${i}`);
      if (seen.has(key)) throw code('DUP_KEY', `duplicate key "${key}" at ${where}:${i}`);
      seen.add(key);
      ws();
      if (text[i] !== ':') throw code('PARSE', `expected ':' at ${where}:${i}`);
      i++;
      obj[key] = parseValue(depth, `${where}.${key}`);
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === '}') { i++; return obj; }
      throw code('PARSE', `expected ',' or '}' at ${where}:${i}`);
    }
  };

  const parseArray = (depth, where) => {
    if (depth > maxDepth) throw code('DEPTH', `nesting exceeds ${maxDepth} at ${where}`);
    i++; // [
    const arr = [];
    ws();
    if (text[i] === ']') { i++; return arr; }
    for (;;) {
      arr.push(parseValue(depth, `${where}[${arr.length}]`));
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === ']') { i++; return arr; }
      throw code('PARSE', `expected ',' or ']' at ${where}:${i}`);
    }
  };

  const parseString = (where) => {
    i++; // opening quote
    let out = '';
    for (;;) {
      if (i >= text.length) throw code('PARSE', `unterminated string at ${where}`);
      const c = text[i];
      if (c === '"') { i++; return out; }
      if (c === '\\') {
        const e = text[i + 1];
        i += 2;
        if (e === '"') out += '"';
        else if (e === '\\') out += '\\';
        else if (e === '/') out += '/';
        else if (e === 'b') out += '\b';
        else if (e === 'f') out += '\f';
        else if (e === 'n') out += '\n';
        else if (e === 'r') out += '\r';
        else if (e === 't') out += '\t';
        else if (e === 'u') {
          const hex = text.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw code('PARSE', `bad \\u escape at ${where}`);
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else throw code('PARSE', `bad escape \\${e} at ${where}`);
      } else {
        if (c.charCodeAt(0) < 0x20) throw code('PARSE', `raw control char in string at ${where}`);
        out += c;
        i++;
      }
    }
  };

  const parseLiteral = (where) => {
    const rest = text.slice(i);
    let m;
    if ((m = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/))) {
      i += m[0].length;
      const n = Number(m[0]);
      if (!Number.isFinite(n)) throw code('PARSE', `non-finite number at ${where}`);
      return n;
    }
    if (rest.startsWith('true')) { i += 4; return true; }
    if (rest.startsWith('false')) { i += 5; return false; }
    if (rest.startsWith('null')) { i += 4; return null; }
    throw code('PARSE', `unexpected token at ${where}:${i}`);
  };

  const value = parseValue(0, '$');
  ws();
  if (i !== text.length) throw code('TRAILING', `trailing content at offset ${i}`);
  return value;
}

function code(c, message) {
  const e = new Error(`[${c}] ${message}`);
  e.code = c;
  return e;
}
