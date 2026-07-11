import { isIP } from "node:net";
import { z } from "zod";

const targetSchema = z.object({
  url: z.string().url().max(2048),
  allowedProtocols: z.array(z.enum(["http:", "https:"])).min(1),
  allowedPorts: z.array(z.number().int().min(1).max(65535)).min(1),
  approvedPrivateCidrs: z.array(z.string()).default([]),
});

function ipv4Number(address: string): number | null {
  if (isIP(address) !== 4) return null;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return null;
  return (
    ((parts[0] ?? 0) * 2 ** 24 +
      (parts[1] ?? 0) * 2 ** 16 +
      (parts[2] ?? 0) * 2 ** 8 +
      (parts[3] ?? 0)) >>>
    0
  );
}

function inCidr(address: string, cidr: string): boolean {
  const [network, prefixText] = cidr.split("/");
  const value = ipv4Number(address);
  const base = network ? ipv4Number(network) : null;
  const prefix = Number(prefixText);
  if (value === null || base === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32)
    return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

export function isBlockedAddress(address: string): boolean {
  if (isIP(address) === 4) {
    return [
      "0.0.0.0/8",
      "10.0.0.0/8",
      "100.64.0.0/10",
      "127.0.0.0/8",
      "169.254.0.0/16",
      "172.16.0.0/12",
      "192.0.0.0/24",
      "192.168.0.0/16",
      "198.18.0.0/15",
      "224.0.0.0/4",
      "240.0.0.0/4",
    ].some((cidr) => inCidr(address, cidr));
  }
  const normalised = address.toLowerCase();
  return (
    normalised === "::" ||
    normalised === "::1" ||
    normalised.startsWith("fe80:") ||
    normalised.startsWith("fc") ||
    normalised.startsWith("fd") ||
    normalised.startsWith("::ffff:127.") ||
    normalised.startsWith("::ffff:169.254.")
  );
}

export async function validateOutboundTarget(
  unknownInput: unknown,
  resolve: (hostname: string) => Promise<string[]>,
) {
  const input = targetSchema.parse(unknownInput);
  const url = new URL(input.url);
  if (url.username || url.password) throw new Error("Credentials in connector URLs are forbidden");
  if (!input.allowedProtocols.includes(url.protocol as "http:" | "https:"))
    throw new Error("Protocol is outside the approved scope");
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!input.allowedPorts.includes(port)) throw new Error("Port is outside the approved scope");
  const addresses = await resolve(url.hostname);
  if (!addresses.length) throw new Error("Hostname did not resolve");
  for (const address of addresses) {
    if (address === "169.254.169.254")
      throw new Error("Cloud metadata services are always blocked");
    if (
      isBlockedAddress(address) &&
      !input.approvedPrivateCidrs.some((cidr) => inCidr(address, cidr))
    ) {
      throw new Error("Resolved address is private or special-use and is not explicitly approved");
    }
  }
  return { url, addresses, port };
}
