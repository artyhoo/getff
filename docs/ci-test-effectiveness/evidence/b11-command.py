import json, subprocess, sys, time, hashlib
from pathlib import Path
name, *command = sys.argv[1:]
t = time.monotonic()
r = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
log = Path('docs/ci-test-effectiveness/evidence/b11-' + name + '.txt')
log.write_bytes(r.stdout)
x = dict(command=command, exit=r.returncode, elapsedSeconds=round(time.monotonic()-t,6), log=str(log), logSHA256=hashlib.sha256(r.stdout).hexdigest())
log.with_suffix('.json').write_text(json.dumps(x, indent=2)+'\n')
print(json.dumps(x)); print(r.stdout.decode(errors='replace')[-3500:]); sys.exit(r.returncode)
