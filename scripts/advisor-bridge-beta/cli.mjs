#!/usr/bin/env node
// Advisor bridge beta — explicit pilot CLI. No watcher, no daemon, no polling.
// Usage: cli.mjs --mailbox <dir> <command> [flags]
// Exit codes: 0 ok; 2 usage; 3 HOLD; 4 rejected/invalid; 5 internal.

import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { HoldError, RejectError } from './store.mjs';
import * as store from './store.mjs';
import * as bridge from './process.mjs';

const USAGE = `advisor-bridge-beta pilot CLI
usage: cli.mjs --mailbox <dir> <command> [flags]

commands:
  enroll          --pilot-id ID --senior-session UUID --executor-worktree DIR
                  --coordination-dir DIR --repo-common-dir DIR [--test-mode --child-bin PATH]
  status
  request         --work-key KEY --revision N --body TEXT [--actor ACTOR]
  own             --work-key KEY --owner-token TOKEN
  run             --work-key KEY --owner-token TOKEN --prompt TEXT [--resume] [--deadline-ms N]
  ask             --ask-id ID --question TEXT
  consult-run     --ask-id ID
  consult-import  --ask-id ID
  report-import   --work-key KEY --revision N --report-id ID --status S --body TEXT
  decide          --report-id ID --verdict ACCEPTED|REWORK|OPERATOR_REQUIRED --actor UUID [--criteria TEXT]
  off             --actor ACTOR
  reconcile-lock  --actor ACTOR --rationale TEXT(>=20 chars)
  reconcile-attempt --attempt-id ID --mark completed|unknown --rationale TEXT --actor ACTOR
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      args._.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function need(args, ...keys) {
  for (const k of keys) {
    if (typeof args[k] !== 'string' || args[k].length === 0) {
      throw new RejectError(`missing required flag --${k}`);
    }
  }
}

const commands = {
  enroll(mailbox, args) {
    need(args, 'pilot-id', 'senior-session', 'executor-worktree', 'coordination-dir', 'repo-common-dir');
    const pilot = store.enroll(mailbox, {
      pilotId: args['pilot-id'],
      seniorSessionId: args['senior-session'],
      executorWorktree: args['executor-worktree'],
      coordinationDir: args['coordination-dir'],
      repoCommonDir: args['repo-common-dir'],
      testMode: args['test-mode'] === true,
      childBin: args['child-bin'],
    });
    store.journalAppend(mailbox, {
      eventId: `enroll-${pilot.pilotId}`,
      type: 'pilot-enrolled',
      actor: 'operator',
      payload: { pilotId: pilot.pilotId },
    });
    return pilot;
  },

  status(mailbox) {
    return store.status(mailbox);
  },

  request(mailbox, args) {
    need(args, 'work-key', 'revision', 'body');
    return store.withOpLock(mailbox, async () => {
      store.checkAdmission(mailbox, 'mutation');
      return store.submitRequest(mailbox, {
        workKey: args['work-key'],
        revision: Number(args.revision),
        body: args.body,
        actor: args.actor ?? 'bridge-cli',
      });
    });
  },

  own(mailbox, args) {
    need(args, 'work-key', 'owner-token');
    return store.withOpLock(mailbox, async () => {
      store.checkAdmission(mailbox, 'mutation');
      return store.acquireOwnership(mailbox, {
        workKey: args['work-key'],
        ownerToken: args['owner-token'],
      });
    });
  },

  off(mailbox, args) {
    need(args, 'actor');
    return store.withOpLock(mailbox, async () => {
      const existing = store.readOff(mailbox);
      if (existing) return { ...existing, replay: true };
      const result = store.offPilot(mailbox, { actor: args.actor });
      store.journalAppend(mailbox, {
        eventId: `off-${result.offAt.replace(/[^a-zA-Z0-9._-]/g, '')}`,
        type: 'pilot-off',
        actor: args.actor,
        payload: { offAt: result.offAt },
      });
      return result;
    });
  },

  'reconcile-lock'(mailbox, args) {
    need(args, 'actor', 'rationale');
    return store.withOpLock(mailbox, () => store.reconcileOpLock(mailbox, { actor: args.actor, rationale: args.rationale }));
  },

  'reconcile-attempt'(mailbox, args) {
    need(args, 'attempt-id', 'mark', 'rationale', 'actor');
    return store.withOpLock(mailbox, () => store.reconcileAttempt(mailbox, {
      attemptId: args['attempt-id'],
      mark: args.mark,
      rationale: args.rationale,
      actor: args.actor,
    }));
  },

  ask(mailbox, args) {
    need(args, 'ask-id', 'question');
    return store.withOpLock(mailbox, async () => {
      store.checkAdmission(mailbox, 'mutation');
      return store.submitAsk(mailbox, { askId: args['ask-id'], question: args.question, actor: args.actor });
    });
  },

  'consult-run'(mailbox, args) {
    need(args, 'ask-id');
    return (async () => {
      const reserved = await store.withOpLock(mailbox, async () => {
        const { pilot } = store.checkAdmission(mailbox, 'advisor-call');
        const ask = store.readAsk(mailbox, args['ask-id']);
        if (!ask) throw new RejectError('ask not found', { askId: args['ask-id'] });
        if (ask.status !== 'open') {
          throw new HoldError('ask already answered; one fork per ask', { askId: ask.askId });
        }
        const locator = bridge.readAdvisorLocator(pilot.coordinationDir, { testMode: pilot.testMode });
        const candidatePath = store.mailboxPath(mailbox, 'outbox', `${ask.askId}.candidate.json`);
        const askPath = store.mailboxPath(mailbox, 'asks', `${ask.askId}.md`);
        const forkArgs = bridge.buildAdvisorArgs({
          seed: locator.seed,
          modelPin: locator.pin,
          coordinationDir: pilot.coordinationDir,
          askPath,
          candidatePath,
          question: ask.question,
        });
        const base = pilot.testMode ? bridge.childBaseCommand(pilot) : { bin: 'codex', prefix: [] };
        const argv = [base.bin, ...base.prefix, ...forkArgs];
        const fork = store.reserveAdvisorFork(mailbox, {
          askId: ask.askId,
          argvRedacted: bridge.redactArgv(argv, locator.seed),
          candidatePath,
          deadlineMs: pilot.limits.processDeadlineMs,
        });
        store.recordAdvisorCallLaunched(mailbox);
        return { fork, pilot, seed: locator.seed };
      });
      const { fork, pilot, seed } = reserved;
      const outcome = await bridge.runChildToCompletion({
        argv: fork.argvRedacted.includes('<redacted:live-advisor-md>')
          ? fork.argvRedacted.map((a) => (a === '<redacted:live-advisor-md>' ? seed : a))
          : fork.argvRedacted,
        cwd: pilot.coordinationDir,
        env: process.env,
        deadlineMs: fork.deadlineMs,
      });
      return store.withOpLock(mailbox, () => {
        const patch = {
          pid: outcome.pid,
          exitCode: outcome.exitCode,
          signal: outcome.signal,
          timedOut: outcome.timedOut,
          verifiedEnded: outcome.verifiedEnded,
          cessation: { pid: outcome.pid, verifiedEnded: outcome.verifiedEnded },
        };
        let capture = { trusted: false, reason: 'capture-missing' };
        if (!outcome.spawnError && !outcome.timedOut && existsSync(fork.candidatePath)) {
          capture = bridge.parseAdvisorCandidate(readFileSync(fork.candidatePath, 'utf8'));
          if (!capture.trusted) capture = { trusted: false, reason: capture.reason ?? 'capture-invalid' };
        } else if (outcome.timedOut) {
          capture = { trusted: false, reason: 'deadline-expired' };
        } else if (outcome.spawnError) {
          capture = { trusted: false, reason: `spawn-error: ${outcome.spawnError}` };
        }
        const status = capture.trusted ? 'captured' : 'capture-invalid';
        const merged = store.recordForkCapture(mailbox, fork.askId, {
          ...patch,
          status,
          captureReason: capture.trusted ? null : capture.reason,
        });
        if (!capture.trusted) {
          throw new HoldError(`advisor capture ${capture.reason}; ask stays OPEN`, {
            askId: fork.askId, forkId: fork.forkId,
          });
        }
        return merged;
      });
    })();
  },

  'consult-import'(mailbox, args) {
    need(args, 'ask-id');
    // Recovery is allowed under OFF: journal/import recovery stays available.
    return store.withOpLock(mailbox, () => store.importDecision(mailbox, { askId: args['ask-id'], actor: args.actor ?? 'bridge' }));
  },

  decide(mailbox, args) {
    need(args, 'report-id', 'verdict', 'actor');
    return store.withOpLock(mailbox, () => store.recordVerdict(mailbox, {
      reportId: args['report-id'],
      verdict: args.verdict,
      criteria: args.criteria ?? null,
      actor: args.actor,
    }));
  },

  run(mailbox, args) {
    need(args, 'work-key', 'owner-token', 'prompt');
    const resume = args.resume === true;
    return (async () => {
      const reserved = await store.withOpLock(mailbox, async () => {
        const { pilot } = store.checkAdmission(mailbox, resume ? 'cc-resume' : 'cc-pass');
        bridge.assertProfileEnv(process.env, pilot);
        store.acquireOwnership(mailbox, { workKey: args['work-key'], ownerToken: args['owner-token'] });
        let resumeFrom = null;
        let sessionId;
        if (resume) {
          const prev = store.latestCompletedAttempt(mailbox);
          if (!prev || prev.cessation?.verifiedEnded !== true) {
            throw new HoldError('no proven-ended prior pass available for exact-ID resume');
          }
          resumeFrom = prev.sessionId;
          sessionId = resumeFrom;
        } else {
          sessionId = randomUUID();
        }
        if (!existsSync(pilot.executorWorktree)) {
          throw new RejectError('executor worktree missing', { path: pilot.executorWorktree });
        }
        const passNumber = store.listAttempts(mailbox).length + 1;
        const deadlineMs = pilot.testMode && args['deadline-ms']
          ? Number(args['deadline-ms'])
          : pilot.limits.processDeadlineMs;
        const base = bridge.childBaseCommand(pilot);
        const argv = [base.bin, ...base.prefix, ...bridge.buildExecutorArgs({ sessionId, prompt: args.prompt, resumeFrom })];
        const attempt = store.reserveCcPass(mailbox, {
          workKey: args['work-key'], passNumber, sessionId, resumeFrom, deadlineMs, argv,
        });
        store.recordCcPassLaunched(mailbox);
        return { attempt, pilot };
      });

      const { attempt, pilot } = reserved;
      const outcome = await bridge.runChildToCompletion({
        argv: attempt.argv,
        cwd: pilot.executorWorktree,
        env: process.env,
        deadlineMs: attempt.deadlineMs,
        stdoutPath: attempt.stdoutPath,
      });

      return store.withOpLock(mailbox, () => {
        const capture = bridge.parseChildResult(outcome.stdout, attempt.sessionId);
        const patch = {
          pid: outcome.pid,
          exitCode: outcome.exitCode,
          signal: outcome.signal,
          timedOut: outcome.timedOut,
          verifiedEnded: outcome.verifiedEnded,
          cessation: { pid: outcome.pid, verifiedEnded: outcome.verifiedEnded },
        };
        let status;
        if (outcome.spawnError) {
          status = 'unknown';
          patch.captureReason = `spawn-error: ${outcome.spawnError}`;
        } else if (outcome.timedOut) {
          status = 'deadline-unknown';
          patch.captureReason = 'deadline-expired';
        } else if (!capture.trusted) {
          status = 'unknown';
          patch.captureReason = capture.reason;
        } else {
          status = 'completed';
          patch.resultSummary = { isError: capture.isError, result: capture.result, model: capture.model };
        }
        const merged = store.completeCcPass(mailbox, { attemptId: attempt.attemptId, patch, outcome: status });
        if (status !== 'completed') {
          throw new HoldError(`pass ended ${status}; unproven outcome — no relaunch, reconcile required`, {
            attemptId: attempt.attemptId, captureReason: patch.captureReason ?? null,
          });
        }
        return merged;
      });
    })();
  },

  'report-import'(mailbox, args) {
    need(args, 'work-key', 'revision', 'report-id', 'status', 'body');
    return store.withOpLock(mailbox, async () => {
      store.checkAdmission(mailbox, 'mutation');
      return store.importReport(mailbox, {
        workKey: args['work-key'],
        revision: Number(args.revision),
        reportId: args['report-id'],
        reportStatus: args.status,
        body: args.body,
        actor: args.actor,
        destRel: args['dest-rel'] ?? null,
      });
    });
  },
};

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const mailbox = args.mailbox;
  const command = args._[0];
  if (typeof mailbox !== 'string' || !command || args.help === true) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }
  const fn = commands[command];
  if (!fn) {
    process.stderr.write(`unknown command: ${command}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  try {
    const result = await fn(mailbox, args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (e) {
    if (e instanceof HoldError) {
      process.stderr.write(`${JSON.stringify({ error: 'HOLD', reason: e.reason, details: e.details }, null, 2)}\n`);
      process.exitCode = 3;
    } else if (e instanceof RejectError) {
      process.stderr.write(`${JSON.stringify({ error: 'REJECT', reason: e.reason, details: e.details }, null, 2)}\n`);
      process.exitCode = 4;
    } else {
      process.stderr.write(`${JSON.stringify({ error: 'INTERNAL', message: String(e?.stack ?? e) }, null, 2)}\n`);
      process.exitCode = 5;
    }
  }
}

await main();
