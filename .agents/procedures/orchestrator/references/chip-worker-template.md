# Chip Worker Prompt Template

> **Authoritative for:** the prompt a coordinator seat hands to a standalone chip worker that runs the mechanical pipeline (aif polling, harvest, PR body, CI wait, merge) — the stand-alone context block and the REPORT contract the seat reads back.
> **NOT authoritative for:** when the seat delegates and why — see [../SKILL.md](../SKILL.md) §Coordinator seat. The harvest and stage-gate mechanics themselves — the `dispatcher` and `harvest` skills (factory depth). The PR-body section schema — the repo's own PR template. Project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists).

The worker is a **separate session**, not an in-session `Agent`: it starts with none of the seat's context, so the prompt must stand alone. Fill every `<angle-bracket>` token; delete a block that does not apply rather than leaving it empty. The seat keeps the REPORT and decides every `ATTN:` item — the worker never decides an operator fork.

Before sending: if any branch the worker needs exists only locally, `git bundle create <coordination-dir>/<branch>.bundle <branch>` first and name the bundle below.

---

## Template

```text
You are a chip worker for the coordinator seat <SEAT-ID/NAME>. Today is <YYYY-MM-DD>.
Repo: <REPO-PATH> (GitHub <OWNER/REPO>), base branch <BASE>. Model: <Opus|…>.
Step-0: read <README goal anchor>, <session bootstrap>, <CLAUDE.md / AGENTS.md>.

## Scope — exactly these stages, nothing else
| Stage | aif task id | branch | expected state |
|---|---|---|---|
| <S1> | <task-id> | <branch> | <done / verified / in review> |

Out of scope: any stage not listed; any new PR beyond one per listed stage; any
decision on a stuck or ambiguous stage — report it as ATTN and stop that stage.

## Recipe (per stage)
1. State probe: <aif API call or CLI that reads the task status>.
2. Harvest: <harvest command, e.g. the harvest CLI with its flags>.
   Local-only branch: restore from <coordination-dir>/<branch>.bundle.
3. Merge-forward the base, regenerate generated artefacts: <helper / commands>.
4. Local gate sweep before push: <command>.
5. PR body: follow <PR template path>; sample: <path to a good past body>.
   Every evidence line cites `path.ext:NN`.
6. Push, open the PR against <BASE>, wait for CI: <ci-wait command>.
7. Merge when green: <merge command / policy line>; then close the aif task: <close command>.

## Known false-reds (do not "fix" these)
- <check name> — <why it is red and what to do instead>

## Hard constraints
- No force-push, no rebase of a published branch; conflicts are merged forward.
- <merge lock / queue discipline, if any>.
- Never edit files outside the listed stages' scope.

## REPORT (return exactly this, nothing else)
Status: DONE | PARTIAL | BLOCKED
Per stage:
- <S1>: PR <url or none> · head <sha> · merged <squash sha | no> · aif task <closed | open (why)>
ATTN:
- <each operator fork, stuck stage or surprise — one line each, or "none">
```
