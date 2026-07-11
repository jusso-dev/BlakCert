import type { ParsedCertificate } from "./parser";

export type RiskResult = {
  score: number;
  level: "informational" | "low" | "medium" | "high" | "critical";
  modelVersion: "2026.1";
  reasons: Array<{ code: string; score: number; evidence: string }>;
};

export function calculateCertificateRisk(
  certificate: Pick<
    ParsedCertificate,
    | "notAfter"
    | "notBefore"
    | "signatureAlgorithm"
    | "publicKeyAlgorithm"
    | "publicKeySize"
    | "trustChainState"
    | "names"
  > & { ownerUserId?: string | null | undefined; managedStatus?: string | undefined },
  now = new Date(),
): RiskResult {
  const reasons: RiskResult["reasons"] = [];
  const daysRemaining = Math.floor((certificate.notAfter.getTime() - now.getTime()) / 86_400_000);
  const validityDays = Math.ceil(
    (certificate.notAfter.getTime() - certificate.notBefore.getTime()) / 86_400_000,
  );

  if (daysRemaining < 0)
    reasons.push({
      code: "expired",
      score: 100,
      evidence: `Expired ${Math.abs(daysRemaining)} days ago`,
    });
  else if (daysRemaining <= 7)
    reasons.push({ code: "expiry_7d", score: 85, evidence: `Expires in ${daysRemaining} days` });
  else if (daysRemaining <= 30)
    reasons.push({ code: "expiry_30d", score: 60, evidence: `Expires in ${daysRemaining} days` });
  else if (daysRemaining <= 90)
    reasons.push({ code: "expiry_90d", score: 25, evidence: `Expires in ${daysRemaining} days` });

  if (/md5|sha-?1/i.test(certificate.signatureAlgorithm)) {
    reasons.push({ code: "weak_signature", score: 70, evidence: certificate.signatureAlgorithm });
  }
  if (certificate.publicKeyAlgorithm === "rsa" && (certificate.publicKeySize ?? 0) < 2048) {
    reasons.push({
      code: "weak_key",
      score: 70,
      evidence: `RSA ${certificate.publicKeySize ?? "unknown"}-bit key`,
    });
  }
  if (certificate.trustChainState === "invalid")
    reasons.push({
      code: "invalid_chain",
      score: 80,
      evidence: "Included chain does not validate",
    });
  if (certificate.trustChainState === "incomplete")
    reasons.push({
      code: "incomplete_chain",
      score: 15,
      evidence: "Issuer chain was not included",
    });
  if (!certificate.ownerUserId)
    reasons.push({ code: "missing_owner", score: 20, evidence: "No accountable owner assigned" });
  if (certificate.managedStatus === "unmanaged")
    reasons.push({ code: "unmanaged", score: 15, evidence: "No managed renewal path" });
  if (certificate.names.some((name) => name.type === "dns" && name.value.startsWith("*."))) {
    reasons.push({
      code: "wildcard",
      score: 15,
      evidence: "Wildcard DNS name broadens certificate scope",
    });
  }
  if (validityDays > 398)
    reasons.push({
      code: "excessive_validity",
      score: 25,
      evidence: `${validityDays}-day validity`,
    });

  const score = Math.min(
    100,
    reasons.reduce((sum, reason) => sum + reason.score, 0),
  );
  const level =
    score >= 85
      ? "critical"
      : score >= 60
        ? "high"
        : score >= 35
          ? "medium"
          : score >= 15
            ? "low"
            : "informational";
  return { score, level, modelVersion: "2026.1", reasons };
}

export function daysUntil(date: Date, now = new Date()): number {
  return Math.floor((date.getTime() - now.getTime()) / 86_400_000);
}
