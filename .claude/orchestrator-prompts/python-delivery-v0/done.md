# python-delivery-v0 — DONE

- Final PR: #<S3-PR>
- Closed: 2026-07-12
- Summary: A Python consumer now runs `install.sh python` / `./setup python` and ends up with WORKING, FIRING enforcement — the pure-bash augment-first delivery layer (`setup.d/45-python.sh`) ships pre-rendered ast-grep structural rules + `sgconfig.yml` + ruff TID251/253 fast-path + isolated `.getff/ruff-bans.toml` (S1 #991) into the repo via a toolchain lane that never touches the npm flow (S2 #996), gated by a pinned `getff-python.yml` CI workflow (@ast-grep/cli@0.44.1 + ruff==0.15.21) and a post-install firing self-check that plants a violation in an OS temp dir and proves both lanes fire RED; S3 (this PR) closes the umbrella with an end-to-end proof on a fresh scratch consumer (configs land → planted violation fires RED on both lanes → clean file GREEN → CI template valid → byte-idempotent re-run), the INSTALL-FOR-AI.md Python-lane segment, and the README widening handed to the maintainer as a PREPARED DRAFT DIFF in the PR body (Artifact Ownership Contract). Cargo delivery stays render-only (no consumer-side firing proof — recorded trigger).

<!-- NOTE: `#<S3-PR>` is a placeholder — the assembly/merge session replaces it with the real S3 PR
     number at merge time (done.md is authored on the S3 branch per the orchestrator dispatch; the
     CLAUDE.md convention finalizes it at the last-stage PR merge). -->
