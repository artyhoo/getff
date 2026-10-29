import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseParkArgs, validateParkArgs } from '../../../packages/runtime-bridge/src/cli/park.js';

/**
 * Park-contract validator for the pipeline §4c Lever-2 fork discipline
 * (DOT-PR2089-P01-CORRECTION-20261012, Root-adjudicated owner handoff).
 *
 * Contract under test — the canonical template and the intent-first-result
 * kickoff must instruct the aif agent to park a genuine blocking fork through
 * the existing mid-flight primitive (`packages/runtime-bridge/src/cli/park.ts
 * --question …`), NOT to write `manualReviewRequired` / `blocked_external`
 * statuses by hand. The old Lever-2 wording directed exactly that imperative;
 * park.ts rejects terminal states by design and those statuses are not
 * substitutes for the park operation.
 *
 * Constraints carried from the correction packet:
 * - Both markdown surfaces are loaded as literal UTF-8 text and validated by
 *   substring/regex only — the paired negative fixture (the original line-181
 *   wording) must FAIL the same validator that the corrected files pass.
 * - The negative-with-command fixture keeps the valid park command AND the
 *   required phrase and is rejected on the imperative alone (rejection is
 *   independent of command presence).
 * - Explanatory negative mentions ("`manualReviewRequired` and
 *   `blocked_external` are not substitutes") are legal.
 * - Consumer-route qualification (ROOT-PR2113 PR2089-CONSUMER-01): §4c makes
 *   itself mandatory for consumer dispatch (the live-when note names the
 *   vendor `dispatch.ts` command), yet Lever 2 supplies only the FRAMEWORK
 *   park command — a consumer install has no `packages/` tree. A template
 *   that names consumer dispatch MUST also carry the explicit
 *   verified-on-destination-or-STOP qualification. Naming a conditional
 *   candidate vendor park path is legal: unverified is gated, not forbidden.
 * - Parser agreement imports parseParkArgs directly and calls it with literal
 *   argument arrays plus the arguments extracted from the documented command.
 *   The park CLI is NEVER spawned and no HTTP request is made — parkTask is
 *   deliberately not imported.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const TEMPLATE_PATH = join(
  REPO_ROOT,
  '.agents/procedures/pipeline/templates/meta-kickoff.template.md',
);
const KICKOFF_PATH = join(
  REPO_ROOT,
  '.claude/orchestrator-prompts/intent-first-result/kickoff.md',
);

/** Literal UTF-8 load — the validator sees the file bytes, nothing derived. */
function loadText(path: string): string {
  return readFileSync(path, 'utf8');
}

const PARK_PHRASE = 'Park it as a question';
const PARK_COMMAND = 'tsx packages/runtime-bridge/src/cli/park.ts --question';
/**
 * The forbidden shape: an instruction to WRITE a status instead of parking.
 * Explanatory mentions of the same status names (no "set the task to" lead)
 * do not match — those are legal per the packet.
 */
const SET_STATUS_IMPERATIVE = /set the task to\s+`?(?:manualReviewRequired|blocked_external)/i;

/**
 * Consumer-route qualification markers (ROOT-PR2113 PR2089-CONSUMER-01). The
 * §4c live-when note makes the section mandatory for consumer dispatch via the
 * vendor command below; the framework Lever-2 park command alone leaves that
 * route unresolved (a consumer has no packages/ tree). A consumer-dispatching
 * template must carry BOTH: the framework-only fence on the Lever-2 command,
 * and the verified-on-destination-or-STOP rule for autonomous dispatch.
 */
const CONSUMER_DISPATCH_COMMAND = 'tsx .claude/vendor/runtime-bridge/src/cli/dispatch.ts';
const FRAMEWORK_ONLY_FENCE = 'must not be used in a consumer';
const VERIFIED_OR_STOP = 'STOP as UNVERIFIED before dispatch';

/**
 * Violation codes, in stable order: consumer-dispatch-without-framework-only-fence,
 * consumer-dispatch-without-verified-or-stop. No violation when no consumer
 * dispatch is named — the obligation is bound to the consumer route, and a
 * conditional candidate vendor path is NOT forbidden merely for being unverified.
 */
function validateConsumerRoute(text: string): string[] {
  const violations: string[] = [];
  if (text.includes(CONSUMER_DISPATCH_COMMAND)) {
    if (!text.includes(FRAMEWORK_ONLY_FENCE)) violations.push('consumer-dispatch-without-framework-only-fence');
    if (!text.includes(VERIFIED_OR_STOP)) violations.push('consumer-dispatch-without-verified-or-stop');
  }
  return violations;
}

/** Violation codes, in stable order: missing-park-phrase, missing-park-command, forbidden-set-status-imperative. */
function validateParkContract(text: string): string[] {
  const violations: string[] = [];
  if (!text.includes(PARK_PHRASE)) violations.push('missing-park-phrase');
  if (!text.includes(PARK_COMMAND)) violations.push('missing-park-command');
  if (SET_STATUS_IMPERATIVE.test(text)) violations.push('forbidden-set-status-imperative');
  return violations;
}

/** The reviewed corrected Lever-2 wording (Root adjudication briefs.PR2089). */
const CORRECTED_LEVER_2 =
  '> **aif agent — fork discipline (non-negotiable):** On a genuine fork that blocks continuing implementation ' +
  '(two defensible implementations, an undecided design choice, or a missing spec detail that changes behaviour), ' +
  'do not guess. Park it as a question using the existing mid-flight park primitive: ' +
  '`tsx packages/runtime-bridge/src/cli/park.ts --question "Fork: Option A → consequence X / Option B → consequence Y"` ' +
  'from the framework repository root; `--task <actual-task-id>` may be supplied, otherwise the CLI uses ' +
  '`HANDOFF_TASK_ID`. The primitive records the question in the plan and sets `paused:true` with `blockedReason`; ' +
  '`manualReviewRequired` and `blocked_external` are not substitutes for this operation. Stop the blocked task and ' +
  'report any park failure to the dispatcher; never claim it is parked after a failed command or silently continue ' +
  'that task. Proceed only on independent, unambiguous work. Resolution and status-specific handling remain owned by ' +
  'the existing dispatcher parks procedure. This carries the genuine-fork discipline in ' +
  '`.agents/hooks/lang/en.sh:110–123` without inventing a new AIF state transition.';

/** The original pre-correction wording (template §4c Lever 2 == kickoff line 181, byte-identical at review head). */
const ORIGINAL_LEVER_2 =
  '> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible ' +
  'implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT pick.** ' +
  'Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as ' +
  '«Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous ' +
  'parts. This carries the fork-challenge discipline `ask-question-reminder.sh` emits ' +
  '(`.claude/hooks/lang/en.sh:110-126`). Guessing a fork to "keep moving" is the failure this whole loop exists to ' +
  'prevent.';

/**
 * The pre-clarification §4c shape (ROOT-PR2113 failureScenario): consumer
 * dispatch named by the live-when note, Lever 2 supplies only the framework
 * park command, no consumer-route qualification anywhere. Minimal literal
 * fixture — not claimed to be template bytes.
 */
const PRE_CLARIFICATION_CONSUMER_SECTION =
  'If any sub-wave is dispatched via `tsx .claude/vendor/runtime-bridge/src/cli/dispatch.ts <this-kickoff>`, ' +
  '§4c is MANDATORY.\n\n' +
  CORRECTED_LEVER_2;

/**
 * The clarified qualification in minimal form: the phrases the contract
 * requires (framework-only fence + verified-or-STOP), not template bytes.
 */
const CONSUMER_ROUTE_QUALIFICATION =
  'Consumer route: the framework command above must not be used in a consumer. Verify the delivered vendor park ' +
  'primitive and the task context on the destination, or STOP as UNVERIFIED before dispatch.';

describe('park-contract validator (paired fixtures)', () => {
  it('accepts the corrected Lever-2 wording, including its explanatory negative mentions', () => {
    expect(validateParkContract(CORRECTED_LEVER_2)).toEqual([]);
  });

  it('rejects the original line-181 wording — phrase present, but no supported command and the forbidden imperative', () => {
    expect(validateParkContract(ORIGINAL_LEVER_2)).toEqual([
      'missing-park-command',
      'forbidden-set-status-imperative',
    ]);
  });

  it('rejects the imperative independently of command presence — valid command + phrase + injected imperative fails', () => {
    const withImperative =
      CORRECTED_LEVER_2 +
      ' On terminal states, set the task to `blocked_external` instead of parking.';
    expect(validateParkContract(withImperative)).toEqual(['forbidden-set-status-imperative']);
  });

  it('treats the phrase alone as insufficient — no command, no imperative, still a violation', () => {
    const phraseOnly = 'Guidance: Park it as a question whenever a fork appears.';
    expect(validateParkContract(phraseOnly)).toEqual(['missing-park-command']);
  });
});

describe('consumer-route qualification (paired fixtures)', () => {
  it('fails consumer dispatch plus only the framework park command — both qualification legs missing', () => {
    expect(validateConsumerRoute(PRE_CLARIFICATION_CONSUMER_SECTION)).toEqual([
      'consumer-dispatch-without-framework-only-fence',
      'consumer-dispatch-without-verified-or-stop',
    ]);
  });

  it('accepts the same section once the qualification prose is present (clarified shape)', () => {
    expect(
      validateConsumerRoute(PRE_CLARIFICATION_CONSUMER_SECTION + '\n\n' + CONSUMER_ROUTE_QUALIFICATION),
    ).toEqual([]);
  });

  it('fails on each leg independently — the fence alone does not satisfy the verified-or-STOP leg', () => {
    const fenced =
      PRE_CLARIFICATION_CONSUMER_SECTION +
      ' The framework command must not be used in a consumer.';
    expect(validateConsumerRoute(fenced)).toEqual(['consumer-dispatch-without-verified-or-stop']);
  });

  it('demands nothing when no consumer dispatch is named — framework-only §4c passes', () => {
    expect(validateConsumerRoute(CORRECTED_LEVER_2)).toEqual([]);
  });
});

describe('canonical template §4c (meta-kickoff.template.md)', () => {
  const template = loadText(TEMPLATE_PATH);

  it('passes the park-contract validator', () => {
    expect(validateParkContract(template)).toEqual([]);
  });

  it('carries the reviewed corrected Lever-2 wording verbatim', () => {
    expect(template).toContain(CORRECTED_LEVER_2);
  });

  it('preserves the pre-dispatch gate that greps for the park phrase', () => {
    expect(template).toContain("grep -qi 'park it as a question'");
  });

  it('qualifies the consumer dispatch route — framework-only fence and verified-or-STOP present', () => {
    // ROOT-PR2113 requiredTest: the previous not.toContain(vendor park.ts)
    // assertion was insufficient AND forbade a conditional candidate path
    // merely for being unverified. The contract is the explicit
    // verified-on-destination-or-STOP qualification next to the consumer
    // dispatch route; naming the candidate vendor park path is legal.
    expect(template).toContain(CONSUMER_DISPATCH_COMMAND);
    expect(validateConsumerRoute(template)).toEqual([]);
  });
});

describe('intent-first-result kickoff §7', () => {
  const kickoff = loadText(KICKOFF_PATH);

  it('passes the park-contract validator', () => {
    expect(validateParkContract(kickoff)).toEqual([]);
  });

  it('carries the reviewed corrected Lever-2 wording verbatim', () => {
    expect(kickoff).toContain(CORRECTED_LEVER_2);
  });

  it('preserves the §7 status-specific owner routing line', () => {
    expect(kickoff).toContain(
      'Route intent to advisor/operator and in-scope architecture to the existing architecture owner.',
    );
  });

  it('preserves the five host-verify commands and the spec SHA', () => {
    const block = kickoff.match(/```bash host-verify\n([\s\S]*?)```/);
    expect(block).not.toBeNull();
    const commands = (block?.[1] ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
    expect(commands).toHaveLength(5);
    expect(kickoff).toContain(
      '1af90f9e909eac2efbcd67848a09b786455f40d122571bf3282603716bb7789f',
    );
  });
});

describe('parser agreement with parseParkArgs (CLI never executed, no HTTP)', () => {
  const ENV = { HANDOFF_TASK_ID: 't-env-fallback' };

  it('falls back to $HANDOFF_TASK_ID for the documented flag-less-task invocation (literal array)', () => {
    const args = parseParkArgs(
      ['--question', 'Fork: Option A → consequence X / Option B → consequence Y'],
      ENV,
    );
    expect(args).toEqual({
      taskId: 't-env-fallback',
      question: 'Fork: Option A → consequence X / Option B → consequence Y',
      json: false,
    });
    expect(validateParkArgs(args)).toBeNull();
  });

  it('honors an explicit --task over the env fallback (literal array)', () => {
    const args = parseParkArgs(
      ['--task', 't-9', '--question', 'Fork: Option A → consequence X / Option B → consequence Y'],
      ENV,
    );
    expect(args.taskId).toBe('t-9');
    expect(validateParkArgs(args)).toBeNull();
  });

  it('parses the exact arguments of the command documented in the corrected Lever-2 wording', () => {
    const codeSpan = CORRECTED_LEVER_2.match(
      /`tsx packages\/runtime-bridge\/src\/cli\/park\.ts ([^`]+)`/,
    );
    expect(codeSpan).not.toBeNull();
    const argv = Array.from(codeSpan![1].matchAll(/"[^"]*"|\S+/g)).map((m) =>
      m[0].replace(/^"|"$/g, ''),
    );
    // Only actually-supported options — no fictional flags in the documented command.
    const flags = argv.filter((token) => token.startsWith('--'));
    expect(flags.every((flag) => ['--task', '--question', '--json'].includes(flag))).toBe(true);
    const args = parseParkArgs(argv, ENV);
    expect(args.question).toBe('Fork: Option A → consequence X / Option B → consequence Y');
    expect(args.taskId).toBe('t-env-fallback');
    expect(validateParkArgs(args)).toBeNull();
  });
});
