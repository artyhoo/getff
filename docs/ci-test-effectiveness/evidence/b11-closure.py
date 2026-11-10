"""One-shot preservation/delivery applicability; no new recurring checker."""
import hashlib, json, subprocess
from pathlib import Path
base = '508149ab999628c309c47b0e0f05429538127abe'
paths = ['packages/core/hooks/checks/pr-body-fidelity-bin.test.ts', 'packages/core/principles/37-required-context-completeness.test.ts', 'packages/core/principles/ci-test-invocations.ts']
def sha(b): return hashlib.sha256(b).hexdigest()
def old(p): return subprocess.check_output(['git', 'show', f'{base}:{p}'])
# Strip ONLY the three exact binding edits; equality then protects all predicates,
# old assertions, invocation grammar, imports outside bindings and test contents.
rows=[]
for p in paths:
    current=Path(p).read_text()
    if p.endswith('pr-body-fidelity-bin.test.ts'):
        restored=current.replace("const { load } = createRequire(import.meta.url)('js-yaml') as { load: (source: string) => unknown };\n\n",'').replace("import { runCheck }", "import { load } from 'js-yaml';\nimport { runCheck }")
    elif p.endswith('37-required-context-completeness.test.ts'):
        restored=current.replace("import { createRequire } from 'node:module';", "import { load } from 'js-yaml';").replace("const { load } = createRequire(import.meta.url)('js-yaml') as { load: (source: string) => unknown };\n\n",'')
    else:
        restored=current.replace("import { createRequire } from 'node:module';", "import yaml from 'js-yaml';\nimport picomatch from 'picomatch';").replace("const nodeRequire = createRequire(import.meta.url);\nconst yaml = nodeRequire('js-yaml') as { load: (source: string) => unknown };\nconst picomatch = nodeRequire('picomatch') as (\n  pattern: string | string[],\n  options?: { dot?: boolean },\n) => (input: string) => boolean;\n\n",'')
    assert restored.encode() == old(p), p
    rows.append(dict(path=p, beforeSHA256=sha(old(p)), afterSHA256=sha(Path(p).read_bytes()), onlyExactBindingsChanged=True))
maps=[]
for p in sorted(Path('tests/install-sh/baselines').rglob('*.fingerprint')):
    entries=[line.split('  ',1)[1] for line in p.read_text().splitlines() if '  ' in line]
    matches=[changed for changed in paths if changed in entries]
    assert not matches, (p,matches)
    maps.append(dict(path=str(p),sha256=sha(p.read_bytes()),matchingChangedInstalledInputs=matches))
assert len(maps)==15
manifest=Path('packages/getff/MANIFEST.sha256').read_bytes()
def parse(b): return {line.split('  ',1)[1]:line.split('  ',1)[0] for line in b.decode().splitlines()}
before,after=parse(old('packages/getff/MANIFEST.sha256')),parse(manifest)
changed=sorted(k for k in before.keys() | after.keys() if before.get(k)!=after.get(k))
assert changed==sorted(paths), changed
for row in rows: assert after[row['path']]==row['afterSHA256']
inventory=Path('docs/ci-test-effectiveness/inventory-s2.jsonl').read_bytes()
assert inventory.startswith(old('docs/ci-test-effectiveness/inventory-s2.jsonl'))
result=dict(base=base,sourceHashes=rows,baselineMaps=maps,manifest=dict(sha256=sha(manifest),entries=len(after),changedPaths=changed),inventoryPrefixSHA256=sha(old('docs/ci-test-effectiveness/inventory-s2.jsonl')),limits='Installed baseline maps exclude these exact test-only inputs. No capture or platform-suite replay warranted; this is not hosted execution evidence.')
Path('docs/ci-test-effectiveness/evidence/b11-closure-result.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS: exact binding-only source delta; 15 actual maps exclude changed paths; exactly 3 normal manifest hash changes; frozen inventory prefix preserved')
