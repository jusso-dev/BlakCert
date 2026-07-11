# Certificate lifecycle

## Issuance

```mermaid
sequenceDiagram
  participant R as Requester
  participant B as BlakCert
  participant P as Policy
  participant A as Approvers
  participant CA as CA connector
  participant D as Deployment connector
  R->>B: Profile, names, use, owner, custody, target
  B->>P: Validate proposed request
  P-->>B: Allow or required approval
  B->>A: Separation-of-duties approval
  A-->>B: Approved with evidence
  B->>CA: CSR or external-key issuance
  CA-->>B: Certificate and chain
  B->>D: Staged deployment
  D-->>B: Handshake and rollback reference
  B-->>R: Issued, deployed, validated, audited
```

## Renewal state machine

```mermaid
stateDiagram-v2
  scheduled --> queued
  queued --> awaiting_approval
  awaiting_approval --> generating_key
  generating_key --> generating_csr
  generating_csr --> requesting_issuance
  requesting_issuance --> awaiting_ca
  awaiting_ca --> issued
  issued --> deploying
  deploying --> validating
  validating --> completed
  deploying --> rolled_back
  validating --> rolled_back
  queued --> cancelled
  awaiting_approval --> cancelled
  generating_key --> failed
  requesting_issuance --> failed
  deploying --> failed
```

Every transition is idempotent, version-checked, advisory-locked per certificate, and correlated to job, approval, outbox, and audit records. Blue-green deployment validates the replacement before cutover and retains a rollback reference until post-deployment verification completes.

Revocation is always a request workflow. High-risk certificates require step-up and multiple approvers, requester/approver separation, CA confirmation, OCSP/CRL verification, deployment cleanup, replacement planning, evidence, and incident linkage.
