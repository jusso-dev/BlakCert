# REST API

The versioned API is rooted at `/api/v1`; the OpenAPI 3.1 document is served at `/api/v1/openapi`. Browser sessions and organisation-bound bearer API keys are supported in the first slice.

Collections use opaque cursors and return `{ data, pagination }`. Errors use RFC 9457 `application/problem+json`. Clients should send `X-Request-ID`, `X-Correlation-ID`, and `Idempotency-Key` on mutating operations. Responses return request/correlation IDs and use UTC RFC 3339 timestamps.

API keys are shown once, HMAC-hashed at rest, scoped, expiring, revocable, rate-limited, and optionally constrained by IP, origin, and environment. Tenant identity comes from the authenticated key or server-verified browser membership, never a free-form request field.
