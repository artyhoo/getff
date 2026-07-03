---
description: Integration rules across microservices — API contracts, CDC, event schemas, mTLS, observability, resilience
paths:
  - 'src/web/**/*.ts'
  - 'src/app/api/**/*.ts'
  - 'src/infrastructure/messaging/**/*.ts'
  - 'src/features/*/api/**/*.ts'
  - 'openapi/**/*.yaml'
  - 'pact/**/*'
---

# Integration Rules — apply to ALL services in microservice systems

> **Authoritative for:** cross-service integration template — API contracts, CDC, event schemas, mTLS, observability, resilience patterns (consumer-customisable).
> **NOT authoritative for:** project goal — see consumer's README.md.

These rules govern communication between services. They live in a shared file
(linked via symlink or git submodule across all services in the system) so
every service has the same integration contract.

## IR1 — API contracts

- All HTTP endpoints described by an OpenAPI 3.1 spec.
- OpenAPI auto-generated from Zod schemas via `zod-to-openapi` — Zod is the source of truth.
- Spec stored at `openapi/<service-name>.yaml` and committed to repo.
- Breaking changes to the spec require a new API version (`/v1`, `/v2`) with deprecation period.

**Check:** CI job validates the published OpenAPI matches the Zod schemas (no drift).

## IR2 — Consumer-driven contracts (Pact)

- For every external service this service consumes, write a Pact consumer test in `pact/consumer/`.
- Pact contracts published to the Pact Broker on merge to main.
- For every consumer that depends on this service, the provider verification runs in CI.
- `can-i-deploy --to production` blocks deploy if any consumer in production is incompatible.
- After successful production deploy, `record-deployment` updates Broker state.

**Check:** CI required jobs `pact-publish` (consumer) and `pact-verify` (provider) + `can-i-deploy` gate.

## IR3 — Event schemas (async messaging)

- All events on the message bus described by Zod schema.
- Event schemas stored in shared package `@org/event-schemas` (or git submodule).
- Producers validate before publish (`Schema.parse(payload)` then send).
- Consumers validate on consume (`safeParse` + dead-letter on invalid).
- Breaking changes to event schema require new event version + migration period (both versions in flight for N days).

**Check:** project-specific probe in `audit-ai-docs.sh` checking that all `publish()` calls reference an `@org/event-schemas` schema.

## IR4 — Service-to-service auth

- All inter-service calls use mTLS or signed JWT (OIDC).
- No long-lived service credentials in env (use IAM / workload identity).
- Auth header propagated via OpenTelemetry baggage for traceable auth chains.

**Check:** dependency-cruiser blocks bare `fetch()` to internal service URLs without going through the auth-injecting client.

## IR5 — Observability propagation

- All inbound requests carry W3C `traceparent` header (handled by OpenTelemetry SDK auto-instrumentation).
- All outbound calls propagate trace context.
- Span attributes: `service.name`, `service.version`, `peer.service`, `http.route`, `db.statement` (sanitized).
- Errors set span status with structured `cause`.

**Check:** AST grep for direct fetch/HTTP calls without going through the instrumented client.

## IR6 — Resilience

- All HTTP clients have `timeout` (no infinite waits). Default: 5s for sync, 30s for async.
- Retries with exponential backoff for transient errors only (5xx, network). Max 3 retries.
- No retries on 4xx — they are not transient.
- Circuit breaker on critical downstream paths (`opossum` library or equivalent).
- Bulkhead pattern: separate pools for critical vs non-critical downstream.

**Check:** project-specific probe checking that all `fetch()` calls have `signal: AbortSignal.timeout(...)` or are wrapped in a client that adds it.

---

## How to apply in a multi-service repo

This file is shared across all services. Recommended setup:

### Option A: Symlink

```bash
# In each service repo
mkdir -p .ai-factory/rules
ln -s ../../shared-rules/integration-rules.md \
      .ai-factory/rules/integration-rules.md
```

### Option B: Git submodule

```bash
git submodule add <shared-rules-repo> .ai-factory/shared
ln -s shared/integration-rules.md .ai-factory/rules/integration-rules.md
```

### Option C: Direct copy + sync check

```bash
# In each service: copy shared rules
cp shared-rules/integration-rules.md .ai-factory/rules/

# CI check: the file is identical to the source
diff .ai-factory/rules/integration-rules.md \
     <(curl -s https://raw.githubusercontent.com/<org>/<shared-rules-repo>/main/integration-rules.md) \
  || { echo "integration-rules.md drifted from source"; exit 1; }
```

## Service-specific extensions

Each service can add IR7+ rules in its own `.ai-factory/rules/integration-extensions.md`. Don't modify this shared file with service-specific rules — it should be identical across the system.

## Related

- `.ai-factory/RULES.md` — base R1–R11 (apply to single service)
- `.ai-factory/RULES.react-next.md` — UI-specific R12–R20
