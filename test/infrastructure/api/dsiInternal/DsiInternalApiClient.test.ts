import { MsalApiClient } from "../../../../src/infrastructure/api/common/MsalApiClient";
import { ApiName, DsiInternalApiClient } from "../../../../src/infrastructure/api/dsiInteral/DsiInternalApiClient";

jest.mock("../../../../src/infrastructure/api/common/MsalApiClient");

describe("When creating a DSi internal API client", () => {
  const originalEnv = { ...process.env };
  const parentClient = jest.mocked(MsalApiClient);

  beforeEach(() => {
    process.env = {
      API_INTERNAL_DIRECTORIES_HOST: "Testing",
      API_INTERNAL_TENANT: "Testing",
      API_INTERNAL_AUTHORITY_HOST: "Testing",
      API_INTERNAL_CLIENT_ID: "Testing",
      API_INTERNAL_CLIENT_SECRET: "Testing",
      API_INTERNAL_RESOURCE: "Testing",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("it will throw an error if the required HOST environment variable is not set for the API", () => {
    const apiName = ApiName.Directories;
    const apiEnvName = apiName.toUpperCase();
    const envVarName = `API_INTERNAL_${apiEnvName}_HOST`;
    delete process.env[envVarName];

    expect(() => new DsiInternalApiClient(apiName)).toThrow(`${envVarName} is missing, cannot create API connection!`);
  });

  it.each([
    "TENANT",
    "AUTHORITY_HOST",
    "CLIENT_ID",
    "CLIENT_SECRET",
    "RESOURCE",
  ])("it will throw an error if any required auth environment variables are not set (%p)", (variable) => {
    const envVarName = `API_INTERNAL_${variable}`;
    delete process.env[envVarName];

    expect(() => new DsiInternalApiClient(ApiName.Directories)).toThrow(`${envVarName} is missing, cannot create API connection!`);
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
