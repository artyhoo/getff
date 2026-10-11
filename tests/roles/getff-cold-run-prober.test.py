"""Execute the role's actual preflight fence against disposable installed-shape inputs."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
ROLE = ROOT / '.agents/roles/getff-cold-run-prober.md'

class ColdStartTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='cold-prober-test-')
        self.addCleanup(self.temp.cleanup)
        self.consumer = Path(self.temp.name) / 'consumer with spaces'
        self.consumer.mkdir()
        for name in ('.claude/settings.json', '.mcp.json', 'AGENTS.md',
                     '.ai-factory/DESCRIPTION.md', '.ai-factory/RULES.md'):
            file = self.consumer / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('{}')
        (self.consumer / '.claude/agents').mkdir()
        (self.consumer / 'pyproject.toml').write_text(
            '[project]\nname="fixture"\ndependencies=["sqlalchemy>=2.0"]\n')
        meta = self.consumer / '.venv/lib/python3.12/site-packages/SQLAlchemy-2.0.dist-info/METADATA'
        meta.parent.mkdir(parents=True)
        meta.write_text('Name: SQLAlchemy\nVersion: 2.0\n')
        baseline = {}
        for name in ('.getff/astgrep-rules/getff-no-eval.yml', '.getff/ruff-bans.toml'):
            file = self.consumer / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('installed payload\n')
            baseline[name] = hashlib.sha256(file.read_bytes()).hexdigest()
        (self.consumer / '.ai-factory/refresh-baseline.json').write_text(json.dumps(baseline))
        # Arbitrary installer bookkeeping must not count as an authored rule.
        (self.consumer / '.getff/rules-lock.python.json').write_text('{}')
        self.git('init', '-q', '-b', 'master')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                 'commit', '-q', '-m', 'fixture')
        self.git('fetch', '-q', '.', 'master:refs/remotes/origin/master')
        self.git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/master')

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.consumer), *args],
                              check=True, capture_output=True, text=True)

    def preflight(self, environment=None):
        text = ROLE.read_text()
        command = text.split('## Step 1', 1)[1].split('```bash\n', 1)[1].split('\n```', 1)[0]
        # Nested cwd + explicit path exercises input binding independent of cwd.
        return subprocess.run(['bash', '-c', command, 'preflight', str(self.consumer)],
                              cwd=ROOT / 'tests', env=environment, capture_output=True, text=True)

    def assertBroken(self):
        result = self.preflight()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn('COLD-START-BROKEN', result.stdout)

    def test_installed_payload_is_ready_without_config_yaml(self):
        result = self.preflight()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('COLD-START-READY', result.stdout)

    def test_existing_researched_rule_refuses(self):
        file = self.consumer / '.getff/rules-research/already.yml'
        file.parent.mkdir()
        file.write_text('id: already')
        self.assertBroken()

    def test_added_scan_rule_refuses(self):
        (self.consumer / '.getff/astgrep-rules/added.yml').write_text('id: added')
        self.assertBroken()

    def test_changed_installed_rule_refuses(self):
        (self.consumer / '.getff/astgrep-rules/getff-no-eval.yml').write_text('changed')
        self.assertBroken()

    def test_changed_ruff_ban_refuses(self):
        (self.consumer / '.getff/ruff-bans.toml').write_text('changed')
        self.assertBroken()

    def test_empty_dependencies_refuse(self):
        (self.consumer / 'pyproject.toml').write_text('[project]\ndependencies=[]\n')
        self.assertBroken()

    def test_missing_metadata_refuses(self):
        next((self.consumer / '.venv').rglob('METADATA')).unlink()
        self.assertBroken()

    def test_invalid_baseline_refuses(self):
        (self.consumer / '.ai-factory/refresh-baseline.json').write_text('{bad')
        self.assertBroken()

    def test_dangling_origin_head_refuses(self):
        self.git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/missing')
        self.assertBroken()

    def test_interpreter_failure_keeps_actual_exit_status(self):
        tools = Path(self.temp.name) / 'tools'
        tools.mkdir()
        python = tools / 'python3'
        python.write_text('#!/bin/sh\necho "controlled interpreter failure" >&2\nexit 42\n')
        python.chmod(0o755)
        environment = dict(os.environ, PATH=str(tools) + os.pathsep + os.environ['PATH'])
        result = self.preflight(environment)
        self.assertEqual(result.returncode, 42)
        self.assertIn('controlled interpreter failure', result.stderr)
        self.assertNotIn('COLD-START-READY', result.stdout)

    def test_missing_required_surface_refuses(self):
        (self.consumer / '.mcp.json').unlink()
        self.assertBroken()

if __name__ == '__main__':
    unittest.main()
