import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { db } from "@/db/client";
import {
  organisationMemberships,
  organisations,
  permissions,
  roleAssignments,
  rolePermissions,
  roles,
} from "@db/schema";
import { BUILT_IN_ROLES, PERMISSIONS } from "@/permissions/model";
import { recordAudit } from "@/audit/service";

export const createOrganisationInput = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

function toSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return slug || `organisation-${uuidv7().slice(0, 8)}`;
}

export async function createOrganisation(userId: string, unknownInput: unknown) {
  const input = createOrganisationInput.parse(unknownInput);
  const organisationId = uuidv7();
  const correlationId = uuidv7();
  const slug = input.slug ?? `${toSlug(input.name)}-${organisationId.slice(-8)}`;

  return db.transaction(async (tx) => {
    await tx.insert(organisations).values({
      id: organisationId,
      name: input.name,
      slug,
      securityPolicy: {
        mfaMode: "optional",
        mfaGracePeriodDays: 0,
        requireStepUpFor: [
          "certificate:revoke",
          "private_key:export",
          "authority:manage",
          "sso:manage",
        ],
        allowPrivateKeyExport: false,
        sessionHours: 8,
      },
    });
    await tx.insert(organisationMemberships).values({
      organisationId,
      userId,
      state: "active",
      joinedAt: new Date(),
    });

    const permissionRows = await tx
      .insert(permissions)
      .values(
        Object.values(PERMISSIONS).map((key) => ({
          id: uuidv7(),
          key,
          description: key.replaceAll("_", " ").replaceAll(":", " "),
          sensitive: new Set<string>([
            PERMISSIONS.privateKeyExport,
            PERMISSIONS.certificateRevoke,
            PERMISSIONS.ssoManage,
            PERMISSIONS.authorityManage,
          ]).has(key),
        })),
      )
      .onConflictDoNothing({ target: permissions.key })
      .returning();
    const allPermissions = permissionRows.length
      ? permissionRows
      : await tx.select().from(permissions);

    for (const [key, rolePermissionKeys] of Object.entries(BUILT_IN_ROLES)) {
      const [role] = await tx
        .insert(roles)
        .values({
          id: uuidv7(),
          organisationId,
          key,
          name: key
            .split("_")
            .map((part) => part[0]?.toUpperCase() + part.slice(1))
            .join(" "),
          builtIn: true,
        })
        .returning();
      if (!role) throw new Error("Role creation failed");
      const matching = allPermissions.filter((permission) =>
        rolePermissionKeys.includes(permission.key as never),
      );
      if (matching.length) {
        await tx
          .insert(rolePermissions)
          .values(matching.map((permission) => ({ roleId: role.id, permissionId: permission.id })));
      }
      if (key === "organisation_owner") {
        await tx.insert(roleAssignments).values({
          id: uuidv7(),
          organisationId,
          roleId: role.id,
          userId,
          grantedBy: userId,
        });
      }
    }

    const auditEventId = await recordAudit(tx, {
      organisationId,
      actorType: "user",
      actorId: userId,
      action: "organisation.created",
      resourceType: "organisation",
      resourceId: organisationId,
      outcome: "success",
      correlationId,
      after: { id: organisationId, name: input.name, slug },
    });
    return { id: organisationId, name: input.name, slug, correlationId, auditEventId };
  });
}
