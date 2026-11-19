# OpenMausBot binding probe

> **Date:** 2026-10-26.
> **Authoritative for:** this bounded source recheck supporting the portable verified autonomy architecture discussion.
> **NOT authoritative for:** product scope, final architecture, a cold design-review verdict, live host acceptance, configuration changes or implementation approval.

## Result

The captured unmodified host provides a concrete native owner/child/result/resume route. It can run the existing getff workflow without replacing that workflow. However, the captures do **not** establish either (1) a supported reviewer input allowlist that excludes all unwanted host memory/context or (2) a mandatory getff acceptance veto with durable recovery after a prematurely successful owner turn. These two requirements remain a **bounded feasibility hold** before promising an unattended accepted-result slice.

Native completion can be held while actual awaited children remain or their results have not been consumed. It is not held merely because a getff acceptance receipt is absent. Treating host completion as advisory prevents false product acceptance, but by itself does not guarantee further progress. Sources: runtime:478–494; coordinator:488–497; index:5798,14764–14780.

This is narrower than saying independent review or acceptance integration is impossible. A controlled deployment or a verified project-hook route could resolve the hold; neither was exercised here. The falsifier is an unmodified-host demonstration showing the actual reviewer packet and a premature-success case that automatically resumes the accountable owner until the current candidate passes getff acceptance, while pause/cancel still win.

## Source boundary and pins

Accepted entry points: [distillate](../../../research/portable-verified-autonomy/2026-10-26/distillate.md), V3/V4 and PA1–PA4; [host comparison](../../../research/portable-verified-autonomy/2026-10-26/host-comparison.md), H1–H3. Their own reuse references remain the accepted research's IDs 64, 105, 253, 258, 307, 308 and 315; this probe adds no capability or new adoption verdict.

OpenMausBot source revision recorded by those reports: `3ac9fb1122a34b2755580d3d5d7cbd1a1a77bd4b`. This is a source pin, not evidence of the installed/running version. All line references below refer to the complete local captured files, with original upstream line numbering preserved:

| Alias | Captured source | SHA256 |
| --- | --- | --- |
| index | [server/index.ts](../../../research/portable-verified-autonomy/2026-10-26/evidence/openmausbot--server__index.ts) | `6e63192ac5b00d156047940bc88e0bb119e779459e13746eb38d3c6f5dc49eff` |
| coordinator | [server/runtime-coordinator.ts](../../../research/portable-verified-autonomy/2026-10-26/evidence/openmausbot--server__runtime-coordinator.ts) | `599f0b6cc36a089f7240a1eaf1e74508057cdb1c15163cd0c55978a3c42a99fb` |
| runtime | [server/runtime/runtime.ts](../../../research/portable-verified-autonomy/2026-10-26/evidence/openmausbot--server__runtime__runtime.ts) | `811933ac52bc70bb603b4eb9fa6f8c886d463b1de3b188e7fe75079238895fa9` |
| types | [server/runtime/types.ts](../../../research/portable-verified-autonomy/2026-10-26/evidence/openmausbot--server__runtime__types.ts) | `8ab53f1d84bc47c144285b8dd1b9f7fa1fa1e21e0d055dd80afe46987d004452` |
| claude | [server/drivers/claude.ts](../../../research/portable-verified-autonomy/2026-10-26/evidence/openmausbot--server__drivers__claude.ts) | `17b56a11dee4e7a37028e272ed7ebce2b3c6f70cc71bf535fe62de7733039492` |
| codex | [server/drivers/codex.ts](../../../research/portable-verified-autonomy/2026-10-26/evidence/openmausbot--server__drivers__codex.ts) | `b430fa6da9c94979652b709c942b05a70e821b38e057ef03e40990963c4478fb` |
| external | [docs/verification/external-runtime.md](../../../research/portable-verified-autonomy/2026-10-26/evidence/openmausbot--docs__verification__external-runtime.md) | `da265b6fbb461b862f5844bf5d3f8b82309056c5f61ed3a80ba6e07e56c8610b` |

Entry-point hashes: distillate `81668cee546f1be2e1a47bc4dd4a3a77bedf4263f8e520b0ae80d917b3f86af7`; host comparison `af16a149dc40871dbdb0795da7f932f137f1c5e49a836d8da5a5285fac98e51e`.

## Existing native interfaces and lifecycle

| Obligation | Existing source seam | Boundary / limitation |
| --- | --- | --- |
| Accountable owner | `coordinator.beginTurn` creates a root from the host turn generation, requester and bot/thread address (coordinator:267–285); runtime persists a running root with root ID, origin, requester, assignee and budgets (runtime:124–140). | These are internal implementation methods, not a demonstrated public plugin API. Let the application create/manage its native owner turn. Arbitrary adoption of an already-open foreign session is not established. |
| Submit child | Native agents surface `coordinate_bots`; HTTP handler `POST /api/internal/coordinate-bots` accepts 1–4 distinct bot IDs, message ≤4000 chars, `rework`, `thread: standing|new`, `reply: resume|none`, `consult`, `inMyFolder`, `done_when` ≤1000 chars (index:14764–14780). | Requires the current internal capability and existing reachable bot. Host permission checks remain before submission (index:14594–14616). A new external caller cannot simply treat an internal route as an unauthenticated API. |
| Fresh work thread | `thread: new` sets fresh; work otherwise reuses `store.workThread` where present. Host creates task, records target thread and applies delegated permissions (index:14578,14632–14649). | Fresh thread removes that thread's prior transcript; it does not filter host memory. Files are not transferred; route explicitly requires accessible paths or content (index:14798). |
| Return identity | Receipts contain `requestId: node.id` and ordinarily target `threadId` (index:14670–14683); coordinator deduplicates matching sibling work and requires `rework:true` after completed work (coordinator:192–219). | A receipt means queued/already sent; it is not candidate acceptance. Bind native IDs to existing getff task/candidate identities instead of identifying work by title. |
| Owner wait/resume | Native reply is resume; sender is told to end its turn without polling (index:14625–14627,14707–14712). Outstanding or unseen awaited children hold the assignment in waiting (runtime:478–490). Report writes reported state and inbox wake (runtime:634–670). Tick marks due parents resume and dispatches (runtime:284–320). | Resume requires the application to be running/ticking. Index:9915–9935 supplies a 250 ms host timer; source does not prove operating-system restart or permanent availability. |
| Resume payload | Runtime assembles all terminal awaited children and new questions, persists delivered inbox IDs with dispatch (runtime:350–395); coordinator composes resumed reports/questions and revalidates readability (coordinator:472–490,512–517). | Reports are application content, not independently validated product verdicts. Runtime result text is clipped at 12000 chars (runtime:37–39,478); larger evidence should remain in pinned artifacts. |
| Read result | `GET /api/internal/assignment-status` returns assignment status/outcome/result/question, children and inbox; restricts to caller's root tree and current peer access (index:14715–14759). | Same-turn polling of newly delegated work is refused (:14733–14735). HTTP `wait_ms` is bounded to 240000 (:14736); native owner should use automatic return. |
| Rework | `rework:true` admits concrete new work for an already terminal child; without it repeated completed assignment is refused (coordinator:192–195; index:14664–14666). | A new child assignment is part of the existing owner's workflow. No source here automatically interprets getff review findings or generates rework. |
| Stop/cancel | Runtime cancels a subtree and aborts its turns; stopping requester cancels unstarted children, leaves already-running teammates able to report, and prevents resuming stopped conversation (runtime:524–549). | Preserve this precedence; acceptance retry must not resurrect cancelled owner work. |
| Restart | Deepest-first reconciliation reparks needs_input; interrupted delegated parents wait; recorded outward effects fail rather than rerun; otherwise at most one rerun, with cut-twice failure (runtime:77–120). | Outward detection is an optional host callback, not exactly-once execution (runtime:699–703; types:298–300). This source probe did not test any crash cut. |

The external runtime is a different contract. It has a standing capability tied to a thread and only list/delegate/status routes (external:12–22). Its root and children use `reply:poll`; root completes without a new owner turn once children settle, and nothing wakes the external engine (external:24–33; runtime:290–295). Using that interface as a bridge would not establish native accountable-owner recovery.

## Engine execution is real, but cold review is unproved

The captured Claude driver uses bidirectional stream JSON, retained processes, `--resume` or new session ID (claude:1044–1054,1233–1248,1348–1349). Codex uses app-server `thread/resume`, `thread/start`, and `turn/start`, carrying developer instructions, model, cwd and permissions (codex:1525–1557,1589–1643). Index sends both application system-prompt halves, transcript, resume cursor/reset flag and cwd (index:8831–8842). This supports the host's actual heterogeneous execution route, not a live subscription/cost or CLI compatibility claim.

For a direct native task, these inputs are assembled independently of a fresh-thread request:

- Section context and team memory: index:8786–8787.
- Recent work from host task/room sources: index:1241–1245,8790.
- Bot memory plus shared notes: index:8791. `memoryEnabled:false` is passed into `memorySystemPrompt`, but the shared-notes append is outside that condition.
- Auto recall on the user-message side: index:8801–8806. `memoryEnabled:false` disables this path (index:1254–1255), and delegated turns do not retrieve other conversation threads through its `conversations` branch. That restriction does not erase the independently assembled team/recent/shared inputs.
- Native/project sources: Claude's isolated mode uses project settings and can add user skills (claude:1070–1078), project MCP (claude:1152–1164), excludes a specific personal CLAUDE.md (claude:1203–1206), and appends the application prompt (claude:1282–1286). Codex combines effective configuration and application stable instructions and may add volatile context to the turn (codex:1525–1528,1613–1626). These native instruction/tool surfaces must be included in any allowed-input contract.

The captured coordinate-bots schema has no review-context allowlist or per-assignment memory exclusions (index:14764–14780). Therefore `thread:new` plus memory off is not demonstrated to satisfy cold review. This is a counterexample to a proposed shortcut, not an exhaustive claim that the application has no other isolation mode.

An adjacent confinement path filters prompt parts and integrations (`proactive.fence.confines`, `READ_AND_DRAFT_PARTS`, `READ_AND_DRAFT_TOOLS`, index:8754,8799), but the definitions and route into that mode were not part of the cited capture set. It cannot be advertised here as a supported cold-review API. Likewise driver-internal text-generation helpers are not evidence of a user-accessible artifact reviewer.

**Minimum reviewer proof:** capture the actual stable prompt, volatile prompt, initial message, native configuration/instruction sources, tool grants and all review-time retrieval; bind these to the exact candidate and allowed inputs. Place a prohibited implementation-rationale decoy in host memory/recent work and demonstrate exclusion, not merely an instruction to ignore it. A separately controlled reviewer could supply the verdict artifact, but its automated native-owner handoff and isolation would need their own proof. No new reviewer service is selected by this note.

## Completion veto and premature-success recovery

The native runtime has a real structural hold for awaited work. After that hold clears, it maps successful root end to `completed` (runtime:152–158,478–494); the coordinator maps a successful ordinary host turn to `kind:completed` (coordinator:488–497). `doneWhen` is a requester's stored string (types:91–94; coordinator:208–209), not a checked acceptance predicate in these completion branches. A reviewer child can keep its owner waiting while running, and its result can resume the owner, but a negative verdict does not itself block the owner's next successful completion.

Specific hook and retry counterchecks:

| Candidate seam | Observed behavior | Integration conclusion |
| --- | --- | --- |
| Host Claude Stop hook | Driver registers Stop alongside PostToolUse, failures, compaction and SessionStart (claude:423–432); injects hooks into its private settings (claude:1191–1206). Host mounts only when adapter advertises hooks and hooks are enabled (index:8657–8659; hooks flag at :1958). Host handler explicitly returns `{ok:true}` for Stop (index:5798). | An actual event path exists. This captured implementation does not consult getff, block stopping, or schedule acceptance rework. Extending that handler would modify the host, not configure an existing acceptance plugin. |
| Host tool-result hook | PostToolUse stores redacted/spilled tool output once and returns OK (index:5800–5816). Internal tool-result routes save/read bounded text (index:13899–13914). | Evidence capture, not an acceptance veto or continuation obligation. |
| Native project Claude hooks | Isolated launch sets `--setting-sources project` (claude:1074–1078); separately supplies host hook settings (:1203–1210). | A plausible bounded experiment for existing getff project hooks. The captures do not prove settings merge precedence, actual getff hook firing, a fail-closed Stop veto, or durable recovery across host restart. Do not promote it to an implemented portable gate. |
| Codex equivalent | Captured adapter capabilities include agents/custom MCP and strict resume but omit hooks (codex:1798–1816). Host hook mount requires `hooks===true` (index:8657–8659). | No demonstrated equivalent of this host hook path for Codex. This does not assert that every Codex native hook mechanism is absent. |
| Retry finished thread | Retry requires an active Chief caller (index:14800–14816); rejects a successful run newer than the incident report (:14819–14822); explicitly states result stays in target thread and caller is not woken (:14824–14838). | Not an automatic durable repair of premature successful owner completion. |
| Internal runtime ports | `TurnRunner.validate/run/report` and `EndResult.continue` exist (types:247–257,280–300). Current coordinator wires them to host methods (coordinator:450–468). | Internal extension points are not exposed consumer APIs. Calling them an available getff middleware/plugin would be speculative. |

**Progress limitation:** terminal completed owners are outside the runtime's nonterminal restart reconciliation (runtime:83–87), and ordinary resume reasons depend on awaited children (runtime:684–692). The inspected path supplies no automatic acceptance-driven revival of a successfully completed owner with no awaited work. It is insufficient to say “the product stays unaccepted” without also supplying and verifying the continuation mechanism.

## Smallest concrete integration boundary to test

This is a proposed binding of existing interfaces, not a new workflow or a claim of existing getff integration:

1. Keep the existing getff intent/spec/task, candidate, review/rework and delivery artifacts authoritative. Start the accountable owner as an application-native turn in the project environment. Host owns native sessions and assignments.
2. Owner sends existing bounded task material through native `coordinate_bots`, using immutable artifact references where message limits require it, and records root/assignment/thread identities against the getff task. Return uses native resume; no external polling bridge is substituted.
3. Owner routes current candidate to a reviewer whose actual permitted inputs have been proved, consumes its candidate-bound verdict, requests concrete `rework:true` when required, and repeats existing getff checks before authorized delivery.
4. Product acceptance remains a separate getff evidence fact. Before calling this unattended completion, establish a supported fail-closed closure/continuation mechanism. The captured host's Stop path and `done_when` do not supply it.

The next bounded feasibility experiment should answer only the two blocking questions: cold reviewer input exclusion, and premature-success rejection/recovery. It must include wrong/stale candidate, negative verdict, owner successful early finish, owner process cut, and deliberate pause/cancel. If project Claude hooks can enforce the latter without altering the host, verify their actual firing and restart behavior first; verify the Codex path separately. If these seams fail, return the precise incompatibility to architecture rather than adding a general scheduler, undocumented API or replacement workflow.

## Bounded read record and verification

Read accepted distillate and host comparison in full. Enumerated only `evidence/openmausbot--*` names to resolve cited captures. Content searches and bounded line reads were limited to the seven captured files in the pin table: owner/assignment/status/rework paths; lifecycle/end/restart/wake paths; direct prompt construction and memory switches; real engine start/resume/prompt wiring; host hook and retry paths. Entry-point and seven source hashes were computed locally. Standard repository bootstrap/governance files were read to obey session instructions; they were not used as new upstream capability evidence.

No network browsing, package installation, application launch, settings changes, private runtime-state/memory read, or live model call was performed. Imported implementation files outside these seven captures were not opened. The upstream verification document describes tests; this probe did not rerun them or promote them to current runtime acceptance. Only this report was written.

Forward-check: preserves getff acceptance, no-extra-payment uncertainty, cancellation precedence and existing workflow; unsupported platform capabilities remain explicit holds. Backward-check: corroborates distillate V3/V4 and H2 while sharpening the distinction between awaited-child hold, product acceptance safety and guaranteed progress. It makes no global negative-existence claim and requires no wider source survey.
