import json
from pathlib import Path
import subprocess
import tempfile
import unittest

HELPER = Path(__file__).with_name('enumerate.py')


class EnumerationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)

    def tearDown(self):
        self.tmp.cleanup()

    def track(self, name, body):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body)
        subprocess.run(['git', '-C', str(self.root), 'add', name], check=True)
        return target

    def run_helper(self, anchor='sample', cwd=None):
        return subprocess.run(['python3', str(HELPER), anchor], cwd=cwd or self.root,
                              text=True, capture_output=True)

    def test_canonical_and_legacy_alias_count_once_from_nested_cwd(self):
        self.track('.agents/hooks/a.sh', '# @dual-pair: sample\necho one\n')
        alias = self.root / '.claude/hooks/a.sh'
        alias.parent.mkdir(parents=True)
        alias.symlink_to('../../.agents/hooks/a.sh')
        subprocess.run(['git', 'add', '.claude/hooks/a.sh'], cwd=self.root, check=True)
        self.track('scripts/b.sh', '# @dual-pair: sample\necho two\n')
        (self.root / 'nested').mkdir()
        result = self.run_helper(cwd=self.root / 'nested')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['groups']['sample'],
                         ['.agents/hooks/a.sh', 'scripts/b.sh'])

    def test_legacy_checkout_and_sweep(self):
        self.track('.claude/hooks/a.sh', '# @dual-pair: sample\n')
        self.track('agents/b.md', '<!-- @dual-pair: sample -->\n')
        self.track('.claude/skills/c/SKILL.md', '<!-- @dual-pair: other -->\n')
        self.track('docs/narrative.md', '@dual-pair: forbidden\n')
        result = self.run_helper('--all')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(set(json.loads(result.stdout)['groups']), {'sample', 'other'})

    def test_exact_token_and_untracked_excluded(self):
        self.track('scripts/a.sh', '# @dual-pair: sample-long\n')
        (self.root / 'scripts/untracked.sh').write_text('# @dual-pair: sample\n')
        result = self.run_helper()
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)['groups'], {})

    def test_invalid_input_is_not_regex(self):
        self.track('scripts/a.sh', '# @dual-pair: sample\n')
        for argument in ['.*', 'sample; touch sentinel', '', '../sample']:
            result = self.run_helper(argument)
            self.assertEqual(result.returncode, 2, result.stdout)
            self.assertIn('invalid anchor', result.stderr)
        self.assertFalse((self.root / 'sentinel').exists())

    def test_missing_tracked_member_fails_closed(self):
        target = self.track('scripts/a.sh', '# @dual-pair: sample\n')
        target.unlink()
        result = self.run_helper()
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, '')
        self.assertIn('a.sh', result.stderr)

    def test_external_symlink_fails_closed(self):
        with tempfile.TemporaryDirectory() as outside:
            target = Path(outside) / 'external.sh'
            target.write_text('# @dual-pair: sample\n')
            link = self.root / 'scripts/external.sh'
            link.parent.mkdir()
            link.symlink_to(target)
            subprocess.run(['git', 'add', 'scripts/external.sh'], cwd=self.root, check=True)
            result = self.run_helper()
        self.assertEqual(result.returncode, 2)
        self.assertIn('escapes checkout', result.stderr)
        self.assertEqual(result.stdout, '')

    def test_binary_member_is_unknown_coverage(self):
        target = self.track('scripts/binary.dat', '# @dual-pair: sample\n')
        target.write_bytes(b'\xff# @dual-pair: sample\n')
        result = self.run_helper()
        self.assertEqual(result.returncode, 2)
        self.assertIn('binary anchor member', result.stderr)
        self.assertEqual(result.stdout, '')

    def test_non_repository_is_failure_not_empty_population(self):
        with tempfile.TemporaryDirectory() as outside:
            result = self.run_helper(cwd=outside)
        self.assertEqual(result.returncode, 2)
        self.assertIn('git', result.stderr)
        self.assertEqual(result.stdout, '')


if __name__ == '__main__':
    unittest.main()
