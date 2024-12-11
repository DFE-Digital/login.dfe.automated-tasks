import { ApiRequestMethod } from "../common/ApiClient";
import { ApiName, DsiInternalApiClient } from "./DsiInternalApiClient"

/**
 * Wrapper for the internal Directories API client, turning required endpoints into functions.
 */
export class Directories {
  private client: DsiInternalApiClient;

  /**
   * Instantiates a wrapper for the internal Directories API client.
   */
  constructor() {
    this.client = new DsiInternalApiClient(ApiName.Directories);
  };

  /**
   * Deactivates a DSi user account.
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
};
