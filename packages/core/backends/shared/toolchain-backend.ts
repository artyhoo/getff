// hoisted-from: derived at 3c from the two live render signatures (renderCargoClippy → {toml,
// outcomes}, renderNpmDeclarative → {rules, outcomes}); spec §7. consumers: cargo, npm
//
// ToolchainBackend<A> — the minimal shared interface across the two live backends, nothing
// more (T-MT-B / T16: no registry, no factory, no plugin-loader — that would be Stage-4
// generalization, not the S3 frame extraction). `A` is the backend's own artifact shape (the
// cargo TOML string / the npm SynthesizedRule[]); `outcomes` is the shared per-node contract.
import type { ConventionNode } from '../../ir/types.ts';
import type { RenderOutcome } from './render-outcome.ts';

export interface ToolchainBackend<A> {
  name: string; // 'cargo-clippy-toml' | 'npm-eslint-declarative'
  render(nodes: ConventionNode[]): { artifacts: A; outcomes: Map<string, RenderOutcome> };
}
