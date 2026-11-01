# M06 / A08 — full consumer-tree dry-run observation

> **Authoritative for:** the finite original A08 filesystem assurance repair and retained process evidence.
> **NOT authoritative for:** whole M06/S2 acceptance or semantic R4 coverage; original A06 remains open.

Prepared on accepted `daf33f0887b188be7f24c45c9b34ddbf9d064619`, tree
`a93f0af9720d35c269076838240e412683d6fc30`. Root is read-only during preparation.

## Original gap and reached RED

The original S0-identical `tests/plugin/install-seam.test.sh` promises that the
default enforcement-install preview writes nothing to the consumer. Its only
filesystem assertion inspected absence of `.husky`. Original spec seed A08 names
this exact gap. The actual seam invokes the local real `install.sh --dry-run`.

The unchanged whole test passed all nine checks. A frozen source fault then wrote
`.tak-a08-outside-husky` with the literal marker before the real dry-run installer
invocation. The unchanged test still exited 0 with PASS9/FAIL0. The independent
driver read the actual forbidden file/content and recorded a normative mismatch.
This is the initial RED: a reached outside write survived the promised boundary.

## Minimal repair

The existing test now compares complete before/after observations of its actual
consumer tree. It walks every hidden/ignored path and empty directory, records
regular-file byte hashes, types, symlink targets and observable lstat identity,
mode, ownership, link count, size and write timestamps. It does not follow links.
Access time is excluded because the observer reads files. Unsupported entry types
and fixture/snapshot failures fail visibly as infrastructure, never as detection.

The normal fixture contains legitimate pre-existing ignored data, an empty
directory, an executable file and a symbolic link. All are admitted unchanged.
The preview/actual exit checks, separate apply consumer/hook artifacts, unknown
flag and command/skill checks retain their prior purpose. mktemp/git/fixture errors
now propagate before using a consumer path. No production installer code changes.

## Fixed source fault and restoration

The original no-write expectation, marker content, source fault and normative
driver stay frozen. The repaired test is frozen before the corrected arms.

| Arm                                    | Real whole-shell exit | Actual check totals | Normative observation                                  |
| -------------------------------------- | --------------------- | ------------------- | ------------------------------------------------------ |
| Original normal                        | 0                     | PASS9/FAIL0         | Admitted                                               |
| Original with reached outside write    | 0                     | PASS9/FAIL0         | False green; fixed no-write expectation rejected       |
| Repaired normal                        | 0                     | PASS9/FAIL0         | Full before/after tree identical                       |
| Repaired same outside-write fault      | 1                     | PASS8/FAIL1         | Sole named dry-run changed consumer filesystem refusal |
| Actual subject restored, repaired test | 0                     | PASS9/FAIL0         | Full before/after tree identical                       |

The fault changes only the default dry-run branch before the real installer call.
Apply and unknown-flag logic remain actual. The driver independently checks the
one reached marker path and literal content. It does not copy the tree predicate.
A failed process without the intended sole filesystem diagnostic/complete nine-check
summary or with infrastructure is not credited. The last restoration requires
the same actual faulted subject preimage, then restores its exact original bytes.

The old fixture was the original pristine consumer. The repaired normal/fault/
restored arms use the same frozen expanded legitimate fixture. The normative
no-write requirement and exact producer fault remain unchanged across versions.

## Scope and limits

This observes the complete intended consumer path tree and its recorded net state.
It is not arbitrary-host or transient-syscall tracing, nor ACL/xattr certification.
One reached original outside-write fault proves this finite sensitivity, not every
possible filesystem defect. The other eight existing checks retain mixed structural/
CLI/artifact scope; no blanket behavioral certification is claimed.

The original test and real subject are outside the installer-shell directory that
earlier bounded lookups searched. The exact source is byte-identical to original
S0 commit `6bd07187e57635d02f8aed5e3560a346ad2748db`. Prior bounded unknowns remain
historical; no global absence claim or guessed replacement carrier is used.

## Complete retained receipt bindings

Portable labels below are relative to `s2-m06-a08/execution-1/` in the retained TAK
bundle. They are off-tree evidence, not additional shipped files. All hashes are SHA256.

| Artifact                                  | SHA256                                                             |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `BRIEF.md`                                | `d9cada006180dcf36ec9366ce3d667b7d4674bce5e4b991be19fb97af7abd719` |
| `BRIEF-GO.json`                           | `7526b433d38b9f813e6874c3c00e22fc8eccab76b64c45af619a6987347748d3` |
| `EXACT-INPUT.json`                        | `c7e536cfc8e2af032ddbc111561d3321c12780d213fe8fb52ad4bfb05c130f9f` |
| `PREDECESSOR-M13-GO.json`                 | `c3c3f584a1989193bf0f3c4e4d2e1e10b887ce1f288c0f0cae048d430be88d73` |
| `FROZEN-DRYRUN-CONTRACT.json`             | `a1f5622f2bd59f8bedba8858dce26328a5933e33593df8a8b63f345569f3d0bc` |
| `FROZEN-INITIAL-DRIVER.json`              | `2035178d20d7e0d6c7c4bbf260ff5f8479b6964fce18e3f3e687bfdd4bc6bdf5` |
| `NEW-TEST-FREEZE.json`                    | `079658b47073d74d0be8c391fed5b270f8f6b42801f94676df5dff10bb761209` |
| `outer-driver/run-a08.py`                 | `b0bef7c4d5245213824692d0aa788f79c84eebb6ec1fefec86833ceac92c2c28` |
| `inputs/original-seam.sh`                 | `0381e9d43ccc1232285356406b5741604fc1f6433af017259f3bff5a4d832aab` |
| `inputs/fault-seam.sh`                    | `1829afa9cd295f4f05b82b6c079389f7c1515b8f570f2ca61b93dc6b04e43eac` |
| `inputs/original-test.sh`                 | `d9d467194a250d52b14c7e1529e47a1fc7b14295e0106d2ceb9d1922901c0ddb` |
| `CAUSAL-DERIVED-SET.json`                 | `aba66899781f1a7e6ea6aa4a4e1b42888f8de1cbec0595dcb77e96795e2e973d` |
| `logs/00-normal-clone.json`               | `f0b4f832c0fe91b86afc6eab05d8da9210ad5e4b56471d10737e23382f687e34` |
| `logs/00-normal-clone.stderr.log`         | `c94cea41dc265b5c467d5213081bc654cf823976162d7901f6f38e0023ed8b67` |
| `logs/00-normal-clone.stdout.log`         | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/01-repaired-shell-syntax.json`      | `d2ae7137e20f6560da484830943e1acbbddd9a01aad86afc38c69656f3b71d2e` |
| `logs/new-fault-controller.stderr.log`    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/new-fault-controller.stdout.log`    | `d28a22857f847129d45b11171f883b71f075e9715a82dca7574265018a4a7f61` |
| `logs/new-normal-controller.stderr.log`   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/new-normal-controller.stdout.log`   | `c9cd8f96a3afdcdfd241e8944f9514bd3bd5f035c00c35ee20fb72caf4d3a8b7` |
| `logs/new-restored-controller.stderr.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/new-restored-controller.stdout.log` | `0fe057ff928ce13faf26536f261a5e27ed99fa5b287d919c9b58b480f24cc18d` |
| `logs/old-fault-controller.stderr.log`    | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/old-fault-controller.stdout.log`    | `1660c3ec488d6df504b379b51231fbc8f9e2c8ff635ff260143e9edfffe0505b` |
| `logs/old-normal-controller.stderr.log`   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `logs/old-normal-controller.stdout.log`   | `a990c966b50a2ea88b303cd0b63f62ff6d67c4b9bcbdff565edcf9bf9bb9bbec` |

Every run directory below retains full stdout/stderr, actual whole test/subject
bytes, command/cwd/TMPDIR/process result, marker artifact path/content and all
created consumer artifacts. Corrected runs also retain complete actual before/
after JSON snapshots extracted verbatim from the real test output.

| Run/artifact                             | SHA256                                                             |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `runs/old-normal/RESULT.json`            | `2ce3caeb3c6976f6537440d3352d29a974b35b77cadf499602ad3c88a245d37b` |
| `runs/old-normal/actual-subject.sh`      | `0381e9d43ccc1232285356406b5741604fc1f6433af017259f3bff5a4d832aab` |
| `runs/old-normal/actual-test.sh`         | `d9d467194a250d52b14c7e1529e47a1fc7b14295e0106d2ceb9d1922901c0ddb` |
| `runs/old-normal/stderr.log`             | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `runs/old-normal/stdout.log`             | `ec88c7835533d36bbe41fc7d81965fa9ed1c04911f090dc0a7b4d9b8f7137bc7` |
| `runs/old-fault/RESULT.json`             | `166d3f8e82edbbb3713c65635149cdb51509d814de8db7b6e7fe54d7050535fc` |
| `runs/old-fault/actual-subject.sh`       | `1829afa9cd295f4f05b82b6c079389f7c1515b8f570f2ca61b93dc6b04e43eac` |
| `runs/old-fault/actual-test.sh`          | `d9d467194a250d52b14c7e1529e47a1fc7b14295e0106d2ceb9d1922901c0ddb` |
| `runs/old-fault/stderr.log`              | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `runs/old-fault/stdout.log`              | `ec88c7835533d36bbe41fc7d81965fa9ed1c04911f090dc0a7b4d9b8f7137bc7` |
| `runs/new-normal/RESULT.json`            | `b8bfdfa09bb81d20e5801db277f2c5f5962d1a842f1e20ca9de246ccf77b932f` |
| `runs/new-normal/actual-subject.sh`      | `0381e9d43ccc1232285356406b5741604fc1f6433af017259f3bff5a4d832aab` |
| `runs/new-normal/actual-test.sh`         | `c38accf72220e3ad408b69b22121b56ce5c035bed1f380a2ddd742405b14a192` |
| `runs/new-normal/consumer-after.json`    | `9ccf87159835e191dc6a728a2f04cd8d736807b3f48a99258d34867472854647` |
| `runs/new-normal/consumer-before.json`   | `9ccf87159835e191dc6a728a2f04cd8d736807b3f48a99258d34867472854647` |
| `runs/new-normal/stderr.log`             | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `runs/new-normal/stdout.log`             | `3dd3f3cc9a95b6dfa999ebac14265d21f8776b49de6036c7e5aee8130b676309` |
| `runs/new-fault/RESULT.json`             | `36d03c98354ede362c0f9487ee064d4ccdd48bfa34329f6c341ae3163aa2f332` |
| `runs/new-fault/actual-subject.sh`       | `1829afa9cd295f4f05b82b6c079389f7c1515b8f570f2ca61b93dc6b04e43eac` |
| `runs/new-fault/actual-test.sh`          | `c38accf72220e3ad408b69b22121b56ce5c035bed1f380a2ddd742405b14a192` |
| `runs/new-fault/consumer-after.json`     | `e41b7dfbafbc4cb2f99a4d4807e73ce093fbf46a1bf48cb87ec3b9a5ee578a1c` |
| `runs/new-fault/consumer-before.json`    | `50000c9ad996f66a29f70ad7d0778a264abb733a8d7eec407c2a061749df7c95` |
| `runs/new-fault/stderr.log`              | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `runs/new-fault/stdout.log`              | `658c06aad2b306a3e67446f2316dd65041647d51705fa0763d998b0b4e0389ee` |
| `runs/new-restored/RESULT.json`          | `298ee4097e17ed404c4171b08b7d4b8aa664754f2a2c26894b6f2f23f0227467` |
| `runs/new-restored/actual-subject.sh`    | `0381e9d43ccc1232285356406b5741604fc1f6433af017259f3bff5a4d832aab` |
| `runs/new-restored/actual-test.sh`       | `c38accf72220e3ad408b69b22121b56ce5c035bed1f380a2ddd742405b14a192` |
| `runs/new-restored/consumer-after.json`  | `2b390eb98af64d0b38056bb11de12bfaf9830631ba3f6b6da0d7819fa6ff5d1e` |
| `runs/new-restored/consumer-before.json` | `2b390eb98af64d0b38056bb11de12bfaf9830631ba3f6b6da0d7819fa6ff5d1e` |
| `runs/new-restored/stderr.log`           | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `runs/new-restored/stdout.log`           | `a14c4fae7d9f96de7365c55e1c7b74ea9a622bf2f4a3cc40d0a069cde7935681` |

| Actual source / frozen contract                             | SHA256                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Repaired `tests/plugin/install-seam.test.sh`                | `c38accf72220e3ad408b69b22121b56ce5c035bed1f380a2ddd742405b14a192` |
| Original/restored actual `plugin/install/fetch-and-wire.sh` | `0381e9d43ccc1232285356406b5741604fc1f6433af017259f3bff5a4d832aab` |
| Verbatim `frozen-dryrun-contract.json`                      | `a1f5622f2bd59f8bedba8858dce26328a5933e33593df8a8b63f345569f3d0bc` |

The repaired source passes bash syntax checking. Normal and restored whole-shell
runs above are the actual changed-suite verification; no unrelated M01/M13/M10/S1
cohort or model campaign is repeated. Stock payload enumeration confirms all three
candidate test/evidence paths are outside shipped input roots, so this repair has
no causal MANIFEST/runtime change and performs no generation.

## Remaining work and counters

This is original M06 iteration1/5, PARTIAL0/2, sharing the original five-attempt cap.
There is no fresh allowance for a later A06 slice. A06 actual delivered R4/generated
consumer test-path reconciliation remains, and final S2 population/class sweep must
still reconcile analogous local/full-boundary obligations. The separately repaired
A08 installer exit42 surface keeps its narrower accepted M10 evidence without rerun.

Independent existing integration candidate acceptance and actual application remain
pending. Other original S2 mechanisms/assembly/S3-S4/currentCI/staging/compatible
guarded sole0166 installation still bind. No source application/publication/installed
or whole TAK completion claim, no Native/foreign/c9/Stop/settings/security effects.
