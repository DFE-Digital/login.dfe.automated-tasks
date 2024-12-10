import { AuthenticationResult, ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import { ApiClient, ApiRequestMethod } from "../../../../src/infrastructure/api/common/ApiClient";
import { MsalApiClient } from "../../../../src/infrastructure/api/common/MsalApiClient";

jest.mock("@azure/msal-node");
jest.mock("../../../../src/infrastructure/api/common/ApiClient");

describe("MSAL API client", () => {
  const defaultOptions = {
    baseUri: "https://testing.test/",
    auth: {
      tenant: "test-tenant",
      authorityHostUrl: "https://authority.test",
      clientId: "testClientId",
      clientSecret: "testClientSecret",
      resource: "testResource",
    },
  };
  const clientApp = jest.mocked(ConfidentialClientApplication);
  const parentClient = jest.mocked(ApiClient);
  const setAccessToken = (token: string) => {
    clientApp.prototype.acquireTokenByClientCredential.mockResolvedValue({
      accessToken: token,
    } as AuthenticationResult);
  };
  let client: MsalApiClient;

  beforeEach(() => {
    setAccessToken("");
  });

  describe("When creating a MSAL API client", () => {
    it("it creates a ConfidentialClientApplication with the specified auth options", () => {
      new MsalApiClient(defaultOptions);

      expect(clientApp).toHaveBeenCalled();
      expect(JSON.stringify(clientApp.mock.calls[0][0])).toEqual(JSON.stringify({
        auth: {
          authority: `${defaultOptions.auth.authorityHostUrl}/${defaultOptions.auth.tenant}`,
          clientId: defaultOptions.auth.clientId,
          clientSecret: defaultOptions.auth.clientSecret,
        },
        system: {
          loggerOptions: {
            loggerCallback(loglevel, message, _containsPii) {
              if (loglevel === LogLevel.Error) {
                console.error(message);
              } else {
                console.log(message);
              }
            },
            piiLoggingEnabled: false,
            logLevel: LogLevel.Error,
          },
        },
      }));
    });

    it.each([
      [LogLevel.Info, "true"],
      [LogLevel.Error, "false"],
      [LogLevel.Error, undefined],
    ])("it sets the logLevel option to %p when process.env.DEBUG is set to %p", (result, envValue) => {
      const initialEnv = { ...process.env };
      process.env.DEBUG = envValue;
      new MsalApiClient(defaultOptions);

      expect(clientApp).toHaveBeenCalled();
      expect(clientApp.mock.calls[0][0]!.system!.loggerOptions!.logLevel).toEqual(result);

      process.env = initialEnv;
    });
  });

  describe("requestRaw", () => {
    beforeEach(() => {
      parentClient.prototype.requestRaw.mockResolvedValue({} as Response);
      client = new MsalApiClient(defaultOptions);
      client["baseUri"] = defaultOptions.baseUri;
    });

    it("it acquires a token using the MSAL client application with the default scope", async () => {
      await client.requestRaw(ApiRequestMethod.GET, "", {});

      expect(clientApp.prototype.acquireTokenByClientCredential).toHaveBeenCalled();
      expect(clientApp.prototype.acquireTokenByClientCredential).toHaveBeenCalledWith({
        scopes: [ `${defaultOptions.auth.resource}/.default` ],
      });
    });

    it("it throws an error with a correlation ID if the MSAL package fails to retrieve an access token, when one is provided", async () => {
      const correlationId = "test-id";
      const errorMessage = "MSAL Error Example";
      clientApp.prototype.acquireTokenByClientCredential.mockRejectedValue(new Error(errorMessage));

      expect(client.requestRaw(ApiRequestMethod.GET, "", {
        correlationId: correlationId,
      })).rejects.toThrow(
        `Error acquiring auth token "${errorMessage}" (baseUri: ${defaultOptions.baseUri}, correlationId: ${correlationId})`
      );
    });

    it("it throws an error without a correlation ID if the MSAL package fails to retrieve an access token, when one isn't provided", async () => {
      const errorMessage = "MSAL Error Example";
      clientApp.prototype.acquireTokenByClientCredential.mockRejectedValue(new Error(errorMessage));

      expect(client.requestRaw(ApiRequestMethod.GET, "", {})).rejects.toThrow(
        `Error acquiring auth token "${errorMessage}" (baseUri: ${defaultOptions.baseUri}, correlationId: Not provided)`
      );
    });

    it("it calls ApiClient requestRaw with the passed method", async () => {
      const method = ApiRequestMethod.GET;
      await client.requestRaw(method, "", {});

      expect(parentClient.prototype.requestRaw).toHaveBeenCalled();
      expect(parentClient.prototype.requestRaw.mock.calls[0][0]).toEqual(method);
    });

    it("it calls ApiClient requestRaw with the passed path", async () => {
      const path = "test/test";
      await client.requestRaw(ApiRequestMethod.GET, path, {});

      expect(parentClient.prototype.requestRaw).toHaveBeenCalled();
      expect(parentClient.prototype.requestRaw.mock.calls[0][1]).toEqual(path);
    });

    it("it calls ApiClient requestRaw with an authorization header only if no options are provided", async () => {
      const token = "testing-token-123";
      setAccessToken(token);
      await client.requestRaw(ApiRequestMethod.GET, "");

      expect(parentClient.prototype.requestRaw).toHaveBeenCalled();
      expect(parentClient.prototype.requestRaw.mock.calls[0][2]).toMatchObject({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
    });

    it("it calls ApiClient requestRaw with an authorization header only if no headers are provided", async () => {
      const token = "testing-token-123";
      setAccessToken(token);
      await client.requestRaw(ApiRequestMethod.GET, "", {});

      expect(parentClient.prototype.requestRaw).toHaveBeenCalled();
      expect(parentClient.prototype.requestRaw.mock.calls[0][2]).toMatchObject({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
    });

    it("it calls ApiClient requestRaw with an added authorization header if other headers are provided", async () => {
      const token = "testing-token-123";
      const initialHeaders = {
        test: "testing",
        foo: "123",
      };
      setAccessToken(token);
      await client.requestRaw(ApiRequestMethod.GET, "", {
        headers: initialHeaders,
      });

      expect(parentClient.prototype.requestRaw).toHaveBeenCalled();
      expect(parentClient.prototype.requestRaw.mock.calls[0][2]).toMatchObject({
        headers: {
          ...initialHeaders,
          authorization: `Bearer ${token}`,
        },
      });
    });

    it("it calls ApiClient requestRaw with an overwritten authorization header if one is already provided", async () => {
      const token = "testing-token-123";
      setAccessToken(token);
      await client.requestRaw(ApiRequestMethod.GET, "", {
        headers: {
          authorization: "1234",
        },
      });

      expect(parentClient.prototype.requestRaw).toHaveBeenCalled();
      expect(parentClient.prototype.requestRaw.mock.calls[0][2]).toMatchObject({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
    });

    it("it calls ApiClient requestRaw with the other ApiRequestOptions left as-is", async () => {
      const requestOptions = {
        correlationId: "ID",
        jsonBody: "JSON",
        textBody: "TEXT"
      };
      await client.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(parentClient.prototype.requestRaw).toHaveBeenCalled();
      expect(parentClient.prototype.requestRaw.mock.calls[0][2]).toMatchObject(requestOptions);
    });
  });

  describe("request", () => {
    beforeEach(() => {
      parentClient.prototype.request.mockResolvedValue({});
      client = new MsalApiClient(defaultOptions);
      client["baseUri"] = defaultOptions.baseUri;
    });

    it("it acquires a token using the MSAL client application with the default scope", async () => {
      await client.request(ApiRequestMethod.GET, "", {});

      expect(clientApp.prototype.acquireTokenByClientCredential).toHaveBeenCalled();
      expect(clientApp.prototype.acquireTokenByClientCredential).toHaveBeenCalledWith({
        scopes: [ `${defaultOptions.auth.resource}/.default` ],
      });
    });

    it("it throws an error with a correlation ID if the MSAL package fails to retrieve an access token, when one is provided", async () => {
      const correlationId = "test-id";
      const errorMessage = "MSAL Error Example";
      clientApp.prototype.acquireTokenByClientCredential.mockRejectedValue(new Error(errorMessage));

      expect(client.request(ApiRequestMethod.GET, "", {
        correlationId: correlationId,
      })).rejects.toThrow(
        `Error acquiring auth token "${errorMessage}" (baseUri: ${defaultOptions.baseUri}, correlationId: ${correlationId})`
      );
    });

    it("it throws an error without a correlation ID if the MSAL package fails to retrieve an access token, when one isn't provided", async () => {
      const errorMessage = "MSAL Error Example";
      clientApp.prototype.acquireTokenByClientCredential.mockRejectedValue(new Error(errorMessage));

      expect(client.request(ApiRequestMethod.GET, "", {})).rejects.toThrow(
        `Error acquiring auth token "${errorMessage}" (baseUri: ${defaultOptions.baseUri}, correlationId: Not provided)`
      );
    });

    it("it calls ApiClient request with the passed method", async () => {
      const method = ApiRequestMethod.GET;
      await client.request(method, "", {});

      expect(parentClient.prototype.request).toHaveBeenCalled();
      expect(parentClient.prototype.request.mock.calls[0][0]).toEqual(method);
    });

    it("it calls ApiClient request with the passed path", async () => {
      const path = "test/test";
      await client.request(ApiRequestMethod.GET, path, {});

      expect(parentClient.prototype.request).toHaveBeenCalled();
      expect(parentClient.prototype.request.mock.calls[0][1]).toEqual(path);
    });

    it("it calls ApiClient request with an authorization header only if no options are provided", async () => {
      const token = "testing-token-123";
      setAccessToken(token);
      await client.request(ApiRequestMethod.GET, "");

      expect(parentClient.prototype.request).toHaveBeenCalled();
      expect(parentClient.prototype.request.mock.calls[0][2]).toMatchObject({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
    });

    it("it calls ApiClient request with an authorization header only if no headers are provided", async () => {
      const token = "testing-token-123";
      setAccessToken(token);
      await client.request(ApiRequestMethod.GET, "", {});

      expect(parentClient.prototype.request).toHaveBeenCalled();
      expect(parentClient.prototype.request.mock.calls[0][2]).toMatchObject({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
    });

    it("it calls ApiClient request with an added authorization header if other headers are provided", async () => {
      const token = "testing-token-123";
      const initialHeaders = {
        test: "testing",
        foo: "123",
      };
      setAccessToken(token);
      await client.request(ApiRequestMethod.GET, "", {
        headers: initialHeaders,
      });

      expect(parentClient.prototype.request).toHaveBeenCalled();
      expect(parentClient.prototype.request.mock.calls[0][2]).toMatchObject({
        headers: {
          ...initialHeaders,
          authorization: `Bearer ${token}`,
        },
      });
    });

    it("it calls ApiClient request with an overwritten authorization header if one is already provided", async () => {
      const token = "testing-token-123";
      setAccessToken(token);
      await client.request(ApiRequestMethod.GET, "", {
        headers: {
          authorization: "1234",
        },
      });

      expect(parentClient.prototype.request).toHaveBeenCalled();
      expect(parentClient.prototype.request.mock.calls[0][2]).toMatchObject({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
    });

    it("it calls ApiClient request with the other ApiRequestOptions left as-is", async () => {
      const requestOptions = {
        correlationId: "ID",
        jsonBody: "JSON",
        textBody: "TEXT"
      };
      await client.request(ApiRequestMethod.GET, "", requestOptions);

      expect(parentClient.prototype.request).toHaveBeenCalled();
      expect(parentClient.prototype.request.mock.calls[0][2]).toMatchObject(requestOptions);
    });
  });
});
