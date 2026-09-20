<!-- scope:main-pinned-blob-url-red-at-merge -->
# A `main`-pinned blob URL born on `staging` is a structurally-RED link gate — and #1807 merged through it

> Scope: the `lychee — live link audit` gate (`.github/workflows/link-checker.yml`, config [`lychee.toml`](../../../lychee.toml)) versus the blob-URL-at-source mechanism that the plugin twin requires. Discovered during step 2 of the 2026-09-21 GLM-distrust audit (PRs #1803 / #1807). Individual-file authority inherited from [research-patches/README.md](README.md). **No mechanism is shipped by this patch** — it records the gap and the two candidate closures, per the one-patch-per-gap contract.

## Problem

The plugin twin must be byte-identical to its source, so a link that would escape the twin's directory is written as an **absolute `main`-pinned blob URL** instead of a relative path. A file added on `staging` therefore acquires, at the moment it is written, a link to a `main` URL **that cannot resolve until the next promote**. The live link audit reads that URL literally and goes RED for a reason that is not link rot.

Measured on PR #1807 (`getff-ai-site` S0q), all timestamps from the GitHub API:

```text
$ gh api repos/artyhoo/getff/commits/a2908da22e8/check-runs \
    --jq '.check_runs[]|select(.name|test("lychee";"i"))|"\(.name)\t\(.status)\t\(.conclusion)\t\(.completed_at)"'
lychee — live link audit	completed	failure	2026-09-18T19:57:50Z
```

Exactly **one** run of that check name at that exact head — no second, green run. The PR merged 13 minutes later:

```text
$ gh pr view 1807 --json mergedAt,mergeCommit -q '"\(.mergedAt) \(.mergeCommit.oid)"'
2026-09-18T20:10:52Z 6b9da5286b49ae69b9e3696f2f953560a2e29e3a
```

The failure is the structural class, not a broken link — one error, and it names the mechanism directly:

```text
### Errors in ./plugin/README.md
* [404] <https://github.com/artyhoo/getff/blob/main/docs/meta-factory/research-patches/2026-09-11-plugin-skills-generator-stage0-reverif.md> (at 27:686) | Rejected status code: 404 Not Found
```

It self-healed at promote #4, exactly as the class predicts:

```text
$ git cat-file -e $(git rev-parse origin/main^1):docs/meta-factory/research-patches/2026-09-11-plugin-skills-generator-stage0-reverif.md
  # ABSENT on pre-promote main (9b768ca2b88)
$ git cat-file -e origin/main:docs/…/2026-09-11-plugin-skills-generator-stage0-reverif.md
  # PRESENT today
$ curl -s -o /dev/null -w '%{http_code}\n' https://github.com/artyhoo/getff/blob/main/docs/…/2026-09-11-plugin-skills-generator-stage0-reverif.md
200
```

Note the measurement trap this finding survived: `git rev-list -1 --before=<date> origin/main` answers with a commit whose *committer date* precedes the cutoff, which on a promote branch includes commits that only became reachable from `main` later. It reports the file as present on 2026-09-18 and hides the whole finding. The first-parent form above is the one that answers «what did `main` point at».

## Root cause — two independent halves, and only one of them is mechanical

**Half A (structural, mechanisable).** `lychee.toml`'s `exclude_path` already exempts `docs/meta-factory/research-patches/` as an *input*; that does nothing here, because the patch file is the link **target**, and the *input* is `plugin/README.md` — squarely inside the audit's declared showcase scope (`lychee.toml:2-3`). No rule in the config covers «a `main` blob URL whose path exists on `HEAD` but not yet on `main`». A PR that adds such a file is RED by construction, and the only two exits are a waiver or waiting for a promote.

**Half B (process, NOT mechanisable from n=2).** #1807 merged with that RED and the PR body asserts «The push then passed the FULL pre-push gate on merit» — a true statement about a *different* gate (pre-push §8 runs `lychee --offline`, so it structurally cannot see a 404). No waiver is recorded anywhere in the PR. The sibling lane is the contrast that keeps this honest: #1803 went RED on `fidelity-verdict-in-pr-body` at 01:37:10, re-ran GREEN at 01:38:13, and merged at 01:45 — same window, same author class, correct handling. Two data points do not separate «one lane slipped» from «a habit», and per [attention-is-not-a-mechanism.md §3](../../../.claude/rules/attention-is-not-a-mechanism.md) a promotion needs three documented incidents.

## Solution — recorded, not shipped

Half A has two candidate closures, and picking between them is a real fork, not a default:

1. **Exclude the class in `lychee.toml`** — an `exclude` entry anchored on `^https://github\.com/artyhoo/getff/blob/main/`. Cheapest, and structurally honest about the promote lag; the cost is that a genuinely dead `main` blob URL stops being caught anywhere, which is precisely the rot the live audit exists for.
2. **Remap `blob/main/` → `blob/staging/` for the audit only** — keeps every URL checked against a ref that actually carries the file, and turns the gate back into a real drift detector on this class. The cost is that the audit then verifies a link the *reader* never follows: readers of a shipped plugin twin resolve `main`.

Neither is obviously better by the project's own measures (a gate that cannot fail is `#hope-as-gate`; a gate that checks a different URL than the reader follows is a tautology gate), so the choice is the operator's. Until one lands, the standing obligation for Half B is the cheap one: **a PR merged over this class states the waiver in its body**, naming the URL and the promote that will heal it.

## Prevention

- The falsifier for Half B is written down so the next seat can run it rather than re-derive it: enumerate **every** run of **every** check name at the merged head of the last ~20 `staging` PRs (`gh api repos/<o>/<r>/commits/<merged head>/check-runs`), and count PRs that merged with a RED that has no later green run of the same check name at the same SHA. A habit shows up as a rate; a slip shows up as one row. n=2 today.
- The old-head trap applies to this measurement twice over: a single check row proves nothing until every run of that check name at that exact SHA is enumerated, and `--before` on a promote branch does not answer «where did `main` point».

## §1.7 self-review (recursive self-application of this very patch)

### §1.7 Forward-check applied

Checked against [`attention-is-not-a-mechanism.md §1-§3`](../../../.claude/rules/attention-is-not-a-mechanism.md): this patch deliberately does NOT promote «a reviewer will notice the red check» to a mechanism — it records the gap and names both a deterministic closure and the incident count (2) still short of that rule's §3 promotion bar (3 in 6 months). Checked against [`rule-enforcement-channel-selection.md`](../../../.claude/rules/00-rule-index.md): Half A's earliest reachable channel is the config, not a reviewer — which is why both candidates are config edits and neither is prose. Checked against [CLAUDE.md «PR strategy»](../../../CLAUDE.md): the mechanism is NOT shipped here, because choosing between candidates 1 and 2 is outside the audit's agreed scope and would be a drive-by.

### §1.7 Backward-check applied

Swept the sibling lane of the same promote window rather than the finding's own PR: #1803's `fidelity-verdict-in-pr-body` RED at 01:37:10 was followed by a GREEN re-run at 01:38:13 before its 01:45 merge — so the handling failure is not uniform across the window, and the sweep is what downgrades this from «the lane ignores CI» to «one PR did». Swept the gate's own two channels for the same class: pre-push §8 runs `lychee --offline` on changed `*.md` only, so it cannot fire on a 404 and is not a second site of this bug; the weekly full-sweep job shares `lychee.toml`, so whichever closure lands covers both live arms at once. Swept `lychee.toml`'s existing `exclude` / `exclude_path` entries: none of the eleven covers a `main`-pinned blob URL, confirming this is an uncovered class rather than a regression of an existing exemption.
