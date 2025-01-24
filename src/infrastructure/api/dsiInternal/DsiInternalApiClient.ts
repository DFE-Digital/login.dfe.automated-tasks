import { MsalApiClient } from "../common/MsalApiClient";
import { checkEnv } from "../../utils";

/**
 * Names of internal APIs currently accepted by this application.
 */
export enum ApiName {
  Access = "access",
  Directories = "directories",
  Organisations = "organisations",
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
    const apiHostUrl = process.env[`API_INTERNAL_${apiEnvName}_HOST`];

    checkEnv([
      `API_INTERNAL_${apiEnvName}_HOST`,
      "API_INTERNAL_TENANT",
      "API_INTERNAL_AUTHORITY_HOST",
      "API_INTERNAL_CLIENT_ID",
      "API_INTERNAL_CLIENT_SECRET",
      "API_INTERNAL_RESOURCE",
    ], "DSi internal API");

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
