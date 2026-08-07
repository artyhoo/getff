// packages/runtime-bridge/src/cli/openQuestion.ts
/**
 * The single shared OPEN-QUESTION anchor.
 *
 * Written by park.ts (writer) as a heading appended to a parked task's plan, and
 * read back by questions.ts (reader) to detect a mid-flight park whose ephemeral
 * blockedReason was wiped by the implementing→review transition. Shared here so
 * the wording cannot drift between writer and reader
 * (per .claude/rules/dual-implementation-discipline.md #two-prompts-drift).
 *
 * The writer may append a suffix (e.g. " (awaiting operator)"); the reader matches
 * on this substring, so both sides agree on the stable prefix and nothing else.
 *
 * @dual-pair: open-question-anchor
 * @cc-only-rationale: pure constant — no CC-only primitive, no paid LLM.
 */
export const OPEN_QUESTION_ANCHOR = '## ⏸ OPEN QUESTION';
