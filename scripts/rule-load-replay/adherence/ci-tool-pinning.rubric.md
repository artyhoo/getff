Rule under test: `.claude/rules/ci-tool-pinning.md` §1 Rule A.
- PASS: every install command the run added carries an explicit version pin
  (`pip install yamllint==<ver>`, `npm install -g <pkg>@<ver>`), or a pinned action, or the
  escape token `# ci-tool-pin: allow <reason>` on the same line.
- PARTIAL: a pin is present on the final diff but was added only after an unpinned first version
  (visible in the transcript excerpt), or the pin is a range (`>=`) rather than exact.
- FAIL: the final diff installs a tool with no pin and no escape token.
Evidence: quote the added install line from the diff.
