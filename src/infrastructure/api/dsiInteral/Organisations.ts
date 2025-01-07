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
};
