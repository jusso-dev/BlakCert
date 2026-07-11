const SECRET_KEYS = /password|secret|token|private.?key|recovery.?code|authorization|cookie/i;

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        SECRET_KEYS.test(key) ? "[REDACTED]" : redactSecrets(child),
      ]),
    );
  }
  return value;
}

export function assertNoPrivateMaterial(value: unknown): void {
  const serialized = JSON.stringify(value);
  if (/BEGIN (?:ENCRYPTED )?PRIVATE KEY|BEGIN RSA PRIVATE KEY/i.test(serialized)) {
    throw new Error("Private key material is forbidden in this channel");
  }
}
