<!-- scope:ctx-stage-1-settings-handoff -->

Scope: CTX Stage 1 (Tier-0 index) settings.json handoff + budget accounting.

## Problem

CTX Stage 1 shrinks always-on rule context by (a) keeping 3 Tier-0 core rules
always-on, (b) rendering a one-line-per-rule digest (`.claude/rules/00-rule-index.md`
+ the `AGENTS.md` `rule-index` region), and (c) shipping alt-channels for the 4
no-`paths:` rules that would otherwise lose their only delivery channel if evicted.
The remaining step — actually excluding the 4 evicted rules' full bodies from
Claude Code's always-on `.claude/rules/*.md` auto-load, and wiring the new
`inject-memory-codification.sh` hook into `PostToolUse` — both require editing
`.claude/settings.json`, which is agent-deny-listed (`permissions.deny` blocks
`Edit`/`Write` on that file; the maintainer lands settings changes manually, per
[CLAUDE.md `Artifact Ownership Contract`]). This patch is the maintainer-applied
half of Stage 1: the exact JSON diff to hand-apply, plus the honest budget
accounting for what is realized only once it lands.

## The settings.json patch (hand-apply)

Two independent additions to `.claude/settings.json`:

**(1) `claudeMdExcludes` — a new top-level array** (does not exist in the file
today; this key name is the maintainer's own choice to make — CTX Stage 1 does not
invent Claude Code settings-schema keys, so verify the actual supported exclude
mechanism before applying literally). The 4 evicted rules:

```json
{
  "claudeMdExcludes": [
    ".claude/rules/recommendation-laziness-discipline.md",
    ".claude/rules/reviewer-discipline.md",
    ".claude/rules/memory-codification.md",
    ".claude/rules/egress-no-api-bypass.md"
  ]
}
```

**(2) `hooks.PostToolUse` — one new entry**, alongside the existing `inject-matching-rule.sh`
entry (`.claude/settings.json` around line 109-117 today):

```json
{
  "matcher": "Write",
  "hooks": [
    {
      "type": "command",
      "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/inject-memory-codification.sh\""
    }
  ]
}
```

Matcher is `Write` only (not `Edit|Write`) — the hook fires on the write-moment a
memory file is *created or overwritten*, mirroring `inject-matching-rule.sh`'s
event choice but narrowed to the single tool this hook's own `case "$TOOL" in Write)`
guard already enforces (the settings matcher and the in-script guard are
redundant-by-design, not conflicting).

## Budget fact (honest accounting)

Chars measured via `wc -c` on the 20 `.claude/rules/*.md` files as committed at the
end of Stage 1 (excludes `00-rule-index.md` itself, counted separately below).

| Group | Files | Chars | ≈Tokens (chars÷4) |
|---|---|---|---|
| **BEFORE** — all 20 rules (today's actual always-on set; no distinction made) | 20 | 265,657 | 66,414 |
| 3 Tier-0 core (never evicted) | 3 | 41,683 | 10,421 |
| 4 evicted (no-`paths:`) | 4 | 40,444 | 10,111 |
| 13 conditional (`paths:`-scoped, documented load-on-match) | 13 | 183,530 | 45,883 |
| `.claude/rules/00-rule-index.md` (the new digest) | 1 | 2,984 | 746 |

**What is TRULY always-on after Stage 1, honestly:**

- **If the maintainer has NOT yet applied the settings.json patch above:** all 20
  rules still auto-load in Claude Code exactly as before (CC's own `.claude/rules/*.md`
  auto-load has no `paths:`-conditional behavior documented as suppressing the
  always-on read — the `paths:` frontmatter is a *load-scoping* hint, not a proven
  exclude from the baseline auto-load population; this project's own rules treat
  the 13 `paths:`-rules as "documented-conditional", per the P4 resolution, but
  that is this project's own framing, not a verified CC runtime guarantee).
  **Realized savings = 0** until the patch lands.
- **Once the maintainer applies the patch:** the 4 evicted rules' full bodies stop
  auto-loading; the 13 `paths:`-rules remain (per the P4 resolution, no excludes
  were added for them — excluding a conditional rule is a no-op at best, a channel
  kill at worst, so Stage 1 deliberately does NOT touch them). Realistic honest
  floor = **3 core + the index** = 44,667 chars ≈ 11,166 tokens **always-on**,
  down from the naive 265,657 chars ≈ 66,414 tokens if every rule were always-on
  simultaneously — an **83.2% reduction in the worst-case always-on total**, but
  the 13 conditional rules still load in full (not summarized) whenever their
  `paths:` glob matches a file being worked on — this is not eliminated, only
  moved from "always" to "on-match".

**Caveat, stated plainly:** the P4 resolution's claim that `paths:`-rules are
"conditional, not always-on" is this project's *documentation* of CC's behavior
([CLAUDE.md `Build-vs-reuse invariant`], [`rule-enforcement-channel-selection.md §4`]),
not something this Stage independently re-verified against CC's runtime. If that
documented behavior is wrong (i.e. CC still loads the full body of every
`.claude/rules/*.md` file regardless of `paths:`, and `paths:` only affects some
secondary signal), the realized always-on floor could still be the naive 265,657
chars even after the settings patch lands — the settings.json
`claudeMdExcludes` mechanism itself is unverified by this Stage (the key name and
its actual effect on CC's auto-load population were not confirmed against a real
CC settings schema; this is exactly the kind of claim `recommendation-laziness-discipline.md`
requires evidence for, and none was gathered here beyond "the maintainer knows
the real mechanism to use when applying this patch"). Whoever applies this patch
should confirm the actual CC settings key/behavior before relying on this budget
figure.

## §1.7 self-reflexive note

**Forward-check:** complies with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md)
(this patch is doc-only, no CI mechanism proposed); complies with
[doc-authority-hierarchy.md §5](../../../.claude/rules/doc-authority-hierarchy.md) (folder-level
authority — `research-patches/README.md` owns the header, this file inherits it, scope-bound by
this file's own name); complies with [`recommendation-laziness-discipline.md`](../../../.claude/rules/recommendation-laziness-discipline.md)
(the budget-fact §Caveat above explicitly states the settings-key claim is UNVERIFIED, rather than
asserting it as backed fact — the honest form this rule requires when evidence is absent);
complies with [`CLAUDE.md` Artifact Ownership Contract](../../../CLAUDE.md) (this patch does NOT
edit `.claude/settings.json` itself — it hands the diff to the maintainer, respecting the
agent-deny-list rather than attempting to route around it via Bash/jq).

**Backward-check:** this patch does not supersede or edit any existing rule — it is the
maintainer-handoff companion to the CTX Stage 1 umbrella's Increments 1-4 (already committed:
`Fires:` lines on all 20 rules, `render-rule-index.mjs` + the two render targets, the pre-push/CI
ratchet, and the 4 evicted rules' alt-channels). Self-application (T15): the budget table above
counts this patch's own claims honestly against measured `wc -c` output (quoted inline), not
against recall — and the file explicitly flags the one unverified claim (the `claudeMdExcludes`
settings-key effect) rather than asserting it with false confidence, which is this patch's own
dogfood of the H1 recommendation-discipline reminder it cites.
