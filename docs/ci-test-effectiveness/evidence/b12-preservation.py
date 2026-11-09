"""One-shot B12 evidence; no recurring checker or production implementation."""
import collections
import hashlib
import json
import re
import subprocess
from pathlib import Path

import yaml

BASE = '47101f3e6ab276a26091c32e45c50cf39da1acfb'
HOSTED = '76e5e8b5c72d40423aac5adfb810747f15f764c4'
ROW = 'aif-review 104 79e563f5fa2d3a76e34ecb2b7e922134fc74122cd4581986f3444134dc402b43 100 742958cdc895f9a9fad8c908dd32d5b415fecb5fb516f0c287569e6f177278c9'


def before(path, commit=BASE):
    return subprocess.check_output(['git', 'show', f'{commit}:{path}'])


def sha(data):
    return hashlib.sha256(data).hexdigest()


lib = 'setup.d/lib.sh'
old, new = before(lib), Path(lib).read_bytes()
assert new.count(ROW.encode() + b'\n') == 1
assert new.replace(ROW.encode() + b'\n', b'', 1) == old
registry = lambda data: data.split(b"SKILL_CONTEXT_SHIPPED_REVISIONS='\n", 1)[1].split(b"\n'", 1)[0].splitlines()
assert registry(new) == registry(old) + [ROW.encode()]

template = 'packages/core/templates/shared/skill-context/aif-review/SKILL.md'
raw = Path(template).read_bytes()
assert raw == before(template) == before(template, HOSTED)
lines = raw.splitlines(keepends=True)
assert lines[0] == b'---\n'
body = b''.join(lines[lines.index(b'---\n', 1) + 1:]).strip(b' \t\r\n') + b'\n'
independent_row = f'aif-review {raw.count(bytes([10]))} {sha(raw)} {body.count(bytes([10]))} {sha(body)}'
assert independent_row == ROW == Path('docs/ci-test-effectiveness/evidence/b12-derived-row.txt').read_text().strip()
assert not subprocess.check_output(['git', 'diff', BASE, '--', 'tests/', 'packages/core/templates/'])

workflow = '.github/workflows/audit-self.yml'
old_text, new_text = before(workflow).decode(), Path(workflow).read_text()
old_flow, new_flow = yaml.safe_load(old_text), yaml.safe_load(new_text)
old_steps = old_flow['jobs']['install-sh-c']['steps']
new_steps = new_flow['jobs']['install-sh-c']['steps']
command = 'bash tests/install-sh/skill-context-evolve-coownership.test.sh'
index = next(i for i, step in enumerate(old_steps) if step.get('run') == command)
assert index > 4
assert new_steps == old_steps[:4] + [old_steps[index]] + old_steps[4:index] + old_steps[index + 1:]
assert new_steps[:4] == old_steps[:4]
assert new_steps[5]['run'] == 'bash tests/install-sh/r2-glob-reach.test.sh'
assert new_steps[6]['run'] == 'bash tests/install-sh/r2-auto-wire.test.sh'
assert sum(step.get('run') == command for step in new_steps) == 1
serialize = lambda step: json.dumps(step, sort_keys=True)
assert collections.Counter(map(serialize, old_steps)) == collections.Counter(map(serialize, new_steps))
new_flow['jobs']['install-sh-c']['steps'] = old_steps
assert new_flow == old_flow
old_lines = old_text.splitlines(keepends=True)
i = next(i for i, line in enumerate(old_lines) if f'run: {command}' in line)
step_bytes = ''.join(old_lines[i - 1:i + 1])
assert old_lines[i - 1].lstrip().startswith('- name:')
del old_lines[i - 1:i + 1]
i = next(i for i, line in enumerate(old_lines) if '      - name: Run install-sh R2 glob-reach test' in line)
old_lines[i:i] = [step_bytes]
assert ''.join(old_lines) == new_text

harness = Path('tests/install-sh/snapshot.sh')
assert harness.read_bytes() == before(str(harness))
match = re.search(r'local BASELINE_DIR="\$\{BASELINE_DIR:-\$REPO_ROOT/([^}]+)\}"', harness.read_text())
assert match
maps = sorted(Path(match.group(1)).glob('*/*.fingerprint'))
assert len(maps) == 15
installed_maps = []
for path in maps:
    data = path.read_bytes()
    assert data == before(str(path))
    entries = [line.split('  ', 1)[1] for line in data.decode().splitlines() if '  ' in line]
    affected = sorted(set(entries) & {lib, workflow, '.agents/rules/evidence-regeneration.md', '.claude/rules/evidence-regeneration.md', 'packages/getff/MANIFEST.sha256'})
    assert not affected
    installed_maps.append(dict(path=str(path), sha256=sha(data), affectedEntries=affected))

manifest = 'packages/getff/MANIFEST.sha256'
parse_manifest = lambda data: dict((line.split('  ', 1)[1], line.split('  ', 1)[0]) for line in data.decode().splitlines() if '  ' in line)
old_manifest, new_manifest = parse_manifest(before(manifest)), parse_manifest(Path(manifest).read_bytes())
assert old_manifest.keys() == new_manifest.keys()
changed = [path for path in old_manifest if old_manifest[path] != new_manifest[path]]
citation = '.agents/rules/evidence-regeneration.md'
old_citation, new_citation = before(citation), Path(citation).read_bytes()
assert new_citation == old_citation.replace(b'`:1159` (same, install-sh-c)', b'`:1161` (same, install-sh-c)').replace(b'`:1157` (same, install-sh-c)', b'`:1159` (same, install-sh-c)')
assert re.sub(rb'[0-9]', b'', new_citation) == re.sub(rb'[0-9]', b'', old_citation)
twin = Path('.claude/rules/evidence-regeneration.md')
assert twin.is_symlink() and twin.readlink() == Path('../../.agents/rules/evidence-regeneration.md')
assert twin.read_bytes() == new_citation
assert changed == [citation, lib]
assert new_manifest[lib] == sha(new)
assert new_manifest[citation] == sha(new_citation)
result = dict(base=BASE, hostedFailedHead=HOSTED, tuple=ROW,
              independentTemplateAndBodyHashes=True, helperMatches=True,
              exactOldLibReconstructed=True, previousTuplesPreserved=len(registry(old)),
              templateAndAllTestsUnchanged=True, hostedTemplateIdentical=True,
              workflow=dict(oldTestIndex=index, newTestIndex=4, setupPrefixPreserved=4,
                            steps=len(old_steps), stepObjectMultisetUnchanged=True,
                            exactMoveOnly=True, allOtherWorkflowDataUnchanged=True),
              installedHarness=dict(path=str(harness), sha256=sha(harness.read_bytes()), derivedBaselineDirectory=match.group(1)),
              installedMaps=installed_maps, installedBaselineRegenerationRequired=False,
              manifestChangedEntries=changed, citationDigitOnlyPreservation=True, compatibilityTwinUnchangedSymlink=True,
              sourceHashes={p: dict(beforeSHA256=sha(before(p)), afterSHA256=sha(Path(p).read_bytes())) for p in (lib, workflow, manifest, citation, template, 'tests/install-sh/skill-context-evolve-coownership.test.sh')})
Path('docs/ci-test-effectiveness/evidence/b12-preservation-result.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
