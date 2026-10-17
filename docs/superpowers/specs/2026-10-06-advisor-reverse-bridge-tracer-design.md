# Advisor reverse bridge — local tracer design

> **Status:** design for operator review; not implemented or dispatched.
> **Authoritative for:** the proposed first local assignment/consult/report/rework tracer.
> **NOT authoritative for:** advisor decision rights, project policy, merge authority, DOT admission, consumer installation or verified runtime delivery.

## 1. Outcome and scope

The senior Codex session assigns prepared work to Claude Code (CC), receives evidence and decides acceptance or concrete rework. CC can consult the Codex advisor while executing. Prove this entire cycle in this repository before packaging it for other projects.

The operator approved this sequencing on 2026-10-06. It supersedes the wider draft's first-beta consumer-install and two-consumer acceptance scope. Preserve project parameters as explicit inputs; defer installer changes, profile mapping, Git-common-directory state placement, cross-project tests, `/arch` migration, AIF, harvest, PR admission and merging. This tracer does not define a new development methodology or scheduler.

Success requires one actual CC assignment, one explicit consult checkpoint and applied answer, one report, an identified senior-directed rework exercise, a fresh same-owner report and acceptance. Codex publishes and launches the prepared assignment; CC invokes the advisor and returns evidence; Codex delivers rework. The operator does not copy prompts, asks, answers or reports between chats. A scripted all-green simulation is insufficient. The first iteration runs while the senior is active; unattended senior wake is not a success claim.

The operator's CC executor currently uses **GLM**. Preserve that existing model/provider profile and record the actual effective executor model in the evidence. Claude Code names the harness here, not the model. Give the junior explicit criteria and checkpoints; do not assume its confidence, self-check or JSON formatting proves correctness. Advisor model selection still follows the enrolled Codex locator.

## 2. Evidence and reuse before mechanisms (T11/T20)

- [SSOT](../../meta-factory/prior-art-evaluations.md): #201 adapts the executor/advisor strategy; #306 supplies the standalone worker REPORT; #110 covers shared coordination; #258's paused claim only protects AIF intent; #295's hook dedup is a different problem. Do not repurpose either claim/dedup implementation as a universal task lock.
- [Forward transport](2026-10-06-advisor-codex-transport.md) already owns the locator, fork ring, journal-before-answer and file-pull conventions. Extend their binding/receipt surface rather than redefining advisor rights. Its current recipe and reported live validation are narrower than this tracer.
- [Chip-worker template](../../../.claude/skills/orchestrator/references/chip-worker-template.md) owns standalone execution/reporting. Retain DONE/PARTIAL/BLOCKED and ATTN; the senior acceptance record is an additional contract. Its merge step does not apply to this pilot.
- Live help on this host, 2026-10-06: Codex 0.160.0 advertises `exec fork`, `--output-schema`, `--output-last-message`, `--cd`, and `queue`. CC 2.1.286 advertises `-p`, JSON output, explicit session ID/resume and `--permission-prompts none`. `--bg --resume` may start a copy of an active session. Syntax is not delivery proof.
- Fresh Context7 consulted `/anthropics/claude-code` with three functional queries: exact-ID headless resume; structured reports and project permissions; native messaging/idle wake. Its cache-age/idle suggestions do not prove process cessation.
- Primary [CC headless documentation](https://code.claude.com/docs/en/headless) confirms normal `-p` project context, JSON results, and that bare mode excludes subscription login; [agent view](https://code.claude.com/docs/en/agent-view) is a native background alternative, not the chosen tracer route. The CLI is sufficient for the new-turn primitive; cross-harness receipts remain local glue, not an upstream absence claim.
- [Node filesystem primitives](https://nodejs.org/docs/latest-v22.x/api/fs.html) supply exclusive creation and atomic publication primitives on the local filesystem. Use those directly, no lock library. Test crash boundaries; neither a check-then-write nor a content-hash TTL is ownership.

No worker, wake, permission or end-to-end probe has been run in this design session. Node here is v24.3.0; the implementation should use built-ins already available locally and add no dependencies.

## 3. Actors and one local mailbox

Bind a pilot configuration to the observed physical Git common directory, the exact senior acceptance-session ID, the live advisor locator, one execution worktree, and an explicitly named mailbox under `.claude/advisor-bridge-beta/` in the senior's anchor worktree. The anchor persists for the pilot. It is a temporary location, not a consumer install contract; no home-global store or automatic linkage is added. Permission-denied or disappearing roots yield HOLD, not a new queue.

The current senior acceptance session is `01a11094-b236-7553-841d-1c5c998e2393`. The advisor seed comes from the live `ADVISOR.md`, never from this spec, `--last` or the latest session. These are different actors: a consultation fork does not accept the task on behalf of the continuing senior.

The prepared request names scope, artifact output paths, checks, evidence criteria, consult checkpoints and allowed effects. The pilot worker may read project/CLI facts and write only its designated capability card and mailbox submissions. It cannot modify repository code, create commits/PRs, dispatch AIF, merge, publish or change configuration. The bridge implementation task is separate from the small task exercised through it.

The senior publishes requests/decisions; a deterministic adapter owns canonical receipts, state and process handles; CC writes submissions and the work artifact. Every canonical artifact includes `schemaVersion: 1`, `pilotId`, stable `workKey`, `requestRevision`, `requestDigest`, unique `eventId`, `causationId` and actor/owner identifiers. Revision changes preserve `workKey` and owner. Acceptance/consult records bind the exact report/ask ID and content digest, not just its filename.

Keep immutable request, ask, report and decision revisions, an append-only event history and a derived status view. Publish completed artifacts via same-filesystem temporary writes and atomic publication. Reject conflicting reuse of an event ID, traversal, symlink escapes, foreign repository binding, unknown actor and stale revision. An identical replay returns the existing receipt.

## 4. Ownership, launch and crash rules

One pilot and one work item are active. Acquire ownership by exclusive local creation before any launch reservation or review/launch window. A duplicate caller observes the existing owner; it does not launch another process. Serialize state mutations and admission/OFF through a short exclusive operation lock; an abandoned/incomplete lock yields HOLD for reconciliation. Preserve the long-lived work owner through report, rework and acceptance. No lease expiry or timeout steals it.

Reserve an immutable launch attempt before starting CC; record the exact session, worktree, process identity and attempt. If a crash occurs after reservation but before a trustworthy process/result receipt, the attempt becomes UNKNOWN. No automatic second launch, including after a PID lookup alone. Reconcile the owned process/transcript, effects and submissions; insufficient proof remains HOLD.

The adapter launches ordinary `claude -p` from the isolated executor worktree with explicit session identity, JSON output, the operator's existing GLM model/provider routing, inherited project discipline and `--permission-prompts none`. It does not broaden existing permissions or change authentication/provider configuration. Verify the actual model from runtime evidence; an unavailable or mismatched profile blocks launch/advancement, not an automatic switch. Capture the validated returned session ID and resume only that ID after the prior process is proven ended. No `--bg`, `--continue`, `--fork-session`, `--bare`, safe mode, permission bypass or new paid API fallback. A denial produces BLOCKED with a narrow evidence record.

Use subprocess APIs with argument arrays and explicit cwd; do not interpolate payloads into shell command strings. An opaque recorded ownership token is not a security credential. Same-user shell actors remain capable of bypassing a cooperative bridge; this tracer does not certify hostile-worker confinement.

The [existing in-flight probes](../../../CLAUDE.md) still apply when authorizing a repository stage or outward effect. They complement atomic pilot ownership and do not replace it. A future `/pipeline`/AIF dispatch also requires its tracked kickoff on staging per [placement policy](../../../.claude/rules/kickoff-staging-placement.md); a private task packet does not satisfy that condition.

## 5. Consultation and result delivery

At the pilot's explicit consult checkpoint, CC publishes one bounded ask plus its current evidence and waits for the decision on that item. The adapter reserves one fork for that ask. Reuse the forward fork-as-ring strategy with explicit cwd and live locator/model pin. Re-read the request and ask in the fork; inherited history is background.

For this tracer, select a **read-only advisor fork with a captured structured output**, then deterministic import. The launcher captures the final candidate into its reserved outbox via `--output-schema`/`--output-last-message`; the advisor model never edits repository code or needs write access to the canonical mailbox. Validate identifiers, exact input digest and role; write the decision-journal event first, then import the same decision into the ask's `## Answer`, then issue an import receipt. This is a proposed tracer adaptation, not a claim that the shipped forward recipe already implements it. CLI exit or raw stdout alone never completes the ask. A malformed, missing or denied capture keeps it OPEN/HOLD.

CC re-reads the imported decision and records application ACK with its decision ID and what changed. An escalation stops dependent work; unrelated authorized read-only work may continue. Changed input invalidates an earlier decision. Crash after journal but before Answer completes the idempotent import, not a second fork.

CC submits REPORT with DONE/PARTIAL/BLOCKED, ATTN, the request/revision and owner, artifact hashes, consulted decision/application ACK, criteria mapped to evidence, exact commands/cwd/environment/exit status, limitations and deviations. The adapter validates delivery and binds the immutable report; it does not judge its substantive quality.

The active senior waits on the owned subprocess using ordinary bounded tool waits, then pulls the known report and actual artifacts. Subprocess completion only indicates it is time to inspect. Missing/partial/stale evidence never becomes DONE by inference. Codex records `ACCEPTED`, `REWORK` with specific criteria/evidence needed, or `OPERATOR_REQUIRED`. Read artifacts and code when relevant; evidence collection and repairs remain CC's job. This acceptance is not an independent cold review or DOT admission.

REWORK retains the same CC owner, resumes only after cessation proof, and binds a new instruction revision/report. A delayed acceptance for the old report cannot close the new revision. Acceptance alone creates no permission to merge or proceed to another stage.

## 6. Wake and degradation

Selected channel: a bounded CC CLI turn started by the active senior through the adapter. It starts execution; it does not wake an existing desktop CC session. Return channel: durable report plus the active senior's subprocess wait/file pull. No daemon, monitor, LLM polling or `codex queue` dependency is introduced.

If the senior is idle or interrupted, the report remains pending until that session is explicitly continued. No rework or stage advancement occurs meanwhile. Therefore the first tracer can prove an **attended complete loop**, not autonomous wake. Direct `codex queue` delivery and native CC-background lifecycle remain later, separately measured alternatives. Human starting/continuing a seat is allowed; hand-copying payloads or decisions is recorded as assisted transport, not successful delivery.

## 7. OFF, limits and operator floor

Default disabled. Explicit pilot enrollment allows one work item, one CC process at a time, at most three CC passes (initial plus two reworks), at most two advisor calls, no automatic retry, 20 minutes per process and a 60-minute pilot admission window. Counters persist across crashes. Expiry or limit breach yields HOLD. These are conservative pilot defaults, not account-wide budget claims.

OFF and launch admission share serialization: after OFF commits, no new controlled launch, consultation ring, resume or dependent transition is admitted. Reads, incoming evidence and journal/import recovery remain available. OFF also requests termination of an exactly identified owned process; verify cessation, preserve the owner and mark an interrupted pass HOLD. Do not kill arbitrary sessions or equate an exit request with successful cancellation. Report any running process that cannot be stopped/proven stopped.

No file can enable the pilot or override permissions. Operator-floor matters remain main merges, npm publish, substantive scope/goal forks, secrets/passwords, money and configuration/security changes. No bypass of hooks, review or merge locks, policy edits, arbitrary discovered-file execution or newly invented fallback routes. Native project gates remain authoritative.

## 8. Live acceptance and interim deployment

Pilot work product: a capability card for this host, recording measured CLI syntax and distinguishing supported syntax, verified execution and unverified wake/delivery. The consult checkpoint asks the advisor to judge the collected evidence for the chosen route. It is an explicitly scheduled transport exercise, not a claim that CC encountered a novel strategic fork.

The senior then issues one explicitly labeled **rework exercise** requiring a second dated verification and an updated evidence comparison in the same card. Do not conceal criteria from the first request, deliberately introduce a bug, or report the exercise as a discovered quality failure. The second report binds the new revision and fresh evidence. Further rework is allowed only for actual unmet criteria, within the cap.

Required proofs: real three-flow loop; concurrent duplicate callers produce one launch; lost ACK does not relaunch; crash at reservation/spawn/import boundaries holds or replays safely; stale report/decision is rejected; OFF blocks a subsequent controlled pass; exit 0 with absent/invalid report does not pass. Deterministic fake child processes can test failure cases, but cannot substitute for the live CC/advisor cycle. No LLM calls belong in CI.

Open validation points: actual writable outbox/import paths; effective GLM profile and existing permission route; read-only fork output capture on this host; same-session CC resume and reliable cessation evidence. The existing GLM provider's authentication/cost is not inferred from CC subscription documentation. Stop at the first unresolved point with artifacts and a concrete advisor ask, not a larger redesign.

Deployment interim: design-only today. CC implements/reviews the bounded adapter in its own checkout and reports readiness before the pilot is enabled. Run the first pilot while the senior is active; retain receipts and limitations. Packaging, additional projects and unattended return wake are follow-on work after this evidence exists.
