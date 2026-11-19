<!-- scope: transport addendum to the advisor pattern — CC → Codex ring (fork-as-wake),
     ADVISOR.md locator contract, file-pull return, interim ring ownership. Successor doc to
     2026-08-10-advisor-pattern-design.md (parent left unedited: it sits at the 600-line
     markdown gate ceiling, .husky/pre-push:107). Design provenance: the Codex advisor's own
     design doc `_design-advisor-codex-layer-2026-10-06.md` in the coordination dir; landed
     2026-10-06 on the operator's explicit «го А». -->

# Advisor Codex transport — cross-harness ring addendum

> **Status:** LANDED-DESIGN — recipe validated live 2026-10-06 (fork turn completed; artifacts
> relocated by the asker). No transport service deployed — files and the CLI only.
> **Authoritative for:** the CC → Codex transport layer — the ADVISOR.md locator contract, the
> fork ring recipe, interim ring ownership, the file-pull return channel, degradation.
> **NOT authoritative for:** advisor rights, question classification, operator floor, ASK/ANSWERED
> semantics or lifecycle — [2026-08-10-advisor-pattern-design.md §§2–6](2026-08-10-advisor-pattern-design.md).
> Project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

## §0 Context

Operator directive 2026-10-06: add a thin Codex layer so the advisor pattern works across Codex
and Claude Code sessions. Interim topology: the advisor role is hosted in Codex (model pin
`gpt-6.1-sol`); local Claude Code sessions ask it. Measured same day on codex-cli 0.160.0:
`codex exec resume` into a desktop-open thread is refused («thread already has an active
writer» — the desktop holds the single-writer slot); `codex exec fork` completed a full advisor
turn (~305k tokens) with inherited context. The transport design was produced by the advisor
itself (`_design-advisor-codex-layer-2026-10-06.md`, coordination dir); its flag set was
mechanically re-verified on the installed CLI before landing.

SSOT: [prior-art-evaluations.md:274](../../meta-factory/prior-art-evaluations.md) (#201,
Anthropic Advisor tool — ADAPT). This layer reuses the existing mailbox, decision journal and
pull-twin; it adds only a transport recipe. No API gateway, runtime adapter, daemon, watcher,
new queue or model router.

## §1 ADVISOR.md locator (coordination dir)

One short `ADVISOR.md` in `~/.claude-coordination/rules-as-tests-aif/` carries: `role`,
`harness`, `seed_session_uuid` (verbatim — never guessed or inferred from the newest rollout),
`model_pin`, the §2 recipe, the ask-file glob, the decision-journal glob, spec paths, and the
ring-owner statement. It is a locator and recipe, not a fourth registry role or a second policy
spec. Its filename alone activates nothing — askers and the advisor read it explicitly. Durable
premises live in files, never in fork history.

## §2 Ring: CC → Codex

1. Publish the ask file first. Re-read it immediately before ringing; skip the ring if the ask
   is already answered or withdrawn.
2. Ring — exact recipe, UUID taken from ADVISOR.md, never from `--last`:

   ```bash
   advisor_dir="$HOME/.claude-coordination/rules-as-tests-aif"
   codex --ask-for-approval never exec --sandbox workspace-write --cd "$advisor_dir" \
     --skip-git-repo-check fork --model gpt-6.1-sol \
     "$(sed -n 's/^seed_session_uuid: //p' "$advisor_dir/ADVISOR.md")" \
     "<advisor role + absolute ask-file path; advisor answers in the file>"
   ```

3. `fork`, never `resume`: a desktop-open seed thread is single-writer; fork copies it into a
   NEW thread. Fork inherits the CALLER's cwd — `--cd` pins the workspace to the coordination
   dir, keeping repo access read-only under that sandbox.
4. Interim ring owner: the CC session that filed the ask; ONE fork per open ask; never two
   writers on one ask. (A single standing dispatch-owner serializing all consults is the design
   doc's target state — open question, not today's fact.)
5. Fork history is context, never truth: the advisor re-reads current files before judging.

## §3 Return: file-pull

No Codex → CC doorbell in interim. The advisor records the journal entry, then writes the
decision into the ask file's `## Answer` (parent-spec invariant: journal before completed
Answer). The asker re-reads its open asks at turn start and before acting on the blocked item.
CLI exit code 0 and stdout are NOT an answer; the file is.

## §4 Boundaries and degradation

The advisor writes only the ask Answer and the decision journal; repository code, commits, PRs,
merges, publication, runtime restarts and task unpause are not advisor actions. The parent
kill-switch still disables ringing while asks continue to land. Degradation: CLI/auth/model
missing, seed gone or child dead → keep the ask OPEN, record the observed delivery error,
continue unrelated work; if the seed is gone but Codex works, instantiate the SAME role fresh
via `exec` (no `fork <uuid>`) with the same flags. Root-level interim `_advisor-*.md` files are
not covered by the canonical ask gate — `DECISIONS_ENTRY_RE` at
[scripts/check-ask-files.sh:98](../../../scripts/check-ask-files.sh) applies to canonical
`session-bus/asks/*.md` only; do not claim their validation.

## §5 Relationship to the parent spec

The parent stays authoritative for rights, floor and lifecycle (§§2–6); this doc owns transport
only. The parent was not edited: it sits exactly at the 600-line markdown ceiling
([.husky/pre-push:107](../../../.husky/pre-push)), so the addendum ships as this successor
doc instead.
