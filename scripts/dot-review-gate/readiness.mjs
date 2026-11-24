// Mechanical readiness evaluator — the WAITING_MECHANICAL → ELIGIBLE transition.
//
// Spec §5: mechanical readiness excludes every dot-review/* context; every trusted
// mandatory context needs a CURRENT successful attempt on the exact SHA it is bound to
// (head-bound contexts on H, merge-bound on M); missing, pending, red, cancelled or
// skipped/neutral attempts are not readiness, and only the LATEST attempt per context
// counts (a rerun that goes red after an earlier green blocks).
//
// Review R9: "latest" is resolved per RUN — the run with the newest identity (started
// time, then run id) wins, and within it the highest run_attempt. A bare attempt
// counter across unrelated runs let an OLDER green run mask a NEWER red one. Each
// context also requires the run's workflow identity to match the policy's trusted
// workflow_path (and workflow_sha, when the policy pins it): the expected Actions App
// id alone is not trust — any workflow in that repo can publish under the same App.
// Evidence comes from the caller's authoritative GitHub read — this module never
// invents or caches it.

import { isDotContext, mandatoryMechanical } from './load-policy.mjs';

export function evaluateReadiness(policy, actual) {
  const blocking = [];
  const { head_sha, tested_merge_sha, mergeability, merge_ref_present } = actual ?? {};
  const checks = Array.isArray(actual?.checks) ? actual.checks : [];

  if (merge_ref_present !== true) {
    blocking.push({ code: 'MERGE_REF', message: 'tested merge revision refs/pull/N/merge is absent' });
  }
  if (mergeability !== 'clean') {
    blocking.push({ code: 'MERGEABILITY', message: `mergeability is "${mergeability}", not clean` });
  }

  // dot contexts are never mechanical evidence and never block readiness
  const mechanical = checks.filter((c) => c && !isDotContext(c.context));
  const byContext = new Map();
  for (const c of mechanical) {
    const list = byContext.get(c.context) ?? [];
    list.push(c);
    byContext.set(c.context, list);
  }
  // R9: the current execution per context — newest run (started_at, then id),
  // then its highest rerun attempt.
  const current = new Map();
  for (const [context, list] of byContext) {
    const byRun = new Map();
    for (const c of list) byRun.set(c.run_id, [...(byRun.get(c.run_id) ?? []), c]);
    const runs = [...byRun.entries()].map(([runId, runChecks]) => ({
      runId,
      started: Date.parse(runChecks[0].run_started_at ?? '') || 0,
      checks: runChecks,
    }));
    runs.sort((a, b) => (b.started - a.started) || (Number(b.runId) - Number(a.runId)));
    const win = runs[0].checks.slice().sort((a, b) => (b.run_attempt ?? 0) - (a.run_attempt ?? 0))[0];
    current.set(context, win);
  }

  for (const ctx of mandatoryMechanical(policy)) {
    const found = current.get(ctx.context);
    if (!found) {
      blocking.push({ code: 'MISSING', context: ctx.context, message: `required context "${ctx.context}" has no attempt` });
      continue;
    }
    if (found.app_id !== ctx.expected_app_id) {
      blocking.push({ code: 'APP', context: ctx.context, message: `"${ctx.context}" published by app ${found.app_id}, expected ${ctx.expected_app_id}` });
      continue;
    }
    if (found.workflow_path !== ctx.workflow_path) {
      blocking.push({ code: 'WORKFLOW', context: ctx.context, message: `"${ctx.context}" ran from "${found.workflow_path ?? 'unknown'}", policy trusts "${ctx.workflow_path}"` });
      continue;
    }
    if (ctx.workflow_sha !== undefined && found.workflow_sha !== ctx.workflow_sha) {
      blocking.push({ code: 'WORKFLOW', context: ctx.context, message: `"${ctx.context}" ran workflow version ${String(found.workflow_sha ?? 'unknown').slice(0, 7)}, policy pins ${String(ctx.workflow_sha).slice(0, 7)}` });
      continue;
    }
    const boundSha = ctx.bound_to === 'merge' ? tested_merge_sha : head_sha;
    if (found.sha !== boundSha) {
      blocking.push({ code: 'BOUND_SHA', context: ctx.context, message: `"${ctx.context}" evidence on ${found.sha?.slice(0, 7)}, bound to ${ctx.bound_to} ${boundSha?.slice(0, 7)}` });
      continue;
    }
    if (found.conclusion !== 'success') {
      blocking.push({ code: 'LATEST_ATTEMPT', context: ctx.context, message: `"${ctx.context}" latest attempt (run ${found.run_id}#${found.run_attempt}) concluded "${found.conclusion}"` });
    }
  }

  const ready = blocking.length === 0;
  return { ready, blocking, at: { head_sha, tested_merge_sha } };
}
