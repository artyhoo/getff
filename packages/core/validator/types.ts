// Layer 4 Validator (Phase 7) — public types.
// 6 gates per architecture.md §2.6; Phase 7 v1 ships gates 1, 2, 4, 6
// as REQUIRED. Gate 3 (mutation) = SKIP (Path B only). Gate 5 (two-AI
// review) = DEFER (advisory; maps to AIF review-sidecar; cost-scope Phase 8).

export type GateStatus = 'pass' | 'fail' | 'skip' | 'n/a';

export interface GateFailure {
  ruleId?: string;
  reason: string;
  /** FF3xxx diagnostic code — one per failure kind per gate (D1 diagnostics-core,
   *  spec §3.4, plan Task 4, DECISIONS DN-D1-4). Additive field; GateOutcome /
   *  ValidationReport shape is otherwise unchanged (AC 3, zero behavior change). */
  code: string;
}

export interface GateOutcome {
  status: GateStatus;
  failures: GateFailure[];
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
