# DotPRReviewV2 bounded examples

Paired examples for the `DotPRReviewV2` / `dot-pr-review/2.0.0` contract
([schema](../dot-review-result-v2.schema.json), [spec](../../superpowers/specs/2026-10-06-dot-pr-coordination-design.md)).
Every record is **synthetic**: identifiers, principals, SHAs and digests are placeholder
hex/UUIDs chosen to satisfy the schema's shapes — they name no repository revision, no
enrolled principal and no executed review. Do not cite them as evidence of any live event.

Validate locally from the repo root (ajv resolves through `packages/core`'s declared
dependency, SSOT prior-art #194 ADOPT):

```bash
node -e "const A=require('ajv/dist/2020'),f=require('ajv-formats'),fs=require('fs');const a=new A({strict:true,allErrors:true});f(a);const v=a.compile(JSON.parse(fs.readFileSync('docs/meta-factory/dot-review-result-v2.schema.json','utf8')));const r=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));console.log(v(r)?'valid':'INVALID '+(v.errors&&JSON.stringify(v.errors[0].instancePath)+': '+v.errors[0].message))" docs/meta-factory/dot-review-v2-examples/positive-go.json
```

Schema validity is a data-contract property only. Admission (merge authorization),
supersession, and finding lifecycle are separate trusted-journal decisions and are
deliberately NOT enforced by the schema — a `GO` verdict on a `PARTIAL`-coverage report is
schema-valid and still denied at admission. The table's last column states the expected
admission/routing outcome per the spec's §8 and §11.

| File | Record | Mode | Schema | Expected outcome (spec §8/§11) |
| --- | --- | --- | --- | --- |
| [positive-go.json](positive-go.json) | review_report | OPEN_PR | valid | GO admitted: COMPLETE coverage + SUFFICIENT prior review + current bindings |
| [complete-revise.json](complete-revise.json) | review_report | OPEN_PR | valid | Accepted and routed; REVISE denies admission despite COMPLETE coverage (coverage complete ≠ defect-free) |
| [partial-revise.json](partial-revise.json) | review_report | OPEN_PR | valid | Accepted; PARTIAL coverage (one UNVERIFIED dimension) denies admission; finding stays actionable |
| [decision-required.json](decision-required.json) | review_report | OPEN_PR | valid | Routed to the operator; no admission while the policy fork is open |
| [historical.json](historical.json) | review_report | HISTORICAL | valid | Historical receipt; `current_staging_sha` required; finding creates remediation work only if still applicable to staging |
| [follow-up.json](follow-up.json) | review_report | FOLLOW_UP | valid | Targeted delta review; `supersedes_review_id` lineage is structurally required |
| [superseded-occurrence.json](superseded-occurrence.json) | review_report | OPEN_PR | valid | After assignment verification, archived as superseded; can never authorize the new revision |
| [prepr-review-reuse.json](prepr-review-reuse.json) | review_report | OPEN_PR | valid | Pre-PR receipt reused only through an assessed `IDENTICAL_RELEVANT_TREES` equivalence |
| [material-delta.json](material-delta.json) | review_report | OPEN_PR | valid | `MATERIAL_DELTA` forces `INSUFFICIENT` prior review; no GO admission until a scoped supplement |
| [fix-response.json](fix-response.json) | fix_response | — | valid | Executor's finding-to-fix claim; one corrective owner per PR; admission still pending verification |
| [closure-receipt.json](closure-receipt.json) | closure_receipt | — | valid | Independent closure at a verified revision (`RESOLVED`) |
| [closure-already-fixed.json](closure-already-fixed.json) | closure_receipt | — | valid | `ALREADY_FIXED` history creates no new remediation work |
| [invalid-missing-dimension.json](invalid-missing-dimension.json) | review_report | OPEN_PR | **INVALID** | Rejected at intake: six of the seven required system-dimension entries is structurally incomplete — path accounting alone never substitutes for the dimension set |

The examples deliberately distinguish the three failure shapes the spec calls out
(§11): path-complete/system-incomplete (partial-revise), already-fixed history
(closure-already-fixed), and stale closure/supersession (superseded-occurrence,
material-delta).
