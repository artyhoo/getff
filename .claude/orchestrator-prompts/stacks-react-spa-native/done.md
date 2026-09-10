# stacks-react-spa-native — DONE
- Final PR: #788
- Closed: 2026-06-28
- Summary: U16 stub's confirmed e2e gaps closed — fresh-install validate gate extended to react-spa (#784), react-native (#787) and react-spa/ts-server (#788) fresh-install consumer lint green + gated on all stacks; the stub's precondition (U1 S3 gap confirmation) was recorded real in the plan-currency closure (2026-06-28).

## Evidence (gh, 2026-09-10)

- `#784 test(ci): extend fresh-install validate gate to react-spa; format-clean preset docs [2026-06-27]`
- `#787 fix(react-native): green fresh-install consumer npm run lint (typescript + config ignores); gate it — #786 KNOWN-SEPARATE follow-up [2026-06-28]`
- `#788 fix(install): green fresh-install consumer lint for ts-server/react-next/react-spa (typed-config ignores); gate all stacks — #787 follow-up [2026-06-28]`

## Attribution note

The preset WIRING thread — `#714 feat(install): wire react-native preset into install.sh (closes multi-stack umbrella #646) [2026-06-24]` — predates this stub (authored 2026-06-27 with the getff-to-prod U-stubs, #785) and belongs to the multi-stack umbrella (#646, closed); it is upstream of U16, not its closure.
