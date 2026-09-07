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

## What you get

- **Rules from live docs** (beta) — ESLint rules generated from the framework docs your project actually uses, wired into the editor, the pre-commit hook, the pre-push hook and CI. The first violation fails; the rule names the doc it came from.
- **The AI factory** (experimental, `env`/`factory` depth) — `/arch`, launch presets and the multi-model task pipeline around those rules.

Depth is a product decision, not a flag combination: `core` = rules + tests + guards; `env` = plus the in-session tooling; `factory` = plus the pipeline. Upgrade by re-running `init` with a deeper profile.

## What is in the tarball

This package is **assembled**, not hand-authored: its contents mirror the repository root (`install.sh`, `setup`, `setup.d/`, `agents/`, `skills/`, `templates/`, `.claude/`, `packages/`, `scripts/`) so that the installer reads every path exactly where it does in a clone. `MANIFEST.sha256` lists every shipped file; `scripts/build-getff-dist.sh --check` in the repository is the drift gate that keeps the two in sync.

The universal entry point for non-JS projects — `curl -fsSL getff.ai/install | sh` — installs the same tree by clone.

## Links

- Docs: <https://getff.ai/docs/>
- Repository: <https://github.com/artyhoo/getff>
- Issues and beta feedback: <https://github.com/artyhoo/getff/issues/new/choose>

## License

FSL-1.1-ALv2 — see `LICENSE`.
