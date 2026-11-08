from pathlib import Path
import json,time,subprocess,hashlib
root=Path('/workspace/getff-native'); p=root/'packages/core/skills/assign-skill.test.ts'; original=p.read_text();rows=[]
anchor='      ...extraEnv,\n'
fault="      ...extraEnv,\n      // One-shot held wrong-default routing; production helper remains untouched.\n      ...(extraEnv.MO_AGENTS_DIR === '' ? { MO_AGENTS_DIR: resolve(REPO_ROOT_REAL, 'agents') } : {}),\n"
assert original.count(anchor)==1
new=original.replace('  readFileSync,','  readFileSync,\n  renameSync,').replace("import { join, resolve, dirname }", "import { join, resolve, dirname, basename }")
anchorA="    expect(out).toMatch(/^recommended_skill: meta-orchestrator$/);"
addA=anchorA+"\n    // A unique owned name distinguishes this temp default catalog from a live one.\n    const ownedSkill = `owned-default-${basename(tmpRoot)}`;\n    renameSync(join(skillsDir, 'meta-orchestrator'), join(skillsDir, ownedSkill));\n    expect(runScript('I-phase-small', 'umbrella wave dependencies', {\n      MO_SKILLS_DIR: '', MO_AGENTS_DIR: '',\n    })).toBe(`recommended_skill: ${ownedSkill}`);"
assert new.count(anchorA)==1;new=new.replace(anchorA,addA)
anchorB="    expect(out).toMatch(/^recommended_agent: agents\\/compliance-verifier\\.md$/);"
addB=anchorB+"\n    const ownedAgent = `owned-default-${basename(tmpRoot)}`;\n    renameSync(join(agentsDir, 'compliance-verifier.md'), join(agentsDir, `${ownedAgent}.md`));\n    expect(runScript('fix', 'PR review substance check compliance', {\n      MO_SKILLS_DIR: '', MO_AGENTS_DIR: '',\n    }), 'default agent must come from the owned temporary catalog').toBe(`recommended_agent: agents/${ownedAgent}.md`);"
assert new.count(anchorB)==1;new=new.replace(anchorB,addB)
cmd=['npm','--prefix','packages/core','run','test','--','skills/assign-skill.test.ts','-t','B positive']
def run(name,want):
 t=time.monotonic();log=Path('/workspace/scratch/b10-default-'+name+'.txt')
 with log.open('w') as f:r=subprocess.run(cmd,cwd=root,stdout=f,stderr=subprocess.STDOUT)
 rows.append({'name':name,'command':cmd,'expectedExit':want,'actualExit':r.returncode,'wallSeconds':round(time.monotonic()-t,3),'log':str(log)})
 assert r.returncode==want,rows[-1]
 return log.read_text()
try:
 p.write_text(original.replace(anchor,fault)); run('old-basename-false-green',0)
 p.write_text(new.replace(anchor,fault)); red=run('unique-owned-red',1)
 assert 'default agent must come from the owned temporary catalog' in red
finally:
 # New permanent witnesses retained; held routing removed exactly.
 p.write_text(new)
result={'collision':'Live agents/compliance-verifier.md exists; old basename-only default positive actually passes under wrong live-agent routing.','rows':rows,'productionHelperUntouched':True,'heldRoutingRemoved':fault not in p.read_text(),'newOracleRetainsOriginalAssertions':True,'finalL5Sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
Path('/workspace/scratch/b10-default-held.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
