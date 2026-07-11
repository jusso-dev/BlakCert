"use server";

import { redirect } from "next/navigation";
import { v7 as uuidv7 } from "uuid";
import { requireSession } from "@/auth/session";
import { resolveActiveOrganisation } from "@/auth/active-organisation";
import { importCertificate } from "@/certificates/service";

export type ImportState = { error?: string };

export async function importCertificateAction(
  _state: ImportState,
  formData: FormData,
): Promise<ImportState> {
  try {
    const session = await requireSession();
    const organisation = await resolveActiveOrganisation(session.user.id);
    if (!organisation) return { error: "An active organisation is required" };
    const result = await importCertificate(
      {
        userId: session.user.id,
        organisationId: organisation.id,
        requestId: uuidv7(),
        correlationId: uuidv7(),
      },
      {
        pem: formData.get("pem"),
        environment: formData.get("environment"),
        ownerUserId: formData.get("ownerUserId") || session.user.id,
        ownerTeam: formData.get("ownerTeam") || undefined,
        businessService: formData.get("businessService") || undefined,
        application: formData.get("application") || undefined,
        managedStatus: formData.get("managedStatus"),
      },
    );
    redirect(`/certificates/${result.certificate.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "Certificate import failed" };
  }
}
