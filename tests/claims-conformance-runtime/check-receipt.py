"""Check a real role response; this does not simulate role execution."""
import re
import sys
from pathlib import Path

response = Path(sys.argv[1]).read_text().replace("**", "")
expected = sys.argv[2]
match = re.search(r"Overall:\s*(GO|REVISE|STOP)\b", response)
assert match, "No machine-consumed overall verdict"
assert match[1] == expected, f"Expected {expected}; observed {match[1]}"
if expected == "GO":
    assert "UNVERIFIABLE-needs-human" not in response, "GO hides unresolved claims"
if "unknown" in sys.argv[1]:
    assert "UNVERIFIABLE-needs-human" in response, "Cross-platform uncertainty was lost"
if "gap" in sys.argv[1]:
    assert re.search(r"(?:—|\|)\s*GAP\b", response), "Measured line-count drift was lost"
print(f"PASS: {Path(sys.argv[1]).name} -> {expected}")
