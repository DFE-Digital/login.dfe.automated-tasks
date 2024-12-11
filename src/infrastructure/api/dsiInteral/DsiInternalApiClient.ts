import assert from "assert";
import { MsalApiClient } from "../common/MsalApiClient";

/**
 * Names of internal APIs currently accepted by this application.
 */
export enum ApiName {
  Directories = "directories",
};

/**
 * An API client for the internal DSi APIs.
 */
export class DsiInternalApiClient extends MsalApiClient {
  /**
   * Instantiates a client for connecting to an internal DSi API using preset app settings.
   *
   * @param api - The name of the API to connect to ({@link ApiName}).
   *
   * @throws Error if the host URL/auth environment variables are not set.
   */
  constructor(api: ApiName) {
    const apiEnvName = api.toUpperCase();

    [
      `${apiEnvName}_HOST`,
      "TENANT",
      "AUTHORITY_HOST",
      "CLIENT_ID",
      "CLIENT_SECRET",
      "RESOURCE",
    ].forEach((requiredOption) => {
      const envName = `API_INTERNAL_${requiredOption}`;
      const envValue = process.env[envName] ?? "";
      assert(envValue.length > 0, `${envName} is missing, cannot create API connection!`);
    });

    const apiHostUrl = process.env[`API_INTERNAL_${apiEnvName}_HOST`];

    super({
      baseUri: (apiHostUrl.toLowerCase().startsWith("http")) ? apiHostUrl : `https://${apiHostUrl}`,
      auth: {
        tenant: process.env.API_INTERNAL_TENANT,
        authorityHostUrl: process.env.API_INTERNAL_AUTHORITY_HOST,
        clientId: process.env.API_INTERNAL_CLIENT_ID,
        clientSecret: process.env.API_INTERNAL_CLIENT_SECRET,
        resource: process.env.API_INTERNAL_RESOURCE,
      },
    });
  };
};
