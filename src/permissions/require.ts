import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  groupMemberships,
  organisationMemberships,
  permissions,
  roleAssignments,
  rolePermissions,
} from "@db/schema";
import type { Permission } from "./model";

export type AuthorisationContext = {
  userId: string;
  organisationId: string;
  workspaceId?: string;
  environment?: string;
  ownerUserId?: string | null;
  tags?: string[];
  riskLevel?: string;
};

export class PermissionDeniedError extends Error {
  constructor(
    public readonly permission: Permission,
    public readonly reason: string,
  ) {
    super(`Permission denied: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

function conditionsMatch(
  conditions: {
    environments?: string[];
    tags?: string[];
    riskLevels?: string[];
    ownersOnly?: boolean;
  } | null,
  context: AuthorisationContext,
): boolean {
  if (!conditions) return true;
  if (conditions.environments?.length && !context.environment) return false;
  if (
    conditions.environments?.length &&
    !conditions.environments.includes(context.environment ?? "")
  )
    return false;
  if (conditions.riskLevels?.length && !conditions.riskLevels.includes(context.riskLevel ?? ""))
    return false;
  if (conditions.ownersOnly && context.ownerUserId !== context.userId) return false;
  if (conditions.tags?.length && !conditions.tags.some((tag) => context.tags?.includes(tag)))
    return false;
  return true;
}

export async function requirePermission(permission: Permission, context: AuthorisationContext) {
  const [membership] = await db
    .select({ state: organisationMemberships.state })
    .from(organisationMemberships)
    .where(
      and(
        eq(organisationMemberships.organisationId, context.organisationId),
        eq(organisationMemberships.userId, context.userId),
        eq(organisationMemberships.state, "active"),
      ),
    )
    .limit(1);
  if (!membership) throw new PermissionDeniedError(permission, "active membership required");

  const directAssignments = await db
    .select({ conditions: roleAssignments.conditions })
    .from(roleAssignments)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roleAssignments.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(roleAssignments.organisationId, context.organisationId),
        eq(roleAssignments.userId, context.userId),
        eq(permissions.key, permission),
        or(isNull(roleAssignments.expiresAt), gt(roleAssignments.expiresAt, new Date())),
        context.workspaceId
          ? or(
              isNull(roleAssignments.workspaceId),
              eq(roleAssignments.workspaceId, context.workspaceId),
            )
          : isNull(roleAssignments.workspaceId),
      ),
    );

  if (directAssignments.some((assignment) => conditionsMatch(assignment.conditions, context)))
    return;

  const groupAssignments = await db
    .select({ conditions: roleAssignments.conditions })
    .from(groupMemberships)
    .innerJoin(roleAssignments, eq(roleAssignments.groupId, groupMemberships.groupId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roleAssignments.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(groupMemberships.userId, context.userId),
        eq(roleAssignments.organisationId, context.organisationId),
        eq(permissions.key, permission),
        or(isNull(roleAssignments.expiresAt), gt(roleAssignments.expiresAt, new Date())),
      ),
    );
  if (groupAssignments.some((assignment) => conditionsMatch(assignment.conditions, context)))
    return;

  throw new PermissionDeniedError(permission, "no applicable role assignment");
}
