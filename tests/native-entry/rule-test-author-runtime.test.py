"""Replay the audited role's material against a real single-rule ast-grep run.

This checks the captured astgrep workflow, not Claude availability or factory E2E.
Run: python3 tests/native-entry/rule-test-author-runtime.test.py
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "docs/superpowers/plans/rule-test-author-receipts/samples"
RULE_ID = "getff-researched-no-yaml-load"


class RuntimeMaterialTests(unittest.TestCase):
    def fire_material(self, filename):
        binary = shutil.which("ast-grep")
        self.assertIsNotNone(binary, "ast-grep is required; absence is not a passing test")
        with tempfile.TemporaryDirectory(prefix="rule-test-author-replay-") as directory:
            directory = Path(directory)
            rule = directory / "rule.yml"
            rule.write_bytes((SAMPLES / "rule.yml").read_bytes())
            before = hashlib.sha256(rule.read_bytes()).hexdigest()
            material = json.loads((SAMPLES / filename).read_text())[RULE_ID]
            verdicts = []
            for kind in ("bad", "good"):
                self.assertTrue(material[kind], "empty material cannot prove firing")
                for index, snippet in enumerate(material[kind]):
                    sample = directory / f"{kind}-{index}.py"
                    sample.write_text(snippet)
                    result = subprocess.run(
                        [binary, "scan", "--rule", str(rule), "--json=compact", str(sample)],
                        cwd=directory, capture_output=True, text=True, check=False,
                    )
                    diagnostics = json.loads(result.stdout)
                    ids = {diagnostic["ruleId"] for diagnostic in diagnostics}
                    expected = (result.returncode == 1 and ids == {RULE_ID}) if kind == "bad" else (
                        result.returncode == 0 and diagnostics == []
                    )
                    verdicts.append(expected)
                    print(filename, kind, index, "exit", result.returncode, "ids", sorted(ids))
            self.assertEqual(before, hashlib.sha256(rule.read_bytes()).hexdigest())
            return verdicts

    def test_inverted_material_reproduces_both_failures(self):
        self.assertEqual(self.fire_material("inverted.json"), [False, False])

    def test_fresh_checkout_native_repair_fires_every_sample(self):
        self.assertTrue(all(self.fire_material("codex-repaired.json")))

    def test_installed_consumer_native_repair_fires_every_sample(self):
        self.assertTrue(all(self.fire_material("consumer-repaired.json")))


if __name__ == "__main__":
    unittest.main()
