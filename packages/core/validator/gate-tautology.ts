// L4 Gate 4 — Tautology check.
// Per architecture.md §2.6 + Principle 4 (no-tautology): a synthesized
// eslint rule that fires on a fixed negative-corpus (empty file,
// comment-only file, unrelated TSX) is a tautology — it claims a
// violation where none exists. Such rules are rejected at L4.
//
// Reuses Linter setup from gate 2; differs in expectation: gate 4
// expects ZERO violations on every corpus file for every eslint rule.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import tseslintParser from '@typescript-eslint/parser';
import {
  degradeFor,
  gateOutcome,
  isUnresolvablePluginRule,
  knownPlugins,
  resolvePluginRegistry,
  type PluginRegistry,
  type PresetResolutionOptions,
} from './preset-plugin-resolver.ts';
import type { SynthesisPlan, SynthesizedRule } from '../synthesizer/types.ts';
import type { GateDegrade, GateFailure, GateOutcome } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = resolve(HERE, 'fixtures', 'negative-corpus');
const CORPUS_FILES = ['empty.ts', 'comment-only.ts', 'unrelated.tsx'] as const;

function buildConfig(
  rule: SynthesizedRule,
  parsedSnippet: Record<string, unknown>,
  registry: PluginRegistry,
): Linter.Config[] | null {
  if (rule.check.type !== 'eslint') return null;
  const ruleName = rule.check.rule;
  const ruleConfig = parsedSnippet[ruleName] ?? 'error';
  return [
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      languageOptions: {
        parser: tseslintParser,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
      },
      plugins: knownPlugins(registry),
      rules: { [ruleName]: ruleConfig as Linter.RuleEntry },
    },
  ] as Linter.Config[];
}

export function runTautologyGate(
  plan: SynthesisPlan,
  opts?: PresetResolutionOptions,
): GateOutcome {
  const eslintRules = plan.rules.filter((r) => r.check.type === 'eslint');
  if (eslintRules.length === 0) {
    return { status: 'n/a', failures: [] };
  }
  const registry = resolvePluginRegistry(opts);
  const parsedSnippet = JSON.parse(plan.eslintConfigSnippet) as Record<
    string,
    unknown
  >;
  const linter = new Linter();
  const failures: GateFailure[] = [];
  const degraded: GateDegrade[] = [];

  const corpus = CORPUS_FILES.map((name) => ({
    name,
    code: readFileSync(resolve(CORPUS_DIR, name), 'utf8'),
  }));

  for (const rule of eslintRules) {
    if (rule.check.type !== 'eslint') continue;
    const config = buildConfig(rule, parsedSnippet, registry);
    if (!config) continue;
    const ruleName = rule.check.rule;
    // Linting an unregistered plugin rule throws inside linter.verify ("Could not find
    // plugin") — record the skip instead of crashing the shipped bin.
    if (isUnresolvablePluginRule(ruleName, registry)) {
      degraded.push(degradeFor('tautology', ruleName, registry, rule.id));
      continue;
    }
    for (const file of corpus) {
      const messages = linter.verify(file.code, config, { filename: file.name });
      const violating = messages.filter((m) => m.ruleId === ruleName);
      if (violating.length > 0) {
        failures.push({
          ruleId: rule.id,
          code: 'FF3007',
          reason: `tautology — rule '${ruleName}' fires on negative-corpus/${file.name}: ${violating
            .map((m) => m.message)
            .join('; ')}`,
        });
      }
    }
  }

  return gateOutcome(failures, degraded);
}
