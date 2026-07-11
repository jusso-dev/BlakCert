import { z } from "zod";

export const certificatePolicyDefinition = z.object({
  outcome: z.enum(["warn", "deny", "require_approval", "require_remediation", "require_exception"]),
  approvedIssuerPatterns: z.array(z.string().min(1)).optional(),
  approvedSignatureAlgorithms: z.array(z.string().min(1)).optional(),
  minimumRsaKeySize: z.number().int().min(2048).optional(),
  maximumValidityDays: z.number().int().min(1).optional(),
  allowedDnsSuffixes: z.array(z.string().startsWith(".")).optional(),
  allowWildcards: z.boolean().optional(),
  requireOwner: z.boolean().optional(),
  requireCertificateTransparency: z.boolean().optional(),
  requireValidTrustChain: z.boolean().optional(),
  allowedCustodyModes: z.array(z.string()).optional(),
  requiredRenewalLeadDays: z.number().int().min(1).optional(),
});

export type CertificatePolicyDefinition = z.infer<typeof certificatePolicyDefinition>;
export type PolicyCertificate = {
  issuerDn: string;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeySize: number | null;
  notBefore: Date;
  notAfter: Date;
  dnsNames: string[];
  ownerUserId: string | null;
  certificateTransparencyPresent: boolean | null;
  trustChainState: string;
  privateKeyCustody: string;
  renewalLeadDays: number | null;
};

type Explanation = { rule: string; result: boolean; evidence: string };

export function evaluateCertificatePolicy(
  unknownDefinition: unknown,
  certificate: PolicyCertificate,
) {
  const definition = certificatePolicyDefinition.parse(unknownDefinition);
  const explanation: Explanation[] = [];
  const rule = (name: string, result: boolean, evidence: string) => {
    explanation.push({ rule: name, result, evidence });
  };

  if (definition.approvedIssuerPatterns) {
    rule(
      "approved_issuer",
      definition.approvedIssuerPatterns.some((pattern) =>
        certificate.issuerDn.toLowerCase().includes(pattern.toLowerCase()),
      ),
      certificate.issuerDn,
    );
  }
  if (definition.approvedSignatureAlgorithms) {
    rule(
      "approved_signature_algorithm",
      definition.approvedSignatureAlgorithms.some(
        (algorithm) => algorithm.toLowerCase() === certificate.signatureAlgorithm.toLowerCase(),
      ),
      certificate.signatureAlgorithm,
    );
  }
  if (definition.minimumRsaKeySize && certificate.publicKeyAlgorithm.toLowerCase() === "rsa") {
    rule(
      "minimum_rsa_key_size",
      (certificate.publicKeySize ?? 0) >= definition.minimumRsaKeySize,
      `Observed ${certificate.publicKeySize ?? "unknown"} bits; minimum ${definition.minimumRsaKeySize}`,
    );
  }
  if (definition.maximumValidityDays) {
    const validityDays = Math.ceil(
      (certificate.notAfter.getTime() - certificate.notBefore.getTime()) / 86_400_000,
    );
    rule(
      "maximum_validity",
      validityDays <= definition.maximumValidityDays,
      `Observed ${validityDays} days; maximum ${definition.maximumValidityDays}`,
    );
  }
  if (definition.allowedDnsSuffixes) {
    const disallowed = certificate.dnsNames.filter(
      (name) =>
        !definition.allowedDnsSuffixes?.some(
          (suffix) =>
            name.toLowerCase().endsWith(suffix.toLowerCase()) ||
            name.toLowerCase() === suffix.slice(1).toLowerCase(),
        ),
    );
    rule(
      "allowed_dns_suffixes",
      disallowed.length === 0,
      disallowed.length
        ? `Disallowed names: ${disallowed.join(", ")}`
        : "All DNS names are allowed",
    );
  }
  if (definition.allowWildcards === false) {
    const wildcards = certificate.dnsNames.filter((name) => name.startsWith("*."));
    rule(
      "wildcard_restriction",
      wildcards.length === 0,
      wildcards.length ? `Wildcard names: ${wildcards.join(", ")}` : "No wildcard names",
    );
  }
  if (definition.requireOwner)
    rule(
      "required_owner",
      Boolean(certificate.ownerUserId),
      certificate.ownerUserId ? "Owner assigned" : "Owner is missing",
    );
  if (definition.requireCertificateTransparency)
    rule(
      "certificate_transparency",
      certificate.certificateTransparencyPresent === true,
      `CT presence is ${certificate.certificateTransparencyPresent ?? "unknown"}`,
    );
  if (definition.requireValidTrustChain)
    rule(
      "valid_trust_chain",
      certificate.trustChainState === "valid",
      `Trust chain state is ${certificate.trustChainState}`,
    );
  if (definition.allowedCustodyModes)
    rule(
      "allowed_custody",
      definition.allowedCustodyModes.includes(certificate.privateKeyCustody),
      `Custody mode is ${certificate.privateKeyCustody}`,
    );
  if (definition.requiredRenewalLeadDays)
    rule(
      "renewal_lead_time",
      (certificate.renewalLeadDays ?? 0) >= definition.requiredRenewalLeadDays,
      `Configured ${certificate.renewalLeadDays ?? 0} days; required ${definition.requiredRenewalLeadDays}`,
    );

  const violations = explanation.filter((item) => !item.result);
  return {
    outcome: violations.length ? definition.outcome : ("allow" as const),
    compliant: violations.length === 0,
    explanation,
    violations,
  };
}
