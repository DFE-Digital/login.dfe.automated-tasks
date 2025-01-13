import { MsalApiClient } from "../../../../src/infrastructure/api/common/MsalApiClient";
import { ApiName, DsiInternalApiClient } from "../../../../src/infrastructure/api/dsiInternal/DsiInternalApiClient";
import { checkEnv } from "../../../../src/infrastructure/utils";

jest.mock("../../../../src/infrastructure/api/common/MsalApiClient");
jest.mock("../../../../src/infrastructure/utils");

describe("When creating a DSi internal API client", () => {
  const originalEnv = { ...process.env };
  const parentClient = jest.mocked(MsalApiClient);
  const checkEnvMock = jest.mocked(checkEnv);

  beforeEach(() => {
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("it will call checkEnv with the required environment variables and name for connecting to the specified API", () => {
    const apiName = ApiName.Directories;
    const apiEnvName = apiName.toUpperCase();
    process.env[`API_INTERNAL_${apiEnvName}_HOST`] = "testing";
    new DsiInternalApiClient(apiName);

    expect(checkEnvMock).toHaveBeenCalled();
    expect(checkEnvMock).toHaveBeenCalledWith([
      `API_INTERNAL_${apiEnvName}_HOST`,
      "API_INTERNAL_TENANT",
      "API_INTERNAL_AUTHORITY_HOST",
      "API_INTERNAL_CLIENT_ID",
      "API_INTERNAL_CLIENT_SECRET",
      "API_INTERNAL_RESOURCE",
    ], "DSi internal API");
  });

  it("it will throw an error if checkEnv throws an error when any required environment variables are not set", () => {
    const errorMessage = "Test Error";
    checkEnvMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    expect(() => new DsiInternalApiClient(ApiName.Directories)).toThrow(errorMessage);
  });

  it("it will call the MSAL API client constructor with the expected options", () => {
    const options = {
      API_INTERNAL_DIRECTORIES_HOST: "https://test.directories.host",
      API_INTERNAL_TENANT: "Test Tenant",
      API_INTERNAL_AUTHORITY_HOST: "Test Authority Host",
      API_INTERNAL_CLIENT_ID: "Test Client ID",
      API_INTERNAL_CLIENT_SECRET: "Test Client Secret",
      API_INTERNAL_RESOURCE: "Test Resource",
    };
    process.env = options;
    new DsiInternalApiClient(ApiName.Directories);

    expect(parentClient).toHaveBeenCalled();
    expect(parentClient).toHaveBeenCalledWith({
      baseUri: options.API_INTERNAL_DIRECTORIES_HOST,
      auth: {
        tenant: options.API_INTERNAL_TENANT,
        authorityHostUrl: options.API_INTERNAL_AUTHORITY_HOST,
        clientId: options.API_INTERNAL_CLIENT_ID,
        clientSecret: options.API_INTERNAL_CLIENT_SECRET,
        resource: options.API_INTERNAL_RESOURCE,
      },
    });
  });

  it.each([
    "httexample.com",
    "HTTexample.com",
    "hTtexample.com",
    "123testing.test",
    "testingtest.test",
  ])("it will prepend https:// to the base URI if it doesn't start with http (case-insensitive) (%p)", (uri) => {
    process.env.API_INTERNAL_DIRECTORIES_HOST = uri;
    new DsiInternalApiClient(ApiName.Directories);

    expect(parentClient).toHaveBeenCalled();
    expect(parentClient.mock.calls[0][0].baseUri).toEqual(`https://${uri}`);
  });

  it.each([
    "httpexample.com",
    "httpsexample.com",
    "HTTPexample.com",
    "HTTPSexample.com",
    "hTtPexample.com",
    "hTtPsexample.com",
  ])("it won't prepend https:// to the base URI if it starts with http (case-insensitive) (%p)", (uri) => {
    process.env.API_INTERNAL_DIRECTORIES_HOST = uri;
    new DsiInternalApiClient(ApiName.Directories);

    expect(parentClient).toHaveBeenCalled();
    expect(parentClient.mock.calls[0][0].baseUri).toEqual(uri);
  });
});
