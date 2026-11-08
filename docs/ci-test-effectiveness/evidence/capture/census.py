import pathlib,json,re,hashlib,collections,datetime,subprocess,platform,yaml
R=pathlib.Path('/workspace/getff-native');E=R/'docs/ci-test-effectiveness/evidence';files=(E/'tracked-files.txt').read_text().splitlines()
def dump(n,v): (E/n).write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
workflows=[];inv=[]
for f in files:
 if f.startswith('.github/workflows/') and f.endswith(('.yml','.yaml')):
  d=yaml.load((R/f).read_text(),Loader=yaml.BaseLoader);workflows.append({'path':f,'sha256':sha(R/f),'definition':d})
  for j,v in d.get('jobs',{}).items():
   for i,s in enumerate(v.get('steps',[])):
    inv.append({'id':f+'#'+j+'/'+str(i+1),'workflow':f,'events':d.get('on'),'job':j,'jobName':v.get('name',j),'needs':v.get('needs',[]),'jobIf':v.get('if'),'runner':v.get('runs-on'),'strategy':v.get('strategy'),'jobEnv':v.get('env',{}),'defaults':v.get('defaults',d.get('defaults',{})),'step':s})
dump('workflow-definitions.json',workflows);dump('ci-invocations.json',inv)
entry=[]
for f in files:
 if f.endswith('package.json'):
  try:d=json.loads((R/f).read_text())
  except:continue
  if d.get('scripts'):entry.append({'path':f,'scripts':d['scripts']})
dump('package-entrypoints.json',entry)
candidates=[]
for f in files:
 if re.search(r'\.(test|spec)\.[^/]+$|\.audit\.ts$',f) or ((f.startswith('tests/') or '/tests/' in f) and f.endswith(('.sh','.py','.mjs','.ts'))) or re.search(r'(^|/)test_[^/]+\.py$',f):
  p=R/f;s=p.read_text(errors='replace');lines=s.splitlines()
  candidates.append({'path':f,'sha256':sha(p),'lines':len(lines),'header':'\n'.join(lines[:45]),'declarations':[{'line':i+1,'text':l.strip()} for i,l in enumerate(lines) if re.search(r'\b(describe|it|test|suite)(?:\.[\w]+)*(?:\(|\s*`)|\bdef test_|^(?:ok|bad|check|assert_|test_)|(?:&&|\|\|) (?:ok|bad)|^# (?:[A-Z]|[0-9])',l)],'oracleExpressions':[{'line':i+1,'text':l.strip()} for i,l in enumerate(lines) if re.search(r'\bexpect\(|\bassert[.( ]|\b(?:assert_equal|assert_eq|assert_contains|assert_status)\b|\[.*\].*(?:&&|\|\|)|\bgrep\s',l)],'skipExpressions':[{'line':i+1,'text':l.strip()} for i,l in enumerate(lines) if re.search(r'\b(?:skipIf|runIf|\.skip\b|\.todo\b|SKIP|UNVERIFIED)',l)],'imports':re.findall(r'(?:from\s+|import\s+)[\'\"]([^\'\"]+)',s),'invocationMentions':[x['id'] for x in inv if f in x['step'].get('run','') or pathlib.Path(f).name in x['step'].get('run','')]})
dump('source-census.json',candidates)
print('Workflows',len(workflows),'Jobs',sum(len(w['definition']['jobs']) for w in workflows),'Steps',len(inv),'Test/support candidates',len(candidates),'Package scripts',sum(len(x['scripts']) for x in entry));print(collections.Counter(pathlib.Path(x['path']).suffix for x in candidates))
