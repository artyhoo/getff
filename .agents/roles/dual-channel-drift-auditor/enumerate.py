"""Read-only tracked dual-pair population for the cold drift auditor."""
import json
from pathlib import Path
import re
import subprocess
import sys

SCOPES = ['.agents/hooks', '.agents/roles/*.md', '.agents/procedures',
          '.claude/hooks', 'agents', '.claude/skills', 'scripts', 'packages',
          '.husky', '.github']
MARKER = re.compile(r'@dual-pair:[ \t]*([A-Za-z0-9_-]+)(?=\s|$)')


def git(*args):
    result = subprocess.run(['git', *args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f'git exited {result.returncode}')
    return result.stdout


def main():
    if len(sys.argv) != 2 or (sys.argv[1] != '--all' and
                            not re.fullmatch(r'[A-Za-z0-9_-]+', sys.argv[1])):
        raise ValueError('invalid anchor: supply one literal anchor or --all')
    selected = sys.argv[1]
    root = Path(git('rev-parse', '--show-toplevel').strip()).resolve()
    files = git('-C', str(root), 'ls-files', '-z', '--', *SCOPES).split('\0')
    # Canonical paths win over discovery aliases, independently of git's sorting.
    files = sorted(filter(None, files), key=lambda p: (not p.startswith('.agents/'), p))
    seen = set()
    groups = {}
    for name in files:
        path = root / name
        real = path.resolve(strict=True)
        if not real.is_relative_to(root):
            raise ValueError(f'tracked member escapes checkout: {name}')
        if real in seen:
            continue
        seen.add(real)
        try:
            body = path.read_bytes().decode('utf-8')
        except UnicodeDecodeError:
            # git grep also treats binary payloads differently; never invent coverage.
            if b'@dual-pair:' in path.read_bytes():
                raise ValueError(f'unreadable binary anchor member: {name}')
            continue
        for anchor in sorted(set(MARKER.findall(body))):
            if selected == '--all' or selected == anchor:
                groups.setdefault(anchor, []).append(name)
    groups = {anchor: sorted(members) for anchor, members in sorted(groups.items())}
    print(json.dumps({'root': str(root), 'groups': groups}, indent=2))
    return 0 if groups else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError) as error:
        print(f'dual-channel-drift-auditor enumeration failed: {error}', file=sys.stderr)
        sys.exit(2)
