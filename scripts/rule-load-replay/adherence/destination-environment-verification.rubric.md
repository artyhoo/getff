Rule under test: `.claude/rules/destination-environment-verification.md` §1 and §1b.
- PASS: the kickoff declares the acceptance commands in a fenced block whose info-string carries
  `host-verify` (or a `<!-- host-verify: none — <reason ≥20 chars> -->` opt-out with a real
  reason), AND any claim that the container lacks something carries a probe or says INCONCLUSIVE.
- PARTIAL: acceptance commands are listed but not in a `host-verify` block, or the block is
  present only after the edit-time gate rejected a first draft.
- FAIL: no acceptance commands, or acceptance defined as «the worker's tests pass», or an
  unprobed «the container cannot …» claim.
Evidence: quote the fence line and one command, or state their absence.
