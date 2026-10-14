"""Measure original consecutive matching lines, preserving mandatory exclusions."""
import difflib
import json
from pathlib import Path
import re
import sys


def exclusion(line):
    text = line.strip()
    if text in {'', '*', '/**', '/*', '*/', '<!--', '-->'}:
        return 'empty line or comment delimiter'
    if text in {'then', 'else', 'fi', 'do', 'done', 'esac', '{', '}'}:
        return 'standalone control delimiter'
    if re.fullmatch(r'set -[A-Za-z ]+', text):
        return 'shell safety boilerplate'
    content = re.sub(r'^(?:#|//|\*|<!--)\s*', '', text).removesuffix('-->').strip()
    if re.match(r'@(?:dual-pair|cc-only-rationale|deviation-rationale|harness-posture):', content):
        return 'anchor or delivery metadata'
    if re.match(r'(?:spec:|spec-of:)', content):
        return 'specification pointer'
    if re.fullmatch(r'[.\w/-]+\.(?:sh|py|[cm]?js|tsx?|md)(?:[:#][\w./-]+)?', content):
        return 'standalone file path header'
    if re.fullmatch(r'\(?per [^\s]+\.(?:md|sh)(?:[^\n]*)', content):
        return 'standalone specification citation'
    return None


def measure(left, right):
    blocks = difflib.SequenceMatcher(None, left, right, autojunk=False).get_matching_blocks()
    raw = max(blocks, key=lambda block: block.size)
    best = {'lines': 0, 'left_start': None, 'right_start': None}
    excluded_left = [exclusion(line) for line in left]
    excluded_right = [exclusion(line) for line in right]
    for block in blocks:
        length = 0
        for offset in range(block.size):
            if excluded_left[block.a + offset] or excluded_right[block.b + offset]:
                length = 0
                continue
            length += 1
            if length > best['lines']:
                best = {'lines': length, 'left_start': block.a + offset - length + 2,
                        'right_start': block.b + offset - length + 2}
    return {'raw': {'lines': raw.size, 'left_start': raw.a + 1 if raw.size else None,
                    'right_start': raw.b + 1 if raw.size else None},
            'non_boilerplate': best,
            'excluded': {'left': [{'line': i + 1, 'kind': kind} for i, kind in enumerate(excluded_left) if kind],
                         'right': [{'line': i + 1, 'kind': kind} for i, kind in enumerate(excluded_right) if kind]}}


if __name__ == '__main__':
    try:
        if len(sys.argv) != 3:
            raise ValueError('supply exactly two enumerated member paths')
        paths = [Path(argument).resolve(strict=True) for argument in sys.argv[1:]]
        result = measure(*(path.read_text().splitlines() for path in paths))
        print(json.dumps({'members': [str(path) for path in paths], **result}, indent=2))
    except (OSError, UnicodeError, ValueError) as error:
        print(f'dual-channel-drift-auditor overlap failed: {error}', file=sys.stderr)
        sys.exit(2)
