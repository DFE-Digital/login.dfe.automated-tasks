import { ApiRequestMethod } from "../common/ApiClient";
import { ApiName, DsiInternalApiClient } from "./DsiInternalApiClient"

/**
 * Wrapper for the internal Directories API client, turning required endpoints into functions.
 */
export class Directories {
  private client: DsiInternalApiClient;

  /**
   * Instantiates a wrapper for the internal Directories API client.
   *
   * @throws Error if the host URL/auth environment variables are not set.
   */
  constructor() {
    this.client = new DsiInternalApiClient(ApiName.Directories);
  };

  /**
   * Deactivates a user account.
   *
   * @param id - The ID of the user to be deactivated.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns true if the user was deactivated, false otherwise.
   *
   * @throws Error when the API client throws or the response body text parsing fails.
   */
  async deactivateUser(id: string, correlationId: string): Promise<boolean> {
    const response = await this.client.requestRaw(ApiRequestMethod.POST, `/users/${id}/deactivate`, {
      correlationId,
    });
    const body = await response.text();
    return body === "true";
  };

  /**
   * Deletes a user code, such as a password reset code, from a user account.
   *
   * @param id - The ID of the user to delete a code from.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns true if the user's code was successfully deleted, false otherwise.
   *
   * @throws Error when the API client throws.
   */
  async deleteUserCode(id: string, correlationId: string): Promise<boolean> {
    const response = await this.client.requestRaw(ApiRequestMethod.DELETE, `/userCodes/${id}`, {
      correlationId,
    });
    return response.status === 200;
  };
};
