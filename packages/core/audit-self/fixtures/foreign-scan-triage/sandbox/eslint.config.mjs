// Consumer fixture eslint.config.mjs — has RULE_GLOBS.boundary so check-rule-globs.sh
// + check-rule-enforced.sh + detect-r2-boundary.sh all enter their main walk paths.
// Minimal: no actual plugin wiring (we are testing WHERE they walk, not what they fire on).
const RULE_GLOBS = {
  boundary: ['**/handlers/**/*.{ts,tsx}', '**/routes/**/*.{ts,tsx}'],
};

export default [
  {
    rules: {},
  },
];
