import { ApiRequestMethod } from "../common/ApiClient";
import { ApiName, DsiInternalApiClient } from "./DsiInternalApiClient"

export type userOrganisationRecord = {
  organisation: {
    id: string,
    name: string,
    LegalName: string | null,
    category: {
      id: string,
      name: string,
    },
    type?: {
      id: string,
      name: string,
    },
    urn: string | null,
    uid: string | null,
    upin: string | null,
    ukprn: string | null,
    establishmentNumber: string | null,
    status?: {
      id: number,
      name: string,
    },
    closedOn: string | null,
    address: string | null,
    telephone: string | null,
    region?: {
      id: string,
      name: string,
    },
    localAuthority?: {
      id: string,
      name: string,
      code: string,
    },
    phaseOfEducation?: {
      id: number,
      name: string,
    },
    statutoryLowAge: number | null,
    statutoryHighAge: number | null,
    legacyId: string | null,
    companyRegistrationNumber: string | null,
    SourceSystem: string | null,
    providerTypeName: string | null,
    ProviderTypeCode: number | null,
    GIASProviderType: string | null,
    PIMSProviderType: string | null,
    PIMSProviderTypeCode: number | null,
    PIMSStatusName: string | null,
    pimsStatus: number | null,
    GIASStatusName: string | null,
    GIASStatus: number | null,
    MasterProviderStatusName: string | null,
    MasterProviderStatusCode: number | null,
    OpenedOn: string | null,
    DistrictAdministrativeName: string | null,
    DistrictAdministrativeCode: string | null,
    DistrictAdministrative_code: string | null,
    IsOnAPAR: "YES" | "NO" | null,
  } | null,
  role: {
    id: number,
    name: string,
  },
  approvers: string[],
  endUsers: string[],
  numericIdentifier?: string,
  textIdentifier?: string,
};

export type invitationOrganisationRecord = {
  invitationId: string,
  organisation: {
    id: string,
    name: string,
    urn?: string,
    uid?: string,
    ukprn?: string,
    category?: {
      id: string,
      name: string,
    },
    type?: {
      id: string,
      name: string,
    },
  },
  role: {
    id: number,
    name: string,
  },
  approvers: string[],
  services: {
      id: string,
      name: string,
      externalIdentifiers: {
        key: string,
        value: string,
      }[],
      serviceRoles: {
        id: string,
        invitation_id: string,
        organisation_id: string,
        service_id: string,
        role_id: string,
        createdAt: string,
        updatedAt: string,
        Role: {
          id: string,
          name: string,
          code: string,
          applicationId: string,
          status: number,
          numericId: string,
          parentId: string | null,
          createdAt: string,
          updatedAt: string,
        },
      }[],
  }[],
};

/**
 * Wrapper for the internal Organisations API client, turning required endpoints into functions.
 */
export class Organisations {
  private client: DsiInternalApiClient;

  /**
   * Instantiates a wrapper for the internal Organisations API client.
   *
   * @throws Error if the host URL/auth environment variables are not set.
   */
  constructor() {
    this.client = new DsiInternalApiClient(ApiName.Organisations);
  };

  /**
   * Gets all organisation links for an invitation if any exist.
   *
   * @param invitationId - The ID of the invitation to retrieve organisation links for.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns An array of {@link invitationOrganisationRecord} elements, or an empty array if none exist.
   *
   * @throws Error when the API client throws.
   */
  async getInvitationOrganisations(invitationId: string, correlationId: string): Promise<invitationOrganisationRecord[]> {
    return await this.client.request<invitationOrganisationRecord[]>(
      ApiRequestMethod.GET,
      `/invitations/v2/${invitationId}`, {
        correlationId,
    }) ?? [];
  };

  /**
   * Gets all organisation links for a user if any exist.
   *
   * @param userId - The ID of the user to retrieve organisation links for.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns An array of {@link userOrganisationRecord} elements, or an empty array if none exist.
   *
   * @throws Error when the API client throws.
   */
  async getUserOrganisations(userId: string, correlationId: string): Promise<userOrganisationRecord[]> {
    return await this.client.request<userOrganisationRecord[]>(
      ApiRequestMethod.GET,
      `/organisations/v2/associated-with-user/${userId}`, {
        correlationId,
    }) ?? [];
  };

  /**
   * Deletes an organisation link from an invitation.
   *
   * @param invitationId - The ID of the invitation to remove the organisation from.
   * @param organisationId - The ID of the organisation to be removed from the invitation.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns true if the user's organisation link was successfully deleted, false otherwise.
   *
   * @throws Error when the API client throws.
   */
  async deleteInvitationOrganisation(invitationId: string, organisationId: string, correlationId: string): Promise<boolean> {
    const response = await this.client.requestRaw(
      ApiRequestMethod.DELETE,
      `/organisations/${organisationId}/invitations/${invitationId}`, {
      correlationId,
    });
    return response.status === 204;
  };

  /**
   * Deletes an organisation link from a user.
   *
   * @param userId - The ID of the user to remove the organisation from.
   * @param organisationId - The ID of the organisation to be removed from the user.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns true if the user's organisation link was successfully deleted, false otherwise.
   *
   * @throws Error when the API client throws.
   */
  async deleteUserOrganisation(userId: string, organisationId: string, correlationId: string): Promise<boolean> {
    const response = await this.client.requestRaw(
      ApiRequestMethod.DELETE,
      `/organisations/${organisationId}/users/${userId}`, {
      correlationId,
    });
    return response.status === 204;
  };
};
