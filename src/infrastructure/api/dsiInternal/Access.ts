import { ApiRequestMethod } from "../common/ApiClient";
import { ApiName, DsiInternalApiClient } from "./DsiInternalApiClient";

type serviceRecord = {
  serviceId: string;
  organisationId: string;
  roles: {
    id: string;
    invitation_id: string;
    organisation_id: string;
    service_id: string;
    role_id: string;
    createdAt: string;
    updatedAt: string;
    Role: {
      id: string;
      name: string;
      code: string;
      numericId: string;
      status: {
        id: number;
      };
    };
  }[];
  identifiers: {
    key: string;
    value: string;
  }[];
  accessGrantedOn: string;
};

export type invitationServiceRecord = {
  invitationId: string;
} & serviceRecord;

export type userServiceRecord = {
  userId: string;
} & serviceRecord;

/**
 * Wrapper for the internal Access API client, turning required endpoints into functions.
 */
export class Access {
  private client: DsiInternalApiClient;

  /**
   * Instantiates a wrapper for the internal Access API client.
   *
   * @throws Error if the host URL/auth environment variables are not set.
   */
  constructor() {
    this.client = new DsiInternalApiClient(ApiName.Access);
  }

  /**
   * Gets all service links for an invitation if any exist.
   *
   * @param invitationId - The ID of the invitation to retrieve service links for.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns An array of {@link invitationServiceRecord} elements, or an empty array if none exist.
   */
  async getInvitationServices(
    invitationId: string,
    correlationId: string,
  ): Promise<invitationServiceRecord[]> {
    return (
      (await this.client.request<invitationServiceRecord[]>(
        ApiRequestMethod.GET,
        `/invitations/${invitationId}/services`,
        {
          correlationId,
        },
      )) ?? []
    );
  }

  /**
   * Gets all service links for a user if any exist.
   *
   * @param userId - The ID of the user to retrieve service links for.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns An array of {@link userServiceRecord} elements, or an empty array if none exist.
   */
  async getUserServices(
    userId: string,
    correlationId: string,
  ): Promise<userServiceRecord[]> {
    return (
      (await this.client.request<userServiceRecord[]>(
        ApiRequestMethod.GET,
        `/users/${userId}/services`,
        {
          correlationId,
        },
      )) ?? []
    );
  }

  /**
   * Deletes a service link from an invitation in an organisation.
   *
   * @param invitationId - The ID of the invitation to remove the service from.
   * @param serviceId - The ID of the service to be removed from the invitation.
   * @param organisationId - The ID of the organisation the invitation has the service in.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns true if the invitation's service link was successfully deleted, false otherwise.
   */
  async deleteInvitationService(
    invitationId: string,
    serviceId: string,
    organisationId: string,
    correlationId: string,
  ): Promise<boolean> {
    const response = await this.client.requestRaw(
      ApiRequestMethod.DELETE,
      `/invitations/${invitationId}/services/${serviceId}/organisations/${organisationId}`,
      {
        correlationId,
      },
    );
    return response.status === 204;
  }

  /**
   * Deletes a service link from a user in an organisation.
   *
   * @param userId - The ID of the user to remove the service from.
   * @param serviceId - The ID of the service to be removed from the user.
   * @param organisationId - The ID of the organisation the user has the service in.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns true if the user's service link was successfully deleted, false otherwise.
   */
  async deleteUserService(
    userId: string,
    serviceId: string,
    organisationId: string,
    correlationId: string,
  ): Promise<boolean> {
    const response = await this.client.requestRaw(
      ApiRequestMethod.DELETE,
      `/users/${userId}/services/${serviceId}/organisations/${organisationId}`,
      {
        correlationId,
      },
    );
    return response.status === 204;
  }
}
