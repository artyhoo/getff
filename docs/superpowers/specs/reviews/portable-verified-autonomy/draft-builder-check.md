# Portable verified autonomy — working-draft builder check

> **Date:** 2026-10-26.
> **Authoritative for:** bounded, artifact-only implementation-planning questions about the exact draft below.
> **NOT authoritative for:** final architecture approval, host fitness, implementation permission or runtime acceptance.

## Inputs and method

Read the five supplied artifacts. No chat inspection, new research, source-code capability investigation, runtime launch or implementation was performed. Standard repository governance and applicable skill instructions were also read. Only this report was written. Findings distinguish a discussion-stage proposal from a final buildable specification; declared qualification work is not relabeled as an undisclosed defect. The author added the custody paragraph and A6 during this preliminary check; the full updated draft was reread and the report binds that revision. This was not an immutable cold final-design review.

Paths below are relative to `docs/superpowers/specs/`; line references refer to these exact bytes.

| Alias | Input | SHA256 |
| --- | --- | --- |
| D | `2026-10-26-portable-verified-autonomy-design.md` | `b54f1e8accc5d924acbe5c6cbf78e09e8d4e9ac53473c2980ec8da5806774ae6` |
| P | `2026-10-26-portable-verified-autonomy-prd.md` | `ec33fd3d88ae41fb623b31d4d465d96d2cbe3af63dfc7d815f72c8c684590721` |
| A | `reviews/portable-verified-autonomy/arch-decisions.md` | `63717083158bc507561dda0afe66112f5ed068369f79a11dd7cfe2f438f1a0bd` |
| H | `reviews/portable-verified-autonomy/openmaus-binding-probe.md` | `d101b7680795db63088104b9f52084ce1790c34ea16260a13e0b70c3ce951b3c` |
| B | `reviews/portable-verified-autonomy/pipeline-binding-probe.md` | `40338559a4d0168f745637c28f914e5a0efd985d4a35a232884e8b558f963cd8` |

## Assessment at this maturity

The section-level proposal is coherent with retained AIF. D:69 preserves actual AIF admission and PlanReview; D:72 preserves its inner execution loop; D:73–74 preserve separate acceptance, delivery ownership and actual predecessor merges. This matches P16 (A:17) and the retained-AIF addendum (B:117–129). Applying the earlier native-without-AIF replacement requirements as mandatory would be a review error: B:113 explicitly supersedes that application, and D:166 carries the distinction.

No concrete overstatement of an existing capability was established within these inputs. D:49 says the connected route has not run; D:80–84 explicitly identifies the premature-completion gap; D:88–92 does not treat a fresh thread as isolated review. Those boundaries agree with H:41–46,62,70–83 and B:139–151. “Existing” in the responsibility table is therefore source/protocol reuse, not installed OpenMaus integration. This conclusion would be wrong if those proposed connections were used as current deployment or launch evidence; this report provides neither.

## Ranked questions needed before a final implementation plan

### 1. What supported mechanism will keep the outer obligation alive after a successful premature owner finish?

**Already declared qualification blocker: Q1, not a newly discovered omission.** D:82 requires both withheld acceptance and automatic continuation; D:84 permits a proved existing hook or an explicitly reconsidered bounded host change. H:70 and H:83 explain why native awaited-child handling alone does not resolve this: a negative result can be consumed and the owner can then complete, outside nonterminal restart reconciliation.

The final specification needs the selected continuation mechanism and its accountable owner, including restart and pause/cancel behavior. A verified project-hook binding, a bounded host extension and a revised host binding lead to materially different implementation and maintenance plans; a builder cannot choose among them by assuming that `done_when` enforces acceptance.

**Wrong-guess consequence:** the product stays correctly unaccepted but needs another human continuation prompt, failing PA1/PA3. This question is closed by Q1 evidence for the selected route or an explicit architecture decision acknowledging the required change; it does not require a replacement scheduler design now.

### 2. Which actual independent-review route will supply Q2's permitted-input proof and return its result automatically?

**Already declared qualification blocker: Q2.** D:90 deliberately retains existing independent-review mechanisms without naming their selected execution binding. That is appropriate for the draft. H:62 excludes the shortcut of fresh thread plus personal memory off; H:66 states that a separately controlled reviewer also needs its own isolation and automated handoff proof. B:55 distinguishes the product-only judge from AIF internal review, as D:90 correctly preserves.

The answer changes whether implementation configures an existing reviewer environment, binds a separate native return path, or needs a narrowly scoped isolation change. The final choice must identify who launches the reviewer, what context/retrieval it can receive, and how its exact-candidate result returns to the owner. It need not specify every prompt byte in this discussion draft.

**Wrong-guess consequence:** an uncontaminated-looking review includes author rationale, or a valid independent verdict still needs manual relaying. Close with the selected route and Q2 evidence; no universal host-memory exclusion capability is assumed.

### 3. Which concrete sessions hold dispatcher, observer and post-harvest correction custody in the retained-AIF binding?

**Declared ownership binding: A6; no contradiction established.** D:63 now assigns whole-stage custody to the native outer owner, limits the observer to reporting and preserves managed-PR coordination rights; D:144 explicitly leaves concrete identities and correction custody open. D:71 preserves the standalone-worker contract “where applicable.” B:151 makes the selected role distinction consequential: polling/await/harvest requires a standalone session for a coordinator, while dispatcher-role sessions are exempt. B:125 separately preserves fully specified post-harvest fixes in-session on the harvested branch, rather than forcing every repair back through AIF.

Bind the selected parent/dispatcher/observer identities and where harvest plus any post-harvest correction continues, including the point at which AIF repair custody has ended or been reconciled. The updated rule settles the observer's data-only scope; its report does not transfer harvest or correction work to that observer. The remaining question is the actual authorized execution route for those obligations, as D:63 already requires before launch.

**Wrong-guess consequence:** the owner is left with an unassigned correction, a coordinator performs work reserved for a standalone session, or two sessions repair the same candidate. D:49 already prohibits duplicate repair ownership; a concrete role/custody mapping makes that prohibition actionable without redesigning AIF or prescribing implementation internals.

### 4. What first-trial operating envelope is actually being qualified?

**Declared open decisions and environment qualification, not a demand for all-host implementation detail.** D:98,140–142,162 leave the actual task, availability environment, benefit horizon and memory binding open. A:24,29–30 records the corresponding operator forks. B:129 and B:139 leave actual AIF access from the native worker unverified, and D:94 conditions experience reuse on the isolated continuity experiment. P:94 requires task and comparison conditions before trial.

For the selected trial, settle the useful task and authorized destination, local-active versus laptop-independent availability, and the concrete eligible execution/memory route. Record how setup and recurring effort will be compared. These answers determine the deployment boundary, accessible artifact/endpoint paths, relevant delivery owner, and which subscription/free-component operations must be qualified. The builder cannot choose the easiest task or assume a localhost endpoint reaches an AIF runtime from another environment.

**Wrong-guess consequence:** the integration is technically connected but cannot exercise the promised real workflow, needs an unapproved paid dependency, or is assessed under an availability/effort promise it never supported. Exact second-host selection and broad consumer coverage can remain later-stage work as D:127 allows; they remain required for full feature acceptance under P:96.

## Scope guard and self-check

These questions do not request database schemas, an invented native task adapter, an exhaustive failure-state machine, or replacement admission/review infrastructure. The existing source command seam in B:133–145 is enough to frame the observer experiment; it does not itself certify the environment or return path. Stage gates retain their existing enforcement strength: B:59 explicitly records prose enforcement, so this report does not credit a new mechanical advancement guard.

Countercheck: **Did the review mistake declared Q1/Q2 research obligations for hidden design defects, or accidentally reimpose the superseded no-AIF route?** No: questions 1–2 preserve the named holds; question 3 retains the existing dispatcher and correction rules; question 4 preserves recorded forks. **Did the review demand final implementation detail merely because the document is unfinished?** No: each question changes ownership, supported mechanism or trial validity. Self-application finding: this is an artifact-consistency and planning-readiness check only; it cannot establish live capability, independent source verification or final design approval.
