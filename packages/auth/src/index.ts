import type { OfficeRole, OrganizationRole, PlatformRole } from "@kvartal/domain";

export type RequestAuthContext = {
  uid: string;
  email?: string;
  platformRoles: PlatformRole[];
  organizationMemberships: Array<{
    organizationId: string;
    roles: OrganizationRole[];
  }>;
  officeMemberships: Array<{
    organizationId: string;
    officeId: string;
    roles: OfficeRole[];
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
