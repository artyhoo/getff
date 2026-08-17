// Test fixture — stands in for the barrel install.sh vendors into a consumer root
// (setup.d/lib.sh generate_eslint_barrel: `<consumer>/eslint-rules-local/index.mjs`, one
// plugin object, `rules` keyed by bare rule name, default + named `rules` export).
//
// It carries ONE deliberately tautological rule: `always-fires` reports on every Program
// node, so it fires even on an empty file. That is what makes the paired-negative in
// gate-tautology.test.ts discriminating — if the consumer-barrel tier of
// preset-plugin-resolver.ts were dead, the gate would report `degrade` instead of catching
// the tautology, and the U10 option-b fix would be theatre.

const alwaysFires = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { always: 'fixture rule: fires unconditionally' },
  },
  create(context) {
    return {
      Program(node) {
        context.report({ node, messageId: 'always' });
      },
    };
  },
};

const plugin = {
  meta: { name: '@rules-as-tests/local-eslint-rules', version: '0.1.0' },
  rules: { 'always-fires': alwaysFires },
};

export default plugin;
export const rules = plugin.rules;
