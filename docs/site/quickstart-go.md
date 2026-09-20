---
title: Quick start for Go
description: Install getff into a Go module, watch its one shipped ban fire on your own code, and see what the installer says when the Go tools are missing.
kind: face-page
sources:
  - docs/site/face-facts.json
  - docs/site/installation.md
  - docs/site/quickstart-python.md
  - docs/site/quickstart-rust.md
  - docs/site/quickstart-ts.md
  - docs/site/terms.md
  - packages/core/manifest/maturity.json
  - packages/core/templates/go/github-actions-ci.yml
  - setup
  - setup.d/47-go.sh
executed:
  - { step: install, stack: go, date: 2026-09-21, result: "exit-0; self-check proven firing (go 1.22.0, golangci-lint 1.55.2)" }
  - { step: fire-on-your-code, stack: go, date: 2026-09-21, result: "exit-1; forbidigo named the os.Getenv line" }
  - { step: install-without-go-tools, stack: go, date: 2026-09-21, result: "exit-0; self-check reported NOT proven" }
next: installation.md
---

# Quick start for Go

After this page your Go module has a linter config that bans one call, and a CI workflow
that fails the build when the ban is broken. The Go [lane](terms.md#lane) is the
youngest one getff has. It ships one [rule](terms.md#rule).

Other stacks: [TypeScript and React](quickstart-ts.md) · [Python](quickstart-python.md) ·
[Rust](quickstart-rust.md)

<!-- getff:begin section=face-maturity-go plan=scripts/render-face-facts.mjs -->
| Stack | Status | What to know |
|---|---|---|
| `go` | alpha | Rules ship as a golangci config that is inert until you opt in; rule generation is deferred (operator, 2026-09-09). |
<!-- getff:end section=face-maturity-go -->

You need a module with a `go.mod`, Go itself, and `golangci-lint` version 1.55.2. We ran
this page with Go 1.22.0. The installer also looks for `bash`, `git`, `python3`, and
`curl`. It warns about a missing one and carries on, so read its first lines.

## 1. Install

```bash
git clone https://github.com/artyhoo/getff /tmp/rt
cd /your/project
bash /tmp/rt/setup -y go
```

The installer writes two things: `.golangci.yml` with the ban, and the CI workflow
`.github/workflows/getff-go.yml`. If you already have a `.golangci.yml`, it does not
touch yours. It writes `getff-golangci.yml` next to it, and that file does nothing until
you merge it in. That is what "inert until you opt in" means in the table above.

Then the installer proves the ban works. In a temporary folder it plants one bad file and
one good file, and runs the linter on both. The installer prints more than this. These
five lines are the [self-check](terms.md#self-check) part, exactly as printed:

```text
▶ getff firing self-check — proving the delivered golangci config (.golangci.yml) FIRES (planted violation in an OS temp dir)
  ✓ golangci-lint fired RED on the planted violation (forbidigo os.Getenv ban live)
  ✓ golangci-lint clean control GREEN — no diagnostic on conforming code (config discriminates)

✓ getff self-check: the delivered golangci config fired RED on a planted violation and stayed GREEN on the clean control — enforcement is live.
```

Both halves matter. Red on the bad file shows the ban is on. Green on the good file shows
the config does not fail everything.

## 2. Fire the rule on your own code

The shipped rule bans reading environment variables with `os.Getenv`. The
[convention](terms.md#convention) behind it: configuration comes in through one place,
so you can test the code and see what it depends on. Add a direct read to `main.go`:

```go
package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Println("hello from", os.Getenv("HOME"))
}
```

Then run the linter with the shipped config:

```bash
golangci-lint run --enable forbidigo --config .golangci.yml ./...
```

```text
main.go:9:28: use of `os.Getenv` forbidden because "Read configuration through the injected config accessor, never os.Getenv directly" (forbidigo)
	fmt.Println("hello from", os.Getenv("HOME"))
	                          ^
```

The command exits with code 1. It names the file, the line, and the reason. Before the
edit, the same command printed nothing and exited with code 0. The CI workflow runs the
same check, so a commit with this line fails the build.

## If Go or the linter is missing

The install still works, and it tells you the truth. We ran step 1 on a second machine
with neither tool. The self-check part, exactly as printed:

```text
▶ getff firing self-check — proving the delivered golangci config (.golangci.yml) FIRES (planted violation in an OS temp dir)
  ⚠ go or golangci-lint not on PATH (or the delivered config missing) — firing NOT proven (degrade, NOT green).
    Per kickoff §1.3, the local label is «insufficient (tool absent)» — the stage is NOT done.
    Verify manually from your module root:
      go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.55.2
      golangci-lint run --enable forbidigo --config .golangci.yml ./...    # must exit non-zero on os.Getenv

⚠  getff self-check: 0 proven-firing · 1 NOT proven (tool absent) — a skipped check is NOT green; run the manual command(s) above to prove it.
```

It could not run, so it said "not proven". It did not say "passed". The install exited
with code 0 in this case too, so read the last lines and do not trust the exit code alone.

## Honest limits

- **One rule.** The Go lane ships a single ban. There are no getff
  [skills](terms.md#skill) for Go, and rule generation is not built for it yet.
- **The linter version is pinned.** The config is written for `golangci-lint` 1.55.2. A
  newer major version reads a different config format.
- **`-y` installs more than the rule.** With `-y` the installer also adds its optional
  companion plugins for your agent without asking. Leave `-y` out to be asked about each.

Next: [Installation](installation.md) covers flags, updating, and how to take getff out.
