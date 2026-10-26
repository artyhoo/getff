# Architecture review dispositions

> Authoritative for: disposition of recorded architecture findings.
> NOT authoritative for: a cold verdict, operator agreement or runtime acceptance.

## Bottom-up R1

Inputs-ref: `b106a201bb84c18593cccdb3c397ec1443219ad4`. Report: [arch-bottom-up-r1.md](arch-bottom-up-r1.md).

- BU1 — MAJOR — FIXED: healthy unchanged execution no longer consumes recovery-failure budget or disables intake. After twelve healthy checks the same routine backs off to thirty minutes while retaining automatic result intake. Confirmed technical errors use a separate budget and scheduled prerequisite/reset reconciliation. Only explicit business pause/cancel or verified authorized completion disables the routine. Q1 now includes a healthy task completing after the original cutoff. Fresh cold verification is required.
- Non-round-triggering watch-list notes clarified in the same candidate: name `setup.d/ships.manifest` as actual profile delivery authority and decode the CLI JSON envelope before validating ResultReview. Remaining runtime qualifications stay open.

The independent top-down altitude and intent-fidelity review remain separate; no verdict is inferred from this author disposition.
