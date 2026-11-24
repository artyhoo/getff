import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const repo=resolve(import.meta.dirname,'..');
const owner=mkdtempSync(join(tmpdir(),'plugin binding source '));
mkdirSync(join(owner,'.agents'),{recursive:true});
cpSync(join(repo,'.agents/procedures'),join(owner,'.agents/procedures'),{recursive:true});
const generated=spawnSync('bash',[join(repo,'scripts/generate-plugin-skills.sh')],{env:{...process.env,CLAUDE_PROJECT_DIR:owner},encoding:'utf8'});
assert.equal(generated.status,0,generated.stderr);
const names=['getff','tool-bootstrapping','ai-doc','rule-research','rule-tests','template-audit'];
const block=(slug,marker='plugin-native:bind')=>{
  const source=readFileSync(join(owner,'plugin/skills',slug,'SKILL.md'),'utf8');
  const binding=source.match(new RegExp(`<!-- ${marker} -->\\s*\x60\x60\x60bash\\n([\\s\\S]*?)\\x60\x60\x60`));
  assert.ok(binding,`${slug} needs a native plugin executable binding`); return binding[1];
};
// Documented prompt substitution model, NOT a native/model invocation.
const substitute=(text,args,skill,project)=>text.replace(/(\\?)\$(ARGUMENTS(?:\[\d+\])?|\d+)/g,(token,escape,key)=>{
  if(escape) return token.slice(1);
  if(key==='ARGUMENTS') return args.join(' ');
  const index=key.startsWith('ARGUMENTS')?Number(key.match(/\d+/)[0]):Number(key);
  return args[index] ?? token;
}).replaceAll('${CLAUDE_SKILL_DIR}',skill).replaceAll('${CLAUDE_PROJECT_DIR}',project);
const invoke=(slug,project,args=[],extra='',marker,mutant=false)=>{
  const env={...process.env};delete env.CLAUDE_PROJECT_DIR;delete env.CLAUDE_SKILL_DIR;
  const authored=block(slug,marker);
  const source=substitute(mutant?authored.replaceAll('\\$1','$1'):authored,args,join(owner,'plugin/skills',slug),project);
  return spawnSync('bash',['-c',source+extra,'plugin-fixture',...args],{cwd:join(project,'nested cwd with spaces'),encoding:'utf8',env});
};
test.after(()=>rmSync(owner,{recursive:true,force:true}));
function fixture(t){const project=realpathSync(mkdtempSync(join(tmpdir(),'plugin only project ')));mkdirSync(join(project,'nested cwd with spaces'));t.after(()=>rmSync(project,{recursive:true,force:true}));return project;}
test('six independently generated plugin skills bind native resources without an installed .agents tree',t=>{
  const project=fixture(t), nested=join(project,'nested cwd with spaces');
  for(const slug of names){
    const r=invoke(slug,project,['relative input with spaces.md','/absolute supplied.md','$1/$ARGUMENTS'],'\n_getff_require_resource SKILL.md || exit $?\nprintf "cwd=%s\\nroot=%s\\narg=%s\\nsecond=%s\\nthird=%s\\n" "$PWD" "$GETFF_PROJECT_ROOT" "${getff_arguments[0]}" "${getff_arguments[1]}" "${getff_arguments[2]}"');
    assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,`cwd=${nested}\nroot=${project}\narg=relative input with spaces.md\nsecond=/absolute supplied.md\nthird=$1/$ARGUMENTS\n`);
  }
  const r=invoke('ai-doc',project,['one with spaces','two with spaces','$1/$ARGUMENTS'],'\n_getff_require_resource anthropic-and-aif-residue.md || exit $?\ncat "$GETFF_SKILL_DIR/anthropic-and-aif-residue.md"');
  assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,readFileSync(join(owner,'plugin/skills/ai-doc/anthropic-and-aif-residue.md'),'utf8'));
});
test('public-slug consumer coexistence retains invocation-relative supplied arguments',t=>{
  const project=fixture(t);mkdirSync(join(project,'.agents/procedures/tool-bootstrapping'),{recursive:true});
  writeFileSync(join(project,'.agents/procedures/tool-bootstrapping/SKILL.md'),'real public installed marker\n');
  const r=invoke('tool-bootstrapping',project,['relative input.md'],'\n_getff_require_resource references/decision-format.md || exit $?\nprintf "%s\\n%s" "$GETFF_PROJECT_ROOT" "${getff_arguments[0]}"');
  assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,`${project}\nrelative input.md`);
});
test('missing actual required plugin resource rejects before any workflow action',t=>{
  const project=fixture(t), resource=join(owner,'plugin/skills/ai-doc/anthropic-and-aif-residue.md');
  const original=readFileSync(resource);rmSync(resource);
  try {const r=invoke('ai-doc',project,['one with spaces','two with spaces','$1/$ARGUMENTS'],'\n_getff_require_resource anthropic-and-aif-residue.md || exit $?\nprintf "UNREACHABLE"');assert.equal(r.status,2);assert.match(r.stderr,/missing plugin resource.*anthropic-and-aif-residue/);assert.equal(r.stdout,'');}
  finally {writeFileSync(resource,original);}
});
test('plugin template-audit preserves supplied paths before project checks without canonical marker',t=>{
  const project=fixture(t), relative='document with spaces.md';mkdirSync(join(project,'scripts'));
  writeFileSync(join(project,'scripts/check-delivered.sh'),'printf "plugin-project-check\\n"\n');
  const r=invoke('template-audit',project,[relative,'/absolute supplied.md'],'\nprintf "input=%s\\n" "${rendered_documents[@]}"\nbash scripts/check-delivered.sh','template-audit:bind');
  assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,`input=${join(project,'nested cwd with spaces',relative)}\ninput=/absolute supplied.md\nplugin-project-check\n`);
});

test('documented indexed substitutions are single-pass and escaped helper parameters stay literal',()=>{
  assert.equal(substitute('first=$0 second=$1 third=$2 literal=\\$1',['one with spaces','two with spaces','$1/$ARGUMENTS'],'unused','unused'),'first=one with spaces second=two with spaces third=$1/$ARGUMENTS literal=$1');
});
test('native project aliases normalize containment without changing logical input cwd',t=>{
  const project=fixture(t), alias=project+' symlink alias';symlinkSync(project,alias);t.after(()=>rmSync(alias));
  const env={...process.env,PWD:join(alias,'nested cwd with spaces')};delete env.CLAUDE_PROJECT_DIR;delete env.CLAUDE_SKILL_DIR;
  const source=substitute(block('template-audit','template-audit:bind'),[],join(owner,'plugin/skills/template-audit'),alias);
  const r=spawnSync('bash',['-c',source+'\nprintf "%s\\n%s" "$GETFF_PROJECT_ROOT" "$getff_invocation_cwd"'],{cwd:join(alias,'nested cwd with spaces'),env,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,`${project}\n${join(alias,'nested cwd with spaces')}`);
});

test('unescaped indexed helper parameter mutant rejects real resource with multiple supplied arguments',t=>{
  const project=fixture(t);
  const r=invoke('ai-doc',project,['one with spaces','two with spaces','$1/$ARGUMENTS'],'\n_getff_require_resource anthropic-and-aif-residue.md || exit $?\nprintf "UNREACHABLE"','plugin-native:bind',true);
  assert.equal(r.status,2);assert.match(r.stderr,/missing plugin resource.*two with spaces/);assert.equal(r.stdout,'');
});

test('template plugin preserves every unmarked executable workflow block',()=>{
  const unmarked=source=>source
    .replace(/<!-- template-audit:bind -->\s*```bash\n[\s\S]*?```/g,'')
    .replace(/<!-- getff:common-invocation-binding -->[\s\S]*?<!-- \/getff:common-invocation-binding -->/g,'')
    .match(/```bash\n[\s\S]*?```/g) ?? [];
  assert.deepEqual(unmarked(readFileSync(join(owner,'plugin/skills/template-audit/SKILL.md'),'utf8')),
    unmarked(readFileSync(join(repo,'.agents/procedures/template-audit/SKILL.md'),'utf8')));
});

test('published template npm runner executes from bound coexistence project and propagates valid/adverse exits',t=>{
  const project=fixture(t), source=readFileSync(join(owner,'plugin/skills/template-audit/SKILL.md'),'utf8');
  // Run the published unmarked command through real npm. The package script is an
  // explicit fixture artifact validator, not evidence of the framework Vitest audit.
  const runner=[...source.matchAll(/```bash\n([\s\S]*?)```/g)].map(match=>match[1])
    .find(command=>command.trim()==='npm --prefix packages/core run test:template-render');
  assert.ok(runner,'generated plugin dropped its published deterministic runner');
  mkdirSync(join(project,'.agents/procedures/template-audit'),{recursive:true});
  writeFileSync(join(project,'.agents/procedures/template-audit/SKILL.md'),'coexisting universal procedure marker\n');
  mkdirSync(join(project,'packages/core'),{recursive:true});mkdirSync(join(project,'scripts'));
  writeFileSync(join(project,'packages/core/package.json'),JSON.stringify({name:'template-runner-contract-fixture',scripts:{'test:template-render':'node ../../scripts/render-fixture-check.cjs'}}));
  writeFileSync(join(project,'scripts/render-fixture-check.cjs'),
    'const fs=require("node:fs"),path=require("node:path");const file=path.resolve(__dirname,"../rendered-fixture.txt");if(fs.readFileSync(file,"utf8")==="verified fixture artifact\\n"){console.log("RENDER-FIXTURE-PASS:"+file);}else{console.error("RENDER-FIXTURE-REJECT:"+file);process.exit(23);}\n');
  const artifact=join(project,'rendered-fixture.txt');writeFileSync(artifact,'verified fixture artifact\n');
  let r=invoke('template-audit',project,['document with spaces.md'], '\n'+runner,'template-audit:bind');
  assert.equal(r.status,0,r.stderr);assert.ok(r.stdout.includes('RENDER-FIXTURE-PASS:'+artifact));
  writeFileSync(artifact,'adverse malformed artifact\n');
  r=invoke('template-audit',project,['document with spaces.md'], '\n'+runner+'\nrunner_exit=$?; [ "$runner_exit" -eq 0 ] || exit "$runner_exit"\nprintf "ADVISORY-UNREACHABLE"','template-audit:bind');
  assert.equal(r.status,23,r.stdout+r.stderr);assert.ok(r.stderr.includes('RENDER-FIXTURE-REJECT:'+artifact));assert.ok(!r.stdout.includes('ADVISORY-UNREACHABLE'));
});
