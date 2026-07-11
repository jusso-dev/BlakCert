# Agent safety model

Agents are principals with explicit profiles, tool allowlists, permission scopes, time and step limits, tool-call limits, affected-resource limits, rate limits, dry-run defaults, and immutable run/tool records.

```mermaid
flowchart TD
  Goal[Human or service goal] --> Label[Label external content untrusted]
  Label --> Plan[Structured plan]
  Plan --> Limits{Within profile limits?}
  Limits -- No --> Stop[Reject and audit]
  Limits -- Yes --> Policy[Evaluate permission and policy]
  Policy -- Deny --> Stop
  Policy -- Approval --> Approval[Human approval checkpoint]
  Approval --> Tool[Schema-validated tool]
  Policy -- Allow --> Tool
  Tool --> Domain[Authorised domain service]
  Domain --> Verify[Post-action verification]
  Verify --> Audit[Immutable run and tool audit]
```

Certificate fields, tickets, connector responses, imported metadata, and discovered text remain data. They cannot redefine instructions or tools. Models never receive private keys or connector secrets. Mutating tools default to dry-run and return a human-readable impact summary. Sensitive and bulk actions require approval regardless of model confidence.
