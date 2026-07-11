# Private-key custody

Preferred modes are external HSM, cloud KMS, Vault, or agent-local custody. BlakCert stores references and attestation metadata. Encrypted application custody is an explicit opt-in using a per-key data encryption key wrapped by a versioned tenant KEK.

Private key export is disabled by default. Enabling it requires organisation policy, fine-grained permission, step-up authentication, approval, purpose, time-bounded one-time delivery, and immutable audit. Agents and MCP clients can never export or retrieve private keys.
