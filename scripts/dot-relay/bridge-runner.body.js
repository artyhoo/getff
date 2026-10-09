// BRIDGE-BODY-MARKER-7c31 — deployed coordinator bridge body (v2, repair pass).
//
// Executes as an AsyncFunction body with ONLY (tools, config, emit) injected:
// none of the host's encoding, hashing, binary or OS globals exist here
// (R01). All byte counting is pure code-point UTF-8 math; every hash check and
// durable effect goes through the runtime CLI via tools.exec_command, which
// alone touches disk. Public tool result SHAPES follow PUBLIC-TOOL-SHAPES.json
// (R02): wait/send return {content:[{type:'text',text:JSON}],isError:false}
// with NO structuredContent — anything else is a fixed-code failure, never
// error-text interpretation (an unknown send error is UNCERTAIN, never
// access-denied). Trusted cursors ride the wait receipt (poll.cursor) and the
// durable generation row, never the locator payload (R03). Bounded Page
// fallback per PAGE-LOCATOR-RECOVERY-ADDENDUM: only when the locator
// reference is exactly 'library-file'/'project-file' AND the page_id matches
// the role's registry entry — one read_page search call, label-verified
// hyperlink candidates, exact digest checks, bounded ambiguity codes.

const CHUNK_BYTES = 12000; // per-chunk byte cap (CLI hard limit is 16KiB)
const OUT_MAX = 4096;
const SOURCE_MAX = 200000;
const HEX64 = /^[0-9a-f]{64}$/;
const GEN_RE = /^[A-Z0-9][A-Z0-9-]{0,63}$/;
const ROLES = ['collector', 'analyst', 'solver'];
const LOCATOR_PREFIX = 'DOT_RELAY_INDEX ';

// ---------------------------------------------------------------- cycle bound
//
// BOUNDED-CYCLE: the configured cycle wall budget is enforced at every
// bounded work unit. The wall-clock adapter is injected (config.cycle_clock)
// defaulting to the ECMAScript Date.now — this realm HAS Date but NO host
// timers, so the Promise.race bound rides an injected timer pair
// (config.timers); without a pair the race degrades to awaiting the call
// directly while the deadline admission checks still bound every NEW work
// unit. The final reserve window (min(5s, budget/9) — 5s of a 45s budget)
// is metadata receipt/continuation cleanup only: no new data work is
// admitted once the remaining time drops to the reserve.
let CY = null;

function cycleInit(config) {
  const clock = typeof config.cycle_clock === 'function' ? config.cycle_clock : Date.now;
  const rawBudget = config.cycle_wall_budget_ms;
  const budgetMs = Number.isSafeInteger(rawBudget) && rawBudget > 0 ? rawBudget : 45000;
  CY = { clock, budgetMs, start: clock(), reserveMs: Math.min(5000, Math.floor(budgetMs / 9)) };
}

function cycleRemaining() {
  if (!CY) return Infinity;
  return CY.budgetMs - (CY.clock() - CY.start);
}

// admission gate for NEW data work (source fetch, page/spool unit, claim,
// send): true only while more than the reserve remains
function cycleAdmitData() {
  if (!CY) return true;
  return cycleRemaining() > CY.reserveMs;
}

// Race one public tool/CLI call against the remaining cycle budget. The
// call itself is NEVER cancelled (host timers own it) — a timeout means the
// outcome is unknown, and every caller treats it by its own fixed code:
// reads/waits stop with no cursor advance, CLI calls surface their timeout
// code with no fabricated success, sends settle UNCERTAIN (claim-first,
// never resent). Degradation without an injected timer pair: await directly.
async function raceTool(config, promise, code) {
  const remaining = cycleRemaining();
  if (remaining <= 0) throw bridgeFail(code);
  const timers = config && typeof config.timers === 'object' ? config.timers : null;
  if (!timers || typeof timers.setTimeout !== 'function' || typeof timers.clearTimeout !== 'function') {
    return promise;
  }
  let timer = null;
  try {
    return await new Promise((resolve, reject) => {
      timer = timers.setTimeout(() => reject(bridgeFail(code)), Math.max(0, cycleRemaining()));
      Promise.resolve(promise).then(resolve, reject);
    });
  } finally {
    if (timer !== null) timers.clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- pure bytes

function cpByteLen(cp) {
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

// A lone (unpaired) surrogate cannot round-trip UTF-8: Node would silently
// encode it as the 3-byte U+FFFD replacement and corrupt exact-byte replay.
// Code-point iteration yields surrogate PAIRS as a single 2-char string, so
// any iterated ch whose code point is in the surrogate block is LONE.
function isLoneSurrogateCp(cp) {
  return cp >= 0xd800 && cp <= 0xdfff;
}

function utf8Len(text) {
  let n = 0;
  for (const ch of text) n += cpByteLen(ch.codePointAt(0));
  return n;
}

// Split at code-point boundaries under a BYTE budget; the CLI re-counts and
// re-verifies every chunk server-side, so this only has to be conservative.
// A lone surrogate REJECTS the whole text (R01 partial) — never a rewrite.
function chunkByBytes(text, maxBytes) {
  const chunks = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (isLoneSurrogateCp(cp)) throw bridgeFail('SOURCE_NOT_UTF8');
    const b = cpByteLen(cp);
    if (curBytes > 0 && curBytes + b > maxBytes) {
      chunks.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  if (curBytes > 0) chunks.push(cur);
  return chunks;
}

function sq(token) {
  return `'${String(token).replace(/'/g, "'\\''")}'`;
}

function bridgeFail(code) {
  const e = new Error(code);
  e.bridgeCode = code;
  return e;
}

function codeOf(e) {
  return e && typeof e.bridgeCode === 'string' ? e.bridgeCode : 'CLI_FAILED';
}

// ---------------------------------------------------------------- CLI adapter

// One exec_command per CLI invocation; exit code + bounded stdout JSON only.
async function runCli(tools, config, args) {
  const cmd = ['env', 'NODE_NO_WARNINGS=1', sq(config.node), sq(config.cli), sq(args[0]), '--root', sq(config.root)]
    .concat(args.slice(1).map(sq)).join(' ');
  const r = await raceTool(config, tools.exec_command({ cmd }), 'CYCLE_CLI_TIMEOUT');
  const exit = r && typeof r.exit_code === 'number' ? r.exit_code : 1;
  let out = '';
  try { out = String((r && r.output) ?? ''); } catch { out = ''; }
  let parsed = null;
  try { parsed = JSON.parse(out.split('\n')[0]); } catch { parsed = null; }
  if (exit !== 0 || !parsed || parsed.ok !== true) {
    throw bridgeFail(parsed && typeof parsed.code === 'string' ? parsed.code : 'CLI_FAILED');
  }
  return parsed;
}

// ---------------------------------------------------------------- tool adapters

function decodeContentJson(res) {
  if (!res || typeof res !== 'object' || res.isError === true) return null;
  const content = res.content;
  if (!Array.isArray(content) || content.length !== 1) return null;
  const block = content[0];
  if (!block || typeof block !== 'object' || block.type !== 'text' || typeof block.text !== 'string') return null;
  try { return JSON.parse(block.text); } catch { return null; }
}

// ONE wait per cycle; afterCursor only from durably committed cursors.
async function waitOnce(tools, config, cursors) {
  const targets = [];
  for (const role of ROLES) {
    const threadId = config.ids[role];
    if (!threadId) continue;
    const t = { threadId };
    if (cursors && typeof cursors[role] === 'string' && cursors[role].length > 0) t.afterCursor = cursors[role];
    targets.push(t);
  }
  let res;
  try {
    res = await raceTool(config, tools['mcp__codex_app__wait_threads']({ targets, timeoutMs: 0 }), 'CYCLE_TOOL_TIMEOUT');
  } catch {
    return { ok: false, polls: [] };
  }
  const parsed = decodeContentJson(res);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.polls)) {
    return { ok: false, polls: [] };
  }
  return { ok: true, polls: parsed.polls };
}

// Decoded threadId is authoritative: a mismatched id means the send did NOT
// reach the destination — UNCERTAIN, never a success. A budget timeout is
// equally UNCERTAIN (claim-first): the original promise result is discarded,
// never emitted as success, never blindly resent.
async function sendOnce(tools, config, threadId, prompt) {
  let res;
  try {
    res = await raceTool(config, tools['mcp__codex_app__send_message_to_thread']({ threadId, prompt }), 'CYCLE_TOOL_TIMEOUT');
  } catch {
    return { ok: false };
  }
  const parsed = decodeContentJson(res);
  if (!parsed || typeof parsed !== 'object' || parsed.threadId !== threadId) return { ok: false };
  return { ok: true };
}

// R02-SOURCE: the adapter itself enforces the full successful-source shape
// BEFORE any caller spools or publishes: no error envelope (isError present
// and !== false), kind=text, text_representation=source, string text, the
// returned page_id/reference EXACTLY echo the request, sha256 is 64 lowercase
// hex, byte_size is a safe integer in 1..SOURCE_MAX and equals the pure UTF-8
// count of the text, and the text carries no lone surrogate. Expected-digest
// equality against the descriptor stays at the call sites.
async function readRef(tools, config, pageId, reference) {
  const res = await raceTool(config, tools['mcp__codex_apps__chatgpt_space_read_page_reference']({ page_id: pageId, reference }), 'CYCLE_TOOL_TIMEOUT');
  if (!res || typeof res !== 'object' || (res.isError !== undefined && res.isError !== false)) {
    throw bridgeFail('SOURCE_READ_FAILED');
  }
  const sc = res.structuredContent;
  if (!sc || typeof sc !== 'object') throw bridgeFail('SOURCE_READ_FAILED');
  if (sc.kind !== 'text' || sc.text_representation !== 'source' || typeof sc.text !== 'string') {
    throw bridgeFail('SOURCE_READ_FAILED');
  }
  if (sc.page_id !== pageId || sc.reference !== reference) throw bridgeFail('SOURCE_READ_FAILED');
  if (typeof sc.sha256 !== 'string' || !HEX64.test(sc.sha256)) throw bridgeFail('SOURCE_READ_FAILED');
  if (!Number.isSafeInteger(sc.byte_size) || sc.byte_size <= 0 || sc.byte_size > SOURCE_MAX) {
    throw bridgeFail('SOURCE_READ_FAILED');
  }
  for (const ch of sc.text) {
    if (isLoneSurrogateCp(ch.codePointAt(0))) throw bridgeFail('SOURCE_NOT_UTF8');
  }
  if (utf8Len(sc.text) !== sc.byte_size) throw bridgeFail('SOURCE_READ_FAILED');
  return sc;
}

// ---------------------------------------------------------------- locator

function parseLocator(text, role, config) {
  if (typeof text !== 'string' || utf8Len(text) > OUT_MAX) return null;
  if (text.indexOf(LOCATOR_PREFIX) !== 0) return null;
  let obj;
  try { obj = JSON.parse(text.slice(LOCATOR_PREFIX.length)); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  // exact schema: extra fields (legacy cursor_token, invented tokens) refuse
  const keys = Object.keys(obj).sort().join(',');
  if (keys !== 'generation,index,producer,status,version') return null;
  if (obj.version !== 1) return null;
  if (obj.producer !== config.ids[role]) return null;
  if (obj.status !== 'READY' && obj.status !== 'WAIT' && obj.status !== 'BLOCKED') return null;
  if (typeof obj.generation !== 'string' || !GEN_RE.test(obj.generation)) return null;
  const ix = obj.index;
  if (!ix || typeof ix !== 'object') return null;
  if (Object.keys(ix).sort().join(',') !== 'bytes,page_id,reference,sha256') return null;
  if (typeof ix.page_id !== 'string' || ix.page_id.length === 0 || ix.page_id.length > 256) return null;
  if (typeof ix.reference !== 'string' || ix.reference.length === 0 || ix.reference.length > 1024) return null;
  if (typeof ix.sha256 !== 'string' || !HEX64.test(ix.sha256)) return null;
  if (!Number.isSafeInteger(ix.bytes) || ix.bytes <= 0 || ix.bytes > SOURCE_MAX) return null;
  return obj;
}

// Protocol text is ONLY a completed turn's final_answer phase.
function protocolFinal(poll) {
  if (!poll || typeof poll !== 'object') return null;
  const thread = poll.thread;
  if (!thread || typeof thread.id !== 'string') return null;
  const turn = poll.latestTurn;
  const msg = poll.latestAssistantMessage;
  if (!turn || turn.status !== 'completed') return null;
  if (!msg || msg.phase !== 'final_answer' || typeof msg.text !== 'string') return null;
  return { threadId: thread.id, cursor: typeof poll.cursor === 'string' ? poll.cursor : null, text: msg.text };
}

// ---------------------------------------------------------------- page fallback

// [label](target) | [label](<target>) | [label](target "title")
function parseMarkdownLinks(md) {
  const out = [];
  const re = /\[([^\]\n]*)\]\(\s*(?:<([^>\n]*)>|([^)\s]+))(?:\s+"[^"\n]*")?\s*\)/g;
  let m = re.exec(md);
  while (m !== null) {
    out.push({ label: m[1], target: m[2] !== undefined ? m[2] : m[3] });
    m = re.exec(md);
  }
  return out;
}

function basenameOf(s) {
  const cut = Math.max(s.lastIndexOf('/'), s.lastIndexOf(':'));
  return cut === -1 ? s : s.slice(cut + 1);
}

// F04: a full opaque Library reference is the scheme plus a NONEMPTY payload,
// taken exactly as the supported tool returns it — a slash is NOT part of the
// grammar (real targets are opaque ids), the payload is never decoded or
// rebuilt, and the bare type label (no colon / empty payload) is NOT a full
// reference. Bounded to the locator reference grammar's 1024 chars, no
// whitespace.
function fullRefTarget(ref) {
  if (typeof ref !== 'string' || ref.length === 0 || ref.length > 1024 || /\s/.test(ref)) return null;
  for (const scheme of ['library-file:', 'project-file:']) {
    if (ref.indexOf(scheme) === 0) {
      return ref.length > scheme.length ? ref : null;
    }
  }
  return null;
}

// Resolve an index-page descriptor to its exact source text. Fast path: any
// FULL opaque library-file:/project-file: reference is fetched directly. The
// bare type-labels ('library-file'/'project-file') enter the bounded Page
// fallback — gated to the role's own registry page, consulting the durable
// locator-resolution cache first (a cached ref is still VERIFIED on fetch).
// Anything else is INDEX_REF_UNRESOLVED before any fetch of any kind.
async function resolveIndexSource(tools, config, cache, role, generation, desc) {
  const ref = desc.reference;
  const direct = fullRefTarget(ref);
  if (direct !== null) {
    const sc = await readRef(tools, config, desc.page_id, direct);
    if (sc.sha256 !== desc.sha256 || sc.byte_size !== desc.bytes) throw bridgeFail('INDEX_DESCRIPTOR_MISMATCH');
    return sc;
  }
  if (ref !== 'library-file' && ref !== 'project-file') throw bridgeFail('INDEX_REF_UNRESOLVED');
  const reg = config.page_registry && typeof config.page_registry === 'object' ? config.page_registry[role] : null;
  if (!reg || desc.page_id !== reg) throw bridgeFail('INDEX_REF_UNRESOLVED');
  // durable cache: exact role+generation+source digest (+ bytes) only
  const cached = cache ? cache[`${role}:${generation}:${desc.sha256}`] : null;
  if (cached && typeof cached === 'object' && cached.page_id === reg && cached.bytes === desc.bytes
    && typeof cached.reference === 'string' && cached.reference.length > 0) {
    try {
      const cand = await readRef(tools, config, reg, cached.reference);
      if (cand.sha256 === desc.sha256 && cand.byte_size === desc.bytes) return cand;
    } catch {
      /* stale cache entry: fall through to a fresh bounded resolution */
    }
  }
  const res = await raceTool(config, tools['mcp__codex_apps__chatgpt_space_read_page']({
    page_id: reg,
    search: [`${generation}.json`],
    context_blocks: 0,
  }), 'CYCLE_TOOL_TIMEOUT');
  // F04: read the ACTUAL nested read_page fields — selection completeness
  // lives under page.selection, canonical markdown under blocks[].markdown
  const page = res && typeof res === 'object' ? res.structuredContent : null;
  const sel = page && typeof page === 'object' && page.selection && typeof page.selection === 'object'
    ? page.selection : null;
  const blocks = page && typeof page === 'object' && page.content && typeof page.content === 'object'
    && Array.isArray(page.content.blocks) ? page.content.blocks : null;
  if (!page || !sel || sel.selection_complete !== true || !blocks || blocks.length > 16) {
    throw bridgeFail('INDEX_PAGE_LOOKUP_FAILED');
  }
  let md = '';
  for (const b of blocks) {
    if (b && typeof b === 'object' && typeof b.markdown === 'string') md += b.markdown;
  }
  if (utf8Len(md) > 262144) throw bridgeFail('INDEX_PAGE_LOOKUP_FAILED');
  const expected = `${generation}.json`;
  const seen = {};
  const targets = [];
  for (const link of parseMarkdownLinks(md)) {
    const label = String(link.label);
    const target = String(link.target);
    // EITHER full opaque scheme is a candidate — never a bare type-label target
    if (fullRefTarget(target) === null) continue;
    if (basenameOf(label) !== expected) continue;
    if (!seen[target]) {
      seen[target] = true;
      targets.push(target);
    }
  }
  if (targets.length === 0) throw bridgeFail('INDEX_REF_UNRESOLVED');
  if (targets.length > 4) throw bridgeFail('INDEX_REF_AMBIGUOUS');
  const matches = [];
  for (const target of targets) {
    try {
      const cand = await readRef(tools, config, reg, target);
      if (cand.sha256 === desc.sha256 && cand.byte_size === desc.bytes) matches.push(cand);
    } catch {
      /* unreadable candidate: not a match */
    }
  }
  if (matches.length === 0) throw bridgeFail('INDEX_REF_UNRESOLVED');
  if (matches.length > 1) throw bridgeFail('INDEX_REF_AMBIGUOUS');
  // persist the verified resolution durably BEFORE the page is ingested —
  // the cache the next cycle consults before any bounded search
  await runCli(tools, config, ['locator-resolved', '--producer-role', role, '--generation', generation,
    '--locator-sha256', desc.sha256, '--page-id', reg, '--reference', matches[0].reference,
    '--source-sha256', desc.sha256, '--bytes', String(desc.bytes)]);
  return matches[0];
}

// ---------------------------------------------------------------- index chain

// R03-SOURCE-REPLAY: consult the durable journal FIRST. An exactly-published
// identity short-circuits the whole upload (same path, zero appends, zero
// refetches). Otherwise each chunk carries its ORIGINAL logical offset — the
// sum of UTF-8 bytes of the preceding chunks of THIS text — regardless of the
// server's committed offset. A partial journal replays identical committed
// ranges as CLI no-ops; the server's returned offset NEVER repositions the
// chunk stream (that was the duplicate-append defect this replaces).
async function sourcePutAll(tools, config, id, text, expectedSha, expectedBytes) {
  const st = await runCli(tools, config, ['source-status', '--id', id, '--sha256', expectedSha, '--bytes', String(expectedBytes)]);
  if (st.published === true) return st;
  const chunks = chunkByBytes(text, CHUNK_BYTES);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const isFinal = i === chunks.length - 1;
    const args = ['source-put', '--id', id, '--offset', String(offset), '--chunk-json', JSON.stringify(chunks[i]), '--final', isFinal ? 'true' : 'false'];
    if (isFinal) {
      args.push('--sha256', expectedSha, '--bytes', String(expectedBytes));
    }
    const r = await runCli(tools, config, args);
    if (isFinal) return r; // {ok,path,sha256,bytes}
    offset += utf8Len(chunks[i]); // ORIGINAL logical offset — never r.offset
  }
  throw bridgeFail('SOURCE_EMPTY');
}

async function importIndexPage(tools, config, role, cursor, sc, desc) {
  const id = `ix-${role}-${desc.sha256.slice(0, 24)}`;
  const pub = await sourcePutAll(tools, config, id, sc.text, desc.sha256, desc.bytes);
  return runCli(tools, config, ['index-import', '--file', pub.path, '--producer-role', role, '--cursor', cursor, '--expected-index-sha256', desc.sha256]);
}

// Import pages of one generation under the page budget; returns whether the
// chain is still open (limit hit with a next descriptor).
async function followGeneration(tools, config, cache, role, generation, cursor, firstDesc, pageBudget, counters, manifestByEvent) {
  let desc = firstDesc;
  let used = 0;
  // BOUNDED-CYCLE: admission before EVERY page unit — a refused page leaves
  // the chain open (continuation next cycle), never a cursor advance
  while (desc && used < pageBudget && cycleAdmitData()) {
    // R03-SOURCE-REPLAY: consult the journal BEFORE any fetch. An exactly
    // published source short-circuits the whole page — no read_page_reference,
    // no source-put; re-ingesting the published page is an accepted no-op
    // accepted no-op (or completes a crash between publish and import).
    const statusId = `ix-${role}-${desc.sha256.slice(0, 24)}`;
    const st = await runCli(tools, config, ['source-status', '--id', statusId, '--sha256', desc.sha256, '--bytes', String(desc.bytes)]);
    if (st.published === true) {
      const r = await runCli(tools, config, ['index-import', '--file', st.path, '--producer-role', role, '--cursor', cursor, '--expected-index-sha256', desc.sha256]);
      used += 1;
      counters.sources += 1;
      // the next descriptor is unknown without re-fetching page text; an
      // open chain continues next cycle via plan.index_continuations
      return r.complete !== true;
    }
    const sc = await resolveIndexSource(tools, config, cache, role, generation, desc);
    await importIndexPage(tools, config, role, cursor, sc, desc);
    used += 1;
    counters.sources += 1;
    let pageObj = null;
    try { pageObj = JSON.parse(sc.text); } catch { pageObj = null; }
    if (pageObj && typeof pageObj === 'object' && Array.isArray(pageObj.items)) {
      for (const item of pageObj.items) {
        if (!item || typeof item !== 'object') continue;
        if (item.type === 'manifest' && item.manifest && typeof item.manifest === 'object' && typeof item.manifest.event_id === 'string') {
          manifestByEvent[item.manifest.event_id] = item.manifest;
        } else if (item.type === 'ack') {
          counters.acks += 1;
        }
      }
    }
    desc = pageObj && pageObj.next && typeof pageObj.next === 'object' ? pageObj.next : null;
  }
  return desc !== null;
}

// ---------------------------------------------------------------- artifact spool

async function uploadParts(tools, config, uploadId, explicit, parts, startOrdinal) {
  if (!explicit) {
    const p = parts[0];
    if (!p) throw bridgeFail('PART_MISSING');
    const sc = await readRef(tools, config, p.page_id, p.reference);
    if (sc.sha256 !== p.sha256 || sc.byte_size !== p.bytes) throw bridgeFail('PART_DESCRIPTOR_MISMATCH');
    for (const chunk of chunkByBytes(sc.text, CHUNK_BYTES)) {
      await runCli(tools, config, ['spool-append', '--upload-id', uploadId, '--chunk-json', JSON.stringify(chunk)]);
    }
    return;
  }
  for (const p of parts) {
    if (p.ordinal < startOrdinal) continue;
    await runCli(tools, config, ['spool-part-begin', '--upload-id', uploadId, '--ordinal', String(p.ordinal), '--sha256', p.sha256, '--bytes', String(p.bytes)]);
    const sc = await readRef(tools, config, p.page_id, p.reference);
    if (sc.sha256 !== p.sha256 || sc.byte_size !== p.bytes) throw bridgeFail('PART_DESCRIPTOR_MISMATCH');
    for (const chunk of chunkByBytes(sc.text, CHUNK_BYTES)) {
      await runCli(tools, config, ['spool-append', '--upload-id', uploadId, '--chunk-json', JSON.stringify(chunk)]);
    }
    await runCli(tools, config, ['spool-part-finish', '--upload-id', uploadId, '--ordinal', String(p.ordinal)]);
  }
}

async function spoolManifest(tools, config, m) {
  const begin = await runCli(tools, config, ['spool-begin', '--id', m.event_id, '--artifact-sha256', m.artifact_sha256, '--bytes', String(m.artifact_bytes)]);
  await uploadParts(tools, config, begin.upload_id, m.explicit_parts === true, m.parts ?? [], 0);
  await runCli(tools, config, ['spool-finish', '--upload-id', begin.upload_id, '--producer-role', m.producer_role]);
}

async function resumeUpload(tools, config, up) {
  if (!up.explicit_parts && up.current && up.current.appended > 0) {
    // the implicit part cannot be truncated from here — surface, never corrupt
    throw bridgeFail('SPOOL_RESUME_UNSUPPORTED');
  }
  await uploadParts(tools, config, up.upload_id, up.explicit_parts === true, up.parts ?? [], up.next_ordinal ?? 0);
  await runCli(tools, config, ['spool-finish', '--upload-id', up.upload_id, '--producer-role', up.producer_role]);
}

// ---------------------------------------------------------------- receipts

// Receipt bodies are tiny metadata JSON written through metadata-put (the
// body itself can never touch the filesystem).
async function putReceiptFile(tools, config, id, receiptObj) {
  const chunks = chunkByBytes(JSON.stringify(receiptObj), CHUNK_BYTES);
  let path = null;
  for (let i = 0; i < chunks.length; i++) {
    const r = await runCli(tools, config, ['metadata-put', '--id', id, '--chunk-json', JSON.stringify(chunks[i]), '--final', i === chunks.length - 1 ? 'true' : 'false']);
    path = r.path;
  }
  return path;
}

// ---------------------------------------------------------------- cycle

async function runBridge({ tools, config, emit }) {
  cycleInit(config);
  const counters = { sources: 0, deliveries: 0, acks: 0, executions: 0 };
  const blockers = [];
  let progressed = false;
  let continuation = false;
  const addBlocker = (code, eventId) => {
    const eid = eventId ?? null;
    if (blockers.length < 10 && !blockers.some((b) => b.code === code && b.event_id === eid)) {
      blockers.push({ code, event_id: eid });
    }
  };

  try {
    const st = await runCli(tools, config, ['status']);
    if (st.off === true) {
      const result = { version: 1, mode: 'HYBRID', state: 'OFF', counts: counters, blockers: [], continuation: false };
      emit(result);
      return result;
    }
    // RECOVERY-ADOPTION: a root pending external-recovery reconciliation is
    // closed to automatic work — no tick, no wait, no send. Only a committed
    // reconcile-external-recovery clears the flag; the cycle then resumes.
    if (st.recovery_import_pending === true) {
      const result = {
        version: 1, mode: 'HYBRID', state: 'RECOVERY_IMPORT_PENDING', counts: counters,
        blockers: [{ code: 'RECOVERY_IMPORT_PENDING', event_id: null }], continuation: false,
      };
      emit(result);
      return result;
    }
    await runCli(tools, config, ['tick']);
    const plan1 = await runCli(tools, config, ['plan']);
    for (const b of (plan1.blockers ?? [])) {
      if (b && typeof b.code === 'string') addBlocker(b.code, typeof b.event_id === 'string' ? b.event_id : null);
    }

    const roleByThread = {};
    for (const role of ROLES) {
      if (config.ids && config.ids[role]) roleByThread[config.ids[role]] = role;
    }
    const manifestByEvent = {};
    let pageBudget = Math.max(1, Math.floor(config.index_page_limit) || 1);
    // durable locator resolutions (role:generation:source-sha256 -> record)
    const locatorCache = {};
    for (const rec of (plan1.locator_resolutions ?? [])) {
      if (rec && typeof rec === 'object' && typeof rec.producer_role === 'string'
        && typeof rec.generation === 'string' && typeof rec.source_sha256 === 'string') {
        locatorCache[`${rec.producer_role}:${rec.generation}:${rec.source_sha256}`] = rec;
      }
    }

    // 1. resume open index chains first (oldest generation wins)
    for (const cont of (plan1.index_continuations ?? [])) {
      if (!cont || !cont.next_descriptor || pageBudget <= 0 || !cycleAdmitData()) { continuation = true; continue; }
      try {
        const before = counters.sources;
        const open = await followGeneration(tools, config, locatorCache, cont.producer_role, cont.generation, cont.snapshot_cursor, cont.next_descriptor, pageBudget, counters, manifestByEvent);
        // BOUNDED-CYCLE: subtract only THIS call's page delta — the cumulative
        // counter over-charged later roles at small limits (starvation defect)
        pageBudget -= counters.sources - before;
        if (open) continuation = true;
      } catch (e) {
        addBlocker(codeOf(e), cont.generation);
      }
    }

    // 2. ONE wait_threads with role targets and durably committed cursors
    const wq = await waitOnce(tools, config, plan1.committed_cursors ?? {});
    if (!wq.ok) addBlocker('WAIT_TOOL_FAILED', null);
    for (const poll of wq.polls) {
      const fin = protocolFinal(poll);
      if (!fin) continue; // chatter / non-final phases are not protocol input
      const role = roleByThread[fin.threadId];
      if (!role) continue;
      if (typeof fin.cursor !== 'string' || fin.cursor.length === 0) continue;
      const loc = parseLocator(fin.text, role, config);
      if (!loc) {
        addBlocker('WAIT_PROTOCOL', null);
        continue;
      }
      if (loc.status === 'BLOCKED') {
        addBlocker('PRODUCER_BLOCKED', null);
        continue;
      }
      if (loc.status !== 'READY') continue;
      if (pageBudget <= 0 || !cycleAdmitData()) { continuation = true; continue; }
      try {
        const before = counters.sources;
        const open = await followGeneration(tools, config, locatorCache, role, loc.generation, fin.cursor, loc.index, pageBudget, counters, manifestByEvent);
        pageBudget -= counters.sources - before; // per-call delta (BOUNDED-CYCLE)
        if (open) continuation = true;
      } catch (e) {
        addBlocker(codeOf(e), loc.generation);
      }
    }

    // 3. resume older partial spool uploads (crashed uploader state)
    for (const up of (plan1.pending_uploads ?? [])) {
      if (!up || !up.upload_id) continue;
      if (!cycleAdmitData()) { continuation = true; continue; }
      try {
        await resumeUpload(tools, config, up);
        progressed = true;
      } catch (e) {
        addBlocker(codeOf(e), up.event_id ?? null);
      }
    }

    // 4. fresh manifests -> verified spool -> immutable object + ingest
    const plan2 = await runCli(tools, config, ['plan']);
    for (const m of (plan2.manifests ?? [])) {
      if (!m || typeof m.event_id !== 'string') continue;
      if (!cycleAdmitData()) { continuation = true; continue; }
      try {
        await spoolManifest(tools, config, m);
        progressed = true;
      } catch (e) {
        addBlocker(codeOf(e), m.event_id);
      }
    }

    // 5. deliveries + imported-receipt notifications (claim-first sends).
    // BOUNDED-CYCLE: ONE shared send cap — pending receipt sends count
    // against event_limit exactly like delivery sends, so a receipt backlog
    // can never ride free past the cap.
    const plan3 = await runCli(tools, config, ['plan']);
    const sendCap = Math.max(1, Math.floor(config.event_limit) || 1);
    let sends = 0;
    for (const d of (plan3.deliveries ?? [])) {
      if (!d || typeof d.delivery_id !== 'string') continue;
      if (!cycleAdmitData() || sends >= sendCap) { continuation = true; break; }
      sends += 1;
      try {
        const claim = await runCli(tools, config, ['delivery-claim', '--id', d.delivery_id]);
        const prompt = typeof claim.manifest === 'string' && claim.manifest.length > 0
          ? claim.manifest
          : JSON.stringify({ version: 1, event_id: d.event_id, artifact: { page_id: claim.source_page_id, reference: claim.source_reference, sha256: claim.artifact_sha256 } });
        const sent = await sendOnce(tools, config, d.destination, prompt);
        const rcptPath = await putReceiptFile(tools, config, `rcpt-${d.delivery_id}`, { tool: 'send_message_to_thread', ok: sent.ok });
        await runCli(tools, config, ['delivery-receipt', '--id', d.delivery_id, '--status', sent.ok ? 'sent' : 'uncertain', '--receipt-file', rcptPath]);
        if (sent.ok) {
          counters.deliveries += 1;
          progressed = true;
        } else {
          addBlocker('SEND_UNCERTAIN', d.event_id);
        }
      } catch (e) {
        addBlocker(codeOf(e), d.event_id);
      }
    }
    for (const r of (plan3.pending_receipts ?? [])) {
      if (!r || typeof r.receipt_id !== 'string') continue;
      if (!cycleAdmitData() || sends >= sendCap) { continuation = true; break; }
      sends += 1;
      try {
        const claim = await runCli(tools, config, ['receipt-claim', '--id', r.receipt_id]);
        const sent = await sendOnce(tools, config, r.destination, claim.prompt);
        const rcptPath = await putReceiptFile(tools, config, `rcpt-${r.receipt_id}`, { tool: 'send_message_to_thread', ok: sent.ok });
        await runCli(tools, config, ['receipt-outcome', '--id', r.receipt_id, '--status', sent.ok ? 'sent' : 'uncertain', '--receipt-file', rcptPath]);
        if (!sent.ok) addBlocker('SEND_UNCERTAIN', r.receipt_id);
      } catch (e) {
        addBlocker(codeOf(e), r.receipt_id);
      }
    }

    // 6. continuation: durable work still pending after this cycle's budget.
    // Past the FULL budget there is no room even for this metadata call —
    // every refusal above already flagged continuation; the next cycle (with
    // its own fresh budget) re-derives the pending set from durable state.
    if (cycleRemaining() > 0) {
      const plan4 = await runCli(tools, config, ['plan']);
      if ((plan4.index_continuations ?? []).length > 0
        || (plan4.manifests ?? []).length > 0
        || (plan4.delivery_ids ?? 0) > 0
        || (plan4.pending_receipts ?? []).length > 0) {
        continuation = true;
      }
    } else {
      continuation = true;
    }

    const didWork = progressed || counters.sources > 0 || counters.acks > 0 || counters.deliveries > 0;
    const result = {
      version: 1,
      mode: 'HYBRID',
      state: didWork ? 'PROGRESSED' : (blockers.length > 0 ? 'WAIT' : 'IDLE'),
      counts: counters,
      blockers,
      continuation,
    };
    emit(result);
    return result;
  } catch {
    const result = { version: 1, mode: 'HYBRID', state: 'BLOCKED', counts: counters, blockers: [{ code: 'BRIDGE_EXCEPTION', event_id: null }], continuation: false };
    emit(result);
    return result;
  }
}

return await runBridge({tools,config,emit});
