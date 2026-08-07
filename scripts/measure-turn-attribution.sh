#!/usr/bin/env bash
# measure-turn-attribution.sh — per-turn token attribution over the host CC transcript corpus.
#
# SSOT HAND-OVER (binding provenance):
#   This script is the SINGLE SOURCE OF TRUTH for per-turn cost numbers. It was promoted,
#   read-only, from the aggregator snippet inlined at
#     .claude/orchestrator-prompts/token-economy-research-s-a/kickoff.md
#   section "§2.7 Reproduction — the full aggregator".
#   That kickoff is a HISTORICAL RECORD and is NOT edited by this promotion (Artifact
#   Ownership Contract, CLAUDE.md). Note the full path above: two different umbrellas own an
#   "S-A" stage — `token-economy-research-s-a/` (holds the seed) and
#   `arch-v2-context-pipeline-s-a/` (does not). From this commit forward, per-turn numbers are
#   re-derived by running THIS script; the §2.7 snippet is superseded as SSOT.
#
# WHY THE SEED COULD NOT BE PROMOTED VERBATIM:
#   The seed's corpus find carried `-maxdepth 2`, which selects only session-root transcripts
#   and silently excludes the entire `<session>/subagents/**` population. The per-subagent arm
#   of the bootstrap-injector cost line (§9) is unmeasurable under that find. This script drops
#   `-maxdepth 2` and reports the two populations SEPARATELY.
#
# DENOMINATOR TAG — [H], AND IT IS NOT CONVERTIBLE TO [W]:
#   Every percentage this script prints is weighted over the corpus it just enumerated —
#   BOTH populations, session-root plus subagent. The token-economy spec
#   (docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md, "Denominator
#   convention (binding)") declares three tags, "none convertible": [W] is the re-priced
#   169-session corpus (WRITE 43.1%), [D] the stage-A accounted subset, [A] the always-on doc
#   bill. This script measures NONE of those — it measures [H], the live host corpus
#   (WRITE ~35%). Do NOT read a share printed here as a [W] share, and do not adjudicate a
#   [W]-defined threshold (e.g. the N1 retirement falsifier, spec row N1) against it without
#   saying which denominator you used. An untagged percentage is a defect per that convention.
#
# HOST-ONLY: reads `~/.claude/projects/**/*.jsonl`. That path does not exist in the aif
#   container (it mounts `claude-auth` as a named volume, not the host `~/.claude`), so this
#   script cannot run there. It reads per-turn BILLING METADATA and tool names/sizes only —
#   never message content.
#
# EXIT STATUS: 0 on a real run; non-zero on an empty corpus, a missing dependency, or a
#   population count of zero. An empty run must FAIL LOUDLY rather than emit empty tables —
#   the seed was an unguarded pipeline whose last element was a `sort`, so an empty run
#   exited 0 and was indistinguishable from a real one.
#
# ENV OVERRIDES (for reuse and for exercising the empty-corpus guard):
#   CORPUS_ROOT    default ~/.claude/projects
#   PROJECT_MATCH  default *rules-as-tests-aif*   (path glob selecting the project's dirs)
#   REPO_ROOT      default: git toplevel of this script's checkout (for §8/§9 hook probes)

set -euo pipefail

CORPUS_ROOT="${CORPUS_ROOT:-$HOME/.claude/projects}"
PROJECT_MATCH="${PROJECT_MATCH:-*rules-as-tests-aif*}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

# Price multipliers relative to base input price (Anthropic published prompt-caching pricing:
# cache write 1.25x, cache read 0.1x; output/input ratio 5x). Same constants as the seed's
# §2.2 headline table — stated here so the weighting is auditable, not implicit.
MULT_CACHE_WRITE=1.25
MULT_CACHE_READ=0.1
MULT_OUTPUT=5
# Bytes-per-token BAND, not a constant (S-L, 2026-08-07). The seed's flat "4 B ~= 1 token" (§W1)
# is falsified twice over: S-H measured 2.37-3.32 B/tok across seven resident files, and S-L
# measured 1.835 (dense ASCII pipe-table) to 3.416 (Cyrillic-rich listing) — a content-type-driven
# spread no single number represents. Substituting one measured aggregate (e.g. 2.62) for the 4
# would reproduce the same defect at a new value, so this script reports a RANGE and every derived
# figure states its direction of error.
#
# Unit: BYTES. This script's inputs are `wc -c` byte counts, so the byte band applies. A
# transcript/JSON channel counts codepoints and must use the codepoint band (1.835-3.128) instead
# — the two are NOT interchangeable for non-ASCII text (measured: 1.135 bytes/codepoint on the
# skill listing). See docs/meta-factory/research-patches/2026-08-07-s-l-recalculation.md §1.
BYTES_PER_TOKEN_LO=1.835   # dense ASCII table — the FEWEST bytes per token, so the MOST tokens
BYTES_PER_TOKEN_HI=3.416   # Cyrillic-rich listing — the MOST bytes per token, so the FEWEST tokens

for dep in jq awk find xargs grep; do
  command -v "$dep" >/dev/null 2>&1 || { echo "FATAL: missing dependency: $dep" >&2; exit 2; }
done
[ -d "$CORPUS_ROOT" ] || { echo "FATAL: corpus root not found: $CORPUS_ROOT" >&2; exit 2; }

TMPD="$(mktemp -d)"
trap 'rm -rf "$TMPD"' EXIT

# ---------------------------------------------------------------------------
# §0 Corpus enumeration — two populations, reported separately.
# ---------------------------------------------------------------------------
find "$CORPUS_ROOT" -path "$PROJECT_MATCH" -name '*.jsonl' -not -path '*/subagents/*' -print0 \
  > "$TMPD/session.z" 2>/dev/null || true
find "$CORPUS_ROOT" -path "$PROJECT_MATCH" -name '*.jsonl' -path '*/subagents/*' -print0 \
  > "$TMPD/subagent.z" 2>/dev/null || true

count_z() { tr -dc '\0' < "$1" | wc -c | tr -d ' '; }
N_SESSION="$(count_z "$TMPD/session.z")"
N_SUBAGENT="$(count_z "$TMPD/subagent.z")"

echo "=== §0 CORPUS ==="
echo "CORPUS-ROOT: $CORPUS_ROOT"
echo "PROJECT-MATCH: $PROJECT_MATCH"
echo "MEASURED-AT: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "SESSION-TRANSCRIPTS: $N_SESSION"
echo "SUBAGENT-TRANSCRIPTS: $N_SUBAGENT"
echo "TOTAL-TRANSCRIPTS: $((N_SESSION + N_SUBAGENT))"

if [ "$N_SESSION" -eq 0 ] || [ "$N_SUBAGENT" -eq 0 ]; then
  echo "FATAL: empty corpus population (session=$N_SESSION subagent=$N_SUBAGENT)." >&2
  echo "       A zero population is a failed run, not a finding about subagents." >&2
  exit 3
fi
if [ "$N_SESSION" -eq "$N_SUBAGENT" ]; then
  echo "FATAL: the two populations are equal ($N_SESSION) — the find is not discriminating." >&2
  exit 3
fi

# ---------------------------------------------------------------------------
# One expensive tagged pass over the corpus -> $TMPD/stream.ndjson.
#   t=A assistant turn with billing   t=U tool_use   t=R tool_result
#   t=C /compact boundary marker
# Everything downstream re-reads this cheap stream.
# ---------------------------------------------------------------------------
emit_stream() { # $1 NUL-list  $2 population label
  # shellcheck disable=SC2016  # the single-quoted body is a jq program; $pop is a jq variable
  xargs -0 jq -c --arg pop "$2" '
    input_filename as $f
    | ( if (.type == "assistant" and (.message.usage != null)) then
          { t:"A", pop:$pop, f:$f,
            ep:( try ((.timestamp // "") | sub("\\.[0-9]+Z$";"Z") | fromdateiso8601) catch 0 ),
            md:(.message.model // "unknown"),
            ver:(.version // "unknown"),
            eff:((.effort // "none") | tostring),
            spd:((.message.usage.speed // "none") | tostring),
            i:(.message.usage.input_tokens // 0),
            cw:(.message.usage.cache_creation_input_tokens // 0),
            cr:(.message.usage.cache_read_input_tokens // 0),
            o:(.message.usage.output_tokens // 0),
            c5:(.message.usage.cache_creation.ephemeral_5m_input_tokens // 0),
            c1:(.message.usage.cache_creation.ephemeral_1h_input_tokens // 0) }
        else empty end ),
      ( if (.type == "assistant") then
          (.message.content[]? | select(.type == "tool_use") | { t:"U", pop:$pop, f:$f, id:.id, n:.name })
        else empty end ),
      ( if (.type == "user") then
          (.message.content[]? | select(.type == "tool_result")
           | { t:"R", pop:$pop, f:$f, id:.tool_use_id, len:((.content | tostring) | length) })
        else empty end ),
      ( if (.type == "system" and .subtype == "compact_boundary") then { t:"C", pop:$pop, f:$f } else empty end ),
      # Hook-execution records. CC writes one `attachment` record per hook INVOCATION,
      # carrying the hook command, its event, and the text it emitted. This is the exact
      # firing channel for §8/§9 — strictly better than grepping for an injected marker,
      # which double-counts (the same injection is recorded in BOTH .content and .stdout,
      # each carrying an open AND a close marker => 4 text hits per single firing).
      ( if (.type == "attachment" and (.attachment.command != null)) then
          { t:"H", pop:$pop, f:$f,
            id:((.attachment.hookEvent // "") | tostring),
            # scan() lifts the script filename straight out of the command line, so there is
            # no surrounding quote to strip — deliberate: a literal apostrophe here would
            # close the single-quoted shell string that wraps this jq program.
            n:(((.attachment.command // "") | [scan("[A-Za-z0-9._-]+[.](?:sh|cmd|mjs|js|py)")] | last) // "unknown"),
            # utf8bytelength, NOT length: in jq, `length` on a string counts CODEPOINTS, and
            # this field is reported downstream as "stdout-bytes" / "injected-bytes" and
            # converted through the BYTE band (see the unit rule at the top of this file).
            # Using `length` here under-counted non-ASCII hook output by ~13.5% and made the
            # section-9 table cross-unit-incomparable with the live `wc -c` probe below.
            # NOTE: no apostrophes in this comment — it lives inside a single-quoted jq program.
            len:(((.attachment.stdout // "") | utf8bytelength)) }
        else empty end )
  ' < "$1" 2>/dev/null || true
}

: > "$TMPD/stream.ndjson"
emit_stream "$TMPD/session.z"  session  >> "$TMPD/stream.ndjson"
emit_stream "$TMPD/subagent.z" subagent >> "$TMPD/stream.ndjson"

STREAM_RECS="$(wc -l < "$TMPD/stream.ndjson" | tr -d ' ')"
if [ "$STREAM_RECS" -eq 0 ]; then
  echo "FATAL: corpus enumerated $((N_SESSION + N_SUBAGENT)) files but yielded 0 parsed records." >&2
  exit 3
fi
echo "STREAM-RECORDS: $STREAM_RECS"

# Flatten to TSV once; every awk section below reads this.
jq -r '[.t,.pop,.f,(.ep//0),(.md//""),(.ver//""),(.eff//""),(.i//0),(.cw//0),(.cr//0),(.o//0),(.c5//0),(.c1//0),(.id//""),(.n//""),(.len//0),(.spd//"")] | @tsv' \
  < "$TMPD/stream.ndjson" > "$TMPD/stream.tsv"

# TSV columns: 1=t 2=pop 3=file 4=epoch 5=model 6=version 7=effort
#              8=input 9=cache_write 10=cache_read 11=output 12=c5m 13=c1h
#              14=id 15=toolname 16=resultlen 17=speed

# ---------------------------------------------------------------------------
# §1 Billing categories — raw and price-weighted (seed §2.1 / §2.2 reproduced).
# ---------------------------------------------------------------------------
echo
echo "=== §1 BILLING CATEGORIES (per population) ==="
awk -F'\t' -v mw="$MULT_CACHE_WRITE" -v mr="$MULT_CACHE_READ" -v mo="$MULT_OUTPUT" '
  $1=="A" { p=$2; turns[p]++; inp[p]+=$8; cwr[p]+=$9; crd[p]+=$10; out[p]+=$11 }
  END {
    printf "%-10s %10s %16s %16s %18s %16s\n","population","turns","uncached-in","cache-WRITE","cache-READ","output"
    for (p in turns)
      printf "%-10s %10d %16d %16d %18d %16d\n", p, turns[p], inp[p], cwr[p], crd[p], out[p]
    ti=0; tw=0; tr=0; to=0; tt=0
    for (p in turns) { ti+=inp[p]; tw+=cwr[p]; tr+=crd[p]; to+=out[p]; tt+=turns[p] }
    printf "%-10s %10d %16d %16d %18d %16d\n","ALL",tt,ti,tw,tr,to
    wi=ti*1; ww=tw*mw; wr=tr*mr; wo=to*mo; W=wi+ww+wr+wo
    raw=ti+tw+tr+to
    print ""
    print "-- price-weighted (cache-write " mw "x, cache-read " mr "x, output " mo "x) --"
    printf "%-14s %18s %10s\n","category","weighted-units","cost-share"
    if (W>0) {
      printf "%-14s %18.0f %9.1f%%\n","cache READ",wr,100*wr/W
      printf "%-14s %18.0f %9.1f%%\n","cache WRITE",ww,100*ww/W
      printf "%-14s %18.0f %9.1f%%\n","output",wo,100*wo/W
      printf "%-14s %18.0f %9.1f%%\n","uncached input",wi,100*wi/W
      printf "%-14s %18.0f %9.1f%%\n","TOTAL",W,100.0
      printf "RAW-TOKENS-TOTAL: %d\n", raw
      printf "DENOMINATOR-TAG: [H] = this two-population host corpus, price-weighted. NOT [W].\n"
      printf "WRITE-LINE-SHARE: %.1f%%   (the [H] denominator §6 sizes trigger classes against)\n", 100*ww/W
    }
  }' "$TMPD/stream.tsv"

# ---------------------------------------------------------------------------
# §2 Per-model split (seed §2.4) — the seat-class key §9 joins on.
# ---------------------------------------------------------------------------
echo
echo "=== §2 PER-MODEL SPLIT ==="
awk -F'\t' '
  $1=="A" { k=$2"\t"$5; t[k]++; raw[k]+=$8+$9+$10+$11 }
  END {
    printf "%-10s %-24s %10s %18s\n","population","model","turns","raw-tokens"
    for (k in t) { split(k,a,"\t"); printf "%-10s %-24s %10d %18d\n", a[1], a[2], t[k], raw[k] }
  }' "$TMPD/stream.tsv" | { read -r h; echo "$h"; sort -k4 -rn; }

# ---------------------------------------------------------------------------
# §3 Turn-count distribution — the residency multiplier (seed §2.3).
# ---------------------------------------------------------------------------
echo
echo "=== §3 TURN-COUNT DISTRIBUTION + RESIDENCY MULTIPLIER ==="
for pop in session subagent; do
  awk -F'\t' -v P="$pop" '$1=="A" && $2==P { c[$3]++ } END { for (f in c) print c[f] }' \
    "$TMPD/stream.tsv" | sort -n > "$TMPD/turns.$pop"
  awk -v P="$pop" -v mr="$MULT_CACHE_READ" '
    { v[NR]=$1; s+=$1 }
    END {
      if (NR==0) { print P": no sessions" }
      else {
        med = (NR%2) ? v[(NR+1)/2] : int((v[int(NR/2)]+v[int(NR/2)+1])/2)
        pi = int(0.9*NR); if (pi<1) pi=1
        p90 = v[pi]
        printf "%-9s sessions=%-6d median=%-6d p90=%-6d max=%-6d total-turns=%d\n", P, NR, med, p90, v[NR], s
        printf "%-9s residency multiplier: median %.1fx  p90 %.1fx  max %.1fx  (token resident from turn 1, re-billed at %sx)\n", \
               P, 1+(med-1)*mr, 1+(p90-1)*mr, 1+(v[NR]-1)*mr, mr
      }
    }' "$TMPD/turns.$pop"
done

# ---------------------------------------------------------------------------
# §4 Tool-call frequency (seed §2.5).
# ---------------------------------------------------------------------------
echo
echo "=== §4 TOOL-CALL FREQUENCY (top 15, all populations) ==="
awk -F'\t' '$1=="U" { c[$15]++ } END { for (n in c) printf "%10d  %s\n", c[n], n }' \
  "$TMPD/stream.tsv" | sort -rn | head -15
echo "TOOL-KINDS-TOTAL: $(awk -F'\t' '$1=="U"{print $15}' "$TMPD/stream.tsv" | sort -u | wc -l | tr -d ' ')"

# ---------------------------------------------------------------------------
# §5 Tool-result payload returned INTO context (seed §2.6).
# ---------------------------------------------------------------------------
echo
echo "=== §5 TOOL-RESULT PAYLOAD INTO CONTEXT (top 10 by chars) ==="
awk -F'\t' '
  $1=="U" { name[$14]=$15 }
  $1=="R" { n=(name[$14]!=""?name[$14]:"unknown"); r[n]++; ch[n]+=$16; if ($16>mx[n]) mx[n]=$16; TOT+=$16 }
  END {
    printf "%-34s %9s %16s %12s %9s\n","tool","results","total-chars","max-chars","share"
    for (n in r) printf "%-34s %9d %16d %12d %8.1f%%\n", n, r[n], ch[n], mx[n], (TOT?100*ch[n]/TOT:0)
    printf "TOOL-RESULT-CHARS-TOTAL: %d\n", TOT
  }' "$TMPD/stream.tsv" | { read -r h; echo "$h"; sort -k3 -rn | head -11; }

# ---------------------------------------------------------------------------
# §6 PER-TURN RE-WRITE TRIGGER CLASSES  [extension beyond the seed]
#
# A turn billing `cache_read_input_tokens == 0` while writing cache had NO cache hit at all:
# the whole prefix was re-written. That is a binary, threshold-free discriminator. The
# non-first COLD-PREFIX turns are then sub-classified by the idle gap that preceded them,
# against the two cache TTLs the corpus actually purchases (see §6b for which TTL is in use).
#
# HONESTY BOUND: "resume" and "long idle" are the SAME billing event at this layer — a cold
# prefix after a gap. The transcript cannot separate operator-resume from idle-expiry, so the
# gap-classified rows are reported as one class and NOT split into a fabricated resume row.
# ---------------------------------------------------------------------------
echo
echo "=== §6 PER-TURN RE-WRITE TRIGGER CLASSES ==="
awk -F'\t' '
  $1=="A" {
    f=$3
    n[f]++
    gap = (last_ep[f]>0 && $4>0) ? $4-last_ep[f] : -1
    cls = ""
    if (n[f]==1)            cls="1 SESSION-OPEN (unavoidable first write)"
    else if ($10==0 && $9>0) {
      if (gap < 0)          cls="2 COLD-PREFIX / gap-unknown"
      else if (gap >= 3600) cls="3 COLD-PREFIX / idle>=1h  (1h-TTL expiry or resume)"
      else if (gap >= 300)  cls="4 COLD-PREFIX / idle 5m-1h (5m-TTL expiry; 1h TTL would have held)"
      else                  cls="5 COLD-PREFIX / idle<5m   (compact / config-change / eviction)"
    }
    else if ($9>0)          cls="6 INCREMENTAL-WRITE (turn delta only)"
    else                    cls="7 PURE-READ (no write)"
    c[cls]++; w[cls]+=$9; T++; TW+=$9
    last_ep[f]=$4
  }
  END {
    printf "%-52s %9s %8s %16s %9s\n","trigger class","turns","turn-%","cache-WRITE-tok","%-of-[H]"
    for (k in c) printf "%-52s %9d %7.1f%% %16d %8.1f%%\n", substr(k,3), c[k], (T?100*c[k]/T:0), w[k], (TW?100*w[k]/TW:0)
    printf "%-52s %9d %7.1f%% %16d %8.1f%%\n","TOTAL",T,100.0,TW,100.0
  }' "$TMPD/stream.tsv" | { read -r h; echo "$h"; sort; }

echo
echo "-- §6b cache TTL actually purchased (ephemeral_5m vs ephemeral_1h write tokens) --"
awk -F'\t' '$1=="A" { c5+=$12; c1+=$13; n5+=($12>0?1:0); n1+=($13>0?1:0) }
  END { t=c5+c1
        printf "5m-TTL writes: %d turns, %d tokens (%.1f%%)\n", n5, c5, (t?100*c5/t:0)
        printf "1h-TTL writes: %d turns, %d tokens (%.1f%%)\n", n1, c1, (t?100*c1/t:0) }' "$TMPD/stream.tsv"

echo
echo "-- §6c /compact boundaries observed (subtype=compact_boundary) --"
awk -F'\t' '$1=="C" { c[$2]++ } END { for (p in c) printf "%-10s %d\n", p, c[p]; }' "$TMPD/stream.tsv"
echo "compact-boundary-total: $(awk -F'\t' '$1=="C"' "$TMPD/stream.tsv" | wc -l | tr -d ' ')"

echo
echo "-- §6d config-change events (mid-session switch of a cache-invalidating setting) --"
# Primary-doc grounding (platform.claude.com /docs/en/docs/build-with-claude/prompt-caching,
# fetched 2026-08-07). The cache follows the hierarchy tools -> system -> messages; a change at
# a level invalidates that level and all later ones. Verbatim, per setting:
#   effort  — "Changing the output_config.effort value always invalidates message blocks"
#   speed   — "Switching between speed: \"fast\" and standard speed invalidates system and
#              message caches"
#   tools   — "Modifying tool definitions (names, descriptions, parameters) invalidates the
#              entire cache"   <- this is the MCP-server-toggle mechanism
# effort and speed are recorded per turn, so those two sub-classes are MEASURED below.
# Model and CC-version switches are recorded too and are reported, but the doc list above does
# NOT name them, so they are labelled observed-not-doc-confirmed rather than priced as causes.
# MCP toggles change tool definitions but are not recorded per turn -> UNMEASURED.
# A transition is counted ONLY between two RECORDED, different values. Counting a
# recorded<->absent transition would measure the harness omitting a field, not the operator
# changing a setting: `message.usage.speed` for instance only ever holds "standard" or null in
# this corpus, so the naive form reported ~19.8k "speed switches" where the true count is 0.
awk -F'\t' '
  function real(v) { return (v != "" && v != "none" && v != "null" && v != "unknown" && v != "<synthetic>") }
  $1=="A" {
    f=$3
    if (real($5)) { if (real(lm[f]) && $5 != lm[f]) { mc++; if ($10==0) mc_cold++ } lm[f]=$5 }
    if (real($6)) { if (real(lv[f]) && $6 != lv[f]) { vc++; if ($10==0) vc_cold++ } lv[f]=$6 }
    if (real($7)) { if (real(le[f]) && $7 != le[f]) { ec++; if ($10==0) ec_cold++ } le[f]=$7 }
    if (real($17)){ if (real(ls[f]) && $17 != ls[f]){ sc++; if ($10==0) sc_cold++ } ls[f]=$17 }
  }
  END {
    printf "CITED    effort switches:  %6d  (of which the switch turn was cold-prefix: %d)\n", ec, ec_cold
    printf "CITED    speed switches:   %6d  (of which cold-prefix: %d)\n", sc, sc_cold
    printf "OBSERVED model switches:   %6d  (of which cold-prefix: %d)  [cause not named in the doc list]\n", mc, mc_cold
    printf "OBSERVED version switches: %6d  (of which cold-prefix: %d)  [cause not named in the doc list]\n", vc, vc_cold
    print  "UNMEASURED mcp-toggle: channel absent (changes tool definitions per the doc, but is not recorded per turn)"
  }' "$TMPD/stream.tsv"

# ---------------------------------------------------------------------------
# §7 ARRIVAL-POSITION DISTRIBUTION OF TOOL OUTPUT  [extension beyond the seed]
#
# Replaces the seed's W3 "uniform arrival -> mean residency ~ N/2" ASSUMPTION with a
# measurement. A payload arriving at turn t of an N-turn session is re-billed (N - t) times.
# ---------------------------------------------------------------------------
echo
echo "=== §7 TOOL-OUTPUT ARRIVAL POSITION (measured, replaces the uniform-arrival assumption) ==="
awk -F'\t' '
  # pass-equivalent: file order is preserved in the stream, so count A-turns as we go and
  # attribute each R to the count of A-turns already seen in that file.
  $1=="A" { seenA[$3]++; totA[$3]=seenA[$3] }
  $1=="R" { pos[NR]=seenA[$3]; file[NR]=$3; len[NR]=$16; keep[NR]=1 }
  END {
    for (i in keep) {
      N=totA[file[i]]; if (N<1) continue
      frac = pos[i]/N
      b = int(frac*10); if (b>9) b=9; if (b<0) b=0
      cnt[b]++; ch[b]+=len[i]
      residual = N - pos[i]
      wsum += len[i]*residual; lsum += len[i]; rsum += residual; k++
      usum += len[i]*(N/2)   # what the seed uniform-arrival model would have predicted
    }
    print "decile of session (0 = first 10% of turns, 9 = last 10%):"
    printf "%-8s %10s %16s %9s\n","decile","results","chars","char-%"
    tot=0; for (b=0;b<10;b++) tot+=ch[b]
    for (b=0;b<10;b++) printf "%-8d %10d %16d %8.1f%%\n", b, cnt[b], ch[b], (tot?100*ch[b]/tot:0)
    if (k>0) {
      meas = (lsum ? wsum/lsum : 0)
      unif = (lsum ? usum/lsum : 0)
      printf "mean residual turns after arrival (unweighted):        %.1f\n", rsum/k
      printf "char-weighted mean residual turns, MEASURED:           %.1f\n", meas
      printf "char-weighted mean residual turns, UNIFORM assumption: %.1f   (the seed W3 model: N/2)\n", unif
      if (unif>0)
        printf "MEASURED/UNIFORM = %.2fx -> the seed uniform-arrival model %s tool-output residency.\n", \
               meas/unif, (meas>unif ? "UNDERSTATES" : "OVERSTATES")
    }
  }' "$TMPD/stream.tsv"

# ---------------------------------------------------------------------------
# §8 HOOK INJECTION FIRING RATES  [extension beyond the seed]
#
# Channel: CC writes one `attachment` record per hook INVOCATION, carrying the hook's command
# and the text it emitted. Firing counts and injected byte volume are therefore read straight
# off the corpus rather than inferred from an injected marker.
# `.claude/hooks/inject-matching-rule.sh` (edit-time rule delivery) caches per session, so a
# given rule injects at most once per session; one firing emits one line per MATCHED rule.
# ---------------------------------------------------------------------------
echo
echo "=== §8 HOOK INJECTION FIRING RATES ==="
cat "$TMPD/session.z" "$TMPD/subagent.z" > "$TMPD/all.z"
echo "-- every hook that emitted output, by script (firings + bytes it put into context) --"
awk -F'\t' -v ns="$N_SESSION" -v nb="$N_SUBAGENT" '
  $1=="H" { k=$2"\t"$15; c[k]++; b[k]+=$16 }
  END {
    printf "%-10s %-34s %8s %14s %10s %12s\n","population","hook script","firings","stdout-bytes","mean-B","per-transcript"
    for (k in c) { split(k,a,"\t"); t=(a[1]=="session"?ns:nb)
      printf "%-10s %-34s %8d %14d %10d %12.2f\n", a[1], a[2], c[k], b[k], b[k]/c[k], (t?c[k]/t:0) }
  }' "$TMPD/stream.tsv" | { read -r h; echo "$h"; sort -k4 -rn; }

echo
echo "-- edit-time rule injection (inject-matching-rule.sh) --"
awk -F'\t' -v ns="$N_SESSION" -v nb="$N_SUBAGENT" '
  $1=="H" && $15 ~ /inject-matching-rule/ { c[$2]++; b[$2]+=$16; if (!seen[$2"\t"$3]++) tf[$2]++ }
  END {
    for (p in c) { t=(p=="session"?ns:nb)
      printf "%-9s firings=%-6d transcripts-with-a-firing=%-5d of %-5d (%.1f%% of transcripts; %.2f firings/transcript; %d B injected)\n", \
             p, c[p], tf[p], t, (t?100*tf[p]/t:0), (t?c[p]/t:0), b[p] }
    if (length(c)==0) print "no firings observed"
  }' "$TMPD/stream.tsv"
echo "   (one firing injects one line PER MATCHED RULE, so rule-line count > firing count)"
echo "-- which rules fire (rule-line occurrences, all populations, top 12) --"
{ xargs -0 grep -oh 'see \.claude/rules/[a-z0-9-]*\.md' < "$TMPD/all.z" 2>/dev/null || true; } \
  | sed 's|see \.claude/rules/||; s|\.md$||' | sort | uniq -c | sort -rn | head -12

# ---------------------------------------------------------------------------
# §9 BOOTSTRAP-INJECTOR COST LINE (spec 2026-08-06 §1.6 FORK E)  [extension beyond the seed]
#
# Two DISTINCT hooks, two seat classes:
#   UserPromptSubmit -> .claude/hooks/inject-session-bootstrap.sh   (fires per PROMPT)
#   SubagentStart    -> .claude/hooks/inject-subagent-digest.sh     (fires per SUBAGENT spawn)
# Per-invocation size is MEASURED LIVE here (not carried from a prior doc), then multiplied by
# the firing count observed in the corpus. There is no session cache in either hook, so every
# firing is a fresh injection.
# ---------------------------------------------------------------------------
echo
echo "=== §9 BOOTSTRAP-INJECTOR COST LINE (FORK E) ==="
BOOT_HOOK="$REPO_ROOT/.claude/hooks/inject-session-bootstrap.sh"
SUBA_HOOK="$REPO_ROOT/.claude/hooks/inject-subagent-digest.sh"
probe_hook() { # $1 hook path, $2 event name -> bytes emitted (0 if unrunnable)
  [ -r "$1" ] || { echo 0; return; }
  { printf '{"session_id":"probe","transcript_path":"/dev/null","cwd":"%s","hook_event_name":"%s","prompt":"probe","agent_type":"general-purpose"}' \
      "$REPO_ROOT" "$2" | bash "$1" 2>/dev/null || true; } | wc -c | tr -d ' '
}
BOOT_B="$(probe_hook "$BOOT_HOOK" UserPromptSubmit)"
SUBA_B="$(probe_hook "$SUBA_HOOK" SubagentStart)"
# est-token BAND from a byte count: dividing by the LOW B/tok gives the HIGH token estimate.
tok_band() { awk -v b="$1" -v lo="$BYTES_PER_TOKEN_LO" -v hi="$BYTES_PER_TOKEN_HI" \
  'BEGIN{ printf "%d-%d", b/hi, b/lo }'; }
echo "per-invocation size, MEASURED LIVE this run:"
echo "  inject-session-bootstrap.sh (UserPromptSubmit): ${BOOT_B} B  (~$(tok_band "$BOOT_B") est-tokens @ ${BYTES_PER_TOKEN_LO}-${BYTES_PER_TOKEN_HI} B/t)"
echo "  inject-subagent-digest.sh   (SubagentStart):    ${SUBA_B} B  (~$(tok_band "$SUBA_B") est-tokens @ ${BYTES_PER_TOKEN_LO}-${BYTES_PER_TOKEN_HI} B/t)"
echo "  NOTE: est-tokens is a BAND, not a point. Both hook payloads are ASCII-dominant, so the"
echo "        TRUE value sits near the LOW end of the band (high B/tok = few tokens applies to"
echo "        Cyrillic-rich text). Direction of error: a point estimate at 4 B/t UNDERSTATES."
echo "  session-cache guard present in either hook: $( { grep -q 'CACHE' "$BOOT_HOOK" "$SUBA_HOOK" 2>/dev/null && echo yes; } || echo no) (no cache => every firing is a fresh injection)"

echo
echo "observed firings + injected volume, MEASURED from hook-execution records:"
awk -F'\t' -v ns="$N_SESSION" -v nb="$N_SUBAGENT" -v lo="$BYTES_PER_TOKEN_LO" -v hi="$BYTES_PER_TOKEN_HI" '
  $1=="H" && ($15 ~ /inject-session-bootstrap/ || $15 ~ /inject-subagent-digest/) {
    k=$2"\t"$15; c[k]++; b[k]+=$16 }
  END {
    printf "  %-10s %-32s %8s %14s %9s %18s %12s\n","population","hook","firings","stdout-bytes","mean-B","est-tokens(band)","per-transcript"
    for (k in c) { split(k,a,"\t"); t=(a[1]=="session"?ns:nb)
      printf "  %-10s %-32s %8d %14d %9d %18s %12.2f\n", a[1], a[2], c[k], b[k], b[k]/c[k], sprintf("%d-%d", b[k]/hi, b[k]/lo), (t?c[k]/t:0) }
  }' "$TMPD/stream.tsv" | { read -r h; echo "$h"; sort -k4 -rn; }

echo
echo "residency-weighted cost (an injection at prompt p is re-billed on every LATER turn at the cache-read rate):"
awk -F'\t' -v mr="$MULT_CACHE_READ" -v lo="$BYTES_PER_TOKEN_LO" -v hi="$BYTES_PER_TOKEN_HI" '
  $1=="A" { seenA[$3]++; totA[$3]=seenA[$3] }
  $1=="H" && ($15 ~ /inject-session-bootstrap/ || $15 ~ /inject-subagent-digest/) {
    idx++; pos[idx]=seenA[$3]+0; file[idx]=$3; by[idx]=$16+0; pp[idx]=$2 }
  END {
    for (i=1;i<=idx;i++) {
      N=totA[file[i]]+0; resid=N-pos[i]; if (resid<0) resid=0
      tlo=by[i]/hi; thi=by[i]/lo          # tlo = fewest tokens, thi = most
      oneshotL[pp[i]] += tlo; oneshotH[pp[i]] += thi
      weightedL[pp[i]] += tlo*(1+resid*mr); weightedH[pp[i]] += thi*(1+resid*mr)
      rs[pp[i]]+=resid; n[pp[i]]++
    }
    # amplif. is a RATIO of two figures sharing the conversion, so it is band-invariant.
    printf "  %-10s %18s %22s %14s %10s\n","population","one-shot-tok(band)","residency-weighted(band)","mean-residual","amplif."
    for (p in n)
      printf "  %-10s %18s %22s %14.1f %9.1fx\n", p, sprintf("%d-%d",oneshotL[p],oneshotH[p]), \
        sprintf("%d-%d",weightedL[p],weightedH[p]), rs[p]/n[p], (oneshotL[p]?weightedL[p]/oneshotL[p]:0)
  }' "$TMPD/stream.tsv" | { read -r h; echo "$h"; sort -k3 -rn; }

echo
echo "per-seat-class (dominant model of the transcript the injection fired in):"
awk -F'\t' '$1=="A" { k=$3"\t"$5; c[k]++ } END { for (k in c) print c[k]"\t"k }' "$TMPD/stream.tsv" \
  | sort -k2,2 -k1,1rn | awk -F'\t' '!seen[$2]++ { print $2"\t"$3 }' > "$TMPD/filemodel.tsv"
awk -F'\t' -v lo="$BYTES_PER_TOKEN_LO" -v hi="$BYTES_PER_TOKEN_HI" '
  NR==FNR { model[$1]=$2; next }
  $1=="H" && ($15 ~ /inject-session-bootstrap/ || $15 ~ /inject-subagent-digest/) {
    m=(model[$3]!=""?model[$3]:"unknown"); fires[m]++; bytes[m]+=$16 }
  END {
    printf "  %-26s %10s %16s %18s\n","model (seat class)","firings","injected-bytes","est-tokens(band)"
    for (m in fires) printf "  %-26s %10d %16d %18s\n", m, fires[m], bytes[m], sprintf("%d-%d", bytes[m]/hi, bytes[m]/lo)
  }' "$TMPD/filemodel.tsv" "$TMPD/stream.tsv" | { read -r h; echo "$h"; sort -k2 -rn; }

echo
echo "=== END OF RUN ==="
