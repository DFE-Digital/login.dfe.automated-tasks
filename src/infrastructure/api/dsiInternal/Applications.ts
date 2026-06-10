import { ApiRequestMethod } from "../common/ApiClient";
import { ApiName, DsiInternalApiClient } from "./DsiInternalApiClient";

export type serviceRecord = {
  id: string;
  name: string;
};

/**
 * Wrapper for the internal Applications API client, turning required endpoints into functions.
 */
export class Applications {
  private client: DsiInternalApiClient;

  /**
   * Instantiates a wrapper for the internal Applications API client.
   *
   * @throws Error if the host URL/auth environment variables are not set.
   */
  constructor() {
    this.client = new DsiInternalApiClient(ApiName.Applications);
  }

  /**
   * Gets a service by its ID.
   *
   * @param serviceId - The ID of the service to retrieve.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns A {@link serviceRecord} if found, or null if not.
   */
  async getServiceById(
    serviceId: string,
    correlationId: string,
  ): Promise<serviceRecord | null> {
    return this.client.request<serviceRecord>(
      ApiRequestMethod.GET,
      `/services/${serviceId}`,
      { correlationId },
    );
  }
}
