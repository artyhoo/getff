#!/usr/bin/env bash
# Execute the Python first-steps commands read from the actually delivered guide.
set -euo pipefail
ROOT=${TEST_REPO_ROOT:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
python3 - "$ROOT" "$TMP" <<'PY'
import pathlib,sys,subprocess,re,shutil,json
root=pathlib.Path(sys.argv[1]);p=pathlib.Path(sys.argv[2]);consumer=p/'consumer';consumer.mkdir()
(consumer/'pyproject.toml').write_text('[project]\nname="docs-walk"\nversion="0.0.0"\n')
(consumer/'app.py').write_text('answer = 42\n')
subprocess.run(['git','init','-q'],cwd=consumer,check=True)
r=subprocess.run(['bash',str(root/'setup'),'python','--profile','core'],cwd=consumer,input='n\n'*200,text=True,capture_output=True,timeout=120)
(p/'setup.log').write_text(r.stdout+r.stderr)
assert r.returncode==0, r.stdout[-1500:]+r.stderr[-1500:]
guide=(consumer/'.ai-factory/AI-USAGE-GUIDE.md').read_text()
section=re.search(r'#### Python\n(.*?)(?=\n#### |\n---)',guide,re.S)
if not section:
 # Before the fix Python is sent through npm core steps despite a successful lane install.
 core=guide.split('### §2.1')[1].split('### §2.2')[0]
 commands=re.findall(r'`(bash scripts/[^`]+)`',core)
 assert commands, 'No verifiable first-steps commands found'
 for command in commands:
  result=subprocess.run(command,shell=True,cwd=consumer,text=True,capture_output=True)
  assert result.returncode==0, 'Successful Python install is routed to absent command: '+command+'\n'+result.stderr
 raise AssertionError('Python native walkthrough missing')
block=re.search(r'```bash\n(.*?)\n```',section[1],re.S)
assert block,'Python walkthrough has no executable verification'
for path in ['AGENTS.md','.ai-factory/DESCRIPTION.md','.ai-factory/ARCHITECTURE.md','.ai-factory/RULES.md','.getff/ruff-bans.toml','scripts/check-zcode-mirror.sh']:
 assert (consumer/path).exists(),path
assert not (consumer/'scripts/audit-ai-docs.sh').exists()
assert not (consumer/'.ai-factory/tier-home.md').exists()
for slug in ['getff','tool-bootstrapping','rule-research','rule-tests']:
 assert (consumer/f'.claude/skills/{slug}/SKILL.md').exists(),slug
agents=(consumer/'AGENTS.md').read_text()
assert '| `toolchain` |' in agents, 'Lane install matches no context row'
for filename in ['AGENTS.md.template','DESCRIPTION.template.md','CLAUDE.md.template']:
 text=(root/'packages/core/templates/shared'/filename).read_text()
 assert 'unconditional — needs no extra install' not in text,filename
assert 'Nothing here is optional' not in (root/'packages/core/templates/shared/first-steps.source.json').read_text()
source=json.loads((root/'packages/core/templates/shared/first-steps.source.json').read_text())
for lane,data in source['toolchainLanes'].items():
 section=re.search(r'#### '+lane.title()+r'\n(.*?)(?=\n#### |\n---)',guide,re.S)
 assert section, lane
 commands=re.search(r'```bash\n(.*?)\n```',section[1],re.S)[1]
 assert commands=='\n'.join(data['verification']), 'Native SSOT/render drift: '+lane
if shutil.which('ast-grep') and shutil.which('ruff'):
 result=subprocess.run(['bash','-c',block[1]],cwd=consumer,text=True,capture_output=True)
 assert result.returncode==0,result.stdout+result.stderr
 (consumer/'app.py').write_text('eval("1 + 1")\n')
 # Preserve a valid consumer flow-list config that the installer refuses to augment.
 (consumer/'own-rules').mkdir()
 (consumer/'sgconfig.yml').write_text('ruleDirs: [own-rules]\n')
 bare=subprocess.run(['ast-grep','scan'],cwd=consumer,text=True,capture_output=True)
 assert bare.returncode==0, bare.stdout+bare.stderr
 result=subprocess.run(['bash','-c',block[1]],cwd=consumer,text=True,capture_output=True)
 assert result.returncode!=0 and 'getff-no-eval' in result.stdout+result.stderr,result.stdout+result.stderr
 (consumer/'app.py').write_text('from datetime import datetime\ndatetime.utcnow()\n')
 result=subprocess.run(['ruff','check','.','--config','.getff/ruff-bans.toml','--no-cache'],cwd=consumer,text=True,capture_output=True)
 assert result.returncode!=0 and 'TID251' in result.stdout+result.stderr,result.stdout+result.stderr
 print('Python guide walkthrough: clean GREEN, structural and ruff violations RED')
else:
 print('NOT PROVEN: native firing tools absent; delivered payload and lane routing verified')
print('PASS: actual setup Python install follows only delivered paths and native checks')
PY
