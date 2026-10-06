#!/usr/bin/env node
// Advisor bridge beta — explicit pilot CLI. No watcher, no daemon, no polling.
// Usage: cli.mjs --mailbox <dir> <command> [flags]
// Exit codes: 0 ok; 2 usage; 3 HOLD; 4 rejected/invalid; 5 internal.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
  ask             --ask-id ID --question TEXT --work-key KEY
  consult-run     --ask-id ID
  consult-import  --ask-id ID
  report-import   --work-key KEY --revision N --report-id ID --status DONE|PARTIAL|BLOCKED
                  --body TEXT --request-digest SHA256 --actor OWNER-TOKEN --owner-ack
                  [--artifact PATH=SHA256 ...] [--evidence "CMD=>EXIT" ...]
                  [--pass-id ATTEMPT-ID] [--consult-decision EVENT-ID --application-ack]
                  [--blocker TEXT]
  decide          --report-id ID --verdict ACCEPTED|REWORK|OPERATOR_REQUIRED --actor UUID [--criteria TEXT]
  off             --actor ACTOR
  reconcile-lock  --actor ACTOR --rationale TEXT(>=20 chars)
  reconcile-attempt --attempt-id ID --mark abandoned|completed --rationale TEXT --actor ACTOR
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
        if (Object.prototype.hasOwnProperty.call(args, key)) {
          args[key] = Array.isArray(args[key]) ? [...args[key], next] : [args[key], next];
        } else {
          args[key] = next;
        }
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

const toList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

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
      if (existing) return { ...existing, replay: true, terminated: [], unproven: [] };
      const result = store.offPilot(mailbox, { actor: args.actor });
      // OFF requests termination of the exactly identified owned process;
      // cessation is verified; an unprovable kill is reported, never assumed.
      const terminated = [];
      const unproven = [];
      for (const a of store.listAttempts(mailbox)) {
        if (a.status !== 'reserved' || typeof a.pid !== 'number') continue;
        let alive = false;
        try {
          process.kill(a.pid, 0);
          alive = true;
        } catch {
          alive = false;
        }
        if (!alive) continue;
        try { process.kill(a.pid, 'SIGTERM'); } catch { /* already gone */ }
        const deadline = Date.now() + 5000;
        let gone = false;
        while (Date.now() < deadline) {
          try {
            process.kill(a.pid, 0);
          } catch {
            gone = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        if (gone) {
          store.completeCcPass(mailbox, {
            attemptId: a.attemptId,
            patch: {
              terminationRequested: true,
              verifiedEnded: true,
              captureReason: 'OFF committed; pass interrupted before completion',
            },
            outcome: 'interrupted',
          });
          terminated.push({ attemptId: a.attemptId, pid: a.pid });
        } else {
          unproven.push({ attemptId: a.attemptId, pid: a.pid });
        }
      }
      store.journalAppend(mailbox, {
        eventId: `off-${result.offAt.replace(/[^a-zA-Z0-9._-]/g, '')}`,
        type: 'pilot-off',
        actor: args.actor,
        payload: { offAt: result.offAt, terminated, unproven },
      });
      return { ...result, terminated, unproven };
    });
  },

  'reconcile-lock'(mailbox, args) {
    need(args, 'actor', 'rationale');
    // Deliberately NOT under the operation lock: an abandoned lock must be
    // reconcilable. A live holder process is refused by the store.
    return store.reconcileOpLock(mailbox, { actor: args.actor, rationale: args.rationale });
  },

  'reconcile-attempt'(mailbox, args) {
    need(args, 'attempt-id', 'mark', 'rationale', 'actor');
    return store.withOpLock(mailbox, () => {
      const attempt = store.readAttempt(mailbox, args['attempt-id']);
      if (!attempt) throw new RejectError('attempt not found', { attemptId: args['attempt-id'] });
      // Evidence, not narrative: cessation of the recorded pid, captured stdout,
      // session identity and model evidence decide what may be marked.
      let stdoutCaptured = false;
      let capture = { trusted: false, reason: 'stdout-missing' };
      if (typeof attempt.stdoutPath === 'string' && existsSync(attempt.stdoutPath)) {
        const text = readFileSync(attempt.stdoutPath, 'utf8');
        stdoutCaptured = text.trim().length > 0;
        if (stdoutCaptured) capture = bridge.parseChildResult(text, attempt.sessionId);
      }
      let cessationProven = false;
      if (typeof attempt.pid === 'number') {
        try {
          process.kill(attempt.pid, 0);
          cessationProven = false;
        } catch {
          cessationProven = true;
        }
      }
      const evidence = {
        cessationProven,
        spawnNeverObserved: attempt.pid == null,
        stdoutCaptured,
        captureTrusted: capture.trusted === true,
        captureReason: capture.reason ?? null,
        modelMatched: capture.trusted === true && Array.isArray(capture.model)
          && capture.model.includes(bridge.EXECUTOR_MODEL),
        modelExpected: bridge.EXECUTOR_MODEL,
      };
      return store.reconcileAttempt(mailbox, {
        attemptId: args['attempt-id'],
        mark: args.mark,
        rationale: args.rationale,
        actor: args.actor,
        evidence,
      });
    });
  },

  ask(mailbox, args) {
    need(args, 'ask-id', 'question', 'work-key');
    return store.withOpLock(mailbox, async () => {
      store.checkAdmission(mailbox, 'mutation');
      return store.submitAsk(mailbox, {
        askId: args['ask-id'],
        question: args.question,
        actor: args.actor,
        workKey: args['work-key'],
      });
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
        const schemaPath = store.mailboxPath(mailbox, 'outbox', `${ask.askId}.schema.json`);
        writeFileSync(schemaPath, `${JSON.stringify(bridge.advisorOutputSchema({ askId: ask.askId, inputDigest: ask.inputDigest }), null, 2)}\n`);
        const forkArgs = bridge.buildAdvisorArgs({
          seed: locator.seed,
          modelPin: locator.pin,
          coordinationDir: pilot.coordinationDir,
          askPath,
          candidatePath,
          schemaPath,
          askId: ask.askId,
          inputDigest: ask.inputDigest,
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
        return { fork, pilot, seed: locator.seed, ask };
      });
      const { fork, pilot, seed, ask } = reserved;
      const childEnv = { ...process.env, AB_FAKE_ASK_ID: ask.askId, AB_FAKE_INPUT_DIGEST: ask.inputDigest };
      const outcome = await bridge.runChildToCompletion({
        argv: fork.argvRedacted.includes('<redacted:live-advisor-md>')
          ? fork.argvRedacted.map((a) => (a === '<redacted:live-advisor-md>' ? seed : a))
          : fork.argvRedacted,
        cwd: pilot.coordinationDir,
        env: childEnv,
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
          capture = store.validateAdvisorCandidate(readFileSync(fork.candidatePath, 'utf8'), {
            askId: ask.askId,
            inputDigest: ask.inputDigest,
          });
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
          throw new HoldError(`advisor capture rejected (${capture.reason}); ask stays OPEN`, {
            askId: fork.askId, forkId: fork.forkId, reason: capture.reason,
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
        // Task progression gate: one executor through initial/rework passes.
        const gate = store.gateRunAdmission(mailbox, {
          workKey: args['work-key'],
          prompt: args.prompt,
          resume,
        });
        if (gate.replay) return { replay: gate.replay, pilot };
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
          workKey: args['work-key'], passNumber, sessionId, resumeFrom, deadlineMs, argv, prompt: args.prompt,
        });
        store.recordCcPassLaunched(mailbox);
        return { attempt, pilot };
      });

      if (reserved.replay) {
        return { ...reserved.replay, replay: true };
      }
      const { attempt, pilot } = reserved;
      const outcome = await bridge.runChildToCompletion({
        argv: attempt.argv,
        cwd: pilot.executorWorktree,
        env: process.env,
        deadlineMs: attempt.deadlineMs,
        stdoutPath: attempt.stdoutPath,
        onSpawn: (pid) => store.recordAttemptPid(mailbox, attempt.attemptId, pid),
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
        // A committed OFF during the pass means no ordinary completed
        // advancement is recorded; the outcome is an interrupted HOLD.
        if (status === 'completed' && store.readOff(mailbox)) {
          status = 'interrupted';
          patch.captureReason = 'OFF committed during the pass; outcome not advanced';
        }
        const merged = store.completeCcPass(mailbox, { attemptId: attempt.attemptId, patch, outcome: status });
        if (status !== 'completed') {
          throw new HoldError(`pass ended ${status}; unproven or interrupted outcome — no relaunch, reconcile required`, {
            attemptId: attempt.attemptId, captureReason: patch.captureReason ?? null,
          });
        }
        return merged;
      });
    })();
  },

  'report-import'(mailbox, args) {
    need(args, 'work-key', 'revision', 'report-id', 'status', 'body', 'request-digest', 'actor');
    // Late ingestion stays available under OFF: no admission gate here.
    return store.withOpLock(mailbox, async () => store.importReport(mailbox, {
      workKey: args['work-key'],
      revision: Number(args.revision),
      reportId: args['report-id'],
      reportStatus: args.status,
      body: args.body,
      actor: args.actor,
      destRel: args['dest-rel'] ?? null,
      requestDigest: args['request-digest'],
      ownerAck: args['owner-ack'] === true,
      artifacts: toList(args.artifact).map((s) => {
        const i = s.indexOf('=');
        return { path: s.slice(0, i), sha256: s.slice(i + 1) };
      }),
      evidence: toList(args.evidence).map((s) => {
        const i = s.indexOf('=>');
        return { command: s.slice(0, i), exit: Number(s.slice(i + 2)) };
      }),
      consultDecisionId: args['consult-decision'] ?? null,
      applicationAck: args['application-ack'] === true,
      blocker: args.blocker ?? null,
      passId: args['pass-id'] ?? null,
    }));
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
