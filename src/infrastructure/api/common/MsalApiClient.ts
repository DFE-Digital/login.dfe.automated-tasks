import {
  AuthenticationResult,
  ConfidentialClientApplication,
  LogLevel,
} from "@azure/msal-node";
import {
  ApiClient,
  ApiClientOptions,
  ApiRequestMethod,
  ApiRequestOptions,
} from "./ApiClient";

/**
 * Options for creating an MSAL authenticated API client.
 */
export interface MsalApiClientOptions extends ApiClientOptions {
  auth: {
    tenant: string;
    authorityHostUrl: string;
    clientId: string;
    clientSecret: string;
    resource: string;
  };
}

/**
 * Creates a MSAL confidential client application so we can retrieve a bearer token for API access.
 *
 * @param options - The auth options {@link MsalApiClientOptions} of the API client.
 * @returns The configured {@link ConfidentialClientApplication} to retrieve bearer tokens from.
 */
function createClientApplication(options: MsalApiClientOptions["auth"]) {
  return new ConfidentialClientApplication({
    auth: {
      authority: new URL(options.tenant, options.authorityHostUrl).toString(),
      clientId: options.clientId,
      clientSecret: options.clientSecret,
    },
    system: {
      loggerOptions: {
        loggerCallback(loglevel, message) {
          if (loglevel === LogLevel.Error) {
            console.error(message);
          } else {
            console.log(message);
          }
        },
        piiLoggingEnabled: false,
        logLevel:
          process.env.DEBUG?.toLowerCase() === "true"
            ? LogLevel.Info
            : LogLevel.Error,
      },
    },
  });
}

/**
 * An API client for MSAL authenticated APIs which use a client ID and secret.
 */
export class MsalApiClient extends ApiClient {
  private cca: ConfidentialClientApplication;
  private resource: string;
  private cachedToken: AuthenticationResult;

  /**
   * Instantiates a new API client capable of connecting to MSAL protected APIs.
   *
   * @param options - {@link MsalApiClientOptions} object to configure the MSAL API client.
   */
  constructor(options: MsalApiClientOptions) {
    super(options);
    this.cca = createClientApplication(options.auth);
    this.resource = options.auth.resource;
  }

  /**
   * Adds an authorization header using the MSAL client to retrieve the bearer token.
   *
   * @param options - HTTP request options {@link ApiRequestOptions}.
   * @returns The HTTP request options {@link ApiRequestOptions} with an additional authorization header.
   */
  private async addAuthHeader(
    options?: ApiRequestOptions,
  ): Promise<ApiRequestOptions> {
    const initialOptions = options ?? {};
    const errorInfo = `(baseUri: ${this.baseUri}, correlationId: ${options?.correlationId ?? "Not provided"})`;

    if (
      !this.cachedToken ||
      (this.cachedToken && this.cachedToken.expiresOn < new Date())
    ) {
      try {
        this.cachedToken = await this.cca.acquireTokenByClientCredential({
          scopes: [`${this.resource}/.default`],
        });
      } catch (error) {
        return Promise.reject(
          new Error(
            `Error acquiring auth token "${error.message}" ${errorInfo}`,
          ),
        );
      }
    }

    initialOptions.headers = initialOptions.headers ?? new Headers();
    initialOptions.headers.set(
      "authorization",
      `Bearer ${this.cachedToken.accessToken}`,
    );

    return initialOptions;
  }

  /**
   * @inheritdoc
   */
  async requestRaw(
    method: ApiRequestMethod,
    path: string,
    options?: ApiRequestOptions,
  ): Promise<Response> {
    return super.requestRaw(method, path, await this.addAuthHeader(options));
  }

  /**
   * @inheritdoc
   */
  async request<T>(
    method: ApiRequestMethod,
    path: string,
    options?: ApiRequestOptions,
  ): Promise<T | null> {
    return super.request(method, path, await this.addAuthHeader(options));
  }
}
