# Enterprise SSO and SCIM

`sso_connections` models organisation-specific SAML 2.0 and OpenID Connect configuration, attribute/group mappings, JIT, test mode, enforcement, and certificate rollover. Client secrets and signing/encryption keys belong in encrypted connector-secret custody, never JSON configuration.

The safe rollout sequence is: verify an organisation domain, configure metadata in test mode, validate issuer/audience/signatures and mappings, test a non-owner account, configure a hardware-protected break-glass account, then enforce SSO. Changes require step-up and immutable audit.

Provider mapping:

- Microsoft Entra ID: enterprise application, signed SAML assertions or OIDC app, group object IDs, SCIM bearer token.
- Okta and Ping Identity: application integration, signed requests/assertions, stable group IDs, SCIM 2.0 provisioning.
- Google Workspace: custom SAML app or OIDC client, primary email mapping, controlled group mapping.
- Auth0 and Keycloak: regular web application/client, exact callback/issuer, group/role claims, signing-key rollover.

SCIM endpoints are versioned under `/api/v1/scim/v2/Users` and `/api/v1/scim/v2/Groups` in the enterprise identity phase. They use organisation-bound rotating bearer tokens, RFC 7644 filters and pagination, stable external IDs, PATCH operations, deactivation rather than destructive deletion, and audit every provisioning mutation. The schema and token custody are present; do not enable a provider until its contract tests pass.
