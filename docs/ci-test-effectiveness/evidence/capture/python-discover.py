import pathlib,unittest,importlib.util,json,sys,traceback
R=pathlib.Path('/workspace/getff-native');E=R/'docs/ci-test-effectiveness/evidence';rows=json.load(open(E/'source-census.json'));out=[]
for row in rows:
 p=R/row['path']
 if p.suffix!='.py' or 'unittest' not in p.read_text():continue
 sys.path.insert(0,str(p.parent))
 try:
  spec=importlib.util.spec_from_file_location(p.stem,p);m=importlib.util.module_from_spec(spec);sys.modules[p.stem]=m;spec.loader.exec_module(m);suite=unittest.defaultTestLoader.loadTestsFromModule(m)
  def flatten(s):
   for t in s:
    if isinstance(t,unittest.TestSuite):yield from flatten(t)
    else:yield t.id()
  out.append({'path':row['path'],'cases':list(flatten(suite)),'loaderErrors':unittest.defaultTestLoader.errors[:]})
 except Exception as ex:out.append({'path':row['path'],'error':str(ex),'traceback':traceback.format_exc()})
 sys.path.pop(0)
(E/'python-discovery.json').write_text(json.dumps(out,indent=2)+'\n');print([(r['path'],len(r.get('cases',[])),r.get('error')) for r in out])
