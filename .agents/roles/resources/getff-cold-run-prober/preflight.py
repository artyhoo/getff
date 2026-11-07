"""Read-only validation of the cold-run role's disposable Python consumer input."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tomllib

root = Path(sys.argv[1]).resolve()
failures = []
def check(label, ok, evidence):
    print(f"{label}: {'PASS' if ok else 'FAIL'} — {evidence}")
    if not ok:
        failures.append(label)

# (a) Delivered Python surface; config.yaml is not an installer artifact.
for name in (".claude/settings.json", ".claude/agents", ".mcp.json", "AGENTS.md",
             ".ai-factory/DESCRIPTION.md", ".ai-factory/RULES.md"):
    check("(a) " + name, (root / name).exists(), str(root / name))

# (b) Allow untouched installer rules, never a previously authored discipline.
try:
    baseline = json.loads((root / ".ai-factory/refresh-baseline.json").read_text())
    assert isinstance(baseline, dict)
    check("(b) install baseline", True, "refresh-baseline.json loaded")
except (OSError, ValueError, AssertionError) as error:
    baseline = {}
    check("(b) install baseline", False, str(error))
for folder in (".getff/astgrep-rules", ".getff/rules-research"):
    for file in sorted((root / folder).rglob("*")):
        if not file.is_file():
            continue
        relative = file.relative_to(root).as_posix()
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        untouched = folder == ".getff/astgrep-rules" and baseline.get(relative) == digest
        check("(b) " + relative, untouched, digest)
ruff = root / ".getff/ruff-bans.toml"
if ruff.exists():
    digest = hashlib.sha256(ruff.read_bytes()).hexdigest()
    check("(b) ruff bans", baseline.get(".getff/ruff-bans.toml") == digest, digest)

# (c) A symbolic name alone can dangle: require the remote commit too.
for arguments in (("symbolic-ref", "refs/remotes/origin/HEAD"),
                  ("rev-parse", "--verify", "refs/remotes/origin/HEAD^{commit}")):
    result = subprocess.run(["git", "-C", str(root), *arguments], capture_output=True, text=True)
    check("(c) " + arguments[0], result.returncode == 0,
          (result.stdout + result.stderr).strip())

# (d) Parse actual dependencies and require installed metadata for each one.
try:
    project = tomllib.loads((root / "pyproject.toml").read_text())
    deps = project.get("project", {}).get("dependencies", [])
    assert isinstance(deps, list) and deps and all(isinstance(dep, str) for dep in deps)
    normalize = lambda name: re.sub(r"[-_.]+", "-", name).lower()
    installed = set()
    for file in (root / ".venv").rglob("*.dist-info/METADATA"):
        match = re.search(r"^Name: (.+)$", file.read_text(), re.MULTILINE)
        if match:
            installed.add(normalize(match.group(1).strip()))
    for dep in deps:
        match = re.match(r"[A-Za-z0-9][A-Za-z0-9._-]*", dep)
        check("(d) " + dep, bool(match) and normalize(match.group()) in installed,
              "declared dependency / .venv metadata")
except (OSError, ValueError, AssertionError) as error:
    check("(d) Python project", False, str(error))
print("COLD-START-BROKEN" if failures else "COLD-START-READY")
sys.exit(1 if failures else 0)
