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

// Runtime evidence check: the requested model pin (route evidence, recorded in
// the attempt argv) stays separate from the client-reported model identity
// (modelUsage keys). A missing or mismatched reported model is an unproven
// capture and blocks advancement — even with a matching session id and exit 0.
export function parseChildResult(stdout, expectedSessionId, expectedModel = EXECUTOR_MODEL) {
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
  const model = typeof parsed.modelUsage === 'object' && parsed.modelUsage ? Object.keys(parsed.modelUsage) : [];
  if (model.length === 0) {
    return { trusted: false, reason: 'model-evidence-missing', observed: [], expected: expectedModel };
  }
  if (!model.includes(expectedModel)) {
    return { trusted: false, reason: 'model-mismatch', observed: model, expected: expectedModel };
  }
  return {
    trusted: true,
    result: parsed.result ?? null,
    isError: parsed.is_error === true,
    model,
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

// Structured output schema for the advisor fork: the capture must carry the
// advisor role, the exact ask id and the exact bound input digest.
export function advisorOutputSchema({ askId, inputDigest }) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['role', 'askId', 'inputDigest', 'answer'],
    properties: {
      role: { type: 'string', const: 'advisor' },
      askId: { type: 'string', const: askId },
      inputDigest: { type: 'string', const: inputDigest },
      answer: { type: 'string' },
    },
  };
}

export function buildAdvisorArgs({ seed, modelPin, coordinationDir, askPath, candidatePath, schemaPath, askId, inputDigest, question }) {
  return [
    '--ask-for-approval', 'never',
    'exec',
    '--sandbox', 'read-only',
    '--cd', coordinationDir,
    '--skip-git-repo-check',
    'fork', seed,
    '--model', modelPin,
    '--output-schema', schemaPath,
    '-o', candidatePath,
    `advisor role: judge the bounded ask at ${askPath}. Respond ONLY with JSON {"role":"advisor","askId":"${askId}","inputDigest":"${inputDigest}","answer":"<decision>"} matching the output schema. Do not modify any files — the adapter imports your captured output. Ask: ${question}`,
  ];
}

export function redactArgv(argv, secret) {
  if (!secret) return argv;
  return argv.map((a) => (a === secret ? '<redacted:live-advisor-md>' : a));
}

export function runChildToCompletion({ argv, cwd, env, deadlineMs, stdoutPath = null, onSpawn = null }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(argv[0], argv.slice(1), { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ pid: null, exitCode: null, signal: null, timedOut: false, spawnError: String(e), stdout: '', verifiedEnded: true });
      return;
    }
    const pid = child.pid;
    // Persist the live process identity as soon as it exists, so OFF
    // termination and reconciliation can bind to the exact running process.
    if (typeof onSpawn === 'function') {
      try {
        onSpawn(pid);
      } catch { /* best-effort persistence */ }
    }
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
