import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {isScrubbed,scrubHostEnv} from '/workspace/getff-native/packages/core/vitest.host-env.ts';
const mode=process.argv[2];
scrubHostEnv(process.env);
for(const key of ['MO_SKILLS_DIR','MO_AGENTS_DIR','MO_SKILLS_GLOBAL']) delete process.env[key];
if(mode==='fixture') {
 process.env.MO_SKILLS_DIR='/workspace/scratch/p20-catalog/skills';
 process.env.MO_AGENTS_DIR='/workspace/scratch/p20-catalog/agents';
 process.env.MO_SKILLS_GLOBAL='0';
}
const runner=await import('/workspace/getff-native/packages/core/principles/20-bundle-classification.ts');
const names=['backlog-1-clean.txt','backlog-2-mixed.txt','backlog-3-overlap.txt'];
const pairs=names.map(name=>[runner.HELPER,runner.FIXTURES+'/'+name]);
const start=performance.now(); const primed=await runner.primeCurate(pairs); const elapsedMs=performance.now()-start;
const outputs=Object.fromEntries(names.map((n,i)=>[n,runner.runCurate(...pairs[i])]));
const result={mode,elapsedMs,primed,outputs,seamScrubbed:Object.fromEntries(['MO_SKILLS_DIR','MO_AGENTS_DIR','MO_SKILLS_GLOBAL'].map(k=>[k,isScrubbed(k)]))};
writeFileSync('/workspace/scratch/p20-diagnosis-'+mode+'.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,outputs:undefined}));
