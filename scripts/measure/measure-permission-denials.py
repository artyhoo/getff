#!/usr/bin/env python3
"""Permission-denial measurement across recent transcripts.

Vendored 2026-09-13 from the recap-v2 design session's scratchpad copy of `perm2.py`
(spec: docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md, delivery slice 0), whose
origin is the handoff memory `project_handoff_2026_09_13_session_explanations_ux.md`. The review
log's F13 disposition said these scripts were not re-derivable; they were found intact and are
vendored here rather than re-derived.

It is the origin of the right half of the spec table's "636 vs 101". Reads only; never writes.
stdlib only.
"""
import json,glob,os,re,time,collections
ROOT="/Users/art/.claude/projects"; cutoff=time.time()-35*86400
DEN=re.compile(r"Permission to use (\w+) with command (.{0,200}?) has been denied|denied by the Claude Code auto mode classifier",re.S)
byprefix=collections.Counter(); total=0; cls=0; tooluse={}
for d in glob.glob(ROOT+"/-Users-art-code-rules-as-tests-aif*"):
  for f in glob.glob(d+"/*.jsonl"):
    if os.path.getmtime(f)<cutoff or os.path.getsize(f)<150000: continue
    with open(f,errors="ignore") as fh:
      for line in fh:
        try:o=json.loads(line)
        except:continue
        if o.get("isSidechain"):continue
        m=o.get("message") or {}; c=m.get("content")
        if not isinstance(c,list):continue
        for b in c:
          if not isinstance(b,dict):continue
          if b.get("type")=="tool_use": tooluse[b.get("id")]=(b.get("name"),json.dumps(b.get("input"),ensure_ascii=False)[:160])
          if b.get("type")=="tool_result":
            t=b.get("content"); t=t if isinstance(t,str) else json.dumps(t,ensure_ascii=False)
            mm=DEN.search(t)
            if not mm:continue
            total+=1
            if "classifier" in mm.group(0): cls+=1
            name,inp=tooluse.get(b.get("tool_use_id"),("?","?"))
            cmd=mm.group(2) if mm.group(2) else inp
            cmd=re.sub(r"\s+"," ",cmd)
            # normalise: strip leading cd/vars
            core=re.sub(r"^(cd \S+ (&&|;) )+","",cmd); core=re.sub(r"^(\w+=\S+ ?)+","",core)
            byprefix[(name," ".join(core.split()[:3]))]+=1
print("TOTAL denied",total,"of which classifier",cls)
for k,v in byprefix.most_common(45): print(v,k)
