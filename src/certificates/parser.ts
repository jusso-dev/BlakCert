import { X509Certificate } from "node:crypto";
import { z } from "zod";
import type { InferInsertModel } from "drizzle-orm";
import type { certificates } from "@db/schema";
import { assertNoPrivateMaterial } from "@/security/redaction";

const PEM_PATTERN = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

export const importCertificateInput = z.object({
  pem: z.string().min(64).max(1_000_000),
  environment: z.enum(["development", "test", "staging", "production", "other"]),
  ownerUserId: z.string().uuid().nullable().optional(),
  ownerTeam: z.string().trim().max(120).optional(),
  businessService: z.string().trim().max(160).optional(),
  application: z.string().trim().max(160).optional(),
  managedStatus: z.enum(["managed", "unmanaged", "externally_managed"]).default("unmanaged"),
  source: z.string().trim().min(2).max(80).default("manual_import"),
});

export type ParsedCertificate = {
  fingerprintSha256: string;
  serialNumber: string;
  certificateType: InferInsertModel<typeof certificates>["certificateType"];
  subjectDn: string;
  commonName: string | null;
  issuerDn: string;
  notBefore: Date;
  notAfter: Date;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeySize: number | null;
  ellipticCurve: string | null;
  keyUsages: string[];
  extendedKeyUsages: string[];
  authorityKeyIdentifier: string | null;
  subjectKeyIdentifier: string | null;
  pem: string;
  names: Array<{ type: "dns" | "ip" | "email" | "uri" | "other"; value: string }>;
  chain: Array<{
    depth: number;
    subjectDn: string;
    issuerDn: string;
    fingerprintSha256: string;
    pem: string;
    trusted: boolean;
    validationError: string | null;
  }>;
  trustChainState: "valid" | "invalid" | "incomplete" | "self_signed";
};

function dnValue(dn: string, field: string): string | null {
  const match = dn.match(new RegExp(`(?:^|\\n|,)${field}=([^,\\n]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}

function parseNames(subjectAltName: string | undefined, commonName: string | null) {
  const names: ParsedCertificate["names"] = [];
  if (subjectAltName) {
    for (const entry of subjectAltName.split(/,\s*/)) {
      const separator = entry.indexOf(":");
      if (separator < 0) continue;
      const label = entry.slice(0, separator).toLowerCase();
      const value = entry
        .slice(separator + 1)
        .replace(/^"|"$/g, "")
        .trim();
      const type =
        label === "dns"
          ? "dns"
          : label === "ip address"
            ? "ip"
            : label === "email"
              ? "email"
              : label === "uri"
                ? "uri"
                : "other";
      if (value) names.push({ type, value });
    }
  }
  if (commonName && !names.some((name) => name.value.toLowerCase() === commonName.toLowerCase())) {
    names.push({ type: "dns", value: commonName });
  }
  return names;
}

function keyDetails(certificate: X509Certificate) {
  const key = certificate.publicKey;
  const details = key.asymmetricKeyDetails;
  return {
    algorithm: key.asymmetricKeyType ?? "unknown",
    size:
      details && "modulusLength" in details && typeof details.modulusLength === "number"
        ? details.modulusLength
        : null,
    curve:
      details && "namedCurve" in details && typeof details.namedCurve === "string"
        ? details.namedCurve
        : null,
  };
}

function inferType(certificate: X509Certificate): ParsedCertificate["certificateType"] {
  if (certificate.ca)
    return certificate.subject === certificate.issuer ? "root_ca" : "intermediate_ca";
  const usages = certificate.keyUsage ?? [];
  if (usages.some((usage) => /code signing/i.test(usage))) return "code_signing";
  if (usages.some((usage) => /email protection/i.test(usage))) return "smime";
  if (usages.some((usage) => /client auth/i.test(usage))) return "tls_client";
  return "tls_server";
}

export function parseCertificateBundle(input: string): ParsedCertificate {
  assertNoPrivateMaterial(input);
  const blocks = input.match(PEM_PATTERN);
  if (!blocks?.length) throw new Error("No PEM certificate block was found");
  if (blocks.length > 20) throw new Error("Certificate bundle exceeds the 20-certificate limit");

  let parsed: X509Certificate[];
  try {
    parsed = blocks.map((block) => new X509Certificate(block));
  } catch {
    throw new Error("The PEM certificate bundle is malformed");
  }
  const leaf = parsed[0];
  if (!leaf) throw new Error("Certificate bundle is empty");
  const commonName = dnValue(leaf.subject, "CN");
  const key = keyDetails(leaf);
  let trustChainState: ParsedCertificate["trustChainState"] = "incomplete";

  const chain = parsed.map((certificate, index) => {
    const issuer = parsed[index + 1];
    let trusted = false;
    let validationError: string | null = null;
    if (issuer) {
      trusted = certificate.checkIssued(issuer) && certificate.verify(issuer.publicKey);
      if (!trusted) validationError = "Issuer name or signature verification failed";
    } else if (certificate.subject === certificate.issuer) {
      trusted = certificate.verify(certificate.publicKey);
      if (!trusted) validationError = "Self-signed root signature verification failed";
    } else {
      validationError = "Issuer certificate not included";
    }
    return {
      depth: index,
      subjectDn: certificate.subject,
      issuerDn: certificate.issuer,
      fingerprintSha256: certificate.fingerprint256.replaceAll(":", "").toLowerCase(),
      pem: blocks[index] ?? certificate.toString(),
      trusted,
      validationError,
    };
  });

  if (chain.some((entry) => entry.validationError && entry.depth < chain.length - 1)) {
    trustChainState = "invalid";
  } else if (parsed.length === 1 && leaf.subject === leaf.issuer && chain[0]?.trusted) {
    trustChainState = "self_signed";
  } else if (chain.every((entry) => entry.trusted)) {
    trustChainState = "valid";
  }

  return {
    fingerprintSha256: leaf.fingerprint256.replaceAll(":", "").toLowerCase(),
    serialNumber: leaf.serialNumber.toLowerCase(),
    certificateType: inferType(leaf),
    subjectDn: leaf.subject,
    commonName,
    issuerDn: leaf.issuer,
    notBefore: new Date(leaf.validFrom),
    notAfter: new Date(leaf.validTo),
    signatureAlgorithm: leaf.signatureAlgorithm ?? "unknown",
    publicKeyAlgorithm: key.algorithm,
    publicKeySize: key.size,
    ellipticCurve: key.curve,
    keyUsages: leaf.keyUsage ?? [],
    extendedKeyUsages: leaf.keyUsage ?? [],
    authorityKeyIdentifier: null,
    subjectKeyIdentifier: null,
    pem: blocks[0] ?? leaf.toString(),
    names: parseNames(leaf.subjectAltName, commonName),
    chain,
    trustChainState,
  };
}
