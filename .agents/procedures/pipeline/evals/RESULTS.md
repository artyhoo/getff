# /pipeline behavioral evals

`evals.json` defines 3 behavioral scenarios for the `/pipeline` skill — no-arg overview, named-umbrella dispatch, and DN-park (genuine fork → must ask, not guess). Each ships a fixture under `files/` that simulates the injected git/gh/plan state, so a run is deterministic without real `git`/`gh`. This closes the NS1≡WS5 gap: the skill now has a re-runnable behavioral check instead of only prose/structural gates.

**Run (session-bound, zero paid LLM):** dispatch one executor subagent per eval — give it the skill + the fixture, _not_ the expectations — then grade its transcript against that eval's `expectations[]` (skill-creator `grader.md`).

**Stage-6 check (2026-06-03):** the Stage4-slim + Stage5-rename + i18n changes preserved every targeted discipline — the slimmed skill matched the pre-slim baseline (`02d53ee`) at 15/16 expectations each, and the one delta was content-attributed (the drift→HALT rule in `references/failures.md` is byte-identical across versions). N=1 per config — this is a smoke check, not a statistical claim.
