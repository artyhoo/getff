#!/usr/bin/env python3
"""Sentence-shape + glossary-term measurement for the `## 🟢` plain-words recap block.

Design-time evidence for docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md.
Reads only; never writes. stdlib only. Block extraction is measure-recap-len.py's, unchanged.

Sentence definition (the one the spec proposes for the hook, kept awk-implementable):
  1. a newline always ends a sentence (bullets and section lines are their own units);
  2. inline code spans `...` and URLs collapse to one word;
  3. a terminator is one of . ? ! ; … followed by whitespace or end of line — so a dot inside
     `path.ext`, `path:NN`, `1.5` or `v2.3` never splits;
  4. a word is a whitespace-separated token that is not empty after its ASCII punctuation is
     removed and is not a bare dash or arrow — a locale-free test (no letter classes, so the
     glibc C.UTF-8 collation trap of CI PR 1824 cannot reach it).
"""
import argparse, glob, json, os, re, sys
from datetime import datetime, timezone

DEFAULT_MARKER = "## 🟢 Простыми словами"
CODE = re.compile(r"`[^`\n]*`")
URL = re.compile(r"https?://\S+")
MDLINK = re.compile(r"\[([^\]\n]*)\]\([^)\n]*\)")
TERM = re.compile(r"(?<=[.?!;…])[)»\"*_]*\s+")
PUNCT = re.compile(r"[!-/:-@\[-`{-~]")
NOT_WORDS = {"", "—", "–", "→"}
LEAD = re.compile(r"^\s*(?:[-*•—–]|\d+[.)])\s+")


def percentile(values, p):
    v = sorted(values)
    return v[min(len(v) - 1, int(len(v) * p))]


def sentences(block):
    for line in block.split("\n"):
        line = LEAD.sub("", line.strip())
        if not line:
            continue
        line = MDLINK.sub(r"\1", line)
        line = CODE.sub("CODE", line)
        line = URL.sub("URL", line)
        for s in TERM.split(line):
            n = sum(1 for tok in s.split() if PUNCT.sub("", tok) not in NOT_WORDS)
            if n:
                yield n, s


def load_glossary(path):
    terms = {}
    cur = None
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^\*\*([^*]+)\*\*:", line)
        if m:
            cur = m.group(1)
            terms[cur] = {"words": [cur], "avoid": []}
            continue
        if cur and line.startswith("_Operator says_:"):
            body = line.split(":", 1)[1]
            for w in re.split(r"[,.]", body):
                w = w.strip().strip("«»").strip()
                if w:
                    terms[cur]["words"].append(w)
        if cur and line.startswith("_Avoid_:"):
            terms[cur]["avoid"] += re.findall(r"«([^»]+)»", line)
    return terms


def word_re(w):
    return re.compile(r"(?<![0-9A-Za-zА-Яа-яЁё])" + re.escape(w) + r"(?![0-9A-Za-zА-Яа-яЁё])", re.I)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="~/.claude/projects")
    ap.add_argument("--glob", default="-Users-art-code-rules-as-tests-aif*")
    ap.add_argument("--marker", default=DEFAULT_MARKER)
    ap.add_argument("--context", default="CONTEXT.md")
    ap.add_argument("--require", action="append", default=[], help="keep only blocks containing this substring (repeatable)")
    ap.add_argument("--end-at", default="", help="truncate the block after the LAST line containing this substring")
    ap.add_argument("--skip-card", action="store_true", help="drop the fork-card region (from --card-start to the next --section heading) before sentence counting, as the hook's line cap does")
    ap.add_argument("--card-start", default="**Развилка.**")
    ap.add_argument("--section", action="append", default=[], help="a block section heading that ends a card region (repeatable)")
    ap.add_argument("--dedup", action="store_true", help="count a byte-identical block once (resumed sessions copy messages)")
    ap.add_argument("--band", default="", help="LO-HI: print every sentence whose word count is in the band")
    ap.add_argument("--show", type=int, default=0, help="print the N longest sentences")
    argv = []
    it = iter(sys.argv[1:])
    for tok in it:
        if tok in ("--root", "--glob", "--marker", "--context", "--show", "--require", "--end-at", "--card-start", "--section", "--band"):
            argv.append(f"{tok}={next(it)}")
        else:
            argv.append(tok)
    args = ap.parse_args(argv)

    terms = load_glossary(args.context) if os.path.exists(args.context) else {}
    root = os.path.expanduser(args.root)
    files = sorted(glob.glob(os.path.join(root, args.glob, "*.jsonl")))
    blocks, sent_lens, longest = 0, [], []
    seen_blocks = set()
    block_max = []
    lines_now = []
    term_blocks = {t: [0, 0] for t in terms}  # [blocks using the term or an operator word, of those with `Term (`]
    blocks_any_term = blocks_any_unexplained = avoid_hits = both30 = blocks_any_term_raw = 0
    sess_terms = {}
    for f in files:
        try:
            fh = open(f, encoding="utf-8", errors="ignore")
        except Exception:
            continue
        with fh:
            for line in fh:
                if args.marker not in line:
                    continue
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                if o.get("type") != "assistant":
                    continue
                for part in (o.get("message") or {}).get("content") or []:
                    if not isinstance(part, dict) or part.get("type") != "text":
                        continue
                    t = part.get("text") or ""
                    if args.marker not in t:
                        continue
                    block = t.split(args.marker, 1)[1]
                    if any(r not in block for r in args.require):
                        continue
                    if args.end_at and args.end_at in block:
                        bl = block.split("\n")
                        last = max(i for i, l in enumerate(bl) if args.end_at in l)
                        block = "\n".join(bl[: last + 1])
                    if args.dedup:
                        if block in seen_blocks:
                            continue
                        seen_blocks.add(block)
                    blocks += 1
                    lines_now.append(len([l for l in block.split("\n") if l.strip()]))
                    sblock = block
                    if args.skip_card:
                        keep, skip = [], False
                        for l in block.split("\n"):
                            if args.card_start in l:
                                skip = True
                                continue
                            if skip and any(h in l for h in args.section):
                                skip = False
                            if not skip:
                                keep.append(l)
                        sblock = "\n".join(keep)
                    ss = list(sentences(sblock))
                    if ss:
                        block_max.append(max(n for n, _ in ss))
                    for n, s in ss:
                        sent_lens.append(n)
                        longest.append((n, s))
                    any_t = any_u = False
                    # Term matching reads prose only: a path, a skill name or a branch slug in a
                    # code span, a URL or a link target is not a use of the glossary term.
                    prose = URL.sub(" ", CODE.sub(" ", MDLINK.sub(r"\1", block)))
                    raw_t = any(word_re(w).search(block) for g in terms.values() for w in g["words"])
                    blocks_any_term_raw += raw_t
                    avoid_here = False
                    for name, g in terms.items():
                        if any(word_re(w).search(prose) for w in g["words"]):
                            term_blocks[name][0] += 1
                            any_t = True
                            if any(re.search(re.escape(w) + r"\*{0,2}\s*\(", block, re.I) for w in g["words"]):
                                term_blocks[name][1] += 1
                            else:
                                any_u = True
                        if any(word_re(a).search(prose) for a in g["avoid"]):
                            avoid_here = True
                    avoid_hits += avoid_here
                    sess_terms.setdefault(f, set()).update(n for n, g in terms.items() if any(word_re(w).search(prose) for w in g["words"]))
                    if any_u or (ss and max(n for n, _ in ss) > 30):
                        both30 += 1
                    blocks_any_term += any_t
                    blocks_any_unexplained += any_u

    print(f"run_utc: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    print(f"root: {root}")
    print(f"glob: {args.glob}")
    print(f"marker: {args.marker}")
    print(f"transcripts_scanned: {len(files)}")
    print(f"blocks: {blocks}")
    print(f"sentences: {len(sent_lens)}")
    if sent_lens:
        for p in (.5, .75, .9, .95, .99):
            print(f"sentence_words_p{int(p*100)}: {percentile(sent_lens, p)}")
        print(f"sentence_words_max: {max(sent_lens)}")
        for n in (15, 20, 25, 30, 35, 40):
            so = sum(1 for x in sent_lens if x > n)
            bo = sum(1 for x in block_max if x > n)
            print(f"over_{n}: sentences={so} ({100*so/len(sent_lens):.1f}%) blocks={bo} ({100*bo/blocks:.1f}%)")
    if lines_now:
        print(f"block_lines_p50: {percentile(lines_now, .5)}")
        print(f"block_lines_p90: {percentile(lines_now, .9)}")
        print(f"blocks_over_15_lines: {sum(1 for x in lines_now if x > 15)}")
    print(f"blocks_d2_or_d3_at_30: {both30}")
    print(f"glossary_terms: {len(terms)}")
    print(f"blocks_with_any_term_raw_text: {blocks_any_term_raw}")
    print(f"blocks_with_any_term: {blocks_any_term}")
    pairs = sum(len(v) for v in sess_terms.values())
    print(f"session_term_pairs: {pairs} (transcripts with a block: {len(sess_terms)})")
    print(f"blocks_with_term_lacking_inline_form: {blocks_any_unexplained}")
    for name, (u, e) in sorted(term_blocks.items(), key=lambda kv: -kv[1][0]):
        print(f"term[{name}]: blocks={u} with_inline_form={e}")
    print(f"avoid_phrase_blocks: {avoid_hits}")
    if args.band:
        lo, hi = (int(x) for x in args.band.split("-"))
        for n, t in sorted(set(longest)):
            if lo <= n <= hi:
                print(f"--- {n} words: {t[:500]}")
    if args.show:
        for n, s in sorted(longest, key=lambda x: -x[0])[: args.show]:
            print(f"--- {n} words: {s[:400]}")


if __name__ == "__main__":
    main()
