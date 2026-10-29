#!/usr/bin/env bash
# Walk the copied tier-routing references at both npm contour depths.
set -euo pipefail
ROOT=${TEST_REPO_ROOT:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
python3 - "$ROOT" "$TMP" <<'PY'
import pathlib,sys,os,re,subprocess
root=pathlib.Path(sys.argv[1]);tmp=pathlib.Path(sys.argv[2]);bindir=tmp/'bin';bindir.mkdir()
for pm in ['npm','pnpm','yarn']:
 p=bindir/pm;p.write_text('#!/bin/sh\nexit 0\n');p.chmod(0o755)
env=os.environ.copy();env['PATH']=str(bindir)+os.pathsep+env['PATH']
for key in ['PROFILE','GETFF_PROFILE','GETFF_TOOLCHAIN','GETFF_TOOLCHAIN_REFRESH']:env.pop(key,None)
for profile in ['env','factory']:
 consumer=tmp/profile;consumer.mkdir();(consumer/'package.json').write_text('{"name":"tier-walk","version":"0.0.0"}\n')
 subprocess.run(['git','init','-q'],cwd=consumer,check=True)
 result=subprocess.run(['bash',str(root/'install.sh'),'ts-server','--profile',profile],cwd=consumer,stdin=subprocess.DEVNULL,env=env,text=True,capture_output=True,timeout=180)
 (tmp/(profile+'.log')).write_text(result.stdout+result.stderr)
 assert result.returncode==0,result.stdout[-2000:]+result.stderr[-1000:]
 delivered=consumer/'.ai-factory/tier-home.md';assert delivered.read_bytes()==(root/'packages/core/templates/shared/tier-home.md').read_bytes()
 text=delivered.read_text();section=text.split('**§5.1')[1].split('**§5.2')[0];block=re.search(r'```bash\n(.*?)\n```',section,re.S)[1]
 walk=subprocess.run(['bash','-c',block],cwd=consumer,text=True,capture_output=True)
 assert walk.returncode==0,'Copied consumer grep fails: '+walk.stderr
 assert walk.stdout and not walk.stderr,walk.stdout+walk.stderr
 common=['AGENTS.md','.ai-factory/tier-home.md','.ai-factory/DESCRIPTION.md','.ai-factory/ARCHITECTURE.md','.ai-factory/RULES.md','.claude/skills/night-mode/SKILL.md','.claude/skills/orchestrator/SKILL.md','.claude/skills/arch/SKILL.md','.ai-factory/skill-context/aif-review/SKILL.md','.ai-factory/skill-context/aif-rules-check/SKILL.md']
 factory=['.claude/skills/dispatcher/SKILL.md','.claude/vendor/runtime-bridge/src/kickoff.ts','.claude/vendor/runtime-bridge/src/AifHandoffBackend.ts','.ai-factory/skill-context/aif-orchestrator-discipline/SKILL.md']
 for path in common:
  assert path in text,path+' missing from context'
  assert (consumer/path).exists(),path+' missing from '+profile
 for path in factory:
  assert path in text,path+' missing factory qualification'
  assert (consumer/path).exists()==(profile=='factory'),(profile,path)
 assert 'Operator repo only' in text
 assert 'Historical operator census' in text
 assert 'README.md#why-this-exists' not in text
 assert '`CLAUDE.md' not in text
 for link in re.findall(r'\[Operator repo only[^\]]*\]\((https://github.com/artyhoo/getff/blob/[^)]+)\)',text):
  path=link.split('/blob/',1)[1].split('/',1)[1]
  assert (root/path).exists(),link
 assert '.claude/CLAUDE.md' not in text
 print('PASS: '+profile+' actual copy, installed ACT-ON paths, source markers and consumer grep')
PY
