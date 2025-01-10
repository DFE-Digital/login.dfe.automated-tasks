import { ApiRequestMethod } from "../common/ApiClient";
import { ApiName, DsiInternalApiClient } from "./DsiInternalApiClient"

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
  };

  /**
   * Deletes a service link from an invitation in an organisation.
   *
   * @param invitationId - The ID of the invitation to remove the service from.
   * @param serviceId - The ID of the service to be removed from the invitation.
   * @param organisationId - The ID of the organisation the invitation has the service in.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns true if the invitation's service link was successfully deleted, false otherwise.
   *
   * @throws Error when the API client throws.
   */
  async deleteInvitationService(invitationId: string, serviceId: string, organisationId: string, correlationId: string): Promise<boolean> {
    const response = await this.client.requestRaw(
      ApiRequestMethod.DELETE,
      `/invitations/${invitationId}/services/${serviceId}/organisations/${organisationId}`, {
      correlationId,
    });
    return response.status === 204;
  };

  /**
   * Deletes a service link from a user in an organisation.
   *
   * @param userId - The ID of the user to remove the service from.
   * @param serviceId - The ID of the service to be removed from the user.
   * @param organisationId - The ID of the organisation the user has the service in.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns true if the user's service link was successfully deleted, false otherwise.
   *
   * @throws Error when the API client throws.
   */
  async deleteUserService(userId: string, serviceId: string, organisationId: string, correlationId: string): Promise<boolean> {
    const response = await this.client.requestRaw(
      ApiRequestMethod.DELETE,
      `/users/${userId}/services/${serviceId}/organisations/${organisationId}`, {
      correlationId,
    });
    return response.status === 204;
  };
};
