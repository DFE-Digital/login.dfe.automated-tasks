/* istanbul ignore file */

import {
  type invitationServiceRecord,
  type userServiceRecord,
} from "../src/infrastructure/api/dsiInternal/Access";
import {
  type invitationOrganisationRecord,
  type userOrganisationRecord,
} from "../src/infrastructure/api/dsiInternal/Organisations";
import { Invitation } from "../src/infrastructure/database/directories/Invitation";
import { User } from "../src/infrastructure/database/directories/User";

/**
 * Generates a test Invitation without a sequelize connection for testing.
 *
 * @param id - Invitation ID.
 * @param email - Invitation email address.
 * @param properties - Additional invitation properties.
 * @returns An {@link Invitation} object without a sequelize connection for testing.
 */
export function generateInvitation(
  id: string,
  email: string,
  properties: Partial<Invitation> = {},
): Invitation {
  return {
    id,
    email,
    code: properties.code ?? "",
    firstName: properties.firstName ?? "",
    lastName: properties.lastName ?? "",
    originClientId: properties.originClientId ?? null,
    originRedirectUri: properties.originRedirectUri ?? null,
    selfStarted: properties.selfStarted ?? false,
    overrideSubject: properties.overrideSubject ?? null,
    overrideBody: properties.overrideBody ?? null,
    previousUsername: properties.previousUsername ?? null,
    previousPassword: properties.previousPassword ?? null,
    previousSalt: properties.previousSalt ?? null,
    deactivated: properties.deactivated ?? false,
    reason: properties.reason ?? null,
    completed: properties.completed ?? false,
    userId: properties.userId ?? null,
    createdAt: properties.createdAt ?? new Date(),
    updatedAt: properties.updatedAt ?? new Date(),
    isMigrated: properties.isMigrated ?? false,
    isApprover: properties.isApprover ?? false,
    approverEmail: properties.approverEmail ?? null,
    orgName: properties.orgName ?? null,
    codeMetaData: properties.codeMetaData ?? null,
    callbacks: properties.callbacks ?? [],
  } as Invitation;
}

/**
 * Generates a specified amount of test Invitation objects.
 *
 * Uses "inv-INDEX" for the ID, and "test+INDEX@email" for the email address.
 *
 * @param amount - The number of test invitations to generate.
 * @param properties - Additional properties to be applied to all invitations.
 * @returns An array of {@link Invitation} objects without a sequelize connection for testing.
 */
export function generateInvitations(
  amount: number,
  properties: Partial<Invitation> = {},
): Invitation[] {
  return Array.from({ length: amount }).map((_, index) =>
    generateInvitation(`inv-${index}`, `test+${index}@email`, properties),
  );
}

/**
 * Generates a test User without a sequelize connection for testing.
 *
 * @param id - User ID.
 * @param email - User email address.
 * @param properties - Additional user properties.
 * @returns A {@link User} object without a sequelize connection for testing.
 */
export function generateUser(
  id: string,
  email: string,
  properties: Partial<User> = {},
): User {
  return {
    id,
    email,
    firstName: properties.firstName ?? "",
    lastName: properties.lastName ?? "",
    password: properties.password ?? "",
    salt: properties.salt ?? "",
    status: properties.status ?? 1,
    createdAt: properties.createdAt ?? new Date(),
    updatedAt: properties.updatedAt ?? new Date(),
    phoneNumber: properties.phoneNumber ?? null,
    lastLogin: properties.lastLogin ?? null,
    isMigrated: properties.isMigrated ?? false,
    jobTitle: properties.jobTitle ?? null,
    passwordResetRequired: properties.passwordResetRequired ?? false,
    previousLogin: properties.previousLogin ?? null,
    isEntra: properties.isEntra ?? false,
    entraId: properties.entraId ?? null,
    entraLinkedAt: properties.entraLinkedAt ?? null,
    passwordPolicies: properties.passwordPolicies ?? [],
  } as User;
}

/**
 * Generates a specified amount of test User objects.
 *
 * Uses "user-INDEX" for the ID, and "test+INDEX@email" for the email address.
 *
 * @param amount - The number of test users to generate.
 * @param properties - Additional properties to be applied to all users.
 * @returns An array of {@link User} objects without a sequelize connection for testing.
 */
export function generateUsers(
  amount: number,
  properties: Partial<User> = {},
): User[] {
  return Array.from({ length: amount }).map((_, index) =>
    generateUser(`user-${index}`, `test+${index}@email`, properties),
  );
}

/**
 * Generates a test invitationServiceRecord object for testing.
 *
 * @param invitationId - Invitation ID.
 * @param serviceId - Service ID.
 * @param orgId - Organisation ID.
 * @param properties - Additional invitation service record properties.
 * @returns An {@link invitationServiceRecord} object for testing.
 */
export function generateInvitationService(
  invitationId: string,
  serviceId: string,
  orgId: string,
  properties: Partial<invitationServiceRecord> = {},
): invitationServiceRecord {
  return {
    invitationId,
    serviceId,
    organisationId: orgId,
    roles: properties.roles ?? [],
    identifiers: properties.identifiers ?? [],
    accessGrantedOn: properties.accessGrantedOn ?? "",
  };
}

/**
 * Generates a specified amount of test invitationServiceRecord objects.
 *
 * If any IDs are specified they are applied to all objects, if not the following IDs are used:
 * - Invitation ID: "inv-INDEX"
 * - Service ID: "svc-INDEX"
 * - Org ID: "org-INDEX"
 *
 * @param amount - The number of test invitation service records to generate.
 * @param invitationId - The optional invitation ID to be applied to all records.
 * @param serviceId - The optional service ID to be applied to all records.
 * @param orgId - The optional organisation ID to be applied to all records.
 * @param properties - Additional properties to be applied to all invitation service records.
 * @returns An array of {@link invitationServiceRecord} objects for testing.
 */
export function generateInvitationServices(
  amount: number,
  invitationId?: string,
  serviceId?: string,
  orgId?: string,
  properties: Partial<invitationServiceRecord> = {},
): invitationServiceRecord[] {
  return Array.from({ length: amount }).map((_, index) =>
    generateInvitationService(
      invitationId ?? `inv-${index}`,
      serviceId ?? `svc-${index}`,
      orgId ?? `org-${index}`,
      properties,
    ),
  );
}

/**
 * Generates a test userServiceRecord object for testing.
 *
 * @param userId - User ID.
 * @param serviceId - Service ID.
 * @param orgId - Organisation ID.
 * @param properties - Additional user service record properties.
 * @returns A {@link userServiceRecord} object for testing.
 */
export function generateUserService(
  userId: string,
  serviceId: string,
  orgId: string,
  properties: Partial<userServiceRecord> = {},
): userServiceRecord {
  return {
    userId,
    serviceId,
    organisationId: orgId,
    roles: properties.roles ?? [],
    identifiers: properties.identifiers ?? [],
    accessGrantedOn: properties.accessGrantedOn ?? "",
  };
}

/**
 * Generates a specified amount of test userServiceRecord objects.
 *
 * If any IDs are specified they are applied to all objects, if not the following IDs are used:
 * - User ID: "user-INDEX"
 * - Service ID: "svc-INDEX"
 * - Org ID: "org-INDEX"
 *
 * @param amount - The number of test user service records to generate.
 * @param userId - The optional user ID to be applied to all records.
 * @param serviceId - The optional service ID to be applied to all records.
 * @param orgId - The optional organisation ID to be applied to all records.
 * @param properties - Additional properties to be applied to all user service records.
 * @returns An array of {@link userServiceRecord} objects for testing.
 */
export function generateUserServices(
  amount: number,
  userId?: string,
  serviceId?: string,
  orgId?: string,
  properties: Partial<userServiceRecord> = {},
): userServiceRecord[] {
  return Array.from({ length: amount }).map((_, index) =>
    generateUserService(
      userId ?? `user-${index}`,
      serviceId ?? `svc-${index}`,
      orgId ?? `org-${index}`,
      properties,
    ),
  );
}

/**
 * Generates a test invitationOrganisationRecord object for testing.
 *
 * @param invitationId - User ID.
 * @param orgId - Organisation ID.
 * @param organisation - Additional organisation properties.
 * @param properties - Additional invitation organisation record properties.
 * @returns An {@link invitationOrganisationRecord} object for testing.
 */
export function generateInvitationOrganisation(
  invitationId: string,
  orgId: string,
  organisation: Partial<invitationOrganisationRecord["organisation"]> = {},
  properties: Partial<invitationOrganisationRecord> = {},
): invitationOrganisationRecord {
  return {
    invitationId,
    organisation: {
      id: orgId,
      name: organisation.name ?? "",
      urn: organisation.urn,
      ukprn: organisation.ukprn,
      category: organisation.category,
      type: organisation.type,
    },
    role: properties.role ?? {
      id: 0,
      name: "End User",
    },
    approvers: properties.approvers ?? [],
    services: properties.services ?? [],
  };
}

/**
 * Generates a specified amount of test invitationOrganisationRecord objects.
 *
 * If any IDs are specified they are applied to all objects, if not the following IDs are used:
 * - Invitation ID: "inv-INDEX"
 * - Org ID: "org-INDEX"
 *
 * @param amount - The number of test invitation service records to generate.
 * @param invitationId - The optional invitation ID to be applied to all records.
 * @param orgId - The optional organisation ID to be applied to all records.
 * @param organisation - Additional organisation properties to be applied to all records.
 * @param properties - Additional properties to be applied to all invitation service records.
 * @returns An array of {@link invitationOrganisationRecord} objects for testing.
 */
export function generateInvitationOrganisations(
  amount: number,
  invitationId?: string,
  orgId?: string,
  organisation: Partial<invitationOrganisationRecord["organisation"]> = {},
  properties: Partial<invitationOrganisationRecord> = {},
): invitationOrganisationRecord[] {
  return Array.from({ length: amount }).map((_, index) =>
    generateInvitationOrganisation(
      invitationId ?? `inv-${index}`,
      orgId ?? `org-${index}`,
      organisation,
      properties,
    ),
  );
}

/**
 * Generates a test userOrganisationRecord object for testing.
 *
 * @param orgId - Organisation ID.
 * @param organisation - Additional organisation properties.
 * @param properties - Additional user organisation record properties.
 * @returns A {@link userOrganisationRecord} object for testing.
 */
export function generateUserOrganisation(
  orgId: string,
  organisation: Partial<userOrganisationRecord["organisation"]> = {},
  properties: Partial<userOrganisationRecord> = {},
): userOrganisationRecord {
  return {
    organisation: {
      id: orgId,
      name: organisation.name ?? "",
      LegalName: organisation.LegalName ?? null,
      category: organisation.category ?? {
        id: "001",
        name: "Establishment",
      },
      type: organisation.type,
      urn: organisation.urn ?? null,
      uid: organisation.uid ?? null,
      upin: organisation.upin ?? null,
      ukprn: organisation.ukprn ?? null,
      establishmentNumber: organisation.establishmentNumber ?? null,
      status: organisation.status,
      closedOn: organisation.closedOn ?? null,
      address: organisation.address ?? null,
      telephone: organisation.telephone ?? null,
      region: organisation.region,
      localAuthority: organisation.localAuthority,
      phaseOfEducation: organisation.phaseOfEducation,
      statutoryLowAge: organisation.statutoryLowAge ?? null,
      statutoryHighAge: organisation.statutoryHighAge ?? null,
      legacyId: organisation.legacyId ?? null,
      companyRegistrationNumber: organisation.companyRegistrationNumber ?? null,
      SourceSystem: organisation.SourceSystem ?? null,
      providerTypeName: organisation.providerTypeName ?? null,
      ProviderTypeCode: organisation.ProviderTypeCode ?? null,
      GIASProviderType: organisation.GIASProviderType ?? null,
      PIMSProviderType: organisation.PIMSProviderType ?? null,
      PIMSProviderTypeCode: organisation.PIMSProviderTypeCode ?? null,
      PIMSStatusName: organisation.PIMSStatusName ?? null,
      pimsStatus: organisation.pimsStatus ?? null,
      GIASStatusName: organisation.GIASStatusName ?? null,
      GIASStatus: organisation.GIASStatus ?? null,
      MasterProviderStatusName: organisation.MasterProviderStatusName ?? null,
      MasterProviderStatusCode: organisation.MasterProviderStatusCode ?? null,
      OpenedOn: organisation.OpenedOn ?? null,
      DistrictAdministrativeName:
        organisation.DistrictAdministrativeName ?? null,
      DistrictAdministrativeCode:
        organisation.DistrictAdministrativeCode ?? null,
      DistrictAdministrative_code:
        organisation.DistrictAdministrative_code ?? null,
      IsOnAPAR: organisation.IsOnAPAR ?? null,
    },
    role: properties.role ?? {
      id: 0,
      name: "End User",
    },
    approvers: properties.approvers ?? [],
    endUsers: properties.endUsers ?? [],
    numericIdentifier: properties.numericIdentifier,
    textIdentifier: properties.textIdentifier,
  };
}

/**
 * Generates a specified amount of test invitationOrganisationRecord objects.
 *
 * If the org ID is specified it is applied to all objects, if not ID "org-INDEX" used.
 *
 * @param amount - The number of test invitation service records to generate.
 * @param orgId - The optional organisation ID to be applied to all records.
 * @param organisation - Additional organisation properties to be applied to all records.
 * @param properties - Additional properties to be applied to all invitation service records.
 * @returns An array of {@link invitationOrganisationRecord} objects for testing.
 */
export function generateUserOrganisations(
  amount: number,
  orgId?: string,
  organisation: Partial<userOrganisationRecord["organisation"]> = {},
  properties: Partial<userOrganisationRecord> = {},
): userOrganisationRecord[] {
  return Array.from({ length: amount }).map((_, index) =>
    generateUserOrganisation(orgId ?? `org-${index}`, organisation, properties),
  );
}
