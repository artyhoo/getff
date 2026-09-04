#!/usr/bin/env -S npx tsx
// rules-as-tests-synth — npm bin entrypoint.
// Modes:
//   <projectRoot>             → detect → research → synth → JSON
//   --from-research <path>    → load ResearchPlan JSON → synth → JSON
//   --output <dir>             → also call emit() to write 3 artifact files
//   --pattern <id>             → filter rules to entries with research.entryId === id
// Opt-in live-LLM paths (install-time only; opted-out behaviour is byte-identical):
//   --generate                → recipe-less generate-path (live Anthropic GenerateClient)
//                               + L4-degrade to research-only when L4 rejects all rules
//   AIF_RESEARCH=llm (env)    → build the plan via the live Anthropic ResearchClient
//                               (when no --from-research; --from-research still wins)

import { readFileSync } from 'node:fs';
import { detectStack } from '../detector/index.ts';
import { research, validateResearchPlan } from '../research/index.ts';
import type { ResearchPlan } from '../research/types.ts';
import { synthesize } from './synthesize.ts';
import { emit } from './emit.ts';
import type { SynthesisPlan } from './types.ts';
import { createAnthropicResearchClient } from '../research/research-adapter-anthropic.ts';
import { createAnthropicGenerateClient } from './generate-adapter-anthropic.ts';
import { runGeneratePath } from './generate-cli.ts';
// DN #7 Option A (Task 2.6): thread resolveCtx to the external validator so
// --from-research runs get Tier-1/2 when the plan's provenance needs it.
// ecosystem-wiring W2: resolveCtxForRoot selects the EcosystemAdapter by the
// consumer's detected stack (python → pip, cargo → cargo, JS/unknown → npm),
// replacing the pre-W2 hardcoded npmAdapter so a non-JS consumer's Tier-1 no
// longer fails closed with an ecosystem mismatch.
import { resolveCtxForRoot } from './resolve-ctx.ts';

interface Args {
  root: string;
  fromResearch: string | null;
  output: string | null;
  pattern: string | null;
  generate: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    root: process.cwd(),
    fromResearch: null,
    output: null,
    pattern: null,
    generate: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--from-research') args.fromResearch = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--pattern') args.pattern = argv[++i];
    else if (a === '--generate') args.generate = true;
    else if (a === '-h' || a === '--help') {
      process.stdout.write(
        'Usage: rules-as-tests-synth [<projectRoot>] [--from-research <path>] [--output <dir>] [--pattern <id>] [--generate]\n',
      );
      process.exit(0);
    } else if (!a.startsWith('-')) args.root = a;
  }
  return args;
}

async function loadPlan(args: Args): Promise<ResearchPlan> {
  if (args.fromResearch) {
    const parsed: unknown = JSON.parse(readFileSync(args.fromResearch, 'utf8'));
    // args.root is the consumer project root this --from-research run targets
    // (defaults to process.cwd(), or an explicit positional arg) — thread it
    // as the Tier-1 resolveCtx root. Never guess a different root (DN #7).
    validateResearchPlan(parsed, resolveCtxForRoot(args.root));
    return parsed;
  }
  if (process.env['AIF_RESEARCH'] === 'llm') {
    return createAnthropicResearchClient().research(detectStack(args.root));
  }
  return research(detectStack(args.root));
}

function filterPattern(plan: SynthesisPlan, pattern: string | null): SynthesisPlan {
  if (!pattern) return plan;
  return { ...plan, rules: plan.rules.filter((r) => r.research.entryId === pattern) };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const plan = await loadPlan(args);

  if (args.generate) {
    const result = await runGeneratePath(plan, createAnthropicGenerateClient());
    if (result.mode === 'research-only') {
      process.stderr.write('synth: L4 rejected all generated rules — emitting research-only findings\n');
      process.stdout.write(JSON.stringify(result.plan, null, 2) + '\n');
      return;
    }
    process.stdout.write(JSON.stringify(result.plan, null, 2) + '\n');
    if (args.output) emit(result.plan, args.output);
    return;
  }

  const synthPlan = filterPattern(synthesize(plan), args.pattern);
  process.stdout.write(JSON.stringify(synthPlan, null, 2) + '\n');
  if (args.output) emit(synthPlan, args.output);
}

main().catch((err) => {
  process.stderr.write(`synth: ${(err as Error).message}\n`);
  process.exit(1);
});
