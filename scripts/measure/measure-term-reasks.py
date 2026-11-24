#!/usr/bin/env python3
"""How often does the operator ask what a glossary word means — and does he ask twice?

Design-time evidence for docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md
(revision 2, D8). Reads only; never writes. stdlib only.

A hit is a short USER message (<= --max-chars) that carries BOTH an ask phrase («что значит»,
«объясни», «не понял», ...) AND a stem of a glossary word. Stems, not the `_Operator says_`
spellings, because the operator's spelling drifts («вендерить» for «вендорить») — which is itself
one of the findings. The output lists every hit so a reader can discard the false positives by
eye: a message that merely USES a word next to «объясни» is a hit for this script and not an ask
about the word. Treat the counts as an upper bound.
"""
import argparse, collections, glob, json, os, re

STEMS = {
    "Land": r"приземл",
    "Env tier": r"энв.?тир|env.?tier",
    "Vendor": r"венд[оеё]р",
    "Chips": r"\bчип",
    "Depth": r"глубин",
    "Red": r"красн",
    "Harvest": r"harvest|х[аеэ]рв[еэ]ст|х[еэ]в[еэ]рст",
    "Egress": r"egress|[эе]гресс",
    "Handoff": r"handoff|х[еэ]ндоф",
}
ASK = re.compile(r"что (такое|значит|за)\b|что это|не понял|не понимаю|об[ъь]ясни|чего\?", re.I)


def user_text(o):
    c = (o.get("message") or {}).get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return " ".join(p.get("text", "") for p in c if isinstance(p, dict) and p.get("type") == "text")
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="~/.claude/projects")
    ap.add_argument("--glob", default="-Users-art-code-rules-as-tests-aif*")
    ap.add_argument("--max-chars", type=int, default=600)
    args = ap.parse_args()
    files = sorted(glob.glob(os.path.join(os.path.expanduser(args.root), args.glob, "*.jsonl")))
    hits = collections.defaultdict(set)
    for f in files:
        with open(f, encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                if '"type":"user"' not in line:
                    continue
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                t = user_text(o)
                if t.startswith("<") or len(t) > args.max_chars or not ASK.search(t):
                    continue
                for term, stem in STEMS.items():
                    if re.search(stem, t, re.I):
                        hits[term].add((o.get("timestamp", "")[:10], " ".join(t.split())[:110]))
    print(f"transcripts_scanned: {len(files)}")
    for term, v in sorted(hits.items(), key=lambda kv: -len(kv[1])):
        days = sorted({d for d, _ in v})
        print(f"term[{term}]: messages={len(v)} distinct_days={len(days)} days={','.join(days)}")
        for d, t in sorted(v):
            print(f"    {d} {t}")


if __name__ == "__main__":
    main()
