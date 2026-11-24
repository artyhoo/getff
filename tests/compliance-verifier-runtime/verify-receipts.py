"""Check recorded live audit evidence; never launch or bill an LLM in CI."""
import json
import sys
from pathlib import Path

receipts = Path(sys.argv[1])


def events(name):
    return [json.loads(line) for line in (receipts / f'{name}.jsonl').read_text().splitlines()]


def final(name):
    rows = events(name)
    if name == 'claude':
        return '\n'.join(row.get('result', '') for row in rows if row.get('type') == 'result')
    messages = [row['item']['text'] for row in rows
                if row.get('item', {}).get('type') == 'agent_message']
    assert messages, f'{name}: no final model evidence'
    return messages[-1]


def check_exit(name):
    receipt = json.loads((receipts / f'{name}.receipt.json').read_text())
    assert receipt['exit_status'] == 0, f'{name}: process failed'
    return receipt


for name in ('baseline', 'consumer', 'postfix', 'finalcodex'):
    receipt = check_exit(name)
    assert '$compliance-verifier' in receipt['input']
    output = final(name)
    # The summary may lead with both verdicts; check detailed sections separately.
    start = output.index('## positive.md')
    end = output.index('## adverse.md', start)
    positive, adverse = output[start:end], output[end:]
    assert 'GO' in positive and 'REVISE' not in positive
    assert 'REVISE' in adverse and 'ATTN' in adverse
    for token in ('convention.md:50', 'Backward-check', 'Exemption', 'never existed', 'Trailer'):
        assert token in adverse, f'{name}: missing finding {token}'
    commands = [row['item'] for row in events(name)
                if row.get('item', {}).get('type') == 'command_execution']
    source_reads = '\n'.join(row['command'] for row in commands)
    assert '.agents/skills/compliance-verifier/SKILL.md' in source_reads
    assert '.agents/roles/compliance-verifier.md' in source_reads
    assert any('convention.md' in row['command'] and 'Authoritative for' in row.get('aggregated_output', '')
               for row in commands), f'{name}: no actual citation read'
    # Optional consumer reference discovery can return rg's no-match status 1;
    # source/citation evidence is checked independently above.
    print(f'PASS {name}: native source loading, GO, REVISE dimensions, ATTN, citation read')

check_exit('missing')
missing = final('missing')
assert 'Вердикт GO/REVISE не выдан' in missing
assert 'входные данные отсутствуют' in missing
print('PASS missing: refused verdict without PR inputs')

check_exit('nested')
nested = final('nested')
assert 'COMPLIANCE-ROOT-20261009' in nested
assert 'REVISE' in nested and 'not-present.md' in nested
commands = [row['item'] for row in events('nested') if row.get('item', {}).get('type') == 'command_execution']
assert any('not-present.md' in row['command'] and row.get('exit_code', 0) != 0
           for row in commands), 'nested: missing file failure not preserved'
print('PASS nested: cwd binding, real failed read, no false GO')

for name in ('claude-before-fix', 'claude-postfix-batch', 'claude-final-positive'):
    check_exit(name)
    tools = [block['name'] for row in events(name) if row.get('type') == 'assistant'
             for block in row.get('message', {}).get('content', []) if block.get('type') == 'tool_use']
    assert tools and set(tools) <= {'Read', 'Glob', 'Grep'}
    print(f'PASS {name}: real execution with only read tools; workflow verdict checked separately')
for name, expected_error in (('claude-before-renewal', '429'),
                             ('claude-final-adverse', '429'),
                             ('claude-subscription-adverse', 'Not logged in')):
    receipt = json.loads((receipts / f'{name}.receipt.json').read_text())
    result = [row for row in events(name) if row.get('type') == 'result'][-1]
    assert receipt['exit_status'] != 0 and result.get('is_error')
    assert expected_error in result['result']
    print(f'UNVERIFIED {name}: preserved actual runtime blocker {expected_error}')
print('FAIL Claude report acceptance: swapped batch verdicts and incorrect citation-offset claim preserved in final-regression.receipt.json')
