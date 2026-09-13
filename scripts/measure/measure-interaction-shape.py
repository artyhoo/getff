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
import json, glob, os, re, sys, time, collections
ROOT="/Users/art/.claude/projects"
dirs=glob.glob(ROOT+"/-Users-art-code-rules-as-tests-aif*")
cutoff=time.time()-35*86400
files=[]
for d in dirs:
    for f in glob.glob(d+"/*.jsonl"):
        st=os.stat(f)
        if st.st_mtime>=cutoff and st.st_size>150000: files.append((st.st_mtime,f))
files.sort(reverse=True)
MARK="## 🟢"
INJECT=re.compile(r"^(Stop hook feedback|This session is being continued|Base directory for this skill|\[Request interrupted|<system-reminder>|<command-|UserPromptSubmit hook|PreToolUse|PostToolUse|SessionStart hook|<local-command|<task-notification|<ci-monitor)|hook (success|feedback|additional context)|<system-reminder>", re.I)
CLAR=re.compile(r"(объясни|обьясни|поясни|понятн|непонятн|не понял|не поняла|доступн|простым|попроще|по-человеч|человеческ|что от меня|что мне (нужно|надо|делать)|что надо|что нужно|в чем суть|в чём суть|о чем речь|о чём речь|расшифруй|проще|ничего не понял|что это значит|на пальцах|популярн)", re.I)
HANDOFF=re.compile(r"(хендофф|хэндофф|handoff|контекст (для|чтобы) продолж|напиши контекст|сохрани контекст|перед сжатием|после сжатия|очистк\w+ контекст|запиши в память|сохрани в память|в память)", re.I)
CONFIRM=re.compile(r"^\s*(да|го|ок|окей|давай|мержи|мерж|делай|подтверждаю|yes|go|ok|продолжай|дальше|вперед|вперёд|да,? мержи|да го|го мержи|мержи сам|сам мержи|ага)[\s.!,]*$", re.I)
AUTON=re.compile(r"(не спрашивай|сам реш|автономн|без подтвержд|зачем спрашива|почему спрашива|не надо спрашивать|не жди меня|не жди подтвержд|можешь сам|сам мерж|мерж сам|больше автоном|почему (сам )?не смержил|почему не мержишь|сам не мож|не можешь сам)", re.I)
ASKC=re.compile(r"(жду (твоего|вашего|твоё|твое)|нужно (твоё|твое) го|ждёт (твой|твоего|твоей)|ждет (твой|твоего)|подтверди|мержить\?|мержу\?|можно мержить|дай го|твой клик|ждёт клика|скажи «го»|скажи го|твоё «го»|твоё го|по твоему «го»|нужен GO|нужен твой|GO оператора|go оператора|решай ты|решение за тобой|жду решения|ждёт решения)", re.I)
def text_of(msg):
    c=msg.get("content")
    if isinstance(c,str): return c
    out=[]
    if isinstance(c,list):
        for b in c:
            if isinstance(b,dict) and b.get("type")=="text": out.append(b.get("text",""))
    return "\n".join(out)
def has_tool(msg,name):
    c=msg.get("content")
    return isinstance(c,list) and any(isinstance(b,dict) and b.get("type")=="tool_use" and b.get("name")==name for b in c)
stats=collections.Counter(); clar=[]; hand=[]; auton=[]; askc=[]; after=collections.Counter(); after_s=[]; sessions=0; per=[]
for mt,f in files:
    turns=[]
    with open(f,errors="ignore") as fh:
        for line in fh:
            try: o=json.loads(line)
            except: continue
            if o.get("isSidechain"): continue
            t=o.get("type"); m=o.get("message") or {}
            if t=="user":
                tx=text_of(m).strip()
                if not tx or INJECT.search(tx[:200]): continue
                turns.append(("user",tx,None))
            elif t=="assistant":
                turns.append(("assistant",text_of(m),has_tool(m,"AskUserQuestion")))
    if not any(r=="user" for r,*_ in turns): continue
    sessions+=1; sid=f.split("/")[-2].replace("-Users-art-code-rules-as-tests-aif","").replace("--claude-worktrees-","")[-24:] or "MAIN"
    d=time.strftime("%m-%d",time.localtime(mt)); nu=nc=nh=nk=na=nq=nr=nask=0
    for i,(r,tx,x) in enumerate(turns):
        if r=="user":
            nu+=1; stats["user"]+=1
            if CLAR.search(tx): nc+=1; stats["clarify"]+=1; clar.append((d,sid,tx[:300].replace("\n"," ")))
            if HANDOFF.search(tx): nh+=1; stats["handoff"]+=1; hand.append((d,sid,tx[:200].replace("\n"," ")))
            if CONFIRM.match(tx): nk+=1; stats["confirm"]+=1
            if AUTON.search(tx): na+=1; stats["autonomy"]+=1; auton.append((d,sid,tx[:300].replace("\n"," ")))
        else:
            if x: nq+=1; stats["askuserq"]+=1
            if ASKC.search(tx): nask+=1; stats["ai_asks_confirm"]+=1; 
            if ASKC.search(tx) and len(askc)<60:
                mm=ASKC.search(tx); s=max(0,mm.start()-120); askc.append((d,sid,tx[s:mm.end()+80].replace("\n"," ")))
            if MARK in tx:
                nr+=1; stats["recaps"]+=1
                for j in range(i+1,min(i+6,len(turns))):
                    if turns[j][0]=="user":
                        nxt=turns[j][1]
                        if CLAR.search(nxt): after["clarify"]+=1; after_s.append((d,sid,nxt[:260].replace("\n"," ")))
                        elif HANDOFF.search(nxt): after["handoff"]+=1
                        elif CONFIRM.match(nxt): after["confirm"]+=1
                        elif AUTON.search(nxt): after["autonomy"]+=1
                        else: after["other"]+=1
                        break
    per.append((d,sid,nu,nc,nh,nk,na,nq,nr,nask))
print("SESSIONS",sessions); print("STATS",dict(stats)); print("AFTER_RECAP",dict(after))
print("\n=== per session: date sid users clarify handoff confirm autonomy askQ recaps ai_asks_confirm ===")
for p in per: 
    if p[2]>=3: print(*p)
print("\n=== CLARIFY (%d) ==="%len(clar))
for s in clar: print("-",s[0],s[1],"|",s[2])
print("\n=== HANDOFF (%d) ==="%len(hand))
for s in hand[:60]: print("-",s[0],s[1],"|",s[2])
print("\n=== AUTONOMY complaints (%d) ==="%len(auton))
for s in auton: print("-",s[0],s[1],"|",s[2])
print("\n=== AI asks for confirmation samples ===")
for s in askc: print("-",s[0],s[1],"|",s[2])
print("\n=== AFTER-RECAP clarify (%d) ==="%len(after_s))
for s in after_s: print("-",s[0],s[1],"|",s[2])
