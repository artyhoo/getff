#!/usr/bin/env python3
"""Permission-denial measurement across recent transcripts.

Vendored 2026-09-13 from the recap-v2 design session's scratchpad copy of `perm2.py`
(spec: docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md, delivery slice 0), whose
origin is the handoff memory `project_handoff_2026_09_13_session_explanations_ux.md`. The review
log's F13 disposition said these scripts were not re-derivable; they were found intact and are
vendored here rather than re-derived.

THE `DEN` REGEX IS THE MEASUREMENT — changing it changes what a spec row means; re-run and
re-cite every number in the spec table if you ever do. It is the origin of the right half of the
spec table's "636 vs 101". Reads only; never writes. stdlib only.
"""
import argparse, collections, glob, json, os, re, sys, time
from datetime import datetime, timezone

DEN = re.compile(
    r"Permission to use (\w+) with command (.{0,200}?) has been denied|denied by the Claude Code auto mode classifier",
    re.S,
)


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
    ap.add_argument("--days", default=35, type=int)
    ap.add_argument("--min-size", default=150000, type=int)
    args = ap.parse_args(
        _argv_with_equals(sys.argv[1:], {"--root", "--glob", "--days", "--min-size"})
    )

    root = os.path.expanduser(args.root)
    cutoff = time.time() - args.days * 86400
    files = []
    for d in glob.glob(os.path.join(root, args.glob)):
        for f in glob.glob(os.path.join(d, "*.jsonl")):
            if os.path.getmtime(f) < cutoff or os.path.getsize(f) < args.min_size:
                continue
            files.append(f)
    files.sort()

    byprefix = collections.Counter()
    total = 0
    cls = 0
    tooluse = {}

    for f in files:
        try:
            with open(f, errors="ignore") as fh:
                for line in fh:
                    try:
                        o = json.loads(line)
                    except Exception:
                        continue
                    if o.get("isSidechain"):
                        continue
                    m = o.get("message") or {}
                    c = m.get("content")
                    if not isinstance(c, list):
                        continue
                    for b in c:
                        if not isinstance(b, dict):
                            continue
                        if b.get("type") == "tool_use":
                            tooluse[b.get("id")] = (
                                b.get("name"),
                                json.dumps(b.get("input"), ensure_ascii=False)[:160],
                            )
                        if b.get("type") == "tool_result":
                            t = b.get("content")
                            t = t if isinstance(t, str) else json.dumps(t, ensure_ascii=False)
                            mm = DEN.search(t)
                            if not mm:
                                continue
                            total += 1
                            if "classifier" in mm.group(0):
                                cls += 1
                            name, inp = tooluse.get(b.get("tool_use_id"), ("?", "?"))
                            cmd = mm.group(2) if mm.group(2) else inp
                            cmd = re.sub(r"\s+", " ", cmd)
                            # normalise: strip leading cd/vars
                            core = re.sub(r"^(cd \S+ (&&|;) )+", "", cmd)
                            core = re.sub(r"^(\w+=\S+ ?)+", "", core)
                            byprefix[(name, " ".join(core.split()[:3]))] += 1
        except Exception:
            pass

    print(f"run_utc: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    print(f"root: {root}")
    print(f"glob: {args.glob}")
    window_start = datetime.fromtimestamp(cutoff, tz=timezone.utc).strftime("%Y-%m-%d")
    window_end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"window: from {window_start} to {window_end}")
    print(f"min_size: {args.min_size}")
    print(f"days: {args.days}")
    print(f"transcripts_scanned: {len(files)}")
    print(f"denied_tool_calls: {total}")
    print(f"classifier_denied: {cls}")
    # The original capped its free-form dump at the top 45 (`byprefix.most_common(45)`) to keep
    # terminal output readable; kept here, with the ordering made deterministic (count desc, then
    # key asc) per the task-0.4 fix-round-1 ruling — ordering is presentation, the counting is not.
    ranked = sorted(byprefix.items(), key=lambda kv: (-kv[1], kv[0]))[:45]
    for i, (key, count) in enumerate(ranked, start=1):
        name, cmd3 = key
        print(f"prefix_{i}_count: {count}")
        print(f"prefix_{i}_key: {name} {cmd3}")


if __name__ == "__main__":
    main()
