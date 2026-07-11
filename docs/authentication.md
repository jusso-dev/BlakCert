# Authentication and session administration

BlakCert uses Better Auth for email/password, verification, reset, TOTP, recovery codes, passkeys, session rotation, and administrative revocation. Passwords have a 14-character minimum and are checked against known breach data. Production requires verified email.

Users can enrol TOTP or a passkey at `/mfa`. TOTP is not enabled until a valid code is verified. Recovery codes are displayed once and encrypted/hashed by the authentication provider. Passkey challenges expire after five minutes. Session cookies are HTTP-only, SameSite Lax, secure in production, cached for five minutes, refreshed every 30 minutes, and expire after eight hours.

Organisation security policy supports optional, privileged-role, or all-user MFA. Revocation, private-key export, CA/SSO/trust changes, credential creation, role escalation, audit export, and MFA recovery require step-up authentication. Break-glass identities must be hardware-key protected, excluded from ordinary federation, monitored, and tested quarterly.

Administrators revoke sessions through Better Auth’s administrative API after checking `user:manage`. Users can enumerate and revoke their own sessions. Approximate location and device labels are advisory and never used as the sole authentication factor.
