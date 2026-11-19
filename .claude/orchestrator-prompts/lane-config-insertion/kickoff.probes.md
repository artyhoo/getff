# lane-config-insertion — prerequisite probe record (host-run, 2026-09-29)

<!-- host-verify: none — sidecar probe record; it carries no worker instructions and no exit gates -->

> **Class:** sidecar — a record ABOUT the stage kickoffs (`classifyKickoffName` → `sidecar`,
> `SIDECAR_DOTTED_RE`, `packages/core/principles/kickoff-population.ts:42`). It carries no worker
> instructions; each stage kickoff states the branch these results selected and cites this file.
> **Authoritative for:** the raw results of the 13 prerequisite probes (P-L1-1/2, P-L2-1..3,
> P-L3-1..4, P-L5-1..4), two extra measurements (golangci v2 schema, clippy cache), the L3
> prior-art consult, and the D1 sample list. **NOT authoritative for:** project goal — see
> [README.md#why-this-exists](../../../README.md#why-this-exists); any design decision — the
> [spec](../../../docs/superpowers/specs/2026-09-28-lane-config-insertion-design.md).

**Why the probes ran here and not in the stages.** The aif container (`docker --context pc exec
aif-agent-1`) has none of cargo, rustup, go, golangci-lint, ast-grep, ruff, uvx (cold Phase -1
review, 2026-09-29). A stage executor cannot run them, so the kickoff author ran them on hosts
that have the tools, outside any repo mirror (scratch dirs), before dispatch.

**Hosts and tool versions (as run):**

| Host | Tools | Used for |
|---|---|---|
| Mac, Darwin 25.6.0 arm64, scratch dir | `cargo 1.98.1` / `clippy 0.1.98`, `ast-grep 0.44.1`, `uvx 0.8.0` → `ruff 0.15.21`, `uvx --from ast-grep-cli==0.44.1` | P-L1-1, P-L1-2, P-L2-1, P-L2-2, P-L3-1..4, clippy cache |
| PC WSL (`ssh pc-lan`), `/tmp` scratch | `cargo 1.96.1` / `clippy 0.1.96` (the `audit-self.yml:341` pin), `go1.22.0` (the go template pin), `golangci-lint v1.55.2` (built with go1.22.0) | P-L1-1 re-run on the CI pin, P-L2-3, P-L5-1..4, v2 schema |

The Mac has **no Go** (`go` there is a shell function that forwards to the PC, `exec: go: not
found` locally), so every go probe ran on the PC. The pins match the templates where they pin:
ast-grep `0.44.1` and ruff `0.15.21` (`packages/core/templates/python/github-actions-ci.yml:46`,
`:66`), go `1.22.0` + golangci-lint `v1.55.2` (`packages/core/templates/go/github-actions-ci.yml:48`,
`:53`). The cargo template pins no Rust (`packages/core/templates/cargo/github-actions-ci.yml:5-7`);
P-L1-1 ran on both 1.98.1 and the repo CI pin 1.96.1 with identical results.

## P-L1-1 — does the isolated clippy gate override consumer lint levels? → **WORKS**

Command (fixture crate per case, each with a non-getff lint at `deny` on code that trips it):

```text
CLIPPY_CONF_DIR=<abs dir holding getff clippy.toml> cargo clippy --all-targets -- \
  -A clippy::all -A clippy::pedantic -A clippy::nursery -A clippy::restriction -A clippy::cargo \
  -D clippy::disallowed_methods -D clippy::disallowed_types -D clippy::disallowed_macros
```

Output on the CI pin (PC, `clippy 0.1.96 (31fca3adb2 2026-06-26)`):

```text
pa plain: error: this function has too many arguments (2/1)
pa gate exit=0
ws plain: error: unneeded `return` statement
ws gate exit=0
pc plain: error: unneeded `return` statement
pc gate exit=101 error: unneeded `return` statement
pd gate exit=101 error: use of a disallowed method `std::env::var`
```

`pa` = `Cargo.toml [lints.clippy] needless_return/too_many_arguments = "deny"` plus a consumer
`clippy.toml` `too-many-arguments-threshold = 1`; `ws` = `[workspace.lints.clippy]`; `pc` =
source-level `#![deny(clippy::needless_return)]`; `pd` = positive control (consumer `clippy.toml`
`disallowed-methods = []`, code calls `std::env::var`; plain run finishes green). Mac 1.98.1 gave the
same four results. Edge cases (Mac):

```text
CLIPPY_CONF_DIR=<nonexistent dir>  → error: error finding Clippy's configuration file: No such file or directory (os error 2)
CLIPPY_CONF_DIR=<empty dir>        → Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.16s   (no ban, green)
```

**Conclusion:** (a) and (b) are overridden → the spec's «works» branch; (c) survives, which is
spec §12's recorded limit, not a fallback trigger. A missing conf dir errors loudly; an empty one
is silently green — the delivered file must exist and every test arm must assert a getff hit.

## P-L1-2 — does `ast-grep scan -c .getff/sgconfig.yml` resolve and scan correctly? → **WORKS**

Fixture: consumer `sgconfig.yml` with `ruleDirs: [myrules]` (rule `consumer-no-print`), getff
rules copied to `.getff/astgrep-rules/`, `.getff/sgconfig.yml` = `ruleDirs: [astgrep-rules]`,
`pkg/app.py` calls `os.system` and `print`.

```text
--- ast-grep --version
ast-grep 0.44.1
--- bare 'ast-grep scan' (today's gate) in project root
   1 "ruleId":"consumer-no-print"
exit=1
--- 'ast-grep scan -c .getff/sgconfig.yml' in project root
exit=1
   1 "ruleId":"getff-no-os-system"
"file":"pkg/app.py"
--- negative: .getff/sgconfig.yml with ruleDirs: [.getff/astgrep-rules]
Error: Cannot read rule directory .getff/.getff/astgrep-rules
Help: The rule directory cannot be read or traversed
exit=6
```

**Conclusion:** `ruleDirs` resolve relative to the config file; the scan covers the working
directory; only getff's rules load. The wrong spelling fails loudly (exit 6), it is not a silent
green.

## P-L2-1 — ruff config lookup (ruff 0.15.21) → list `.ruff.toml`, `ruff.toml`, `pyproject.toml` with `[tool.ruff]`

Command: `uvx ruff@0.15.21 check --show-settings a.py`, first `Settings path` line, per file set
(`dot` = `.ruff.toml`, `plain` = `ruff.toml`, `pyr` = `pyproject.toml` with `[tool.ruff]`, `pyn` =
`pyproject.toml` without it). Paths shortened to the file name:

```text
P-L2-1 [dot plain pyr] -> Settings path: ".../c/.ruff.toml"
P-L2-1 [plain pyr]     -> Settings path: ".../c/ruff.toml"
P-L2-1 [dot pyr]       -> Settings path: ".../c/.ruff.toml"
P-L2-1 [dot plain]     -> Settings path: ".../c/.ruff.toml"
P-L2-1 [pyn plain]     -> Settings path: ".../c/ruff.toml"
P-L2-1 [pyn]           ->                          (no settings path: pyproject without [tool.ruff] is not a config)
--- nested: root ruff.toml + sub/pyproject [tool.ruff]
root a.py -> Settings path: ".../n/ruff.toml"
sub/b.py  -> Settings path: ".../n/sub/pyproject.toml"
--- nested: sub/pyproject WITHOUT [tool.ruff]
sub/b.py  -> Settings path: ".../n/ruff.toml"
```

**Conclusion:** precedence in one directory is `.ruff.toml` > `ruff.toml` > `pyproject.toml`
(only with a `[tool.ruff]` table). The closest config wins per subtree; a `pyproject.toml` without
`[tool.ruff]` does not shadow. Matches spec D11's ruff list; no cell ambiguity → no L2 stop.

## P-L2-2 — clippy config lookup → list `.clippy.toml`, `clippy.toml`; `.clippy.toml` wins

```text
P-L2-2a .clippy.toml only:
warning: use of a disallowed method `std::env::var`
P-L2-2b both files (ban only in .clippy.toml):
warning: using config file `.../both/.clippy.toml`, `.../both/clippy.toml` will be ignored
warning: use of a disallowed method `std::env::var`
P-L2-2c workspace root clippy.toml has the ban; m2 has its own clippy.toml without it:
warning: use of a disallowed method `std::env::var`
 --> m1/src/lib.rs:1:24
```

**Conclusion:** clippy loads `.clippy.toml`; with both in one directory `.clippy.toml` wins with a
warning (so a getff `clippy.toml` beside a consumer `.clippy.toml` is dead); a member crate's own
config shadows the root one for that crate (m2 shows no hit). Spec §4.3 already NOT-wires the
both-files directory.

## P-L2-3 — golangci-lint lookup (v1.55.2, PC) → `.golangci.json` > `.golangci.toml` > `.golangci.yaml` > `.golangci.yml`

Command: `golangci-lint run -v ./...` with every subset of the four names present, reading the
`Used config file` line.

```text
golangci-lint has version v1.55.2 built with go1.22.0 from (unknown, mod sum: "h1:yllEIsSJ7MtlDBwDJ9IMBkyEUz2fYE0b5B8IUgO1oP8=") on (unknown)
[json toml yaml yml] -> Used config file .golangci.json"
[toml yaml yml] -> Used config file .golangci.toml"
[yaml yml] -> Used config file .golangci.yaml"
[yml] -> Used config file .golangci.yml"
```

**Conclusion:** json wins, then toml, then yaml, then yml. getff's fresh-cell `.golangci.yml` is
shadowed by ANY of the other three. The docs list the names yml-first (context7,
`/golangci/golangci-lint` «Configuration File»), which is not the precedence — measure, never read
it off the docs. golangci-lint 2.14.0 gave the same three lines (see «v2 schema» below).

## P-L3-1 — does `ruff check --show-settings <path>` need the path to exist? → **yes**

```text
$ uvx ruff@0.15.21 check --show-settings does_not_exist.py
ruff failed
  Cause: No files found under the given path
(exit=2)
```

An existing path prints `Resolved settings for: …` and the `Settings path` line (P-L2-1).
**Conclusion:** the probe file is created inside the target's directory and removed on every exit
path of the install run (spec §4.1 branch «needs the path»).

## P-L3-2 — ruff ignore vs select specificity (ruff 0.15.21)

`[lint.flake8-tidy-imports.banned-api] "os.system".msg="no"`, `a.py` calls `os.system`:

```text
ignore=["TID"]    + extend-select=["TID251"] -> TID251 `os.system` is banned: no
select=["TID251"] + ignore=["TID"]           -> TID251 `os.system` is banned: no
extend-select=["TID251"] + extend-ignore=["TID2"] -> TID251 `os.system` is banned: no
ignore=["TID251"] + extend-select=["TID251"] -> All checks passed!
```

**Conclusion:** a prefix ignore does not disable a more specific selected code; an ignore of the
same code does. The design NOT-wires any getff code or prefix in `ignore` anyway (spec §4.1); the
equal-specificity case is exactly what the differential probe catches when the recogniser misses
it.

## P-L3-3 — is an `sgconfig.yml` with no `ruleDirs:` key valid (ast-grep 0.44.1)? → **yes**

```text
--- P-L3-3: sgconfig.yml with no ruleDirs key   (utilDirs: [utils])
exit=0
--- comment-only sgconfig.yml
exit=0
--- testConfigs-only sgconfig.yml
exit=0
```

**Conclusion:** shape S3 (append a `ruleDirs:` block list at EOF) ships. The reason text at
`setup.d/45-python.sh:361` («it has no top-level ruleDirs key for getff to add a line to») becomes
wrong once S3 inserts, and is replaced by the S3 result.

## P-L3-4 — D12 footprint of the one-shot runners

Clean `HOME` and `UV_CACHE_DIR` inside a temp dir; fixture project is a fresh git repo.

```text
$ uvx ruff@0.15.21 check a.py                    -> All checks passed!
$ uvx --from ast-grep-cli==0.44.1 ast-grep --version -> ast-grep 0.44.1
--- git status --porcelain --ignored (project):
!! .ruff_cache/
--- anything under HOME outside .cache/uv:
./.local/share/uv/tools/.lock
./.local/share/uv/tools/.gitignore
$ uvx ruff@0.15.21 check --no-cache a.py (fresh project) -> All checks passed!
--- git status --porcelain --ignored: (empty)
```

**Conclusion:** without `--no-cache` ruff writes `.ruff_cache/` into the consumer's project — a
D12 falsifier hit. Every getff ruff probe run passes `--no-cache` (the CI gate already does,
`packages/core/templates/python/github-actions-ci.yml:82`). uv also creates its own empty state
directory `$HOME/.local/share/uv/tools/` (a lock file and a `.gitignore`); nothing lands on `PATH`
(no `~/.local/bin` entry) and the project stays clean. Record that directory in the PR body as
uv's own state, next to its cache.

## P-L5-1 — does `go run …/golangci-lint@v1.55.2` build and stay clean? → **yes on go1.22.0, NO on go1.25.0**

Isolated `HOME`/`GOPATH`/`GOCACHE`, `GOFLAGS=-modcacherw`, fixture module in a fresh git repo:

```text
$ go run github.com/golangci/golangci-lint/cmd/golangci-lint@v1.55.2 --version   (go1.22.0)
(the --version line: v1.55.2, built with go1.22.0 — see P-L2-3 for the verbatim line)
exit=0 secs=33
project git status: (empty)
HOME after: .cache/golangci-lint  go/pkg  gocache
$ GOTOOLCHAIN=go1.25.0 go run …/golangci-lint@v1.55.2 --version
golang.org/x/tools@v0.14.0/internal/tokeninternal/tokeninternal.go:78:9: invalid array length -delta * delta (constant -256 of type int64)
exit=1
```

**Conclusion:** D12 step 2 for go works only on a Go old enough to build v1.55.2's
`golang.org/x/tools@v0.14.0`; on go1.25.0 it cannot build, so step 2 is `not-proven` by
construction there (umbrella §4 L5 row — not a stop). The boundary version was not measured. The
pin bump is its own task (spec §11). Everything written lands under the module/build caches and
`$HOME/.cache/golangci-lint`; the project stays clean.

## P-L5-2 — machine-readable linter field → `Issues[].FromLinter` (v1 and v2)

```text
v1.55.2: golangci-lint run --out-format json ./...
[('forbidigo', 'use of `fmt.Println` forbidden by pattern `^(fmt\\.Print(|f|ln)|print|println)$`')]
v2.14.0: golangci-lint run --output.json.path stdout ./...   (first line only)
[('forbidigo', 'use of `fmt.Println` forbidden by pattern `^(fmt\\.Print(|f|ln)|print|println)$`')]
```

**Conclusion:** both versions name the linter in `Issues[].FromLinter`. v1 takes
`--out-format json`; v2 takes `--output.json.path stdout` and prints more text after the JSON
line (a whole-stream parse fails with `Extra data: line 2 column 1`) — parse only the first line,
or write to a file path.

## P-L5-3 — v1.55.2 on a `version: "2"` file → a loud error with a message

```text
exit=3
level=error msg="Can't read config: can't unmarshal config by viper: 1 error(s) decoding:\n\n* 'Version' expected a map, got 'string'"
```

Reverse direction (v2.14.0 on a v1 file, no `version` key):

```text
Error: can't load config: unsupported version of the configuration: "" See https://golangci-lint.run/docs/product/migration-guide
```

**Conclusion:** there is a message to quote in both directions → NOT-wired with the binary's
message (spec §4.6).

## P-L5-4 — forbidigo default pattern (D4)

```text
v1.55.2, enable: [forbidigo], no forbid list:
[('forbidigo', 'use of `fmt.Println` forbidden by pattern `^(fmt\\.Print(|f|ln)|print|println)$`')]
v1.55.2, explicit forbid: [p: 'os\.Getenv']:
[('forbidigo', 'use of `os.Getenv` forbidden by pattern `os\\.Getenv`')]
v1.55.2, enable: [govet] (forbidigo not enabled):
[]
v2.14.0, version "2", enable: [forbidigo], no forbid list:
[('forbidigo', 'use of `fmt.Println` forbidden by pattern `^(fmt\\.Print(|f|ln)|print|println)$`')]
v2.14.0, explicit forbid: [pattern: os\.Getenv]:
[('forbidigo', 'use of `os.Getenv` forbidden by pattern `os\\.Getenv`')]
```

**Conclusion:** the default pattern the binary applies is `^(fmt\.Print(|f|ln)|print|println)$`
on both versions — it equals the spec literal. An explicit `forbid` list replaces the default
(D4's premise holds). With forbidigo not enabled nothing fires.

## Extra — golangci v2 schema (golangci-lint 2.14.0 via `GOTOOLCHAIN=go1.26.0 go run …/v2/cmd/golangci-lint@v2.14.0`)

v2.14.0 needs go ≥ 1.26.0 to build. The v1 key `p:` inside a v2 file is **not** rejected:

```text
--- v2.14.0 explicit v1 key p: under v2 paths:
{"Issues":[{"FromLinter":"forbidigo","Text":"use of `p` forbidden by pattern ``", ...
4 issues:
```

**Conclusion:** under v2, `p:` is silently read as an empty pattern that matches every
identifier. The `p:` → `pattern:` translation for v2 targets (kickoff-l5 §2a) is load-bearing: a
missed translation would not error, it would flood the consumer with false hits — the
differential probe's «adds nothing else» comparison must catch it, and one L5 fixture asserts it.

## Extra — clippy cache on a shared target dir (Mac, clippy 0.1.98)

```text
run1 (empty ban list):                 0 disallowed-method hits
run2 (same target dir, ban added):     Checking pc4 v0.1.0 … warning: use of a disallowed method `std::env::var`
```

**Conclusion:** on 0.1.98 a content change of the loaded `clippy.toml` invalidates the cache. Not
measured on 1.96.1; the per-run fresh `--target-dir` in kickoff-l4 stays, as a cheap guard for
older toolchains.

## L3 prior-art consult (host-run; L3 cites this record for its `Prior-art:` trailer)

**SSOT rows read** (`docs/meta-factory/prior-art-evaluations.md`):

- `#216` (`:289`) — Python lint-config delivery into an existing project; verdict **BUILD the thin
  bash writer**: «no upstream tool delivers this headlessly»; ruff has no init/scaffold command,
  closest-config-wins discovery, and `extend` needs a user-authored chain.
- `#117` (`:190`) — yq sequence append for GH-Actions step injection; verdict **HYBRID**.
- `#132` (`:205`) — `toml_edit` (format-preserving CST edits, used by `cargo add`); verdict
  **REFERENCE** — technique only, different format and runtime.
- PR #1868 — `fix(install): add getff's block to a consumer's own eslint config instead of asking
  for a hand edit (Q4.7)`, MERGED as `64a624b1355`: the insertion-only precedent (original kept,
  rollback on a failed check).

**context7 — three queries:**

1. `/websites/astral_sh_ruff` — «extend setting: inherit from another configuration file; banned-api».
   Surfaced: `extend = "../pyproject.toml"`; «Unlike ESLint, Ruff does not merge settings across
   configuration files; instead, the "closest" configuration file is used»; `extend-banned-api`.
   T16: upstream problem class = a user chaining their own configs. Ours = getff adding its bans
   to a config the consumer owns, without editing their chain. **No match** — `extend` would need
   the consumer's file edited anyway (one line), and closest-wins means a getff-owned file cannot
   be layered in from outside.
2. `/golangci/golangci-lint` — «multiple config files or config inheritance; forbidigo forbid
   patterns». Surfaced: one config file per run (lookup list, `-v` shows which); CLI slice options
   are *combined* with the file; the v1→v2 migration (`p:` → `pattern:`). **No merge/extend
   mechanism** exists → no upstream path to layer getff's bans; confirms the insertion design and
   the v2 key translation.
3. `/rust-lang/rust-clippy` — «CLIPPY_CONF_DIR and clippy.toml lookup, disallowed-methods».
   Surfaced: lookup `CLIPPY_CONF_DIR` → `CARGO_MANIFEST_DIR` → current dir → parents; `".."` extends
   a list's *defaults* only; «clippy.toml … cannot be used to allow/deny lints». **No
   include/extend** between two config files → insertion into the consumer's file is the only
   local route; `CLIPPY_CONF_DIR` is the CI isolation route (P-L1-1).

**WebSearch (1):** «tool inserts its own lint rules into existing project ruff golangci-lint config
without overwriting "extend" merge installer». Results: ruff settings docs
(<https://docs.astral.sh/ruff/settings/>), pydevtools ruff guides, the golangci-lint FAQ
(<https://golangci-lint.run/docs/welcome/faq/>). None describes a tool that inserts its rules into
a consumer's existing config; the ruff pages describe `extend` inheritance only.

**Verdict for L3:** no candidate beyond `#216` / `#117` / `#132` — no new SSOT row. Trailer:
`Prior-art: prior-art-evaluations.md#216 (BUILD — thin bash writer; #132 technique, #117 rejects a yq default; consult recorded in .claude/orchestrator-prompts/lane-config-insertion/kickoff.probes.md).`

## D1 sample (collected on the host; the recogniser run over it is L3's)

`gh search code`, 2026-09-29. Every file was fetched once by its blob SHA
(`gh api repos/<repo>/git/blobs/<sha>`) and returned content; each `pyproject*` file holds a
`[tool.ruff` table. Blob SHAs are immutable, so L3 re-fetches exactly these bytes. Queries:
`select filename:ruff.toml`, `extend-select filename:ruff.toml`, `lint filename:.ruff.toml`,
`"[tool.ruff" filename:pyproject.toml`, `ruleDirs filename:sgconfig.yml`.

| repo | path | blob sha |
|---|---|---|
| `3DOM-FBK/deep-image-matching` | `ruff.toml` | `f0219765d091edc9949f6ba31e78724d339e42be` |
| `ExtensityAI/symbolicai` | `ruff.toml` | `438df6a4372b062db091995a1e020fa8ab286c6a` |
| `JulianKemmerer/PipelineC` | `ruff.toml` | `1bc96e5bbf29df1bf4a2209e4b21e199d5cd0f3f` |
| `Kozea/pygal` | `ruff.toml` | `a36dbda90047f2687bb1fe80083ad2d6759e115f` |
| `MarshalX/yandex-music-api` | `ruff.toml` | `199100291b47e2c5778ab10ce816fb5330a8a0fe` |
| `Stability-AI/stable-point-aware-3d` | `ruff.toml` | `36a85dc5e2359d3a3829d9260001e7ef4b02bce5` |
| `aerkalov/ebooklib` | `ruff.toml` | `d8cfa8fc12f64c751b3d6c0b4c639ab27e8a52ef` |
| `bhimrazy/receipt-ocr` | `ruff.toml` | `856c3feb3862fa646494340dc86e57953c6a2042` |
| `cherrypy/cherrypy` | `.ruff.toml` | `dfdac3fddb3d29ba7112ca2ba91ca42db2df4720` |
| `eli64s/readme-ai` | `.ruff.toml` | `1d9ad1241d0066d94214949d7f7802c3a1a7a32a` |
| `hartwork/git-delete-merged-branches` | `ruff.toml` | `bcfbdb9497d31e321e4f23c0a2d4d91f325ffd8c` |
| `idank/explainshell` | `ruff.toml` | `9e13a39479daf1b2fccbf4ffcfcb13724516af60` |
| `jaheyns/CfdOF` | `.ruff.toml` | `3e9db5d031d39728542d40832e8864f9c9f646f9` |
| `johnwmillr/LyricsGenius` | `.ruff.toml` | `a1c0fb08a28b32784444d01267b5fa6c7c5790bf` |
| `lucidrains/vector-quantize-pytorch` | `ruff.toml` | `4ec6eb39d0c9f9c32e9d3dd17e466a10cb62ffa4` |
| `martinResearch/DEODR` | `ruff.toml` | `7302f5bf741710703b35fd38004ccb0f101a2fa9` |
| `mov-cli/mov-cli` | `ruff.toml` | `89decd168551e38c0c2b3e8790095426fb39b8e1` |
| `saulpw/visidata` | `ruff.toml` | `96537c6ffe99e92d194cdd58eba6fc0b5dda0b78` |
| `sphinx-doc/alabaster` | `.ruff.toml` | `429bbc2b80fa1ce9748aab79d51ebc3839558618` |
| `stamparm/maltrail` | `ruff.toml` | `334aca54302661e977a90124bfcf04cae6f402a7` |
| `zeek/spicy` | `ruff.toml` | `d9e2b1f597bf50e99533aa837bc18468f4d5ff3d` |
| `zeroc-ice/ice` | `ruff.toml` | `589b80f9f7ed087a5f25794d7dcb8ce36c5131f9` |
| `NLeSC/python-template` | `template/pyproject.toml.jinja` | `c2a1e0eedfd4dde4b2c4f249d5ef265568d63575` |
| `angelsolaorbaiceta/Mechanics` | `pyproject.toml.bak` | `1149cbc1c02f523afbe3842a340414cee81bdd53` |
| `f-io/esphome-tylo` | `pyproject.toml` | `b1574654f2729e9f14dc95006d4682848793defa` |
| `gone/django-hydra` | `template/pyproject.toml.jinja` | `254b3f1a4bb5e4914048a95d2790e0ba92bc2489` |
| `inclusionAI/cuLA` | `pyproject.toml` | `520c3e801ad687da00e03db3b237afd84a51b6ef` |
| `mbk-dev/okama` | `pyproject.toml` | `842aac9498fe2751795d9795b13fa335fced434a` |
| `muscbridge/PyDKE` | `pyproject.toml.backup` | `78b7c412ecf57641f1de23a5c7cff819e5135bbd` |
| `petretiandrea/home-assistant-tapo-p100` | `pyproject.toml` | `95ae7c6b7995ef737ed7c0e0def1f6b77a330d67` |
| `quantalogic/quantalogic` | `pyproject.toml.bak` | `d417b81f6530e209df3a63328e90f26d92a82df0` |
| `ritwiktiwari/copier-astral` | `template/pyproject.toml.jinja` | `c7941ab0493da45d1d0377510dba4eb08e5d200f` |
| `robolyst/streetview` | `pyproject.toml` | `fa31a98c2055e94ac0e1a2cd3efc588758137a59` |
| `sb-ai-lab/RePlay` | `projects/pyproject.toml.template` | `ff5938b22a5926678425f1a0dc1b931b5105d33d` |
| `superlinear-ai/substrate` | `template/pyproject.toml.jinja` | `ceddfd25febaaba0cb9442fdcd06d8a37af6dc19` |
| `yandex-research/tabm` | `pyproject.toml` | `8f69444955b99ceeccd1a8fd9e3f1b6c5ba562d4` |
| `yt-dlp/ejs` | `pyproject.toml` | `a2968e19c1ee20e1c97dac587de86a014d70ca5d` |
| `AprilNEA/OpenLogi` | `sgconfig.yml` | `cb0ceb99eb080ad5b9dbd5d6053b67a9ec8b85f2` |
| `CesiumGS/cesium` | `sgconfig.yml` | `073069008be1f1988afbeda3794a4575e6275686` |
| `Kong/kong` | `sgconfig.yml` | `59c2454c0b29b24e692e1856f7b1a79a78026528` |
| `PaddlePaddle/Paddle` | `sgconfig.yml` | `43ed2cb282014ea1698242baf7c77ce6dfbccf08` |
| `TabbyML/tabby` | `sgconfig.yml` | `790229a4a44d0a72f27aecc24a516a7940c2bc83` |
| `apache/airflow` | `providers/.ast-grep/sgconfig.yml` | `ff99acc8c1392abe04ac9cbfb1ba82a9372815e3` |
| `formatjs/formatjs` | `sgconfig.yml` | `6a0e36a6c7ecb0f516b12d93893bbedbee2e85e1` |
| `nushell/nushell` | `sgconfig.yml` | `44560f2e715b274e765f31fa5e13583eda37a45b` |
| `qdrant/qdrant` | `tools/ast-grep/sgconfig.yml` | `99e337dfdf2ce3e1d2d8ccb9d38c351c3c3809aa` |
| `swc-project/swc` | `sgconfig.yml` | `19cb5b6073fbd3a13807cb5077111ca63e4187d1` |

Counts: 22 `ruff.toml` / `.ruff.toml`; 15 `pyproject`-family files with `[tool.ruff` (8 are
templates or backups — `*.jinja`, `*.bak`, `*.template` — which still carry a real `[tool.ruff]`
table and are valid recogniser input); 10 `sgconfig.yml`. The T1 floor (≥20 ruff, ≥5 sgconfig)
holds on the 22 ruff files alone.
