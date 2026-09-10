# beta-docs-showcase — DONE

- Final PR: #TBD
- Closed: 2026-09-10
- Summary: BS3 cutover complete — the Fumadocs site is the public getff.ai. Legs: (A)
  cold claims audit driven from STOP/18 GAPs to GO (9 rounds, final on `b782f51`:
  133 VERIFIED / 0 GAP / 8 UNVERIFIABLE-needs-human); (B) `bs3-cutover` merged into
  landing `main` as a merge commit (`8104eabf`, PR #5) + the missing `/docs/` index
  (PR #6, `ca7f8b77`), both deploys `success`, production census 20/20,
  `https://getff.ai/docs/` 404→200, draft announcement contained (0 hits in 6 surfaces),
  live search 3/3 against the fresh index; (C) BS0 prototype Pages retired
  (`artyhoo.github.io/getff-docs-smoke/` → 404; `beta.getff.ai` never existed — no-op).
  Stage report: `BS3-REPORT.md` at the landing repo root (GREEN; operator parks:
  visual sign-off, palette follow-up-if-disliked). Operator decision exercised and
  documented in `CLAIMS-LEDGER.md`: stack-count fork widened to the four shipped lanes.
  Framework defects surfaced by the audits are recorded as operator findings in the
  report (§Findings): 4× stale `first-steps.source.json` texts, the AI-USAGE-GUIDE
  pre-push trio, the stale `root-agents-demo.test.ts` comment, the pipeline
  «nothing queued» phantom, `tier-home.md` §3 stale cites, the kickoff `Type:`
  vocabulary fork, and the landing's missing vendored-render parity mechanism.
