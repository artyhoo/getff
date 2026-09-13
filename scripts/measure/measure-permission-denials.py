#!/usr/bin/env python3
"""Permission-denial measurement across recent transcripts.

Vendored 2026-09-13 from the recap-v2 design session's scratchpad copy of `perm2.py`
(spec: docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md, delivery slice 0), whose
origin is the handoff memory `project_handoff_2026_09_13_session_explanations_ux.md`. The review
log's F13 disposition said these scripts were not re-derivable; they were found intact and are
vendored here rather than re-derived.

Task 0.4 hardening note (2026-09-13): the vendored original's `DEN` regex ("Permission to use X
with command Y has been denied" / "denied by the Claude Code auto mode classifier") does not
match either permission-denial message shape actually present in `~/.claude/projects` today —
verified by `grep -rl` for both the old and the current phrasing: both exist, but the current
shapes are "The user doesn't want to proceed with this tool use..." (a plain user rejection) and
"Claude requested permissions to use <tool>, but you haven't granted it yet. Command: <cmd>" (the
auto-mode classifier's denial). This hardening pass replaces the stale regex with these two
current shapes, per the task-0.4 brief's fixture and hand count — a deliberate, cited change to
the detection, not a silent drift; see the task-0.4 report for the full note.

It is the origin of the right half of the spec table's "636 vs 101". Reads only; never writes.
stdlib only.
"""
import argparse, collections, glob, json, os, re, sys, time
from datetime import datetime, timezone

# THE STRINGS BELOW ARE THE MEASUREMENT — changing one changes what a spec row means; re-run and
# re-cite every number in the spec table if you ever do.
CLASSIFIER_RE = re.compile(
    r"requested permissions to use \w+, but you haven't granted it yet\.\s*Command:\s*(.+)",
    re.S,
)
REJECT_RE = re.compile(r"doesn't want to proceed with this tool use")


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


def _content_text(content):
    if isinstance(content, str):
        return content
    return json.dumps(content, ensure_ascii=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="~/.claude/projects")
    ap.add_argument("--glob", default="-Users-art-code-rules-as-tests-aif*")
    ap.add_argument("--days", default=35, type=int)
    args = ap.parse_args(_argv_with_equals(sys.argv[1:], {"--root", "--glob", "--days"}))

    root = os.path.expanduser(args.root)
    cutoff = time.time() - args.days * 86400
    files = []
    for d in glob.glob(os.path.join(root, args.glob)):
        for f in glob.glob(os.path.join(d, "*.jsonl")):
            if os.path.getmtime(f) >= cutoff:
                files.append(f)
    files.sort()

    denied_tool_calls = 0
    classifier_denied = 0
    prefixes = collections.Counter()

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
                    c = (o.get("message") or {}).get("content")
                    if not isinstance(c, list):
                        continue
                    for b in c:
                        if not isinstance(b, dict) or b.get("type") != "tool_result":
                            continue
                        if not b.get("is_error"):
                            continue
                        t = _content_text(b.get("content"))
                        mm = CLASSIFIER_RE.search(t)
                        if mm:
                            denied_tool_calls += 1
                            classifier_denied += 1
                            cmd = re.sub(r"\s+", " ", mm.group(1)).strip()
                            if cmd:
                                prefixes[cmd.split()[0]] += 1
                            continue
                        if REJECT_RE.search(t):
                            denied_tool_calls += 1
        except Exception:
            pass

    print(f"run_utc: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    print(f"root: {root}")
    print(f"glob: {args.glob}")
    window_start = datetime.fromtimestamp(cutoff, tz=timezone.utc).strftime("%Y-%m-%d")
    window_end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"window: from {window_start} to {window_end}")
    print("min_size: none")
    print(f"days: {args.days}")
    print(f"transcripts_scanned: {len(files)}")
    print(f"denied_tool_calls: {denied_tool_calls}")
    print(f"classifier_denied: {classifier_denied}")
    for name, count in sorted(prefixes.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"prefix_{name}: {count}")


if __name__ == "__main__":
    main()
