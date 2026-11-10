// The rule moved to getff's core plugin (one plugin for every stack); the preset keeps its plugin
// name for the validator's workspace resolution and re-exports the core rule.
import { requireErrorBoundary } from '../../core/eslint-rules/require-error-boundary.ts';

const plugin = {
  meta: {
    name: '@rules-as-tests/preset-react-spa-eslint-rules',
    version: '0.1.0',
  },
  rules: {
    'require-error-boundary': requireErrorBoundary,
  },
};

export default plugin;
export const rules = plugin.rules;
