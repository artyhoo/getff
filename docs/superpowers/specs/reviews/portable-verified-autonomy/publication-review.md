# Portable verified autonomy — publication review

VERDICT: GO

Date: 2026-10-26. Cold, read-only publication review of input ref `8bfde9c091dcadbf4f73721daede805788ee3bd6` against base `943e417c5a70d4589d5ee75fcf6ee273a9d46bfd`. Scope: the 97 added documentation, evidence and kickoff files. This verdict covers staging publication of that immutable documentation set; it does not admit execution, approve a later execution packet, certify runtime acceptance, or authorize installation, spending, dispatch or merge. Only this review file was written. No external services, private chats, memory, live configuration or archived source execution were used.

## Findings

BLOCKER: 0. MAJOR: 0. MINOR: 0.

No concrete sensitive-content export or requirement contradiction was found in the inspected publication set. Historical local Git refs and absolute snapshot-map paths were assessed as provenance, not deployment prerequisites or grants.

## Reproduced publication evidence

All file references below are at input ref `8bfde9c091dcadbf4f73721daede805788ee3bd6` unless explicitly identified as archive members.

- `git diff --name-status BASE INPUT` returns 97 additions, with no modifications or deletions. The agreed readable PRD, design and kickoff SHA256 values reproduce exactly: `ec33fd3d88ae41fb623b31d4d465d96d2cbe3af63dfc7d815f72c8c684590721`, `d82086984feffc8bc038021ef4419e0d4388e32e82accbe7ebab0e016002904c`, and `fc69ebec945425313aaa0d0a619af18dec1ded3fb1a371a73a30cb625360b98b`. All five hash-named files under `docs/superpowers/specs/snapshots/portable-verified-autonomy/` match their filename digests. Exact authority is retained in `approval-receipt.json:4-16` and `spec-agreement-receipt.json:5-13` under the review directory.
- The archive SHA256 is `aae07b5e89933337bb96dd77c998f388bed4f2370a5ca6dec9132b55a8e418cb`, matching `docs/superpowers/research/portable-verified-autonomy/2026-10-26/evidence-archive.json:3-4`. Inspection of the actual tar headers found exactly 73 unique regular members, all normalized below `evidence/`, with no absolute paths, parent traversal, links or special files. The manifest member set and every SHA256 match the actual bytes. All 73 evidence entries in `research-review-inputs.json` match those members; all eight report entries match tracked report bytes. There are no missing or extra archive members.
- The extraction command in `docs/superpowers/research/portable-verified-autonomy/2026-10-26/evidence-archive.md:10-15` was reproduced with the pinned archive in a disposable directory after header validation. It restored the expected `evidence/` layout, all 73 member hashes, and zero symlinks. No restored code was executed. The archive retains four upstream LICENSE files, source trees, exact revision records and URL/hash receipts; these remain distinguishable from framework-authored findings.
- The three snapshot maps retain all 28 tracked review inputs: `arch-review-r1-inputs.json:5-15`, `arch-review-r2-inputs.json:5-17`, and `kickoff-r1-inputs.json:4-10`. Resolving their historical checkout prefix to the tracked repository suffix finds every snapshot. Twenty-two applicable tracked receipt SHA256/Git-blob comparisons reproduced without mismatch, including the five Q1 addendum source captures. The review graph therefore does not depend on publishing the author's local review-only Git refs.
- The kickoff's direct local Markdown evidence links resolve to tracked artifacts. Accepted raw research paths resolve after the documented archive restoration. The PRD approval, exact-spec agreement, independent architecture and kickoff verdicts, research K-pass, receipts and reviewed snapshots are present. Source-relative links inside preserved snapshots and quoted diffs retain their original context; they are historical evidence, not new dispatch entry points.

## Authority, scope and publication safety

`.claude/orchestrator-prompts/portable-verified-autonomy/kickoff.md:14-26` binds the exact PRD/design and requires reviewed staging publication of the authority/evidence closure before later admission. It expressly forbids creating live tasks, routines, installations or sessions from the file's existence. Its proposed implementation surfaces are identified as new work (`:32-41`), and the host-verification block expressly identifies future checks (`:132-143`). Missing future implementation files therefore do not contradict a present implementation claim. Current-authority, ownership and real predecessor-merge checks remain execution requirements (`:114-130`).

The field-note transfer survives publication as substantive scope: `docs/superpowers/research/portable-verified-autonomy/2026-10-26/field-notes-comparison.md:13-79` retains 18 practice and 40 failure dispositions, including stronger-existing and inapplicable cases; kickoff `:97-110` requires their implementation/evidence transfer. Native source, first-host work and whole-feature acceptance remain distinct, including later consumer and second-host obligations (`kickoff.md:165-171`).

The archive inventory and authored additions were inspected for live credential/private payload export, supplemented by bounded scans for private-key blocks, GitHub/OpenAI token forms and credential-bearing URLs; none were found. Local memory material contains installation/runtime identity and names, not token values, conversation/database contents or live configuration. `source-register.md:9,14,25-30` records these limits.

The five-line archive member `evidence/development-efficiency-journal-excerpts.txt:1-5` contains dated, bounded research assertions about a retained business hold and useful-work constraints. It is not a copied task registry or live selector. Retained evidence excerpts were expressly admitted by `docs/superpowers/specs/2026-10-26-portable-verified-autonomy-research-spec.md:151`, and `source-register.md:9` identifies this source and its limitation. Those assertions do not independently prove native receipts or grant operational authority. No new publication authorization was inferred merely from file availability.

## Compact watch-list

- Preserved design/handoff/review snapshots contain historical local-status wording. Read the exact agreement receipts and current authority at future admission; publication does not make an old selector observation current.
- Raw evidence requires the documented restoration step. Archive provenance and source inspection are not host acceptance, entitlement, configured memory, review-isolation or economic-benefit receipts.
- The bounded journal excerpts and installation metadata remain intentionally disclosed research provenance. This review does not certify unrelated local state or approve broader exports.
- The later Stage A execution packet and all implementation/host qualifications are outside this input ref and this verdict.

Falsifier: GO is invalid for changed publication bytes, a missing or mismatched published snapshot/member, a demonstrated secret or broader private payload in this set, or a publication route that treats these source documents as live execution authorization. Changes require review of the resulting exact artifact set.
