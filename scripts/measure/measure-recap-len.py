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
import argparse, json, glob, os, sys
from datetime import datetime, timezone

DEFAULT_MARKER = "## 🟢 Простыми словами"


def percentile(values, p):
    v = sorted(values)
    return v[min(len(v) - 1, int(len(v) * p))]


def _argv_with_equals(argv, long_opts):
    # The default --glob value (and any project-slug glob) starts with "-", so
    # `--glob -Users-...` reads as two option-like tokens to argparse and it refuses
    # to consume the second as a value ("expected one argument"). Rewriting
    # `--opt value` to `--opt=value` for our own known long options sidesteps that
    # without touching how callers invoke the script.
    out, i = [], 0
    while i < len(argv):
        tok = argv[i]
        if tok in long_opts and i + 1 < len(argv):
            out.append(f"{tok}={argv[i + 1]}")
            i += 2
        else:
            out.append(tok)
            i += 1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="~/.claude/projects")
    ap.add_argument("--glob", default="-Users-art-code-rules-as-tests-aif*")
    ap.add_argument("--marker", default=DEFAULT_MARKER)
    args = ap.parse_args(_argv_with_equals(sys.argv[1:], {"--root", "--glob", "--marker"}))

    mark = args.marker
    root = os.path.expanduser(args.root)
    files = sorted(glob.glob(os.path.join(root, args.glob, "*.jsonl")))
    lens, total_lines, qblocks, n_sessions = [], [], 0, 0
    for f in files:
        seen = False
        try:
            with open(f, encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    if mark not in line: continue
                    try: o = json.loads(line)
                    except Exception: continue
                    if o.get("type") != "assistant": continue
                    for part in (o.get("message") or {}).get("content") or []:
                        if not isinstance(part, dict) or part.get("type") != "text": continue
                        t = part.get("text") or ""
                        if mark not in t: continue
                        seen = True
                        block = t.split(mark, 1)[1]
                        bl = [l for l in block.split("\n") if l.strip()]
                        lens.append(len(bl)); total_lines.append(len([l for l in t.split("\n") if l.strip()]))
                        if "?" in block: qblocks += 1
        except Exception: pass
        if seen: n_sessions += 1

    print(f"run_utc: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    print(f"root: {root}")
    print(f"glob: {args.glob}")
    print("window: all (no time filter)")
    print("min_size: none")
    print(f"marker: {mark}")
    print(f"transcripts_scanned: {len(files)}")
    print(f"sessions_with_block: {n_sessions}")
    print(f"blocks: {len(lens)}")
    if lens:
        print(f"block_lines_p50: {percentile(lens, .5)}")
        print(f"block_lines_p90: {percentile(lens, .9)}")
        print(f"block_lines_max: {max(lens)}")
        print(f"message_lines_p50: {percentile(total_lines, .5)}")
        print(f"message_lines_p90: {percentile(total_lines, .9)}")
        print(f"message_lines_max: {max(total_lines)}")
        print(f"blocks_with_question: {qblocks}")
        print(f"blocks_with_question_pct: {100*qblocks//len(lens)}")
        print(f"blocks_over_15: {sum(1 for x in lens if x > 15)}")
        print(f"blocks_over_25: {sum(1 for x in lens if x > 25)}")


if __name__ == "__main__":
    main()
