"""Pipeline shell regression tests. Controlled CLI fixtures are not factory E2E."""
import json
import os
import re
from pathlib import Path
import subprocess
import tempfile
import unittest

HELPERS = Path(__file__).resolve().parents[1] / "helpers"

class PipelineRuntime(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="pipeline runtime ")
        self.root = Path(self.temp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.env = dict(os.environ, PATH=str(self.bin) + ":" + os.environ["PATH"], MO_ORCH_HOME=str(self.root))
        # All external state is a controlled fixture; no real bridge or GitHub calls.
        self.stub("curl", 'exit 7')
        self.stub("npx", 'exit 9')
        self.stub("gh", 'printf \'%s\\n\' "${AUDIT_PRS:-[]}"; exit "${AUDIT_GH_RC:-0}"')

    def tearDown(self):
        self.temp.cleanup()

    def stub(self, name, body):
        p = self.bin / name
        p.write_text("#!/bin/bash\n" + body + "\n")
        p.chmod(0o755)

    def run_helper(self, name, *args, **env):
        return subprocess.run(["bash", str(HELPERS / name), *args], cwd=self.root,
                              env=dict(self.env, **env), text=True, capture_output=True, timeout=15)

    def test_list_cannot_skip_integer_collision_preflight(self):
        (self.root / "1").mkdir()
        p = self.run_helper("list-presets.sh")
        self.assertEqual(p.returncode, 2, p.stdout + p.stderr)
        self.assertIn("umbrella named as integer", p.stderr)
        self.assertNotIn("mode=", p.stdout)

    def test_presets_in_directory_with_spaces(self):
        presets = self.root / "custom presets"
        presets.mkdir()
        for name in ["zulu", "alpha"]:
            (presets / (name + ".json")).write_text(json.dumps({"description": name, "mode": "solo", "marker": None}))
        p = self.run_helper("list-presets.sh", MO_PRESETS_DIR=str(presets))
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual([row.split(" — ")[0] for row in p.stdout.splitlines()], ["alpha", "zulu"])

    def test_status_rejects_object_instead_of_pr_array(self):
        p = self.run_helper("render-status.sh", AUDIT_PRS='{"message":"API unavailable"}')
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn("PR status unknown", p.stdout)
        self.assertNotIn("open PRs", p.stdout)

    def test_status_rejects_failed_probe_even_with_valid_stdout(self):
        p = self.run_helper("render-status.sh", AUDIT_PRS='[{"number":42,"title":"stale","mergeable":"MERGEABLE"}]', AUDIT_GH_RC="1")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn("PR status unknown", p.stdout)
        self.assertNotIn("#42", p.stdout)
        self.assertNotIn("gh pr checks 42", p.stdout)

    def test_status_valid_pr_and_inspection_suggestion(self):
        p = self.run_helper("render-status.sh", AUDIT_PRS='[{"number":42,"title":"feature","headRefName":"feat","baseRefName":"staging","mergeable":"MERGEABLE"}]')
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn("#42 feature [feat → staging, mergeable=MERGEABLE]", p.stdout)
        self.assertIn("gh pr checks 42", p.stdout)
        self.assertNotIn("gh pr merge", p.stdout)

    def test_failed_questions_cli_stdout_does_not_establish_empty(self):
        cli = self.root / "packages/runtime-bridge/src/cli/questions.ts"
        cli.parent.mkdir(parents=True)
        cli.write_text("// controlled fixture\n")
        self.stub("npx", "echo '[]'; echo questions-unavailable >&2; exit 9")
        p = self.run_helper("render-status.sh")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn("parked question status unknown", p.stdout)
        self.assertNotIn("no parked questions", p.stdout)
        self.assertIn("questions-unavailable", p.stderr)

    def test_successful_questions_cli_empty_is_known(self):
        cli = self.root / "packages/runtime-bridge/src/cli/questions.ts"
        cli.parent.mkdir(parents=True)
        cli.write_text("// controlled fixture\n")
        self.stub("npx", "echo '[]'; exit 0")
        p = self.run_helper("render-status.sh")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn("no parked questions", p.stdout)
        self.assertNotIn("parked question status unknown", p.stdout)

    def test_missing_jq_is_a_probe_failure_not_empty_presets(self):
        minimal_bin = self.root / "no-jq-bin"
        minimal_bin.mkdir()
        (minimal_bin / "bash").symlink_to("/bin/bash")
        (minimal_bin / "dirname").symlink_to("/usr/bin/dirname")
        p = self.run_helper("list-presets.sh", PATH=str(minimal_bin))
        self.assertEqual(p.returncode, 2, p.stderr)
        self.assertIn("jq is required", p.stderr)
        self.assertNotIn("no presets available", p.stdout)

    def test_status_valid_empty_pr_array(self):
        p = self.run_helper("render-status.sh")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn("no open PRs", p.stdout)
        self.assertIn("parked question status unknown", p.stdout)

    def test_integer_name_collision_refuses(self):
        (self.root / "1").mkdir()
        p = self.run_helper("integer-name-guard.sh", str(self.root))
        self.assertEqual(p.returncode, 2)
        self.assertIn("umbrella named as integer", p.stderr)

    def test_integer_guard_does_not_depend_on_grep_or_temp_files(self):
        self.stub("grep", "echo unavailable >&2; exit 2")
        (self.root / "1").mkdir()
        p = self.run_helper("integer-name-guard.sh", str(self.root))
        self.assertEqual(p.returncode, 2)
        self.assertIn("umbrella named as integer", p.stderr)

    def test_noninteger_umbrella_allowed(self):
        (self.root / "sample").mkdir()
        p = self.run_helper("integer-name-guard.sh", str(self.root))
        self.assertEqual(p.returncode, 0, p.stderr)

    def test_wrapper_preserves_helper_failure_and_end(self):
        child = self.root / "failed-helper.sh"
        child.write_text("#!/bin/bash\necho partial\necho diagnostic >&2\nexit 23\n")
        child.chmod(0o755)
        p = self.run_helper("run-helper.sh", str(child))
        self.assertEqual(p.returncode, 23)
        self.assertIn("END rc=23", p.stdout)
        self.assertIn("diagnostic", p.stderr)

    def test_invocation_fence_preserves_invalid_override(self):
        source = (HELPERS.parent / "references/invocation.md").read_text()
        block = next(block for block in re.findall(r"```bash\n(.*?)```", source, re.S)
                     if "parse-override-flags.sh" in block)
        p = subprocess.run(["bash", "-c", block], cwd=HELPERS.parents[3],
                           env=dict(self.env, umbrella="sample --mode-solo --mode-pair"),
                           text=True, capture_output=True, timeout=15)
        self.assertEqual(p.returncode, 2, p.stdout + p.stderr)
        self.assertIn("multi-flag collision", p.stderr)

    def test_invalid_mode_override_is_not_no_override(self):
        p = self.run_helper("parse-override-flags.sh", "sample --mode-solo --mode-pair")
        self.assertEqual(p.returncode, 2)
        self.assertIn("multi-flag collision", p.stderr)

if __name__ == "__main__":
    unittest.main(verbosity=2)
