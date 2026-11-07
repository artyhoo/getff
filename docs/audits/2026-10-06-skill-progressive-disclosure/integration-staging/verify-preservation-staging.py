#!/usr/bin/env python3
"""Staging-side preservation probe — adaptation of the candidate's
verify-preservation.py methodology to the staging canonical layout.

For each of the four skills: every paragraph of every section of the
PRE-refactor staging card must appear (whitespace/link-target normalized)
in either the NEW card or one of its reference files. Rewritten paragraphs
(allowed: the four manually mapped groups) are listed, not silently dropped.
Frontmatter byte-identity is asserted."""
import re, subprocess, json, sys

R = "."
BASE = "origin/staging"
skills = {
    "harvest": ".claude/skills/harvest/SKILL.md",
    "claude-glm-executor-handoff": ".claude/skills/claude-glm-executor-handoff/SKILL.md",
    "getff": "skills/getff/SKILL.md",
    "self-reflection": ".claude/skills/self-reflection/SKILL.md",
}
ALLOWED_REWRITES = {
    "harvest": 4,      # doctor wording + cross-stage sentence + night pointer + paired-negative compression
    "claude-glm-executor-handoff": 12,  # six-block D4/D5 labels + fact-table cells re-tabled in reference
    "getff": 5,        # template table -> catalog routing + vocabulary compression
    "self-reflection": 3,
}

def norm(s):
    s = re.sub(r"\]\([^)]+\)", "](target)", s)
    return re.sub(r"\s+", " ", s).strip()

def fm(s):
    return s[: s.index("\n---", 4) + 4]

report = {}
ok = True
for name, path in skills.items():
    old = subprocess.check_output(["git", "show", f"{BASE}:{path}"], text=True)
    new = open(path).read()
    assert fm(old) == fm(new), f"{name}: frontmatter changed"
    bodies = {path: new}
    import pathlib
    for ref in sorted(pathlib.Path(path).parent.glob("references/*.md")):
        bodies[str(ref)] = ref.read_text()
    matches = list(re.finditer(r"^## .+$", old, re.M))
    entries = []
    for i, m in enumerate(matches):
        chunk = old[m.start() : matches[i + 1].start() if i + 1 < len(matches) else len(old)]
        paras = [x for x in chunk.split("\n\n") if x.strip() and not x.startswith("## ") and x.strip() != "---"]
        owners, missing = [], []
        for para in paras:
            got = [f for f, t in bodies.items() if norm(para) in norm(t)]
            if got:
                owners += got
            else:
                missing.append(para[:110])
        entries.append({"section": m[0], "paragraphs": len(paras), "preserved_owners": sorted(set(owners)), "rewritten_or_absent": missing})
        if len(missing) > ALLOWED_REWRITES[name]:
            ok = False
    report[name] = entries

print(json.dumps({"frontmatter": "byte-identical all four", "sections": report, "verdict": "PASS" if ok else "FAIL"}, indent=1))
sys.exit(0 if ok else 1)
