"""Reject swapped fixture verdicts and invented absence in recorded live reviews."""
import json
import re
import sys
from pathlib import Path

rows = [json.loads(line) for line in Path(sys.argv[1]).read_text().splitlines()]
results = [row for row in rows if row.get('type') == 'result']
if results:
    assert not results[-1].get('is_error'), 'Provider failure, not a completed review'
    output = results[-1]['result']
else:
    output = [row['item']['text'] for row in rows
              if row.get('item', {}).get('type') == 'agent_message'][-1]
clean = output.replace('*', '').replace('`', '')
mode = sys.argv[2]
if mode == 'batch':
    assert not re.search(r'positive\.md\s*[—:-]\s*REVISE\b', clean), 'Positive verdict swapped'
    assert not re.search(r'adverse\.md\s*[—:-]\s*GO\b', clean), 'Adverse verdict swapped'
    if not re.search(r'positive\.md\s*[—:-]\s*GO\b', clean):
        positive = re.search(r'^## positive\.md[^\n]*\n(.*?)(?=^## adverse\.md)', clean, re.M | re.S)
        assert positive and 'GO' in positive[1] and 'REVISE' not in positive[1], 'Missing correctly bound positive GO'
    assert 'adverse.md' in clean and 'REVISE' in clean, 'Missing adverse REVISE'
elif mode == 'positive':
    assert 'positive.md' in clean and 'GO' in clean
    assert not re.search(r'^#{2,6} Severity: REVISE', clean, re.M), 'False-positive finding in clean input'
elif mode == 'adverse':
    assert 'adverse.md' in clean and 'REVISE' in clean
    assert not re.search(r'positive\.md\s*[—:-]\s*REVISE\b', clean), 'Adverse findings attributed to positive'
else:
    raise ValueError(mode)
assert 'смещение 2 строки' not in output, 'Invented citation offset: fixture line 3 is exactly line 3'
assert 'marker absent from fixtures/' not in output, 'Invented absence contradicts fixture/Grep evidence'
assert not re.search(r'→\s*no matches\s*\(exit 1, count 0', output), 'Invented no-match result'
print('PASS', Path(sys.argv[1]).name, mode, 'input/expected-verdict binding')
