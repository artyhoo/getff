#!/usr/bin/env python3
"""Interaction-shape measurement across recent transcripts.

Vendored 2026-09-13 from the recap-v2 design session's scratchpad copy of `analyze2.py`
(spec: docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md, delivery slice 0), whose
origin is the handoff memory `project_handoff_2026_09_13_session_explanations_ux.md`. The review
log's F13 disposition said these scripts were not re-derivable; they were found intact and are
vendored here rather than re-derived.

THE REGEXES ARE THE MEASUREMENT — changing one changes what a spec row means; re-run and re-cite
if you ever do. Reads only; never writes. stdlib only.
"""
import argparse, json, glob, os, re, sys, time, collections

MARK = "## 🟢"

# THE REGEXES ARE THE MEASUREMENT — changing one changes what a spec row means; re-run and
# re-cite every number in the spec table if you ever do.
PATTERNS = {
    "INJECT": re.compile(
        r"^(Stop hook feedback|This session is being continued|Base directory for this skill|"
        r"\[Request interrupted|<system-reminder>|<command-|UserPromptSubmit hook|PreToolUse|"
        r"PostToolUse|SessionStart hook|<local-command|<task-notification|<ci-monitor)|"
        r"hook (success|feedback|additional context)|<system-reminder>",
        re.I,
    ),
    "CLAR": re.compile(
        r"(объясни|обьясни|поясни|понятн|непонятн|не понял|не поняла|доступн|простым|попроще|"
        r"по-человеч|человеческ|что от меня|что мне (нужно|надо|делать)|что надо|что нужно|"
        r"в чем суть|в чём суть|о чем речь|о чём речь|расшифруй|проще|ничего не понял|"
        r"что это значит|на пальцах|популярн)",
        re.I,
    ),
    "HANDOFF": re.compile(
        r"(хендофф|хэндофф|handoff|контекст (для|чтобы) продолж|напиши контекст|сохрани контекст|"
        r"перед сжатием|после сжатия|очистк\w+ контекст|запиши в память|сохрани в память|в память)",
        re.I,
    ),
    "CONFIRM": re.compile(
        r"^\s*(да|го|ок|окей|давай|мержи|мерж|делай|подтверждаю|yes|go|ok|продолжай|дальше|"
        r"вперед|вперёд|да,? мержи|да го|го мержи|мержи сам|сам мержи|ага)[\s.!,]*$",
        re.I,
    ),
    "AUTON": re.compile(
        r"(не спрашивай|сам реш|автономн|без подтвержд|зачем спрашива|почему спрашива|"
        r"не надо спрашивать|не жди меня|не жди подтвержд|можешь сам|сам мерж|мерж сам|"
        r"больше автоном|почему (сам )?не смержил|почему не мержишь|сам не мож|не можешь сам)",
        re.I,
    ),
    "ASKC": re.compile(
        r"(жду (твоего|вашего|твоё|твое)|нужно (твоё|твое) го|ждёт (твой|твоего|твоей)|"
        r"ждет (твой|твоего)|подтверди|мержить\?|мержу\?|можно мержить|дай го|твой клик|"
        r"ждёт клика|скажи «го»|скажи го|твоё «го»|твоё го|по твоему «го»|нужен GO|нужен твой|"
        r"GO оператора|go оператора|решай ты|решение за тобой|жду решения|ждёт решения)",
        re.I,
    ),
}
INJECT = PATTERNS["INJECT"]
CLAR = PATTERNS["CLAR"]
HANDOFF = PATTERNS["HANDOFF"]
CONFIRM = PATTERNS["CONFIRM"]
AUTON = PATTERNS["AUTON"]
ASKC = PATTERNS["ASKC"]


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


def text_of(msg):
    c = msg.get("content")
    if isinstance(c, str):
        return c
    out = []
    if isinstance(c, list):
        for b in c:
            if isinstance(b, dict) and b.get("type") == "text":
                out.append(b.get("text", ""))
    return "\n".join(out)


def has_tool(msg, name):
    c = msg.get("content")
    return isinstance(c, list) and any(
        isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") == name for b in c
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="~/.claude/projects")
    ap.add_argument("--glob", default="-Users-art-code-rules-as-tests-aif*")
    ap.add_argument("--days", default=14, type=int)
    ap.add_argument("--min-size", default=150000, type=int)
    args = ap.parse_args(
        _argv_with_equals(sys.argv[1:], {"--root", "--glob", "--days", "--min-size"})
    )

    root = os.path.expanduser(args.root)
    dirs = glob.glob(os.path.join(root, args.glob))
    cutoff = time.time() - args.days * 86400
    files = []
    for d in dirs:
        for f in glob.glob(os.path.join(d, "*.jsonl")):
            st = os.stat(f)
            if st.st_mtime >= cutoff and st.st_size > args.min_size:
                files.append((st.st_mtime, f))
    files.sort(reverse=True)

    stats = collections.Counter()
    after = collections.Counter()
    for mt, f in files:
        turns = []
        try:
            with open(f, errors="ignore") as fh:
                for line in fh:
                    try:
                        o = json.loads(line)
                    except Exception:
                        continue
                    if o.get("isSidechain"):
                        continue
                    t = o.get("type")
                    m = o.get("message") or {}
                    if t == "user":
                        tx = text_of(m).strip()
                        if not tx or INJECT.search(tx[:200]):
                            continue
                        turns.append(("user", tx, None))
                    elif t == "assistant":
                        turns.append(("assistant", text_of(m), has_tool(m, "AskUserQuestion")))
        except Exception:
            continue
        if not any(r == "user" for r, *_ in turns):
            continue
        for i, (r, tx, x) in enumerate(turns):
            if r == "user":
                stats["user"] += 1
                if CLAR.search(tx):
                    stats["clarify"] += 1
                if HANDOFF.search(tx):
                    stats["handoff"] += 1
                if CONFIRM.match(tx):
                    stats["confirm"] += 1
                if AUTON.search(tx):
                    stats["autonomy"] += 1
            else:
                if x:
                    stats["askuserq"] += 1
                if ASKC.search(tx):
                    stats["ai_asks_confirm"] += 1
                if MARK in tx:
                    stats["recaps"] += 1
                    for j in range(i + 1, min(i + 6, len(turns))):
                        if turns[j][0] == "user":
                            if CONFIRM.match(turns[j][1]):
                                after["bare_go"] += 1
                            else:
                                after["substantive"] += 1
                            break

    print(f"root: {args.root}")
    print(f"days: {args.days}")
    print(f"min_size: {args.min_size}")
    print(f"transcripts_scanned: {len(files)}")
    print(f"user_messages: {stats['user']}")
    print(f"reexplain_asks: {stats['clarify']}")
    print(f"handoff_asks: {stats['handoff']}")
    print(f"bare_confirmations: {stats['confirm']}")
    print(f"autonomy_complaints: {stats['autonomy']}")
    print(f"agent_wait_phrases: {stats['ai_asks_confirm']}")
    print(f"recaps: {stats['recaps']}")
    print(f"after_recap_bare_go: {after['bare_go']}")
    print(f"after_recap_substantive: {after['substantive']}")


if __name__ == "__main__":
    main()
