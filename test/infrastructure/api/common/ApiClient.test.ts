import { ApiClient, ApiRequestMethod } from "../../../../src/infrastructure/api/common/ApiClient";

describe("Base API client", () => {
  const originalFetch = globalThis.fetch;
  const mockedFetch = jest.fn();
  const defaultOptions = {
    baseUri: "https://testing.test/",
  };
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient(defaultOptions);
    globalThis.fetch = mockedFetch.mockResolvedValue({
      status: 200,
      ok: true,
      body: "Testing Testing 123",
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("requestRaw", () => {
    it.each([
      ["", defaultOptions.baseUri],
      ["/", defaultOptions.baseUri],
      ["test", `${defaultOptions.baseUri}test`],
      ["/test", `${defaultOptions.baseUri}test`],
      ["test.html", `${defaultOptions.baseUri}test.html`],
      ["/test.html", `${defaultOptions.baseUri}test.html`],
      ["test/test2", `${defaultOptions.baseUri}test/test2`],
      ["/test/test2", `${defaultOptions.baseUri}test/test2`],
    ])("it makes a request to the correct URI (Path: %p | URI: %p)", async (path, uri) => {
      await apiClient.requestRaw(ApiRequestMethod.GET, path, {});

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[0].href).toEqual(uri);
    });

    it.each([
      ApiRequestMethod.DELETE,
      ApiRequestMethod.GET,
      ApiRequestMethod.PATCH,
      ApiRequestMethod.POST,
      ApiRequestMethod.PUT,
    ])("it makes a request to the specified method (%p)", async (method) => {
      await apiClient.requestRaw(method, "", {});

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].method).toEqual(method);
    });

    it("it passes null as the body if the method is GET", async () => {
      await apiClient.requestRaw(ApiRequestMethod.GET, "", {
        jsonBody: "test",
        textBody: "test",
      });

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].body).toEqual(null);
    });

    it("it passes the JSON stringified body if the method is not GET and the jsonBody option is set", async () => {
      const requestBody = {
        test: "testing",
      };
      await apiClient.requestRaw(ApiRequestMethod.POST, "", {
        jsonBody: requestBody,
      });

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].body).toEqual(JSON.stringify(requestBody));
    });

    it("it passes the JSON stringified body if the method is not GET and the jsonBody/textBody options are set", async () => {
      const requestBody = {
        test: "testing",
      };
      await apiClient.requestRaw(ApiRequestMethod.POST, "", {
        jsonBody: requestBody,
        textBody: "testing 123",
      });

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].body).toEqual(JSON.stringify(requestBody));
    });

    it("it passes the string body if the method is not GET, textBody option is set, and jsonBody is not set", async () => {
      const requestBody = "testing123";
      await apiClient.requestRaw(ApiRequestMethod.POST, "", {
        textBody: requestBody,
        jsonBody: undefined,
      });

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].body).toEqual(requestBody);
      expect(mockedFetch.mock.lastCall[1].body).not.toEqual(JSON.stringify(requestBody));
    });

    it("it passes null as the body if the method is not GET and the jsonBody/textBody options aren't set", async () => {
      await apiClient.requestRaw(ApiRequestMethod.POST, "", {
        jsonBody: undefined,
        textBody: undefined,
      });

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].body).toEqual(null);
    });

    it("it passes the specified headers to the request", async () => {
      const requestOptions = {
        headers: {
          foo: "Bar",
          testing: "123",
        },
      };
      await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual(requestOptions.headers);
    });

    it("it doesn't pass headers if none are specified and correlationId/jsonBody options aren't set", async () => {
      const requestOptions = {
        jsonBody: undefined,
        correlationId: undefined,
        headers: undefined,
      };
      await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual({});
    });

    it("it passes a correlation ID header if the correlationId option is set", async () => {
      const requestOptions = {
        correlationId: "testing123",
      };
      await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual({
        "x-correlation-id": requestOptions.correlationId,
      });
    });

    it("it passes a JSON content type header if the method is not GET and the jsonBody option is set", async () => {
      const requestOptions = {
        jsonBody: "testing123",
      };
      await apiClient.requestRaw(ApiRequestMethod.POST, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual({
        "content-type": "application/json",
      });
    });

    it("it doesn't pass a JSON content type header if the method is not GET and the jsonBody option is not set", async () => {
      const requestOptions = {
        jsonBody: undefined,
      };
      await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual({});
    });

    it("it doesn't pass a JSON content type header if the method is GET and the jsonBody option is set", async () => {
      const requestOptions = {
        jsonBody: "testing123",
      };
      await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual({});
    });

    it("it passes no headers and null as the body if the method is GET and the options are not defined", async () => {
      await apiClient.requestRaw(ApiRequestMethod.GET, "");

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1]).toEqual({
        method: ApiRequestMethod.GET,
        body: null,
        headers: {},
      });
    });

    it("it passes no headers and null as the body if the method isn't GET and the options are not defined", async () => {
      await apiClient.requestRaw(ApiRequestMethod.POST, "");

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1]).toEqual({
        method: ApiRequestMethod.POST,
        body: null,
        headers: {},
      });
    });

    it("it throws an error with correlationId if fetch throws an error, and correlationId is set", async () => {
      const errorMessage = "Fetch Failed";
      globalThis.fetch = mockedFetch.mockRejectedValue(new Error(errorMessage));
      const requestOptions = {
        correlationId: "testing123",
      };

      expect(apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions)).rejects.toThrow(
        `API fetch error "${errorMessage}" (baseUri: ${defaultOptions.baseUri}, correlationId: ${requestOptions?.correlationId})`
      );
    });

    it("it throws an error without correlationId if fetch throws an error, and correlationId is not set", async () => {
      const errorMessage = "Fetch Failed";
      globalThis.fetch = mockedFetch.mockRejectedValue(new Error(errorMessage));

      expect(apiClient.requestRaw(ApiRequestMethod.GET, "", {})).rejects.toThrow(
        `API fetch error "${errorMessage}" (baseUri: ${defaultOptions.baseUri}, correlationId: Not provided)`
      );
    });

    it("it throws an error with correlationId if the response is not ok, the status is not 404, and correlationId is set", async () => {
      const failedResponse = {
        status: 500,
        statusText: "Internal Server Error",
        ok: false,
      };
      globalThis.fetch = mockedFetch.mockResolvedValue(failedResponse);
      const requestOptions = {
        correlationId: "testing123",
      };

      expect(apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions)).rejects.toThrow(
        `API request failed with status ${failedResponse.status} "${failedResponse.statusText}" (baseUri: ${defaultOptions.baseUri}, correlationId: ${requestOptions?.correlationId})`
      );
    });

    it("it throws an error without correlationId if the response is not ok, the status is not 404, and correlationId is not set", async () => {
      const failedResponse = {
        status: 500,
        statusText: "Internal Server Error",
        ok: false,
      };
      globalThis.fetch = mockedFetch.mockResolvedValue(failedResponse);

      expect(apiClient.requestRaw(ApiRequestMethod.GET, "", {})).rejects.toThrow(
        `API request failed with status ${failedResponse.status} "${failedResponse.statusText}" (baseUri: ${defaultOptions.baseUri}, correlationId: Not provided)`
      );
    });

    it("it doesn't throw an error if the response status is 404, and the response is not okay", async () => {
      const failedResponse = {
        status: 404,
        statusText: "Not Found",
        ok: false,
      };
      globalThis.fetch = mockedFetch.mockResolvedValue(failedResponse);

      expect(apiClient.requestRaw(ApiRequestMethod.GET, "", {})).resolves.not.toThrow();
    });

    it("it doesn't throw an error if the response is ok", async () => {
      expect(apiClient.requestRaw(ApiRequestMethod.GET, "", {})).resolves.not.toThrow();
    });
  });

  describe("request", () => {
    let spyRequestRaw: jest.SpyInstance<Promise<Response>, any, any>;

    beforeEach(() => {
      spyRequestRaw = jest.spyOn(apiClient, "requestRaw").mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve("JSON: Testing Testing 123"),
      } as Response);
    });

    it("it passes the method, path, and options to the requestRaw function", async () => {
      const requestOptions = {
        correlationId: "testing123",
        headers: {
          test: "testing"
        },
        textBody: "testing testing 123",
      };
      await apiClient.request(ApiRequestMethod.GET, "test", requestOptions);

      expect(spyRequestRaw).toHaveBeenCalled();
      expect(spyRequestRaw).toHaveBeenCalledWith(ApiRequestMethod.GET, "test", requestOptions);
    });

    it("it returns the JSON parsed response body if the response status is not 404", async () => {
      const result = await apiClient.request(ApiRequestMethod.GET, "", {});

      expect(spyRequestRaw).toHaveBeenCalled();
      expect(result).toEqual("JSON: Testing Testing 123");
    });

    it("it returns null if the response status is 404", async () => {
      spyRequestRaw.mockResolvedValue({
        status: 404,
        ok: false,
      } as Response);
      const result = await apiClient.request(ApiRequestMethod.GET, "", {});

      expect(spyRequestRaw).toHaveBeenCalled();
      expect(result).toEqual(null);
    });
  });
});
