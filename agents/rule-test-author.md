---
name: rule-test-author
description: >-
  Writes or repairs the firing TEST MATERIAL for an EXISTING generated rule — the negative-test /
  bad-good samples the deterministic factory needs to prove a rule actually fires — then runs the
  lane's deterministic verification in single-rule isolation and quotes the tool verdict verbatim.
  Edits test material ONLY; never the emitted rule artifact (that is drift/hash-gated). Use when a
  consumer has a generated rule whose test material is missing, broken, or needs a bypass variant,
  and wants it verified without re-running the full research pass. NOT for creating new rules —
  that is /rule-research. Reports the edited material plus the quoted verdict; the LLM is allowed
  only here, behind the provenance gates the delivered material already carries.
tools: Read, Write, Bash, Grep, Glob
---

> **Authoritative for:** compatibility entry loading `.agents/roles/rule-test-author.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/rule-test-author.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
