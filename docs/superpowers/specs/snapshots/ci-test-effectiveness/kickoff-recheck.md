# Kickoff recheck

Scope: the execution handoff, not an audit of repository CI/tests.

- FIXED: S2 coordinator ceiling omitted root manifests/configs/install entrypoints and its own atomic kickoff paths. Each worker still needs exact audited paths and decision IDs.
- FIXED: a fresh checkout has no transported ignored current-decision registry. The umbrella now gives the existing helper-based restoration sequence, retains current revisions, refuses conflicting authority and requires plan-prep admission.
- VERIFIED: the portable PRD receipt, published semantic review, specification agreement and plan-prep admission were replayed successfully in a temporary Git repository containing archived authoritative inputs.
- VERIFIED: six-block/path validation, kickoff traps/host-verification declarations, regular-file Git modes and staged whitespace.

The first replay attempt omitted the existing intent reference directory from the test archive; restoring that directory corrected the probe setup. No product or CI test suite ran.
