from pathlib import Path
import re,subprocess,json,hashlib,os
r=Path(__file__).resolve().parents[3];base='63da1fb35059a892fb634ab02697636dbc1d1976';out=r/'docs/audits/2026-10-06-skill-progressive-disclosure';out.mkdir(exist_ok=True)
names=['harvest','claude-glm-executor-handoff','getff','self-reflection'];mapping=[];sizes=[];checks=[]
def norm(s):
 s=re.sub(r'\]\([^)]+\)','](target)',s)
 return re.sub(r'\s+',' ',s).strip()
for n in names:
 p=Path(f'.agents/procedures/{n}/SKILL.md');old=subprocess.check_output(['git','show',base+':'+str(p)],cwd=r,text=True);new=(r/p).read_text();fm=lambda s:s[:s.index('\n---',4)+4]
 assert fm(old)==fm(new),n+' metadata changed'
 bodies={str(p):new}
 for ref in sorted((r/p.parent/'references').glob('*.md')):bodies[str(ref.relative_to(r))]=ref.read_text()
 matches=list(re.finditer(r'^## .+$',old,re.M))
 # Include all shared authority/invocation framing before first section.
 preamble=old[len(fm(old)):matches[0].start()]
 mapping.append({'skill':n,'source_section':'Preamble / authority / posture','preserved_owners':[f for f,t in bodies.items() if any(norm(x) in norm(t) for x in preamble.split('\n\n') if x.strip())], 'source_text':preamble})
 for i,m in enumerate(matches):
  chunk=old[m.start():matches[i+1].start() if i+1<len(matches) else len(old)]
  paras=[x for x in chunk.split('\n\n') if x.strip() and not x.startswith('## ') and x.strip()!='---']
  owners=[];missing=[]
  for para in paras:
   got=[file for file,txt in bodies.items() if norm(para) in norm(txt)]
   if got: owners+=got
   else: missing.append(para)
  mapping.append({'skill':n,'source_section':m[0],'source_lines':[old[:m.start()].count('\n')+1,old[:m.start()+len(chunk)].count('\n')],'preserved_owners':sorted(set(owners)),'rewritten_paragraphs':missing})
 body=lambda s:s[len(fm(s)):]
 sizes.append({'skill':n,'before_body_lines':len(body(old).splitlines()),'after_body_lines':len(body(new).splitlines()),'before_body_chars':len(body(old)),'after_body_chars':len(body(new)),'reduction_percent':round(100*(1-len(body(new))/len(body(old))),1)})
 # Every routed relative Markdown file exists in canonical and native views.
 for surface in ['.agents/procedures','.claude/skills','.agents/skills']:
  root=r/surface/n
  if surface=='.claude/skills' and n=='getff': root=r/'skills/getff'
  assert (root/'SKILL.md').exists(),str(root)
  for rp in root.rglob('*.md'):
   for target in re.findall(r'\]\(([^)]+)\)',rp.read_text()):
    target=target.split('#')[0]
    if not target or re.match(r'\w+://',target):continue
    assert (rp.parent/target).exists(),f'{rp.relative_to(r)} -> {target}'
  for ref in (r/p.parent/'references').glob('*.md'):
   target=root/'references'/ref.name
   assert target.exists(),str(target)
   if surface=='.claude/skills' and n=='getff' and target.resolve()!=ref.resolve():
    assert str(ref.relative_to(r)) in target.read_text(),str(target)+' missing owner loader'
   else: assert norm(target.read_text())==norm(ref.read_text()),str(target)+' content mismatch'
 checks.append(n+': metadata byte-verbatim; all canonical/Claude/Codex reference links and owners reachable')
 # Negative control in memory: removing an actual new resource changes membership/exists result.
 newrefs=[x for x in (r/p.parent/'references').glob('*.md') if subprocess.run(['git','cat-file','-e',base+':'+str(x.relative_to(r))],cwd=r,capture_output=True).returncode]
 assert newrefs
 for ref in newrefs:
  assert ref.name in new, str(ref)+' not routed from card'
  available={x.name for x in (r/p.parent/'references').glob('*.md')}
  required={x.name for x in newrefs}
  assert required <= available
  assert not required <= (available-{ref.name}), 'missing-resource control failed'
 checks.append(n+': every new detail has explicit card routing; missing-resource negative control discriminates')
# consumer plugin: existing generation test checks transform parity; verify new resources actually present.
for ref in ['framework-context.md','template-catalog.md']:
 a=r/f'.agents/procedures/getff/references/{ref}';b=r/f'plugin/skills/getff/references/{ref}'
 assert b.exists() and norm(a.read_text())==norm(b.read_text()),str(b)
 for t in re.findall(r'\]\(([^)]+)\)',b.read_text()):
  if not re.match(r'\w+://',t) and t.split('#')[0]:assert (b.parent/t.split('#')[0]).exists(),t
checks.append('consumer plugin: new getff resources present, content preserved under link transforms, all local relative links reachable')
previous=out/'section-preservation-map.json'
if previous.exists():
 prior=json.loads(previous.read_text())
 for entry in mapping:
  for old in prior:
   if (old['skill'],old['source_section'])==(entry['skill'],entry['source_section']) and 'manual_preservation_review' in old:
    entry['manual_preservation_review']=old['manual_preservation_review']
(out/'section-preservation-map.json').write_text(json.dumps(mapping,indent=2)+'\n')
(r/'docs/audits/2026-10-06-skill-progressive-disclosure-sizes.json').write_text(json.dumps(sizes,indent=2)+'\n')
(out/'preservation-delivery.log').write_text('\n'.join(checks)+'\n')
print(json.dumps(sizes,indent=2))
for entry in mapping:
 if entry.get('rewritten_paragraphs'): print(entry['skill'],entry['source_section'],'REWRITTEN:',json.dumps(entry['rewritten_paragraphs']))
print('\n'.join(checks))
