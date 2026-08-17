// Layer 4 Validator (Phase 7) — public types.
// 6 gates per architecture.md §2.6; Phase 7 v1 ships gates 1, 2, 4, 6
// as REQUIRED. Gate 3 (mutation) = SKIP (Path B only). Gate 5 (two-AI
// review) = DEFER (advisory; maps to AIF review-sidecar; cost-scope Phase 8).

// `degrade` (U10 option b, 2026-08-17): the gate ran but could not check part of the plan
// because the `rules-as-tests` plugin registry was unresolvable in this environment. Distinct
// from `pass` (nothing was skipped) and from `skip` (an upstream gate failed, so this one was
// never attempted). See preset-plugin-resolver.ts.
export type GateStatus = 'pass' | 'fail' | 'skip' | 'n/a' | 'degrade';

export interface GateFailure {
  ruleId?: string;
  reason: string;
  /** FF3xxx diagnostic code — one per failure kind per gate (D1 diagnostics-core,
   *  spec §3.4, plan Task 4, DECISIONS DN-D1-4). Additive field; GateOutcome /
   *  ValidationReport shape is otherwise unchanged (AC 3, zero behavior change). */
  code: string;
}

/** One check the gate could NOT run, and why. Never a defect in the plan — always environmental. */
export interface GateDegrade {
  ruleId?: string;
  /** FF3xxx diagnostic code — FF3022 for an unresolvable plugin registry. */
  code: string;
  reason: string;
}

export interface GateOutcome {
  status: GateStatus;
  failures: GateFailure[];
  /** Present (non-empty) only when the gate skipped checks it could not run — status `degrade`,
   *  or `fail` when it also found real defects. Omitted entirely when nothing was skipped. */
  degraded?: GateDegrade[];
}

export interface ValidationReport {
  ok: boolean;
  gates: {
    schema: GateOutcome;
    ruleTester: GateOutcome;
    tautology: GateOutcome;
    conflict: GateOutcome;
    singleTokenDiff: GateOutcome;
    messageIdCoverage: GateOutcome;
    autofixClean: GateOutcome;
    requireVacuity: GateOutcome;
  };
  /** Count of rules emitted as check.type:'manual' (L4 cannot roundtrip them — surfaced, not failed). */
  manualCount: number;
  /** ids of the manual-checked rules — makes the silent manual-bypass visible without changing `ok`. */
  manualRuleIds: string[];
}
