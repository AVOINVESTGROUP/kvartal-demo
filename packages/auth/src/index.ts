import type { OfficeRole, OrganizationRole, PlatformRole } from "@kvartal/domain";

export type RequestAuthContext = {
  uid: string;
  email?: string;
  platformRoles: PlatformRole[];
  organizationMemberships: Array<{
    organizationId: string;
    roles: OrganizationRole[];
    active?: boolean;
  }>;
  officeMemberships: Array<{
    organizationId: string;
    officeId: string;
    roles: OfficeRole[];
    active?: boolean;
  }>;
  activeOrganizationId?: string;
  activeOfficeId?: string;
};

export const hasPlatformRole = (context: RequestAuthContext, roles: PlatformRole[]) =>
  roles.some((role) => context.platformRoles.includes(role));

export const hasActiveOrganizationRole = (context: RequestAuthContext, roles: OrganizationRole[]) =>
  context.activeOrganizationId !== undefined &&
  context.organizationMemberships.some(
    (membership) =>
      membership.organizationId === context.activeOrganizationId &&
      roles.some((role) => membership.roles.includes(role)),
  );

export const hasActiveOfficeRole = (context: RequestAuthContext, roles: OfficeRole[]) =>
  context.activeOrganizationId !== undefined &&
  context.activeOfficeId !== undefined &&
  context.officeMemberships.some(
    (membership) =>
      membership.organizationId === context.activeOrganizationId &&
      membership.officeId === context.activeOfficeId &&
      roles.some((role) => membership.roles.includes(role)),
  );

export type InformationRightsScope = {
  ownerOrganizationId: string;
  ownerOfficeId: string;
  visibility: "private" | "office_network" | "public";
  publicationStatus?: "draft" | "published" | "archived";
};

export type AccessDecision = {
  allowed: boolean;
  reason:
    | "platform_owner_audited_access"
    | "same_office_information_owner"
    | "same_organization_information_owner"
    | "public_showcase"
    | "denied";
  auditRequired: boolean;
};

export const canAccessOwnedInformation = (
  context: RequestAuthContext,
  scope: InformationRightsScope,
): AccessDecision => {
  if (hasPlatformRole(context, ["platform_owner"])) {
    return { allowed: true, reason: "platform_owner_audited_access", auditRequired: true };
  }

  if (
    context.officeMemberships.some(
      (membership) =>
        membership.active !== false &&
        membership.organizationId === scope.ownerOrganizationId &&
        membership.officeId === scope.ownerOfficeId,
    )
  ) {
    return { allowed: true, reason: "same_office_information_owner", auditRequired: false };
  }

  if (
    context.organizationMemberships.some(
      (membership) => membership.active !== false && membership.organizationId === scope.ownerOrganizationId,
    )
  ) {
    return { allowed: true, reason: "same_organization_information_owner", auditRequired: false };
  }

  if (scope.visibility === "public" && scope.publicationStatus === "published") {
    return { allowed: true, reason: "public_showcase", auditRequired: false };
  }

  return { allowed: false, reason: "denied", auditRequired: false };
};

export const canExposeOnPublicShowcase = (scope: InformationRightsScope) =>
  scope.visibility === "public" && scope.publicationStatus === "published";
