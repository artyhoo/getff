# demo/doc-drift-gate.tape — regenerate: `make demo`
# Shows a rule's own prose claim drift from the deterministic AGENTS.md
# rule-index it must match — the gate fails, naming the exact file that lied,
# with the fix command. Runs against this repo itself (self-application).

Output demo/doc-drift-gate.gif

Set Shell "bash"
Set FontSize 16
Set Width 1200
Set Height 600
Set Theme "Dracula"

Type "grep -n 'Fires:' .claude/rules/ci-tool-pinning.md"
Enter
Sleep 1s

# perl -pi (not `sed -i ''`): BSD-sed-only syntax breaks on the Linux CI
# runner that regenerates this GIF (demo-regen workflow) — the mutation would
# silently no-op and the recording would show a green gate instead of the
# drift failure. perl -pi is byte-identical in effect on macOS and Linux.
Type "perl -pi -e 's/editing .*workflows\/\*\*.*\./editing any workflow file./' .claude/rules/ci-tool-pinning.md"
Enter
Sleep 1s

Type "npx tsx scripts/render-rule-index.mjs --check"
Enter
Sleep 3s
