import json
from pathlib import Path
import subprocess
import tempfile
import unittest

HELPER = Path(__file__).with_name('overlap.py')


class OverlapTest(unittest.TestCase):
    def run_pair(self, left, right):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'a.ts').write_text(left)
            (root / 'b.ts').write_text(right)
            return subprocess.run(['python3', str(HELPER), str(root / 'a.ts'), str(root / 'b.ts')],
                                  capture_output=True, text=True)

    def test_identity_is_not_non_boilerplate_overlap(self):
        body = ('// packages/example/a.ts\n/**\n * Contract.\n *\n'
                ' * First substantive line.\n * Second substantive line.\n'
                ' * Third substantive line.\n * Fourth substantive line.\n'
                ' * (per .agents/rules/example.md).\n *\n'
                ' * @dual-pair: example\n */\nexport const X = 1;\n')
        result = self.run_pair(body, body)
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertEqual(output['raw']['lines'], 13)
        self.assertEqual(output['non_boilerplate']['lines'], 4)
        self.assertEqual(output['non_boilerplate']['left_start'], 5)
        self.assertTrue(output['excluded']['left'])

    def test_removed_lines_cannot_stitch_original_runs(self):
        body = 'first\nsecond\n\nthird\nfourth\n'
        result = self.run_pair(body, body)
        self.assertEqual(json.loads(result.stdout)['non_boilerplate']['lines'], 2)

    def test_raw_divergence_and_substantive_comments_are_retained(self):
        result = self.run_pair('// meaningful contract\ncode\nleft\n',
                               '// meaningful contract\ncode\nright\n')
        output = json.loads(result.stdout)
        self.assertEqual(output['raw']['lines'], 2)
        self.assertEqual(output['non_boilerplate']['lines'], 2)
        self.assertEqual(output['excluded']['left'], [])

    def test_unreadable_member_fails_not_zero_overlap(self):
        result = subprocess.run(['python3', str(HELPER), '/no-such-audit-member',
                                 '/no-such-second-member'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, '')
        self.assertIn('failed', result.stderr)


if __name__ == '__main__':
    unittest.main()
