import { z } from "zod";

const certificateCursor = z.object({ notAfter: z.string().datetime(), id: z.string().uuid() });

export function encodeCursor(value: { notAfter: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ notAfter: value.notAfter.toISOString(), id: value.id }),
  ).toString("base64url");
}

export function decodeCertificateCursor(value: string | null) {
  if (!value) return undefined;
  try {
    const parsed = certificateCursor.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return { notAfter: new Date(parsed.notAfter), id: parsed.id };
  } catch {
    throw new Error("Invalid pagination cursor");
  }
}
