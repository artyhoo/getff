// FOREIGN — lives under .claude/worktrees/. A parallel CC checkout's working tree.
// Forbidden: any walker that respects VCS / build boundaries must NOT descend here.
// The filename sentinel `foreign_in_claude` is what repro.sh greps for.
const RULE_GLOBS = {
  boundary: ['**/handlers/**/*.{ts,tsx}', '**/routes/**/*.{ts,tsx}'],
};

export default [{ rules: {} }];
