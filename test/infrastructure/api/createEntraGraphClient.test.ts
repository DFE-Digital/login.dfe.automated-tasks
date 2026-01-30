import { Client } from "@microsoft/microsoft-graph-client";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import { createEntraGraphClient } from "../../../src/infrastructure/api/createEntraGraphClient";
import { checkEnv } from "../../../src/infrastructure/utils";

jest.mock("@microsoft/microsoft-graph-client");
jest.mock("@azure/msal-node");
jest.mock("../../../src/infrastructure/utils");

describe("createEntraGraphClient", () => {
  const originalEnv = { ...process.env };
  const checkEnvMock = jest.mocked(checkEnv);
  const clientAppMock = jest.mocked(ConfidentialClientApplication);
  const graphClientMock = jest.mocked(Client);

  beforeEach(() => {
    process.env = {
      ENTRA_CLOUD_INSTANCE: "https://localhost",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("it will call checkEnv with the required environment variables for creating a ConfidentialClientApplication for Entra", () => {
    createEntraGraphClient();

    expect(checkEnvMock).toHaveBeenCalled();
    expect(checkEnvMock).toHaveBeenCalledWith(
      [
        "ENTRA_CLIENT_ID",
        "ENTRA_CLIENT_SECRET",
        "ENTRA_CLOUD_INSTANCE",
        "ENTRA_TENANT_ID",
      ],
      "Entra Graph API",
    );
  });

  it("it will throw an error if checkEnv throws an error when any required environment variables are not set", () => {
    const errorMessage = "Test Error";
    checkEnvMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    expect(() => createEntraGraphClient()).toThrow(errorMessage);
  });

  it("it will throw an error if the ENTRA_CLOUD_INSTANCE environment variable is not a valid URL", () => {
    process.env.ENTRA_CLOUD_INSTANCE = "test";

    expect(() => createEntraGraphClient()).toThrow("Invalid URL");
  });

  it("it creates a ConfidentialClientApplication with the required options", () => {
    process.env.ENTRA_CLIENT_ID = "clientId";
    process.env.ENTRA_CLIENT_SECRET = "clientSecret";
    process.env.ENTRA_CLOUD_INSTANCE = "https://localhost";
    process.env.ENTRA_TENANT_ID = "tenantId";

    createEntraGraphClient();

    expect(clientAppMock).toHaveBeenCalled();
    expect(clientAppMock).toHaveBeenCalledWith({
      auth: {
        authority: `${process.env.ENTRA_CLOUD_INSTANCE}/${process.env.ENTRA_TENANT_ID}`,
        knownAuthorities: [new URL(process.env.ENTRA_CLOUD_INSTANCE).host],
        clientId: process.env.ENTRA_CLIENT_ID,
        clientSecret: process.env.ENTRA_CLIENT_SECRET,
      },
      system: {
        loggerOptions: {
          loggerCallback: expect.any(Function),
          piiLoggingEnabled: false,
          logLevel: LogLevel.Error,
        },
      },
    });
  });

  it("it will create a Graph API client with an auth provider function", () => {
    createEntraGraphClient();

    expect(graphClientMock.initWithMiddleware).toHaveBeenCalled();
    expect(graphClientMock.initWithMiddleware).toHaveBeenCalledWith({
      authProvider: {
        getAccessToken: expect.any(Function),
      },
    });
  });
});
