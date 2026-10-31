# OpenMausBot runtime explanation sources

> **Date:** 2026-10-26.
> **Authoritative for:** the bounded source basis for the operator-facing explanation of local/server operation and model use.
> **NOT authoritative for:** installation, live account eligibility, a selected routing model or changed deployment approval.

The operator clarified that the question about a cheap continuously running model concerned OpenMausBot as a whole, not only memory. Preserve laptop-first P17. The same message explicitly requires future Hy-Memory verification/configuration, recorded separately as P18/A7; it does not prove that integration operational.

Source pin: `milind-soni/OpenMausBot@3ac9fb1122a34b2755580d3d5d7cbd1a1a77bd4b`, using the existing accepted captures.

- Captured `openmausbot-README.md:78–82`: local agent CLI processes, existing logins/subscriptions, and a local harness server with persistent application data. A local CLI process is not evidence that model weights/inference run locally.
- `README:186–188`: an optional decision model routes unmentioned room messages; the room lead is the fallback when it is disabled or uncertain. This narrow router is not a mandatory permanent cheap-model coordinator.
- `README:330` describes embedded harness in released desktop builds. `:476–489` describes terminal/local-server launch and saved state surviving server stop. `:505–514` distinguishes provider sign-in, optional API setup and a background service on a VPS or always-on machine.
- Captured `openmausbot--package.json` identifies the application and Node runtime. It is package-source metadata, not installed-version or deployment evidence.
- Native engine request/resume and event-driven parent/child behavior remain covered by the existing OpenMaus binding probe; this explanation does not claim that the planned getff/AIF loop is already configured.

Bounded drill-down for this explanation: two existing captured artifacts, README and package.json. README structural searches and bounded excerpts at :75–86,175–189,476–521; package metadata read. No new upstream fetch, installation, service start, configuration/model selection or private state/memory operation occurred. Explanation distinguishes persistent ordinary runtime code, on-demand model turns and optional routing/model-processing costs. No cloud/offline or no-extra-payment entitlement is inferred merely from local operation.
