# getff

**AI DX for your codebase: conventions AI agents can't silently bypass — and an AI-run dev environment around them.**

`getff` is the distribution package of the getff framework. One command installs the enforcement layer into your project:

```bash
npx getff@latest init
```

Run it from the project root. The stack is auto-detected from `package.json` (`ts-server`, `react-next`, `react-spa`, `react-native`); pass it explicitly to skip detection, `python` for the Python toolchain lane, `-y` for a non-interactive install, `--profile core|env|factory` to choose the install depth:

```bash
npx getff@latest init -y ts-server
npx getff@latest init --profile env
npx getff@latest init python
```

**On Windows** the command is the same, and [Git for Windows](https://git-scm.com/download/win)
is the one prerequisite — it supplies the `bash` the installer runs under. WSL is neither
required nor used. See [INSTALL.md § Windows](https://github.com/artyhoo/getff/blob/main/INSTALL.md#windows).

## What you get

- **Rules from live docs** (beta) — ESLint rules generated from the framework docs your project actually uses, wired into the editor and the pre-commit hook, with a pre-push gate that proves every generated rule still fires. The first violation fails; the rule names the doc it came from. getff ships CI workflows (`.github/workflows/ci.yml` + `workflow-integrity.yml`, your default branch substituted at install time) that run lint/typecheck/tests — they never publish; publishing stays yours.
- **The AI factory** (experimental, `env`/`factory` depth) — `/arch`, launch presets and the multi-model task pipeline around those rules.

Depth is a product decision, not a flag combination: `core` = rules + tests + guards; `env` = plus the in-session tooling; `factory` = plus the pipeline. Upgrade by re-running `init` with a deeper profile.

Beyond the files it copies, `init` can install **companion tools** — the Claude Code plugins, MCP
servers and CLIs listed in `setup.d/companions.manifest`. Each row's detect and install commands
are `eval`'d verbatim by the shipped engine (`setup.d/engine.sh:39` and `setup.d/engine.sh:65`), so
installing getff means trusting those command strings the same way you trust the installer itself;
without `-y` each one is confirmed interactively first. Companions carry **no version pin** — they
are installed through their own official registries and update to whatever those registries serve,
independently of the getff version you installed.

## What is in the tarball

This package is **assembled**, not hand-authored: its payload keeps the repository lookup paths (`install.sh`, `setup`, `setup.d/`, common `.agents/` resources, Claude aliases, Codex adapter helpers, `packages/`, `scripts/`) so the installer can deliver both native adapters from the same package. `MANIFEST.sha256` lists the npm-delivered tracked payload. Five required package entries sit outside its payload rows: `LICENSE`, `MANIFEST.sha256`, `README.md`, `bin/getff`, and `package.json`. The archive check also verifies their bytes against independent package inputs.

npm excludes exactly six fixture VCS metadata files from this payload:

```text
packages/core/backends/cargo/demo/crate/.gitignore
packages/core/backends/cargo/fixtures/firing/invalid/.gitignore
packages/core/backends/cargo/fixtures/firing/valid-clean/.gitignore
packages/core/backends/cargo/fixtures/firing/valid/.gitignore
packages/core/synthesizer/fixtures/live-generation/rust/firing/bad/.gitignore
packages/core/synthesizer/fixtures/live-generation/rust/firing/good/.gitignore
```

Their canonical source files remain tracked, each containing `/target` followed by a newline, and are checked separately in source and staged-index checks. No other missing, changed, or extra archive member is allowed. If these packaged fixture crates are built inside Git without another parent ignore, their missing ignore files can expose `target` outputs; packaged fixtures do not promise source-exact Git hygiene. Supported Rust installation uses delivered configuration templates and independent temporary self-check crates rather than those six fixture copies. A supported consumer requiring the exact fixture ignore names needs a revised transport contract, following the existing dotless-template precedent (#1528).

In a repository checkout, `bash scripts/build-getff-dist.sh --check` checks source drift and a real temporary npm archive with lifecycle scripts suppressed to prevent prepack recursion. After an ordinary `npm pack`, run `bash scripts/build-getff-dist.sh --check-packed /absolute/path/getff-0.1.0.tgz` to check that final archive against independently assembled source and metadata. A source build or npm dry-run alone does not establish archive acceptance. `--check-index` separately compares the staged manifest and staged source, including the six canonical ignore witnesses.

The universal entry point for non-JS projects — `curl -fsSL getff.ai/install | sh` — installs the same tree by clone.

## Links

- Docs: <https://getff.ai/docs/>
- Repository: <https://github.com/artyhoo/getff>
- Issues and beta feedback: <https://github.com/artyhoo/getff/issues/new/choose>

## License

FSL-1.1-ALv2 — see `LICENSE`.
