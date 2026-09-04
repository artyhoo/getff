# @rules-as-tests/core

The framework core for **rules-as-tests** — discipline-bearing code as the project's contract artifact. This package ships the rule manifest, ESLint rules, detector/research/synthesizer/installer toolchain, templates, skills, and the install wiring.

## Why this exists

See the repo root: [`../../README.md#why-this-exists`](../../README.md#why-this-exists).

## Install

This package is currently `private: true`. The first public release will be `@getff/core` `0.1.0`, after the repo-wide rename (U9) and the `private:true` drop (U10). For now, install via the file-copy path documented in the repo root [`README.md`](../../README.md) Installation section.

## Usage

The package exposes six `bin:` entrypoints (all .ts, executed via the `tsx` runtime dependency):

- `rules-as-tests-detect [<projectRoot>]` — detect the applicable rules for a project
- `rules-as-tests-research [<projectRoot>]` — produce a ResearchPlan
- `rules-as-tests-synth [<projectRoot>]` — produce a SynthesisPlan
- `rules-as-tests-validate [<projectRoot>]` — validate a SynthesisPlan
- `rules-as-tests-install [<projectRoot>]` — install the synthesised rules
- `rules-as-tests-verify-provenance <bundleDir>` — anti-hand-edit gate

See the repo root [`README.md`](../../README.md) for the full workflow + design.

## License

[`FSL-1.1-ALv2`](./LICENSE) — Functional Source License, Version 1.1, ALv2 Future License. Converts to Apache-2.0 on the second anniversary of first availability.
