import subprocess,time,json,sys
from pathlib import Path
name=sys.argv[1];cmd=sys.argv[2:];log=Path('/workspace/scratch/b10-'+name+'.txt');t=time.monotonic()
with log.open('w') as f:r=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT)
x={'command':cmd,'cwd':str(Path.cwd()),'exitCode':r.returncode,'wallSeconds':round(time.monotonic()-t,3),'log':str(log)}
Path('/workspace/scratch/b10-'+name+'.json').write_text(json.dumps(x,indent=2)+'\n');print(json.dumps(x));print(log.read_text()[-2600:]);sys.exit(r.returncode)
