"""Validate fixture audit finding separation and summary arithmetic on live output."""
import json
import re
import sys
from collections import Counter
from pathlib import Path

path = Path(sys.argv[1])
rows = [json.loads(line) for line in path.read_text().splitlines()]
if any(row.get('type') == 'result' for row in rows):
    result = [row for row in rows if row.get('type') == 'result'][-1]
    assert not result.get('is_error'), 'No completed Claude verdict'
    output = result['result']
else:
    output = [row['item']['text'] for row in rows
              if row.get('item', {}).get('type') == 'agent_message'][-1]
blocks = re.split(r'^#{2,6} Severity: (REVISE|ATTN)[^\n]*\n', output, flags=re.M)
severities = Counter(blocks[1::2])
assert severities == {'REVISE': 6, 'ATTN': 1}, f'Expected separate fixture issues, got {dict(severities)}'
sections = Counter()
for severity, block in zip(blocks[1::2], blocks[2::2]):
    section = re.search(r'^- \*{0,2}Section:\*{0,2}\s*(Forward-check|Backward-check|Trailer|Exemption|State/absence claims)', block, re.M)
    assert section, 'Missing Section in finding block'
    sections[section[1]] += 1
assert sections == {'Forward-check': 2, 'Backward-check': 1, 'Exemption': 1, 'State/absence claims': 2, 'Trailer': 1}, sections
# If numeric per-section counts are provided, they must agree with assigned blocks.
adverse = output[re.search(r'^#{2,6} Severity: (?:REVISE|ATTN)', output, re.M).start():]
for section, count in re.findall(r'^- (Forward-check|Backward-check|State/absence claims):[^\n]*?\((\d+)\s', adverse, re.M):
    assert int(count) == sections[section], f'{section}: summary {count}, actual {sections[section]}'
for claimed, severity in re.findall(r'(\d+)\s+(REVISE|ATTN)\b', adverse):
    assert int(claimed) == severities[severity], f'Overall {severity}: claimed {claimed}, actual {severities[severity]}'
print(f'PASS {path.name}: 6 independent REVISE, 1 ATTN; section counts reconcile')
