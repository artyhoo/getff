#!/usr/bin/env python3
"""Project-local reminder selection. Enrollment is trusted controller input, never payload.

Not an identity authenticator: the accepted transport must own and protect enrollment,
validate original message provenance, and arrange delivery before composition/action.
"""
import argparse
import base64
import fcntl
import hashlib
import json
import os
import sys
from pathlib import Path

TEXTS = Path(__file__).with_name('reminders.json')
OPERATIONS = {
    'executor': {'prepare': {'consult', 'report'}, 'consume': {'assignment', 'decision', 'rework'}},
    'senior': {'prepare': {'assignment', 'decision', 'rework'}, 'consume': {'consult', 'report'}},
}


def load(path):
    with open(path, encoding='utf-8') as stream:
        return json.load(stream)


def bound_context(enrollment, session, agent):
    if not isinstance(enrollment, dict) or not isinstance(enrollment.get('bridge_id'), str) or not enrollment['bridge_id']:
        raise ValueError('missing bridge identity')
    contexts = enrollment.get('contexts')
    if not isinstance(contexts, list):
        raise ValueError('missing contexts')
    matches = [c for c in contexts if isinstance(c, dict) and c.get('session_id') == session and c.get('agent_id') == agent]
    if not session or len(matches) != 1:
        raise ValueError('session/agent not uniquely enrolled')
    context = matches[0]
    if context.get('role') not in OPERATIONS:
        raise ValueError('unrecognized enrolled role')
    for field in ('identity', 'context_epoch', 'peer_identity'):
        if not isinstance(context.get(field), str) or not context[field]:
            raise ValueError('missing bound ' + field)
    return context


def select(enrollment, context, operation, source):
    parts = operation.split('-')
    if len(parts) != 2:
        raise ValueError('unsupported bridge operation')
    phase, kind = parts
    role = context['role']
    if kind not in OPERATIONS[role].get(phase, set()):
        raise ValueError('operation does not match enrolled role')
    if phase == 'consume':
        peers = [c for c in enrollment['contexts'] if isinstance(c, dict) and c.get('identity') == source]
        expected_role = 'senior' if role == 'executor' else 'executor'
        if source != context['peer_identity'] or source == context['identity'] or not peers or any(c.get('role') != expected_role for c in peers):
            raise ValueError('source is not the enrolled opposite-role peer')
    texts = load(TEXTS)
    text = texts[role][phase]
    if not isinstance(texts['version'], str) or not text or len(text.split()) > 60:
        raise ValueError('invalid reminder source')
    return phase, texts['version'], text


def deliver(state, enrollment, context, phase, version, text, reset=False):
    """Serialize this small ledger across adapters; atomic replacement preserves readers.

    This records output production, NOT model receipt. A lost native output must be
    retried via a fresh confirmed context epoch after the host diagnoses delivery.
    """
    state = Path(state)
    state.parent.mkdir(parents=True, exist_ok=True)
    with open(str(state) + '.lock', 'a', encoding='utf-8') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        ledger = load(state) if state.exists() else {'resets': {}, 'delivered': []}
        if not isinstance(ledger, dict) or not isinstance(ledger.get('resets'), dict) or not isinstance(ledger.get('delivered'), list):
            raise ValueError('invalid reminder ledger')
        scope = [enrollment['bridge_id'], context['session_id'], context['agent_id'], context['context_epoch']]
        scope_key = hashlib.sha256(json.dumps(scope).encode()).hexdigest()
        serial = ledger['resets'].get(scope_key, 0)
        if type(serial) is not int or serial < 0:
            raise ValueError('invalid context reset counter')
        if reset:
            serial += 1
            ledger['resets'][scope_key] = serial
        if text:
            key = scope + [serial, context['role'], phase, version]
            if key in ledger['delivered']:
                return ''
            ledger['delivered'].append(key)
        # Lock excludes writers; replace excludes torn JSON after interruption.
        temporary = state.with_name(state.name + '.tmp')
        with open(temporary, 'w', encoding='utf-8') as stream:
            json.dump(ledger, stream)
        os.replace(temporary, state)
        return text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binding', required=True)
    parser.add_argument('--state', required=True)
    parser.add_argument('--hook', action='store_true')
    parser.add_argument('--session', default='')
    parser.add_argument('--agent', default='')
    parser.add_argument('--operation', default='')
    parser.add_argument('--source', default='')
    parser.add_argument('--payload', type=Path)
    args = parser.parse_args()
    try:
        session, agent, operation, source = args.session, args.agent, args.operation, args.source
        reset = False
        event = ''
        if args.hook:
            request = json.load(sys.stdin)
            event = request.get('hook_event_name')
            if event not in ('SessionStart', 'UserPromptSubmit'):
                return 0
            session, agent = request.get('session_id'), request.get('agent_id', '')
            reset = event == 'SessionStart' and request.get('source') in ('compact', 'clear')
        if args.hook and not Path(args.binding).exists():
            return 0
        enrollment = load(args.binding)
        if args.hook and isinstance(enrollment, dict) and isinstance(enrollment.get('contexts'), list):
            if not any(isinstance(c, dict) and c.get('session_id') == session and c.get('agent_id') == agent for c in enrollment['contexts']):
                return 0
        context = bound_context(enrollment, session, agent)
        if args.hook:
            if reset:
                deliver(args.state, enrollment, context, '', '', '', reset=True)
            if context.get('native_event') != event:
                return 0
            if event == 'UserPromptSubmit':
                prompt = request.get('prompt')
                if not isinstance(prompt, str) or not isinstance(context.get('native_prompt_sha256'), str):
                    return 0
                if hashlib.sha256(prompt.encode('utf-8')).hexdigest() != context['native_prompt_sha256']:
                    return 0
            operation = context.get('native_operation', '')
            source = context.get('native_source', '')
            if not operation:
                return 0
        phase, version, text = select(enrollment, context, operation, source)
        # Read canonical bytes before claiming delivery; failed reads must not consume it.
        payload = args.payload.read_bytes() if args.payload else None
        text = deliver(args.state, enrollment, context, phase, version, text)
        if args.hook:
            if text:
                print(json.dumps({'event': event, 'context': text}))
        else:
            print(json.dumps({'additional_context': text,
                              'payload_base64': base64.b64encode(payload).decode() if payload is not None else None}))
        return 0
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        print('advisor-role-reminders: ' + str(error), file=sys.stderr)
        return 0 if args.hook else 2


if __name__ == '__main__':
    sys.exit(main())
