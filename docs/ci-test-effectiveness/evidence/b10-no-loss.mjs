import ts from '/workspace/getff-native/node_modules/typescript/lib/typescript.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='97660705318614ca0318a672ab44f736c07289cb';
const hash=s=>createHash('sha256').update(s).digest('hex');
const original=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8'});
function cases(text){const sf=ts.createSourceFile('subject.ts',text,ts.ScriptTarget.Latest,true);const out=new Map();function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='it'&&ts.isStringLiteral(n.arguments[0]))out.set(n.arguments[0].text,n.getText(sf));ts.forEachChild(n,visit);}visit(sf);return out;}
const p='packages/core/principles/20-bundle-classification.test.ts';const old=cases(original(p)),now=cases(readFileSync(p,'utf8'));assert.equal(old.size,16);assert.equal(now.size,18);for(const [name,body] of old)assert.equal(now.get(name),body,name);
const twin='packages/core/principles/20-bundle-classification.paired-negative.test.ts';assert.equal(hash(original(twin)),hash(readFileSync(twin)));
const l5='packages/core/skills/assign-skill.test.ts';const oldL5=cases(original(l5)),newL5=cases(readFileSync(l5,'utf8'));assert.equal(oldL5.size,11);assert.deepEqual([...newL5.keys()],[...oldL5.keys()]);
const frozen=JSON.parse(readFileSync('.superpowers/sdd/ci-test-effectiveness/p20-frozen-expectations.json'));
for(const [name,want] of Object.entries(frozen.protectedBacklogHashes))assert.equal(hash(readFileSync('packages/core/principles/__fixtures__/bundle/'+name)),want);
for(const [name,record] of Object.entries(frozen.fixtureFiles))assert.equal(hash(readFileSync('packages/core/principles/__fixtures__/bundle/catalog/'+name)),record.sha256);
const changed=['packages/core/principles/20-bundle-classification.ts',p,l5,'packages/core/principles/__fixtures__/bundle/catalog/agents/p20-agent.md','packages/core/principles/__fixtures__/bundle/catalog/skills/p20-fixture/SKILL.md'];
const result={base,all16OriginalPositiveCallsByteIdentical:true,positiveCases:18,all11L5CaseNamesRetained:true,originalTwinByteIdentical:true,originalTwinCases:6,backlogAndFrozenCatalogHashesMatch:true,sourceHashes:Object.fromEntries(changed.map(p=>[p,hash(readFileSync(p))])),typecheckErrorsAtUnchangedSources:['packages/core/hooks/checks/pr-body-fidelity-bin.test.ts','packages/core/principles/37-required-context-completeness.test.ts','packages/core/principles/ci-test-invocations.ts'].map(p=>({path:p,equalToBase:hash(readFileSync(p))===hash(original(p))}))};
assert.ok(result.typecheckErrorsAtUnchangedSources.every(r=>r.equalToBase));writeFileSync('/workspace/scratch/b10-no-loss.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
