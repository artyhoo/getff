// Advisor bridge beta — bounded child-process lifecycle.
// Subprocess argument arrays only; explicit cwd; no shell interpolation.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HoldError, RejectError } from './store.mjs';

export const EXECUTOR_MODEL = 'glm-5.3';

// The launch card argv. Recorded verbatim in every attempt record.
export function buildExecutorArgs({ sessionId, prompt, model = EXECUTOR_MODEL, resumeFrom = null }) {
  if (typeof prompt !== 'string' || prompt.length === 0) throw new RejectError('empty child prompt');
  const args = ['--model', model, '--permission-prompts', 'none', '--output-format', 'json'];
  if (resumeFrom) {
    args.push('--resume', resumeFrom);
  } else {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sessionId)) {
      throw new RejectError('sessionId must be a UUID', { sessionId });
    }
    args.push('--session-id', sessionId);
  }
  args.push('-p', prompt);
  return args;
}

export function childBaseCommand(pilot) {
  if (!pilot.testMode) {
    return { bin: 'claude', prefix: [] };
  }
  if (typeof pilot.childBin !== 'string' || pilot.childBin.length === 0) {
    throw new RejectError('test-mode pilot requires an explicit childBin');
  }
  return pilot.childBin.endsWith('.mjs')
    ? { bin: process.execPath, prefix: [pilot.childBin] }
    : { bin: pilot.childBin, prefix: [] };
}

// The bridge inherits the operator's existing GLM profile; it never searches
// for, reads or prints credentials. A missing profile blocks the launch.
export function assertProfileEnv(env, pilot) {
  if (pilot.testMode) return;
  const missing = ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'].filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new HoldError(`GLM profile env precondition missing: ${missing.join(', ')}; launch blocked, no credentials searched`, { missing });
  }
}

export function parseChildResult(stdout, expectedSessionId) {
  let parsed = null;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { trusted: false, reason: 'capture-not-json' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { trusted: false, reason: 'capture-not-object' };
  }
  if (parsed.session_id !== expectedSessionId) {
    return { trusted: false, reason: 'session-identity-mismatch', observed: parsed.session_id ?? null };
  }
  return {
    trusted: true,
    result: parsed.result ?? null,
    isError: parsed.is_error === true,
    model: typeof parsed.modelUsage === 'object' && parsed.modelUsage ? Object.keys(parsed.modelUsage) : [],
  };
}

// The advisor locator is read live at ring time; the seed is never stored,
// logged or recorded — records carry a redaction marker instead.
export function readAdvisorLocator(coordinationDir, { testMode }) {
  if (testMode) {
    return { seed: '<redacted:live-advisor-md>', pin: 'test-pin' };
  }
  const p = join(coordinationDir, 'ADVISOR.md');
  if (!existsSync(p)) {
    throw new HoldError('live ADVISOR.md not found in the coordination dir; seed guessing is forbidden', { p });
  }
  const text = readFileSync(p, 'utf8');
  const seed = text.match(/^seed_session_uuid: (\S+)/m)?.[1];
  const pin = text.match(/^model_pin: (\S+)/m)?.[1];
  if (!seed || !pin) {
    throw new HoldError('advisor locator incomplete (seed_session_uuid / model_pin missing); seed guessing is forbidden', { p });
  }
  return { seed, pin };
}

export function buildAdvisorArgs({ seed, modelPin, coordinationDir, askPath, candidatePath, question }) {
  return [
    '--ask-for-approval', 'never',
    'exec',
    '--sandbox', 'read-only',
    '--cd', coordinationDir,
    '--skip-git-repo-check',
    'fork', seed,
    '--model', modelPin,
    '-o', candidatePath,
    `advisor role: judge the bounded ask at ${askPath}; decide; output the decision. Do not modify any files — the adapter imports your captured output. Ask: ${question}`,
  ];
}

export function redactArgv(argv, secret) {
  if (!secret) return argv;
  return argv.map((a) => (a === secret ? '<redacted:live-advisor-md>' : a));
}

export function parseAdvisorCandidate(candidateText) {
  let parsed;
  try {
    parsed = JSON.parse(candidateText);
  } catch {
    return { trusted: false, reason: 'candidate-not-json' };
  }
  if (typeof parsed !== 'object' || parsed === null || typeof parsed.answer !== 'string' || parsed.answer.trim().length === 0) {
    return { trusted: false, reason: 'candidate-has-no-answer' };
  }
  return { trusted: true, answer: parsed.answer };
}

export function runChildToCompletion({ argv, cwd, env, deadlineMs, stdoutPath = null }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(argv[0], argv.slice(1), { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ pid: null, exitCode: null, signal: null, timedOut: false, spawnError: String(e), stdout: '', verifiedEnded: true });
      return;
    }
    const pid = child.pid;
    let timedOut = false;
    let stdout = '';
    let stderrTail = '';
    const killTimer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGTERM'); } catch { /* already gone */ }
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already gone */ }
      }, 5000).unref();
    }, deadlineMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => {
      stderrTail = (stderrTail + d).slice(-2000);
    });
    child.on('error', (e) => {
      clearTimeout(killTimer);
      resolve({ pid, exitCode: null, signal: null, timedOut: false, spawnError: String(e?.message ?? e), stdout, stderrTail, verifiedEnded: true });
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(killTimer);
      if (stdoutPath && stdout.length > 0) {
        try { writeFileSync(stdoutPath, stdout); } catch { /* best-effort capture */ }
      }
      let verifiedEnded = true;
      try {
        process.kill(pid, 0);
        verifiedEnded = false;
      } catch {
        verifiedEnded = true;
      }
      resolve({ pid, exitCode, signal, timedOut, stdout, stderrTail, verifiedEnded });
    });
  });
}
