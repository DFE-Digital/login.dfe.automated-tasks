import { ApiRequestMethod } from "../common/ApiClient";
import { ApiName, DsiInternalApiClient } from "./DsiInternalApiClient"

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
