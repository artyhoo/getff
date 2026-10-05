# F11: preserve the harvest divergence guard through JSON extraction

> Authority: task-specific design/verification record; harvest state machine remains in packages/runtime-bridge/DESIGN.md.

Choose Option A, a string-aware balanced-array scanner. Existing live review comments contain unfenced JSON fragments inside Markdown, so restricting extraction to fenced JSON documents would silently lose compatible self-reports. Parse JSON string tokens before recognizing an affected_files property; ignore escaped property examples inside string values. Array depth ignores brackets inside those strings. Parse the complete extracted array and require only top-level strings; nested/non-string elements invalidate coverage rather than being silently dropped. Inline Markdown code examples cannot establish coverage. Existing JSON fences remain report containers.

## Return contract and false-HOLD cost

Keep string[] | null, but amend null to mean absence of a recognized property outside quoted JSON/inline code. An explicit empty array returns []; any recognized malformed report also returns [] and invalidates the entire union, even beside a valid report. The existing mechanical divergence guard then HOLDs all changed files until confirmation. This avoids the former throw → null → skipped guard path. A malformed example written as ordinary property prose can cause a false HOLD; the existing confirmation override is retained, while inline-code and JSON-string quoting avoid that cost. The result cannot distinguish broken coverage from an explicit empty report, so its existing unreported-file diagnostic is retained. No operator-facing confirmation semantics are invented.

## Complete population and delivery

Cold sweep reached four extractor/guard twins: source and vendor packages/runtime-bridge/*/harvest.ts plus their generated packages/getff mirrors. Each has one harvestTask caller and one corresponding CLI that displays needsFileConfirm and supports the existing override. No additional extractor or installed vendor tree exists in this checkout.

Vendor is a manually maintained one-way copy; refresh it using the pinned Prettier 3.8.3 transformation checked by scripts/format-shipped.sh. Do not independently alter the CLI twins: their guard/result interface is unchanged. scripts/build-getff-dist.sh regenerates both npm mirrors. Factory delivery installs the vendor via setup.d/55-runtime-bridge-vendor.sh and refreshes it via install.sh. All four executable copies inherit the same extraction semantics.

## Tests and falsifiers

Both complete production pre-images were pinned at staging 6f726418451 before changes. RED: 24 failed / 71 passed in the source/vendor extractor and divergence-guard matrix. GREEN: all 95 harvest tests pass. Coverage includes legal closing-bracket paths, nested/invalid arrays, escapes, null absence, explicit empty reports, mixed valid/malformed reports, JSON-quoted second arrays, inline Markdown examples and both real HOLD consumers. Cold adversarial review is GO, with additional escaped-key, scalar, quote and fence probes. Runtime typecheck and affected-source citation checks pass.

Falsifiers: a bracket-bearing path skips mechanical comparison; malformed recognized coverage produces null or retains a partial union; quoted string/inline-code text establishes coverage; a complete valid bracket-bearing report creates a false HOLD; vendor differs from formatted source. Everything is deterministic and uses no API-billed LLM.
