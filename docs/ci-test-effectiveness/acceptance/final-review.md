# Final whole-branch review — CI/test effectiveness

Reviewed base: `5fc5f74c3bc3b7b16047f527fc121f02dfe12b4d`
Reviewed head: `7defdb78ba1a4c74713e10787cdc8917ebf1dbdc`
Requirements: `docs/superpowers/specs/2026-11-08-ci-test-effectiveness-design.md`, SHA-256 `77e669ad6113b9674c6b32f92554af1a490e5828127f4c9ebea800f271a83e4a` (verified). The supplied approval/execution authority supersedes the immutable document's historical candidate wording.
Reviewer: `native_final_review`; single independent whole-branch review, read-only except this report. No agent dispatch, source/index/HEAD change, publication, settings change, installation, native census, full-suite replay, or installer battery.

## Strengths

- The implementation improves actual boundaries: actionlint failures survive the sweep; discipline/husky controls invoke their real production checker; recorder cleanup is independent of test selection and assertion success; ambiguous `sg` identity cannot masquerade as ast-grep. Negative controls assert intended diagnostics as well as status.
- The removals preserve distinct witnesses. The two detached discipline predicate copies are replaced by reached production controls; the two root-auditor repeats do not erase installed-consumer checks; four installer suites retain their commands and equivalent prerequisites. B9 removes repeated thin-wrapper schema trials while preserving all distinct helper schemas and four transport outcomes.
- Invocation coverage now handles actual YAML run steps, npm package/cwd semantics, tracked workspace populations, bounded native argv, and explicit exceptions. New recurring execution uses existing channels and retains conservative unknown-path fallback. No competing TAK/OCR runtime, paid model CI, arbitrary speed target, or blanket deletion quota was introduced.
- The semantic prevention path is meaningfully stronger than policy text: the existing cold review has a shared seven-criterion rubric, its original findings are consumed before fidelity, and the CLI binds dispositions to the actual Git range and exact changed-path population. The report correctly distinguishes schema acceptance from semantic truth and reviewer identity. Independent semantic fixtures, original findings, real fixture repairs, and actual CLI outcomes are retained, including the controller's corrected c5 premise.
- The campaign preserves negative history and uncertainty. Local Node24/Linux evidence is not relabelled as hosted Node22/Windows; B4's 31–39% figure remains a forecast, with actual AFTER unmeasured; B7's 203.208s is repair overhead, not savings. The missing three registrations and administrator403 remain explicit.

## Issues

### Critical (must fix)

None found.

### Important (should fix)

#### I1 — P41 still credits an unreachable husky wrapper

- **File:** `packages/core/principles/41-shell-test-ci-coverage.test.ts:194` (the two independent `.includes(...)` checks at lines194–203).
- **What is wrong:** The advisor recognizer requires its supported statements in order, but the sibling husky recognizer only asks whether a callback contains the invocation and status assertion somewhere. It does not reject control flow before them. This contradicts the function's stated live/direct-callback contract and RC1's dead-invocation prevention claim.
- **Failure-scenario:** Insert `return;` immediately before `const result = run('bash tests/hooks/test-enforce-husky-presence.sh');` in the real husky callback. The callback succeeds without running the manual fixed controls, yet `wrapperTargets()` still returns that shell-test path. P41 then treats the only supported wrapper delivery as covered; an erased regression battery becomes green coverage.
- **Evidence:** A focused read-only probe loaded the actual P41 implementation in memory, retained its real workflow/population/import helpers, and supplied only that one modified wrapper source. Output: `{"probe":"P41 husky wrapper early return","baselineCredited":true,"unreachableCredited":true,"filesystemMutated":false}`. The first probe launch failed solely because a data-URL module needed `file:` imports; the corrected launch returned the result above. No failing import was counted as detector evidence. The actual current wrapper is live; this is a demonstrated detector regression hole, not a claim that today's husky controls never run.
- **Fix:** Apply a bounded ordered/live-statement contract to this second supported wrapper too. Reject early return/throw/unknown control flow before the invocation and its assertion; retain the legitimate subsequent independent diagnostic assertion. Add fixed early-return and a distinct dead/control-flow variant, plus the unchanged/comment-only companion. Verify the actual ordinary P41 carrier catches the loss with the expected population fixed, then restore and regenerate the normal shipped manifest if its source hash changes. No new general JavaScript analyzer or broad suite replay is needed.
- **Calibration:** Important / P2, implementation, reviewer-owned. This is a concrete false-green in a central deliverable of the campaign, not a request for arbitrary semantic completeness.

#### I2 — The final generated face-facts artifact fails its required drift check

- **File:** `docs/site/face-facts.json:4` (generated artifact); invoking boundary `.github/workflows/audit-self.yml:334`.
- **What is wrong:** The final branch's committed output is not byte-identical to the normal derivation. The coordinator's fresh final-head preflight ran `node scripts/render-face-facts.mjs --check`, exit1, and retained the exact result in `.superpowers/sdd/ci-test-effectiveness/final-preflight.json` bound to `7defdb78…`.
- **Failure-scenario:** Publication of this head reaches the existing render/drift step and fails before the branch can obtain its intended final CI result. The earlier generated-output receipts do not close this final-head discrepancy.
- **Evidence:** Receipt diagnostic: `docs/site/face-facts.json differs from the derivation — run scripts/render-face-facts.mjs --write (D42: derived, not asserted)`. I read the receipt and the actual workflow/generator boundary; I did not rerun that already recorded preflight. The printed counts are not themselves proof of which field differs, and this review does not invent a stale-count diagnosis.
- **Fix:** Run the existing normal `--write` generator against final sources, inspect the complete resulting diff, and run its scoped `--check`. Refresh any actually affected derived reference through its normal generator. Preserve the failing receipt. Do not hand-edit values or broaden to an installer battery.
- **Calibration:** Important / P2, implementation/delivery, reviewer-owned. A small generated change remains material because it deterministically blocks the declared delivery gate.

### Minor (nice to have)

#### M1 — Fidelity workflow still describes the retired warn-green observer

- **File:** `.github/workflows/pr-body-fidelity.yml:14` (also lines5–6 and15–19).
- **What is wrong:** The comment still says CI cannot verify registration and that `workflow-integrity.yml` reads the administrator endpoint, warns, and exits0. B8 now uses ordinary branch metadata, returning0 for a concrete complete witness,1 for known missing contexts, and2 for unsupported/unreadable state.
- **Failure-scenario:** A maintainer investigating the new observer's red result follows this active workflow comment and interprets failure as the historical unavoidable admin-read condition, rather than inspecting the missing/unknown result. The source documentation conflicts with the repaired mechanism.
- **Fix:** Update the current-state explanation to the new ordinary-metadata observer and keep the valid distinction between observation and administrator registration. Preserve historical facts only as explicitly historical context; do not imply that source or local auth proves hosted permissions.
- **Calibration:** Minor / P3, documentation, reviewer-owned. This does not itself alter runtime behavior or justify a separate review round.

## Plan alignment and quality

**Plan alignment: needs the two fixes above; campaign acceptance remains PARTIAL.** The audit-first boundary, complete original denominator, S2 additions, no-loss decisions, existing-owner reuse, generalized semantic principles, and finite independent conformance are present. I reused the independently accepted frozen S1 assessment (`acceptance/s1.json`) rather than commissioning a second audit. The final source/population reconciliation preserves736 original source candidates,14 changed originals, two new test sources, and43 supplemental records without calling them disjoint test counts. B1–B9 acceptance records and the coordinator's exact rulings explain the batch changes and carried limitations. The fresh counterexample I1 reopens the bounded RC1 prevention claim; prior B7 acceptance does not waive it.

**Code quality: generally sound, with a localized inconsistency in wrapper recognition.** The shared command model avoids repeated workflow regex copies and rejects several unsupported forms conservatively. Production CLI errors fail closed before docs-only inference; PR data is not evaluated as shell; scope includes deletes and both rename paths. Required-context observation separates HTTP status from body, checks schema, handles rules pagination conservatively, and does not mutate policy. Existing entrypoints, dependencies and public status names are preserved. The human-semantic trusted boundary is explicit rather than hidden behind JSON validation.

**Seven-criterion system judgment:** Relevant production faults are repaired; checker/oracle theatre is reduced; expectations and held faults are independently fixed; the supported zero-marginal invocations are removed while unique host/installed/cold witnesses remain; execution overhead and frequency/blocking boundaries are visible; cost forecasts are not measured gains; sufficiency is honestly limited by I1, I2 and outstanding hosted/policy effects. Metachecks and audit-only drivers are included in the S2 assessments, including the P37 duplicate-case correction. There is no basis to claim a mathematical minimum, net hosted savings, or universal semantic certification.

## Review coverage and evidence reuse

I inspected the actual range/log/stat/package and the production changes across the60 bound paths, including removed behavior, shared callers, tests, generated role/card/reference surfaces, manifest changes and all15 fingerprint path-delta sets. Generated bulk was reviewed by semantic field/path deltas and source bindings, not by treating unchanged serialized context as new behavior. All25 changed manifest entries match actual source SHA-256 values, and the canonical/plugin role bytes match. The actual full-range fingerprint changes are attributable to the approved role/binding, B2 recorder source, B5 firing runner and derived refresh metadata; the B9 installed capture/compare/archive execution evidence is reused rather than rerun. F3 adds the three intended checker entries and updates invocation references; C/I carry the role description changes. I2 is the separately observed final generated-output failure.

Cross-batch interactions considered:

- B1 actionlint status through real sweep selection/output and explicit tool absence.
- B2 cleanup during zero/selected/failing Node runs, retained whole-run TCP/HTTP assertions, and later B7 Windows selection.
- B3 real checker extraction versus removed detached jobs, both hook identities, safe fixture ownership, and later P41's wrapper recognition (I1).
- B4 combined witness survival, existing event/path gates, equivalent shard setup and retained real installed consumers.
- B5 canonical ast-grep precedence versus alias identity and diagnostic failures; B6/B7 subprocess deadlines versus unchanged assertions/case counts.
- B7 npm/cwd/config/filter semantics, dead/printed commands, native option positions, two source wrappers, all workspace/native families, supplemental local rows and preserved unknown fallback.
- B8 exact required names, context/check schema, complete-classic fast path, paginated unknown rulesets, status transport and P37 wrapper minimization.
- B9 role/AIF/harvest delivery; docs-only/unknown/delete/rename applicability; fresh base/head/path binding; skipped fidelity; duplicate/malformed/stale/unresolved records; controlled original/fixed semantic consumption and recursion boundary.
- Ordinary future work reaching the existing required fidelity consumer; mutable PR-body records do not create a report-commit treadmill. The review itself does not claim to authenticate reviewer identity.

Recorded evidence reused includes the final actual hook receipt on `10bb7294…`: exit0,98 files,2344 passing tests,3 explicit skips,166.031s. There are no production changes from that source head to the reviewed head. B7 native enumeration and routed-source results, B4's three BEFORE traces, B8 observer receipts, B9's semantic package and15 installed capture/compare cells retain their stated provenance and limits. No recorded suite, native discovery or installation was rerun by this reviewer.

The only new behavioral probe was the bounded in-memory I1 counterexample (plus its corrected loader launch). For the concrete outside-diff integration risk of the newly referenced sweep helper on installed consumers, I inspected the existing installer copy/refresh sites and sweep's documented framework-only rows: the helper is in the distribution payload, while the general consumer sweep already has unsupported framework-only batteries. I did not expand this campaign into a redesign of that pre-existing surface or infer a new supported consumer green-path regression from it. For I2 I inspected only the existing generator and required invocation to interpret the supplied concrete preflight failure.

## Deferred notes and declined-to-judge behaviors

These are explicit limits/decisions for the coordinator; none is silently treated as passing:

- **Current hosted Node22/Windows behavior and actual final CI status:** pending final published-head execution. Native Linux receipts cannot settle these; the review makes no host-pass assertion.
- **Actual three-context registration and hosted token access:** administrator effect and hosted observation are pending. Native ordinary metadata reports the exact missing three and admin403; source cannot make them registered. This is an acceptance dependency, not a request to add a privileged token or reduce the declared six.
- **Actual AFTER shard duration, developer wait, token/$, and financial payoff:** not measured in the provided evidence. The31–39% figure is a bounded forecast, and203.208s is newly routed command wall time; no gain/ROI verdict is inferred.
- **Future TAK2144/OCR2146/Windows2116 implementations and accepted-host compatibility:** still open/unaccepted owner work at the recorded heads. The current integration interfaces and documented prospective conflict were considered; evaluating their future code or changing their scope is not authorized by this branch review.
- **Arbitrary shell/JavaScript semantics beyond the declared finite invocation grammar:** not claimed or demanded. I1 falls inside one of the two explicitly supported wrappers and therefore is judged, not excused by this limitation.
- **Arbitrary semantic-review accuracy, identity authentication, or fabrication resistance of a plausible protection-review record:** outside the declared structural consumer contract; honest controller and competent cold review are explicit trusted boundaries. No new attestation system is proposed.
- **Re-certifying every unchanged S1 assertion or historical raw transcript:** declined because the independent S1 assessment is accepted and frozen, with source/contract—not universal runtime—limits. Relevant changed sources and combined effects were reviewed here.
- **General installed-consumer sweep completeness:** pre-existing framework-only missing-runner behavior is not repaired by this campaign; the focused integration read did not establish a new supported green path lost by these changes. No new consumer-completeness claim is accepted.
- **Historical WARN/fixture diagnostic cleanliness and frozen log whitespace:** no demonstrated behavior loss, and no pristine-output claim. Retain the diagnostic evidence rather than spend another run or cleanup wave on it.
- **Previously deferred minor count/delivery labels:** S1's21-versus22 receipt is correctly bounded by acceptance; B2 one-shot-driver delivery is corrected in S2 metadata; B3's stale fault-count prose is resolved by B4; B8's repeated wrapper trials are actually consolidated in B9. No new behavioral judgment or additional round is needed for those closed notes.

## Recommendations

Use one narrow final fix wave for I1, I2 and M1, preserving this report and the original evidence. Keep I1's valid companion and independent fixed dead-path expectation; update only affected source/generated bindings and cost/population claims. A focused carrier/conformance check plus normal derived-output checks is sufficient for these source repairs; the existing final hosted pipeline remains responsible for hosted acceptance. Do not erase the preflight red or relabel missing registrations as source-complete enforcement.

## Assessment

**Ready to merge? No at the reviewed head.** Two Important findings need correction, and the final hosted checks plus actual required-context registration remain outstanding acceptance conditions. The branch substantially meets the approved approach and shows credible protection improvements, but neither current local green evidence nor the honest PARTIAL label substitutes for those remaining effects.

**Counts:**0 Critical,2 Important,1 Minor. No additional broad review, agent, test battery, or approval flow is requested by this report. A subsequent check should be limited to these fixes and any new breakage they introduce.
