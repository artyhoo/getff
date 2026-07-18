<!-- scope:mutation-discipline-stage-d6 -->
# Research Patch — deps-hash-check.sh duplication (D.6)

> **Scope:** mutation-discipline Stage 4 D.6 — investigate the two byte-identical copies of `deps-hash-check.sh`.
> **Phase:** R-phase only. No file deletions, no symlink creation, no source edits.
> **Deliverable:** verdict + fix path for I-phase.
> **Origin:** mutation-discipline umbrella kickoff `.claude/orchestrator-prompts/mutation-discipline-umbrella/kickoff.md:111 + T17 :130`. D.1–D.5 shipped (PR #381). D.6 on the «investigate-first» track per T17.
> **Post-merge status note (added 2026-07-17, archival convention — the 2026-06-02 body below is NOT rewritten):** the §5(b) verdict **was implemented in I-phase PR #383** (`aa5111844`, merged 2026-06-03) — `@dual-pair: deps-hash-check-dogfood` marker + the byte-identity test at `deps-hash-check.test.ts` (`describe('… byte-identity (@dual-pair: deps-hash-check-dogfood)')`) both shipped, byte-identity actively enforced. **IMPORTANT correction to §6 below:** §6 prescribes ASYMMETRIC markers (File 1 dogfood gets a 4-line `# spec:` block, File 2 source gets a 1-line `@dual-pair`), but the I-phase kickoff (`.claude/orchestrator-prompts/mutation-discipline-d6-iphase-meta-launch/kickoff.md:13`) deliberately overrode this — byte-identity is the binding constraint, so BOTH copies got the SAME marker block (asymmetric markers would have broken the byte-identity test on first run). **Read §6 as the R-phase proposal, NOT as the shipped spec** — the shipped reality is symmetric markers, enforced by the test. Also note: the §6/§2 line-refs (`install.sh:261-265`, `copy_safe`, `1754 bytes`, `check-hook-marker.sh:42`) were correct at 2026-06-02 authoring but are stale on today's staging (`install.sh:421-426` via `refresh_safe` post-#615/#719; file now 3197 bytes via #383/#598/#1018; marker gate at `check-hook-marker.sh:54`). The D.6 verdict itself remains load-bearing — it is the origin of the `@dual-pair` byte-identity invariant that the active deps-hash-multistack umbrella reuses as its STOP-line.

---

## §1 The question

Two files exist with identical content:

- `packages/core/hooks/deps-hash-check.sh` — 1754 bytes, permissions 644
- `.claude/hooks/deps-hash-check.sh` — 1754 bytes, permissions 755

D.6 asks: **symlink? duplicate? race?** — and what to do about it.

---

## §2 Lead verification (T3 — every lead confirmed with file:line + command output)

### Lead 1 — `packages/core/hooks/deps-hash-check.sh` is the SHIPPED SOURCE

**Status: CONFIRMED**

`install.sh:261–265` (verbatim):

```bash
HOOK_SRC="$PKG_ROOT/packages/core/hooks/deps-hash-check.sh"  # line 261
HOOK_DST="$PROJECT_ROOT/.claude/hooks/deps-hash-check.sh"    # line 262
if [ -f "$HOOK_SRC" ]; then
  copy_safe "$HOOK_SRC" "$HOOK_DST"                          # line 264
  chmod_safe +x "$HOOK_DST" 2>/dev/null || true              # line 265
fi
```

`install.sh:164–186` — `copy_safe` skips the copy if `$HOOK_DST` already exists (without `--force`):

```bash
if [ -e "$dst" ] && [ "$FORCE" != "--force" ]; then
  SKIPPED+=("$dst")
  echo "  ⊝ $dst (exists — skipping; use --force to overwrite)"
  return 0
fi
```

**Implication:** `packages/core/hooks/deps-hash-check.sh` is what consumers receive. When `install.sh` runs against a fresh consumer project, it copies this file into the consumer's `.claude/hooks/deps-hash-check.sh` and makes it executable (chmod +x). Re-running `install.sh` without `--force` skips the copy if the destination already exists.

### Lead 2 — `.claude/hooks/deps-hash-check.sh` is THIS repo's DOGFOOD copy

**Status: CONFIRMED**

`.claude/settings.json:61–77` (verbatim):

```json
"hooks": {
  "UserPromptSubmit": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/inject-session-bootstrap.sh\""
        }
      ]
    },
    {
      "hooks": [
        {
          "type": "command",
          "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/deps-hash-check.sh\""  // line 74
        }
      ]
    }
  ],
```

`.claude/hooks/deps-hash-check.sh` is wired live in this repo's own CC session as a `UserPromptSubmit` hook — it fires on every user prompt in the maintainer's dev environment.

**How it got here:** This repo dogfoods `install.sh` on itself. At some point `install.sh` was run against this repo (or the file was copied manually), creating `.claude/hooks/deps-hash-check.sh`. That file was then committed to git and has been maintained alongside the source ever since.

**Git-tracked:** both files are tracked — confirmed via `git ls-files`:

```text
.claude/hooks/deps-hash-check.sh
packages/core/hooks/deps-hash-check.sh
```

### Lead 3 — byte-identical but NOT symlinks, different perms

**Status: CONFIRMED**

```text
$ ls -la .claude/hooks/deps-hash-check.sh packages/core/hooks/deps-hash-check.sh
-rwxr-xr-x 1 node node 1754 May 31 15:11 .claude/hooks/deps-hash-check.sh
-rw-r--r-- 1 node node 1754 May 31 15:11 packages/core/hooks/deps-hash-check.sh

$ diff .claude/hooks/deps-hash-check.sh packages/core/hooks/deps-hash-check.sh
(no output — FILES ARE IDENTICAL)
```

- Both are regular files (not symlinks — `file` command unavailable in this env, but `ls -la` shows no `->` pointer)
- `.claude` copy: 755 (executable) — set by `chmod_safe +x` in `install.sh:265`
- `packages` copy: 644 (non-executable) — the committed source, not executed directly

**Perm difference explained:** The `packages` copy is the source file; it is never executed directly (it is copied TO a destination and THEN made executable). The `.claude` copy is the deployed instance, made executable by install.sh.

### Additional finding (T13 — ADOPTED items carry their own risks)

**`packages/core/hooks/deps-hash-check.test.ts:34` tests the DOGFOOD copy, NOT the source:**

```typescript
const HOOK = resolve(REPO_ROOT, '.claude/hooks/deps-hash-check.sh');  // line 34
```

The test's `REPO_ROOT` resolves to the repo root, so `HOOK` = `.claude/hooks/deps-hash-check.sh` (the dogfood copy), NOT `packages/core/hooks/deps-hash-check.sh` (the source).

**Drift risk:** If the source (`packages/core/hooks/deps-hash-check.sh`) is edited without also updating the dogfood copy (`.claude/hooks/deps-hash-check.sh`), tests PASS (they test the dogfood, which is unchanged) but the shipped source would be stale. This is the key silent-drift hazard D.6 was asked to investigate.

### Additional finding — missing delivery-channel marker

**`.claude/hooks/deps-hash-check.sh` has NO `@dual-pair` or `@cc-only-rationale` marker.**

The `check-hook-marker.sh` PostToolUse gate (`check-hook-marker.sh:42`) requires every `.claude/hooks/*.sh` to carry one of these markers. Running the §6 marker check from `dual-implementation-discipline.md` confirms the gap:

```text
MISSING marker: check-doc-authority.sh
MISSING marker: deps-hash-check.sh       ← our file
MISSING marker: inject-session-bootstrap.sh
MISSING marker: validate-prompt.sh
```

The `dual-implementation-discipline.md §9 "Current state at codification"` explicitly acknowledges these 4 missing markers as expected starting-state, noting the rule is «forward-going: existing artefacts receive markers at next touch».

---

## §3 Build-vs-reuse search (BFR §3 — mandatory before any fix proposal)

### §3.1 — In-repo prior art: `@dual-pair` / `# spec:` convention

`dual-implementation-discipline.md §5–§7` defines the in-repo precedent for exactly «two copies of one logic, kept in sync»:

- `# @dual-pair: <anchor>` in bash scripts (both files share the same anchor string)
- `# spec: <path-to-source>` in the deployed copy (points to the authoritative spec)
- Mechanical drift-check: `grep -rl '@dual-pair:' .claude/hooks/ | while read hook; do anchor=...; match=$(grep -rl "@dual-pair:.*$anchor" agents/ .claude/skills/); echo "DRIFT: $hook"; done`

**Live example in this repo (SSOT #87, PR #300):**
```bash
# .claude/hooks/worktree-setup.sh
# @dual-pair: worktree-create-setup
# spec: docs/meta-factory/research-patches/2026-05-30-worktree-create-dual-channel.md §6
```
```bash
# scripts/create-worktree.sh
# @dual-pair: worktree-create-setup
# spec: docs/meta-factory/research-patches/2026-05-30-worktree-create-dual-channel.md §6
```

The `worktree-create-setup` pair is the first counted dual-channel pair toward the `§9` promotion threshold. Adding a `deps-hash-check-dogfood` pair would be the second.

### §3.2 — External prior art: symlink-based source-copy sync

Cross-worktree symlink sync: SSOT #110 (`scripts/link-coordination.sh`, ADAPT — `thesunny/worktree-env-sync` reference). The symlink mechanism is established as a valid approach for gitignored coordination files. However, SSOT #110 is for gitignored SSOT files shared across worktrees — not for tracked repo files that have a source-vs-deployed relationship.

No external prior art for «symlink a committed CC hook to its own packages/core source within the same repo» was found. The `@dual-pair` drift-check is the in-repo answer to this problem class.

### §3.3 — Verdict on build-vs-reuse

The `@dual-pair` drift-check is the repo's own established pattern for «two copies of one logic, kept in sync». No new mechanism is required. **REUSE the `@dual-pair` / `# spec:` convention (SSOT #87 precedent).**

---

## §4 Candidate verdicts — trade-off table

| # | Verdict | Mechanism | Pros | Cons | Risk |
|---|---------|-----------|------|------|------|
| **(a)** | Symlink `dogfood → source` | `ln -sf ../../../packages/core/hooks/deps-hash-check.sh .claude/hooks/deps-hash-check.sh` | Zero drift possible; true SSOT | `install.sh copy_safe` with `--force` replaces symlink with file copy (regression); cross-platform (Windows requires admin for symlinks); git tracks symlinks differently; `packages/core` source is 644 — symlink's effective permissions are target's; `check-hook-marker.sh` gate would need to handle symlinks | Medium — the `install.sh --force` overwrite is a concrete regression path |
| **(b)** | Keep both + drift-check | Add `# @dual-pair: deps-hash-check-dogfood` + `# spec: packages/core/hooks/deps-hash-check.sh` to both files; add byte-identity assertion test | Fits existing `@dual-pair` convention (SSOT #87); CI catches drift; resolves missing marker; no change to install.sh or existing perms | Two files still exist; developer must update both on edits (but test catches any failure to do so) | Low — the drift-check is the canonical enforcement mechanism |
| **(c)** | Generate dogfood from source | Add a Makefile / `package.json` script `sync-hooks` that copies source → dogfood | Clear data flow | New mechanism (a BUILD per BFR §3); adds complexity; doesn't eliminate drift between runs; no upstream prior art found | Medium — adds tooling without eliminating the two-file situation |
| **(d)** | Leave as-is | No change | Zero effort | Silent drift possible; existing test tests dogfood not source; no enforcement | High — the test passes even if source diverges (confirmed by T13 additional finding above) |

---

## §5 Recommended verdict: **(b) Keep both + drift-check**

**Rationale:**

1. **Fits existing `@dual-pair` convention** — no new mechanism. `dual-implementation-discipline.md §5–§7` is the in-repo answer to «two copies, keep in sync». SSOT #87 establishes `worktree-create-setup` as the precedent. Adding `deps-hash-check-dogfood` is the second pair, within the §9 counting model.

2. **Resolves the missing marker** — adding `# @dual-pair: deps-hash-check-dogfood` to `.claude/hooks/deps-hash-check.sh` satisfies the `check-hook-marker.sh` PostToolUse gate for future edits to that file.

3. **The `# spec:` pointer** on the dogfood copy (`# spec: packages/core/hooks/deps-hash-check.sh`) makes the source explicit for any editor, removing the T13 / T16 ambiguity about which file is authoritative.

4. **Symlink (a) rejected** because: `install.sh copy_safe --force` would silently replace the symlink with a regular file on next forced re-install; cross-platform Windows risk; `packages` source is 644 (non-executable), making the symlink target non-executable without `bash` invocation — which works for the current `settings.json` pattern (`bash "..."`) but is brittle. Most importantly: (a) introduces a NEW mechanism not currently used in this repo's hook layer, violating BFR §3 (BUILD only after §3 confirms no upstream / in-repo precedent).

5. **Verdict (d) rejected** because the T13 finding confirms silent drift IS possible today: tests pass even if source changes without updating the dogfood copy.

**Wrong if:**
- The symlink approach works reliably on Windows AND the install.sh `--force` path is hardened to detect and preserve symlinks AND there is operator confirmation that cross-platform portability is required here. In that case (a) becomes viable.
- The project decides that the dogfood copy is not a committed artifact but a gitignored deployment artifact (would require removing `.claude/hooks/deps-hash-check.sh` from git tracking). That would be a different framing with a different fix path.

---

## §6 Concrete fix path (I-phase)

**File 1:** `.claude/hooks/deps-hash-check.sh` — add delivery-channel markers (lines 2–3, replacing current `# Consumer-facing UserPromptSubmit hook` comment block):

```bash
# @dual-pair: deps-hash-check-dogfood
# spec: packages/core/hooks/deps-hash-check.sh
# Consumer-facing UserPromptSubmit hook — D7=a (Wave 5.3). Dogfood copy:
# this repo's own installed instance of the source above. Kept byte-identical.
```

**File 2:** `packages/core/hooks/deps-hash-check.sh` — add matching dual-pair marker (line 2):

```bash
# @dual-pair: deps-hash-check-dogfood
```

**File 3:** `packages/core/hooks/deps-hash-check.test.ts` — add one byte-identity assertion (new describe block after the existing tests):

```typescript
describe('deps-hash-check.sh — source/dogfood byte-identity (@dual-pair: deps-hash-check-dogfood)', () => {
  it('packages copy and .claude dogfood copy are byte-identical', () => {
    const src = readFileSync(resolve(REPO_ROOT, 'packages/core/hooks/deps-hash-check.sh'), 'utf8');
    const dog = readFileSync(resolve(REPO_ROOT, '.claude/hooks/deps-hash-check.sh'), 'utf8');
    expect(src).toBe(dog);
  });
});
```

This test is the mechanical drift-check: it fails immediately if one file is edited without the other.

**No deletions. No symlink creation. No changes to `install.sh` or `settings.json`.**

**Commit strategy:**
- Single atomic commit covering all three file edits
- `Prior-art: prior-art-evaluations.md#87 (worktree-create-setup dual-pair, SSOT BUILD — this commit extends the @dual-pair pattern with the second pair; no new mechanism introduced)`

---

## §7 Open question (not a blocker — park for future)

`packages/core/hooks/deps-hash-check.test.ts:34` tests `.claude/hooks/deps-hash-check.sh` (the dogfood copy), not the source. After the I-phase drift-check lands, this is fine: the drift-check guarantees the two are byte-identical, so testing either is equivalent. No test change needed for this specific concern.

However: if the byte-identity test is ever added per §6 File 3, the test serves as the drift gate and the existing test's choice of dogfood vs. source becomes a documentation-only concern (either is correct when drift = 0).

---

## §8 AI-trap self-audit (T15)

- **T3 (plausible finding without verification):** all three leads verified with command output and file:line citations. ✅
- **T5 (bundling implementation into R-phase):** no source edits made. This patch is markdown only. ✅
- **T11 (designing without prior-art check):** §3 documents the in-repo `@dual-pair` precedent (SSOT #87) before proposing the fix. ✅
- **T13 (ADOPTED items as zero-work):** the dogfood copy is the installed version of the shipped source — its test targets have been verified, not assumed. ✅
- **T16 (pattern-matching-on-name):** `@dual-pair` is verified to solve «byte-identity drift between two copies of the same logic in the same repo» — the problem class matches (SSOT #87 `worktree-create-setup` is precisely the same shape). ✅
- **T17 (preserve before delete):** no deletion proposed. ✅
