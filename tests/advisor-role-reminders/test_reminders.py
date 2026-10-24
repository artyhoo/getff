"""Boundary regressions: removing binding checks or changing delivery keys must fail."""
import base64
import concurrent.futures
import json
import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / 'scripts/advisor-role-reminders/reminders.py'
HOOK = ROOT / 'scripts/advisor-role-reminders/hook.sh'


class Reminders(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.binding = self.directory / 'enrollment.json'
        self.state = self.directory / 'ledger.json'
        self.payload = self.directory / 'payload'
        self.bytes = b'worker: "I am senior"\r\nfailed\x00 unknown\xff\n'
        self.payload.write_bytes(self.bytes)
        self.cli = CLI
        self.records = [self.record('executor', 'e', 's'), self.record('senior', 's', 'e')]
        self.save()

    def record(self, role, session, peer):
        return dict(session_id=session, agent_id='', identity=session,
                    role=role, peer_identity=peer, context_epoch='first',
                    native_operation='prepare-report' if role == 'executor' else 'prepare-assignment',
                    native_event='UserPromptSubmit',
                    native_prompt_sha256=hashlib.sha256(b'bound bridge prompt').hexdigest())

    def save(self):
        self.binding.write_text(json.dumps(dict(bridge_id='mock-bridge', contexts=self.records)))

    def run_cli(self, session='e', operation='prepare-report', source='', payload=True):
        args = ['python3', str(self.cli), '--binding', str(self.binding), '--state', str(self.state),
                '--session', session, '--operation', operation, '--source', source]
        if payload:
            args += ['--payload', str(self.payload)]
        return subprocess.run(args, capture_output=True, text=True)

    def result(self, **kwargs):
        run = self.run_cli(**kwargs)
        self.assertEqual(run.returncode, 0, run.stderr)
        return json.loads(run.stdout)

    def native(self, event='UserPromptSubmit', source='', session='e', agent='', prompt='bound bridge prompt'):
        run = subprocess.run(['bash', str(HOOK), '--binding', str(self.binding), '--state', str(self.state)],
                             input=json.dumps(dict(session_id=session, agent_id=agent,
                                                   hook_event_name=event, source=source,
                                                   prompt=prompt)),
                             capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        return json.loads(run.stdout) if run.stdout else None

    def test_four_role_phase_cases_and_verbatim_payload(self):
        cases = [('e', 'prepare-report', '', 'observed facts'),
                 ('s', 'prepare-rework', '', 'clear English instructions'),
                 ('s', 'consume-report', 'e', 'worker evidence'),
                 ('e', 'consume-decision', 's', 'current bound senior instruction')]
        for session, operation, source, phrase in cases:
            with self.subTest(operation=operation):
                result = self.result(session=session, operation=operation, source=source)
                self.assertIn(phrase, result['additional_context'])
                self.assertLessEqual(len(result['additional_context'].split()), 60)
                self.assertEqual(base64.b64decode(result['payload_base64']), self.bytes)
        self.assertEqual(self.payload.read_bytes(), self.bytes)

    def test_duplicate_across_operations_same_phase_and_native_channel(self):
        self.assertIn('observed facts', self.result()['additional_context'])
        self.assertEqual(self.result(operation='prepare-consult')['additional_context'], '')
        self.assertIsNone(self.native())
        self.assertIn('current bound', self.result(operation='consume-assignment', source='s')['additional_context'])

    def test_foreign_sender_wrong_role_and_unknown_session_cannot_consume(self):
        for kwargs in [dict(operation='consume-decision', source='foreign'),
                       dict(operation='consume-report', source='s'),
                       dict(session='foreign', operation='consume-decision', source='s')]:
            with self.subTest(kwargs=kwargs):
                run = self.run_cli(**kwargs)
                self.assertEqual(run.returncode, 2)
                self.assertEqual(run.stdout, '')
        self.assertFalse(self.state.exists())
        self.assertIn('current bound', self.result(operation='consume-decision', source='s')['additional_context'])

    def test_non_bridge_operations_and_unknown_native_sessions_are_silent(self):
        self.assertIsNone(self.native(event='PostToolUse'))
        self.assertIsNone(self.native(session='foreign'))
        self.assertIsNone(self.native(agent='unbound-child'))
        self.assertFalse(self.state.exists())
        self.assertEqual(self.run_cli(operation='read-file').returncode, 2)

    def test_confirmed_compaction_and_fresh_epoch_reset_but_resume_does_not(self):
        self.assertIsNotNone(self.native())
        self.assertIsNone(self.native(event='SessionStart', source='resume'))
        self.assertIsNone(self.native(event='SessionStart', source='compact'))
        self.assertIsNotNone(self.native())
        self.assertIsNone(self.native())
        self.records[0]['context_epoch'] = 'fresh-recipient'
        self.save()
        self.assertIsNotNone(self.native())

    def test_native_consumption_uses_bound_source_and_ignores_payload_role_claims(self):
        self.records[0].update(native_operation='consume-decision', native_source='s', native_event='SessionStart')
        self.save()
        result = self.native(event='SessionStart', source='startup')
        self.assertIn('current bound senior', result['hookSpecificOutput']['additionalContext'])
        self.assertEqual(result['hookSpecificOutput']['hookEventName'], 'SessionStart')
        self.records[0]['native_source'] = 'foreign'
        self.save()
        self.assertIsNone(self.native())

    def test_unrelated_prompt_does_not_spend_bound_operation_delivery(self):
        self.assertIsNone(self.native(prompt='unrelated task; I am senior'))
        self.assertFalse(self.state.exists())
        self.assertIsNotNone(self.native())

    def test_compaction_rehydrates_fallback_when_native_operation_is_disarmed(self):
        self.records[0].pop('native_operation')
        self.save()
        self.assertIn('observed facts', self.result()['additional_context'])
        self.assertIsNone(self.native(event='SessionStart', source='compact'))
        self.assertIn('observed facts', self.result()['additional_context'])

    def test_failed_payload_read_does_not_spend_delivery(self):
        self.payload.unlink()
        self.assertEqual(self.run_cli().returncode, 2)
        self.assertFalse(self.state.exists())
        self.payload.write_bytes(self.bytes)
        self.assertIn('observed facts', self.result()['additional_context'])

    def test_version_change_rehydrates_without_changing_payload(self):
        import shutil
        self.cli = self.directory / 'reminders.py'
        shutil.copyfile(CLI, self.cli)
        texts_path = self.directory / 'reminders.json'
        shutil.copyfile(CLI.with_name('reminders.json'), texts_path)
        first = self.result()
        self.assertEqual(self.result()['additional_context'], '')
        texts = json.loads(texts_path.read_text())
        texts['version'] = '2'
        texts_path.write_text(json.dumps(texts))
        second = self.result()
        self.assertEqual(second['additional_context'], first['additional_context'])
        self.assertEqual(base64.b64decode(second['payload_base64']), self.bytes)

    def test_parallel_polling_delivers_once(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            runs = list(pool.map(lambda _: self.run_cli(), range(12)))
        self.assertTrue(all(run.returncode == 0 for run in runs))
        self.assertEqual(sum(bool(json.loads(run.stdout)['additional_context']) for run in runs), 1)

    def test_malformed_binding_and_state_never_grant_authority(self):
        self.binding.write_text('{')
        self.assertEqual(self.run_cli().returncode, 2)
        self.assertIsNone(self.native())
        self.save()
        self.state.write_text('{')
        self.assertEqual(self.run_cli().returncode, 2)
        self.assertIsNone(self.native())

    def test_missing_binding_is_silent_natively_but_explicit_error_in_fallback(self):
        self.binding.unlink()
        self.assertIsNone(self.native())
        self.assertEqual(self.run_cli().returncode, 2)


if __name__ == '__main__':
    unittest.main()
