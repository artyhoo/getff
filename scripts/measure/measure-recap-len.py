#!/usr/bin/env python3
"""Block-shape measurement for the `## 🟢` plain-words recap block.

Vendored 2026-09-13 from the recap-v2 design session's scratchpad copy of `measure-recap-len.py`
(spec: docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md, delivery slice 0). The
review log's F13 disposition said these scripts were not re-derivable; they were found intact and
are vendored here rather than re-derived.

Counting is the original's, unchanged. "Lines" are non-empty lines; the percentile helper uses a
nearest-rank index formula, NOT interpolation — do not "fix" it without re-running and re-citing
every number in the spec table. Reads only; never writes. stdlib only.
"""
import json, glob, os, statistics, re
MARK = "## 🟢 Простыми словами"
files = glob.glob(os.path.expanduser("~/.claude/projects/-Users-art-code-rules-as-tests-aif*/*.jsonl"))
lens, total_lines, qblocks, n_sessions = [], [], 0, 0
for f in files:
    seen = False
    try:
        with open(f, encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                if MARK not in line: continue
                try: o = json.loads(line)
                except Exception: continue
                if o.get("type") != "assistant": continue
                for part in (o.get("message") or {}).get("content") or []:
                    if not isinstance(part, dict) or part.get("type") != "text": continue
                    t = part.get("text") or ""
                    if MARK not in t: continue
                    seen = True
                    block = t.split(MARK, 1)[1]
                    bl = [l for l in block.split("\n") if l.strip()]
                    lens.append(len(bl)); total_lines.append(len([l for l in t.split("\n") if l.strip()]))
                    if "?" in block: qblocks += 1
    except Exception: pass
    if seen: n_sessions += 1
def q(v, p): 
    v = sorted(v); return v[min(len(v)-1, int(len(v)*p))]
print("sessions with block:", n_sessions, "blocks:", len(lens))
if lens:
    print("block non-empty lines  p50/p90/max:", q(lens,.5), q(lens,.9), max(lens))
    print("whole message lines    p50/p90/max:", q(total_lines,.5), q(total_lines,.9), max(total_lines))
    print("blocks with '?':", qblocks, f"({100*qblocks//len(lens)}%)")
    print("blocks >15 lines:", sum(1 for x in lens if x>15), " >25:", sum(1 for x in lens if x>25))
